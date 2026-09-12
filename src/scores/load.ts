/**
 * Cardiovascular load — daily load points + EWMA acute (7 d) / chronic (28 d), ACWR, Foster monotony & strain.
 * See docs/calculations.md §2. ACWR is shown as "how fast load is changing", never as injury risk.
 */
import { clamp, mean, median, round, sd } from './stats';

export const LOAD_VERSION = 'load-v0.2';

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
  source: 'hr-zones' | 'azm-zones' | 'azm-total' | 'none';
  acute: number | null;           // EWMA 7 d
  chronic: number | null;         // EWMA 28 d
  acwr: number | null;            // acute/chronic, null until 28 days of history
  acwrBand: 'low' | 'steady' | 'building' | 'spike' | null;
  monotony: number | null;        // mean/SD of last 7 days
  strain: number | null;          // Σ7d × monotony
  history: number;                // consecutive calendar days with comparable load
  workoutTrimp: number | null;    // separate scale; never combined with all-day AZM
  provisional: boolean;          // current civil day is still accumulating
}

/** One comparable scale: moderate minutes + 2× vigorous/peak minutes (AZM).
 * Complete zone fields only. Steps and workout TRIMP cannot establish all-day load.
 */
export function dailyLoad(d: LoadDayInput): { load: number | null; source: LoadDayResult['source'] } {
  const valid = (v: number | null): v is number => v !== null && Number.isFinite(v) && v >= 0;
  if (valid(d.azmTotal)) return { load: round(d.azmTotal, 1), source: 'azm-total' };
  if ([d.azmFatBurn, d.azmCardio, d.azmPeak].every(valid)) {
    return { load: round(d.azmFatBurn! + d.azmCardio! + d.azmPeak!, 1), source: 'azm-zones' };
  }
  if ([d.hrzModerate, d.hrzVigorous, d.hrzPeak].every(valid)) {
    return { load: round(d.hrzModerate! + 2 * d.hrzVigorous! + 2 * d.hrzPeak!, 1), source: 'hr-zones' };
  }
  return { load: null, source: 'none' };
}

/** Banister TRIMP for one session. sex affects the exponential weighting. */
export function trimp(durationMin: number, avgHr: number, restHr: number, maxHr: number, sex: 'male' | 'female' | null): number | null {
  if (!durationMin || !avgHr || !restHr || !maxHr || maxHr <= restHr) return null;
  const hrr = clamp((avgHr - restHr) / (maxHr - restHr), 0, 1);
  const y = sex === 'female' ? 0.86 * Math.exp(1.67 * hrr) : 0.64 * Math.exp(1.92 * hrr);
  return round(durationMin * hrr * y, 1);
}

export function computeLoadSeries(days: LoadDayInput[], provisionalDay?: string): LoadDayResult[] {
  const loads = days.map(dailyLoad);
  let a: number | null = null, c: number | null = null;
  let run: number[] = [];
  return days.map((d, i) => {
    const value = loads[i].load;
    const provisional = d.day === provisionalDay;
    const gap = i > 0 && Date.parse(d.day + 'T00:00:00Z') - Date.parse(days[i - 1].day + 'T00:00:00Z') !== 86_400_000;
    const family = (source: LoadDayResult['source']) => source === 'hr-zones' ? 'hr-zones' : 'azm';
    const sourceChanged = i > 0 && family(loads[i].source) !== family(loads[i - 1].source);
    if (value === null || gap || provisional || sourceChanged) { a = null; c = null; run = []; }
    if (value !== null && !provisional) {
      a = a === null ? value : (2 / 8) * value + (1 - 2 / 8) * a;
      c = c === null ? value : (2 / 29) * value + (1 - 2 / 29) * c;
      run.push(value);
    }
    const history = run.length;
    const acute = history >= 7 ? round(a!, 1) : null;
    const chronic = history >= 28 ? round(c!, 1) : null;
    const floor = Math.max(1, 0.2 * (median(run.filter(v => v > 0)) ?? 0));
    let acwr: number | null = null, band: LoadDayResult['acwrBand'] = null;
    if (acute !== null && chronic !== null && chronic >= floor) {
      acwr = round(acute / chronic, 2);
      band = acwr < 0.8 ? 'low' : acwr <= 1.3 ? 'steady' : acwr <= 1.5 ? 'building' : 'spike';
    }
    let monotony: number | null = null, strain: number | null = null;
    if (history >= 7) {
      const last7 = run.slice(-7), m = mean(last7)!, s = sd(last7)!;
      monotony = s > 0 ? round(m / s, 2) : m > 0 ? 9.99 : null;
      strain = monotony === null ? null : round(last7.reduce((x, y) => x + y, 0) * monotony, 0);
    }
    return { day: d.day, load: value, source: loads[i].source, acute, chronic, acwr, acwrBand: band,
      monotony, strain, history, workoutTrimp: d.trimp, provisional };
  });
}
