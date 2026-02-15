// lib/kpi/types.ts

export type InsightLevel = "info" | "warn" | "critical";
export type OwnerType = "center" | "supervisor" | "agent";
export type RangeKey = "today" | "week" | "month";

export type CleanedRow = {
  Date: string;
  [key: string]: any;
};

export type MetricKey =
  | "AHT"
  | "CSAT"
  | "FCR"
  | "ESCALATION"
  | "SLA"
  | "UNKNOWN_FCR";

/* =============================
   Insight
============================= */

export type InsightV1 = {
  id: string;
  level: InsightLevel;
  title: string;
  why: string;
  impact?: string;
  scope: "center" | "agent";
  who: "center" | string;
  window: RangeKey;
  metrics?: Partial<Record<MetricKey, number | string | null>>;
};

export type RecommendTaskV1 = {
  id: string;
  priority: "P0" | "P1" | "P2";
  ownerType: OwnerType;
  owner: "center" | string;
  within: "24h" | "3d" | "7d" | "14d";
  duration: "15m" | "30m" | "60m" | "90m" | "120m";
  task: string;
  howMany?: number;
  evidence?: string;
  outcome?: string;
  due?: "today" | "tomorrow" | "this_week";
};

export type AiOutputV1 = {
  problems: string[];
  insights: InsightV1[];
  recommendTasks: RecommendTaskV1[];
};

/* =============================
   AHT
============================= */

export type AhtResult = {
  avgAht: number | null;
  medianAht: number | null;
  p90Aht: number | null;
  countValid: number;

  countTotal: number;
  nullRate: number | null;
  flags: string[];
};

/* =============================
   CSAT
============================= */

export type CsatBuckets = {
  "90-100": number;
  "80-89": number;
  "0-79": number;
};

export type CsatResult = {
  avgCsat: number | null;
  responseCount: number;
  buckets: CsatBuckets;
};

/* =============================
   Summary（全部許可型）
============================= */

export type Summary = {
  rowCount: number;
  totalCalls: number;

  avgCsat: number | null;
  avgAht: number | null;

  // AHT
  medianAht?: number | null;
  p90Aht?: number | null;
  countValid?: number;
  countTotal?: number;
  nullRate?: number;
  flags?: string[];

  // FCR
  fcrRate?: number | null;
  fcrEligibleCount?: number;
  fcrResolvedCount?: number;
  fcrUnknownCount?: number;
  fcrDefinition?: string;

  // SLA
  slaRate?: number | null;
  slaTarget?: number | null;
  slaEligibleCount?: number;
  slaMetCount?: number;
  slaUnknownCount?: number;
  slaStatus?: string;

  // 🔥 保険（これで将来止まらない）
  [key: string]: any;
};


