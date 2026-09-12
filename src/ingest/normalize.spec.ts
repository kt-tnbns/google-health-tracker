import { normalizeDaily, normalizeRollup, normalizeSleep } from './normalize';
import { addDays, civilDate, startOfCivilDay } from './time';

const TZ = 'Asia/Bangkok';

function sleep(start: string, end: string, asleep: number, awake: number, extra: Record<string, unknown> = {}) {
  return {
    name: `users/me/dataTypes/sleep/dataPoints/${start}`,
    sleep: {
      interval: { startTime: start, endTime: end },
      type: 'STAGES',
      summary: { minutesAsleep: asleep, minutesAwake: awake, minutesInSleepPeriod: asleep + awake, stagesSummary: [{ type: 'DEEP', minutes: 70 }, { type: 'REM', minutes: 90 }, { type: 'LIGHT', minutes: asleep - 160 }] },
      metadata: { nap: false, processed: true },
      ...extra,
    },
  };
}

describe('time', () => {
  it('attributes an instant to the Bangkok civil date', () => {
    // 2026-09-08T18:30Z = 2026-09-09 01:30 Bangkok
    expect(civilDate(new Date('2026-09-08T18:30:00Z'), TZ)).toBe('2026-09-09');
  });
  it('computes local midnight', () => {
    expect(startOfCivilDay('2026-09-09', TZ).toISOString()).toBe('2026-09-08T17:00:00.000Z');
  });
  it('adds days across month boundary', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
  });
});

