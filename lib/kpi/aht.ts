import { CleanedRow, AhtResult } from "./types";
import { normalizeNumber, toNullIfNullLike } from "./normalize";

function median(sorted: number[]): number | null {
  const n = sorted.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(sorted: number[], p: number): number | null {
  // p: 0-1
  const n = sorted.length;
  if (n === 0) return null;
  const idx = Math.ceil(p * n) - 1;
  const safe = Math.min(Math.max(idx, 0), n - 1);
  return sorted[safe];
}

export function computeAht(rows: CleanedRow[]): AhtResult {
  const total = rows.length;
  const values: number[] = [];

  for (const r of rows) {
    const v = normalizeNumber(toNullIfNullLike(r.AvgHandleTimeSeconds));
    if (v === null) continue;
    if (v < 0) continue;
    values.push(v);
  }

  values.sort((a, b) => a - b);

  const countValid = values.length;
  const avgAht =
    countValid > 0
      ? Math.round((values.reduce((a, b) => a + b, 0) / countValid) * 10) / 10
      : null;

  const medianAht =
    countValid > 0 ? Math.round((median(values) as number) * 10) / 10 : null;

  const p90Aht =
    countValid > 0
      ? Math.round(((percentile(values, 0.9) as number) ?? 0) * 10) / 10
      : null;

  const nullRate = total > 0 ? (total - countValid) / total : 0;

  const flags: string[] = [];
  if (total >= 10 && nullRate >= 0.3) flags.push("AHT_MANY_NULLS");

  return {
    avgAht,
    medianAht,
    p90Aht,
    countValid,
    countTotal: total,
    nullRate,
    flags,
  };
}
