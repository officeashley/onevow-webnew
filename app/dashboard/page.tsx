"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import mockRows from "@/data/xentrix_kpi_mock_260.json";
import DailyTrendChart from "@/app/dashboard/components/DailyTrendChart";

import {
  CleanedRow,
  computeOverview,
  buildAgentStats,
  calcAhtQuantiles,
  computeCsatBuckets,
  buildDailyKpis,
} from "@/lib/kpiEngine";

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

  if (range === "week") {
    from.setDate(from.getDate() - 6);
  } else if (range === "month") {
    from.setDate(from.getDate() - 29);
  }

  const fromTime = from.getTime();
  const toTime = dayStart.getTime() + 24 * 60 * 60 * 1000;

  return rows.filter((r) => {
    const t = new Date(r.Date).getTime();
    return t >= fromTime && t < toTime;
  });
}

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>("today");

  const allRows = mockRows as CleanedRow[];
  const rows = useMemo(() => filterRowsByRange(allRows, range), [allRows, range]);

  const overview = useMemo(() => computeOverview(rows), [rows]);
  const agentStats = useMemo(() => buildAgentStats(rows), [rows]);

  /* Top / Bottom AHT（今は人数少ないので 33%） */
  const { topAgentsByAht, bottomAgentsByAht } = useMemo(() => {
    return calcAhtQuantiles(agentStats, 0.33);
  }, [agentStats]);

  const csatBuckets = useMemo(() => computeCsatBuckets(rows), [rows]);

  /* 日次KPI（MVP） */
  const dailyKpis = useMemo(() => buildDailyKpis(rows), [rows]);

  /* SLA 警告判定（MVP） */
  const SLA_TARGET = 80;
  const slaWarn = overview.serviceLevel !== null && overview.serviceLevel < SLA_TARGET;

  return (
    <main className="min-h-screen bg-[#111111] text-slate-100 flex justify-center">
      <div className="w-full max-w-6xl px-4 py-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ZENTRIX – KPI Dashboard</h1>
            <p className="mt-1 text-sm text-slate-400">
              Zendesk Explore 風 / ダークモード / モックデータ
            </p>
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

        {/* Overview */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <KpiCard label="総コール件数" value={overview.totalCalls} caption={`${overview.rowCount} records`} />
          <KpiCard
            label="平均 CSAT"
            value={overview.avgCsat !== null ? `${overview.avgCsat}%` : "-"}
            caption="target ≥ 85%"
          />
          <KpiCard
            label="平均 AHT"
            value={overview.avgAht !== null ? `${overview.avgAht} sec` : "-"}
            caption="目標 300 sec 以下"
          />
          <KpiCard
            label="Service Level (MVP)"
            value={overview.serviceLevel !== null ? `${overview.serviceLevel}%` : "-"}
            caption={`target ≥ ${SLA_TARGET}%`}
            status={slaWarn ? "warn" : "ok"}
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
                      style={{
                        width: overview.rowCount > 0 ? `${(b.count / overview.rowCount) * 100}%` : "0%",
                      }}
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
              <span className="text-[11px] text-slate-400">Shorter AHT = better</span>
            </div>

            <div className="space-y-2 text-[11px] md:text-xs">
              {agentStats.map((a) => (
                <div
                  key={a.agentName}
                  className="flex justify-between rounded-lg bg-slate-900/60 px-2 py-1.5"
                >
                  <div>
                    {/* ✅ Step 7-2：ここを Link にする */}
                    <div className="font-semibold">
                      <Link
                        href={`/dashboard/agents/${encodeURIComponent(a.agentName)}`}
                        className="hover:underline"
                      >
                        {a.agentName}
                      </Link>
                    </div>

                    <div className="text-[10px] text-slate-400">
                      {a.totalCalls} calls / {a.rowCount} records
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono">{a.avgAht !== null ? `${a.avgAht}s` : "-"}</div>
                    <div className="text-[10px] text-slate-400">
                      CSAT {a.avgCsat !== null ? `${a.avgCsat}%` : "-"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom */}
        <section className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-4">
          <div className="rounded-2xl bg-[#1E1E1E] border border-slate-700/70 p-4">
            <h2 className="text-sm font-semibold mb-3">Top / Bottom Agents by AHT</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-emerald-400 mb-1">Top</div>
                {topAgentsByAht.map((a) => (
                  <div
                    key={a.agentName}
                    className="rounded bg-slate-900/70 px-2 py-1 flex justify-between"
                  >
                    {/* ✅ ここも Link（任意だけど統一すると気持ちいい） */}
                    <Link
                      href={`/dashboard/agents/${encodeURIComponent(a.agentName)}`}
                      className="hover:underline"
                    >
                      {a.agentName}
                    </Link>
                    <span className="font-mono">{a.avgAht}s</span>
                  </div>
                ))}
              </div>

              <div>
                <div className="text-rose-400 mb-1">Bottom</div>
                {bottomAgentsByAht.map((a) => (
                  <div
                    key={a.agentName}
                    className="rounded bg-slate-900/70 px-2 py-1 flex justify-between"
                  >
                    {/* ✅ ここも Link */}
                    <Link
                      href={`/dashboard/agents/${encodeURIComponent(a.agentName)}`}
                      className="hover:underline"
                    >
                      {a.agentName}
                    </Link>
                    <span className="font-mono">{a.avgAht}s</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#1E1E1E] border border-slate-700/70 p-4">
            <h2 className="text-sm font-semibold mb-3">Insights</h2>
            <InsightPill active={range === "today"} label="Today" body="Today は現在の抽出期間をそのまま表示しています。" />
            <InsightPill active={range === "week"} label="This Week" body="直近7日間の傾向を表示。" />
            <InsightPill active={range === "month"} label="This Month" body="直近30日間の傾向を表示。" />
          </div>
        </section>
      </div>
    </main>
  );
}

/* ------------------------------
   Components
-------------------------------- */
function KpiCard(props: {
  label: string;
  value: string | number;
  caption?: string;
  status?: "ok" | "warn";
}) {
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

function InsightPill(props: { active?: boolean; label: string; body: string }) {
  const { active, label, body } = props;
  return (
    <div
      className={`rounded-xl px-3 py-2 border text-[11px] mb-2 ${
        active ? "border-emerald-500/70 bg-emerald-500/10" : "border-slate-700/70 bg-slate-900/40"
      }`}
    >
      <div className="font-semibold mb-1">{label}</div>
      <div className="text-slate-300">{body}</div>
    </div>
  );
}
