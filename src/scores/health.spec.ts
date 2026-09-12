import { healthOverview } from './health';
import { addDays } from '../ingest/time';

const today = '2026-09-12';
const row = (day: string, metric: string, value: number | null, status = 'ok') => ({ day, metric, value, status });

describe('health overview', () => {
  it('counts calendar days, preserves zero, splits partial readings and excludes today from historical coverage', () => {
    const rows = [row('2026-09-09', 'active_zone_minutes', 0), row('2026-09-10', 'active_zone_minutes', 20, 'partial'),
      row('2026-09-11', 'active_zone_minutes', null), row(today, 'active_zone_minutes', 99), row('2026-08-01', 'active_zone_minutes', 100)];
    const r = healthOverview(rows, today, 3);
    const c = r.coverage.find(c => c.metric === 'active_zone_minutes')!;
    expect(c).toMatchObject({ completeDays: 1, partialDays: 1, missingDays: 1, coveragePct: 33.3 });
    expect(c.missingDates).toEqual(['2026-09-11']);
    expect(r.range).toEqual({ start: '2026-09-09', end: '2026-09-11', days: 3 });
  });
  it('does not substitute an older measurement for today; keeps historical dates explicit', () => {
    const r = healthOverview([row('2026-09-11', 'hrv_avg_ms', 40)], today, 30);
    const m = r.monitor.find(m => m.metric === 'hrv_avg_ms')!;
    expect(m.value).toBeNull(); expect(m.position).toBe('missing');
    expect(m.lastReading).toEqual({ day: '2026-09-11', value: 40 });
  });
  it('computes 7/28-day means without future leakage and uses the central personal rule', () => {
    const rows = Array.from({ length: 28 }, (_, i) => row(addDays(today, -28 + i), 'hrv_avg_ms', 40));
    rows.push(row(today, 'hrv_avg_ms', 80), row(addDays(today, 1), 'hrv_avg_ms', 999));
    const m = healthOverview(rows, today, 60).monitor.find(m => m.metric === 'hrv_avg_ms')!;
    expect(m.mean7).toEqual({ value: 40, n: 7 }); expect(m.mean28).toEqual({ value: 40, n: 28 });
    expect(m.position).toBe('above'); expect(m.range).toMatchObject({ lo: 37, hi: 43, n: 14 });
  });
  it('treats invalid and status-missing measurements as missing, and avoids ranges from partial data', () => {
    const rows = [row('2026-09-09', 'rhr_bpm', 55, 'missing'), row('2026-09-10', 'rhr_bpm', NaN),
      row('2026-09-11', 'rhr_bpm', 60, 'partial'), row(today, 'rhr_bpm', 62, 'partial')];
    const r = healthOverview(rows, today, 3);
    expect(r.coverage.find(c => c.metric === 'rhr_bpm')).toMatchObject({ completeDays: 0, partialDays: 1, missingDays: 2 });
    expect(r.monitor.find(m => m.metric === 'rhr_bpm')).toMatchObject({ value: 62, position: 'partial', range: null });
  });
  it('returns an honest empty report', () => {
    const r = healthOverview([], today, 60);
    expect(r.coverage.every(c => c.completeDays === 0 && c.missingDays === 60)).toBe(true);
    expect(r.monitor.every(m => m.value === null && m.range === null)).toBe(true);
  });
});
