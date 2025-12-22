// lib/kpiEngine.ts
import { pickTopBottomByQuantile } from "@/lib/kpi/rank";
export type CleanedRow = {
  Date: string; // YYYY-MM-DD 想定（ISOでもOK）
  [key: string]: any;
};

export type AgentStat = {
  agentName: string;

  rowCount: number;
  totalCalls: number;

  avgCsat: number | null; // 0-100
  avgAht: number | null; // seconds

  // Day3: FCR(v1) — ✅B案：agentStats に内包
  fcrRate: number | null; // 0-100, null if eligible=0
  fcrEligibleCount: number;
  fcrResolvedCount: number;
  fcrUnknownCount: number;
};

export type CsatBucket = { label: string; count: number };
export type DailyKpi = {
  date: string;
  rowCount: number;
  avgCsat: number | null;
  avgAht: number | null;
};

function num(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pick(obj: any, keys: string[]): any {
  for (const k of keys) {
    if (obj && obj[k] !== undefined) return obj[k];
  }
  return undefined;
}

function normalizeStatus(v: any): "resolved" | "not_resolved" | "unknown" {
  if (v === null || v === undefined) return "unknown";
  const s = String(v).trim().toLowerCase();
  if (!s) return "unknown";

  // ✅ resolved寄せ（揺れ吸収）
  if (
    s === "resolved" ||
    s === "solved" ||
    s === "complete" ||
    s === "completed" ||
    s === "done" ||
    s === "closed"
  ) {
    return "resolved";
  }

  // ✅ not resolved寄せ（暫定）
  if (
    s === "open" ||
    s === "pending" ||
    s === "in progress" ||
    s === "escalated" ||
    s === "transferred" ||
    s === "unresolved" ||
    s === "transfer to l2" ||
    s === "escalation"
  ) {
    return "not_resolved";
  }

  // それ以外は unknown（率を壊さない）
  return "unknown";
}

/* ------------------------------
   Agent Stats（Day2 + Day3）
-------------------------------- */
export function buildAgentStats(rows: CleanedRow[]): AgentStat[] {
  const safeRows = Array.isArray(rows) ? rows : [];

  const agg = new Map<
    string,
    {
      rowCount: number;
      totalCalls: number;
      csatVals: number[];
      ahtVals: number[];
      fcrEligibleCount: number;
      fcrResolvedCount: number;
      fcrUnknownCount: number;
    }
  >();

  for (const r of safeRows) {
    const agent =
      pick(r, ["Agent", "AgentName", "agentName", "agent", "owner", "assignee"]) ?? "Unknown";
    const agentName = String(agent);

    if (!agg.has(agentName)) {
      agg.set(agentName, {
        rowCount: 0,
        totalCalls: 0,
        csatVals: [],
        ahtVals: [],
        fcrEligibleCount: 0,
        fcrResolvedCount: 0,
        fcrUnknownCount: 0,
      });
    }

    const a = agg.get(agentName)!;

    a.rowCount += 1;
    // v1: totalCalls は rowCount と同一扱い（将来 CallCount 列へ差し替え可能）
    a.totalCalls += 1;

    // CSAT
    const csatRaw = pick(r, ["CSAT", "csat", "Csat", "csat_score", "csatScore"]);
    const csat = num(csatRaw);
    if (csat !== null) a.csatVals.push(csat);

    // AHT
    const ahtRaw = pick(r, ["AHT", "aht", "Aht", "aht_sec", "ahtSec", "handle_time_sec"]);
    const aht = num(ahtRaw);
    if (aht !== null) a.ahtVals.push(aht);

    // ✅ FCR(v1): Resolution_Status から判定
    const rsRaw = pick(r, [
      "Resolution_Status",
      "resolution_status",
      "resolutionStatus",
      "status",
      "Status",
    ]);

    const cls = normalizeStatus(rsRaw);
    if (cls === "unknown") {
      a.fcrUnknownCount += 1;
    } else {
      a.fcrEligibleCount += 1;
      if (cls === "resolved") a.fcrResolvedCount += 1;
    }
  }

  const out: AgentStat[] = [];
  for (const [agentName, v] of agg.entries()) {
    const avgCsat =
      v.csatVals.length > 0
        ? Math.round((v.csatVals.reduce((x, y) => x + y, 0) / v.csatVals.length) * 10) / 10
        : null;

    const avgAht =
      v.ahtVals.length > 0
        ? Math.round((v.ahtVals.reduce((x, y) => x + y, 0) / v.ahtVals.length) * 10) / 10
        : null;

    const fcrRate =
      v.fcrEligibleCount > 0
        ? Math.round(((v.fcrResolvedCount / v.fcrEligibleCount) * 100) * 10) / 10
        : null;

    out.push({
      agentName,
      rowCount: v.rowCount,
      totalCalls: v.totalCalls,
      avgCsat,
      avgAht,
      fcrRate,
      fcrEligibleCount: v.fcrEligibleCount,
      fcrResolvedCount: v.fcrResolvedCount,
      fcrUnknownCount: v.fcrUnknownCount,
    });
  }

  // 表示の安定：AHT昇順、nullは最後
  out.sort((a, b) => {
    const av = a.avgAht;
    const bv = b.avgAht;
    if (av === null && bv === null) return a.agentName.localeCompare(b.agentName);
    if (av === null) return 1;
    if (bv === null) return -1;
    return av - bv;
  });

  return out;
}

/* ------------------------------
   Quantiles util（AHT Top/Bottom）
-------------------------------- */
// ...

export function calcAhtQuantiles(agentStats: AgentStat[], ratio = 0.33): {
  topAgentsByAht: AgentStat[];
  bottomAgentsByAht: AgentStat[];
} {
  const items = (agentStats ?? []).map((a) => ({
    id: a.agentName,
    value: a.avgAht,
    sample: a.totalCalls ?? a.rowCount ?? 0,
  }));

  const r = pickTopBottomByQuantile(items, {
    ratio,
    minItems: 2,
    minSample: 0, // AHTはとりあえず制限なし。Day5で calls>=30 を入れるならここを30に
    direction: "lower_is_better",
  });

  const map = new Map((agentStats ?? []).map((a) => [a.agentName, a]));
  return {
    topAgentsByAht: r.top.map((x) => map.get(x.id)!).filter(Boolean),
    bottomAgentsByAht: r.bottom.map((x) => map.get(x.id)!).filter(Boolean),
  };
}
export function calcCsatQuantiles(agentStats: AgentStat[], ratio = 0.1, minCalls = 30) {
  const items = (agentStats ?? []).map((a) => ({
    id: a.agentName,
    value: a.avgCsat,
    sample: a.totalCalls ?? a.rowCount ?? 0,
  }));

  const r = pickTopBottomByQuantile(items, {
    ratio,
    minItems: 2,
    minSample: minCalls,
    direction: "higher_is_better",
  });

  const map = new Map((agentStats ?? []).map((a) => [a.agentName, a]));
  return {
    best: r.top.map((x) => map.get(x.id)!).filter(Boolean),
    worst: r.bottom.map((x) => map.get(x.id)!).filter(Boolean),
    meta: r.meta,
  };
}

export function calcFcrQuantiles(agentStats: AgentStat[], ratio = 0.1, minCalls = 30) {
  const items = (agentStats ?? []).map((a) => ({
    id: a.agentName,
    value: (a as any).fcrRate ?? null,
    sample: a.totalCalls ?? a.rowCount ?? 0,
  }));

  const r = pickTopBottomByQuantile(items, {
    ratio,
    minItems: 2,
    minSample: minCalls,
    direction: "higher_is_better",
  });

  const map = new Map((agentStats ?? []).map((a) => [a.agentName, a]));
  return {
    best: r.top.map((x) => map.get(x.id)!).filter(Boolean),
    worst: r.bottom.map((x) => map.get(x.id)!).filter(Boolean),
    meta: r.meta,
  };
}


/* ------------------------------
   CSAT buckets（90-100 / 80-89 / 0-79）
-------------------------------- */
export function computeCsatBuckets(rows: CleanedRow[]): CsatBucket[] {
  const safeRows = Array.isArray(rows) ? rows : [];

  let b90 = 0;
  let b80 = 0;
  let b0 = 0;

  for (const r of safeRows) {
    const csatRaw = pick(r, ["CSAT", "csat", "Csat", "csat_score", "csatScore"]);
    const csat = num(csatRaw);
    if (csat === null) continue;

    if (csat >= 90) b90 += 1;
    else if (csat >= 80) b80 += 1;
    else b0 += 1;
  }

  return [
    { label: "90-100", count: b90 },
    { label: "80-89", count: b80 },
    { label: "0-79", count: b0 },
  ];
}

/* ------------------------------
   Daily KPIs（Trend用）
-------------------------------- */
export function buildDailyKpis(rows: CleanedRow[]): DailyKpi[] {
  const safeRows = Array.isArray(rows) ? rows : [];

  const map = new Map<
    string,
    { rowCount: number; csatVals: number[]; ahtVals: number[] }
  >();

  for (const r of safeRows) {
    const dateRaw = pick(r, ["Date", "date", "createdDate", "CreatedDate"]);
    if (!dateRaw) continue;

    const dateStr = String(dateRaw).slice(0, 10); // YYYY-MM-DD 寄せ
    if (!map.has(dateStr)) map.set(dateStr, { rowCount: 0, csatVals: [], ahtVals: [] });

    const v = map.get(dateStr)!;
    v.rowCount += 1;

    const csatRaw = pick(r, ["CSAT", "csat", "Csat", "csat_score", "csatScore"]);
    const csat = num(csatRaw);
    if (csat !== null) v.csatVals.push(csat);

    const ahtRaw = pick(r, ["AHT", "aht", "Aht", "aht_sec", "ahtSec", "handle_time_sec"]);
    const aht = num(ahtRaw);
    if (aht !== null) v.ahtVals.push(aht);
  }

  const out: DailyKpi[] = [];
  for (const [date, v] of map.entries()) {
    const avgCsat =
      v.csatVals.length > 0
        ? Math.round((v.csatVals.reduce((a, b) => a + b, 0) / v.csatVals.length) * 10) / 10
        : null;

    const avgAht =
      v.ahtVals.length > 0
        ? Math.round((v.ahtVals.reduce((a, b) => a + b, 0) / v.ahtVals.length) * 10) / 10
        : null;

    out.push({ date, rowCount: v.rowCount, avgCsat, avgAht });
  }

  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}
