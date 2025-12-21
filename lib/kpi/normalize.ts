import { CleanedRow } from "./types";

const NULL_LIKE = new Set(["", "NULL", "N/A", "null", "na", "n/a"]);

export function toNullIfNullLike(v: any): any {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (NULL_LIKE.has(s)) return null;
  return v;
}

export function normalizeAgentName(v: any): string | null {
  v = toNullIfNullLike(v);
  if (v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

// 全角数字 → 半角数字
export function zenkakuToHankakuDigits(s: string): string {
  return s.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}

// "85%", "300 sec", "３００" みたいなのを number化
export function normalizeNumber(v: any): number | null {
  v = toNullIfNullLike(v);
  if (v === null) return null;

  if (typeof v === "number" && Number.isFinite(v)) return v;

  const raw = zenkakuToHankakuDigits(String(v).trim());
  // % / sec / s / commas をざっくり除去
  const cleaned = raw
    .replace(/%/g, "")
    .replace(/sec/gi, "")
    .replace(/seconds?/gi, "")
    .replace(/s/gi, "")
    .replace(/,/g, "")
    .trim();

  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

// Dateを ISO yyyy-mm-dd に揃える（失敗→null）
export function normalizeDateToISO(v: any): string | null {
  v = toNullIfNullLike(v);
  if (v === null) return null;

  // 既に yyyy-mm-dd っぽいならそれを優先
  const s = String(v).trim();
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const yyyy = m[1];
    const mm = String(m[2]).padStart(2, "0");
    const dd = String(m[3]).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// 任意rowを「Day2で使う範囲だけ」正規化して返す
export function normalizeRowForKpi(row: CleanedRow): CleanedRow {
  return {
    ...row,
    AgentName: normalizeAgentName(row.AgentName),
    Date: normalizeDateToISO(row.Date),
    CSAT: normalizeNumber(row.CSAT),
    AvgHandleTimeSeconds: normalizeNumber(row.AvgHandleTimeSeconds),
  };
}
// 既存：export function normalizeRowForKpi(...) { ... }

// ✅ alias を追加（これが最重要）
export const normalizeRow = normalizeRowForKpi;
