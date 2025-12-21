// lib/kpi/index.ts
export type Summary = {
  rowCount: number;
  totalCalls: number;

  avgCsat: number | null; // 0-100
  avgAht: number | null;  // seconds

  // Day3: FCR(v1)
  fcrRate: number | null;            // 0-100, null if eligible=0
  fcrEligibleCount: number;          // 判定できた件数（Resolved/NotResolved）
  fcrResolvedCount: number;          // Resolved件数
  fcrUnknownCount: number;           // 判定不能件数（Resolution_Status無 or 想定外値）
  fcrDefinition: string;             // UIで表示/デバッグ用
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

  // ✅ Resolved寄せ（Zendesk系/一般系の揺れ吸収）
  if (
    s === "resolved" ||
    s === "solved" ||
    s === "complete" ||
    s === "completed" ||
    s === "done" ||
    s === "closed"
  ) return "resolved";

  // ✅ Not resolved寄せ（暫定）
  if (
    s === "open" ||
    s === "pending" ||
    s === "in progress" ||
    s === "escalated" ||
    s === "transferred" ||
    s === "unresolved"
  ) return "not_resolved";

  // それ以外は unknown（ここ重要：変な値で率を壊さない）
  return "unknown";
}

export function computeSummary(rows: any[]): Summary {
  const safeRows = Array.isArray(rows) ? rows : [];
  const rowCount = safeRows.length;

  // calls は v1 では rowCount と同一扱いでOK（後で「CallCount列」等に切替可能）
  const totalCalls = rowCount;

  // CSAT: 数値のみ対象（null/空は除外）
  const csatVals: number[] = [];
  // AHT: 数値のみ対象
  const ahtVals: number[] = [];

  let fcrEligibleCount = 0;
  let fcrResolvedCount = 0;
  let fcrUnknownCount = 0;

  for (const r of safeRows) {
    // CSAT列の揺れ吸収
    const csatRaw = pick(r, ["CSAT", "csat", "Csat", "csat_score", "csatScore"]);
    const csat = num(csatRaw);
    if (csat !== null) csatVals.push(csat);

    // AHT列の揺れ吸収
    const ahtRaw = pick(r, ["AHT", "aht", "Aht", "aht_sec", "ahtSec", "handle_time_sec"]);
    const aht = num(ahtRaw);
    if (aht !== null) ahtVals.push(aht);

    // ✅ FCR(v1): Resolution_Status がある前提（あなたの条件）
    const rsRaw = pick(r, [
      "Resolution_Status",
      "resolution_status",
      "resolutionStatus",
      "status",
      "Status",
    ]);

    const cls = normalizeStatus(rsRaw);
    if (cls === "unknown") {
      fcrUnknownCount += 1;
    } else {
      fcrEligibleCount += 1;
      if (cls === "resolved") fcrResolvedCount += 1;
    }
  }

  const avgCsat =
    csatVals.length > 0 ? Math.round((csatVals.reduce((a, b) => a + b, 0) / csatVals.length) * 10) / 10 : null;

  const avgAht =
    ahtVals.length > 0 ? Math.round((ahtVals.reduce((a, b) => a + b, 0) / ahtVals.length) * 10) / 10 : null;

  const fcrRate =
    fcrEligibleCount > 0
      ? Math.round(((fcrResolvedCount / fcrEligibleCount) * 100) * 10) / 10
      : null;

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
  };
}
