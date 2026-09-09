import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { config } from '../config';
import { PG_POOL } from '../db/db.module';
import { addDays, todayCivil } from '../ingest/time';
import { buildContext, CoachContext, MetricRow, renderContextForPrompt } from './context';
import { ChatMessage, GlmClient } from './glm.client';
import { PROMPT_VERSION, systemPrompt } from './prompt';
import { ScoresService } from '../scores/scores.service';
import { LOAD_VERSION } from '../scores/load';

export type Lang = 'th' | 'en';

@Injectable()
export class CoachService {
  private readonly log = new Logger(CoachService.name);
  constructor(@Inject(PG_POOL) private readonly pool: Pool, private readonly glm: GlmClient, private readonly scores: ScoresService) {}

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
    } catch (e) {
      this.log.warn(`scores unavailable for coach context: ${(e as Error).message}`);
    }
    return ctx;
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

    const ctx = await this.context();
    const prior = await this.history(16);
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt(lang, renderContextForPrompt(ctx)) },
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
