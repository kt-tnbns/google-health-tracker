/**
 * Health rules — the single place where "what does this value mean" is defined.
 *
 * Three kinds of rule:
 *   reference : fixed bands from a cited public guideline / commonly used cut-off (adult, non-diagnostic)
 *   personal  : the user's own baseline (mean ± max(SD, floor) over the prior `windowDays`, needs ≥ `minDays` values)
 *   goal      : a target the user set in Settings → Your coach
 *
 * UI, coach context and docs all read from here. The language model is told to use these labels and never
 * apply thresholds of its own. Bump RULES_VERSION whenever a band, source or text changes.
 */
import type { MetricId } from '../ingest/metrics';

export const RULES_VERSION = 'rules-v1';

export type Level = 'good' | 'fair' | 'low' | 'note' | 'na';
export interface I18nText { th: string; en: string }

export interface Band { level: Level; min?: number; max?: number; text: I18nText }   // min inclusive, max exclusive

export interface ReferenceRule {
  kind: 'reference'; id: string; metric: MetricId | 'sleep_deep_pct' | 'sleep_rem_pct' | 'sleep_light_pct' | 'azm_week';
  title: I18nText; unit: string; bands: Band[]; source: string; note?: I18nText;
}
export interface PersonalRule {
  kind: 'personal'; id: string; metric: MetricId; title: I18nText; unit: string;
  windowDays: number; minDays: number; floor: number; better: 'higher' | 'lower' | 'neutral';
  text: { within: I18nText; above: I18nText; below: I18nText; collecting: I18nText }; source: string;
}
export interface GoalRule {
  kind: 'goal'; id: string; metric: MetricId | 'azm_week'; title: I18nText; unit: string; profileField: 'goal_sleep_min' | 'goal_steps' | 'goal_azm_week';
  direction: 'atLeast'; source: string;
}
export type Rule = ReferenceRule | PersonalRule | GoalRule;

const T = (th: string, en: string): I18nText => ({ th, en });

