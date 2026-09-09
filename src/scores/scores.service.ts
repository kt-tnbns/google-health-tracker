import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { config } from '../config';
import { PG_POOL } from '../db/db.module';
import { HealthApiClient } from '../google/health-api.client';
import { addDays, startOfCivilDay, todayCivil } from '../ingest/time';
import { BloodPanel, FITNESSAGE_VERSION, fitnessAge, PHENOAGE_VERSION, phenoAge } from './bioage';
import { computeInsights, INSIGHTS_VERSION, TAGS } from './insights';
import { computeLoadSeries, LOAD_VERSION, LoadDayInput, LoadDayResult, trimp } from './load';
import { computeRecoverySeries, DayInput, RECOVERY_VERSION, RecoveryResult } from './recovery';
import { SetRow, weeklyStrength } from './strength';

type Grid = Record<string, Record<string, number | null>>;

@Injectable()
export class ScoresService {
  private readonly log = new Logger(ScoresService.name);
  constructor(@Inject(PG_POOL) private readonly pool: Pool, private readonly api: HealthApiClient) {}

  // ---------- shared loaders ----------

  private async grid(startDate: string, endDate: string): Promise<{ grid: Grid; days: string[] }> {
    const { rows } = await this.pool.query(`SELECT day, metric, value, status FROM daily_metrics WHERE day >= $1 AND day <= $2`, [startDate, endDate]);
    const grid: Grid = {};
    for (const r of rows) (grid[String(r.day).slice(0, 10)] ||= {})[r.metric] = r.status === 'missing' || r.value === null ? null : Number(r.value);
    const days: string[] = [];
    for (let d = startDate; d <= endDate; d = addDays(d, 1)) { days.push(d); grid[d] ||= {}; }
    return { grid, days };
  }

  async profile() {
    const { rows } = await this.pool.query(`SELECT birth_year, sex, height_cm, hr_max, updated_at FROM user_profile WHERE id = 1`);
    return rows[0] ?? null;
  }
  async saveProfile(p: { birth_year?: number | null; sex?: 'male' | 'female' | null; height_cm?: number | null; hr_max?: number | null }) {
    await this.pool.query(
      `INSERT INTO user_profile (id, birth_year, sex, height_cm, hr_max, updated_at) VALUES (1, $1, $2, $3, $4, now())
       ON CONFLICT (id) DO UPDATE SET birth_year = COALESCE($1, user_profile.birth_year), sex = COALESCE($2, user_profile.sex), height_cm = COALESCE($3, user_profile.height_cm), hr_max = COALESCE($4, user_profile.hr_max), updated_at = now()`,
      [p.birth_year ?? null, p.sex ?? null, p.height_cm ?? null, p.hr_max ?? null]);
    return this.profile();
  }

  // ---------- recovery + load ----------

