
/* ==============================
   Types
============================== */

export type CleanedRow = {
  // Dashboard側で使ってる最低限
  Date: string; // ISO or yyyy-mm-dd
  Agent?: string;
  AgentName?: string;
  agentName?: string;

  // calls
  Calls?: number | string;
  CallCount?: number | string;
  callCount?: number | string;

  // CSAT
  CSAT?: number | string | null;
  csat?: number | string | null;

  // AHT (seconds)
  AHT?: number | string | null;
  aht?: number | string | null;

  // FCR v1 uses Resolution_Status
  Resolution_Status?: string | null;
  resolution_status?: string | null;
  resolutionStatus?: string | null;

  // allow any extra columns
  [key: string]: any;
};

export type AgentStat = {
  agentName: string;

  rowCount: number;
  totalCalls: number;

  avgCsat: number | null; // %
  avgAht: number | null; // sec

 
};

export type DailyKpi = {
  date: string; // yyyy-mm-dd
  avgCsat: number | null;
  avgAht: number | null;
};

/* ==============================
   Helpers
============================== */

function toNumber(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function avg(nums: Array<number | null>): number | null {
  const xs = nums.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (!xs.length) return null;
  const s = xs.reduce((a, b) => a + b, 0);
  return Math.round((s / xs.length) * 10) / 10; // 1 decimal
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function getAgentName(r: CleanedRow): string {
  return (
    (r.Agent as any) ||
    (r.AgentName as any) ||
    (r.agentName as any) ||
    "Unknown"
  );
}

function getCalls(r: CleanedRow): number {
  const c =
    toNumber(r.Calls) ??
    toNumber(r.CallCount) ??
    toNumber(r.callCount) ??
    1; // records = calls fallback
  return c ?? 1;
}

function getCsat(r: CleanedRow): number | null {
  return toNumber(r.CSAT ?? r.csat);
}

function getAht(r: CleanedRow): number | null {
  return toNumber(r.AHT ?? r.aht);
}

/* ==============================
   Exports
============================== */

/**
 * Agent stats (CSAT/AHT + FCR v1)
 * - FCR is computed per agent using computeFcrV1(agentRows)
 */
export function buildAgentStats(rows: CleanedRow[]): AgentStat[] {
  const byAgent = new Map<string, CleanedRow[]>();

  for (const r of rows ?? []) {
    const agent = getAgentName(r);
    if (!byAgent.has(agent)) byAgent.set(agent, []);
    byAgent.get(agent)!.push(r);
  }

  const stats: AgentStat[] = [];

  for (const [agentName, agentRows] of byAgent.entries()) {
    const calls = agentRows.map(getCalls);
    const csat = agentRows.map(getCsat);
    const aht = agentRows.map(getAht);

    

    stats.push({
      agentName,
      rowCount: agentRows.length,
      totalCalls: calls.reduce((s, x) => s + x, 0),

      avgCsat: avg(csat),
      avgAht: avg(aht),

    
    });
  }

  // Sort: shorter AHT = better (null -> bottom)
  stats.sort((a, b) => (a.avgAht ?? Infinity) - (b.avgAht ?? Infinity));
  return stats;
}

/**
 * AHT quantiles (Top/Bottom)
 * ratio: 0.33 means top 33% and bottom 33% (min 1)
 */
export function calcAhtQuantiles(agentStats: AgentStat[], ratio = 0.33): {
  topAgentsByAht: AgentStat[];
  bottomAgentsByAht: AgentStat[];
} {
  const stats = [...(agentStats ?? [])].sort(
    (a, b) => (a.avgAht ?? Infinity) - (b.avgAht ?? Infinity)
  );

  const n = stats.length;
  if (n === 0) return { topAgentsByAht: [], bottomAgentsByAht: [] };

  const k = Math.max(1, Math.round(n * ratio));
  const topAgentsByAht = stats.slice(0, k);
  const bottomAgentsByAht = stats.slice(Math.max(0, n - k));

  return { topAgentsByAht, bottomAgentsByAht };
}

/**
 * CSAT buckets
 * - 90-100
 * - 80-89
 * - 0-79
 * Note: CSAT null is ignored from bucket count
 */
export function computeCsatBuckets(rows: CleanedRow[]): Array<{ label: string; count: number }> {
  let c90 = 0;
  let c80 = 0;
  let c79 = 0;

  for (const r of rows ?? []) {
    const v = getCsat(r);
    if (v === null) continue;
    if (v >= 90 && v <= 100) c90++;
    else if (v >= 80 && v <= 89) c80++;
    else if (v >= 0 && v <= 79) c79++;
  }

  return [
    { label: "90-100", count: c90 },
    { label: "80-89", count: c80 },
    { label: "0-79", count: c79 },
  ];
}

/**
 * Daily KPI series for trend chart (avg CSAT / avg AHT by date)
 * date key: first 10 chars of Date (yyyy-mm-dd) if ISO
 */
export function buildDailyKpis(rows: CleanedRow[]): DailyKpi[] {
  const byDate = new Map<string, CleanedRow[]>();

  for (const r of rows ?? []) {
    const raw = r.Date;
    if (!raw) continue;
    const d = String(raw).slice(0, 10);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(r);
  }

  const out: DailyKpi[] = [];
  for (const [date, ds] of byDate.entries()) {
    out.push({
      date,
      avgCsat: avg(ds.map(getCsat)),
      avgAht: avg(ds.map(getAht)),
    });
  }

  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

/**
 * AHT percentile helpers (optional)
 * If you later need median/P90.
 */
export function ahtPercentile(rows: CleanedRow[], p: number): number | null {
  const xs = (rows ?? [])
    .map(getAht)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    .sort((a, b) => a - b);

  if (!xs.length) return null;
  const clamped = Math.min(1, Math.max(0, p));
  const idx = Math.floor((xs.length - 1) * clamped);
  return round1(xs[idx]);
}
