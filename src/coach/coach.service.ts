import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { config } from '../config';
import { PG_POOL } from '../db/db.module';
import { addDays, todayCivil } from '../ingest/time';
import { buildContext, CoachContext, MetricRow, renderContextForPrompt } from './context';
import { ChatMessage, GlmClient } from './glm.client';
import { CoachProfile, DEFAULT_PROFILE, PROMPT_VERSION, systemPrompt } from './prompt';
import { ScoresService } from '../scores/scores.service';
import { LOAD_VERSION } from '../scores/load';
import { RulesService } from '../rules/rules.service';

export type Lang = 'th' | 'en';

@Injectable()
export class CoachService {
  private readonly log = new Logger(CoachService.name);
  constructor(@Inject(PG_POOL) private readonly pool: Pool, private readonly glm: GlmClient, private readonly scores: ScoresService, private readonly rules: RulesService) {}

  info() {
    return { configured: this.glm.configured, model: this.glm.model, promptVersion: PROMPT_VERSION, baseUrl: config.GLM_BASE_URL };
  }

  async context(): Promise<CoachContext> {
    const today = todayCivil(config.USER_TIMEZONE);
    const { rows } = await this.pool.query<MetricRow>(
      `SELECT day, metric, value, unit, status, measured_start, measured_end FROM daily_metrics WHERE day >= $1 AND day <= $2 ORDER BY day, metric`,
      [addDays(today, -21), today],
    );
    const ctx = buildContext(rows, today, config.USER_TIMEZONE);
    try {
      const { recovery, load } = await this.scores.daily(1);
      const r = recovery[recovery.length - 1], l = load[load.length - 1];
      ctx.recovery = r ? { day: r.day, score: r.score, band: r.band, status: r.status, confidence: r.confidence, reasons: r.reasons, flags: r.flags, hrv7Status: r.hrv7Status, version: r.version } : null;
      ctx.load = l ? { day: l.day, load: l.load, source: l.source, acute: l.acute, chronic: l.chronic, acwr: l.acwr, acwrBand: l.acwrBand, monotony: l.monotony, version: LOAD_VERSION } : null;
      const ins = await this.scores.insights(90);
      ctx.insights = ins.insights.filter((i) => i.surfaced).slice(0, 3).map((i) => ({ tag: i.tag, label: i.label, unit: i.unit, diff: i.diff, nTagged: i.nTagged, nUntagged: i.nUntagged, g: i.g, ci: i.ci }));
      const j = await this.scores.journal(today, today);
      ctx.journalToday = j[0]?.tags ?? [];
      const ev = await this.rules.evaluate(3);
      const evDays = Object.keys(ev.byDay).sort();
      const latest = evDays[evDays.length - 1];
      if (latest) ctx.ruleChecks = { day: latest, version: ev.version, checks: ev.byDay[latest].map((c) => ({ id: c.id, kind: c.kind, metric: c.metric, value: c.value === null ? null : Math.round(c.value * 10) / 10, level: c.level, text: c.text.en, band: c.band && Number.isFinite(c.band.lo) ? { lo: Math.round(c.band.lo * 10) / 10, hi: Number.isFinite(c.band.hi) ? Math.round(c.band.hi * 10) / 10 : null } : undefined, target: c.target })) };
    } catch (e) {
      this.log.warn(`scores unavailable for coach context: ${(e as Error).message}`);
    }
    return ctx;
  }

  /* ---------- personalisation ---------- */
  async profile(): Promise<CoachProfile> {
    const { rows } = await this.pool.query(`SELECT tone, verbosity, occupation, lifestyle, health_notes, exercise_purpose, custom_instructions, chat_notes, goal_sleep_min, goal_steps, goal_azm_week, updated_at FROM coach_profile WHERE id = 1`);
    return rows[0] ? { ...DEFAULT_PROFILE, ...rows[0], chat_notes: Array.isArray(rows[0].chat_notes) ? rows[0].chat_notes : [] } : DEFAULT_PROFILE;
  }

  async updateProfile(patch: Partial<CoachProfile>): Promise<CoachProfile> {
    const str = (v: unknown, max: number) => (v === undefined ? undefined : v === null || v === '' ? null : String(v).slice(0, max));
    const int = (v: unknown) => (v === undefined ? undefined : v === null || v === '' ? null : Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);
    const tone = patch.tone && ['relaxed', 'balanced', 'strict'].includes(patch.tone) ? patch.tone : undefined;
    const verbosity = patch.verbosity && ['brief', 'normal'].includes(patch.verbosity) ? patch.verbosity : undefined;
    const fields: Record<string, unknown> = {
      tone, verbosity, occupation: str(patch.occupation, 120), lifestyle: str(patch.lifestyle, 800), health_notes: str(patch.health_notes, 800),
      exercise_purpose: str(patch.exercise_purpose, 300), custom_instructions: str(patch.custom_instructions, 1500),
      goal_sleep_min: int(patch.goal_sleep_min), goal_steps: int(patch.goal_steps), goal_azm_week: int(patch.goal_azm_week),
      chat_notes: patch.chat_notes === undefined ? undefined : JSON.stringify((patch.chat_notes || []).slice(-50)),
    };
    const keys = Object.keys(fields).filter((k) => fields[k] !== undefined);
    if (keys.length) {
      const sets = keys.map((k, i) => `${k} = $${i + 1}${k === 'chat_notes' ? '::jsonb' : ''}`).join(', ');
      await this.pool.query(`UPDATE coach_profile SET ${sets}, updated_at = now() WHERE id = 1`, keys.map((k) => fields[k]));
    }
    return this.profile();
  }