export const RULES: Rule[] = [
  // ---------- sleep (reference) ----------
  {
    kind: 'reference', id: 'sleep.duration', metric: 'sleep_minutes_asleep', title: T('เวลาหลับ', 'Time asleep'), unit: 'min',
    bands: [
      { level: 'low', max: 360, text: T('น้อยกว่า 6 ชม. — ต่ำกว่าช่วงที่แนะนำสำหรับผู้ใหญ่ (7–9 ชม.)', 'Under 6 h — below the adult recommendation (7–9 h)') },
      { level: 'fair', min: 360, max: 420, text: T('6–7 ชม. — ใกล้ช่วงแนะนำแต่ยังไม่ถึง', '6–7 h — a little short of the recommended range') },
      { level: 'good', min: 420, max: 541, text: T('อยู่ในช่วง 7–9 ชม. ที่แนะนำสำหรับผู้ใหญ่', 'Within the 7–9 h adult recommendation') },
      { level: 'note', min: 541, text: T('มากกว่า 9 ชม. — นานกว่าช่วงแนะนำ ปกติถ้าเป็นคืนชดเชย', 'Over 9 h — longer than the usual range; fine as an occasional catch-up night') },
    ],
    source: 'National Sleep Foundation (Hirshkowitz 2015) & AASM/SRS consensus (Watson 2015): adults 7–9 h per night',
  },
  {
    kind: 'reference', id: 'sleep.efficiency', metric: 'sleep_efficiency_pct', title: T('ประสิทธิภาพการนอน', 'Sleep efficiency'), unit: '%',
    bands: [
      { level: 'low', max: 75, text: T('ต่ำกว่า 75% — ใช้เวลาบนเตียงมากแต่หลับน้อย', 'Below 75% — a lot of time in bed not asleep') },
      { level: 'fair', min: 75, max: 85, text: T('75–85% — พอใช้ ต่ำกว่าเกณฑ์ปกติที่ 85% เล็กน้อย', '75–85% — fair, a little under the usual 85% cut-off') },
      { level: 'good', min: 85, text: T('≥ 85% — อยู่ในเกณฑ์ปกติ', '≥ 85% — within the normal cut-off') },
    ],
    source: 'Sleep efficiency ≥ 85% is the cut-off most commonly used as "normal" in sleep research (e.g. Reed & Sacco, J Clin Sleep Med 2016). Efficiency = asleep ÷ time in bed, the same definition as Google Health.',
  },
  {
    kind: 'reference', id: 'sleep.latency', metric: 'sleep_latency_min', title: T('เวลากว่าจะหลับ', 'Time to fall asleep'), unit: 'min',
    bands: [
      { level: 'good', max: 31, text: T('หลับภายใน 30 นาที — ปกติ', 'Fell asleep within 30 min — normal') },
      { level: 'fair', min: 31, max: 61, text: T('31–60 นาที — นานกว่าปกติเล็กน้อย', '31–60 min — a little longer than usual') },
      { level: 'low', min: 61, text: T('เกิน 60 นาที — ใช้เวลานานกว่าจะหลับ', 'Over 60 min — took a long time to fall asleep') },
    ],
    source: 'Sleep onset latency ≤ 30 min is the conventional adult cut-off (used e.g. in the Pittsburgh Sleep Quality Index scoring)',
  },
  {
    kind: 'reference', id: 'sleep.stage.deep', metric: 'sleep_deep_pct', title: T('หลับลึก', 'Deep sleep'), unit: '%',
    bands: [{ level: 'note', max: 13, text: T('ต่ำกว่าช่วงที่พบบ่อย (13–23% ของเวลาหลับ)', 'Below the common range (13–23% of sleep)') }, { level: 'good', min: 13, max: 23.5, text: T('อยู่ในช่วงที่พบบ่อย 13–23%', 'Within the common 13–23% range') }, { level: 'note', min: 23.5, text: T('สูงกว่าช่วงที่พบบ่อย — มักเกิดหลังวันที่เหนื่อยหรือนอนน้อยมาก่อน', 'Above the common range — often after tiring days or prior short sleep') }],
    source: 'Approximate adult ranges published in wearable makers’ sleep-stage guidance (Fitbit Help). Descriptive only, not a target.',
  },
  {
    kind: 'reference', id: 'sleep.stage.rem', metric: 'sleep_rem_pct', title: T('REM', 'REM'), unit: '%',
    bands: [{ level: 'note', max: 20, text: T('ต่ำกว่าช่วงที่พบบ่อย (20–25%) — แอลกอฮอล์และการนอนสั้นมักลด REM', 'Below the common range (20–25%) — alcohol and short nights often cut REM') }, { level: 'good', min: 20, max: 25.5, text: T('อยู่ในช่วงที่พบบ่อย 20–25%', 'Within the common 20–25% range') }, { level: 'note', min: 25.5, text: T('สูงกว่าช่วงที่พบบ่อย', 'Above the common range') }],
    source: 'Approximate adult ranges published in wearable makers’ sleep-stage guidance (Fitbit Help). Descriptive only, not a target.',
  },
  {
    kind: 'reference', id: 'sleep.stage.light', metric: 'sleep_light_pct', title: T('หลับตื้น', 'Light sleep'), unit: '%',
    bands: [{ level: 'note', max: 45, text: T('ต่ำกว่าช่วงที่พบบ่อย (45–60%)', 'Below the common range (45–60%)') }, { level: 'good', min: 45, max: 60.5, text: T('อยู่ในช่วงที่พบบ่อย 45–60%', 'Within the common 45–60% range') }, { level: 'note', min: 60.5, text: T('สูงกว่าช่วงที่พบบ่อย', 'Above the common range') }],
    source: 'Approximate adult ranges published in wearable makers’ sleep-stage guidance (Fitbit Help). Descriptive only, not a target.',
  },
  // ---------- activity (reference) ----------
  {
    kind: 'reference', id: 'activity.azm_week', metric: 'azm_week', title: T('นาทีในโซนหัวใจ 7 วันล่าสุด', 'Zone minutes, last 7 days'), unit: 'min',
    bands: [
      { level: 'low', max: 75, text: T('ต่ำกว่า 75 นาที/สัปดาห์ — ยังห่างจากเกณฑ์ WHO ที่ 150', 'Under 75 min/week — well short of the WHO 150') },
      { level: 'fair', min: 75, max: 150, text: T('75–149 นาที — ครึ่งทางสู่เกณฑ์ WHO 150 นาที/สัปดาห์', '75–149 min — halfway to the WHO 150 min/week') },
      { level: 'good', min: 150, text: T('≥ 150 นาที/สัปดาห์ — ถึงเกณฑ์กิจกรรมของ WHO', '≥ 150 min/week — meets the WHO activity guideline') },
    ],
    source: 'WHO 2020 physical-activity guidelines: 150–300 min moderate or 75–150 min vigorous per week. Fitbit Active Zone Minutes credit vigorous minutes ×2, so 150 AZM ≈ the guideline.',
    note: T('นับรวม 7 วันล่าสุดแบบเลื่อน ไม่ใช่สัปดาห์ปฏิทิน', 'Rolling 7-day total, not a calendar week'),
  },
  {
    kind: 'reference', id: 'activity.steps', metric: 'steps', title: T('ก้าว', 'Steps'), unit: 'steps',
    bands: [
      { level: 'low', max: 5000, text: T('ต่ำกว่า 5,000 ก้าว — วันนั่งนาน', 'Under 5,000 — a sedentary day') },
      { level: 'fair', min: 5000, max: 8000, text: T('5,000–7,999 ก้าว — ปานกลาง', '5,000–7,999 — moderate') },
      { level: 'good', min: 8000, text: T('≥ 8,000 ก้าว — อยู่ในช่วงที่งานวิจัยพบประโยชน์เต็มที่สำหรับอายุต่ำกว่า 60', '≥ 8,000 — in the range where benefits plateau for adults under 60') },
    ],
    source: 'Paluch et al., Lancet Public Health 2022 (meta-analysis of 15 cohorts): mortality benefit plateaus around 8,000–10,000 steps/day under age 60, 6,000–8,000 at 60+.',
  },
  // ---------- vitals (personal baseline) ----------
  { kind: 'personal', id: 'personal.hrv', metric: 'hrv_avg_ms', title: T('HRV', 'HRV'), unit: 'ms', windowDays: 14, minDays: 3, floor: 3, better: 'higher',
    text: { within: T('อยู่ในช่วงปกติของคุณ', 'Within your usual range'), above: T('สูงกว่าช่วงของคุณ — มักสัมพันธ์กับการฟื้นตัวที่ดี', 'Above your range — often goes with good recovery'), below: T('ต่ำกว่าช่วงของคุณ — มักพบหลังวันหนัก นอนน้อย ดื่ม หรือเริ่มไม่สบาย', 'Below your range — common after hard days, short sleep, alcohol, or when getting ill'), collecting: T('กำลังสะสมข้อมูลเปรียบเทียบ', 'Building your baseline') },
    source: 'Personal baseline: mean ± max(SD, 3 ms) of the prior 14 days with data (≥ 3 days). Population HRV norms are not used because HRV varies widely between people.' },
  { kind: 'personal', id: 'personal.rhr', metric: 'rhr_bpm', title: T('ชีพจรขณะพัก', 'Resting HR'), unit: 'bpm', windowDays: 14, minDays: 3, floor: 2, better: 'lower',
    text: { within: T('อยู่ในช่วงปกติของคุณ', 'Within your usual range'), above: T('สูงกว่าปกติ — มักพบหลังดื่ม นอนน้อย เครียด หรือร่างกายกำลังสู้กับอะไรบางอย่าง', 'Above usual — common after alcohol, short sleep, stress, or when the body is fighting something'), below: T('ต่ำกว่าปกติ — มักสัมพันธ์กับการพักผ่อนที่ดี', 'Below usual — often goes with good rest'), collecting: T('กำลังสะสมข้อมูลเปรียบเทียบ', 'Building your baseline') },
    source: 'Personal baseline: mean ± max(SD, 2 bpm) of the prior 14 days (≥ 3 days).' },
  { kind: 'personal', id: 'personal.spo2', metric: 'spo2_avg_pct', title: T('SpO₂', 'SpO₂'), unit: '%', windowDays: 14, minDays: 3, floor: 0.7, better: 'higher',
    text: { within: T('อยู่ในช่วงปกติของคุณ', 'Within your usual range'), above: T('สูงกว่าช่วงของคุณเล็กน้อย', 'Slightly above your range'), below: T('ต่ำกว่าช่วงของคุณ — คืนเดียวบอกอะไรไม่ได้มาก ถ้าต่ำต่อเนื่องหลายคืนค่อยสังเกต', 'Below your range — one night says little; watch it only if it stays low for several nights'), collecting: T('กำลังสะสมข้อมูลเปรียบเทียบ', 'Building your baseline') },
    source: 'Personal baseline: mean ± max(SD, 0.7 %) of the prior 14 days (≥ 3 days).' },
  { kind: 'personal', id: 'personal.rr', metric: 'respiratory_rate_bpm', title: T('อัตราหายใจ', 'Breathing rate'), unit: '/min', windowDays: 14, minDays: 3, floor: 0.5, better: 'neutral',
    text: { within: T('อยู่ในช่วงปกติของคุณ', 'Within your usual range'), above: T('สูงกว่าปกติ — มักพบเมื่อเริ่มไม่สบาย เครียด หรือนอนในห้องร้อน', 'Above usual — common when getting ill, stressed, or sleeping in a warm room'), below: T('ต่ำกว่าปกติเล็กน้อย', 'Slightly below usual'), collecting: T('กำลังสะสมข้อมูลเปรียบเทียบ', 'Building your baseline') },
    source: 'Personal baseline: mean ± max(SD, 0.5 /min) of the prior 14 days (≥ 3 days).' },
  { kind: 'personal', id: 'personal.sleeping_hr', metric: 'sleeping_hr_bpm', title: T('HR ขณะหลับ', 'Sleeping HR'), unit: 'bpm', windowDays: 14, minDays: 3, floor: 2, better: 'lower',
    text: { within: T('อยู่ในช่วงปกติของคุณ', 'Within your usual range'), above: T('สูงกว่าปกติ — มักพบหลังดื่ม มื้อดึก หรือออกกำลังหนักช่วงเย็น', 'Above usual — common after alcohol, a late meal, or a hard evening workout'), below: T('ต่ำกว่าปกติ — มักสัมพันธ์กับการพักผ่อนที่ดี', 'Below usual — often goes with good rest'), collecting: T('กำลังสะสมข้อมูลเปรียบเทียบ', 'Building your baseline') },
    source: 'Personal baseline: mean ± max(SD, 2 bpm) of the prior 14 days (≥ 3 days). Distinct from Google’s daily resting HR.' },
  // ---------- goals (user-set) ----------
  { kind: 'goal', id: 'goal.sleep', metric: 'sleep_minutes_asleep', title: T('เป้าหมายเวลานอน', 'Sleep goal'), unit: 'min', profileField: 'goal_sleep_min', direction: 'atLeast', source: 'Set by you in Settings → Your coach' },
  { kind: 'goal', id: 'goal.steps', metric: 'steps', title: T('เป้าหมายก้าว', 'Step goal'), unit: 'steps', profileField: 'goal_steps', direction: 'atLeast', source: 'Set by you in Settings → Your coach' },
  { kind: 'goal', id: 'goal.azm_week', metric: 'azm_week', title: T('เป้าหมายนาทีในโซนหัวใจ/สัปดาห์', 'Weekly zone-minute goal'), unit: 'min', profileField: 'goal_azm_week', direction: 'atLeast', source: 'Set by you in Settings → Your coach' },
];

