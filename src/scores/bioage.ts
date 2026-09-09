/**
 * Biological age models. Two models, never blended:
 *  - PhenoAge (Levine et al. 2018, Aging 10:573) — needs a 9-biomarker blood panel + chronological age.
 *    Coefficients from Table 1 of the paper; intercept/γ cross-checked against the BioAge R package
 *    (dayoonkwon/BioAge, R/phenoage_calc.R).
 *  - Fitness age (HUNT3 reference, NTNU CERG "fitness numbers") — needs VO2max + age + sex.
 */
import { round } from './stats';

export const PHENOAGE_VERSION = 'phenoage-levine2018';
export const FITNESSAGE_VERSION = 'fitnessage-hunt3-table';

/** Units are Levine 2018 units. */
export interface BloodPanel {
  albumin_g_l: number; creatinine_umol_l: number; glucose_mmol_l: number; crp_mg_dl: number;
  lymphocyte_pct: number; mcv_fl: number; rdw_pct: number; alp_u_l: number; wbc_k_ul: number;
}

const B = {
  intercept: -19.90667,
  albumin: -0.03359355, creatinine: 0.009506491, glucose: 0.1953192, lncrp: 0.09536762,
  lymph: -0.01199984, mcv: 0.02676401, rdw: 0.3306156, alp: 0.001868778, wbc: 0.05542406, age: 0.08035356,
  gamma: 0.007692696,
};

export function phenoAge(p: BloodPanel, ageYears: number): { phenoAge: number; accel: number; mortality10y: number; xb: number } | null {
  const vals = [p.albumin_g_l, p.creatinine_umol_l, p.glucose_mmol_l, p.crp_mg_dl, p.lymphocyte_pct, p.mcv_fl, p.rdw_pct, p.alp_u_l, p.wbc_k_ul, ageYears];
  if (vals.some((v) => typeof v !== 'number' || !Number.isFinite(v)) || p.crp_mg_dl <= 0) return null;
  const xb = B.intercept + B.albumin * p.albumin_g_l + B.creatinine * p.creatinine_umol_l + B.glucose * p.glucose_mmol_l
    + B.lncrp * Math.log(p.crp_mg_dl) + B.lymph * p.lymphocyte_pct + B.mcv * p.mcv_fl + B.rdw * p.rdw_pct + B.alp * p.alp_u_l + B.wbc * p.wbc_k_ul + B.age * ageYears;
  const m = 1 - Math.exp((-Math.exp(xb) * (Math.exp(120 * B.gamma) - 1)) / B.gamma);
  if (m <= 0 || m >= 1) return null;
  const pa = 141.50225 + Math.log(-0.0055305 * Math.log(1 - m)) / 0.090165;
  return { phenoAge: round(pa, 1), accel: round(pa - ageYears, 1), mortality10y: round(m * 100, 2), xb: round(xb, 4) };
}

/** Convert common lab units to Levine units. */
export const toLevineUnits = {
  albuminGdl: (v: number) => v * 10,               // g/dL → g/L
  creatinineMgdl: (v: number) => v * 88.42,        // mg/dL → µmol/L
  glucoseMgdl: (v: number) => v / 18.016,          // mg/dL → mmol/L
  crpMgL: (v: number) => v / 10,                   // mg/L → mg/dL
};

/** HUNT3 population mean VO2max by decade (NTNU CERG). Midpoints of the age bands. */
const HUNT: Record<'male' | 'female', [number, number][]> = {
  male: [[25, 54], [35, 49], [45, 47], [55, 42], [65, 39], [75, 34]],
  female: [[25, 43], [35, 40], [45, 38], [55, 34], [65, 31], [75, 27]],
};

/** Fitness age = age at which the reference population's mean VO2max equals yours (linear interpolation, clamp 20–80). */
export function fitnessAge(vo2max: number, sex: 'male' | 'female'): number | null {
  if (!Number.isFinite(vo2max) || vo2max <= 0) return null;
  const t = HUNT[sex];
  if (vo2max >= t[0][1]) {
    // extrapolate with the slope of the first band, never below 20
    const slope = (t[1][0] - t[0][0]) / (t[0][1] - t[1][1]);       // years per ml/kg/min
    return round(Math.max(20, t[0][0] - (vo2max - t[0][1]) * slope), 0);
  }
  for (let i = 0; i < t.length - 1; i++) {
    const [a0, v0] = t[i], [a1, v1] = t[i + 1];
    if (vo2max <= v0 && vo2max >= v1) return round(a0 + ((v0 - vo2max) / (v0 - v1)) * (a1 - a0), 0);
  }
  const [aL, vL] = t[t.length - 1], [aP, vP] = t[t.length - 2];
  return round(Math.min(80, aL + (vL - vo2max) * ((aL - aP) / (vP - vL))), 0);
}
