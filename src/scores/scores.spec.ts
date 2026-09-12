import { fitnessAge, phenoAge, toLevineUnits } from './bioage';
import { computeInsights } from './insights';
import { computeLoadSeries, dailyLoad, trimp } from './load';
import { computeRecovery, computeRecoverySeries, DayInput } from './recovery';
import { bootstrapDiffCI, ewma, hedgesG, madSd, mannWhitneyP, rng } from './stats';
import { e1rmBrzycki, e1rmEpley, weeklyStrength } from './strength';

const day = (i: number) => new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10);

function series(n: number, f: (i: number) => Partial<DayInput>): DayInput[] {
  return Array.from({ length: n }, (_, i) => ({ day: day(i), hrv: 45, rhr: 58, asleep: 420, efficiency: 92, rr: 14.5, spo2: 96.5, ...f(i) }));
}

describe('stats', () => {
  it('ewma leaves a gap and restarts after missing load', () => {
    const e = ewma([null, 10, 10, null, 10], 7);
    expect(e[0]).toBeNull(); expect(e[1]).toBe(10); expect(e[2]).toBe(10); expect(e[3]).toBeNull(); expect(e[4]).toBe(10);
  });
  it('hedges g and MWU agree on an obvious difference', () => {
    const a = [40, 41, 42, 43, 44, 45], b = [50, 51, 52, 53, 54, 55];
    expect(hedgesG(a, b)!).toBeLessThan(-2);
    expect(mannWhitneyP(a, b)!).toBeLessThan(0.05);
    const ci = bootstrapDiffCI(a, b, 500, 1)!;
    expect(ci.hi).toBeLessThan(0);
  });
  it('rng is deterministic', () => { const r1 = rng(7), r2 = rng(7); expect(r1()).toBe(r2()); });
  it('madSd is robust to one outlier', () => { expect(madSd([1, 2, 3, 4, 5, 100])!).toBeLessThan(5); });
});

describe('recovery', () => {
  it('is insufficient before 14 nights of HRV baseline', () => {
    const r = computeRecovery(series(10, () => ({})));
    expect(r.status).toBe('insufficient'); expect(r.score).toBeNull(); expect(r.reasons[0]).toMatch(/need 14/);
  });
  it('scores ~50 on a normal day with a flat baseline (noise added)', () => {
    const s = series(31, (i) => ({ hrv: 45 + (i % 3) - 1, rhr: 58 + (i % 2), asleep: 420 + (i % 4) * 5 }));
    const r = computeRecovery(s);
    expect(r.status).toBe('established');
    expect(r.score).toBeGreaterThan(35); expect(r.score).toBeLessThan(70);
    expect(r.coverage).toBe(1);
    expect(r.confidence).toBe(1);
  });
  it('flags a bad night: HRV down, RHR up, short sleep → recover band, capped ≤ 40', () => {
    const s = series(31, (i) => ({ hrv: 45 + (i % 3) - 1, rhr: 58 + (i % 2) }));
    const last = s[s.length - 1]; last.hrv = 28; last.rhr = 66; last.asleep = 300; last.efficiency = 80;
    // also drag the 7-day mean down
    for (let i = s.length - 4; i < s.length - 1; i++) s[i].hrv = 32;
    const r = computeRecovery(s);
    expect(r.band).toBe('recover'); expect(r.score!).toBeLessThanOrEqual(40);
    expect(r.flags).toContain('rhr_and_hrv_down');
    expect(r.hrv7Status).toBe('low');
  });
  it('drops missing metrics and reports reduced coverage; refuses to score without HRV', () => {
    const s = series(31, (i) => ({ hrv: 45 + (i % 3) - 1 }));
    s[s.length - 1].spo2 = null; s[s.length - 1].rr = null;
    const r = computeRecovery(s);
    expect(r.coverage).toBe(0.8); expect(r.score).not.toBeNull();
    s[s.length - 1].hrv = null;
    expect(computeRecovery(s).score).toBeNull();
  });
  it('series uses only prior days as baseline', () => {
    const rs = computeRecoverySeries(series(20, (i) => ({ hrv: 45 + (i % 3) - 1 })));
    expect(rs[10].status).toBe('insufficient'); expect(rs[19].status).toBe('provisional');
  });
});