/* ---------------- evaluation ---------------- */

export interface Check {
  id: string; kind: Rule['kind']; metric: string; level: Level; value: number | null; unit: string; title: I18nText; text: I18nText;
  band?: { lo: number; hi: number; n?: number };     // personal range, or the reference band the value fell into
  good?: { lo: number | null; hi: number | null };   // reference rules: bounds of the 'good' band (for drawing the target range)
  target?: number; progress?: number;                // goals
  source: string; version: string;
}

/** value lookup for a given day; `null` = missing */
export type Lookup = (day: string, metric: string) => number | null;
export interface GoalValues { goal_sleep_min: number | null; goal_steps: number | null; goal_azm_week: number | null }

export function derivedValue(day: string, metric: string, get: Lookup, days: string[]): number | null {
  if (metric === 'azm_week') {
    const idx = days.indexOf(day); if (idx < 0) return null;
    const window = days.slice(Math.max(0, idx - 6), idx + 1).filter((d) => daysBetween(d, day) <= 6);
    const vals = window.map((d) => get(d, 'active_zone_minutes')).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  }
  if (metric.startsWith('sleep_') && metric.endsWith('_pct') && metric !== 'sleep_efficiency_pct') {
    const deep = get(day, 'sleep_deep_minutes'), rem = get(day, 'sleep_rem_minutes'), light = get(day, 'sleep_light_minutes');
    if (deep === null || rem === null || light === null || deep + rem + light <= 0) return null;
    const part = metric === 'sleep_deep_pct' ? deep : metric === 'sleep_rem_pct' ? rem : light;
    return (part / (deep + rem + light)) * 100;
  }
  return get(day, metric);
}

