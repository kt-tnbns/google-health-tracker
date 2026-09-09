/**
 * Registry of the data types we ingest for milestone 1, and how to query them.
 *
 * `filterField` is the AIP-160 field used for time-range filters on list/reconcile
 * (see https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/list):
 *   - interval types  -> `{dataType}.interval.start_time`
 *   - sample types    -> `{dataType}.sample_time.physical_time`
 *   - daily types     -> `{dataType}.date`
 *
 * NOTE: the exact literal format accepted for `.date` comparisons has NOT been verified
 * against a live account yet. Adjust `dateLiteral` below after the first real call.
 */
export type Kind = 'session' | 'daily' | 'interval' | 'sample';

export interface DataTypeSpec {
  dataType: string;         // API data type id
  kind: Kind;
  filterField: string;
  method: 'list' | 'reconcile';
  /** Which normalized metrics this data type produces */
  produces: MetricId[];
}

export type MetricId =
  | 'sleep_minutes_asleep'
  | 'sleep_minutes_awake'
  | 'sleep_minutes_in_period'
  | 'sleep_efficiency_pct'
  | 'sleep_deep_minutes'
  | 'sleep_rem_minutes'
  | 'sleep_light_minutes'
  | 'sleep_start'
  | 'sleep_end'
  | 'hrv_avg_ms'
  | 'hrv_deep_rmssd_ms'
  | 'rhr_bpm'
  | 'respiratory_rate_bpm'
  | 'spo2_avg_pct'
  | 'steps'
  | 'active_zone_minutes';

export const METRIC_UNITS: Record<MetricId, string> = {
  sleep_minutes_asleep: 'min',
  sleep_minutes_awake: 'min',
  sleep_minutes_in_period: 'min',
  sleep_efficiency_pct: '%',
  sleep_deep_minutes: 'min',
  sleep_rem_minutes: 'min',
  sleep_light_minutes: 'min',
  sleep_start: 'iso8601',
  sleep_end: 'iso8601',
  hrv_avg_ms: 'ms',
  hrv_deep_rmssd_ms: 'ms',
  rhr_bpm: 'bpm',
  respiratory_rate_bpm: 'breaths/min',
  spo2_avg_pct: '%',
  steps: 'count',
  active_zone_minutes: 'min',
};

export const DATA_TYPES: DataTypeSpec[] = [
  {
    dataType: 'sleep',
    kind: 'session',
    filterField: 'sleep.interval.start_time',
    method: 'list',
    produces: [
      'sleep_minutes_asleep', 'sleep_minutes_awake', 'sleep_minutes_in_period', 'sleep_efficiency_pct',
      'sleep_deep_minutes', 'sleep_rem_minutes', 'sleep_light_minutes', 'sleep_start', 'sleep_end',
    ],
  },
  { dataType: 'daily-heart-rate-variability', kind: 'daily', filterField: 'daily-heart-rate-variability.date', method: 'list', produces: ['hrv_avg_ms', 'hrv_deep_rmssd_ms'] },
  { dataType: 'daily-resting-heart-rate', kind: 'daily', filterField: 'daily-resting-heart-rate.date', method: 'list', produces: ['rhr_bpm'] },
  { dataType: 'daily-respiratory-rate', kind: 'daily', filterField: 'daily-respiratory-rate.date', method: 'list', produces: ['respiratory_rate_bpm'] },
  { dataType: 'daily-oxygen-saturation', kind: 'daily', filterField: 'daily-oxygen-saturation.date', method: 'list', produces: ['spo2_avg_pct'] },
  // Interval types are aggregated per civil day via dailyRollUp (handled separately in IngestService).
  { dataType: 'steps', kind: 'interval', filterField: 'steps.interval.start_time', method: 'reconcile', produces: ['steps'] },
  { dataType: 'active-zone-minutes', kind: 'interval', filterField: 'active-zone-minutes.interval.start_time', method: 'reconcile', produces: ['active_zone_minutes'] },
];

/** Build an AIP-160 time-range filter for [start, end). */
export function buildFilter(spec: DataTypeSpec, startIso: string, endIso: string, startDate: string, endDate: string): string {
  if (spec.kind === 'daily') {
    return `${spec.filterField} >= "${startDate}" AND ${spec.filterField} < "${endDate}"`;
  }
  return `${spec.filterField} >= "${startIso}" AND ${spec.filterField} < "${endIso}"`;
}