describe('load', () => {
  it('uses a common AZM scale and keeps workout TRIMP out of all-day load', () => {
    const base = { day: 'd', hrzModerate: null, hrzVigorous: null, hrzPeak: null, azmFatBurn: null, azmCardio: null, azmPeak: null, azmTotal: null, trimp: null, steps: null };
    expect(dailyLoad({ ...base, trimp: 80 })).toEqual({ load: null, source: 'none' });
    expect(dailyLoad({ ...base, trimp: 800, azmTotal: 33 })).toEqual({ load: 33, source: 'azm-total' });
    expect(dailyLoad({ ...base, hrzModerate: 20, hrzVigorous: 10, hrzPeak: 5 })).toEqual({ load: 50, source: 'hr-zones' });
    expect(dailyLoad({ ...base, azmFatBurn: 20, azmCardio: 20, azmPeak: 10 })).toEqual({ load: 50, source: 'azm-zones' });
    expect(dailyLoad({ ...base, azmTotal: 33 })).toEqual({ load: 33, source: 'azm-total' });
    expect(dailyLoad({ ...base, steps: 5000 })).toEqual({ load: null, source: 'none' });
    expect(dailyLoad(base).load).toBeNull();
  });
  it('requires complete zones, preserves explicit zero and rejects invalid values', () => {
    const base = { day: day(0), hrzModerate: null, hrzVigorous: null, hrzPeak: null, azmFatBurn: null, azmCardio: null, azmPeak: null, azmTotal: null, trimp: null, steps: 5000 };
    expect(dailyLoad({ ...base, hrzModerate: 20 }).load).toBeNull();
    expect(dailyLoad({ ...base, azmFatBurn: 20 }).load).toBeNull();
    expect(dailyLoad({ ...base, azmTotal: 0 }).load).toBe(0);
    expect(dailyLoad({ ...base, azmTotal: NaN }).load).toBeNull();
    expect(dailyLoad({ ...base, azmTotal: -10 }).load).toBeNull();
  });
  it('a missing calendar day restarts trends and cannot become weekly rest', () => {
    const days = Array.from({ length: 35 }, (_, i) => ({ day: day(i), hrzModerate: null, hrzVigorous: null, hrzPeak: null, azmFatBurn: null, azmCardio: null, azmPeak: null, azmTotal: i === 30 ? null : 30, trimp: null, steps: 1000 }));
    const r = computeLoadSeries(days);
    expect(r[29].acwr).not.toBeNull();
    for (const row of r.slice(30)) {
      expect(row.acute).toBeNull(); expect(row.acwr).toBeNull(); expect(row.strain).toBeNull();
    }
    expect(r[34].history).toBe(4);
    const sparse = computeLoadSeries(days.filter((_, i) => i !== 30));
    expect(sparse[sparse.length - 1].acwr).toBeNull();
  });
  it('TRIMP grows with intensity', () => {
    expect(trimp(60, 120, 60, 180, 'male')!).toBeLessThan(trimp(60, 160, 60, 180, 'male')!);
    expect(trimp(60, 120, 60, 60, 'male')).toBeNull();
  });
  it('ACWR only after 28 days and detects a spike', () => {
    const days = Array.from({ length: 35 }, (_, i) => ({ day: day(i), hrzModerate: null, hrzVigorous: null, hrzPeak: null, azmFatBurn: null, azmCardio: null, azmPeak: null, azmTotal: i >= 30 ? 120 : 30, trimp: null, steps: null }));
    const r = computeLoadSeries(days);
    expect(r[20].acwr).toBeNull(); expect(r[27].acwr).not.toBeNull();
    expect(r[34].acwrBand).toBe('spike'); expect(r[34].acute!).toBeGreaterThan(r[34].chronic!);
    expect(r[27].monotony).toBeGreaterThan(5); // constant load → very high monotony
  });
});

describe('bioage', () => {
  it('PhenoAge for a healthy 40-year-old lands near chronological age', () => {
    const r = phenoAge({ albumin_g_l: 45, creatinine_umol_l: 80, glucose_mmol_l: 5.0, crp_mg_dl: 0.05, lymphocyte_pct: 32, mcv_fl: 89, rdw_pct: 12.5, alp_u_l: 65, wbc_k_ul: 5.5 }, 40)!;
    expect(r.phenoAge).toBeGreaterThan(25); expect(r.phenoAge).toBeLessThan(50);
    expect(r.mortality10y).toBeGreaterThan(0);
    // worse panel → older
    const bad = phenoAge({ albumin_g_l: 38, creatinine_umol_l: 110, glucose_mmol_l: 7.5, crp_mg_dl: 0.6, lymphocyte_pct: 20, mcv_fl: 96, rdw_pct: 15, alp_u_l: 110, wbc_k_ul: 9 }, 40)!;
    expect(bad.phenoAge).toBeGreaterThan(r.phenoAge + 10);
  });
  it('rejects CRP ≤ 0 and converts units', () => {
    expect(phenoAge({ albumin_g_l: 45, creatinine_umol_l: 80, glucose_mmol_l: 5, crp_mg_dl: 0, lymphocyte_pct: 32, mcv_fl: 89, rdw_pct: 12.5, alp_u_l: 65, wbc_k_ul: 5.5 }, 40)).toBeNull();
    expect(toLevineUnits.glucoseMgdl(90)).toBeCloseTo(5.0, 1); expect(toLevineUnits.creatinineMgdl(1)).toBeCloseTo(88.4, 1);
  });
  it('fitness age interpolates the HUNT table', () => {
    expect(fitnessAge(49, 'male')).toBe(35); expect(fitnessAge(48, 'male')).toBe(40);
    expect(fitnessAge(60, 'male')).toBe(20); expect(fitnessAge(20, 'female')).toBeGreaterThan(75);
  });
});