  async daily(days = 90): Promise<{ recovery: RecoveryResult[]; load: LoadDayResult[]; versions: Record<string, string> }> {
    const today = todayCivil(config.USER_TIMEZONE);
    // extra 60 days of history so the first displayed day has a baseline
    const start = addDays(today, -(days + 60));
    const { grid, days: all } = await this.grid(start, today);
    const prof = await this.profile();
    const age = prof?.birth_year ? new Date().getFullYear() - prof.birth_year : null;
    const hrMax = prof?.hr_max ?? (age ? Math.round(211 - 0.64 * age) : null);   // HUNT formula fallback
    const sessions = await this.pool.query(`SELECT day, active_min, avg_hr FROM exercise_sessions WHERE day >= $1 AND day <= $2`, [start, today]);
    const trimpByDay = new Map<string, number>();
    for (const s of sessions.rows) {
      const d = String(s.day).slice(0, 10);
      const rhr = grid[d]?.rhr_bpm ?? null;
      const t = s.avg_hr && rhr && hrMax ? trimp(Number(s.active_min), Number(s.avg_hr), rhr, hrMax, prof?.sex ?? null) : null;
      if (t !== null) trimpByDay.set(d, (trimpByDay.get(d) ?? 0) + t);
    }
    const recIn: DayInput[] = all.map((d) => ({ day: d, hrv: grid[d].hrv_avg_ms ?? null, rhr: grid[d].rhr_bpm ?? null, asleep: grid[d].sleep_minutes_asleep ?? null, efficiency: grid[d].sleep_efficiency_pct ?? null, rr: grid[d].respiratory_rate_bpm ?? null, spo2: grid[d].spo2_avg_pct ?? null }));
    const loadIn: LoadDayInput[] = all.map((d) => ({
      day: d, hrzModerate: grid[d].hrz_moderate_min ?? null, hrzVigorous: grid[d].hrz_vigorous_min ?? null, hrzPeak: grid[d].hrz_peak_min ?? null,
      azmFatBurn: grid[d].azm_fat_burn_min ?? null, azmCardio: grid[d].azm_cardio_min ?? null, azmPeak: grid[d].azm_peak_min ?? null, azmTotal: grid[d].active_zone_minutes ?? null,
      trimp: trimpByDay.get(d) ?? null, steps: grid[d].steps ?? null,
    }));
    const recovery = computeRecoverySeries(recIn).slice(-days);
    const load = computeLoadSeries(loadIn).slice(-days);
    return { recovery, load, versions: { recovery: RECOVERY_VERSION, load: LOAD_VERSION } };
  }

  /** Persist today's results into computed_results (idempotent per day+version). */
  async persistToday() {
    const { recovery, load } = await this.daily(1);
    const r = recovery[recovery.length - 1], l = load[load.length - 1];
    for (const [ver, result] of [[RECOVERY_VERSION, r], [LOAD_VERSION, l]] as const) {
      await this.pool.query(
        `INSERT INTO computed_results (day, algorithm_version, input_days, result) VALUES ($1, $2, $3, $4)
         ON CONFLICT (day, algorithm_version) DO UPDATE SET result = EXCLUDED.result, computed_at = now(), input_days = EXCLUDED.input_days`,
        [r.day, ver, [r.day], JSON.stringify(result)]);
    }
    return { recovery: r, load: l };
  }

  // ---------- journal & insights ----------

  tags() { return TAGS; }
  async journal(startDate: string, endDate: string) {
    const { rows } = await this.pool.query(`SELECT day, tags, note, updated_at FROM journal_entries WHERE day >= $1 AND day <= $2 ORDER BY day`, [startDate, endDate]);
    return rows;
  }
  async saveJournal(day: string, tags: string[], note: string | null) {
    const clean = tags.filter((t) => (TAGS as readonly string[]).includes(t));
    await this.pool.query(
      `INSERT INTO journal_entries (day, tags, note, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (day) DO UPDATE SET tags = EXCLUDED.tags, note = EXCLUDED.note, updated_at = now()`, [day, clean, note]);
    return { day, tags: clean, note };
  }
  async insights(windowDays = 90) {
    const today = todayCivil(config.USER_TIMEZONE);
    const start = addDays(today, -windowDays);
    const { grid, days } = await this.grid(start, today);
    const j = await this.journal(start, today);
    const tags: Record<string, string[]> = {};
    for (const r of j) tags[String(r.day).slice(0, 10)] = r.tags;
    const all = computeInsights({ metrics: grid, tags, days: days.slice(0, -1) });
    return { version: INSIGHTS_VERSION, window: { start, end: today }, taggedDays: j.length, insights: all };
  }

  // ---------- strength ----------

