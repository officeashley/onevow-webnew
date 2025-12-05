// app/result/page.tsx
import React from "react";

export default function ResultPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-xl rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">
          xentrix – Cleansing Result
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          ここにクレンジング後のサマリーや、
          Top/Bottom Quartile、エラー行、ダウンロードボタンが並ぶ予定です。
          <br />
          今はプレースホルダーだけ表示しています。
        </p>

        <div className="mt-6 space-y-2 text-sm">
          <p>✅ Clean CSV / JSON ダウンロードボタン予定</p>
          <p>✅ KPI サマリー予定</p>
          <p>✅ 気づきコメント（AI）予定</p>
        </div>
      </div>
    </main>
  );
}
