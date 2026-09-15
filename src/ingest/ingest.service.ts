import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { healthOverview } from '../scores/health';
import { config } from '../config';
import { PG_POOL } from '../db/db.module';
import { FetchResult, HealthApiClient } from '../google/health-api.client';
import { buildFilter, DATA_TYPES, DataTypeSpec } from './metrics';
import { ExerciseSession, normalizeDaily, normalizeExercise, normalizeRollup, normalizeSleep, NormalizedMetric, NORMALIZER_VERSION, repairLoadRow } from './normalize';
import { addDays, startOfCivilDay, todayCivil } from './time';
import { RawStore } from './raw-store';
import { SyncCoordinator, SyncOptions, SyncResult } from './sync-coordinator';

export interface RefreshSummary {
  batchId: string;
  range: { startDate: string; endDate: string };   // [start, end) civil dates
  perType: { dataType: string; ok: boolean; httpStatus: number; items: number; pages: number; upserted: number; error?: string }[];
  status?: SyncResult['status'];
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
  async refresh(opts: SyncOptions = {}): Promise<RefreshSummary> {
    const raw = new RawStore(this.pool);
    return new SyncCoordinator(this.pool, config.USER_TIMEZONE).run(opts,
      (range, batchId) => this.performRefresh(range, batchId), async client => {
        try {
          await raw.prune(config.RAW_RETENTION_DAYS, client);
          await client.query(`INSERT INTO storage_observations(day, database_bytes, raw_bytes)
            VALUES ($1, pg_database_size(current_database()), pg_total_relation_size('api_responses'))
            ON CONFLICT(day) DO UPDATE SET observed_at = now(), database_bytes = EXCLUDED.database_bytes, raw_bytes = EXCLUDED.raw_bytes`, [todayCivil(config.USER_TIMEZONE)]);
          await client.query("DELETE FROM sync_runs WHERE started_at < now() - interval '30 days' AND status <> 'running'");
          await client.query("DELETE FROM storage_observations WHERE day < current_date - 1095");
          return true;
        } catch (error) { this.log.warn(`Sync maintenance failed: ${(error as Error).message}`); return false; }
      });
  }

