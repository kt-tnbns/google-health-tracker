import { METRIC_UNITS, MetricId } from './metrics';
import { civilDate, normalizeDate } from './time';

export const NORMALIZER_VERSION = '2026-09-09.1';

export interface NormalizedMetric {
  day: string;                 // YYYY-MM-DD in user tz
  metric: MetricId;
  value: number | null;        // null = missing
  unit: string;
  status: 'ok' | 'missing' | 'partial';
  statusReason?: string;
  sourcePointName?: string;
  measuredStart?: string;      // ISO
  measuredEnd?: string;
  details?: Record<string, unknown>;
}

// ---------- Sleep ----------

interface SleepStage { startTime: string; endTime: string; type: string }
interface SleepPoint {
  name?: string;
  sleep?: {
    interval?: { startTime?: string; endTime?: string };
    type?: string;
    stages?: SleepStage[];
    metadata?: { nap?: boolean; processed?: boolean; stagesStatus?: string; manuallyEdited?: boolean };
    summary?: { minutesAsleep?: number | string; minutesAwake?: number | string; minutesInSleepPeriod?: number | string; minutesToFallAsleep?: number | string; minutesAfterWakeUp?: number | string; stagesSummary?: { type: string; minutes: number | string }[] };
  };
}

/**
 * Sleep attribution rule: a session belongs to the civil day on which it ENDED (the wake-up day),
 * matching the Fitbit app's "dateOfSleep" convention. Naps are excluded from the main-sleep metrics.
 * If several non-nap sessions end on the same day, the longest one is used and status = 'partial'.
 */
export function normalizeSleep(points: unknown[], tz: string): NormalizedMetric[] {
  const byDay = new Map<string, SleepPoint[]>();
  for (const raw of points as SleepPoint[]) {
    const s = raw.sleep;
    const end = s?.interval?.endTime;
    if (!s || !end) continue;
    if (s.metadata?.nap) continue;
    const day = civilDate(new Date(end), tz);
    byDay.set(day, [...(byDay.get(day) ?? []), raw]);
  }
  const out: NormalizedMetric[] = [];
  for (const [day, sessions] of byDay) {
    const sorted = [...sessions].sort((a, b) => num(b.sleep!.summary?.minutesAsleep) - num(a.sleep!.summary?.minutesAsleep));
    const main = sorted[0];
    const s = main.sleep!;
    const sum = s.summary ?? {};
    const partial = sessions.length > 1;
    const reason = partial ? `${sessions.length} non-nap sessions ended on this day; using the longest` : undefined;
    const base = {
      day,
      status: partial ? ('partial' as const) : ('ok' as const),
      statusReason: reason,
      sourcePointName: main.name,
      measuredStart: s.interval?.startTime,
      measuredEnd: s.interval?.endTime,
    };
    const stageMin = (t: string) => {
      const fromSummary = sum.stagesSummary?.find((x) => x.type === t);
      if (fromSummary) return num(fromSummary.minutes);
      if (!s.stages) return null;
      const ms = s.stages.filter((x) => x.type === t).reduce((acc, x) => acc + (Date.parse(x.endTime) - Date.parse(x.startTime)), 0);
      return Math.round(ms / 60_000);
    };
    const asleep = optNum(sum.minutesAsleep);
    const awake = optNum(sum.minutesAwake);
    const inPeriod = optNum(sum.minutesInSleepPeriod);
    // Efficiency here = asleep / (asleep + awake). This is OUR formula, not the Fitbit app's score.
    const efficiency = asleep !== null && awake !== null && asleep + awake > 0 ? round1((asleep / (asleep + awake)) * 100) : null;

    out.push(m(base, 'sleep_minutes_asleep', asleep, { sleepType: s.type, stagesStatus: s.metadata?.stagesStatus, processed: s.metadata?.processed }));
    out.push(m(base, 'sleep_minutes_awake', awake));
    out.push(m(base, 'sleep_minutes_in_period', inPeriod));
    out.push(m(base, 'sleep_efficiency_pct', efficiency, { formula: 'asleep/(asleep+awake)*100' }));
    out.push(m(base, 'sleep_deep_minutes', stageMin('DEEP')));
    out.push(m(base, 'sleep_rem_minutes', stageMin('REM')));
    out.push(m(base, 'sleep_light_minutes', stageMin('LIGHT')));
    out.push(m(base, 'sleep_start', s.interval?.startTime ? Date.parse(s.interval.startTime) : null, { iso: s.interval?.startTime }));
    out.push(m(base, 'sleep_end', s.interval?.endTime ? Date.parse(s.interval.endTime) : null, { iso: s.interval?.endTime }));
  }
  return out;
}

