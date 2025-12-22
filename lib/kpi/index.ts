// lib/kpi/index.ts

export type Summary = {
  rowCount: number;
  totalCalls: number;

  avgCsat: number | null; // 0-100
  avgAht: number | null; // seconds

  // Day3: FCR(v1)
  fcrRate: number | null; // 0-100, null if eligible=0
  fcrEligibleCount: number; // 判定できた件数（Resolved/NotResolved）
  fcrResolvedCount: number; // Resolved件数
  fcrUnknownCount: number; // 判定不能件数（Resolution_Status無 or 想定外値）
  fcrDefinition: string; // UIで表示/デバッグ用

  // Day4: SLA(v1)
  slaRate: number | null; // 0-100, null if eligible=0 or missing columns
  slaEligibleCount: number;
  slaMetCount: number;
  slaUnknownCount: number;
  slaStatus: "ok" | "missing_columns";
  slaDefinition: string;

  // Day4: Escalation(v1)
  escalationRate: number | null; // 0-100, null if eligible=0
  escalationEligibleCount: number;
  escalationCount: number;
  escalationUnknownCount: number;
  escalationStatus: "ok" | "missing_columns";
  escalationDefinition: string;
};

export type RangeKey = "today" | "week" | "month";

/** InsightsV1 が返す shape（ざっくり any で受ける） */
export type InsightItem = any;
export type RecommendTaskItem = any;

export type Overview = Summary & {
  range: RangeKey;
  problems: any[];
  insights: InsightItem[];
  recommendTasks: RecommendTaskItem[];
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

/** いろんな真偽値表現を吸収（true/false, 1/0, yes/no, y/n, within/ out など） */
function normalizeBool(v: any): boolean | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;

  if (
    s === "true" ||
    s === "t" ||
    s === "yes" ||
    s === "y" ||
    s === "1" ||
    s === "within" ||
    s === "met"
  )
    return true;
  if (
    s === "false" ||
    s === "f" ||
    s === "no" ||
    s === "n" ||
    s === "0" ||
    s === "out" ||
    s === "miss"
  )
    return false;

  return null;
}

function normalizeStatus(v: any): "resolved" | "not_resolved" | "unknown" {
  if (v === null || v === undefined) return "unknown";
  const s = String(v).trim().toLowerCase();
  if (!s) return "unknown";

  // Resolved寄せ
  if (
    s === "resolved" ||
    s === "solved" ||
    s === "complete" ||
    s === "completed" ||
    s === "done" ||
    s === "closed"
  )
    return "resolved";

  // Not resolved寄せ（暫定）
  if (
    s === "open" ||
    s === "pending" ||
    s === "in progress" ||
    s === "escalated" ||
    s === "transferred" ||
    s === "unresolved"
  )
    return "not_resolved";

  return "unknown";
}

/** Escalation判定（v1）：Resolution_Status に Transfer to L2 / Escalation を含む */
function isEscalationStatus(v: any): boolean | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;

  if (s.includes("transfer to l2")) return true;
  if (s.includes("escalation")) return true;
  if (s.includes("escalated")) return true;
  return false;
}

