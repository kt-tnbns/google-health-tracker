import { evaluateDay, derivedValue, RULES, RULES_VERSION } from './rules';

const days = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'];
const data: Record<string, Record<string, number>> = {
  '2026-09-01': { hrv_avg_ms: 40, active_zone_minutes: 20, steps: 4000 },
  '2026-09-02': { hrv_avg_ms: 42, active_zone_minutes: 30, steps: 9000 },
  '2026-09-03': { hrv_avg_ms: 44, active_zone_minutes: 40, steps: 6000 },
  '2026-09-04': { hrv_avg_ms: 41, active_zone_minutes: 70, steps: 7000 },
  '2026-09-05': { hrv_avg_ms: 60, sleep_minutes_asleep: 359, sleep_efficiency_pct: 97.3, sleep_latency_min: 6, sleep_deep_minutes: 85, sleep_rem_minutes: 70, sleep_light_minutes: 204, active_zone_minutes: 10, steps: 8200 },
};
const get = (d: string, m: string) => data[d]?.[m] ?? null;
const noGoals = { goal_sleep_min: null, goal_steps: null, goal_azm_week: null };

describe('rules table', () => {
  it('has unique ids and every reference rule covers the number line without gaps', () => {
    const ids = RULES.map((r) => r.id); expect(new Set(ids).size).toBe(ids.length);
    for (const r of RULES) if (r.kind === 'reference') for (const v of [0, 1, 50, 84.9, 85, 100, 359, 360, 420, 541, 5000, 8000, 10_000]) {
      expect(r.bands.some((b) => (b.min === undefined || v >= b.min) && (b.max === undefined || v < b.max))).toBe(true);
    }
  });
});

describe('evaluateDay', () => {
  const checks = evaluateDay('2026-09-05', days, get, noGoals);
  const by = (id: string) => checks.find((c) => c.id === id)!;
  it('reference bands: fixture night (5h59m, 97.3%, deep 24%) → duration low, efficiency good, deep above range', () => {
    expect(by('sleep.duration').level).toBe('low');
    expect(by('sleep.efficiency').level).toBe('good');
    expect(by('sleep.latency').level).toBe('good');
    expect(by('sleep.stage.deep').level).toBe('note');      // 85/359 = 23.7% > 23
    expect(by('sleep.stage.rem').level).toBe('note');       // 70/359 = 19.5% < 20
    expect(by('sleep.stage.light').level).toBe('good');     // 56.8%
    expect(by('sleep.efficiency').version).toBe(RULES_VERSION);
  });
  it('personal baseline: HRV 60 vs prior 40–44 → above, level good (higher is better)', () => {
    const c = by('personal.hrv');
    expect(c.level).toBe('good'); expect(c.text.en).toMatch(/Above your range/); expect(c.band!.n).toBe(4);
    expect(c.band!.lo).toBeGreaterThan(38); expect(c.band!.hi).toBeLessThan(46);
  });
  it('personal baseline needs ≥3 prior days → otherwise "na" with the count', () => {
    const c = evaluateDay('2026-09-02', days, get, noGoals).find((x) => x.id === 'personal.hrv')!;
    expect(c.level).toBe('na'); expect(c.band!.n).toBe(1);
  });
  it('rolling 7-day zone minutes = 170 → good (WHO 150)', () => {
    expect(derivedValue('2026-09-05', 'azm_week', get, days)).toBe(170);
    expect(by('activity.azm_week').level).toBe('good');
  });
  it('goals: sleep 359 vs goal 450 → low (<80%) with the shortfall; steps 8200 vs 8000 → met', () => {
    const g = evaluateDay('2026-09-05', days, get, { goal_sleep_min: 450, goal_steps: 8000, goal_azm_week: 200 });
    const sleep = g.find((c) => c.id === 'goal.sleep')!, steps = g.find((c) => c.id === 'goal.steps')!, azm = g.find((c) => c.id === 'goal.azm_week')!;
    expect(sleep.level).toBe('low'); expect(sleep.progress).toBeCloseTo(0.798, 2); expect(sleep.text.th).toMatch(/ขาดอีก 1 ชม. 31 น./);
    expect(steps.level).toBe('good'); expect(steps.text.en).toMatch(/Goal met/);
    expect(azm.level).toBe('fair'); expect(azm.value).toBe(170);
  });
  it('missing metrics produce no check (never treated as zero)', () => {
    const c = evaluateDay('2026-09-01', days, get, noGoals);
    expect(c.find((x) => x.id === 'sleep.duration')).toBeUndefined();
    expect(c.find((x) => x.id === 'sleep.stage.deep')).toBeUndefined();
  });
});
