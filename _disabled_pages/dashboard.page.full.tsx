// app/dashboard/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";

import mockRows from "@/data/xentrix_kpi_mock_260.json";
import DailyTrendChart from "@/app/dashboard/components/DailyTrendChart";

import type { CleanedRow } from "@/lib/kpi/types";

import {
  buildAgentStats,
  calcAhtQuantiles,
  calcCsatQuantiles,
  calcFcrQuantiles,
  computeCsatBuckets,
  buildDailyKpis,
} from "@/lib/kpiEngine";


import { computeSummary } from "@/lib/kpi"; // index.ts から re-export
import { buildInsightsV1 } from "@/lib/kpi/insightsV1";
import { buildRecommendTasksV1 } from "@/lib/kpi/taskMappingV1";

// ✅ Day6: Akiko insight layer
import { applyAkikoInsightLayerV1 } from "../../src/lib/kpi/akikoInsightLayerV1";


type RangeKey = "today" | "week" | "month";

const CSAT_TARGET = 85;

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
   Helpers
-------------------------------- */
const ahtText = (v: number | null | undefined) => (v == null ? "-" : `${Math.round(v)}s`);
const pct1 = (v: number | null | undefined) => (v == null ? "-" : `${v.toFixed(1)}%`);

function mergeActions<T extends object>(summary: T, extra: { insights?: any[]; recommendTasks?: any[] }) {
  return {
    ...summary,
    ...(extra.insights ? { insights: extra.insights } : {}),
    ...(extra.recommendTasks ? { recommendTasks: extra.recommendTasks } : {}),
  };
}

