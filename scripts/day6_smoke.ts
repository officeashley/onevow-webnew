import rows from "@/data/xentrix_kpi_mock_260.json";
import { buildAgentStats } from "@/lib/kpiEngine";
import { computeOverview } from "@/lib/kpi/index";

const agentStats = buildAgentStats(rows as any[]);
const overview = computeOverview(rows as any[], "week", agentStats);

console.log("[smoke:day6] OK", {
  problems: overview.problems?.length ?? 0,
  insights: overview.insights?.length ?? 0,
  tasks: overview.recommendTasks?.length ?? 0,
  sampleTask: overview.recommendTasks?.[0],
});
