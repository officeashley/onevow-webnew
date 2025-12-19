// xentrix/lib/kpiEngine.ts

// ---- 型定義 ----
export type CleanedRow = {
  Date: string;
  AgentName: string;
  CallsHandled: number;
  AvgHandleTimeSeconds: number;
  CSAT: number;
  Adherence: number;
  Compliance: number;
  Call_Type: string;
  Issue_Type: string;
  Resolution_Status: string;
};

// UIで使うCSAT分布（mapで回せる配列）
export type CsatBucketRow = {
  label: string;
  count: number;
};

// 全体サマリー（Dashboardが参照しているキーに揃える）
export type Overview = {
  totalRecords: number;          // = rows.length
  totalCalls: number;            // CallsHandled合計
  avgAht: number | null;         // AvgHandleTimeSeconds平均
  avgCsat: number | null;        // CSAT平均
  serviceLevel: number | null;   // MVP: AHT <= 300 の比率（%）
};

// エージェント別集計（Dashboardが参照しているキーに揃える）
export type AgentStat = {
  agentName: string;
  records: number;       // = そのagentの行数
  totalCalls: number;    // CallsHandled合計
  avgAht: number | null;
  avgCsat: number | null;
};

// Top/Bottom抽出の返り値
export type AhtRanking = {
  topAgentsByAht: AgentStat[];      // AHT短い順
  bottomAgentsByAht: AgentStat[];   // AHT長い順
};

// ---- ユーティリティ ----
function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  const v = nums.reduce((s, n) => s + n, 0) / nums.length;
  return Math.round(v * 10) / 10;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

// ---- 1) 全体サマリー ----
export function computeOverview(rows: CleanedRow[]): Overview {
  const totalRecords = rows.length;

  const totalCalls = rows.reduce((s, r) => s + (isNumber(r.CallsHandled) ? r.CallsHandled : 0), 0);

  const ahtList = rows
    .map((r) => r.AvgHandleTimeSeconds)
    .filter(isNumber);

  const csatList = rows
    .map((r) => r.CSAT)
    .filter(isNumber);

  const avgAht = avg(ahtList);
  const avgCsat = avg(csatList);

  // MVP定義：AHT <= 300 sec の割合（%）
  // ※AvgHandleTimeSeconds が number の行だけ母数に含める
  const ahtValidCount = ahtList.length;
  const ahtOkCount = ahtList.filter((v) => v <= 300).length;
  const serviceLevel =
    ahtValidCount > 0 ? round1((ahtOkCount / ahtValidCount) * 100) : null;

  return {
    totalRecords,
    totalCalls,
    avgAht,
    avgCsat,
    serviceLevel,
  };
}

// ---- 2) エージェント別集計 ----
export function buildAgentStats(rows: CleanedRow[]): AgentStat[] {
  const map = new Map<string, CleanedRow[]>();

  for (const r of rows) {
    const key = r.AgentName || "Unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }

  const stats: AgentStat[] = [];

  for (const [agentName, list] of map.entries()) {
    const records = list.length;

    const totalCalls = list.reduce(
      (s, r) => s + (isNumber(r.CallsHandled) ? r.CallsHandled : 0),
      0
    );

    const ahtList = list
      .map((r) => r.AvgHandleTimeSeconds)
      .filter(isNumber);

    const csatList = list
      .map((r) => r.CSAT)
      .filter(isNumber);

    stats.push({
      agentName,
      records,
      totalCalls,
      avgAht: avg(ahtList),
      avgCsat: avg(csatList),
    });
  }

  // UIは「AHTランキング」を別で作るので、ここはcalls多い順のままでOK
  stats.sort((a, b) => b.totalCalls - a.totalCalls);

  return stats;
}

// ---- 3) AHT Top/Bottom抽出（少数データでも必ず出す） ----
// quantile=0.1 なら「上位/下位10%」だが、データが少ない場合は最低1件返す
export function calcAhtQuantiles(
  agentStats: AgentStat[],
  quantile = 0.1
): AhtRanking {
  const valid = agentStats
    .filter((a) => isNumber(a.avgAht))
    .sort((a, b) => (a.avgAht! - b.avgAht!)); // AHT短い順

  if (!valid.length) {
    return { topAgentsByAht: [], bottomAgentsByAht: [] };
  }

  const n = valid.length;
  const k = Math.max(1, Math.floor(n * quantile)); // 最低1件

  const topAgentsByAht = valid.slice(0, k);       // AHT短い = 良い
  const bottomAgentsByAht = valid.slice(-k);      // AHT長い = 悪い

  return { topAgentsByAht, bottomAgentsByAht };
}

// ---- 4) CSAT分布（UIでmapできる配列にする） ----
export function computeCsatBuckets(rows: CleanedRow[]): CsatBucketRow[] {
  let high = 0; // 90+
  let mid = 0;  // 80-89
  let low = 0;  // <=79

  for (const r of rows) {
    const v = r.CSAT;
    if (!isNumber(v)) continue;

    if (v >= 90) high++;
    else if (v >= 80) mid++;
    else low++;
  }

  return [
    { label: "90–100", count: high },
    { label: "80–89", count: mid },
    { label: "0–79", count: low },
  ];
}
// ---- 5. 日次KPI（時系列） ----
export type DailyKpi = {
  date: string; // "YYYY-MM-DD"
  avgCsat: number | null;
  avgAht: number | null;
  serviceLevel: number | null; // AHT <= 300 の比率(%)
  totalCalls: number;
  rowCount: number;
};

function toYmd(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "Invalid";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function buildDailyKpis(rows: CleanedRow[]): DailyKpi[] {
  const map = new Map<string, CleanedRow[]>();

  for (const r of rows) {
    const key = toYmd(r.Date);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }

  const out: DailyKpi[] = [];

  for (const [date, list] of map.entries()) {
    const ahtList = list
      .map((r) => r.AvgHandleTimeSeconds)
      .filter((v): v is number => typeof v === "number");

    const csatList = list
      .map((r) => r.CSAT)
      .filter((v): v is number => typeof v === "number");

    const totalCalls = list.reduce((s, r) => s + (r.CallsHandled ?? 0), 0);

    // Service Level: AHT <= 300 の比率（%）
    const validAht = ahtList.length;
    const within = ahtList.filter((v) => v <= 300).length;
    const serviceLevel =
      validAht > 0 ? Math.round((within / validAht) * 1000) / 10 : null;

    out.push({
      date,
      avgCsat: avg(csatList),
      avgAht: avg(ahtList),
      serviceLevel,
      totalCalls,
      rowCount: list.length,
    });
  }

  // 日付順でソート
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}
