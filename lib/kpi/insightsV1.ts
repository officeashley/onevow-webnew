// lib/kpi/insightsV1.ts
import { AiOutputV1, RangeKey } from "@/lib/kpi/types";

type SummaryLike = {
  avgAht?: number | null; // sec
  avgCsat?: number | null; // %
  fcrRate?: number | null; // %
  fcrUnknownCount?: number;
  rowCount?: number;

  escalationRate?: number | null;

  // 追加していく余地
};

type AgentStatLike = {
  agentName: string;
  totalCalls: number;
  avgAht: number | null; // sec
  avgCsat: number | null; // %
  fcrRate: number | null; // %
  fcrUnknownCount?: number;
};

type Params = {
  window: RangeKey;
  summary: SummaryLike;
  agentStats: AgentStatLike[];

  // v1の固定ルール（後で設定化）
  ahtTargetSec?: number; // 例 600 (=10分)
  ahtTooLowSec?: number; // 例 300
  ahtTooHighSec?: number; // 例 900
  minSample?: number; // 例 30
};

function id(prefix: string, seed: string) {
  return `${prefix}_${seed}`.replace(/\s+/g, "_");
}

export function buildInsightsV1(params: Params): AiOutputV1 {
  const {
    window,
    summary,
    agentStats,
    ahtTargetSec = 600,
    ahtTooLowSec = 300,
    ahtTooHighSec = 900,
    minSample = 30,
  } = params;

  const problems: string[] = [];
  const insights: AiOutputV1["insights"] = [];
  const recommendTasks: AiOutputV1["recommendTasks"] = [];

  const eligibleAgents = (agentStats ?? []).filter((a) => a.totalCalls >= minSample);

  // ---------- Center-wide quick checks ----------
  if (summary.avgCsat !== null && summary.avgCsat !== undefined && summary.avgCsat < 85) {
    problems.push("CSATが目標未達の可能性");
    insights.push({
      id: id("ins", `center_csat_low_${window}`),
      level: summary.avgCsat < 80 ? "critical" : "warn",
      title: "CSATが低い（センター）",
      why: `平均CSATが ${summary.avgCsat}% で、目標(85%)を下回っています。`,
      impact: "顧客満足の低下は再問い合わせや解約リスクに直結します。",
      scope: "center",
      who: "center",
      window,
      metrics: { CSAT: summary.avgCsat },
    });

    recommendTasks.push({
      id: id("task", `center_csat_review_${window}`),
      priority: "P0",
      ownerType: "supervisor",
      owner: "center",
      within: "3d",
      duration: "60m",
      task: "CSAT低評価コールを10件リスニングし、共通原因を3つに要約する",
      howMany: 10,
      evidence: "CSATが目標未達のため（原因特定が最短）",
    });
  }

  if (summary.fcrRate !== null && summary.fcrRate !== undefined && summary.fcrRate < 80) {
    problems.push("FCRが低い可能性");
    insights.push({
      id: id("ins", `center_fcr_low_${window}`),
      level: summary.fcrRate < 70 ? "critical" : "warn",
      title: "FCRが低い（センター）",
      why: `FCRが ${summary.fcrRate}% です（再問い合わせが増える可能性）。`,
      impact: "再入電が増えるとAHT・コスト・CSATに連鎖します。",
      scope: "center",
      who: "center",
      window,
      metrics: { FCR: summary.fcrRate },
    });

    recommendTasks.push({
      id: id("task", `center_fcr_checklist_${window}`),
      priority: "P0",
      ownerType: "center",
      owner: "center",
      within: "7d",
      duration: "2h",
      task: "一次解決チェックリスト（確認項目）をv1で作成し、運用に組み込む",
      evidence: "FCRが低いと再入電が増えるため",
    });
  }

  // ---------- Agent-level AHT Too Low / Too High ----------
  const tooLow = eligibleAgents.filter((a) => a.avgAht !== null && a.avgAht < ahtTooLowSec);
  const tooHigh = eligibleAgents.filter((a) => a.avgAht !== null && a.avgAht > ahtTooHighSec);

  for (const a of tooLow) {
    problems.push(`AHTが短すぎる可能性: ${a.agentName}`);

    insights.push({
      id: id("ins", `aht_too_low_${a.agentName}_${window}`),
      level: "warn",
      title: "AHTが短すぎる（品質リスク）",
      why: `${a.agentName} の平均AHTが ${Math.round(a.avgAht!)}s で、下限 ${ahtTooLowSec}s を下回っています（早すぎる処理/確認漏れの可能性）。`,
      impact: "確認不足は誤案内・再入電・CSAT低下につながります。",
      scope: "agent",
      who: a.agentName,
      window,
      metrics: { AHT: a.avgAht, CSAT: a.avgCsat, FCR: a.fcrRate },
    });

    recommendTasks.push({
      id: id("task", `listen_too_low_${a.agentName}_${window}`),
      priority: "P0",
      ownerType: "supervisor",
      owner: a.agentName,
      within: "3d",
      duration: "30m",
      task: "直近コールを3件リスニングし、確認項目の抜け（本人確認/要件確認/復唱/次アクション）をチェックする",
      howMany: 3,
      evidence: "AHTが短すぎるため（品質劣化の疑い）",
    });

    recommendTasks.push({
      id: id("task", `knowledge_speed_${a.agentName}_${window}`),
      priority: "P1",
      ownerType: "agent",
      owner: a.agentName,
      within: "7d",
      duration: "60m",
      task: "ナレッジ検索の手順を復習し、よく使う記事をブックマーク（またはショートカット化）する",
      evidence: "短時間処理が“知識不足の省略”か“熟達”かを切り分けるため",
    });
  }

  for (const a of tooHigh) {
    problems.push(`AHTが長すぎる可能性: ${a.agentName}`);

    insights.push({
      id: id("ins", `aht_too_high_${a.agentName}_${window}`),
      level: "warn",
      title: "AHTが長すぎる（効率リスク）",
      why: `${a.agentName} の平均AHTが ${Math.round(a.avgAht!)}s で、上限 ${ahtTooHighSec}s を上回っています（ナレッジ検索/保留/処理詰まりの可能性）。`,
      impact: "生産性低下・待ち時間増加はCSAT悪化につながります。",
      scope: "agent",
      who: a.agentName,
      window,
      metrics: { AHT: a.avgAht, CSAT: a.avgCsat, FCR: a.fcrRate },
    });

    recommendTasks.push({
      id: id("task", `coach_too_high_${a.agentName}_${window}`),
      priority: "P0",
      ownerType: "supervisor",
      owner: a.agentName,
      within: "7d",
      duration: "60m",
      task: "コールを2件リスニングし、時間が延びる箇所（検索/保留/説明/処理）を特定して改善案を1つ決める",
      howMany: 2,
      evidence: "AHTが上限を超えているため（詰まり点の特定が先）",
    });
  }

  // 何も出ない時の保険
  if (insights.length === 0) {
    insights.push({
      id: id("ins", `no_findings_${window}`),
      level: "info",
      title: "大きな異常は検出されませんでした（v1）",
      why: "現在のルール条件に該当する項目がありません。",
      scope: "center",
      who: "center",
      window,
    });
  }

  return {
    problems: Array.from(new Set(problems)).slice(0, 8),
    insights,
    recommendTasks,
  };
}
