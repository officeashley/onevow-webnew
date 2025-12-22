// lib/kpi/types.ts
export type InsightLevel = "info" | "warn" | "critical";
export type OwnerType = "center" | "supervisor" | "agent";
export type RangeKey = "today" | "week" | "month";

export type MetricKey =
  | "AHT"
  | "CSAT"
  | "FCR"
  | "ESCALATION"
  | "SLA"
  | "UNKNOWN_FCR";

export type InsightV1 = {
  id: string;
  level: InsightLevel;
  title: string;
  why: string; // 根拠（人が読める文章）
  impact?: string; // 影響
  scope: "center" | "agent" | "team";
  who: "center" | string; // agentName or "center"
  window: RangeKey;
  metrics?: Partial<Record<MetricKey, number | string | null>>;
};

export type RecommendTaskV1 = {
  id: string;
  priority: "P0" | "P1" | "P2";
  ownerType: OwnerType;
  owner: "center" | string; // agentName or "center"
  within: "24h" | "3d" | "7d" | "14d";
  duration: "15m" | "30m" | "60m" | "2h" | "1w";
  task: string; // やること（命令形）
  howMany?: number; // 例：レビュー件数
  evidence?: string; // なぜ？（短文）
};

export type AiOutputV1 = {
  problems: string[]; // 重要な問題の見出し（短文）
  insights: InsightV1[];
  recommendTasks: RecommendTaskV1[];
};
