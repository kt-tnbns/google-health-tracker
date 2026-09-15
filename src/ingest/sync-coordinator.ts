import { randomUUID } from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import { addDays, todayCivil } from './time';

export type SyncTrigger = 'manual' | 'app-open' | 'hourly';
export interface SyncOptions { startDate?: string; endDate?: string; days?: number; trigger?: SyncTrigger }
export interface SyncResult {
  batchId: string;
  range: { startDate: string; endDate: string };
  perType: { dataType: string; ok: boolean; httpStatus: number; items: number; pages: number; upserted: number; error?: string }[];
  status?: 'success' | 'partial' | 'busy' | 'fresh' | 'cooldown' | 'disconnected';
}

export class SyncCoordinator {
  constructor(private readonly pool: Pool, private readonly timezone: string) {}

  async run(options: SyncOptions, task: (range: { startDate: string; endDate: string }, batchId: string) => Promise<SyncResult>, maintenance?: (client: PoolClient) => Promise<boolean>): Promise<SyncResult> {
    const client = await this.pool.connect();
    let locked = false;
    let runId: string | undefined;
    const trigger = options.trigger ?? 'manual';
    const today = todayCivil(this.timezone);
    let range = { startDate: options.startDate ?? addDays(today, 1 - (options.days ?? 2)), endDate: options.endDate ?? addDays(today, 1) };
    const skipped = (status: SyncResult['status']): SyncResult => ({ batchId: '', range, perType: [], status });
    try {
      const lock = await client.query('SELECT pg_try_advisory_lock(2200, 1) AS locked');
      locked = lock.rows[0].locked;
      if (!locked) return skipped('busy');
      const { rows: [state] } = await client.query('SELECT *, last_reconciled_day::text AS last_reconciled_day, now() AS server_now FROM sync_state WHERE id = 1');
      const now = new Date(state.server_now).getTime();
      if (trigger !== 'manual') {
        const { rows } = await client.query("SELECT 1 FROM oauth_tokens WHERE provider = 'google'");
        if (!rows.length) return skipped('disconnected');
        const age = state.last_success_at ? now - new Date(state.last_success_at).getTime() : Infinity;
        const reconcile = state.last_reconciled_day !== today;
        if (age < (trigger === 'hourly' ? 60 : 15) * 60_000 && !reconcile) return skipped('fresh');
        if (state.last_attempt_at && now - new Date(state.last_attempt_at).getTime() < (trigger === 'hourly' ? 60 : 15) * 60_000) return skipped('cooldown');
        range = { startDate: addDays(today, reconcile ? -6 : -1), endDate: addDays(today, 1) };
      }
      // A lock can only be acquired after the previous owner released it or disconnected.
      await client.query("UPDATE sync_runs SET status = 'interrupted', finished_at = now() WHERE status = 'running'");
      runId = randomUUID();
      await client.query('UPDATE sync_state SET last_attempt_at = now() WHERE id = 1');
      await client.query("INSERT INTO sync_runs(id, trigger, status, range_start, range_end) VALUES ($1, $2, 'running', $3, $4)", [runId, trigger, range.startDate, range.endDate]);
      const result = await task(range, runId);
      const success = result.perType.length > 0 && result.perType.every(type => type.ok);
      result.status = success ? 'success' : 'partial';
      await client.query('UPDATE sync_runs SET status = $2, finished_at = now(), summary = $3 WHERE id = $1', [runId, result.status, JSON.stringify(result.perType)]);
      if (success && range.startDate <= addDays(today, -1) && range.endDate >= addDays(today, 1)) {
        await client.query('UPDATE sync_state SET last_success_at = now(), last_reconciled_day = CASE WHEN $1 THEN $2::date ELSE last_reconciled_day END WHERE id = 1', [range.startDate <= addDays(today, -6), today]);
      }
      if (maintenance && (!state.last_maintenance_at || now - new Date(state.last_maintenance_at).getTime() >= 24 * 60 * 60_000)) {
        if (await maintenance(client)) await client.query('UPDATE sync_state SET last_maintenance_at = now() WHERE id = 1');
      }
      return result;
    } catch (error) {
      if (runId) await client.query("UPDATE sync_runs SET status = 'failed', finished_at = now(), error = $2 WHERE id = $1", [runId, String((error as Error).message).slice(0, 500)]).catch(() => undefined);
      throw error;
    } finally {
      let broken = false;
      if (locked) {
        try { await client.query('SELECT pg_advisory_unlock(2200, 1)'); }
        catch { broken = true; }
      }
      client.release(broken);
    }
  }
}
