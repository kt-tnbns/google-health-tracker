import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { config } from '../config';
import { PG_POOL } from '../db/db.module';
import { addDays, todayCivil } from '../ingest/time';
import { Check, describeRules, evaluateDay, GoalValues, RULES_VERSION } from './rules';

@Injectable()
export class RulesService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  table() { return { version: RULES_VERSION, rules: describeRules() }; }

  /** Evaluate every rule for each day in the last `days` days (rows keyed by day). */
  async evaluate(days = 35): Promise<{ version: string; goals: GoalValues; byDay: Record<string, Check[]> }> {
    const today = todayCivil(config.USER_TIMEZONE);
    const start = addDays(today, -(days + 21));   // extra history so personal baselines have a window
    const { rows } = await this.pool.query<{ day: string; metric: string; value: string | null; status: string }>(
      `SELECT day, metric, value, status FROM daily_metrics WHERE day >= $1 AND day <= $2`, [start, today]);
    const grid = new Map<string, Map<string, number>>();
    for (const r of rows) {
      if (r.value === null || r.status === 'missing') continue;
      const d = String(r.day).slice(0, 10);
      if (!grid.has(d)) grid.set(d, new Map());
      grid.get(d)!.set(r.metric, Number(r.value));
    }
    const allDays = [...grid.keys()].sort();
    const get = (day: string, metric: string) => grid.get(day)?.get(metric) ?? null;
    const goals = await this.goals();
    const byDay: Record<string, Check[]> = {};
    for (const d of allDays.filter((d) => d >= addDays(today, -days))) byDay[d] = evaluateDay(d, allDays, get, goals);
    return { version: RULES_VERSION, goals, byDay };
  }

  async goals(): Promise<GoalValues> {
    const { rows } = await this.pool.query(`SELECT goal_sleep_min, goal_steps, goal_azm_week FROM coach_profile WHERE id = 1`).catch(() => ({ rows: [] as any[] }));
    const g = rows[0] ?? {};
    return { goal_sleep_min: g.goal_sleep_min ?? null, goal_steps: g.goal_steps ?? null, goal_azm_week: g.goal_azm_week ?? null };
  }
}
