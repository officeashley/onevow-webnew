export type CleanedRow = Record<string, any>;

export type CsatBuckets = {
  "90-100": number;
  "80-89": number;
  "0-79": number;
  unknown: number;
};

export type CsatResult = {
  avgCsat: number | null;
  countRated: number;   // 数値CSATとして評価対象になった件数
  countTotal: number;   // rows.length
  buckets: CsatBuckets;
  nullRate: number;     // (countTotal - countRated) / countTotal
  flags: string[];      // 例: ["CSAT_MANY_NULLS"]
};

export type AhtResult = {
  avgAht: number | null;
  medianAht: number | null;
  p90Aht: number | null;
  countValid: number;
  countTotal: number;
  nullRate: number;
  flags: string[];      // 例: ["AHT_MANY_NULLS"]
};

export type AgentKpis = {
  agentName: string;
  csat: CsatResult;
  aht: AhtResult;
  // Day3以降で FCR/SLA/Esc 追加していく
};

export type KpiSummary = {
  rowCount: number;
  avgCsat: number | null;
  avgAht: number | null;
  csatBuckets: CsatBuckets;
};

export type DailyKpi = {
  date: string; // ISO yyyy-mm-dd
  avgCsat: number | null;
  avgAht: number | null;
  count: number;
};
