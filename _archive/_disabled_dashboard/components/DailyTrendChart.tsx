"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type Point = {
  date: string;
  avgCsat: number | null;
  avgAht: number | null;
};

function fmtCsat(v: any) {
  if (v === null || v === undefined) return "-";
  return `${v}%`;
}
function fmtAht(v: any) {
  if (v === null || v === undefined) return "-";
  return `${v}s`;
}

export default function DailyTrendChart({
  data,
}: {
  data: Point[];
}) {
  // recharts は null を描画できるけど、Tooltipが微妙になるので値を整形
  const chartData = data.map((d) => ({
    date: d.date,
    avgCsat: d.avgCsat ?? undefined,
    avgAht: d.avgAht ?? undefined,
  }));

  return (
    <div className="rounded-2xl bg-[#1E1E1E] border border-slate-700/70 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Trend (Daily)</h2>
        <span className="text-[11px] text-slate-400">CSAT / AHT</span>
      </div>

      {chartData.length === 0 ? (
        <p className="text-[11px] text-slate-400">No data</p>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              {/* 左：CSAT */}
              <YAxis
                yAxisId="csat"
                tick={{ fontSize: 11 }}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}`}
              />
              {/* 右：AHT */}
              <YAxis
                yAxisId="aht"
                orientation="right"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v}`}
              />

              <Tooltip
                formatter={(value: any, name: any) => {
                  if (name === "avgCsat") return [fmtCsat(value), "CSAT"];
                  if (name === "avgAht") return [fmtAht(value), "AHT"];
                  return [value, name];
                }}
              />
              <Legend />

              <Line
                yAxisId="csat"
                type="monotone"
                dataKey="avgCsat"
                name="CSAT"
                dot={false}
              />
              <Line
                yAxisId="aht"
                type="monotone"
                dataKey="avgAht"
                name="AHT"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