  /** "จำไว้ว่า …" / "/remember …" typed in chat → stored as a note the coach sees from now on. Returns null when the text is not such a command. */
  private rememberCommand(text: string): string | null {
    const m = text.match(/^\s*(?:\/remember|\/note|\/จำ|จำไว้ว่า|จำไว้:|จำไว้ด้วยว่า|remember that|remember:)\s*(.+)$/is);
    return m && m[1].trim() ? m[1].trim().slice(0, 300) : null;
  }

  async history(limit = 40) {
    const { rows } = await this.pool.query(
      `SELECT id, created_at, role, content, lang, model, error FROM coach_messages ORDER BY id DESC LIMIT $1`, [limit],
    );
    return rows.reverse();
  }

  async clear() { await this.pool.query('DELETE FROM coach_messages'); }

  /**
   * Streams the assistant reply through `onDelta`. Persists the user turn immediately and the
   * assistant turn (with the exact context snapshot) when done — or with `error` if GLM failed.
   */
  async chat(userText: string, lang: Lang, onDelta: (t: string) => void, signal?: AbortSignal): Promise<{ id: number; text: string }> {
    const text = userText.trim().slice(0, 4000);
    if (!text) throw new Error('empty message');
    await this.pool.query(`INSERT INTO coach_messages (role, content, lang) VALUES ('user', $1, $2)`, [text, lang]);

    const note = this.rememberCommand(text);
    if (note) {
      const p = await this.profile();
      await this.updateProfile({ chat_notes: [...p.chat_notes, { at: new Date().toISOString(), text: note }] });
      const reply = lang === 'th' ? `จำไว้แล้ว: "${note}" — โค้ชจะใช้เรื่องนี้ในคำแนะนำต่อจากนี้ (แก้หรือลบได้ในตั้งค่า → โค้ชของคุณ)` : `Noted: "${note}" — the coach will take this into account from now on (edit or remove it in Settings → Your coach).`;
      onDelta(reply);
      const { rows } = await this.pool.query<{ id: string }>(`INSERT INTO coach_messages (role, content, lang, model, prompt_version) VALUES ('assistant', $1, $2, 'app', $3) RETURNING id`, [reply, lang, PROMPT_VERSION]);
      return { id: Number(rows[0].id), text: reply };
    }

    const ctx = await this.context();
    const profile = await this.profile().catch(() => DEFAULT_PROFILE);
    const prior = await this.history(16);
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt(lang, renderContextForPrompt(ctx), profile) },
      ...prior.filter((m) => !m.error).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content as string })),
    ];
    // history() already includes the user turn we just inserted (it is the last row)
    try {
      const { text: reply, usage, aborted } = await this.glm.stream(messages, onDelta, { signal });
      const { rows } = await this.pool.query<{ id: string }>(
        `INSERT INTO coach_messages (role, content, lang, model, prompt_version, context_snapshot, usage, error) VALUES ('assistant', $1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [reply || '(empty reply)', lang, this.glm.model, PROMPT_VERSION, JSON.stringify(ctx), usage ? JSON.stringify(usage) : null, aborted ? 'client disconnected before the reply finished' : null],
      );
      return { id: Number(rows[0].id), text: reply };
    } catch (e) {
      const msg = (e as Error).message;
      this.log.error(`coach: ${msg}`);
      const fallback = lang === 'th' ? `ตอนนี้ติดต่อ AI coach ไม่ได้ (${msg}). ${deterministicSummary(ctx, 'th')}` : `The AI coach is unavailable right now (${msg}). ${deterministicSummary(ctx, 'en')}`;
      await this.pool.query(
        `INSERT INTO coach_messages (role, content, lang, model, prompt_version, context_snapshot, error) VALUES ('assistant', $1, $2, $3, $4, $5, $6)`,
        [fallback, lang, this.glm.model, PROMPT_VERSION, JSON.stringify(ctx), msg.slice(0, 500)],
      );
      onDelta(fallback);
      return { id: 0, text: fallback };
    }
  }
}

/** Numbers-only fallback when the model is unreachable. */
export function deterministicSummary(ctx: CoachContext, lang: Lang): string {
  const s = ctx.sleepLatest;
  const m = (id: string) => ctx.metrics.find((x) => x.metric === id);
  const hrv = m('hrv_avg_ms'), rhr = m('rhr_bpm');
  const hm = (min: number | null) => min === null ? '—' : `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
  if (lang === 'th') {
    return `สรุปจากตัวเลขล้วน: ${s ? `นอน ${hm(s.asleepMin)} (ตื่นวันที่ ${s.day}) ประสิทธิภาพ ${s.efficiencyPct ?? '—'}%` : 'ไม่มีข้อมูลการนอน'}; HRV ${hrv?.latest ?? '—'} ms (เฉลี่ย 7 วัน ${hrv?.baseline7 ?? '—'}); ชีพจรขณะพัก ${rhr?.latest ?? '—'} bpm (เฉลี่ย ${rhr?.baseline7 ?? '—'}).`;
  }
  return `Numbers only: ${s ? `slept ${hm(s.asleepMin)} (wake day ${s.day}), efficiency ${s.efficiencyPct ?? '—'}%` : 'no sleep data'}; HRV ${hrv?.latest ?? '—'} ms (7-day mean ${hrv?.baseline7 ?? '—'}); resting HR ${rhr?.latest ?? '—'} bpm (mean ${rhr?.baseline7 ?? '—'}).`;
}
