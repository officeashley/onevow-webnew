import { CleanedRow, CsatBuckets, CsatResult } from "./types";
import { normalizeNumber, toNullIfNullLike } from "./normalize";

function emptyBuckets(): CsatBuckets {
  return { "90-100": 0, "80-89": 0, "0-79": 0, unknown: 0 };
}

export function computeCsat(rows: CleanedRow[]): CsatResult {
  const total = rows.length;
  const buckets = emptyBuckets();

  const values: number[] = [];

  for (const r of rows) {
    const v = normalizeNumber(toNullIfNullLike(r.CSAT));
    if (v === null) {
      buckets.unknown += 1;
      continue;
    }
    // CSATが 0-100 以外はunknownに寄せる（v1安全運転）
    if (v < 0 || v > 100) {
      buckets.unknown += 1;
      continue;
    }
    values.push(v);

    if (v >= 90) buckets["90-100"] += 1;
    else if (v >= 80) buckets["80-89"] += 1;
    else buckets["0-79"] += 1;
  }

  const countRated = values.length;
  const avgCsat =
    countRated > 0
      ? Math.round((values.reduce((a, b) => a + b, 0) / countRated) * 10) / 10
      : null;

  const nullRate = total > 0 ? (total - countRated) / total : 0;

  const flags: string[] = [];
  // 閾値は仮でOK（Day3の改善ロジックで調整していく）
  if (total >= 10 && nullRate >= 0.3) flags.push("CSAT_MANY_NULLS");

  return {
    avgCsat,
    countRated,
    countTotal: total,
    buckets,
    nullRate,
    flags,
  };
}