  async syncStatus() {
    const { rows: [state] } = await this.pool.query('SELECT * FROM sync_state WHERE id = 1');
    const { rows: [latest] } = await this.pool.query('SELECT id, trigger, started_at, finished_at, status, range_start, range_end FROM sync_runs ORDER BY started_at DESC LIMIT 1');
    const { rows: [lock] } = await this.pool.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND classid=2200 AND objid=1 AND objsubid=2 AND granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())) AS running");
    return { ...state, running: lock.running, latest: latest ?? null, autoSyncEnabled: config.AUTO_SYNC_ENABLED };
  }

  async storageStatus() {
    const { rows } = await this.pool.query('SELECT * FROM storage_observations ORDER BY day DESC LIMIT 31');
    return { ...await new RawStore(this.pool).storageStats(), observations: rows, rawRetentionDays: config.RAW_RETENTION_DAYS };
  }

  private async performRefresh(opts: { startDate: string; endDate: string }, batchId: string): Promise<RefreshSummary> {
    const tz = config.USER_TIMEZONE;
    const today = todayCivil(tz);
    const endDate = opts.endDate ?? addDays(today, 1);
    const startDate = opts.startDate;
    const summary: RefreshSummary = { batchId, range: { startDate, endDate }, perType: [] };

    for (const spec of DATA_TYPES) {
      if (spec.derived) continue;   // handled after the main pass (needs sleep intervals)
      try {
        const r = await this.fetchOne(spec, startDate, endDate, tz);
        const ids = await this.storeRaw(batchId, spec, r, startDate, endDate, tz);
        let upserted = 0;
        if (r.ok) {
          const rows = this.normalize(spec, r.items, tz);
          upserted = await this.upsertMetrics(rows, ids);
          if (spec.dataType === 'exercise') upserted += await this.upsertExerciseSessions(normalizeExercise(r.items, tz).sessions, ids);
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
    if (summary.perType.some((t) => t.ok)) {
      try {
        summary.perType.push(await this.refreshSleepingHr(batchId, startDate, endDate, tz));
      } catch (e) {
        this.log.error(`sleeping-hr: ${(e as Error).message}`);
        summary.perType.push({ dataType: 'heart-rate', ok: false, httpStatus: 0, items: 0, pages: 0, upserted: 0, error: (e as Error).message });
      }
    }
    return summary;
  }

  /**
   * Sleeping heart rate = mean of heart-rate samples inside each night's main-sleep interval, with minute coverage.
   * One request per night; nights that already have ≥85% coverage and ended more than 2 days ago are not refetched.
   */
  private async refreshSleepingHr(batchId: string, startDate: string, endDate: string, tz: string) {
    const spec = DATA_TYPES.find((d) => d.derived === 'sleeping-hr')!;
    const { rows: nights } = await this.pool.query<{ day: string; measured_start: string; measured_end: string; details: any }>(
      `SELECT s.day, s.measured_start, s.measured_end, h.details
       FROM daily_metrics s LEFT JOIN daily_metrics h ON h.day = s.day AND h.metric = 'sleeping_hr_bpm'
       WHERE s.metric = 'sleep_minutes_asleep' AND s.day >= $1 AND s.day < $2 AND s.measured_start IS NOT NULL AND s.measured_end IS NOT NULL
       ORDER BY s.day DESC LIMIT 14`, [startDate, endDate]);
    const recentCutoff = Date.now() - 2 * 86_400_000;
    let items = 0, pages = 0, upserted = 0, ok = true, lastStatus = 200, lastError: string | undefined;
    for (const n of nights) {
      if (n.details?.coveragePct >= 85 && Date.parse(n.measured_end) < recentCutoff) continue;
      const startIso = new Date(n.measured_start).toISOString(), endIso = new Date(n.measured_end).toISOString();
      const filter = `${spec.filterField} >= "${startIso}" AND ${spec.filterField} < "${endIso}"`;
      const r = await this.api.read(spec.dataType, 'list', filter, { pageSize: 5000, maxPages: 3 });
      const ids = await this.storeRaw(batchId, spec, r, n.day, n.day, tz);
      pages += r.pages.length; items += r.items.length; lastStatus = r.pages[r.pages.length - 1]?.status ?? 0;
      if (!r.ok) { ok = false; lastError = r.pages[r.pages.length - 1]?.errorText; if (/40[13]/.test(String(lastStatus))) break; continue; }
      const samples = (r.items as any[]).map((x) => ({ t: Date.parse(x.heartRate?.sampleTime?.physicalTime), bpm: Number(x.heartRate?.beatsPerMinute ?? x.heartRate?.bpm) })).filter((x) => Number.isFinite(x.t) && Number.isFinite(x.bpm) && x.bpm > 0);
      const intervalMin = Math.max(1, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60_000));
      const minutes = new Set(samples.map((x) => Math.floor(x.t / 60_000))).size;
      const coveragePct = Math.round((minutes / intervalMin) * 1000) / 10;
      const mean = samples.length ? Math.round(samples.reduce((a, x) => a + x.bpm, 0) / samples.length) : null;
      const status = mean === null ? 'missing' : coveragePct >= 50 ? 'ok' : 'partial';
      upserted += await this.upsertMetrics([{
        day: n.day, metric: 'sleeping_hr_bpm', value: mean, unit: 'bpm', status,
        statusReason: mean === null ? 'no heart-rate samples inside the sleep interval' : coveragePct < 50 ? `only ${coveragePct}% of sleep minutes have a sample` : undefined,
        measuredStart: startIso, measuredEnd: endIso, details: { samples: samples.length, minutesCovered: minutes, intervalMin, coveragePct, formula: 'mean(bpm) of samples within main-sleep interval' },
      }], ids);
    }
    return { dataType: spec.dataType, ok, httpStatus: lastStatus, items, pages, upserted, error: lastError };
  }

  private fetchOne(spec: DataTypeSpec, startDate: string, endDate: string, tz: string): Promise<FetchResult> {
    if (spec.method === 'dailyRollUp') return this.api.dailyRollUp(spec.dataType, startDate, endDate);
    const startIso = startOfCivilDay(startDate, tz).toISOString();
    const endIso = startOfCivilDay(endDate, tz).toISOString();
    const filter = buildFilter(spec, startIso, endIso, startDate, endDate);
    const pageSize = spec.kind === 'session' ? 25 : undefined;   // API max for sleep/exercise
    return this.api.read(spec.dataType, spec.method, filter, { pageSize, maxPages: 20 });
  }

  private normalize(spec: DataTypeSpec, items: unknown[], tz: string): NormalizedMetric[] {
    if (spec.dataType === 'sleep') return normalizeSleep(items, tz);
    if (spec.dataType === 'exercise') return normalizeExercise(items, tz).daily;
    if (spec.method === 'dailyRollUp') return normalizeRollup(spec.dataType, items);
    if (spec.kind === 'daily') return normalizeDaily(spec.dataType, items);
    return [];
  }

  private async upsertExerciseSessions(sessions: ExerciseSession[], sourceIds: number[]): Promise<number> {
    for (const s of sessions) {
      await this.pool.query(
        `INSERT INTO exercise_sessions (point_name, day, exercise_type, display_name, started_at, ended_at, active_min, avg_hr, calories_kcal, distance_m, steps, azm, zone_light_min, zone_moderate_min, zone_vigorous_min, zone_peak_min, source_response_ids, raw, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, now())
         ON CONFLICT (started_at, exercise_type) DO UPDATE SET point_name = EXCLUDED.point_name, day = EXCLUDED.day, display_name = EXCLUDED.display_name, ended_at = EXCLUDED.ended_at,
           active_min = EXCLUDED.active_min, avg_hr = EXCLUDED.avg_hr, calories_kcal = EXCLUDED.calories_kcal, distance_m = EXCLUDED.distance_m, steps = EXCLUDED.steps, azm = EXCLUDED.azm,
           zone_light_min = EXCLUDED.zone_light_min, zone_moderate_min = EXCLUDED.zone_moderate_min, zone_vigorous_min = EXCLUDED.zone_vigorous_min, zone_peak_min = EXCLUDED.zone_peak_min,
           source_response_ids = EXCLUDED.source_response_ids, raw = EXCLUDED.raw, updated_at = now()`,
        [s.pointName ?? null, s.day, s.type, s.displayName ?? null, s.start, s.end, s.activeMin, s.avgHr, s.calories, s.distanceM, s.steps, s.azm,
         s.zoneMin.light, s.zoneMin.moderate, s.zoneMin.vigorous, s.zoneMin.peak, sourceIds, JSON.stringify(s.raw)],
      );
    }
    return sessions.length;
  }

  private async storeRaw(batchId: string, spec: DataTypeSpec, r: FetchResult, startDate: string, endDate: string, tz: string): Promise<number[]> {
    return new RawStore(this.pool).store(batchId, spec, r, startDate, endDate, tz);
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
    const repaired = rows.map(repairLoadRow);
    const present = new Set(repaired.map((r) => r.metric));
    const expected = DATA_TYPES.flatMap((d) => d.produces);
    return {
      day,
      metrics: repaired,
      missing: expected.filter((m) => !present.has(m) || repaired.find((r) => r.metric === m)?.status === 'missing'),
    };
  }

  async getRange(startDate: string, endDate: string) {
    const { rows } = await this.pool.query(
      `SELECT day, metric, value, unit, status, measured_start, measured_end, details FROM daily_metrics WHERE day >= $1 AND day < $2 ORDER BY day, metric`,
      [startDate, endDate],
    );
    return rows.map(repairLoadRow);
  }

  async health(days = 60) {
    const today = todayCivil(config.USER_TIMEZONE);
    const [rows, upstream] = await Promise.all([
      this.getRange(addDays(today, -days), addDays(today, 1)),
      this.pool.query(`SELECT DISTINCT ON (data_type) data_type, fetched_at, http_status
        FROM api_responses ORDER BY data_type, fetched_at DESC, id DESC`),
    ]);
    return { ...healthOverview(rows, today, days), timezone: config.USER_TIMEZONE, upstream: upstream.rows };
  }

  async getExerciseSessions(startDate: string, endDate: string) {
    const { rows } = await this.pool.query(
      `SELECT id, day, exercise_type, display_name, started_at, ended_at, active_min, avg_hr, calories_kcal, distance_m, steps, azm, zone_light_min, zone_moderate_min, zone_vigorous_min, zone_peak_min
       FROM exercise_sessions WHERE day >= $1 AND day < $2 ORDER BY started_at`, [startDate, endDate]);
    return rows;
  }

  async listRaw(limit = 50) {
    const { rows } = await this.pool.query(
      `SELECT id, fetched_at, data_type, method, http_status, page_index, duration_ms, batch_id, range_start, range_end,
              jsonb_array_length(COALESCE(payload->'dataPoints', payload->'rollupDataPoints', '[]'::jsonb)) AS item_count, error_text
       FROM api_responses ORDER BY fetched_at DESC, id DESC LIMIT $1`,
      [limit],
    );
    return rows;
  }

  async getRaw(id: number) {
    const { rows } = await this.pool.query(`SELECT * FROM api_responses WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }
}
