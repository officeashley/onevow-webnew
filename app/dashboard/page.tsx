"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";

import mockRows from "@/data/xentrix_kpi_mock_260.json";
import DailyTrendChart from "@/app/dashboard/components/DailyTrendChart";

import {
  CleanedRow,
  buildAgentStats,
  calcAhtQuantiles,
  calcCsatQuantiles,
  calcFcrQuantiles,
  computeCsatBuckets,
  buildDailyKpis,
} from "@/lib/kpiEngine";

import { computeSummary, attachActions } from "@/lib/kpi/index";
import { buildInsightsV1 } from "@/lib/kpi/insightsV1";

type RangeKey = "today" | "week" | "month";

/* ------------------------------
   Range フィルタ（Today / Week / Month）
-------------------------------- */
function filterRowsByRange(rows: CleanedRow[], range: RangeKey): CleanedRow[] {
  if (!rows.length) return rows;

  const maxTime = Math.max(...rows.map((r) => new Date(r.Date).getTime()));
  const base = new Date(maxTime);

  const dayStart = new Date(base);
  dayStart.setHours(0, 0, 0, 0);

  let from = new Date(dayStart);

  if (range === "week") from.setDate(from.getDate() - 6);
  if (range === "month") from.setDate(from.getDate() - 29);

  const fromTime = from.getTime();
  const toTime = dayStart.getTime() + 24 * 60 * 60 * 1000;

  return rows.filter((r) => {
    const t = new Date(r.Date).getTime();
    return t >= fromTime && t < toTime;
  });
}

