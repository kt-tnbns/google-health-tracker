import { Pool } from 'pg';
import { runMigrations } from '../db/migrate';
import { SyncCoordinator, SyncResult } from './sync-coordinator';
import { todayCivil, addDays } from './time';

const dbUrl = process.env.TEST_DATABASE_URL;
(dbUrl ? describe : describe.skip)('sync coordination (PostgreSQL)', () => {
  const schema = `sync_test_${process.pid}`;
  let admin: Pool, pool: Pool, sync: SyncCoordinator;
  const today = todayCivil('Asia/Bangkok');
  const task = jest.fn(async (range, batchId): Promise<SyncResult> => ({ range, batchId, perType: [{ dataType: 'sleep', ok: true, httpStatus: 200, items: 1, pages: 1, upserted: 1 }] }));
  beforeAll(async () => {
    admin = new Pool({ connectionString: dbUrl });
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ connectionString: dbUrl, options: `-c search_path=${schema}` });
    await runMigrations(pool);
    sync = new SyncCoordinator(pool, 'Asia/Bangkok');
  });
  beforeEach(async () => {
    task.mockClear();
    await pool.query('TRUNCATE sync_runs, sync_state, oauth_tokens');
    await pool.query('INSERT INTO sync_state(id) VALUES (1)');
    await pool.query("INSERT INTO oauth_tokens(provider,refresh_token_enc) VALUES ('google','fixture-only')");
  });
  afterAll(async () => { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); });

  it('does seven-day reconciliation once, then refreshes two days after 15 minutes', async () => {
    const first = await sync.run({ trigger: 'app-open' }, task);
    expect(first.range).toEqual({ startDate: addDays(today, -6), endDate: addDays(today, 1) });
    expect(first.status).toBe('success');
    expect((await sync.run({ trigger: 'app-open' }, task)).status).toBe('fresh');
    await pool.query("UPDATE sync_state SET last_success_at=now()-interval '16 minutes', last_attempt_at=now()-interval '16 minutes'");
    const next = await sync.run({ trigger: 'app-open' }, task);
    expect(next.range.startDate).toBe(addDays(today, -1));
    expect(task).toHaveBeenCalledTimes(2);
  });
  it('hourly trigger waits a full hour and skips disconnected accounts', async () => {
    await sync.run({ trigger: 'hourly' }, task);
    await pool.query("UPDATE sync_state SET last_success_at=now()-interval '59 minutes', last_attempt_at=now()-interval '59 minutes'");
    expect((await sync.run({ trigger: 'hourly' }, task)).status).toBe('fresh');
    await pool.query("UPDATE sync_state SET last_success_at=now()-interval '61 minutes', last_attempt_at=now()-interval '61 minutes'");
    expect((await sync.run({ trigger: 'hourly' }, task)).status).toBe('success');
    await pool.query('DELETE FROM oauth_tokens');
    expect((await sync.run({ trigger: 'app-open' }, task)).status).toBe('disconnected');
  });
  it('partial runs do not advance freshness and impose automatic cooldown', async () => {
    await sync.run({}, async (range, batchId) => ({ range, batchId, perType: [{ dataType: 'sleep', ok: false, httpStatus: 429, items: 0, pages: 1, upserted: 0 }] }));
    expect((await pool.query('SELECT last_success_at FROM sync_state')).rows[0].last_success_at).toBeNull();
    expect((await sync.run({ trigger: 'app-open' }, task)).status).toBe('cooldown');
    expect(task).not.toHaveBeenCalled();
    // Manual action can retry; the distributed lock still applies.
    expect((await sync.run({}, task)).status).toBe('success');
  });
  it('does not execute another task while a separate connection holds the lock', async () => {
    const owner = await pool.connect();
    try {
      await owner.query('SELECT pg_advisory_lock(2200,1)');
      expect((await sync.run({}, task)).status).toBe('busy');
      expect(task).not.toHaveBeenCalled();
    } finally { await owner.query('SELECT pg_advisory_unlock(2200,1)'); owner.release(); }
    expect((await sync.run({}, task)).status).toBe('success');
  });
  it('releases the lock after errors and records interrupted runs', async () => {
    await expect(sync.run({}, async () => { throw new Error('upstream failure'); })).rejects.toThrow('upstream failure');
    expect((await pool.query('SELECT status FROM sync_runs')).rows[0].status).toBe('failed');
    await pool.query("UPDATE sync_runs SET status='running'");
    await sync.run({}, task);
    expect((await pool.query("SELECT count(*)::int AS n FROM sync_runs WHERE status='interrupted'")).rows[0].n).toBe(1);
  });
  it('historical fetch does not mark current data fresh', async () => {
    await sync.run({ startDate: '2025-01-01', endDate: '2025-01-08' }, task);
    expect((await pool.query('SELECT last_success_at FROM sync_state')).rows[0].last_success_at).toBeNull();
  });
  it('only records maintenance completion if cleanup succeeds', async () => {
    await sync.run({}, task, async () => false);
    expect((await pool.query('SELECT last_maintenance_at FROM sync_state')).rows[0].last_maintenance_at).toBeNull();
    await sync.run({}, task, async () => true);
    expect((await pool.query('SELECT last_maintenance_at FROM sync_state')).rows[0].last_maintenance_at).not.toBeNull();
  });
});