function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[（）\(\)\[\]【】]/g, " ")
    .replace(/[^a-z0-9ぁ-んァ-ン一-龠ー\s:_-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

/** Taskタイトルから “紐づけキー” を推定（libを触らず成立させるための暫定） */
function inferInsightIdFromTask(t: any): string {
  const title = `${t?.title ?? t?.task ?? ""}`.toLowerCase();

  if (title.includes("csat")) return "csat_low_center";
  if (title.includes("sla") || title.includes("withinsla") || title.includes("servicelevel")) return "sla_missing_columns";
  if (title.includes("escalation") || title.includes("エスカ")) return "escalation_high";
  if (title.includes("fcr") && title.includes("unknown")) return "fcr_unknown_high";

  if (t?.scope) return `scope_${slugify(String(t.scope))}`;
  return "misc";
}

/** Insight側に id が無い場合の推定 */
function inferInsightIdFromInsight(it: any): string {
  const title = String(it?.title ?? "");
  const hint = `${it?.scope ?? ""}_${it?.who ?? ""}_${it?.level ?? ""}_${title}`;
  const s = slugify(hint);

  const lower = title.toLowerCase();
  if (lower.includes("csat")) return "csat_low_center";
  if (lower.includes("sla")) return "sla_missing_columns";
  if (lower.includes("escalation") || lower.includes("エスカ")) return "escalation_high";
  if (lower.includes("fcr") && lower.includes("unknown")) return "fcr_unknown_high";

  return s || "misc";
}

/**
 * ✅ Day6: タスクの “見込み効果” を付与（推定表示）
 * - 今はルールベースの仮値でOK（MVPの「判断→行動→結果」を通すため）
 * - 後日：実績データで学習/補正して精度を上げる
 */
function inferImpact(t: any) {
  const title = `${t?.title ?? t?.task ?? ""}`.toLowerCase();

  // やや強めに見せたいならここを調整（例: csat 1.5〜2.0）
  if (title.includes("csat")) return { csatDelta: 1.2, confidence: "low" as const };
  if (title.includes("sla")) return { csatDelta: 0.4, confidence: "low" as const };
  if (title.includes("escalation") || title.includes("エスカ")) return { csatDelta: 0.5, confidence: "low" as const };
  if (title.includes("fcr")) return { csatDelta: 0.3, confidence: "low" as const };

  return { csatDelta: 0.2, confidence: "low" as const };
}

/** tasksから “クリック可能なInsights” を補完生成（insightsが薄くても紐づけ成立させる） */
function synthesizeInsightsFromTasks(tasks: any[]) {
  const ids = new Set<string>();
  for (const t of tasks) ids.add(inferInsightIdFromTask(t));

  const toInsight = (id: string) => {
    if (id === "csat_low_center") {
      return {
        id,
        title: "CSAT低下（センター）",
        why: `平均CSATが目標（${CSAT_TARGET}%）を下回っています。`,
        scope: "center",
        who: "center",
        level: "warn",
        impact: "CSAT改善の最優先候補",
        source: "synthetic",
      };
    }
    if (id === "sla_missing_columns") {
      return {
        id,
        title: "SLA列不足 / 定義未確定",
        why: "SLAが計測できない状態。まず“測れる形”にする必要があります。",
        scope: "center",
        who: "center",
        level: "warn",
        impact: "SLA可視化 → 運用品質の底上げ",
        source: "synthetic",
      };
    }
    if (id === "escalation_high") {
      return {
        id,
        title: "Escalation抑制（L2戻す前のチェック）",
        why: "エスカ率が一定発生。流出前に止める仕組み作りが必要です。",
        scope: "center",
        who: "center",
        level: "warn",
        impact: "クレーム/工数/離脱の抑制",
        source: "synthetic",
      };
    }
    if (id === "fcr_unknown_high") {
      return {
        id,
        title: "FCR unknown 多め",
        why: "unknownが多いと判断がブレます。入力/設計の改善が必要です。",
        scope: "center",
        who: "center",
        level: "info",
        impact: "FCRの信頼性UP",
        source: "synthetic",
      };
    }
    return {
      id,
      title: `Insight: ${id}`,
      why: "関連タスクから自動生成された項目。",
      scope: "center",
      who: "center",
      level: "info",
      impact: "",
      source: "synthetic",
    };
  };

  return Array.from(ids).map(toInsight);
}

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>("today");
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);

  const allRows = mockRows as CleanedRow[];
  const rows = useMemo(() => filterRowsByRange(allRows, range), [allRows, range]);

  // agentStats
  const agentStats = useMemo(() => buildAgentStats(rows), [rows]);

  // Summary（rowsのみ）
  const summary = useMemo(() => computeSummary(rows as any[]), [rows]);

  /**
   * ✅ Day6: Insights + RecommendTasks を一括生成
   * - tasksは必ず出す（落ちない）
   * - insightsは buildInsightsV1 の後に applyAkikoInsightLayerV1 を噛ませる（思想が見える）
   * - UI側で id / 関連 / impact を補完
   */
  const actionOut = useMemo(() => {
    // tasks（必ず出す）
    const tasks = (() => {
      try {
        return (
          buildRecommendTasksV1({
            window: range as any,
            summary: summary as any,
            agentStats: agentStats as any,
            policy: { minSampleCalls: 30, csatTarget: CSAT_TARGET },
          }) ?? []
        );
      } catch {
        return [];
      }
    })();

    // rule insights
    const ruleInsights = (() => {
      try {
        const out = buildInsightsV1({
          window: range as any,
          summary: summary as any,
          agentStats: agentStats as any,
          minSample: 30,
        } as any);
        return out?.insights ?? [];
      } catch {
        return [];
      }
    })();

    // ✅ Akiko Insight Layer を噛ませる（ここがDay6の要）
    const insightsAfterAkiko = (() => {
      try {
        const merged = applyAkikoInsightLayerV1({
          insights: ruleInsights,
          summary,
          agentStats,
          window: range,
        });
        // apply が配列を返す前提（もし違っても落ちないように）
        return Array.isArray(merged) ? merged : ruleInsights;
      } catch {
        return ruleInsights;
      }
    })();

    // tasks に紐づけ + impact を付与
    const decoratedTasks = (tasks ?? []).map((t: any) => {
      const related = Array.isArray(t?.relatedInsightIds) ? t.relatedInsightIds : [inferInsightIdFromTask(t)];
      const impact = t?.impact ?? inferImpact(t);
      return { ...t, relatedInsightIds: related, impact };
    });

    // insights に id を保証
    const decoratedInsightsRaw = (insightsAfterAkiko ?? []).map((it: any) => {
      const id = it?.id ?? inferInsightIdFromInsight(it);
      return { ...it, id };
    });

    // insights が薄い/空でも、tasks由来のクリック用insightsを補完
    const synth = synthesizeInsightsFromTasks(decoratedTasks);

    // 重複排除して結合（raw優先 → synth）
    const seen = new Set<string>();
    const mergedInsights: any[] = [];

    for (const it of decoratedInsightsRaw) {
      if (!it?.id) continue;
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      mergedInsights.push(it);
    }
    for (const it of synth) {
      if (!it?.id) continue;
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      mergedInsights.push(it);
    }

    // ✅ Akiko seed の boost があれば軽くソート（強制じゃない）
    mergedInsights.sort((a, b) => (b?._boost ?? 0) - (a?._boost ?? 0));

    return {
      insights: mergedInsights,
      recommendTasks: decoratedTasks,
    };
  }, [range, summary, agentStats]);

  // overview（summary + actions）
  const overview = useMemo(() => {
    return mergeActions(summary as any, {
      insights: actionOut.insights as any,
      recommendTasks: actionOut.recommendTasks as any,
    }) as any;
  }, [summary, actionOut]);

  // quantiles（将来Extremesに活用）
  useMemo(() => calcAhtQuantiles(agentStats, 0.33), [agentStats]);
  useMemo(() => {
    const ratio = 0.1;
    const minSample = 30;
    const minItems = 2;
    calcCsatQuantiles(agentStats, ratio, minSample);
calcFcrQuantiles(agentStats, ratio, minSample);

    return { ratio, minSample, minItems };
  }, [agentStats]);

  const csatBuckets = useMemo(() => computeCsatBuckets(rows), [rows]);
  const dailyKpis = useMemo(() => buildDailyKpis(rows), [rows]);

  // rowCount / totalCalls は overview 優先
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

  // ✅ Day6：選択Insightで tasks をフィルタ
  const filteredTasks = useMemo(() => {
    const tasks = (overview.recommendTasks ?? []) as any[];
    if (!selectedInsightId) return tasks;
    return tasks.filter((t) => Array.isArray(t?.relatedInsightIds) && t.relatedInsightIds.includes(selectedInsightId));
  }, [overview.recommendTasks, selectedInsightId]);

  // ✅ Day6：Outcome Preview（推定 / レンジ表示）
  const outcome = useMemo(() => {
    const base = typeof avgCsat === "number" ? avgCsat : null;
    if (base == null) return null;

    const gain = (filteredTasks ?? []).reduce((s: number, t: any) => s + (t?.impact?.csatDelta ?? 0), 0);

    // “推定”らしくレンジで見せる
    const low = Math.min(100, Math.max(0, base + gain * 0.7));
    const mid = Math.min(100, Math.max(0, base + gain));
    const high = Math.min(100, Math.max(0, base + gain * 1.3));

    const toTarget = Math.max(0, CSAT_TARGET - mid);
    const confidence = "low"; // 今は学習前なのでlow固定（誠実に）

    return { base, gain, low, mid, high, toTarget, confidence };
  }, [avgCsat, filteredTasks]);

  return (
    <main className="min-h-screen bg-[#111111] text-slate-100 flex justify-center">
      <div className="w-full max-w-6xl px-4 py-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">XENTRIX – KPI Dashboard</h1>
            <p className="mt-1 text-sm text-slate-400">Zendesk Explore 風 / ダークモード / モックデータ</p>
          </div>

          {/* Range Toggle */}
          <div className="inline-flex rounded-full bg-[#1E1E1E] p-1 border border-slate-700/70">
            {(["today", "week", "month"] as RangeKey[]).map((key) => (
              <button
                key={key}
                onClick={() => {
                  setRange(key);
                  setSelectedInsightId(null);
                }}
                className={`px-3 py-1.5 text-xs md:text-sm rounded-full transition ${
                  range === key ? "bg-emerald-500 text-black font-semibold" : "text-slate-300 hover:bg-slate-700/70"
                }`}
              >
                {key === "today" ? "Today" : key === "week" ? "This Week" : "This Month"}
              </button>
            ))}
          </div>
        </header>

        {/* ✅ Day6：Next Actions 最上段固定（sticky） */}
        <section className="sticky top-3 z-20 rounded-2xl bg-[#1E1E1E]/95 border border-slate-700/70 p-4 mb-5 backdrop-blur">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Next Actions (v1)</h2>
            <span className="text-[11px] text-slate-400">judge → act → outcome (est.)</span>
          </div>

          {/* ✅ Outcome Preview */}
          <div className="mb-4 rounded-xl border border-slate-700/70 bg-slate-900/40 p-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-slate-400">Outcome Preview (CSAT)</div>
              <div className="text-[11px] text-slate-500">
                target <span className="font-mono">{CSAT_TARGET}%</span> / confidence{" "}
                <span className="font-mono">{outcome?.confidence ?? "-"}</span>
              </div>
            </div>

            {outcome ? (
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="rounded-lg bg-slate-950/40 px-3 py-2">
                  <div className="text-[10px] text-slate-500">Now</div>
                  <div className="text-lg font-semibold text-emerald-400">{pct1(outcome.base)}</div>
                  <div className="text-[10px] text-slate-500">current average</div>
                </div>

                <div className="rounded-lg bg-slate-950/40 px-3 py-2">
                  <div className="text-[10px] text-slate-500">
                    After (est.){" "}
                    {selectedInsightId ? <span className="text-slate-400">(selected insight)</span> : <span className="text-slate-400">(all)</span>}
                  </div>
                  <div className="text-lg font-semibold text-emerald-400">
                    {pct1(outcome.mid)}{" "}
                    <span className="text-[11px] text-slate-400 font-normal">
                      ({pct1(outcome.low)}〜{pct1(outcome.high)})
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">Δ {pct1(outcome.gain)}</div>
                </div>

                <div className="rounded-lg bg-slate-950/40 px-3 py-2">
                  <div className="text-[10px] text-slate-500">Gap to target</div>
                  <div className={`text-lg font-semibold ${outcome.toTarget <= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {outcome.toTarget <= 0 ? "On target" : `-${pct1(outcome.toTarget)}`}
                  </div>
                  <div className="text-[10px] text-slate-500">what remains</div>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-slate-500">No CSAT data</div>
            )}
          </div>

          {/* Insights list（クリック可能） */}
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-slate-400 mb-2">Insights (click → filter tasks)</div>

              {selectedInsightId ? (
                <button
                  onClick={() => setSelectedInsightId(null)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                >
                  clear
                </button>
              ) : null}
            </div>

            {overview.insights?.length ? (
              <div className="space-y-2">
                {overview.insights.map((it: any, idx: number) => {
                  const id = it?.id ?? `ins_${idx}`;
                  const selected = selectedInsightId === id;

                  const source = it?.source ?? "";
                  const isAkiko = source === "akiko_seed_v1" || it?.who === "akiko" || it?.level === "principle";

                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedInsightId((prev) => (prev === id ? null : id))}
                      className={`w-full text-left rounded-lg px-3 py-2 transition border ${
                        selected
                          ? "bg-emerald-500/10 border-emerald-500/40"
                          : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold flex items-center gap-2">
                          <span>{it.title}</span>
                          {isAkiko ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-200">
                              Akiko Lens
                            </span>
                          ) : null}
                        </div>

                        <span className="text-[10px] text-slate-500">
                          {it.scope}:{it.who} / {it.level}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-300 mt-1">{it.why}</div>

                      {it.lens ? <div className="text-[11px] text-slate-400 mt-1">Lens: {it.lens}</div> : null}
                      {it.impact ? <div className="text-[11px] text-slate-400 mt-1">{it.impact}</div> : null}

                      {selected ? (
                        <div className="mt-2 text-[10px] text-slate-400">
                          Selected: <span className="font-mono">{id}</span>
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-[11px] text-slate-500">No insights</div>
            )}
          </div>

          {/* Tasks list（フィルタ後を描画） */}
          <div>
            <div className="text-[11px] text-slate-400 mb-2">
              Recommend Tasks{" "}
              {selectedInsightId ? <span className="text-slate-500">(filtered)</span> : <span className="text-slate-500">(all)</span>}
              <span className="ml-2 text-slate-500">/ {filteredTasks?.length ?? 0} items</span>
            </div>

            {filteredTasks?.length ? (
              <div className="space-y-2">
                {filteredTasks.map((t: any, idx: number) => (
                  <div key={t?.id ?? idx} className="rounded-lg bg-slate-900/60 px-3 py-2 border border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold">
                        {t.title ?? t.task}
                        {t.owner ? <span className="ml-2 text-[10px] text-slate-400">({t.owner})</span> : null}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {t.priority} / {t.scope} / {t.due} / {t.effortMin}m
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-300 mt-1">{t.why}</div>

                    {/* impact（Outcomeの根拠） */}
                    <div className="mt-1 text-[11px] text-slate-400">
                      Estimated impact: <span className="font-mono">CSAT +{pct1(t?.impact?.csatDelta ?? 0)}</span>{" "}
                      <span className="text-slate-500">(confidence {t?.impact?.confidence ?? "low"})</span>
                    </div>

                    {Array.isArray(t.steps) && t.steps.length ? (
                      <ul className="mt-2 list-disc pl-5 text-[11px] text-slate-400 space-y-1">
                        {t.steps.slice(0, 4).map((s: string, i: number) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-slate-500">No tasks{selectedInsightId ? " (filtered)" : ""}</div>
            )}
          </div>
        </section>

        {/* Overview */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
          <KpiCard label="総コール件数" value={totalCalls} caption={`${rowCount} records`} />
          <KpiCard label="平均 CSAT" value={avgCsat !== null ? `${avgCsat}%` : "-"} caption={`target ≥ ${CSAT_TARGET}%`} />
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
            value={escalationStatus === "missing_columns" ? "Missing columns" : escalationRate !== null ? `${escalationRate}%` : "-"}
            caption={
              escalationStatus === "missing_columns"
                ? "Resolution_Status が無い"
                : `escal ${escalationCount} / eligible ${escalationEligibleCount}`
            }
            status={escalationStatus === "missing_columns" ? "warn" : "ok"}
          />
        </section>

        {/* Trend (Daily) */}
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
                    <div className="text-[10px] text-slate-400">
                      {a.totalCalls} calls / {a.rowCount} records
                    </div>
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
