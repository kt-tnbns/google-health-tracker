/**
 * Journal → weekly insights: compare tagged vs untagged days per outcome metric.
 * Association only — never causation. See docs/calculations.md §3.
 */
import { bootstrapDiffCI, clean, hedgesG, mannWhitneyP, mean, median, round } from './stats';

export const INSIGHTS_VERSION = 'insights-v0.1';

export const TAGS = [
  'alcohol', 'late_caffeine', 'late_meal', 'nicotine',
  'strength_training', 'cardio_hard', 'cardio_easy', 'rest_day',
  'late_screen', 'late_bedtime', 'nap', 'travel',
  'stress', 'sick', 'sauna_or_cold', 'meditation',
] as const;
export type Tag = (typeof TAGS)[number];

/** Which outcome metrics a tag on day D is compared against, and on which day the outcome is read. */
export const OUTCOMES: { metric: string; label: string; unit: string; nextMorning: boolean }[] = [
  { metric: 'hrv_avg_ms', label: 'HRV', unit: 'ms', nextMorning: true },
  { metric: 'rhr_bpm', label: 'resting HR', unit: 'bpm', nextMorning: true },
  { metric: 'sleep_minutes_asleep', label: 'sleep', unit: 'min', nextMorning: true },
  { metric: 'sleep_efficiency_pct', label: 'sleep efficiency', unit: '%', nextMorning: true },
  { metric: 'sleep_deep_minutes', label: 'deep sleep', unit: 'min', nextMorning: true },
];

export interface Insight {
  tag: string; metric: string; label: string; unit: string;
  nTagged: number; nUntagged: number;
  meanTagged: number; meanUntagged: number;
  diff: number;                 // tagged − untagged (weekday-adjusted values)
  ci: { lo: number; hi: number } | null;
  g: number | null;             // Hedges' g
  p: number | null;             // Mann–Whitney
  surfaced: boolean;            // passes all gates
  strength: 'small' | 'medium' | 'large' | null;
}

export interface InsightInputs {
  /** metric values by day: { 'YYYY-MM-DD': { metric: value } } */
  metrics: Record<string, Record<string, number | null>>;
  /** tags by day */
  tags: Record<string, string[]>;
  days: string[];               // ascending, the analysis window
}

const MIN_N = 5;

export function computeInsights(input: InsightInputs, seed = 42): Insight[] {
  const out: Insight[] = [];
  const weekday = (d: string) => new Date(d + 'T00:00:00Z').getUTCDay();
  const nextDay = (d: string) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };
  const allTags = new Set<string>(Object.values(input.tags).flat());

  for (const oc of OUTCOMES) {
    // outcome value attributed to the behaviour day (next morning's reading for sleep/HRV/RHR)
    const rows = input.days.map((d) => ({ d, y: input.metrics[oc.nextMorning ? nextDay(d) : d]?.[oc.metric] ?? null, wd: weekday(d) })).filter((r) => r.y !== null) as { d: string; y: number; wd: number }[];
    if (rows.length < 2 * MIN_N) continue;
    // weekday adjustment: subtract that weekday's median across the window
    const byWd = new Map<number, number[]>();
    for (const r of rows) byWd.set(r.wd, [...(byWd.get(r.wd) ?? []), r.y]);
    const adj = rows.map((r) => ({ ...r, ya: r.y - (byWd.get(r.wd)!.length >= 3 ? median(byWd.get(r.wd)!)! : median(rows.map((x) => x.y))!) }));

    for (const tag of allTags) {
      const tagged = adj.filter((r) => (input.tags[r.d] ?? []).includes(tag));
      const untagged = adj.filter((r) => !(input.tags[r.d] ?? []).includes(tag));
      if (tagged.length < MIN_N || untagged.length < MIN_N) {
        out.push({ tag, metric: oc.metric, label: oc.label, unit: oc.unit, nTagged: tagged.length, nUntagged: untagged.length, meanTagged: NaN, meanUntagged: NaN, diff: NaN, ci: null, g: null, p: null, surfaced: false, strength: null });
        continue;
      }
      const a = clean(tagged.map((r) => r.ya)), b = clean(untagged.map((r) => r.ya));
      const g = hedgesG(a, b);
      const ci = bootstrapDiffCI(a, b, 2000, seed);
      const p = mannWhitneyP(a, b);
      const diff = mean(a)! - mean(b)!;
      const surfaced = g !== null && Math.abs(g) >= 0.5 && ci !== null && (ci.lo > 0 || ci.hi < 0) && p !== null && p < 0.05;
      out.push({
        tag, metric: oc.metric, label: oc.label, unit: oc.unit, nTagged: a.length, nUntagged: b.length,
        meanTagged: round(mean(tagged.map((r) => r.y))!, 1), meanUntagged: round(mean(untagged.map((r) => r.y))!, 1),
        diff: round(diff, 1), ci: ci ? { lo: round(ci.lo, 1), hi: round(ci.hi, 1) } : null, g: g === null ? null : round(g, 2), p: p === null ? null : round(p, 3),
        surfaced, strength: g === null ? null : Math.abs(g) >= 0.8 ? 'large' : Math.abs(g) >= 0.5 ? 'medium' : Math.abs(g) >= 0.2 ? 'small' : null,
      });
    }
  }
  // rank surfaced by |g|
  return out.sort((x, y) => Number(y.surfaced) - Number(x.surfaced) || Math.abs(y.g ?? 0) - Math.abs(x.g ?? 0));
}