describe('insights', () => {
  it('surfaces a real tagged effect and hides underpowered ones', () => {
    const days = Array.from({ length: 60 }, (_, i) => day(i));
    const metrics: Record<string, Record<string, number | null>> = {}, tags: Record<string, string[]> = {};
    const r = rng(3);
    days.forEach((d, i) => {
      const alcohol = i % 5 === 0;
      tags[d] = alcohol ? ['alcohol'] : i % 17 === 0 ? ['nap'] : [];
      const next = day(i + 1);
      metrics[next] = { hrv_avg_ms: 45 + (r() - 0.5) * 4 - (alcohol ? 9 : 0), rhr_bpm: 58 + (r() - 0.5) * 2 + (alcohol ? 4 : 0), sleep_minutes_asleep: 420 + (r() - 0.5) * 40 };
    });
    const ins = computeInsights({ metrics, tags, days });
    const alc = ins.find((x) => x.tag === 'alcohol' && x.metric === 'hrv_avg_ms')!;
    expect(alc.surfaced).toBe(true); expect(alc.diff).toBeLessThan(-5); expect(alc.ci!.hi).toBeLessThan(0); expect(alc.strength).toBe('large');
    const nap = ins.find((x) => x.tag === 'nap' && x.metric === 'hrv_avg_ms')!;
    expect(nap.surfaced).toBe(false); expect(nap.nTagged).toBeLessThan(5);
    const sleep = ins.find((x) => x.tag === 'alcohol' && x.metric === 'sleep_minutes_asleep')!;
    expect(sleep.surfaced).toBe(false); // no true effect injected
  });
});

describe('strength', () => {
  it('e1RM formulas and weekly aggregation', () => {
    expect(e1rmEpley(100, 5)).toBeCloseTo(116.7, 1); expect(e1rmBrzycki(100, 5)).toBeCloseTo(112.5, 1); expect(e1rmEpley(100, 20)).toBeNull();
    const w = weeklyStrength([
      { session_id: 1, day: '2026-09-07', exercise: 'squat', muscle_group: 'legs', reps: 5, load_kg: 100, rpe: 8, rir: null, is_warmup: false },
      { session_id: 1, day: '2026-09-07', exercise: 'squat', muscle_group: 'legs', reps: 5, load_kg: 60, rpe: null, rir: null, is_warmup: true },
      { session_id: 2, day: '2026-09-09', exercise: 'bench', muscle_group: 'chest', reps: 8, load_kg: 70, rpe: 9, rir: null, is_warmup: false },
    ]);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ weekStart: '2026-09-07', tonnage: 500 + 300 + 560, hardSets: 2, sessions: 2 });
    expect(w[0].bestE1rm.squat).toBeCloseTo(116.7, 1);
  });
});

it('keeps today provisional and restarts comparisons when the activity source family changes', () => {
  const base = { hrzModerate: null, hrzVigorous: null, hrzPeak: null, azmFatBurn: null, azmCardio: null, azmPeak: null, trimp: null, steps: null };
  const days = Array.from({ length: 30 }, (_, i) => ({ ...base, day: day(i), azmTotal: 30 }));
  const today = computeLoadSeries(days, day(29))[29];
  expect(today).toMatchObject({ load: 30, provisional: true, acute: null, chronic: null, strain: null });
  const change = computeLoadSeries([...days, { ...base, day: day(30), azmTotal: null, hrzModerate: 30, hrzVigorous: 0, hrzPeak: 0 }])[30];
  expect(change).toMatchObject({ load: 30, history: 1, acute: null, chronic: null });
});