function daysBetween(a: string, b: string) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000); }

export function evaluateDay(day: string, days: string[], get: Lookup, goals: GoalValues): Check[] {
  const out: Check[] = [];
  const val = (metric: string) => derivedValue(day, metric, get, days);
  for (const r of RULES) {
    if (r.kind === 'reference') {
      const v = val(r.metric); if (v === null) continue;
      const b = r.bands.find((x) => (x.min === undefined || v >= x.min) && (x.max === undefined || v < x.max));
      if (!b) continue;
      const g = r.bands.find((x) => x.level === 'good');
      out.push({ id: r.id, kind: r.kind, metric: r.metric, level: b.level, value: v, unit: r.unit, title: r.title, text: b.text, band: { lo: b.min ?? Number.NEGATIVE_INFINITY, hi: b.max ?? Number.POSITIVE_INFINITY }, good: g ? { lo: g.min ?? null, hi: g.max ?? null } : undefined, source: r.source, version: RULES_VERSION });
    } else if (r.kind === 'personal') {
      const v = get(day, r.metric); if (v === null) continue;
      const prior = days.filter((d) => d < day).slice(-r.windowDays).map((d) => get(d, r.metric)).filter((x): x is number => x !== null);
      if (prior.length < r.minDays) { out.push({ id: r.id, kind: r.kind, metric: r.metric, level: 'na', value: v, unit: r.unit, title: r.title, text: r.text.collecting, band: { lo: NaN, hi: NaN, n: prior.length }, source: r.source, version: RULES_VERSION }); continue; }
      const mu = prior.reduce((a, b) => a + b, 0) / prior.length, sd = Math.sqrt(prior.reduce((a, x) => a + (x - mu) ** 2, 0) / prior.length), w = Math.max(sd, r.floor);
      const lo = mu - w, hi = mu + w;
      const pos: 'within' | 'above' | 'below' = v > hi ? 'above' : v < lo ? 'below' : 'within';
      const level: Level = pos === 'within' ? 'good' : r.better === 'neutral' ? 'note' : (pos === 'above') === (r.better === 'higher') ? 'good' : 'fair';
      out.push({ id: r.id, kind: r.kind, metric: r.metric, level: pos === 'within' ? 'good' : level, value: v, unit: r.unit, title: r.title, text: r.text[pos], band: { lo, hi, n: prior.length }, source: r.source, version: RULES_VERSION });
    } else {
      const target = goals[r.profileField]; if (!target) continue;
      const v = val(r.metric); if (v === null) continue;
      const progress = Math.min(1, v / target);
      const met = v >= target;
      const text: I18nText = met
        ? { th: `ถึงเป้าหมายที่ตั้งไว้ (${fmtGoal(target, r.unit, 'th')})`, en: `Goal met (${fmtGoal(target, r.unit, 'en')})` }
        : { th: `ยังไม่ถึงเป้า ${fmtGoal(target, r.unit, 'th')} — ขาดอีก ${fmtGoal(target - v, r.unit, 'th')}`, en: `Short of the ${fmtGoal(target, r.unit, 'en')} goal by ${fmtGoal(target - v, r.unit, 'en')}` };
      out.push({ id: r.id, kind: r.kind, metric: r.metric, level: met ? 'good' : progress >= 0.8 ? 'fair' : 'low', value: v, unit: r.unit, title: r.title, text, target, progress, source: r.source, version: RULES_VERSION });
    }
  }
  return out;
}

