import { createHash } from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import { FetchResult } from '../google/health-api.client';
import { startOfCivilDay } from './time';

/** Canonical JSON: object key order is irrelevant; array order is significant. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export class RawStore {
  constructor(private readonly pool: Pool) {}

  /** Call within the refresh lock, retaining it through normalized-row upserts. */
  async store(batchId: string, spec: { dataType: string; method: string }, result: FetchResult,
    startDate: string, endDate: string, tz: string): Promise<number[]> {
    const ids: number[] = [];
    const start = startOfCivilDay(startDate, tz);
    const end = startOfCivilDay(endDate, tz);
    for (const p of result.pages) {
      // Failed/partial fetches retain individual diagnostic records.
      const hash = result.ok && p.status >= 200 && p.status < 300 && !p.errorText
        ? createHash('sha256').update(stableJson(['google-health', spec.dataType, spec.method, start.toISOString(), end.toISOString(), p.pageIndex, p.body])).digest('hex')
        : null;
      const { rows } = await this.pool.query<{ id: string }>(
        `INSERT INTO api_responses (provider, data_type, method, request_url, request_body,
           range_start, range_end, http_status, duration_ms, page_index, payload, error_text, batch_id,
           payload_hash, first_seen_at)
         VALUES ('google-health', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, clock_timestamp())
         ON CONFLICT (payload_hash) WHERE payload_hash IS NOT NULL DO UPDATE SET
           fetched_at = clock_timestamp(), request_url = EXCLUDED.request_url,
           request_body = EXCLUDED.request_body, http_status = EXCLUDED.http_status,
           duration_ms = EXCLUDED.duration_ms, error_text = EXCLUDED.error_text,
           batch_id = EXCLUDED.batch_id, seen_count = api_responses.seen_count + 1
         RETURNING id`,
        [spec.dataType, spec.method, p.url, p.requestBody === undefined ? null : JSON.stringify(p.requestBody),
          start, end, p.status, p.durationMs, p.pageIndex, p.body === undefined ? null : JSON.stringify(p.body),
          p.errorText ?? null, batchId, hash],
      );
      ids.push(Number(rows[0].id));
    }
    return ids;
  }

  /**
   * Uses the same session lock as refresh, protecting the store -> upsert gap.
   * Inside refresh, pass its lock-owning client (session locks are reentrant).
   * Standalone cleanup skips when a refresh owns the lock. Every raw writer
   * that can attach provenance must hold (2200, 1) through its metric upsert.
   */
  async prune(retentionDays = 30, lockClient?: PoolClient): Promise<{ deleted: number }> {
    if (!Number.isFinite(retentionDays) || retentionDays < 30) {
      throw new Error('Raw retention must be at least 30 days');
    }
    const client = lockClient ?? await this.pool.connect();
    let locked = false;
    try {
      const lock = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock(2200, 1) AS locked');
      locked = lock.rows[0].locked;
      if (!locked) return { deleted: 0 };
      const result = await client.query(
        `DELETE FROM api_responses AS r
         WHERE r.fetched_at < now() - ($1::double precision * interval '1 day')
           AND NOT EXISTS (SELECT 1 FROM daily_metrics m WHERE r.id = ANY(m.source_response_ids))
           AND NOT EXISTS (SELECT 1 FROM exercise_sessions e WHERE r.id = ANY(e.source_response_ids))
           AND r.id NOT IN (
             SELECT DISTINCT ON (data_type) id FROM api_responses
             ORDER BY data_type, fetched_at DESC, id DESC
           )`, [retentionDays],
      );
      return { deleted: result.rowCount ?? 0 };
    } finally {
      try {
        if (locked) await client.query('SELECT pg_advisory_unlock(2200, 1)');
      } finally {
        if (!lockClient) client.release();
      }
    }
  }

  async storageStats(): Promise<{ databaseBytes: number; rawBytes: number; metricsBytes: number; exerciseBytes: number }> {
    const { rows } = await this.pool.query(`SELECT pg_database_size(current_database()) AS database_bytes,
      pg_total_relation_size('api_responses') AS raw_bytes,
      pg_total_relation_size('daily_metrics') AS metrics_bytes,
      pg_total_relation_size('exercise_sessions') AS exercise_bytes`);
    const r = rows[0];
    return { databaseBytes: Number(r.database_bytes), rawBytes: Number(r.raw_bytes),
      metricsBytes: Number(r.metrics_bytes), exerciseBytes: Number(r.exercise_bytes) };
  }
}
