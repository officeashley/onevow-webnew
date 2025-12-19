"use client";
import React, { useState } from "react";
import { StatusBanner } from "@/app/components/StatusBanner";
import { RawCleanCompareCard } from "@/app/components/RawCleanCompareCard";


// ✅ 追加：CSVプレビュー（表＋Download）
import CleanedCsvPreview from "@/app/components/CleanedCsvPreview";

// 🔧 フロント専用のモック結果（20 行ぶん）
import mockCleanResult from "@/data/xentrix_clean_20rows_mock.json";

type PreProcessResult = {
  rows: any[];
  errors: {
    row: number;
    column: string;
    type: string;
    message: string;
    raw?: string;
  }[];
};

type AiCleanResult = {
  mode: "strict" | "relaxed";
  rowCount: number;
  errorCount: number;
  cleanedRows: any[];
  errors?: { row: number; field: string; type: string; message: string }[];
  // 500 エラー時などに route.ts から返すフィールド（あれば）
  error?: string;
  detail?: string;
};

export default function UploadPage() {
  const [rawCsv, setRawCsv] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [preResult, setPreResult] = useState<PreProcessResult | null>(null);
  const [aiResult, setAiResult] = useState<AiCleanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // 🔧 フロントだけで完結させるかどうか（API を一切呼ばないモード）
  const [useMockOnly, setUseMockOnly] = useState(false);

  // ------- 集計用の値 --------
  const preRows = preResult?.rows?.length ?? 0;
  const preErrors = preResult?.errors?.length ?? 0;
  const aiRows = aiResult?.rowCount ?? 0;
  const aiErrors = aiResult?.errorCount ?? 0;
  const totalErrors = preErrors + aiErrors;
  const hasResult = !!preResult || !!aiResult;

  // ------- バナー用の値を組み立てる --------
  const hasCleanRows = aiRows > 0;

  let bannerStatus: "error" | "warning" | "success" = "success";
  let bannerTitle = "✅ データ品質 OK（厳格モード）";
  let bannerMessage = "";
  let bannerStats = "";

  if (aiResult?.error) {
    // サーバー側 500 などで error フィールドが返ってきた場合
    bannerStatus = "error";
    bannerTitle = "⚠ AI クレンジング中にエラーが発生しました";
    bannerMessage = aiResult.detail ?? aiResult.error;
  } else if (totalErrors > 0) {
    bannerStatus = "error";
    bannerTitle = "⚠ データに問題があります（厳格モード）";
    bannerMessage = "詳細はエラー一覧を確認してください。";
  } else if (!hasCleanRows) {
    bannerStatus = "warning";
    bannerTitle = "ℹ まだ AI クレンジングは実行されていません";
    bannerMessage =
      "CSV をアップロードし、「前処理 → AI 実行」を押してください。";
  }

  bannerStats = `rows: ${
    aiRows || preRows || 0
  } / errors: ${totalErrors}（前処理: ${preErrors} ／ AIクレンジング: ${aiErrors}）`;

  // ------- 「ワンクリック成果自動生成」用のローカル集計 --------
  const cleanedRows = (aiResult?.cleanedRows ?? []) as any[];

  const totalCount = cleanedRows.length;

  const csatValues = cleanedRows
    .map((r) => r.CSAT)
    .filter((v) => typeof v === "number") as number[];
  const ahtValues = cleanedRows
    .map((r) => r.AvgHandleTimeSeconds)
    .filter((v) => typeof v === "number") as number[];

  const avgCsat =
    csatValues.length > 0
      ? Math.round(
          (csatValues.reduce((sum, v) => sum + v, 0) / csatValues.length) * 10
        ) / 10
      : null;

  const avgAht =
    ahtValues.length > 0
      ? Math.round(
          (ahtValues.reduce((sum, v) => sum + v, 0) / ahtValues.length) * 10
        ) / 10
      : null;

  const lowCsatCount = cleanedRows.filter(
    (r) => typeof r.CSAT === "number" && r.CSAT < 80
  ).length;

  const highAhtCount = cleanedRows.filter(
    (r) =>
      typeof r.AvgHandleTimeSeconds === "number" &&
      r.AvgHandleTimeSeconds >= 300
  ).length;

  // ------- ファイル選択 -------
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // まずは .csv のみに制限（xlsx はあとで対応）
    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("まずは .csv ファイルだけテストしましょう（xlsx は後で対応）");
      return;
    }

    setFileName(file.name);

    const text = await file.text();
    setRawCsv(text);

    // 新しいファイルを入れたら結果はリセット
    setPreResult(null);
    setAiResult(null);
  };

  // ------- 前処理 → AIモック実行 もしくは 完全モックモード -------
  const handleRunPipeline = async () => {
    // 🔧 完全モックモード（API も CSV もいらない）
    if (useMockOnly) {
      setIsLoading(true);
      try {
        const mock = mockCleanResult as AiCleanResult;

        // pre-process 側は「cleanedRows をそのまま rows とみなした」モックを入れておく
        setPreResult({
          rows: (mock.cleanedRows ?? []) as any[],
          errors: [],
        });

        setAiResult(mock);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // ここから下は従来どおり API を叩くルート
    if (!rawCsv) return;

    setIsLoading(true);
    try {
      // ① 前処理（/api/clean）
      const preRes = await fetch("/api/clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: rawCsv }),
      });
      const preJson = (await preRes.json()) as PreProcessResult;
      setPreResult(preJson);

      // ② AI クレンジング（モック or 本番） /api/ai-clean
      const aiRes = await fetch("/api/ai-clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "strict",
          rows: preJson.rows,
        }),
      });

      if (!aiRes.ok) {
        // 500 などの場合はそのままエラーメッセージを右ペインに出す
        const errJson = (await aiRes.json()) as Partial<AiCleanResult>;
        setAiResult({
          mode: "strict",
          rowCount: 0,
          errorCount: 0,
          cleanedRows: [],
          ...errJson,
        });
        return;
      }

      const aiJson = (await aiRes.json()) as AiCleanResult;
      setAiResult(aiJson);

      console.log("pre-process:", preJson);
      console.log("ai-clean:", aiJson);
    } catch (e) {
      console.error(e);
      setAiResult({
        mode: "strict",
        rowCount: 0,
        errorCount: 0,
        cleanedRows: [],
        error: "AI clean failed",
        detail: String(e),
      });
      alert("パイプライン実行中にエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // ✅ ダークに統一
    <main className="min-h-screen flex items-center justify-center bg-[#0B1220] text-slate-100">
      <div className="w-full max-w-6xl rounded-2xl border border-slate-700/60 bg-[#0F172A] p-6 shadow-sm">
        <h1 className="text-xl font-semibold">XENTRIX – CSV Upload</h1>
        <p className="mt-1 text-sm text-slate-400">
          CSV をアップロードして、「前処理＋エラー検知 → AIクレンジング（モック）」まで一気に流れをテストします。
        </p>

        {/* 🔶 固定バナー（共通コンポーネント版） */}
        {hasResult && (
          <div className="mt-3">
            <StatusBanner
              status={bannerStatus}
              title={bannerTitle}
              message={bannerMessage}
              stats={bannerStats}
            />
          </div>
        )}

        {/* ファイル選択 & 実行ボタン */}
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="csv-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
              disabled={useMockOnly}
            />
            <label
              htmlFor="csv-input"
              className={`inline-flex cursor-pointer items-center rounded-md border px-4 py-2 text-sm font-medium ${
                useMockOnly
                  ? "bg-slate-700/40 text-slate-400 border-slate-600 cursor-not-allowed"
                  : "bg-slate-900 text-white border-slate-700 hover:bg-slate-800"
              }`}
            >
              CSV ファイルを選択
            </label>

            <button
              onClick={handleRunPipeline}
              disabled={(!fileName && !useMockOnly) || isLoading}
              className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-medium border ${
                (!fileName && !useMockOnly) || isLoading
                  ? "cursor-not-allowed bg-slate-700/40 text-slate-400 border-slate-600"
                  : "bg-emerald-600/90 text-white border-emerald-500/30 hover:bg-emerald-500"
              }`}
            >
              {isLoading
                ? "実行中..."
                : useMockOnly
                ? "モック JSON でプレビュー"
                : "前処理 → AI モック実行"}
            </button>

            <span className="text-xs text-slate-400">
              {useMockOnly
                ? "モック JSON モード中（CSV なしで UI を確認できます）"
                : fileName
                ? `選択中: ${fileName}`
                : "まだファイルが選択されていません。"}
            </span>
          </div>

          {/* モックモードのトグル */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <input
              id="use-mock-only"
              type="checkbox"
              checked={useMockOnly}
              onChange={(e) => {
                setUseMockOnly(e.target.checked);
                setPreResult(null);
                setAiResult(null);
              }}
              className="h-3 w-3"
            />
            <label htmlFor="use-mock-only">
              API を呼ばずにモック JSON だけでプレビュー（UI 開発用）
            </label>
          </div>
        </div>

        {/* 行数・エラー数のミニサマリ */}
        <div className="mt-3 text-[11px] md:text-xs text-slate-400 flex flex-wrap gap-3">
          <div>
            Rows (pre-process):{" "}
            <span className="font-mono text-slate-200">{preRows}</span>
          </div>
          <div>
            Errors (pre-process):{" "}
            <span className="font-mono text-slate-200">{preErrors}</span>
          </div>
          <div>
            AI Cleaned Rows:{" "}
            <span className="font-mono text-slate-200">{aiRows}</span>
          </div>
        </div>

        {/* 3ペイン表示 */}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {/* Raw CSV */}
          <div className="rounded-xl bg-slate-900 p-3 text-[11px] md:text-xs text-slate-100 border border-slate-800">
            <div className="mb-1 font-semibold text-slate-200">
              Raw CSV（先頭だけプレビュー）
            </div>
            <textarea
              readOnly
              className="mt-1 h-[26rem] w-full resize-none rounded-lg bg-slate-950/60 p-2 font-mono text-[10px] md:text-[11px] leading-4 text-slate-100 outline-none border border-slate-800/60"
              value={
                rawCsv && !useMockOnly
                  ? rawCsv.slice(0, 4000)
                  : useMockOnly
                  ? "モック JSON モード中のため、CSV は使用していません。"
                  : "まだファイルが選択されていません。"
              }
            />
          </div>

          {/* Pre-process Result */}
          <div className="rounded-xl bg-slate-900 p-3 text-[11px] md:text-xs text-slate-100 border border-slate-800">
            <div className="mb-1 flex items-center justify-between text-slate-200">
              <span className="font-semibold">
                Pre-process Result (/api/clean)
              </span>
            </div>
            <textarea
              readOnly
              className="mt-1 h-[26rem] w-full resize-none rounded-lg bg-slate-950/60 p-2 font-mono text-[10px] md:text-[11px] leading-4 text-slate-100 outline-none border border-slate-800/60"
              value={
                preResult
                  ? JSON.stringify(preResult, null, 2)
                  : "まだ実行されていません。"
              }
            />
          </div>

          {/* AI Clean Result ＋ サマリー ＋ ✅CSVプレビュー */}
          <div className="rounded-xl bg-slate-900 p-3 text-[11px] md:text-xs text-slate-100 flex flex-col gap-3 border border-slate-800">
            <div>
              <div className="mb-1 flex items-center justify-between text-slate-200">
                <span className="font-semibold">
                  AI Clean Result (mock) (/api/ai-clean)
                </span>
                <span className="text-[10px]">
                  rows: <span className="font-mono">{aiRows}</span> / errors:{" "}
                  <span className="font-mono">{aiErrors}</span>
                </span>
              </div>
              <textarea
                readOnly
                className="mt-1 h-[18rem] w-full resize-none rounded-lg bg-slate-950/60 p-2 font-mono text-[10px] md:text-[11px] leading-4 text-slate-100 outline-none border border-slate-800/60"
                value={
                  aiResult
                    ? JSON.stringify(aiResult, null, 2)
                    : "まだ AI クレンジングは実行されていません。"
                }
              />
            </div>

            {/* 🔷 サマリー（ローカル計算） */}
            <div className="rounded-lg bg-slate-800/60 p-3 text-[11px] md:text-xs text-slate-100 border border-slate-700/60">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold">サマリー（ローカル計算）</span>
                <span className="text-[10px] text-slate-300">
                  cleanedRows ベース
                </span>
              </div>
              <RawCleanCompareCard
  title="Raw vs Clean（差分比較）"
  rawRows={preResult?.rows ?? []}
  cleanRows={aiResult?.cleanedRows ?? []}
  maxRows={50}
/>

              {totalCount === 0 ? (
                <p className="text-[10px] text-slate-400">
                  まだ AI クレンジング結果がありません。
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-slate-400">総件数</div>
                    <div className="font-mono text-sm">{totalCount}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">平均 CSAT</div>
                    <div className="font-mono text-sm">
                      {avgCsat !== null ? `${avgCsat}` : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">
                      平均 AHT（秒）
                    </div>
                    <div className="font-mono text-sm">
                      {avgAht !== null ? `${avgAht}` : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">
                      CSAT &lt; 80 の件数
                    </div>
                    <div className="font-mono text-sm">{lowCsatCount}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">
                      AHT ≧ 300 秒の件数
                    </div>
                    <div className="font-mono text-sm">{highAhtCount}</div>
                  </div>
                </div>
              )}
            </div>

            {/* ✅ ここが追加：Cleaned CSV Preview（表＋Download） */}
            <CleanedCsvPreview
              cleanedRows={(aiResult?.cleanedRows ?? []) as Record<string, any>[]}
              title="AI Clean Result (CSV Preview)"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