describe('normalizeSleep', () => {
  it('attributes a night crossing midnight to the wake-up day', () => {
    // 23:30 Sep 8 -> 06:40 Sep 9 (Bangkok) == 16:30Z -> 23:40Z Sep 8
    const rows = normalizeSleep([sleep('2026-09-08T16:30:00Z', '2026-09-08T23:40:00Z', 400, 30)], TZ);
    const asleep = rows.find((r) => r.metric === 'sleep_minutes_asleep')!;
    expect(asleep.day).toBe('2026-09-09');
    expect(asleep.value).toBe(400);
    expect(asleep.status).toBe('ok');
    expect(rows.find((r) => r.metric === 'sleep_efficiency_pct')!.value).toBeCloseTo(93.0, 1);
    expect(rows.find((r) => r.metric === 'sleep_deep_minutes')!.value).toBe(70);
  });

  it('excludes naps and marks multiple main sessions as partial', () => {
    const rows = normalizeSleep(
      [
        sleep('2026-09-08T16:30:00Z', '2026-09-08T23:40:00Z', 400, 30),
        sleep('2026-09-09T01:00:00Z', '2026-09-09T02:00:00Z', 55, 5),          // second session same day
        sleep('2026-09-09T07:00:00Z', '2026-09-09T07:30:00Z', 30, 0, { metadata: { nap: true } }),
      ],
      TZ,
    );
    const asleep = rows.filter((r) => r.metric === 'sleep_minutes_asleep');
    expect(asleep).toHaveLength(1);
    expect(asleep[0].value).toBe(400);
    expect(asleep[0].status).toBe('partial');
    expect(asleep[0].statusReason).toMatch(/2 non-nap/);
  });

  it('falls back to stage intervals when stagesSummary is absent', () => {
    const p = sleep('2026-09-08T16:30:00Z', '2026-09-08T23:40:00Z', 400, 30);
    delete (p.sleep.summary as any).stagesSummary;
    (p.sleep as any).stages = [
      { startTime: '2026-09-08T17:00:00Z', endTime: '2026-09-08T17:45:00Z', type: 'DEEP' },
      { startTime: '2026-09-08T18:00:00Z', endTime: '2026-09-08T18:30:00Z', type: 'DEEP' },
    ];
    const rows = normalizeSleep([p], TZ);
    expect(rows.find((r) => r.metric === 'sleep_deep_minutes')!.value).toBe(75);
  });

  it('marks missing summary values as missing, not zero', () => {
    const p = sleep('2026-09-08T16:30:00Z', '2026-09-08T23:40:00Z', 400, 30);
    delete (p.sleep.summary as any).minutesAwake;
    delete (p.sleep.summary as any).minutesInSleepPeriod;
    const rows = normalizeSleep([p], TZ);
    const awake = rows.find((r) => r.metric === 'sleep_minutes_awake')!;
    expect(awake.value).toBeNull();
    expect(awake.status).toBe('missing');
    expect(rows.find((r) => r.metric === 'sleep_efficiency_pct')!.value).toBeNull();
  });

  it('computes efficiency as asleep ÷ time in bed (Google definition) — 359/369 → 97.3', () => {
    const p = sleep('2026-09-09T17:53:00Z', '2026-09-10T00:02:00Z', 359, 10);
    (p.sleep.summary as any).minutesInSleepPeriod = 369; (p.sleep.summary as any).minutesToFallAsleep = 0;
    const rows = normalizeSleep([p], TZ);
    expect(rows.find((r) => r.metric === 'sleep_efficiency_pct')!.value).toBeCloseTo(97.3, 1);
    expect(rows.find((r) => r.metric === 'sleep_minutes_in_period')!.value).toBe(369);
    expect(rows.find((r) => r.metric === 'sleep_latency_min')!.value).toBe(0);
  });

  it('falls back to asleep ÷ (asleep + awake) only when minutesInSleepPeriod is absent', () => {
    const p = sleep('2026-09-08T16:30:00Z', '2026-09-08T23:40:00Z', 400, 30);
    delete (p.sleep.summary as any).minutesInSleepPeriod;
    const eff = normalizeSleep([p], TZ).find((r) => r.metric === 'sleep_efficiency_pct')!;
    expect(eff.value).toBeCloseTo(93.0, 1);
    expect(String(eff.details?.formula)).toMatch(/fallback/);
  });

  it('sums naps separately and reports total incl. naps; naps-only day keeps main sleep missing', () => {
    const rows = normalizeSleep(
      [
        sleep('2026-09-08T16:30:00Z', '2026-09-08T23:40:00Z', 400, 30),
        sleep('2026-09-09T07:00:00Z', '2026-09-09T07:30:00Z', 25, 5, { metadata: { nap: true } }),     // nap same wake day
        sleep('2026-09-10T07:00:00Z', '2026-09-10T07:40:00Z', 35, 5, { metadata: { nap: true } }),     // next day: nap only
      ],
      TZ,
    );
    const d9 = (m: string) => rows.find((r) => r.day === '2026-09-09' && r.metric === m)!;
    expect(d9('sleep_minutes_asleep').value).toBe(400);
    expect(d9('sleep_minutes_asleep').status).toBe('ok');            // nap does not make the day partial
    expect(d9('sleep_nap_minutes').value).toBe(25);
    expect(d9('sleep_total_asleep_minutes').value).toBe(425);
    expect(d9('sleep_sessions_count').value).toBe(2);
    const d10 = rows.filter((r) => r.day === '2026-09-10');
    expect(d10.find((r) => r.metric === 'sleep_minutes_asleep')).toBeUndefined();
    expect(d10.find((r) => r.metric === 'sleep_nap_minutes')!.value).toBe(35);
    expect(d10.find((r) => r.metric === 'sleep_total_asleep_minutes')!.value).toBe(35);
  });
});

