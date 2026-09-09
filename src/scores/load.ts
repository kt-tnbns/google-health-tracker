/**
 * Cardiovascular load — daily load points + EWMA acute (7 d) / chronic (28 d), ACWR, Foster monotony & strain.
 * See docs/calculations.md §2. ACWR is shown as "how fast load is changing", never as injury risk.
 */
import { clamp, ewma, mean, median, round, sd } from './stats';

export const LOAD_VERSION = 'load-v0.1';

export interface LoadDayInput {
  day: string;
  /** minutes per Google Health zone from time-in-heart-rate-zone (preferred) */
  hrzModerate: number | null; hrzVigorous: number | null; hrzPeak: number | null;
  /** AZM credit per Fitbit zone (fat-burn 1/min, cardio & peak 2/min) — fallback */
  azmFatBurn: number | null; azmCardio: number | null; azmPeak: number | null;
  azmTotal: number | null;
  /** Σ Banister TRIMP of sessions with avg HR, if available (most defensible) */
  trimp: number | null;
  steps: number | null;
}

export interface LoadDayResult {
  day: string;
  load: number | null;            // daily load points (null = no data at all that day)
  source: 'trimp' | 'hr-zones' | 'azm-zones' | 'azm-total' | 'none';
  acute: number | null;           // EWMA 7 d
  chronic: number | null;         // EWMA 28 d
  acwr: number | null;            // acute/chronic, null until 28 days of history
  acwrBand: 'low' | 'steady' | 'building' | 'spike' | null;
  monotony: number | null;        // mean/SD of last 7 days
  strain: number | null;          // Σ7d × monotony
  history: number;                // days with load data so far (leading empty days excluded)
}

/** Daily load points from whatever is available, most specific first. */
export function dailyLoad(d: LoadDayInput): { load: number | null; source: LoadDayResult['source'] } {
  if (d.trimp !== null) return { load: round(d.trimp, 1), source: 'trimp' };
  if (d.hrzModerate !== null || d.hrzVigorous !== null || d.hrzPeak !== null) {
    return { load: round(1 * (d.hrzModerate ?? 0) + 2 * (d.hrzVigorous ?? 0) + 3 * (d.hrzPeak ?? 0), 1), source: 'hr-zones' };
  }
  if (d.azmFatBurn !== null || d.azmCardio !== null || d.azmPeak !== null) {
    // AZM sums already carry 2× for cardio/peak → minutes = sum/2. Re-weight: fat 1, cardio 2, peak 3.
    const fat = d.azmFatBurn ?? 0, cardio = (d.azmCardio ?? 0) / 2, peak = (d.azmPeak ?? 0) / 2;
    return { load: round(1 * fat + 2 * cardio + 3 * peak, 1), source: 'azm-zones' };
  }
  if (d.azmTotal !== null) return { load: round(d.azmTotal, 1), source: 'azm-total' };
  if (d.steps !== null) return { load: 0, source: 'none' };     // wore the device, no zone minutes → genuine 0
  return { load: null, source: 'none' };
}

/** Banister TRIMP for one session. sex affects the exponential weighting. */
export function trimp(durationMin: number, avgHr: number, restHr: number, maxHr: number, sex: 'male' | 'female' | null): number | null {
  if (!durationMin || !avgHr || !restHr || !maxHr || maxHr <= restHr) return null;
  const hrr = clamp((avgHr - restHr) / (maxHr - restHr), 0, 1);
  const y = sex === 'female' ? 0.86 * Math.exp(1.67 * hrr) : 0.64 * Math.exp(1.92 * hrr);
  return round(durationMin * hrr * y, 1);
}

export function computeLoadSeries(days: LoadDayInput[]): LoadDayResult[] {
  const loads = days.map(dailyLoad);
  const values = loads.map((l) => l.load);
  const acute = ewma(values, 7), chronic = ewma(values, 28);
  const med = median(values.filter((v): v is number => v !== null && v > 0)) ?? 0;
  const floor = Math.max(1, 0.2 * med);
  let seen = 0;
  return days.map((d, i) => {
    if (values[i] !== null) seen++;
    const history = seen;                 // days WITH data — leading empty days do not count
    const a = history >= 7 ? round(acute[i]!, 1) : null;
    const c = history >= 28 ? round(chronic[i]!, 1) : null;
    let acwr: number | null = null, band: LoadDayResult['acwrBand'] = null;
    if (a !== null && c !== null && c >= floor) {
      acwr = round(a / c, 2);
      band = acwr < 0.8 ? 'low' : acwr <= 1.3 ? 'steady' : acwr <= 1.5 ? 'building' : 'spike';
    }
    const last7 = values.slice(Math.max(0, i - 6), i + 1).map((v) => v ?? 0);
    let monotony: number | null = null, strain: number | null = null;
    if (history >= 7) {
      const m = mean(last7)!, s = sd(last7)!;
      monotony = s > 0 ? round(m / s, 2) : m > 0 ? 9.99 : null;
      strain = monotony === null ? null : round(last7.reduce((x, y) => x + y, 0) * monotony, 0);
    }
    return { day: d.day, load: loads[i].load, source: loads[i].source, acute: a, chronic: c, acwr, acwrBand: band, monotony, strain, history };
  });
}
