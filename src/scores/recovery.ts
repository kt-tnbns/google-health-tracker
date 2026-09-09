/**
 * Recovery (readiness) index — deterministic, per-person, versioned.
 * See docs/calculations.md §1 for the evidence and the parts that are heuristic.
 *
 * Evidence-based core: ln(RMSSD), 7-day rolling mean, SWC = 0.5·SD of the baseline, per-person z-scores.
 * Heuristic: the weights, the 0–100 mapping and the bands.
 */
import { baselineStats, clamp, clean, mean, round, sd } from './stats';

export const RECOVERY_VERSION = 'recovery-v0.1';

export interface DayInput {
  day: string;
  hrv: number | null;        // daily RMSSD ms
  rhr: number | null;        // bpm
  asleep: number | null;     // minutes
  efficiency: number | null; // %
  rr: number | null;         // breaths/min
  spo2: number | null;       // %
}

export interface Contributor { metric: string; z: number | null; weight: number; value: number | null; baseline: number | null; n: number }

export interface RecoveryResult {
  day: string;
  version: string;
  score: number | null;                    // 0–100, null when insufficient data
  band: 'recover' | 'moderate' | 'ready' | null;
  status: 'insufficient' | 'provisional' | 'established';
  confidence: number;                      // 0–1 = coverage × min(1, nBaseline/28)
  coverage: number;                        // Σ weights of metrics present today
  baselineDays: number;                    // HRV baseline size
  hrv7Status: 'low' | 'normal' | 'high' | null;
  hrv7: number | null; hrvBaseline: number | null; swc: number | null; cv7: number | null;
  flags: string[];                         // e.g. 'hrv7_low', 'illness_pattern', 'rhr_and_hrv_down'
  contributors: Contributor[];
  reasons: string[];                       // short machine-readable reasons for the coach/UI
}

const W = { hrv: 0.35, rhr: 0.2, sleep: 0.25, rr: 0.1, spo2: 0.1 };
const BASELINE_MAX = 60;
const MIN_BASELINE = 14;

