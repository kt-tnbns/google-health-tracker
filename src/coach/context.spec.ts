import { buildContext, renderContextForPrompt } from './context';
import { deterministicSummary } from './coach.service';

const row = (day: string, metric: string, value: number | null, unit = 'x', status = value === null ? 'missing' : 'ok') => ({ day, metric, value, unit, status });

describe('coach context', () => {
  const rows = [
    ...['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08'].flatMap((d, i) => [
      row(d, 'hrv_avg_ms', 40 + i, 'ms'), row(d, 'rhr_bpm', 60, 'bpm'), row(d, 'sleep_minutes_asleep', 420, 'min'),
    ]),
    row('2026-09-09', 'hrv_avg_ms', 55, 'ms'),
    row('2026-09-09', 'rhr_bpm', null, 'bpm'),
  ];

  it('computes latest, 7-day prior baseline and delta', () => {
    const ctx = buildContext(rows, '2026-09-09', 'Asia/Bangkok', new Date('2026-09-09T01:00:00Z'));
    const hrv = ctx.metrics.find((m) => m.metric === 'hrv_avg_ms')!;
    expect(hrv.latestDay).toBe('2026-09-09');
    expect(hrv.latest).toBe(55);
    expect(hrv.baselineDays).toBe(7);
    expect(hrv.baseline7).toBe(44);      // mean of 41..47
    expect(hrv.delta).toBe(11);
    const rhr = ctx.metrics.find((m) => m.metric === 'rhr_bpm')!;
    expect(rhr.latestDay).toBe('2026-09-08');  // 09-09 is missing → falls back
    expect(rhr.missingDays14).toBeGreaterThan(0);
  });

  it('flags a stale sleep record and renders numbers only', () => {
    const ctx = buildContext(rows, '2026-09-09', 'Asia/Bangkok');
    expect(ctx.sleepLatest?.day).toBe('2026-09-08');
    expect(ctx.dataQuality.notes.join(' ')).toMatch(/not today/);
    const txt = renderContextForPrompt(ctx);
    expect(txt).toContain('hrv_avg_ms: 55 ms on 2026-09-09; baseline7=44 (7d) delta=11 (25%)');
    expect(txt).toContain('2026-09-09: — / 55 / — / —');
    expect(deterministicSummary(ctx, 'th')).toContain('HRV 55 ms');
  });

  it('handles an empty database', () => {
    const ctx = buildContext([], '2026-09-09', 'Asia/Bangkok');
    expect(ctx.sleepLatest).toBeNull();
    expect(ctx.dataQuality.notes[0]).toMatch(/no data/);
    expect(renderContextForPrompt(ctx)).toContain('LATEST SLEEP: none');
  });
});
