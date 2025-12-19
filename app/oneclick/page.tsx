"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Step =
  | "idle"
  | "uploading"
  | "cleaning"
  | "analyzing"
  | "building"
  | "done"
  | "error";

const STEP_LABEL: Record<Exclude<Step, "idle" | "done" | "error">, string> = {
  uploading: "アップロード中",
  cleaning: "クレンジング中",
  analyzing: "分析中",
  building: "結果生成中",
};

export default function OneClickPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [message, setMessage] = useState("CSVを選んで「ワンクリック実行」を押してください。");
  const [error, setError] = useState("");
  const [dots, setDots] = useState("");

  const busy = step !== "idle" && step !== "done" && step !== "error";

  useMemo(() => {
    if (!busy) {
      setDots("");
      return;
    }
    const id = window.setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 320);
    return () => window.clearInterval(id);
  }, [busy]);

  function reset() {
    setStep("idle");
    setMessage("CSVを選んで「ワンクリック実行」を押してください。");
    setError("");
  }

  async function runPipeline() {
    const f = fileRef.current?.files?.[0];
    if (!f) {
      setError("CSVファイルを選択してください。");
      return;
    }

    setError("");
    setStep("uploading");
    setMessage("処理を開始しました。少々お待ちください。");

    try {
      // 1) pre-process / clean
      setStep("cleaning");
      const fd = new FormData();
      fd.append("file", f);

      const cleanRes = await fetch("/api/clean", { method: "POST", body: fd });
      if (!cleanRes.ok) {
        const t = await cleanRes.text().catch(() => "");
        throw new Error(`clean failed: ${cleanRes.status}\n${t}`);
      }
      const cleanJson = await cleanRes.json();

      // 2) AI clean (mockでもOK)
      setStep("analyzing");
      const aiRes = await fetch("/api/ai-clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanJson),
      });

      if (!aiRes.ok) {
        const t = await aiRes.text().catch(() => "");
        throw new Error(`ai-clean failed: ${aiRes.status}\n${t}`);
      }
      const aiJson = await aiRes.json();

      // 3) build result (MVP: localStorage)
      setStep("building");
      localStorage.setItem("xentrix_last_result", JSON.stringify(aiJson));

      setStep("done");
      setMessage("完了しました。ダッシュボードへ移動します。");

      router.push("/dashboard");
      router.refresh();
    } catch (e: any) {
      setStep("error");
      setMessage("エラーが発生しました。");
      setError(e?.message ?? "Unknown error");
    }
  }

  const statusText =
    step === "idle"
      ? "待機中"
      : step === "done"
      ? "完了"
      : step === "error"
      ? "エラー"
      : `${STEP_LABEL[step]}${dots}`;

  return (
    <main className="min-h-screen bg-[#0B0F14] text-slate-100 flex justify-center">
      <div className="w-full max-w-3xl px-5 py-10">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              XENTRIX — One-Click Run
            </h1>
            <p className="text-sm text-slate-400 mt-2">
              CSV投入 → クレンジング → 分析 → ダッシュボード表示（MVP）
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/upload"
              className="text-xs text-slate-300 hover:text-white underline underline-offset-4"
            >
              検証ページ（/upload）
            </Link>
            <Link
              href="/dashboard"
              className="text-xs text-emerald-400 hover:underline"
            >
              Dashboard
            </Link>
          </div>
        </header>

        <section className="mt-7 rounded-2xl border border-slate-800 bg-[#0E141B] shadow-[0_0_0_1px_rgba(255,255,255,0.02)] p-6">
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-slate-800 bg-[#0B0F14] p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="text-sm text-slate-200 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-100 hover:file:bg-slate-700"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      setFileName(f?.name ?? "");
                      reset();
                    }}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={runPipeline}
                    disabled={busy}
                    className="rounded-xl px-4 py-2 text-sm font-semibold bg-emerald-500 text-black disabled:opacity-50"
                  >
                    ワンクリック実行
                  </button>
                  <button
                    onClick={reset}
                    disabled={busy}
                    className="rounded-xl px-3 py-2 text-sm border border-slate-700 text-slate-200 hover:bg-slate-900/40 disabled:opacity-50"
                  >
                    リセット
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  {fileName ? (
                    <>
                      Selected: <span className="text-slate-200">{fileName}</span>
                    </>
                  ) : (
                    "No file selected"
                  )}
                </div>

                <div className="text-xs">
                  <span className="text-slate-400">Status: </span>
                  <span
                    className={
                      step === "error"
                        ? "text-red-300"
                        : step === "done"
                        ? "text-emerald-400"
                        : "text-sky-300"
                    }
                  >
                    {statusText}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0B0F14] p-4">
              <p className="text-sm text-slate-300">{message}</p>

              {busy ? (
                <p className="mt-2 text-xs text-slate-500">
                  ※ 進捗は暫定表示です（後で実ステップと紐づけ可能）
                </p>
              ) : null}

              {error ? (
                <pre className="mt-3 text-xs text-red-300 whitespace-pre-wrap">
                  {error}
                </pre>
              ) : null}
            </div>
          </div>
        </section>

        <footer className="mt-5 text-xs text-slate-500">
          これはお客様向けの簡易導線。/upload は内部検証用に残します。
        </footer>
      </div>
    </main>
  );
}
