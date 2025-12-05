// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-xl rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">xentrix MVP</h1>
        <p className="mt-2 text-sm text-slate-600">
          コールセンターの生CSVを 1 クリックでクレンジングして、
          KPI・気づきコメントまで自動で出すツール（MVP版）です。
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/upload"
            className="rounded-lg border px-4 py-2 text-center text-sm font-medium"
          >
            CSV アップロードへ
          </Link>
          <Link
            href="/result"
            className="rounded-lg border px-4 py-2 text-center text-sm"
          >
            結果ページ（ダミー表示）を見る
          </Link>
        </div>
      </div>
    </main>
  );
}
