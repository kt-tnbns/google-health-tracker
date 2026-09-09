/** Timezone helpers without external deps (Intl only). */

/** Civil date "YYYY-MM-DD" of an instant in the given IANA zone. */
export function civilDate(instant: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Hour (0-23) of an instant in the given zone. */
export function civilHour(instant: Date, tz: string): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).format(instant);
  return Number(h) % 24;
}

/** Offset (ms) of `tz` at the given instant. */
export function tzOffsetMs(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(instant).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Instant at local midnight of `date` (YYYY-MM-DD) in `tz`. */
export function startOfCivilDay(date: string, tz: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  return new Date(guess.getTime() - tzOffsetMs(guess, tz));
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function todayCivil(tz: string, now = new Date()): string {
  return civilDate(now, tz);
}

/** Convert a google.type.Date-like object or "YYYY-MM-DD" string to "YYYY-MM-DD". */
export function normalizeDate(v: unknown): string | undefined {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  if (v && typeof v === 'object') {
    // google.type.Date {year,month,day} or CivilDateTime {date:{year,month,day}, time:{…}}
    const o = ((v as any).date && typeof (v as any).date === 'object' ? (v as any).date : v) as { year?: number; month?: number; day?: number };
    if (o.year && o.month && o.day) return `${o.year}-${String(o.month).padStart(2, '0')}-${String(o.day).padStart(2, '0')}`;
  }
  return undefined;
}

export const ONE_MINUTE = 60_000;