/** ✅ Summaryは “KPI集計だけ” に固定（引数は rows のみ） */
export function computeSummary(rows: any[]): Summary {
  const safeRows = Array.isArray(rows) ? rows : [];
  const rowCount = safeRows.length;
  const totalCalls = rowCount;

  const csatVals: number[] = [];
  const ahtVals: number[] = [];

  // Day3: FCR
  let fcrEligibleCount = 0;
  let fcrResolvedCount = 0;
  let fcrUnknownCount = 0;

  // Day4: SLA
  let slaEligibleCount = 0;
  let slaMetCount = 0;
  let slaUnknownCount = 0;
  let slaStatus: "ok" | "missing_columns" = "missing_columns";

  // Day4: Escalation
  let escalationEligibleCount = 0;
  let escalationCount = 0;
  let escalationUnknownCount = 0;
  let escalationStatus: "ok" | "missing_columns" = "missing_columns";

  const probe = safeRows[0] ?? {};
  const hasWithinSla = pick(probe, ["WithinSLA", "within_sla", "withinSla"]) !== undefined;
  const hasSlaPct = pick(probe, ["SLA", "sla", "ServiceLevel", "service_level", "serviceLevel"]) !== undefined;

  const hasResolution =
    pick(probe, ["Resolution_Status", "resolution_status", "resolutionStatus", "status", "Status"]) !== undefined;

  if (hasWithinSla || hasSlaPct) slaStatus = "ok";
  if (hasResolution) escalationStatus = "ok";

  const slaPctVals: number[] = [];

  for (const r of safeRows) {
    // CSAT
    const csatRaw = pick(r, ["CSAT", "csat", "Csat", "csat_score", "csatScore"]);
    const csat = num(csatRaw);
    if (csat !== null) csatVals.push(csat);
function parseSeconds(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;

  // number / numeric string
  const n = Number(v);
  if (Number.isFinite(n)) return n;

  // "mm:ss" or "hh:mm:ss"
  const s = String(v).trim();
  if (!s.includes(":")) return null;

  const parts = s.split(":").map((x) => x.trim());
  if (parts.some((p) => p === "" || Number.isNaN(Number(p)))) return null;

  if (parts.length === 2) {
    const mm = Number(parts[0]);
    const ss = Number(parts[1]);
    return mm * 60 + ss;
  }
  if (parts.length === 3) {
    const hh = Number(parts[0]);
    const mm = Number(parts[1]);
    const ss = Number(parts[2]);
    return hh * 3600 + mm * 60 + ss;
  }
  return null;
}

    // AHT
    // AHT（seconds）
const ahtRaw = pick(r, [
  "AHT",
  "aht",
  "Aht",
  "aht_sec",
  "ahtSec",
  "AHT_sec",
  "AHTSeconds",
  "aht_seconds",
  "handle_time_sec",
  "HandleTimeSec",
  "Handle_Time_Sec",
  "Handle Time (sec)",
  "Handle Time",
]);
const aht = parseSeconds(ahtRaw);

if (aht !== null) {
  ahtVals.push(aht);
} else {
  const aht2 = num(ahtRaw); // ← 名前を変える（またはこのfallback自体を消す）
  if (aht2 !== null) ahtVals.push(aht2);
}

    // Resolution_Status（FCR & Escalationの基礎）
    const rsRaw = pick(r, ["Resolution_Status", "resolution_status", "resolutionStatus", "status", "Status"]);

    // ---- Day3: FCR(v1)
    const cls = normalizeStatus(rsRaw);
    if (cls === "unknown") {
      fcrUnknownCount += 1;
    } else {
      fcrEligibleCount += 1;
      if (cls === "resolved") fcrResolvedCount += 1;
    }

    // ---- Day4: Escalation(v1)
    if (escalationStatus !== "missing_columns") {
      const esc = isEscalationStatus(rsRaw);
      if (esc === null) {
        escalationUnknownCount += 1;
      } else {
        escalationEligibleCount += 1;
        if (esc) escalationCount += 1;
      }
    }

    // ---- Day4: SLA(v1)
    if (slaStatus !== "missing_columns") {
      if (hasWithinSla) {
        const withinRaw = pick(r, ["WithinSLA", "within_sla", "withinSla"]);
        const within = normalizeBool(withinRaw);
        if (within === null) {
          slaUnknownCount += 1;
        } else {
          slaEligibleCount += 1;
          if (within) slaMetCount += 1;
        }
      } else {
        const pctRaw = pick(r, ["SLA", "sla", "ServiceLevel", "service_level", "serviceLevel"]);
        const pct = num(pctRaw);
        if (pct === null) {
          slaUnknownCount += 1;
        } else {
          slaPctVals.push(pct);
        }
      }
    }
  }

  const avgCsat =
    csatVals.length > 0
      ? Math.round((csatVals.reduce((a, b) => a + b, 0) / csatVals.length) * 10) / 10
      : null;

  const avgAht =
    ahtVals.length > 0
      ? Math.round((ahtVals.reduce((a, b) => a + b, 0) / ahtVals.length) * 10) / 10
      : null;

  const fcrRate =
    fcrEligibleCount > 0 ? Math.round(((fcrResolvedCount / fcrEligibleCount) * 100) * 10) / 10 : null;

  // SLA rate
  let slaRate: number | null = null;
  if (slaStatus === "missing_columns") {
    slaRate = null;
  } else if (hasWithinSla) {
    slaRate =
      slaEligibleCount > 0 ? Math.round(((slaMetCount / slaEligibleCount) * 100) * 10) / 10 : null;
  } else {
    slaRate =
      slaPctVals.length > 0
        ? Math.round((slaPctVals.reduce((a, b) => a + b, 0) / slaPctVals.length) * 10) / 10
        : null;

    slaEligibleCount = slaPctVals.length;
    slaMetCount = 0; // %平均方式では個別metは持たない（v1）
  }

  // Escalation rate
  const escalationRate =
    escalationStatus === "missing_columns"
      ? null
      : escalationEligibleCount > 0
      ? Math.round(((escalationCount / escalationEligibleCount) * 100) * 10) / 10
      : null;

  const slaDefinition =
    slaStatus === "missing_columns"
      ? "SLA(v1)=入力カラム不足（SLA/ServiceLevel/WithinSLA が無い）"
      : hasWithinSla
      ? "SLA(v1)=WithinSLA(true) / eligible. unknownは母数から除外"
      : "SLA(v1)=SLA/ServiceLevel(%) の平均（v1）";

  const escalationDefinition =
    escalationStatus === "missing_columns"
      ? "Escalation(v1)=入力カラム不足（Resolution_Status が無い）"
      : "Escalation(v1)=count(Transfer to L2 or Escalation) / eligible. unknownは母数から除外";

  return {
    rowCount,
    totalCalls,
    avgCsat,
    avgAht,

    fcrRate,
    fcrEligibleCount,
    fcrResolvedCount,
    fcrUnknownCount,
    fcrDefinition: "FCR(v1)=Resolved / (Resolved + NotResolved). unknownは母数から除外",

    slaRate,
    slaEligibleCount,
    slaMetCount,
    slaUnknownCount,
    slaStatus,
    slaDefinition,

    escalationRate,
    escalationEligibleCount,
    escalationCount,
    escalationUnknownCount,
    escalationStatus,
    escalationDefinition,
  };
}

