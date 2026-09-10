/**
 * Registry of the data types we ingest, and how to query them.
 *
 * Filter syntax (AIP-160) — verbatim examples from the list-method docs
 * (https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/list):
 *   steps.interval.start_time >= "2023-11-24T00:00:00Z" AND steps.interval.start_time < "2023-11-25T00:00:00Z"
 *   sleep.interval.end_time >= "…Z" AND sleep.interval.end_time < "…Z"        (sleep filters on END time)
 *   daily_heart_rate_variability.date < "2024-08-15"                            (daily types: camelCase + .date)
 *   exercise.interval.civil_start_time >= "2023-11-24" AND … < "2023-11-25"
 */
export type Kind = 'session' | 'daily' | 'interval' | 'sample';

export interface DataTypeSpec {
  dataType: string;         // API data type id (kebab-case, in the URL)
  kind: Kind;
  filterField: string;      // AIP-160 field used for the time-range filter
  filterKind: 'physical' | 'civil-date';
  method: 'list' | 'reconcile' | 'dailyRollUp';
  produces: MetricId[];
  /** Derived after the main pass (needs other metrics first); skipped by the generic fetch loop. */
  derived?: 'sleeping-hr';
}

export type MetricId =
  | 'sleep_minutes_asleep' | 'sleep_minutes_awake' | 'sleep_minutes_in_period' | 'sleep_efficiency_pct'
  | 'sleep_deep_minutes' | 'sleep_rem_minutes' | 'sleep_light_minutes' | 'sleep_start' | 'sleep_end'
  | 'sleep_latency_min' | 'sleep_nap_minutes' | 'sleep_total_asleep_minutes' | 'sleep_sessions_count' | 'sleeping_hr_bpm'
  | 'hrv_avg_ms' | 'hrv_deep_rmssd_ms' | 'rhr_bpm' | 'respiratory_rate_bpm' | 'spo2_avg_pct'
  | 'steps' | 'active_zone_minutes' | 'azm_fat_burn_min' | 'azm_cardio_min' | 'azm_peak_min'
  | 'hrz_light_min' | 'hrz_moderate_min' | 'hrz_vigorous_min' | 'hrz_peak_min'
  | 'vo2max' | 'weight_kg' | 'body_fat_pct'
  | 'exercise_minutes' | 'exercise_sessions';

export const METRIC_UNITS: Record<MetricId, string> = {
  sleep_minutes_asleep: 'min', sleep_minutes_awake: 'min', sleep_minutes_in_period: 'min', sleep_efficiency_pct: '%',
  sleep_deep_minutes: 'min', sleep_rem_minutes: 'min', sleep_light_minutes: 'min', sleep_start: 'iso8601', sleep_end: 'iso8601',
  sleep_latency_min: 'min', sleep_nap_minutes: 'min', sleep_total_asleep_minutes: 'min', sleep_sessions_count: 'count', sleeping_hr_bpm: 'bpm',
  hrv_avg_ms: 'ms', hrv_deep_rmssd_ms: 'ms', rhr_bpm: 'bpm', respiratory_rate_bpm: 'breaths/min', spo2_avg_pct: '%',
  steps: 'count', active_zone_minutes: 'min', azm_fat_burn_min: 'min', azm_cardio_min: 'min', azm_peak_min: 'min',
  hrz_light_min: 'min', hrz_moderate_min: 'min', hrz_vigorous_min: 'min', hrz_peak_min: 'min',
  vo2max: 'ml/kg/min', weight_kg: 'kg', body_fat_pct: '%',
  exercise_minutes: 'min', exercise_sessions: 'count',
};

export const DATA_TYPES: DataTypeSpec[] = [
  { dataType: 'sleep', kind: 'session', filterField: 'sleep.interval.end_time', filterKind: 'physical', method: 'list',
    produces: ['sleep_minutes_asleep', 'sleep_minutes_awake', 'sleep_minutes_in_period', 'sleep_efficiency_pct', 'sleep_deep_minutes', 'sleep_rem_minutes', 'sleep_light_minutes', 'sleep_start', 'sleep_end', 'sleep_latency_min', 'sleep_nap_minutes', 'sleep_total_asleep_minutes', 'sleep_sessions_count'] },
  // Heart-rate samples restricted to each night's main-sleep interval → mean sleeping HR (+ minute coverage). Fetched per night after sleep is known.
  { dataType: 'heart-rate', kind: 'sample', filterField: 'heart_rate.sample_time.physical_time', filterKind: 'physical', method: 'list', produces: ['sleeping_hr_bpm'], derived: 'sleeping-hr' },
  { dataType: 'daily-heart-rate-variability', kind: 'daily', filterField: 'daily_heart_rate_variability.date', filterKind: 'civil-date', method: 'list', produces: ['hrv_avg_ms', 'hrv_deep_rmssd_ms'] },
  { dataType: 'daily-resting-heart-rate', kind: 'daily', filterField: 'daily_resting_heart_rate.date', filterKind: 'civil-date', method: 'list', produces: ['rhr_bpm'] },
  { dataType: 'daily-respiratory-rate', kind: 'daily', filterField: 'daily_respiratory_rate.date', filterKind: 'civil-date', method: 'list', produces: ['respiratory_rate_bpm'] },
  { dataType: 'daily-oxygen-saturation', kind: 'daily', filterField: 'daily_oxygen_saturation.date', filterKind: 'civil-date', method: 'list', produces: ['spo2_avg_pct'] },
  { dataType: 'daily-vo2-max', kind: 'daily', filterField: 'daily_vo2_max.date', filterKind: 'civil-date', method: 'list', produces: ['vo2max'] },
  // Interval types aggregated per civil day via dailyRollUp
  { dataType: 'steps', kind: 'interval', filterField: 'steps.interval.start_time', filterKind: 'physical', method: 'dailyRollUp', produces: ['steps'] },
  { dataType: 'active-zone-minutes', kind: 'interval', filterField: 'active_zone_minutes.interval.start_time', filterKind: 'physical', method: 'dailyRollUp', produces: ['active_zone_minutes', 'azm_fat_burn_min', 'azm_cardio_min', 'azm_peak_min'] },
  { dataType: 'time-in-heart-rate-zone', kind: 'interval', filterField: 'time_in_heart_rate_zone.interval.start_time', filterKind: 'physical', method: 'dailyRollUp', produces: ['hrz_light_min', 'hrz_moderate_min', 'hrz_vigorous_min', 'hrz_peak_min'] },
  { dataType: 'weight', kind: 'sample', filterField: 'weight.sample_time.physical_time', filterKind: 'physical', method: 'dailyRollUp', produces: ['weight_kg'] },
  { dataType: 'body-fat', kind: 'sample', filterField: 'body_fat.sample_time.physical_time', filterKind: 'physical', method: 'dailyRollUp', produces: ['body_fat_pct'] },
  // Exercise sessions are stored in their own table; the daily metric is a per-day summary
  { dataType: 'exercise', kind: 'session', filterField: 'exercise.interval.civil_start_time', filterKind: 'civil-date', method: 'list', produces: ['exercise_minutes', 'exercise_sessions'] },
];

/** Build an AIP-160 time-range filter for [start, end). */
export function buildFilter(spec: DataTypeSpec, startIso: string, endIso: string, startDate: string, endDate: string): string {
  if (spec.filterKind === 'civil-date') return `${spec.filterField} >= "${startDate}" AND ${spec.filterField} < "${endDate}"`;
  return `${spec.filterField} >= "${startIso}" AND ${spec.filterField} < "${endIso}"`;
}