/** Compute the recovery result for the LAST day of `days` (ascending). Earlier days form the baseline. */
export function computeRecovery(days: DayInput[]): RecoveryResult {
  const today = days[days.length - 1];
  const prior = days.slice(Math.max(0, days.length - 1 - BASELINE_MAX), days.length - 1);
  const flags: string[] = [];
  const reasons: string[] = [];
  const contributors: Contributor[] = [];

  // --- HRV (ln RMSSD) ---
  const lnHrv = (v: number | null) => (v !== null && v > 0 ? Math.log(v) : null);
  const baseHrv = clean(prior.map((d) => lnHrv(d.hrv)));
  const bs = baselineStats(baseHrv);
  const todayLn = lnHrv(today.hrv);
  const last7 = clean(days.slice(-7).map((d) => lnHrv(d.hrv)));
  const hrv7 = last7.length >= 3 ? mean(last7) : null;
  const swc = bs ? 0.5 * bs.scale : null;
  let hrv7Status: RecoveryResult['hrv7Status'] = null;
  if (bs && hrv7 !== null && swc !== null) {
    hrv7Status = hrv7 < bs.center - swc ? 'low' : hrv7 > bs.center + swc ? 'high' : 'normal';
  }
  const cv7 = last7.length >= 3 && mean(last7) ? round((sd(last7)! / mean(last7)!) * 100, 1) : null;
  const zToday = bs && todayLn !== null ? clamp((todayLn - bs.center) / bs.scale, -3, 3) : null;
  const z7 = bs && hrv7 !== null ? clamp((hrv7 - bs.center) / bs.scale, -3, 3) : null;
  // No HRV for this night → no score (HRV is the core signal); the 7-day context alone is not today's recovery.
  const zHrv = zToday === null ? null : z7 !== null ? 0.5 * zToday + 0.5 * z7 : zToday;
  contributors.push({ metric: 'hrv', z: zHrv, weight: W.hrv, value: today.hrv, baseline: bs ? round(Math.exp(bs.center), 1) : null, n: baseHrv.length });

  // --- RHR (higher = worse) ---
  const zRhr = zOf(prior.map((d) => d.rhr), today.rhr, -1);
  contributors.push({ metric: 'rhr', z: zRhr.z, weight: W.rhr, value: today.rhr, baseline: zRhr.center, n: zRhr.n });

  // --- Sleep composite ---
  const zAsleep = zOf(prior.map((d) => d.asleep), today.asleep, 1);
  const zEff = zOf(prior.map((d) => d.efficiency), today.efficiency, 1);
  let zSleep: number | null = null;
  if (zAsleep.z !== null && zEff.z !== null) zSleep = 0.6 * zAsleep.z + 0.4 * zEff.z;
  else zSleep = zAsleep.z ?? zEff.z;
  contributors.push({ metric: 'sleep', z: zSleep, weight: W.sleep, value: today.asleep, baseline: zAsleep.center, n: zAsleep.n });

  // --- Respiratory rate: penalise deviation in either direction ---
  const zRrRaw = zOf(prior.map((d) => d.rr), today.rr, 1);
  const zRr = zRrRaw.z === null ? null : -Math.abs(zRrRaw.z);
  contributors.push({ metric: 'rr', z: zRr, weight: W.rr, value: today.rr, baseline: zRrRaw.center, n: zRrRaw.n });

  // --- SpO2: penalise drops only ---
  const zSpRaw = zOf(prior.map((d) => d.spo2), today.spo2, 1);
  const zSp = zSpRaw.z === null ? null : Math.min(0, zSpRaw.z);
  contributors.push({ metric: 'spo2', z: zSp, weight: W.spo2, value: today.spo2, baseline: zSpRaw.center, n: zSpRaw.n });

  // --- combine ---
  const present = contributors.filter((c) => c.z !== null);
  const coverage = round(present.reduce((a, c) => a + c.weight, 0), 2);
  const baselineDays = baseHrv.length;
  const status: RecoveryResult['status'] = baselineDays < MIN_BASELINE ? 'insufficient' : baselineDays < 28 ? 'provisional' : 'established';
  const confidence = round(coverage * Math.min(1, baselineDays / 28), 2);

  let score: number | null = null;
  let band: RecoveryResult['band'] = null;
  if (status !== 'insufficient' && coverage >= 0.55 && zHrv !== null) {
    const sRaw = present.reduce((a, c) => a + c.weight * c.z!, 0) / coverage;   // renormalise to present weights
    score = Math.round(clamp(50 + 16.7 * sRaw, 0, 100));
    // override rules
    if (hrv7Status === 'low') { flags.push('hrv7_low'); reasons.push('7-day HRV below your normal range'); }
    if (zRhr.z !== null && zRhr.z <= -1.5 && zHrv <= -1.0) { flags.push('rhr_and_hrv_down'); reasons.push('resting HR up and HRV down together'); }
    if (zRr !== null && zRr <= -2 && zSp !== null && zSp <= -2) { flags.push('illness_pattern'); reasons.push('breathing rate and SpO₂ both far from usual'); }
    if (flags.length) score = Math.min(score, 40);
    band = score >= 67 ? 'ready' : score >= 34 ? 'moderate' : 'recover';
  } else {
    reasons.push(status === 'insufficient' ? `need ${MIN_BASELINE} nights of HRV (have ${baselineDays})` : zHrv === null ? 'no HRV for this night' : 'too few metrics for this night');
  }
  if (cv7 !== null && hrv7Status === 'low' && cv7 < 5) { flags.push('cv_collapse'); reasons.push('HRV variability collapsing while low'); }

  return {
    day: today.day, version: RECOVERY_VERSION, score, band, status, confidence, coverage, baselineDays,
    hrv7Status, hrv7: hrv7 === null ? null : round(Math.exp(hrv7), 1), hrvBaseline: bs ? round(Math.exp(bs.center), 1) : null,
    swc: swc === null ? null : round(swc, 3), cv7, flags, contributors: contributors.map((c) => ({ ...c, z: c.z === null ? null : round(c.z, 2) })), reasons,
  };
}

function zOf(prior: (number | null)[], today: number | null, sign: 1 | -1): { z: number | null; center: number | null; n: number } {
  const xs = clean(prior);
  const bs = baselineStats(xs);
  if (!bs || today === null) return { z: null, center: bs ? round(bs.center, 1) : null, n: xs.length };
  return { z: clamp((sign * (today - bs.center)) / bs.scale, -3, 3), center: round(bs.center, 1), n: xs.length };
}

/** Convenience: compute for every day in the series (each day uses only earlier days as baseline). */
export function computeRecoverySeries(days: DayInput[]): RecoveryResult[] {
  return days.map((_, i) => computeRecovery(days.slice(0, i + 1)));
}
