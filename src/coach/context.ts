/**
 * Deterministic coaching context. Pure functions over daily_metrics rows — no model involved.
 * Everything the coach is allowed to "know" about the data is produced here, versioned.
 */
import { MetricId } from '../ingest/metrics';

export const CONTEXT_VERSION = 'ctx-2026-09-09.1';

export interface MetricRow { day: string; metric: string; value: number | string | null; unit: string; status: string; measured_start?: string | Date | null; measured_end?: string | Date | null }

export interface MetricSummary {
  metric: MetricId;
  unit: string;
  latestDay: string | null;
  latest: number | null;
  /** mean of up to 7 prior days with data (excludes latestDay) */
  baseline7: number | null;
  baselineDays: number;
  delta: number | null;
  deltaPct: number | null;
  /** last 14 days as [day, value|null] */
  series: [string, number | null][];
  missingDays14: number;
}

export interface CoachContext {
  version: string;
  generatedAt: string;
  timezone: string;
  today: string;
  windowDays: string[];
  sleepLatest: null | { day: string; start: string | null; end: string | null; asleepMin: number | null; awakeMin: number | null; efficiencyPct: number | null; deepMin: number | null; remMin: number | null; lightMin: number | null; partial: boolean };
  metrics: MetricSummary[];
  dataQuality: { daysWithAnySleep: number; daysWithHrv: number; daysWithRhr: number; notes: string[] };
  /** Deterministic scores supplied by the backend (never computed by the model). */
  recovery?: { day: string; score: number | null; band: string | null; status: string; confidence: number; reasons: string[]; flags: string[]; hrv7Status: string | null; version: string } | null;
  load?: { day: string; load: number | null; source: string; acute: number | null; chronic: number | null; acwr: number | null; acwrBand: string | null; monotony: number | null; version: string } | null;
  insights?: { tag: string; label: string; unit: string; diff: number; nTagged: number; nUntagged: number; g: number | null; ci: { lo: number; hi: number } | null }[];
  journalToday?: string[];
}

const TRACKED: { metric: MetricId; upIsGood: boolean | null }[] = [
  { metric: 'sleep_minutes_asleep', upIsGood: true },
  { metric: 'sleep_efficiency_pct', upIsGood: true },
  { metric: 'sleep_deep_minutes', upIsGood: true },
  { metric: 'sleep_rem_minutes', upIsGood: true },
  { metric: 'hrv_avg_ms', upIsGood: true },
  { metric: 'rhr_bpm', upIsGood: false },
  { metric: 'respiratory_rate_bpm', upIsGood: null },
  { metric: 'spo2_avg_pct', upIsGood: true },
  { metric: 'steps', upIsGood: true },
  { metric: 'active_zone_minutes', upIsGood: true },
];

export function buildContext(rows: MetricRow[], today: string, timezone: string, now = new Date()): CoachContext {
  const byDay = new Map<string, Map<string, MetricRow>>();
  for (const r of rows) {
    const d = String(r.day).slice(0, 10);
    if (!byDay.has(d)) byDay.set(d, new Map());
    byDay.get(d)!.set(r.metric, r);
  }
  const days = [...byDay.keys()].sort();
  const window = days.slice(-14);
  const val = (d: string, m: string): number | null => {
    const r = byDay.get(d)?.get(m);
    if (!r || r.status === 'missing' || r.value === null || r.value === undefined) return null;
    const n = Number(r.value);
    return Number.isFinite(n) ? n : null;
  };

  const metrics: MetricSummary[] = TRACKED.map(({ metric }) => {
    const unit = rows.find((r) => r.metric === metric)?.unit ?? '';
    let latestDay: string | null = null;
    for (let i = days.length - 1; i >= 0; i--) if (val(days[i], metric) !== null) { latestDay = days[i]; break; }
    const latest = latestDay ? val(latestDay, metric) : null;
    const prior = latestDay ? days.filter((d) => d < latestDay!).map((d) => val(d, metric)).filter((v): v is number => v !== null).slice(-7) : [];
    const baseline7 = prior.length ? round(prior.reduce((a, b) => a + b, 0) / prior.length, 1) : null;
    const delta = latest !== null && baseline7 !== null ? round(latest - baseline7, 1) : null;
    const deltaPct = delta !== null && baseline7 ? round((delta / baseline7) * 100, 0) : null;
    const series = window.map((d) => [d, val(d, metric)] as [string, number | null]);
    return { metric, unit, latestDay, latest, baseline7, baselineDays: prior.length, delta, deltaPct, series, missingDays14: series.filter((s) => s[1] === null).length };
  });

  let sleepLatest: CoachContext['sleepLatest'] = null;
  const sleepDay = metrics.find((m) => m.metric === 'sleep_minutes_asleep')?.latestDay ?? null;
  if (sleepDay) {
    const r = byDay.get(sleepDay)!.get('sleep_minutes_asleep')!;
    sleepLatest = {
      day: sleepDay,
      start: toIso(r.measured_start),
      end: toIso(r.measured_end),
      asleepMin: val(sleepDay, 'sleep_minutes_asleep'),
      awakeMin: val(sleepDay, 'sleep_minutes_awake'),
      efficiencyPct: val(sleepDay, 'sleep_efficiency_pct'),
      deepMin: val(sleepDay, 'sleep_deep_minutes'),
      remMin: val(sleepDay, 'sleep_rem_minutes'),
      lightMin: val(sleepDay, 'sleep_light_minutes'),
      partial: r.status === 'partial',
    };
  }

  const count = (m: string) => window.filter((d) => val(d, m) !== null).length;
  const notes: string[] = [];
  if (!window.length) notes.push('no data at all — nothing has been fetched yet');
  if (sleepLatest && sleepLatest.day !== today) notes.push(`latest sleep record is for ${sleepLatest.day}, not today (${today}); the device may not have synced yet`);
  if (count('hrv_avg_ms') < 5) notes.push('fewer than 5 days of HRV — baseline is unreliable');
  for (const m of metrics) if (m.baselineDays > 0 && m.baselineDays < 4) notes.push(`${m.metric}: baseline uses only ${m.baselineDays} day(s)`);

  return {
    version: CONTEXT_VERSION,
    generatedAt: now.toISOString(),
    timezone,
    today,
    windowDays: window,
    sleepLatest,
    metrics,
    dataQuality: { daysWithAnySleep: count('sleep_minutes_asleep'), daysWithHrv: count('hrv_avg_ms'), daysWithRhr: count('rhr_bpm'), notes: notes.filter(Boolean) },
  };
}