// ---------- Daily types ----------

type DailyExtractor = (payload: Record<string, unknown>) => Partial<Record<MetricId, number | null>>;

const DAILY_EXTRACTORS: Record<string, { key: string; extract: DailyExtractor }> = {
  'daily-heart-rate-variability': {
    key: 'dailyHeartRateVariability',
    extract: (p) => ({
      hrv_avg_ms: optNum(p.averageHeartRateVariabilityMilliseconds),
      hrv_deep_rmssd_ms: optNum(p.deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds),
    }),
  },
  'daily-resting-heart-rate': { key: 'dailyRestingHeartRate', extract: (p) => ({ rhr_bpm: optNum(p.beatsPerMinute) }) },
  'daily-respiratory-rate': {
    key: 'dailyRespiratoryRate',
    extract: (p) => ({ respiratory_rate_bpm: firstNumber(p, ['breathsPerMinute', 'averageBreathsPerMinute', 'fullSleepBreathsPerMinute']) }),
  },
  'daily-oxygen-saturation': {
    key: 'dailyOxygenSaturation',
    extract: (p) => ({ spo2_avg_pct: firstNumber(p, ['averagePercentage', 'averageOxygenSaturationPercentage', 'avg', 'average']) }),
  },
};

export function normalizeDaily(dataType: string, points: unknown[]): NormalizedMetric[] {
  const spec = DAILY_EXTRACTORS[dataType];
  if (!spec) throw new Error(`no daily extractor for ${dataType}`);
  const out: NormalizedMetric[] = [];
  for (const raw of points as Record<string, unknown>[]) {
    const payload = (raw[spec.key] ?? findUnionPayload(raw)) as Record<string, unknown> | undefined;
    if (!payload) continue;
    const day = normalizeDate(payload.date);
    if (!day) continue;
    const values = spec.extract(payload);
    for (const [metric, value] of Object.entries(values) as [MetricId, number | null][]) {
      out.push(m({ day, status: value === null ? 'missing' : 'ok', statusReason: value === null ? 'field absent in API payload' : undefined, sourcePointName: raw.name as string | undefined }, metric, value, { raw: payload }));
    }
  }
  return dedupeLatest(out);
}

// ---------- dailyRollUp (steps, active-zone-minutes) ----------

export function normalizeRollup(dataType: string, rollupPoints: unknown[]): NormalizedMetric[] {
  const metric: MetricId = dataType === 'steps' ? 'steps' : 'active_zone_minutes';
  const out: NormalizedMetric[] = [];
  for (const raw of rollupPoints as Record<string, unknown>[]) {
    const day = normalizeDate(raw.civilStartTime);
    if (!day) continue;
    const value = (raw.value ?? {}) as Record<string, unknown>;
    const inner = (value[camel(dataType)] ?? findUnionPayload(value) ?? value) as Record<string, unknown>;
    const n = dataType === 'steps' ? firstNumber(inner, ['count', 'steps']) : firstNumber(inner, ['totalMinutes', 'minutes', 'activeZoneMinutes', 'count']);
    out.push(m({ day, status: n === null ? 'missing' : 'ok', statusReason: n === null ? 'no numeric value in rollup' : undefined }, metric, n, { raw }));
  }
  return out;
}

// ---------- helpers ----------

function m(base: Omit<NormalizedMetric, 'metric' | 'value' | 'unit'>, metric: MetricId, value: number | null, details?: Record<string, unknown>): NormalizedMetric {
  return {
    ...base,
    metric,
    value,
    unit: METRIC_UNITS[metric],
    status: value === null && base.status === 'ok' ? 'missing' : base.status,
    statusReason: value === null && base.status === 'ok' ? 'value absent in API payload' : base.statusReason,
    details,
  };
}

/** When the same (day, metric) appears twice in one batch, keep the last occurrence. */
function dedupeLatest(rows: NormalizedMetric[]): NormalizedMetric[] {
  const map = new Map<string, NormalizedMetric>();
  for (const r of rows) map.set(`${r.day}|${r.metric}`, r);
  return [...map.values()];
}

function num(v: unknown): number { return Number(v ?? 0) || 0; }
function optNum(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function firstNumber(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const n = optNum(o[k]);
    if (n !== null) return n;
  }
  return null;
}
function round1(n: number) { return Math.round(n * 10) / 10; }
function camel(s: string) { return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }
/** DataPoint is a union: find the single object-valued field other than name/dataSource. */
function findUnionPayload(raw: Record<string, unknown>): Record<string, unknown> | undefined {
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'name' || k === 'dataSource' || k === 'dataPointName') continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  }
  return undefined;
}
