"use client";

import React, { useMemo, useState } from "react";

type Props = {
  title?: string;
  rawRows: any[];
  cleanRows: any[];
  /** 表示する最大行数（重いとき用） */
  maxRows?: number;
  /** デフォルトで差分のみ表示にするか */
  defaultDiffOnly?: boolean;
};

/**
 * Raw と Clean を同じ列セットで横並び比較するカード。
 * - 値が違うセルはハイライト
 * - Diff only / 列フィルタ / 行数制限
 * - 行の対応は「同じ index」を基本（MVPではこれでOK）
 */
export function RawCleanCompareCard({
  title = "Raw vs Clean Compare",
  rawRows,
  cleanRows,
  maxRows = 50,
  defaultDiffOnly = false,
}: Props) {
  const [diffOnly, setDiffOnly] = useState(defaultDiffOnly);
  const [columnQuery, setColumnQuery] = useState("");
  const [rowLimit, setRowLimit] = useState(maxRows);

  const safeRaw = Array.isArray(rawRows) ? rawRows : [];
  const safeClean = Array.isArray(cleanRows) ? cleanRows : [];

  const rowCount = Math.min(safeRaw.length, safeClean.length);

  // 1) 列キーを union で作る（順序は raw の出現順→clean の追加分）
  const allKeys = useMemo(() => {
    const seen = new Set<string>();
    const keys: string[] = [];
    const push = (k: string) => {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    };

    for (const r of safeRaw) {
      if (r && typeof r === "object") Object.keys(r).forEach(push);
    }
    for (const r of safeClean) {
      if (r && typeof r === "object") Object.keys(r).forEach(push);
    }
    return keys;
  }, [safeRaw, safeClean]);

  // 2) 列検索
  const filteredKeys = useMemo(() => {
    const q = columnQuery.trim().toLowerCase();
    if (!q) return allKeys;
    return allKeys.filter((k) => k.toLowerCase().includes(q));
  }, [allKeys, columnQuery]);

  // 値表示用（見やすさ優先）
  const fmt = (v: any) => {
    if (v === null || v === undefined) return "null";
    if (typeof v === "string") return v === "" ? '""' : v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (Array.isArray(v)) return JSON.stringify(v);
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  // 比較用の正規化（軽いルールでOK：trim, 全角空白→半角, "NULL"→null 表現）
  const norm = (v: any) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "string") {
      const s = v
        .replace(/\u3000/g, " ") // 全角空白
        .trim();
      const upper = s.toUpperCase();
      if (upper === "NULL" || upper === "NUL" || upper === "N/A" || s === "")
        return null;
      return s;
    }
    return v;
  };

  const isDifferent = (a: any, b: any) => {
    const na = norm(a);
    const nb = norm(b);
    // number / string の交差も考慮して文字列比較も少し許容
    if (na === nb) return false;
    if (
      (typeof na === "number" || typeof nb === "number") &&
      String(na) === String(nb)
    )
      return false;
    return true;
  };

  // 3) diffOnly のとき：差分がある列だけ残す
  const diffKeys = useMemo(() => {
    if (!diffOnly) return filteredKeys;

    const keys = filteredKeys.filter((k) => {
      // どこか1行でも差分があれば残す
      const limit = Math.min(rowCount, rowLimit);
      for (let i = 0; i < limit; i++) {
        const r = safeRaw[i] ?? {};
        const c = safeClean[i] ?? {};
        if (isDifferent(r?.[k], c?.[k])) return true;
      }
      return false;
    });
    return keys;
  }, [diffOnly, filteredKeys, rowCount, rowLimit, safeRaw, safeClean]);

  const effectiveKeys = diffKeys;

  // 4) 行ごとの差分有無（diffOnlyのときに行も絞れるように）
  const rowsToShow = useMemo(() => {
    const limit = Math.min(rowCount, rowLimit);
    const rows = Array.from({ length: limit }, (_, i) => i);

    if (!diffOnly) return rows;

    // diffOnly のときは「その行に差分がある」ものだけ表示
    return rows.filter((i) => {
      const r = safeRaw[i] ?? {};
      const c = safeClean[i] ?? {};
      for (const k of effectiveKeys) {
        if (isDifferent(r?.[k], c?.[k])) return true;
      }
      return false;
    });
  }, [diffOnly, rowCount, rowLimit, safeRaw, safeClean, effectiveKeys]);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-slate-100">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-[11px] text-slate-400">
            rows:{" "}
            <span className="font-mono text-slate-200">
              {rowCount}
            </span>{" "}
            / showing:{" "}
            <span className="font-mono text-slate-200">
              {rowsToShow.length}
            </span>{" "}
            / cols:{" "}
            <span className="font-mono text-slate-200">
              {effectiveKeys.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input
              type="checkbox"
              checked={diffOnly}
              onChange={(e) => setDiffOnly(e.target.checked)}
              className="h-3 w-3"
            />
            差分のみ
          </label>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
          <div className="text-[10px] text-slate-400">列フィルタ</div>
          <input
            value={columnQuery}
            onChange={(e) => setColumnQuery(e.target.value)}
            placeholder="例: Date / AgentName / CSAT ..."
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-100 outline-none placeholder:text-slate-600"
          />
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
          <div className="text-[10px] text-slate-400">表示行数</div>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={500}
              value={rowLimit}
              onChange={(e) => setRowLimit(Number(e.target.value || 1))}
              className="w-24 rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-100 outline-none"
            />
            <span className="text-[11px] text-slate-500">
              （最大 {rowCount}）
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
          <div className="text-[10px] text-slate-400">ヒント</div>
          <div className="mt-1 text-[11px] text-slate-300">
            セルの色が付いている箇所が「Raw と Clean の差分」です。
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-lg border border-slate-800">
        <table className="min-w-[1100px] w-full text-[11px]">
          <thead className="sticky top-0 bg-slate-950">
            <tr className="border-b border-slate-800">
              <th className="px-2 py-2 text-left text-slate-300 w-[70px]">
                Row
              </th>
              <th className="px-2 py-2 text-left text-slate-300 w-[180px]">
                Column
              </th>
              <th className="px-2 py-2 text-left text-slate-300">
                Raw
              </th>
              <th className="px-2 py-2 text-left text-slate-300">
                Clean
              </th>
            </tr>
          </thead>

          <tbody>
            {rowsToShow.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-4 text-slate-400"
                >
                  表示する差分がありません（または行数/列フィルタで空になっています）。
                </td>
              </tr>
            ) : effectiveKeys.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-4 text-slate-400"
                >
                  列が見つかりません（列フィルタを確認してください）。
                </td>
              </tr>
            ) : (
              rowsToShow.map((rowIdx) => {
                const r = safeRaw[rowIdx] ?? {};
                const c = safeClean[rowIdx] ?? {};

                return effectiveKeys.map((k, ki) => {
                  const rawV = r?.[k];
                  const cleanV = c?.[k];
                  const diff = isDifferent(rawV, cleanV);

                  // diffOnly の時は、diffのないセル行は出さない（テーブル行単位）
                  if (diffOnly && !diff) return null;

                  return (
                    <tr
                      key={`${rowIdx}-${k}`}
                      className={`border-b border-slate-900 ${
                        diff
                          ? "bg-amber-500/10"
                          : "bg-transparent"
                      }`}
                    >
                      <td className="px-2 py-2 font-mono text-slate-300">
                        {rowIdx}
                      </td>
                      <td className="px-2 py-2 font-mono text-slate-200">
                        {k}
                      </td>

                      <td
                        className={`px-2 py-2 font-mono align-top ${
                          diff ? "text-slate-100" : "text-slate-300"
                        }`}
                      >
                        <div className="max-w-[520px] break-words whitespace-pre-wrap">
                          {fmt(rawV)}
                        </div>
                      </td>

                      <td
                        className={`px-2 py-2 font-mono align-top ${
                          diff
                            ? "text-emerald-200"
                            : "text-slate-300"
                        }`}
                      >
                        <div className="max-w-[520px] break-words whitespace-pre-wrap">
                          {fmt(cleanV)}
                        </div>
                      </td>
                    </tr>
                  );
                });
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-[10px] text-slate-500">
        ※MVP版では行の対応は「同じ index」です。将来は rowId（例:
        ticketId や callId）でマッチングに拡張できます。
      </div>
    </div>
  );
}