/** Compact plain-text rendering for the model prompt (numbers only, no interpretation). */
export function renderContextForPrompt(ctx: CoachContext): string {
  const lines: string[] = [];
  lines.push(`today=${ctx.today} tz=${ctx.timezone} context_version=${ctx.version}`);
  if (ctx.sleepLatest) {
    const s = ctx.sleepLatest;
    lines.push(`LATEST SLEEP (wake day ${s.day}${s.partial ? ', partial: several sessions' : ''}): asleep=${fmt(s.asleepMin)}min awake=${fmt(s.awakeMin)}min efficiency=${fmt(s.efficiencyPct)}% deep=${fmt(s.deepMin)} rem=${fmt(s.remMin)} light=${fmt(s.lightMin)} start=${s.start ?? '?'} end=${s.end ?? '?'}`);
  } else lines.push('LATEST SLEEP: none');
  lines.push('METRICS (latest vs mean of up to 7 prior days):');
  for (const m of ctx.metrics) {
    if (m.latest === null) { lines.push(`- ${m.metric}: no data`); continue; }
    lines.push(`- ${m.metric}: ${m.latest}${m.unit ? ' ' + m.unit : ''} on ${m.latestDay}; baseline7=${fmt(m.baseline7)} (${m.baselineDays}d) delta=${fmt(m.delta)} (${m.deltaPct === null ? '?' : m.deltaPct + '%'}); missing ${m.missingDays14}/14 days`);
  }
  lines.push('LAST 14 DAYS (day: asleep_min / hrv_ms / rhr_bpm / steps):');
  for (const d of ctx.windowDays) {
    const g = (id: MetricId) => fmt(ctx.metrics.find((m) => m.metric === id)?.series.find((s) => s[0] === d)?.[1] ?? null);
    lines.push(`  ${d}: ${g('sleep_minutes_asleep')} / ${g('hrv_avg_ms')} / ${g('rhr_bpm')} / ${g('steps')}`);
  }
  if (ctx.dataQuality.notes.length) lines.push('DATA QUALITY: ' + ctx.dataQuality.notes.join('; '));
  if (ctx.recovery) {
    const r = ctx.recovery;
    lines.push(`RECOVERY INDEX (${r.version}, computed by the app, day ${r.day}): score=${r.score ?? 'n/a'} band=${r.band ?? 'n/a'} status=${r.status} confidence=${r.confidence} hrv7=${r.hrv7Status ?? '?'}${r.reasons.length ? ' reasons: ' + r.reasons.join('; ') : ''}`);
  }
  if (ctx.load) {
    const l = ctx.load;
    lines.push(`CARDIO LOAD (${l.version}, day ${l.day}): today=${fmt(l.load)} (${l.source}) acute7=${fmt(l.acute)} chronic28=${fmt(l.chronic)} acwr=${fmt(l.acwr)} band=${l.acwrBand ?? 'n/a (needs 28 d)'} monotony=${fmt(l.monotony)}`);
  }
  if (ctx.insights?.length) {
    lines.push('JOURNAL PATTERNS (associations in this user\'s own data, NOT causation; already statistically gated):');
    for (const i of ctx.insights) lines.push(`- on ${i.nTagged} days tagged "${i.tag}", next-morning ${i.label} was ${i.diff > 0 ? '+' : ''}${i.diff} ${i.unit} vs ${i.nUntagged} other days (g=${fmt(i.g)}, 95% CI ${i.ci ? i.ci.lo + '..' + i.ci.hi : '?'})`);
  }
  if (ctx.journalToday?.length) lines.push(`TODAY'S JOURNAL TAGS: ${ctx.journalToday.join(', ')}`);
  return lines.join('\n');
}

function fmt(v: number | null | undefined) { return v === null || v === undefined ? '—' : String(v); }
function round(n: number, d: number) { const p = 10 ** d; return Math.round(n * p) / p; }
function toIso(v: unknown): string | null { if (!v) return null; return v instanceof Date ? v.toISOString() : String(v); }