  async strengthSessions(startDate: string, endDate: string) {
    const s = await this.pool.query(`SELECT * FROM strength_sessions WHERE day >= $1 AND day <= $2 ORDER BY day DESC, id DESC`, [startDate, endDate]);
    const ids = s.rows.map((r) => r.id);
    const sets = ids.length ? (await this.pool.query(`SELECT * FROM strength_sets WHERE session_id = ANY($1) ORDER BY session_id, set_no`, [ids])).rows : [];
    return s.rows.map((r) => ({ ...r, sets: sets.filter((x) => x.session_id === r.id) }));
  }
  async addStrengthSession(input: { day: string; duration_min?: number | null; notes?: string | null; sets: { exercise: string; muscle_group?: string | null; reps: number; load_kg: number; rpe?: number | null; rir?: number | null; is_warmup?: boolean }[] }) {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const { rows } = await c.query<{ id: string }>(`INSERT INTO strength_sessions (day, duration_min, notes) VALUES ($1, $2, $3) RETURNING id`, [input.day, input.duration_min ?? null, input.notes ?? null]);
      const id = Number(rows[0].id);
      let n = 0;
      for (const s of input.sets) {
        if (!s.exercise || !(s.reps > 0)) continue;
        await c.query(`INSERT INTO strength_sets (session_id, exercise, muscle_group, set_no, reps, load_kg, rpe, rir, is_warmup) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [id, s.exercise.trim().toLowerCase(), s.muscle_group ?? null, ++n, s.reps, s.load_kg ?? 0, s.rpe ?? null, s.rir ?? null, !!s.is_warmup]);
      }
      await c.query('COMMIT');
      return { id, sets: n };
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
  async deleteStrengthSession(id: number) { await this.pool.query(`DELETE FROM strength_sessions WHERE id = $1`, [id]); }
  async strengthWeekly(weeks = 12) {
    const today = todayCivil(config.USER_TIMEZONE);
    const { rows } = await this.pool.query<SetRow>(
      `SELECT s.session_id, ss.day::text AS day, s.exercise, s.muscle_group, s.reps, s.load_kg, s.rpe, s.rir, s.is_warmup
       FROM strength_sets s JOIN strength_sessions ss ON ss.id = s.session_id WHERE ss.day >= $1`, [addDays(today, -7 * weeks)]);
    return weeklyStrength(rows.map((r) => ({ ...r, session_id: Number(r.session_id), reps: Number(r.reps), load_kg: Number(r.load_kg), rpe: r.rpe === null ? null : Number(r.rpe), rir: r.rir === null ? null : Number(r.rir) })));
  }

  // ---------- fitness trends ----------

  async fitness(days = 180) {
    const today = todayCivil(config.USER_TIMEZONE);
    const start = addDays(today, -days);
    const { rows } = await this.pool.query(`SELECT day, value FROM daily_metrics WHERE metric = 'vo2max' AND status <> 'missing' AND day >= $1 ORDER BY day`, [start]);
    const vo2 = rows.map((r) => ({ day: String(r.day).slice(0, 10), value: Number(r.value) }));
    const prof = await this.profile();
    const latest = vo2[vo2.length - 1] ?? null;
    const fa = latest && prof?.sex ? fitnessAge(latest.value, prof.sex) : null;
    const sessions = await this.pool.query(
      `SELECT day, exercise_type, active_min, avg_hr, calories_kcal, distance_m, azm FROM exercise_sessions WHERE day >= $1 ORDER BY started_at`, [start]);
    return { vo2max: vo2, latestVo2max: latest, fitnessAge: fa, fitnessAgeVersion: FITNESSAGE_VERSION, needsProfile: !prof?.sex || !prof?.birth_year, sessions: sessions.rows };
  }

  // ---------- biological age ----------

  async bloodPanels() { return (await this.pool.query(`SELECT * FROM blood_panels ORDER BY drawn_on DESC`)).rows; }
  async addBloodPanel(p: BloodPanel & { drawn_on: string; notes?: string | null }) {
    const { rows } = await this.pool.query(
      `INSERT INTO blood_panels (drawn_on, albumin_g_l, creatinine_umol_l, glucose_mmol_l, crp_mg_dl, lymphocyte_pct, mcv_fl, rdw_pct, alp_u_l, wbc_k_ul, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [p.drawn_on, p.albumin_g_l, p.creatinine_umol_l, p.glucose_mmol_l, p.crp_mg_dl, p.lymphocyte_pct, p.mcv_fl, p.rdw_pct, p.alp_u_l, p.wbc_k_ul, p.notes ?? null]);
    return Number(rows[0].id);
  }
  async biologicalAge() {
    const prof = await this.profile();
    const panels = await this.bloodPanels();
    const results = panels.map((p) => {
      const ageAt = prof?.birth_year ? new Date(p.drawn_on).getFullYear() - prof.birth_year : null;
      const r = ageAt ? phenoAge({ albumin_g_l: +p.albumin_g_l, creatinine_umol_l: +p.creatinine_umol_l, glucose_mmol_l: +p.glucose_mmol_l, crp_mg_dl: +p.crp_mg_dl, lymphocyte_pct: +p.lymphocyte_pct, mcv_fl: +p.mcv_fl, rdw_pct: +p.rdw_pct, alp_u_l: +p.alp_u_l, wbc_k_ul: +p.wbc_k_ul }, ageAt) : null;
      return { panelId: p.id, drawnOn: String(p.drawn_on).slice(0, 10), chronologicalAge: ageAt, ...(r ?? { phenoAge: null, accel: null, mortality10y: null }) };
    });
    const fit = await this.fitness(180);
    return { phenoAgeVersion: PHENOAGE_VERSION, phenoAge: results, fitnessAge: fit.fitnessAge, fitnessAgeVersion: FITNESSAGE_VERSION, latestVo2max: fit.latestVo2max, needsProfile: !prof?.birth_year || !prof?.sex };
  }

  // ---------- energy bank feasibility probe ----------

  /** Fetch one day of heart-rate samples and measure minute coverage. Stores nothing but the raw response. */
  async energyProbe(day?: string) {
    const tz = config.USER_TIMEZONE;
    const d = day ?? addDays(todayCivil(tz), -1);
    const startIso = startOfCivilDay(d, tz).toISOString(), endIso = startOfCivilDay(addDays(d, 1), tz).toISOString();
    const filter = `heart_rate.sample_time.physical_time >= "${startIso}" AND heart_rate.sample_time.physical_time < "${endIso}"`;
    const r = await this.api.read('heart-rate', 'list', filter, { pageSize: 10000, maxPages: 3 });
    for (const p of r.pages) {
      await this.pool.query(
        `INSERT INTO api_responses (provider, data_type, method, request_url, range_start, range_end, http_status, duration_ms, page_index, payload, error_text, batch_id)
         VALUES ('google-health','heart-rate','list',$1,$2,$3,$4,$5,$6,$7,$8, gen_random_uuid())`,
        [p.url, startIso, endIso, p.status, p.durationMs, p.pageIndex, p.body === undefined ? null : JSON.stringify(p.body), p.errorText ?? null]);
    }
    if (!r.ok) return { day: d, ok: false, error: r.pages[r.pages.length - 1]?.errorText, samples: 0 };
    const times = (r.items as any[]).map((x) => Date.parse(x.heartRate?.sampleTime?.physicalTime)).filter(Number.isFinite).sort((a, b) => a - b);
    const minutes = new Set(times.map((t) => Math.floor(t / 60000)));
    const gaps = times.slice(1).map((t, i) => (t - times[i]) / 1000).sort((a, b) => a - b);
    const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : null;
    const coveragePct = Math.round((minutes.size / 1440) * 1000) / 10;
    return {
      day: d, ok: true, samples: times.length, minutesCovered: minutes.size, coveragePct, medianGapSec: medianGap,
      verdict: coveragePct >= 85 ? 'sufficient' : coveragePct >= 50 ? 'partial' : 'insufficient',
      note: 'Go/no-go for an intraday Energy Bank: ≥85% of minutes with a HR sample while worn. Daytime HRV is not available from Fitbit, so stress would be HR-only.',
    };
  }
}
