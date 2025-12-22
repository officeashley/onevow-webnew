import mockRows from "../data/xentrix_kpi_mock_260.json";
import { computeSummary } from "../lib/kpi/index";

function assertInRangeOrNull(v: any, name: string) {
  if (v === null) return;
  console.assert(typeof v === "number", `${name} not number`);
  console.assert(v >= 0 && v <= 100, `${name} out of range`);
}

const rows = mockRows as any[];
const s = computeSummary(rows);

// SLA
console.assert("slaStatus" in s, "missing slaStatus");
console.assert(s.slaStatus === "ok" || s.slaStatus === "missing_columns", "invalid slaStatus");
assertInRangeOrNull(s.slaRate, "slaRate");

// Escalation
console.assert("escalationStatus" in s, "missing escalationStatus");
console.assert(s.escalationStatus === "ok" || s.escalationStatus === "missing_columns", "invalid escalationStatus");
assertInRangeOrNull(s.escalationRate, "escalationRate");

console.log("[smoke:day4] OK", {
  slaStatus: s.slaStatus,
  slaRate: s.slaRate,
  slaEligible: s.slaEligibleCount,
  escStatus: s.escalationStatus,
  escRate: s.escalationRate,
  esc: s.escalationCount,
  eligible: s.escalationEligibleCount,
});