describe('normalizeDaily', () => {
  it('extracts HRV and RHR by date object', () => {
    const hrv = normalizeDaily('daily-heart-rate-variability', [
      { dailyHeartRateVariability: { date: { year: 2026, month: 9, day: 9 }, averageHeartRateVariabilityMilliseconds: 42.5 } },
    ]);
    expect(hrv.find((r) => r.metric === 'hrv_avg_ms')).toMatchObject({ day: '2026-09-09', value: 42.5, status: 'ok' });
    expect(hrv.find((r) => r.metric === 'hrv_deep_rmssd_ms')).toMatchObject({ value: null, status: 'missing' });

    const rhr = normalizeDaily('daily-resting-heart-rate', [{ dailyRestingHeartRate: { date: '2026-09-09', beatsPerMinute: 58 } }]);
    expect(rhr[0]).toMatchObject({ day: '2026-09-09', metric: 'rhr_bpm', value: 58 });
  });

  it('keeps one row per (day, metric) when the API repeats a day', () => {
    const rows = normalizeDaily('daily-resting-heart-rate', [
      { dailyRestingHeartRate: { date: '2026-09-09', beatsPerMinute: 58 } },
      { dailyRestingHeartRate: { date: '2026-09-09', beatsPerMinute: 59 } },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(59);
  });
});

describe('normalizeRollup', () => {
  it('extracts steps per civil day and distinguishes 0 from missing', () => {
    const rows = normalizeRollup('steps', [
      { civilStartTime: { year: 2026, month: 9, day: 8 }, civilEndTime: { year: 2026, month: 9, day: 9 }, value: { steps: { count: '8123' } } },
      { civilStartTime: { year: 2026, month: 9, day: 9 }, civilEndTime: { year: 2026, month: 9, day: 10 }, value: { steps: { count: 0 } } },
      { civilStartTime: { year: 2026, month: 9, day: 10 }, civilEndTime: { year: 2026, month: 9, day: 11 }, value: {} },
    ]);
    expect(rows.map((r) => [r.day, r.value, r.status])).toEqual([
      ['2026-09-08', 8123, 'ok'],
      ['2026-09-09', 0, 'ok'],
      ['2026-09-10', null, 'missing'],
    ]);
  });
});


describe('load normalization completeness', () => {
  const point = (value: unknown) => [{ civilStartTime: { year: 2026, month: 9, day: 9 }, value }];
  it('does not fabricate an AZM total from incomplete zone fields', () => {
    const rows = normalizeRollup('active-zone-minutes', point({ activeZoneMinutes: { sumInFatBurnHeartZone: 20 } }));
    expect(rows.find(r => r.metric === 'active_zone_minutes')!.value).toBeNull();
    expect(rows.find(r => r.metric === 'azm_fat_burn_min')!.value).toBe(20);
  });
  it('accepts complete explicit zeros and a separately supplied total', () => {
    const zero = normalizeRollup('active-zone-minutes', point({ activeZoneMinutes: { sumInFatBurnHeartZone: 0, sumInCardioHeartZone: 0, sumInPeakHeartZone: 0 } }));
    expect(zero.find(r => r.metric === 'active_zone_minutes')!.value).toBe(0);
    const total = normalizeRollup('active-zone-minutes', point({ activeZoneMinutes: { totalMinutes: 30, sumInFatBurnHeartZone: 20 } }));
    expect(total.find(r => r.metric === 'active_zone_minutes')!.value).toBe(30);
  });
  it('does not turn a zone with an absent duration into zero', () => {
    const rows = normalizeRollup('time-in-heart-rate-zone', point({ timeInHeartRateZone: { timeInHeartRateZones: [{ heartRateZone: 'PEAK' }] } }));
    expect(rows.find(r => r.metric === 'hrz_peak_min')!.value).toBeNull();
  });
});

describe('cached load data', () => {
  it('reinterprets old partial AZM totals using the preserved raw response', () => {
    const { repairLoadRow } = require('./normalize');
    const old = { day: '2026-09-09', metric: 'active_zone_minutes', value: 20, status: 'ok', details: { raw: {
      civilStartTime: { year: 2026, month: 9, day: 9 }, value: { activeZoneMinutes: { sumInFatBurnHeartZone: 20 } },
    } } };
    expect(repairLoadRow(old)).toMatchObject({ value: null, status: 'missing' });
    expect(old.value).toBe(20);
  });
});

it('reads Google steps countSum with nested civil dates, including cached missing rows', () => {
  const { repairLoadRow } = require('./normalize');
  const raw = { civilStartTime: { date: { year: 2026, month: 9, day: 12 }, time: {} }, steps: { countSum: '2900' } };
  expect(normalizeRollup('steps', [raw])[0]).toMatchObject({ day: '2026-09-12', value: 2900, status: 'ok' });
  expect(repairLoadRow({ metric: 'steps', value: null, status: 'missing', details: { raw } })).toMatchObject({ value: 2900, status: 'ok' });
});
