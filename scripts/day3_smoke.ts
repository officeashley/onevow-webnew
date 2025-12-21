import mockRows from "../data/xentrix_kpi_mock_260.json";
import { computeSummary } from "../lib/kpi/index";

function must(cond: any, msg: string) {
  if (!cond) throw new Error(msg);
}

const rows = mockRows as any[];
const s: any = computeSummary(rows);

// 1) フィールドが存在すること
must("fcrRate" in s, "missing fcrRate");
must("fcrEligibleCount" in s, "missing fcrEligibleCount");
must("fcrUnknownCount" in s, "missing fcrUnknownCount");
must("fcrDefinition" in s, "missing fcrDefinition");

// 2) count が壊れてない
must(typeof s.fcrEligibleCount === "number" && s.fcrEligibleCount >= 0, "invalid fcrEligibleCount");
must(typeof s.fcrUnknownCount === "number" && s.fcrUnknownCount >= 0, "invalid fcrUnknownCount");

// 3) fcrRate が null か 0-100
must(
  s.fcrRate === null || (typeof s.fcrRate === "number" && s.fcrRate >= 0 && s.fcrRate <= 100),
  "fcrRate out of range"
);

console.log("[smoke:day3] OK", {
  fcrRate: s.fcrRate,
  eligible: s.fcrEligibleCount,
  unknown: s.fcrUnknownCount,
  def: s.fcrDefinition,
});
