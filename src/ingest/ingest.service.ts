import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { config } from '../config';
import { PG_POOL } from '../db/db.module';
import { FetchResult, HealthApiClient } from '../google/health-api.client';
import { buildFilter, DATA_TYPES, DataTypeSpec } from './metrics';
import { normalizeDaily, normalizeRollup, normalizeSleep, NormalizedMetric, NORMALIZER_VERSION } from './normalize';
import { addDays, startOfCivilDay, todayCivil } from './time';

export interface RefreshSummary {
  batchId: string;
  range: { startDate: string; endDate: string };   // [start, end) civil dates
  perType: { dataType: string; ok: boolean; httpStatus: number; items: number; pages: number; upserted: number; error?: string }[];
}

@Injectable()
export class IngestService {
  private readonly log = new Logger(IngestService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool, private readonly api: HealthApiClient) {}

  /**
   * Fetch every registered data type for the civil-date window [startDate, endDate), store raw pages,
   * normalize and upsert daily metrics. Idempotent: re-running for the same window updates rows in place.
   * Default window: the last `days` days ending today (inclusive), plus one extra day of lead for sleep
   * sessions that started the evening before the window.
   */
  async refresh(opts: { startDate?: string; endDate?: string; days?: number } = {}): Promise<RefreshSummary> {
    const tz = config.USER_TIMEZONE;
    const today = todayCivil(tz);
    const endDate = opts.endDate ?? addDays(today, 1);
    const startDate = opts.startDate ?? addDays(endDate, -(opts.days ?? 7));
    const batchId = randomUUID();
    const summary: RefreshSummary = { batchId, range: { startDate, endDate }, perType: [] };

    for (const spec of DATA_TYPES) {
      try {
        const r = await this.fetchOne(spec, startDate, endDate, tz);
        const ids = await this.storeRaw(batchId, spec, r, startDate, endDate, tz);
        let upserted = 0;
        if (r.ok) {
          const rows = this.normalize(spec, r.items, tz);
          upserted = await this.upsertMetrics(rows, ids);
        }
        const last = r.pages[r.pages.length - 1];
        summary.perType.push({ dataType: spec.dataType, ok: r.ok, httpStatus: last?.status ?? 0, items: r.items.length, pages: r.pages.length, upserted, error: last?.errorText });
      } catch (e) {
        const msg = (e as Error).message;
        this.log.error(`${spec.dataType}: ${msg}`);
        summary.perType.push({ dataType: spec.dataType, ok: false, httpStatus: 0, items: 0, pages: 0, upserted: 0, error: msg });
        if (/not connected|Token refresh failed/i.test(msg)) break; // no point continuing without auth
      }
    }
    return summary;
  }

  private fetchOne(spec: DataTypeSpec, startDate: string, endDate: string, tz: string): Promise<FetchResult> {
    if (spec.kind === 'interval') return this.api.dailyRollUp(spec.dataType, startDate, endDate);
    // Sleep: extend the physical window back by 1 day so a session that started the evening before
    // `startDate` (and ended inside the window) is included.
    const physStart = spec.kind === 'session' ? addDays(startDate, -1) : startDate;
    const startIso = startOfCivilDay(physStart, tz).toISOString();
    const endIso = startOfCivilDay(endDate, tz).toISOString();
    const filter = buildFilter(spec, startIso, endIso, startDate, endDate);
    const pageSize = spec.kind === 'session' ? 25 : undefined;
    return this.api.read(spec.dataType, spec.method, filter, { pageSize });
  }

  private normalize(spec: DataTypeSpec, items: unknown[], tz: string): NormalizedMetric[] {
    switch (spec.kind) {
      case 'session': return normalizeSleep(items, tz);
      case 'daily': return normalizeDaily(spec.dataType, items);
      case 'interval': return normalizeRollup(spec.dataType, items);
      default: return [];
    }
  }

  private async storeRaw(batchId: string, spec: DataTypeSpec, r: FetchResult, startDate: string, endDate: string, tz: string): Promise<number[]> {
    const ids: number[] = [];
    for (const p of r.pages) {
      const { rows } = await this.pool.query<{ id: string }>(
        `INSERT INTO api_responses (provider, data_type, method, request_url, request_body, range_start, range_end, http_status, duration_ms, page_index, payload, error_text, batch_id)
         VALUES ('google-health', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [
          spec.dataType,
          spec.kind === 'interval' ? 'dailyRollUp' : spec.method,
          p.url,
          p.requestBody ? JSON.stringify(p.requestBody) : null,
          startOfCivilDay(startDate, tz),
          startOfCivilDay(endDate, tz),
          p.status,
          p.durationMs,
          p.pageIndex,
          p.body === undefined ? null : JSON.stringify(p.body),
          p.errorText ?? null,
          batchId,
        ],
      );
      ids.push(Number(rows[0].id));
    }
    return ids;
  }

  private async upsertMetrics(rows: NormalizedMetric[], sourceIds: number[]): Promise<number> {
    if (!rows.length) return 0;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const r of rows) {
        await client.query(
          `INSERT INTO daily_metrics (day, metric, value, unit, status, status_reason, source_response_ids, source_point_name, measured_start, measured_end, details, normalizer_version, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
           ON CONFLICT (day, metric) DO UPDATE SET
             value = EXCLUDED.value, unit = EXCLUDED.unit, status = EXCLUDED.status, status_reason = EXCLUDED.status_reason,
             source_response_ids = EXCLUDED.source_response_ids, source_point_name = EXCLUDED.source_point_name,
             measured_start = EXCLUDED.measured_start, measured_end = EXCLUDED.measured_end,
             details = EXCLUDED.details, normalizer_version = EXCLUDED.normalizer_version, updated_at = now()`,
          [r.day, r.metric, r.value, r.unit, r.status, r.statusReason ?? null, sourceIds, r.sourcePointName ?? null,
           r.measuredStart ?? null, r.measuredEnd ?? null, r.details ? JSON.stringify(r.details) : null, NORMALIZER_VERSION],
        );
      }
      await client.query('COMMIT');
      return rows.length;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // ---------- read side ----------

  async getDay(day: string) {
    const { rows } = await this.pool.query(
      `SELECT metric, value, unit, status, status_reason, measured_start, measured_end, source_response_ids, source_point_name, details, updated_at
       FROM daily_metrics WHERE day = $1 ORDER BY metric`,
      [day],
    );
    const present = new Set(rows.map((r) => r.metric));
    const expected = DATA_TYPES.flatMap((d) => d.produces);
    return {
      day,
      metrics: rows,
      missing: expected.filter((m) => !present.has(m) || rows.find((r) => r.metric === m)?.status === 'missing'),
    };
  }

  async getRange(startDate: string, endDate: string) {
    const { rows } = await this.pool.query(
      `SELECT day, metric, value, unit, status FROM daily_metrics WHERE day >= $1 AND day < $2 ORDER BY day, metric`,
      [startDate, endDate],
    );
    return rows;
  }

  async listRaw(limit = 50) {
    const { rows } = await this.pool.query(
      `SELECT id, fetched_at, data_type, method, http_status, page_index, duration_ms, batch_id, range_start, range_end,
              jsonb_array_length(COALESCE(payload->'dataPoints', payload->'rollupDataPoints', '[]'::jsonb)) AS item_count, error_text
       FROM api_responses ORDER BY id DESC LIMIT $1`,
      [limit],
    );
    return rows;
  }

  async getRaw(id: number) {
    const { rows } = await this.pool.query(`SELECT * FROM api_responses WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }
}
