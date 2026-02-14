import Link from "next/link";
import mockRows from "@/data/xentrix_kpi_mock_260.json";
import { CleanedRow, buildDailyKpis } from "@/lib/kpiEngine";

type Overview = {
  rowCount: number;
  avgCsat: number | null;
  avgAht: number | null;
};

export default async function AgentPage({
  params,
}: {
  // Next.js 16: params は Promise 扱い（sync access は将来廃止）
  params: Promise<{ agentName: string }>;
}) {
  const { agentName: raw } = await params;
  const agentName = decodeURIComponent(raw);

  const allRows = mockRows as CleanedRow[];
  const rows = allRows.filter((r) => r.AgentName === agentName);

  // agent が存在しない場合
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

  // ✅ computeOverview を使わず、このページ内で安全に集計（ビルド確実に通す）
  const overview: Overview = computeOverviewLocal(rows);

  const recordCount = overview.rowCount;
  const daily = buildDailyKpis(rows);

  return (
    <main className="min-h-screen bg-[#111111] text-slate-100 flex justify-center">
      <div className="w-full max-w-5xl px-4 py-6">
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

        {/* Overview cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <Card label="Records" value={recordCount} />
          <Card
            label="Avg CSAT"
            value={overview.avgCsat !== null ? `${overview.avgCsat}%` : "-"}
          />
          <Card
            label="Avg AHT"
            value={overview.avgAht !== null ? `${overview.avgAht}s` : "-"}
          />
        </section>

        {/* Daily trend list (MVP) */}
        <section className="rounded-2xl bg-[#1E1E1E] border border-slate-700/70 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Daily Trend</h2>
            <span className="text-[11px] text-slate-400">CSAT / AHT</span>
          </div>

          {daily.length === 0 ? (
            <p className="text-[11px] text-slate-400">No daily data</p>
          ) : (
            <div className="space-y-2">
              {daily.map((d: any) => (
                <div
                  key={d.date}
                  className="rounded-lg bg-slate-900/40 border border-slate-800 px-3 py-2 flex items-center justify-between text-[11px]"
                >
                  <div className="font-mono text-slate-300">{d.date}</div>
                  <div className="flex gap-4">
                    <div className="text-slate-300">
                      CSAT:{" "}
                      <span className="font-mono text-emerald-400">
                        {d.avgCsat !== null && d.avgCsat !== undefined
                          ? `${d.avgCsat}%`
                          : "-"}
                      </span>
                    </div>
                    <div className="text-slate-300">
                      AHT:{" "}
                      <span className="font-mono text-sky-300">
                        {d.avgAht !== null && d.avgAht !== undefined
                          ? `${d.avgAht}s`
                          : "-"}
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

// ✅ “rowCount / avgCsat / avgAht” をこのページで計算（型が揺れても落ちない）
function computeOverviewLocal(rows: any[]): Overview {
  const rowCount = rows.length;

  // csat 候補キー（データの列名が揺れても拾う）
  const csatVals = rows
    .map((r) => r.CSAT ?? r.csat ?? r.Csat ?? r.CustomerSatisfaction ?? null)
    .filter((v) => typeof v === "number" && !Number.isNaN(v)) as number[];

  // aht 候補キー
  const ahtVals = rows
    .map((r) => r.AHT ?? r.aht ?? r.Aht ?? r.AverageHandleTime ?? null)
    .filter((v) => typeof v === "number" && !Number.isNaN(v)) as number[];

  const avg = (arr: number[]) =>
    arr.length === 0
      ? null
      : Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;

  return {
    rowCount,
    avgCsat: avg(csatVals),
    avgAht: avg(ahtVals),
  };
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
