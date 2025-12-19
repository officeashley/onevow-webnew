// components/CleanedCsvPreview.tsx
"use client";

import { useMemo } from "react";
import { toCsv } from "@/lib/toCsv";

export default function CleanedCsvPreview({
  cleanedRows,
  title = "Cleaned CSV Preview",
}: {
  cleanedRows: Record<string, any>[];
  title?: string;
}) {
  const headers = useMemo(() => {
    const set = new Set<string>();
    (cleanedRows ?? []).forEach((r) => Object.keys(r ?? {}).forEach((k) => set.add(k)));
    return Array.from(set);
  }, [cleanedRows]);

  const csvText = useMemo(() => toCsv(cleanedRows ?? []), [cleanedRows]);

  const download = () => {
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "xentrix_cleaned.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!cleanedRows || cleanedRows.length === 0) {
    return (
      <div className="rounded-2xl bg-[#111827] border border-slate-700/70 p-4 text-sm text-slate-300">
        {title}: まだデータがありません
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#0B1220] border border-slate-700/70 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">{title}</div>
          <div className="text-[11px] text-slate-400">
            rows: {cleanedRows.length} / cols: {headers.length}
          </div>
        </div>

        <button
          onClick={download}
          className="px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[12px] hover:bg-emerald-500/25"
        >
          Download CSV
        </button>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-700/50">
        <table className="min-w-full text-[11px]">
          <thead className="sticky top-0 bg-[#0F172A] text-slate-200">
            <tr>
              {headers.map((h) => (
                <th key={h} className="text-left px-3 py-2 border-b border-slate-700/50 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="text-slate-300">
            {cleanedRows.slice(0, 50).map((r, i) => (
              <tr key={i} className="odd:bg-slate-900/30">
                {headers.map((h) => (
                  <td key={h} className="px-3 py-2 border-b border-slate-800/50 whitespace-nowrap">
                    {r?.[h] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-[11px] text-slate-400">
        ※まずは先頭50行だけ表示（重くならないように）。必要ならページングにする。
      </div>
    </div>
  );
}
