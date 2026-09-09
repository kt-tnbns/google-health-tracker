/** Strength log derived metrics. Formulas: Epley 1RM = w(1 + r/30); Brzycki 1RM = w / (1.0278 − 0.0278 r). */
import { round } from './stats';

export interface SetRow { session_id: number; day: string; exercise: string; muscle_group: string | null; reps: number; load_kg: number; rpe: number | null; rir: number | null; is_warmup: boolean }

export function e1rmEpley(w: number, reps: number): number | null { return w > 0 && reps > 0 && reps <= 12 ? round(w * (1 + reps / 30), 1) : null; }
export function e1rmBrzycki(w: number, reps: number): number | null { return w > 0 && reps > 0 && reps <= 12 ? round(w / (1.0278 - 0.0278 * reps), 1) : null; }
/** RPE ↔ RIR (Zourdos 2016): RPE 10 = 0 RIR, 9 = 1, 8 = 2 … */
export const rirFromRpe = (rpe: number) => Math.max(0, 10 - rpe);

export interface WeeklyStrength { weekStart: string; tonnage: number; hardSets: number; sessions: number; byMuscle: Record<string, { tonnage: number; hardSets: number }>; bestE1rm: Record<string, number> }

export function weeklyStrength(sets: SetRow[]): WeeklyStrength[] {
  const weekOf = (d: string) => { const t = new Date(d + 'T00:00:00Z'); const dow = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - dow); return t.toISOString().slice(0, 10); };
  const weeks = new Map<string, WeeklyStrength>();
  const sess = new Map<string, Set<number>>();
  for (const s of sets) {
    const w = weekOf(s.day);
    const rec = weeks.get(w) ?? { weekStart: w, tonnage: 0, hardSets: 0, sessions: 0, byMuscle: {}, bestE1rm: {} };
    sess.set(w, (sess.get(w) ?? new Set()).add(s.session_id));
    const ton = s.reps * s.load_kg;
    rec.tonnage += ton;
    const mg = s.muscle_group ?? 'other';
    rec.byMuscle[mg] ??= { tonnage: 0, hardSets: 0 };
    rec.byMuscle[mg].tonnage += ton;
    if (!s.is_warmup) { rec.hardSets++; rec.byMuscle[mg].hardSets++; }
    const e = e1rmEpley(s.load_kg, s.reps);
    if (e !== null && !s.is_warmup && (s.rpe === null || s.rpe >= 7)) rec.bestE1rm[s.exercise] = Math.max(rec.bestE1rm[s.exercise] ?? 0, e);
    weeks.set(w, rec);
  }
  return [...weeks.values()].map((w) => ({ ...w, tonnage: round(w.tonnage, 0), sessions: sess.get(w.weekStart)!.size })).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}
