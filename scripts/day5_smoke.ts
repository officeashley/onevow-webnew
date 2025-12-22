import rows from "@/data/xentrix_kpi_mock_260.json";
import { buildAgentStats, calcCsatQuantiles, calcFcrQuantiles } from "@/lib/kpiEngine";

const agentStats = buildAgentStats(rows as any[]);

const csat = calcCsatQuantiles(agentStats, 0.1, 30);
const fcr = calcFcrQuantiles(agentStats, 0.1, 30);

console.log("[smoke:day5] OK", {
  csat_best: csat.best.map((a) => ({ name: a.agentName, csat: a.avgCsat, calls: a.totalCalls })),
  csat_worst: csat.worst.map((a) => ({ name: a.agentName, csat: a.avgCsat, calls: a.totalCalls })),
  fcr_best: fcr.best.map((a) => ({ name: a.agentName, fcr: (a as any).fcrRate, calls: a.totalCalls })),
  fcr_worst: fcr.worst.map((a) => ({ name: a.agentName, fcr: (a as any).fcrRate, calls: a.totalCalls })),
  meta: { csat: csat.meta, fcr: fcr.meta },
});
