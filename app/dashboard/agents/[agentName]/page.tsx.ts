import Link from "next/link";
import mockRows from "@/data/xentrix_kpi_mock_260.json";

import {
  CleanedRow,
  computeOverview,
  buildDailyKpis,
} from "@/lib/kpiEngine";

export default function AgentPage({
  params,
}: {
  params: { agentName: string };
}) {
  // URLで日本語やスペースが来ても壊れないように decode
  const agentName = decodeURIComponent(params.agentName);

  const allRows = mockRows as CleanedRow[];
  const rows = allRows.filter((r) => r.AgentName === agentName);

  const overview = computeOverview(rows);
  const daily = buildDailyKpis(rows);

  // agentが存在しない場合
  if (rows.length === 0) {
    return (
      <main className="min-h-screen bg-[#111111] text-slate-100 flex justify-center">
        <div className="w-full max-w-5xl px-4 py-6">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold">Agent: {agentName}</h1>
            <Link
              href="/dashboard"
              className="text-[12px] text-emerald-400 hover:underline"
            >
              ← Back to Dashboard
            </Link>
          </div>

          <div className="rounded-2xl bg-[#1E1E1E] border border-slate-700/70 p-4 text-sm text-slate-300">
            No records for this agent.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#111111] text-slate-100 flex justify-center">
      <div className="w-full max-w-5xl px-4 py-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Agent: {agentName}</h1>
            <p className="text-sm text-slate-400 mt-1">
              Drill-down view (mock / local calc)
            </p>
          </div>

          <Link
            href="/dashboard"
            className="text-[12px] text-emerald-400 hover:underline"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Overview */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <Card label="Records" value={overview.rowCount} />
          <Card
            label="Avg CSAT"
            value={overview.avgCsat !== null ? `${overview.avgCsat}%` : "-"}
          />
          <Card
            label="Avg AHT"
            value={overview.avgAht !== null ? `${overview.avgAht}s` : "-"}
          />
        </section>

        {/* Daily Trend (MVP) */}
        <section className="rounded-2xl bg-[#1E1E1E] border border-slate-700/70 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Daily Trend</h2>
            <span className="text-[11px] text-slate-400">CSAT / AHT</span>
          </div>

          {daily.length === 0 ? (
            <p className="text-[11px] text-slate-400">No daily data</p>
          ) : (
            <div className="space-y-2">
              {daily.map((d) => (
                <div
                  key={d.date}
                  className="rounded-lg bg-slate-900/40 border border-slate-800 px-3 py-2 flex items-center justify-between text-[11px]"
                >
                  <div className="font-mono text-slate-300">{d.date}</div>
                  <div className="flex gap-4">
                    <div className="text-slate-300">
                      CSAT:{" "}
                      <span className="font-mono text-emerald-400">
                        {d.avgCsat !== null ? `${d.avgCsat}%` : "-"}
                      </span>
                    </div>
                    <div className="text-slate-300">
                      AHT:{" "}
                      <span className="font-mono text-sky-300">
                        {d.avgAht !== null ? `${d.avgAht}s` : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Card(props: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-[#1E1E1E] border border-slate-700/70 px-4 py-3">
      <div className="text-[11px] text-slate-400">{props.label}</div>
      <div className="mt-1 text-xl font-semibold text-emerald-400">
        {props.value}
      </div>
    </div>
  );
}
