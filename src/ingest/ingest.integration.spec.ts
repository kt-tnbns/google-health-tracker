/**
 * Integration test against a real Postgres. Runs only when TEST_DATABASE_URL is set:
 *   TEST_DATABASE_URL=postgres://health:health@localhost:5432/health npm test
 * Uses a stubbed HealthApiClient so no Google credentials are needed.
 */
import { Pool } from 'pg';
import { runMigrations } from '../db/migrate';
import { FetchResult, HealthApiClient } from '../google/health-api.client';
import { IngestService } from './ingest.service';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

process.env.ADMIN_TOKEN ??= 'test-admin-token-1234567890';
process.env.DATABASE_URL ??= url ?? 'postgres://unused';

function page(url: string, body: unknown, status = 200) {
  return { pageIndex: 0, url, status, durationMs: 5, body };
}

class StubApi {
  calls = 0;
  async read(dataType: string, method: string, filter: string): Promise<FetchResult> {
    const url = `https://health.googleapis.com/v4/users/me/dataTypes/${dataType}/dataPoints${method === 'reconcile' ? ':reconcile' : ''}?filter=${encodeURIComponent(filter)}`;
    if (dataType === 'sleep') {
      this.calls++;
      const items = [{ name: 'users/me/dataTypes/sleep/dataPoints/abc', sleep: { interval: { startTime: '2026-09-08T16:30:00Z', endTime: '2026-09-08T23:40:00Z' }, type: 'STAGES', summary: { minutesAsleep: 400 + this.calls, minutesAwake: 30, minutesInSleepPeriod: 430 }, metadata: { nap: false } } }];
      return { ok: true, items, pages: [page(url, { dataPoints: items })] };
    }
    if (dataType === 'daily-resting-heart-rate') {
      const items = [{ dailyRestingHeartRate: { date: { year: 2026, month: 9, day: 9 }, beatsPerMinute: 57 } }];
      return { ok: true, items, pages: [page(url, { dataPoints: items })] };
    }
    if (dataType === 'daily-oxygen-saturation') {
      // simulate a 403 (scope not granted) — must be recorded, not thrown
      return { ok: false, items: [], pages: [{ ...page(url, { error: { code: 403, message: 'insufficient scope' } }, 403), errorText: 'insufficient scope' }] };
    }
    return { ok: true, items: [], pages: [page(url, { dataPoints: [] })] };
  }
  async dailyRollUp(dataType: string, start: string, end: string): Promise<FetchResult> {
    const url = `https://health.googleapis.com/v4/users/me/dataTypes/${dataType}/dataPoints:dailyRollUp`;
    const items = [{ civilStartTime: { year: 2026, month: 9, day: 8 }, civilEndTime: { year: 2026, month: 9, day: 9 }, value: { [dataType === 'steps' ? 'steps' : 'activeZoneMinutes']: dataType === 'steps' ? { count: 8123 } : { totalMinutes: 25 } } }];
    return { ok: true, items, pages: [{ ...page(url, { rollupDataPoints: items }), requestBody: { range: { start, end } } }] };
  }
}

d('IngestService (integration)', () => {
  let pool: Pool;
  let svc: IngestService;
  let api: StubApi;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    await runMigrations(pool);
    await pool.query('TRUNCATE api_responses, daily_metrics RESTART IDENTITY');
    api = new StubApi();
    svc = new IngestService(pool, api as unknown as HealthApiClient);
  });
  afterAll(() => pool.end());

  it('stores raw pages and upserts normalized rows idempotently', async () => {
    const first = await svc.refresh({ startDate: '2026-09-07', endDate: '2026-09-10' });
    expect(first.perType.find((t) => t.dataType === 'sleep')).toMatchObject({ ok: true, items: 1, upserted: 9 });
    expect(first.perType.find((t) => t.dataType === 'daily-oxygen-saturation')).toMatchObject({ ok: false, httpStatus: 403 });

    const before = await pool.query('SELECT count(*)::int AS n FROM daily_metrics');
    const raw1 = await pool.query('SELECT count(*)::int AS n FROM api_responses');

    // second run: same window -> same number of normalized rows, more raw rows (history kept)
    await svc.refresh({ startDate: '2026-09-07', endDate: '2026-09-10' });
    const after = await pool.query('SELECT count(*)::int AS n FROM daily_metrics');
    const raw2 = await pool.query('SELECT count(*)::int AS n FROM api_responses');
    expect(after.rows[0].n).toBe(before.rows[0].n);
    expect(raw2.rows[0].n).toBe(raw1.rows[0].n * 2);

    // the newer value won
    const day = await svc.getDay('2026-09-09');
    const asleep = day.metrics.find((m: any) => m.metric === 'sleep_minutes_asleep');
    expect(Number(asleep.value)).toBe(402);
    expect(day.missing).toContain('spo2_avg_pct');
    expect(day.missing).not.toContain('rhr_bpm');

    // raw payload is inspectable and never contains an Authorization header
    const raws = await svc.listRaw(100);
    const one = await svc.getRaw(raws[0].id);
    expect(JSON.stringify(one)).not.toMatch(/Bearer /);
    expect(one.payload).toBeTruthy();
  });
});