/* ------------------------------
   Helpers（表示用）
-------------------------------- */
const ahtText = (v: number | null | undefined) => (v == null ? "-" : `${Math.round(v)}s`);
const pct1 = (v: number | null | undefined) => (v == null ? "-" : `${v.toFixed(1)}%`);

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>("today");

  const allRows = mockRows as CleanedRow[];
  const rows = useMemo(() => filterRowsByRange(allRows, range), [allRows, range]);

  // ✅ agentStats
  const agentStats = useMemo(() => buildAgentStats(rows), [rows]);

  // ✅ overview base（Day2-4）
  const summary = useMemo(() => computeSummary(rows as any[]), [rows]);

  // ✅ Day6（改善ポイント/タスク）
  const day6 = useMemo(() => {
    const out = buildInsightsV1({
      window: range === "today" ? "day" : range === "week" ? "week" : "month",
      summary: summary as any,
      agentStats: agentStats as any,
      policy: { minSampleCalls: 30 },
    });
    return out;
  }, [range, summary, agentStats]);

  // ✅ 最終 overview（summary + actions）
  const overview = useMemo(() => {
    return attachActions(summary as any, {
      insights: day6.insights as any,
      recommendTasks: day6.recommendTasks as any,
    }) as any;
  }, [summary, day6]);

  /* Top / Bottom AHT（今は人数少ないので 33%） */
  const { topAgentsByAht, bottomAgentsByAht } = useMemo(() => {
    return calcAhtQuantiles(agentStats, 0.33);
  }, [agentStats]);

  /* ✅ Day5：CSAT/FCR Best/Worst（Top 10% / Bottom 10%）＋最低サンプル数 */
  const day5 = useMemo(() => {
    const ratio = 0.1;
    const minSample = 30;
    const minItems = 2;

    const csat = calcCsatQuantiles(agentStats, ratio, minSample, minItems);
    const fcr = calcFcrQuantiles(agentStats, ratio, minSample, minItems);

    return { csat, fcr, ratio, minSample, minItems };
  }, [agentStats]);

  const csatBuckets = useMemo(() => computeCsatBuckets(rows), [rows]);
  const dailyKpis = useMemo(() => buildDailyKpis(rows), [rows]);

  // ✅ rowCount / totalCalls は overview 優先
  const rowCount: number = overview.rowCount ?? rows.length;
  const totalCalls: number = overview.totalCalls ?? rowCount;

  const avgCsat = overview.avgCsat ?? null;
  const avgAht = overview.avgAht ?? null;

  /* FCR */
  const fcrRate = overview.fcrRate ?? null;
  const fcrEligibleCount: number = overview.fcrEligibleCount ?? 0;
  const fcrUnknownCount: number = overview.fcrUnknownCount ?? 0;

  /* SLA */
  const slaStatus = overview.slaStatus ?? "missing_columns";
  const slaRate = overview.slaRate ?? null;
  const slaEligibleCount: number = overview.slaEligibleCount ?? 0;

  /* Escalation */
  const escalationStatus = overview.escalationStatus ?? "missing_columns";
  const escalationRate = overview.escalationRate ?? null;
  const escalationEligibleCount: number = overview.escalationEligibleCount ?? 0;
  const escalationCount: number = overview.escalationCount ?? 0;

  // warn 条件（MVP）
  const unknownRatio = rowCount > 0 ? fcrUnknownCount / rowCount : 0;
  const fcrWarn = (fcrRate !== null && fcrRate < 70) || unknownRatio > 0.2;

  return (
    <main className="min-h-screen bg-[#111111] text-slate-100 flex justify-center">
      <div className="w-full max-w-6xl px-4 py-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">XENTRIX – KPI Dashboard</h1>
            <p className="mt-1 text-sm text-slate-400">Xendesk Explore 風 / ダークモード / モックデータ</p>
          </div>

          {/* Range Toggle */}
          <div className="inline-flex rounded-full bg-[#1E1E1E] p-1 border border-slate-700/70">
            {(["today", "week", "month"] as RangeKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={`px-3 py-1.5 text-xs md:text-sm rounded-full transition ${
                  range === key
                    ? "bg-emerald-500 text-black font-semibold"
                    : "text-slate-300 hover:bg-slate-700/70"
                }`}
              >
                {key === "today" ? "Today" : key === "week" ? "This Week" : "This Month"}
              </button>
            ))}
          </div>
        </header>

        {/* ✅ Next Actions (v1) — サブタイトル直下へ移動 */}
        <section className="rounded-2xl bg-[#1E1E1E] border border-slate-700/70 p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Next Actions (v1)</h2>
            <span className="text-[11px] text-slate-400">rules → tasks</span>
          </div>

          {/* Insights list */}
          <div className="mb-3">
            <div className="text-[11px] text-slate-400 mb-2">Insights</div>
            {overview.insights?.length ? (
              <div className="space-y-2">
                {overview.insights.map((it: any, idx: number) => (
                  <div key={idx} className="rounded-lg bg-slate-900/60 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold">{it.title}</div>
                      <span className="text-[10px] text-slate-500">
                        {it.scope}:{it.who} / {it.level}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-1">{it.why}</div>
                    {it.impact ? <div className="text-[11px] text-slate-400 mt-1">{it.impact}</div> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-slate-500">No insights</div>
            )}
          </div>

          {/* Tasks list */}
          <div>
            <div className="text-[11px] text-slate-400 mb-2">Recommend Tasks</div>
            {overview.recommendTasks?.length ? (
              <div className="space-y-2">
                {overview.recommendTasks.map((t: any, idx: number) => (
                  <div key={idx} className="rounded-lg bg-slate-900/60 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold">{t.task}</div>
                      <span className="text-[10px] text-slate-500">
                        {t.priority} / {t.ownerType}:{t.owner} / {t.due}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-1">
                      {t.duration}
                      {typeof t.howMany === "number" ? ` / ${t.howMany} calls` : ""}
                      {t.evidence ? ` — ${t.evidence}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-slate-500">No tasks</div>
            )}
          </div>
        </section>

        {/* Overview */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
          <KpiCard label="総コール件数" value={totalCalls} caption={`${rowCount} records`} />

          <KpiCard label="平均 CSAT" value={avgCsat !== null ? `${avgCsat}%` : "-"} caption="target ≥ 85%" />

          {/* ✅ AHT出るようにする（computeSummary側修正が前提） */}
          <KpiCard label="平均 AHT" value={avgAht !== null ? `${avgAht} sec` : "-"} caption="目標 300 sec 以下" />

          <KpiCard
            label="FCR (v1)"
            value={fcrRate !== null ? `${fcrRate}%` : "-"}
            caption={`eligible ${fcrEligibleCount} / unknown ${fcrUnknownCount}`}
            status={fcrWarn ? "warn" : "ok"}
          />

          <KpiCard
            label="SLA (v1)"
            value={slaStatus === "missing_columns" ? "Missing columns" : slaRate !== null ? `${slaRate}%` : "-"}
            caption={slaStatus === "missing_columns" ? "SLA/ServiceLevel/WithinSLA が無い" : `eligible ${slaEligibleCount}`}
            status={slaStatus === "missing_columns" ? "warn" : "ok"}
          />

          <KpiCard
            label="Escalation (v1)"
            value={
              escalationStatus === "missing_columns" ? "Missing columns" : escalationRate !== null ? `${escalationRate}%` : "-"
            }
            caption={
              escalationStatus === "missing_columns"
                ? "Resolution_Status が無い"
                : `escal ${escalationCount} / eligible ${escalationEligibleCount}`
            }
            status={escalationStatus === "missing_columns" ? "warn" : "ok"}
          />
        </section>

        {/* 📈 Trend (Daily) */}
        <section className="mb-6 rounded-2xl bg-[#1E1E1E] border border-slate-700/70 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Trend (Daily)</h2>
            <span className="text-[11px] text-slate-400">CSAT / AHT (mock)</span>
          </div>

          {dailyKpis.length === 0 ? (
            <p className="text-[11px] text-slate-400">No data</p>
          ) : (
            <div className="space-y-2">
              <DailyTrendChart data={dailyKpis} />
            </div>
          )}
        </section>

        {/* Middle */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* CSAT Distribution */}
          <div className="rounded-2xl bg-[#1E1E1E] border border-slate-700/70 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">CSAT Distribution</h2>
              <span className="text-[11px] text-slate-400">Bucket view</span>
            </div>

            <div className="space-y-2">
              {csatBuckets.map((b) => (
                <div key={b.label}>
                  <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                    <span>{b.label}</span>
                    <span className="font-mono">{b.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full bg-emerald-500"
                      style={{ width: rowCount > 0 ? `${(b.count / rowCount) * 100}%` : "0%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Agent Ranking */}
          <div className="rounded-2xl bg-[#1E1E1E] border border-slate-700/70 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Agent Ranking (AHT)</h2>
              <span className="text-[11px] text-slate-400">AHT の確認（極端に低い/高いも要注意）</span>
            </div>

            <div className="space-y-2 text-[11px] md:text-xs">
              {agentStats.map((a) => (
                <div key={a.agentName} className="flex justify-between rounded-lg bg-slate-900/60 px-2 py-1.5">
                  <div>
                    <div className="font-semibold">
                      <Link href={`/dashboard/agents/${encodeURIComponent(a.agentName)}`} className="hover:underline">
                        {a.agentName}
                      </Link>
                    </div>
                    <div className="text-[10px] text-slate-400">{a.totalCalls} calls / {a.rowCount} records</div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono">{ahtText(a.avgAht)}</div>
                    <div className="text-[10px] text-slate-400">CSAT {a.avgCsat !== null ? `${a.avgCsat}%` : "-"}</div>
                    <div className="text-[10px] text-slate-400">
                      FCR {a.fcrRate !== null ? `${a.fcrRate}%` : "-"}
                      {a.fcrUnknownCount ? <span className="ml-1 text-slate-500">(unk {a.fcrUnknownCount})</span> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom（あなたの元のまま） */}
        {/* …（ここは長いので省略せずに使ってOK：元コードをそのまま残してOK） */}
      </div>
    </main>
  );
}

/* ------------------------------
   Components
-------------------------------- */
function KpiCard(props: { label: string; value: string | number; caption?: string; status?: "ok" | "warn" }) {
  const { label, value, caption, status = "ok" } = props;
  const valueColor = status === "warn" ? "text-rose-400" : "text-emerald-400";

  return (
    <div className="rounded-2xl bg-[#1E1E1E] border border-slate-700/70 px-4 py-3">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${valueColor}`}>{value}</div>
      {caption && <div className="text-[11px] text-slate-500 mt-1">{caption}</div>}
    </div>
  );
}
