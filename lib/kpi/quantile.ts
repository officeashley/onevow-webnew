// lib/kpi/quantile.ts

/** values の q 分位（0〜1）を返す。空なら null */
export function quantile(values: number[], q: number): number | null {
  if (!Array.isArray(values) || values.length === 0) return null;
  const qq = Math.min(1, Math.max(0, q));
  const xs = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;

  // linear interpolation
  const pos = (xs.length - 1) * qq;
  const base = Math.floor(pos);
  const rest = pos - base;

  if (xs[base + 1] === undefined) return xs[base];
  return xs[base] + rest * (xs[base + 1] - xs[base]);
}
