import { DATA_TYPES } from '../ingest/metrics';
import { addDays } from '../ingest/time';
import { evaluateDay, RULES } from '../rules/rules';
import { mean, round } from './stats';

export interface HealthRow { day: string; metric: string; value: number | string | null; status: string }
export const MONITOR_METRICS = ['hrv_avg_ms', 'rhr_bpm', 'respiratory_rate_bpm', 'spo2_avg_pct', 'sleep_minutes_asleep', 'sleep_efficiency_pct'];
const COVERAGE_METRICS = [...MONITOR_METRICS, 'sleeping_hr_bpm', 'steps', 'active_zone_minutes', 'azm_fat_burn_min', 'azm_cardio_min', 'azm_peak_min', 'hrz_moderate_min', 'hrz_vigorous_min', 'hrz_peak_min'];
const number = (r?: HealthRow) => r && r.value !== null && r.status !== 'missing' && Number.isFinite(Number(r.value)) ? Number(r.value) : null;

/** Coverage is stored daily-record availability, not device wear time or medical confidence. */
export function healthOverview(rows: HealthRow[], today: string, windowDays = 60) {
  const start = addDays(today, -windowDays);
  const grid = new Map<string, HealthRow>();
  for (const r of rows) if (r.day >= start && r.day <= today) grid.set(`${r.day}/${r.metric}`, r);
  const at = (d: string, m: string) => grid.get(`${d}/${m}`);
  const get = (d: string, m: string) => at(d, m)?.status === 'ok' ? number(at(d, m)) : null;
  const dates = Array.from({ length: windowDays }, (_, i) => addDays(start, i));
  const checks = evaluateDay(today, [...dates, today], get, { goal_sleep_min: null, goal_steps: null, goal_azm_week: null });
  const average = (metric: string, n: number) => {
    const values = dates.filter(d => d >= addDays(today, -n)).map(d => get(d, metric)).filter((v): v is number => v !== null);
    const m = mean(values);
    return { value: m === null ? null : round(m, 1), n: values.length };
  };
  const coverage = COVERAGE_METRICS.map(metric => {
    const completeDates = dates.filter(d => get(d, metric) !== null);
    const partialDates = dates.filter(d => at(d, metric)?.status === 'partial' && number(at(d, metric)) !== null);
    const missingDates = dates.filter(d => number(at(d, metric)) === null || !['ok', 'partial'].includes(at(d, metric)!.status));
    return { metric, dataType: DATA_TYPES.find(t => t.produces.some(m => m === metric))?.dataType,
      completeDays: completeDates.length, partialDays: partialDates.length, missingDays: missingDates.length,
      coveragePct: round(completeDates.length / windowDays * 100, 1), missingDates, partialDates,
      latestDay: [...completeDates, ...partialDates].sort().at(-1) ?? null };
  });
  const monitor = MONITOR_METRICS.map(metric => {
    const row = at(today, metric), value = number(row);
    const check = checks.find(c => c.kind === 'personal' && c.metric === metric);
    const rule = RULES.find(r => r.kind === 'personal' && r.metric === metric);
    const range = check?.band && Number.isFinite(check.band.lo) && Number.isFinite(check.band.hi) ? check.band : null;
    const position = value === null ? 'missing' : row?.status === 'partial' ? 'partial' : !range ? 'collecting' : value < range.lo ? 'below' : value > range.hi ? 'above' : 'within';
    const lastDay = [...dates, today].reverse().find(d => number(at(d, metric)) !== null);
    return { metric, day: today, value, status: row?.status ?? 'missing', position, range,
      baselineDays: check?.band?.n ?? dates.filter(d => d >= addDays(today, -(rule?.kind === 'personal' ? rule.windowDays : 14)) && get(d, metric) !== null).length,
      baselineWindow: rule?.kind === 'personal' ? rule.windowDays : null,
      minimumDays: rule?.kind === 'personal' ? rule.minDays : null,
      mean7: average(metric, 7), mean28: average(metric, 28),
      lastReading: lastDay ? { day: lastDay, value: number(at(lastDay, metric)) } : null };
  });
  return { day: today, range: { start, end: addDays(today, -1), days: windowDays }, coverage, monitor };
}
