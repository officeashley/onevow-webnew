// app/api/ai-clean/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { mockAiClean } from "@/lib/mockAiClean";

const USE_MOCK = process.env.AI_CLEAN_USE_MOCK === "1";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const mode: "strict" | "relaxed" =
      body.mode === "relaxed" ? "relaxed" : "strict";
    const rows = Array.isArray(body.rows) ? body.rows : [];

    // ★ コスト対策：とりあえず 20 行だけ送る
    const limitedRows = rows.slice(0, 20);

    if (!limitedRows.length) {
      return NextResponse.json(
        {
          mode,
          rowCount: 0,
          errorCount: 0,
          cleanedRows: [],
          error: "rows is empty",
        },
        { status: 400 }
      );
    }

    // ★ モックモードなら OpenAI を呼ばずに即返す
    if (USE_MOCK) {
      const result = mockAiClean({
        mode,
        rows: limitedRows,
      });
      return NextResponse.json(result);
    }

    // ここから先は「本番モード」のときだけ実行される
    const systemPrompt = `
あなたはコールセンターBPO向けの「通話ログクレンジングエンジン」です。
入力は1件ごとの通話レコードです。各レコードは次のフィールドを持ちます:

- Date
- AgentName
- CallsHandled
- AvgHandleTimeSeconds
- CSAT
- Adherence
- Compliance
- Notes
- Call_Type
- Issue_Type
- Resolution_Status
- コール開始時間
- コール終了時間

タスク:
1. フォーマットを統一し、明らかな誤りを修正する（数値・NULL・パーセント記号など）。
2. 変換ルールは事前に合意した仕様に従う（NUL/NULL 統一、％の除去、秒表記の数値化など）。
3. 情報が足りず確定できない場合は勝手に推測せず null のまま残す。
4. 出力は JSON スキーマに従うこと。
`;

    const userPrompt = `
mode: "${mode}"
rows: ${JSON.stringify(limitedRows, null, 2)}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini", // 安くて速いモデル
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      // JSONモード（schemaはゆるめ）
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "xentrix_clean_result",
          strict: false, // ★ 厳格チェックは一旦オフ
          schema: {
            type: "object",
            properties: {
              mode: { type: "string" },
              rowCount: { type: "integer" },
              errorCount: { type: "integer" },
              cleanedRows: {
                type: "array",
                items: {
                  type: "object",
                  // 行の中身はとりあえず自由（後で正式仕様に寄せていく）
                  additionalProperties: true,
                },
              },
            },
            required: ["mode", "rowCount", "errorCount", "cleanedRows"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = completion.choices[0].message.content;
    const result = content ? JSON.parse(content) : null;

    if (!result) {
      throw new Error("Empty result from OpenAI");
    }

    // 念のためサーバーログに usage を出しておく（トークン＆コスト確認用）
    console.log("ai-clean usage:", completion.usage);

    return NextResponse.json(result);
  } catch (err) {
    console.error("ai-clean error:", err);
    return NextResponse.json(
      {
        error: "AI clean failed",
        detail: String(err),
      },
      { status: 500 }
    );
  }
}
