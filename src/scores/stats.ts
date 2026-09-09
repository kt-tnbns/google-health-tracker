/** Small, dependency-free statistics helpers. All functions ignore null/NaN unless stated. */

export const clean = (xs: (number | null | undefined)[]): number[] => xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
export const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export function sd(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs)!;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}
export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), h = Math.floor(s.length / 2);
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}
/** Median absolute deviation scaled to be consistent with SD for normal data. */
export function madSd(xs: number[]): number | null {
  if (xs.length < 3) return null;
  const m = median(xs)!;
  const mad = median(xs.map((x) => Math.abs(x - m)))!;
  return mad * 1.4826;
}
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

/** Robust center/scale for a baseline window: median/MAD when >= 28 points, else mean/SD. */
export function baselineStats(xs: number[]): { center: number; scale: number; n: number; robust: boolean } | null {
  if (xs.length < 2) return null;
  // Scale floor: a perfectly flat baseline is real (e.g. SpO₂ 96,96,96); avoid divide-by-zero without inventing spread.
  const floor = (c: number) => Math.max(Math.abs(c) * 0.02, 1e-6);
  if (xs.length >= 28) {
    const c = median(xs)!, s = madSd(xs);
    if (s && s > 0) return { center: c, scale: s, n: xs.length, robust: true };
  }
  const c = mean(xs)!, s = sd(xs) ?? 0;
  return { center: c, scale: s > 0 ? s : floor(c), n: xs.length, robust: false };
}

/** EWMA with λ = 2/(N+1). Leading nulls stay null; once started, a missing day counts as zero load (documented choice). */
export function ewma(values: (number | null)[], n: number): (number | null)[] {
  const lambda = 2 / (n + 1);
  let prev: number | null = null;
  return values.map((v) => {
    if (prev === null) { if (v === null) return null; prev = v; return prev; }
    prev = lambda * (v ?? 0) + (1 - lambda) * prev;
    return prev;
  });
}

/** Hedges' g (small-sample corrected Cohen's d). Returns null when SDs are undefined. */
export function hedgesG(a: number[], b: number[]): number | null {
  if (a.length < 2 || b.length < 2) return null;
  const sa = sd(a)!, sb = sd(b)!;
  const sp = Math.sqrt(((a.length - 1) * sa ** 2 + (b.length - 1) * sb ** 2) / (a.length + b.length - 2));
  if (!sp) return null;
  const d = (mean(a)! - mean(b)!) / sp;
  const df = a.length + b.length - 2;
  const J = 1 - 3 / (4 * df - 1);
  return d * J;
}

/** Deterministic PRNG (mulberry32) so bootstrap results are reproducible. */
export function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Percentile bootstrap CI for mean(a) − mean(b). */
export function bootstrapDiffCI(a: number[], b: number[], B = 2000, seed = 42, level = 0.95): { lo: number; hi: number } | null {
  if (!a.length || !b.length) return null;
  const rand = rng(seed);
  const pick = (xs: number[]) => xs[Math.floor(rand() * xs.length)];
  const diffs = new Array<number>(B);
  for (let i = 0; i < B; i++) {
    let sa = 0, sb = 0;
    for (let j = 0; j < a.length; j++) sa += pick(a);
    for (let j = 0; j < b.length; j++) sb += pick(b);
    diffs[i] = sa / a.length - sb / b.length;
  }
  diffs.sort((x, y) => x - y);
  const q = (p: number) => diffs[Math.min(B - 1, Math.max(0, Math.floor(p * B)))];
  return { lo: q((1 - level) / 2), hi: q(1 - (1 - level) / 2) };
}

/** Two-sided Mann–Whitney U test p-value (normal approximation with tie correction). */
export function mannWhitneyP(a: number[], b: number[]): number | null {
  const n1 = a.length, n2 = b.length;
  if (n1 < 2 || n2 < 2) return null;
  const all = [...a.map((v) => ({ v, g: 0 })), ...b.map((v) => ({ v, g: 1 }))].sort((x, y) => x.v - y.v);
  // average ranks with ties
  const ranks = new Array<number>(all.length);
  let i = 0, tieTerm = 0;
  while (i < all.length) {
    let j = i;
    while (j + 1 < all.length && all[j + 1].v === all[i].v) j++;
    const r = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) ranks[k] = r;
    const t = j - i + 1;
    if (t > 1) tieTerm += t ** 3 - t;
    i = j + 1;
  }
  let r1 = 0;
  all.forEach((x, k) => { if (x.g === 0) r1 += ranks[k]; });
  const U = r1 - (n1 * (n1 + 1)) / 2;
  const N = n1 + n2;
  const mu = (n1 * n2) / 2;
  const sigma = Math.sqrt(((n1 * n2) / 12) * (N + 1 - tieTerm / (N * (N - 1))));
  if (!sigma) return null;
  const z = (Math.abs(U - mu) - 0.5) / sigma;   // continuity correction
  return 2 * (1 - normCdf(z));
}

export function normCdf(z: number): number {
  // Abramowitz–Stegun 7.1.26
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
