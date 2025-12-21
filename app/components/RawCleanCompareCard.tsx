"use client";

import React, { useMemo } from "react";

type Props = {
  title?: string;
  rawRows: any[];
  cleanRows: any[];
  maxRows?: number;
};

function toDisplay(v: any): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function unionKeys(rawRows: any[], cleanRows: any[]) {
  const set = new Set<string>();
  for (const r of rawRows ?? []) Object.keys(r ?? {}).forEach((k) => set.add(k));
  for (const r of cleanRows ?? []) Object.keys(r ?? {}).forEach((k) => set.add(k));
  return Array.from(set);
}

export default function RawCleanCompareCard({
  title,
  rawRows,
  cleanRows,
  maxRows = 20,
}: Props) {
  const keys = useMemo(() => unionKeys(rawRows, cleanRows), [rawRows, cleanRows]);
  const n = Math.min(maxRows, Math.max(rawRows?.length ?? 0, cleanRows?.length ?? 0));

  return (
    <div className="rounded-2xl bg-[#1E1E1E] border border-slate-700/70 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">{title ?? "Raw vs Clean"}</h2>
        <span className="text-[11px] text-slate-400">
          rows: {rawRows?.length ?? 0} / {cleanRows?.length ?? 0}
        </span>
      </div>

      <div className="overflow-auto border border-slate-700/70 rounded-xl">
        <table className="min-w-[900px] w-full text-[11px]">
          <thead className="sticky top-0 bg-[#171717]">
            <tr className="text-slate-300">
              <th className="text-left px-2 py-2 border-b border-slate-700/70 w-[60px]">
                #
              </th>
              {keys.map((k) => (
                <th key={k} className="text-left px-2 py-2 border-b border-slate-700/70">
                  {k}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {Array.from({ length: n }).map((_, i) => {
              const raw = rawRows?.[i] ?? {};
              const clean = cleanRows?.[i] ?? {};
              return (
                <tr key={i} className="border-b border-slate-800/60">
                  <td className="px-2 py-2 text-slate-400 font-mono">{i + 1}</td>

                  {keys.map((k) => {
                    const rv = toDisplay(raw?.[k]);
                    const cv = toDisplay(clean?.[k]);
                    const changed = rv !== cv;

                    return (
                      <td key={k} className="px-2 py-2 align-top">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-slate-300">
                            <div className="text-[10px] text-slate-500 mb-0.5">raw</div>
                            <div className="break-all">{rv}</div>
                          </div>

                          <div className={changed ? "text-emerald-300" : "text-slate-300"}>
                            <div className="text-[10px] text-slate-500 mb-0.5">clean</div>
                            <div className="break-all">
                              {cv}
                              {changed ? <span className="ml-1 text-[10px]">★</span> : null}
                            </div>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-slate-500 mt-2">
        ★ = raw と clean が一致しない（差分あり）
      </div>
    </div>
  );
}