function fmtGoal(v: number, unit: string, lang: 'th' | 'en') {
  if (unit === 'min' && v >= 60) { const h = Math.floor(v / 60), m = Math.round(v % 60); return lang === 'th' ? `${h} ชม.${m ? ` ${m} น.` : ''}` : `${h} h${m ? ` ${m} m` : ''}`; }
  if (unit === 'min') return `${Math.round(v)} ${lang === 'th' ? 'นาที' : 'min'}`;
  if (unit === 'steps') return `${Math.round(v).toLocaleString('en-US')} ${lang === 'th' ? 'ก้าว' : 'steps'}`;
  return `${Math.round(v)} ${unit}`;
}

/** Public, serialisable description of the rule table (for the Data log page and docs). */
export function describeRules() {
  return RULES.map((r) => ({
    id: r.id, kind: r.kind, metric: r.metric, title: r.title, unit: r.unit, source: r.source, version: RULES_VERSION,
    bands: r.kind === 'reference' ? r.bands.map((b) => ({ level: b.level, min: b.min ?? null, max: b.max ?? null, text: b.text })) : undefined,
    personal: r.kind === 'personal' ? { windowDays: r.windowDays, minDays: r.minDays, floor: r.floor, better: r.better } : undefined,
    goal: r.kind === 'goal' ? { profileField: r.profileField, direction: r.direction } : undefined,
    note: r.kind === 'reference' ? r.note : undefined,
  }));
}
