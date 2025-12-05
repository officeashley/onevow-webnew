// app/upload/page.tsx
import React from "react";

export default function UploadPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-xl rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">
          xentrix – CSV Upload
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          ここで生CSVをアップロードして、1クリックでクレンジングする画面になります。
          <br />
          今はまだ「枠」だけのダミーUIです（動作は後で実装）。
        </p>

        <div className="mt-6 space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            CSV ファイルを選択
          </label>
          <input
            type="file"
            accept=".csv"
            className="block w-full rounded-lg border px-3 py-2 text-sm"
          />

          <button
            type="button"
            className="mt-4 w-full rounded-lg border px-4 py-2 text-sm font-medium"
          >
            クレンジングを実行（ダミー）
          </button>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          ※ まだサーバー処理やAPI連携はしていません。UIの雰囲気だけ確認する段階です。
        </p>
      </div>
    </main>
  );
}
