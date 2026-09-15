/** Opt in with TEST_DATABASE_URL; every suite owns an isolated schema. */
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { runMigrations } from '../db/migrate';
import { FetchResult } from '../google/health-api.client';
import { RawStore } from './raw-store';

const url = process.env.TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;
const spec = { dataType: 'sleep', method: 'list' };
function response(body: unknown = { a: 1, b: 2 }, status = 200, pageIndex = 0): FetchResult {
  return { ok: status === 200, items: [], pages: [{ body, status, pageIndex, url: 'https://example.test/health', durationMs: 5 }] };
}

integration('RawStore (Postgres integration)', () => {
  const schema = `raw_store_${randomUUID().replace(/-/g, '')}`;
  let admin: Pool;
  let pool: Pool;
  let store: RawStore;
  const write = (result = response(), type = spec, start = '2026-09-01') =>
    store.store(randomUUID(), type, result, start, '2026-09-10', 'Asia/Bangkok');

  beforeAll(async () => {
    admin = new Pool({ connectionString: url });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    pool = new Pool({ connectionString: url, options: `-c search_path=${schema}` });
    await runMigrations(pool);
    store = new RawStore(pool);
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE daily_metrics, exercise_sessions, api_responses RESTART IDENTITY');
  });
  afterAll(async () => {
    await pool?.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  });

  it('reuses canonical payloads concurrently and updates latest request metadata', async () => {
    const [first] = await write();
    await pool.query(`UPDATE api_responses SET fetched_at = now() - interval '40 days', first_seen_at = now() - interval '40 days'`);
    const results = await Promise.all(Array.from({ length: 8 }, () => write(response({ b: 2, a: 1 }))));
    expect(results.every(([id]) => id === first)).toBe(true);
    const batchId = randomUUID();
    const next = response({ b: 2, a: 1 });
    next.pages[0].url = 'https://example.test/latest';
    next.pages[0].requestBody = { latest: true };
    next.pages[0].durationMs = 99;
    expect(await store.store(batchId, spec, next, '2026-09-01', '2026-09-10', 'Asia/Bangkok')).toEqual([first]);
    const { rows } = await pool.query('SELECT * FROM api_responses');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ batch_id: batchId, seen_count: '10', request_url: next.pages[0].url,
      request_body: { latest: true }, duration_ms: 99 });
    expect(rows[0].fetched_at.getTime()).toBeGreaterThan(rows[0].first_seen_at.getTime());
  });

  it('keeps changes, ranges, methods, types, pages and failed attempts distinct', async () => {
    const records = [await write(), await write(response({ a: 2 })),
      await write(response(), spec, '2026-09-02'),
      await write(response(), { ...spec, method: 'reconcile' }),
      await write(response(), { ...spec, dataType: 'steps' }),
      await write(response(undefined, 200, 1)),
      await write(response({ error: 'oops' }, 500)), await write(response({ error: 'oops' }, 500))];
    expect(new Set(records.flat()).size).toBe(records.length);
  });

  it('prunes only old unreferenced history, retaining both provenance tables and latest per type', async () => {
    const ids: number[] = [];
    for (let i = 0; i < 6; i++) ids.push(...await write(response({ version: i })));
    await pool.query(`UPDATE api_responses SET fetched_at = now() - interval '40 days' WHERE id <> $1`, [ids[5]]);
    // Exercise the legacy null-hash path and multiple IDs within one metric.
    await pool.query('UPDATE api_responses SET payload_hash = NULL WHERE id = $1', [ids[0]]);
    await pool.query(`INSERT INTO daily_metrics (day, metric, unit, status, source_response_ids, normalizer_version)
      VALUES ('2026-09-01', 'sleep', 'min', 'ok', $1, 'test')`, [[ids[0], ids[1]]]);
    await pool.query(`INSERT INTO exercise_sessions (day, exercise_type, started_at, ended_at, source_response_ids)
      VALUES ('2026-09-01', 'run', now(), now(), $1)`, [[ids[2]]]);
    const [latestOther] = await write(response(), { ...spec, dataType: 'steps' });
    await pool.query(`UPDATE api_responses SET fetched_at = now() - interval '40 days' WHERE id = $1`, [latestOther]);
    expect(await store.prune()).toEqual({ deleted: 2 });
    const kept = await pool.query('SELECT id FROM api_responses ORDER BY id');
    expect(kept.rows.map((r) => Number(r.id))).toEqual([ids[0], ids[1], ids[2], ids[5], latestOther]);
    expect((await pool.query('SELECT source_response_ids FROM daily_metrics')).rows[0].source_response_ids).toEqual([String(ids[0]), String(ids[1])]);
    expect(await store.prune()).toEqual({ deleted: 0 });
    await expect(store.prune(29)).rejects.toThrow('at least 30');
  });

  it('skips cleanup during another refresh and preserves an existing reentrant lock', async () => {
    const client = await pool.connect();
    const observer = await pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock(2200, 1)');
      expect(await store.prune()).toEqual({ deleted: 0 });
      expect(await store.prune(30, client)).toEqual({ deleted: 0 });
      expect((await observer.query('SELECT pg_try_advisory_lock(2200, 1) AS locked')).rows[0].locked).toBe(false);
    } finally {
      await client.query('SELECT pg_advisory_unlock_all()');
      await observer.query('SELECT pg_advisory_unlock_all()');
      client.release();
      observer.release();
    }
  });

  it('reports numeric database and relation sizes', async () => {
    await write();
    const stats = await store.storageStats();
    expect(stats.databaseBytes).toBeGreaterThan(0);
    expect(stats.rawBytes).toBeGreaterThan(0);
    expect(stats.metricsBytes).toBeGreaterThanOrEqual(0);
    expect(stats.exerciseBytes).toBeGreaterThanOrEqual(0);
  });
});