/**
 * ✅ “合流版”：
 * - Summary（集計）
 * - Insights/Tasks（AI気づきエンジン v1）
 * を 1つの overview として返す
 */
export function computeOverview(rows: any[], range: RangeKey, agentStats?: any): Overview {
  const summary = computeSummary(rows);

  // ここは既存の buildInsightsV1 を使う（無ければ problems=[], insights=[], recommendTasks=[] で返す）
  let problems: any[] = [];
  let insights: any[] = [];
  let recommendTasks: any[] = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("./insightsV1");
    const buildInsightsV1 = mod?.buildInsightsV1 as undefined | ((args: any) => any);

    if (typeof buildInsightsV1 === "function") {
      const out = buildInsightsV1({
        window: range, // "today" | "week" | "month"
        summary,
        agentStats,
        policy: { minSampleCalls: 30 },
      });

      problems = out?.problems ?? [];
      insights = out?.insights ?? [];
      recommendTasks = out?.recommendTasks ?? [];
    }
  } catch {
    // insightsV1 がまだ無い/requireできない → 空で返す（MVPでは壊さない）
  }

  return {
    ...summary,
    range,
    problems,
    insights,
    recommendTasks,
  };
}
  export function attachActions<T extends object>(
  summary: T,
  extra: {
    insights?: any[];
    recommendTasks?: any[];
  }
) {
  return {
    ...summary,
    ...(extra.insights ? { insights: extra.insights } : {}),
    ...(extra.recommendTasks ? { recommendTasks: extra.recommendTasks } : {}),
  };
}

