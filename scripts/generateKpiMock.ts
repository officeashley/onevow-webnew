// xentrix/scripts/generateKpiMock.ts
import fs from "fs";
import path from "path";

type CleanedRow = {
  Date: string;
  AgentName: string;
  CallsHandled: number;
  AvgHandleTimeSeconds: number;
  CSAT: number;
  Adherence: number;
  Compliance: number;
  Call_Type: string;
  Issue_Type: string;
  Resolution_Status: string;
};

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function iso(d: Date) {
  // Next.js 側で扱いやすいように ISO
  return d.toISOString().slice(0, 19);
}

function main() {
  const N = 260; // 200〜300の真ん中
  const agents = ["Akari", "Kenji", "Mei", "Taro", "Yui"];

  const callTypes = ["Inbound", "Outbound"];
  const issueTypes = ["注文", "請求", "技術", "返品", "クレーム", "フォロー"];
  const statuses = ["Resolved", "Partially Resolved", "Escalated"];

  // “今日/週/月” を作りやすくするため、直近30日ぶんを生成
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 29);

  const rows: CleanedRow[] = [];

  for (let i = 0; i < N; i++) {
    const dayOffset = randInt(0, 29);
    const d = new Date(start);
    d.setDate(start.getDate() + dayOffset);

    // 9:00〜18:50のどこか
    d.setHours(randInt(9, 18), randInt(0, 59), 0, 0);

    const agent = pick(agents);

    // CallsHandled は1レコード内の小さめバッチ
    const calls = randInt(10, 35);

    // AHT：優秀〜要注意のばらつき（200〜420 sec）
    let aht = randInt(220, 380);
    // たまに悪化
    if (Math.random() < 0.12) aht = randInt(360, 450);
    aht = clamp(aht, 180, 480);

    // CSAT：AHTが悪いと落ちやすい相関を少しだけ
    let csat = randInt(75, 96);
    csat = csat - Math.floor((aht - 280) / 25);
    // たまにクレーム系で落ちる
    if (Math.random() < 0.08) csat -= randInt(10, 18);
    csat = clamp(csat, 50, 100);

    // Adherence/Compliance：大体高め
    let adh = clamp(randInt(90, 99) - (aht > 360 ? randInt(0, 3) : 0), 80, 100);
    let comp = clamp(randInt(94, 100) - (csat < 70 ? randInt(0, 3) : 0), 80, 100);

    const issue = pick(issueTypes);
    const callType = pick(callTypes);

    let status = "Resolved";
    if (csat < 70 || aht > 380) status = pick(["Partially Resolved", "Escalated"]);
    else if (Math.random() < 0.08) status = "Partially Resolved";

    rows.push({
      Date: iso(d),
      AgentName: agent,
      CallsHandled: calls,
      AvgHandleTimeSeconds: aht,
      CSAT: csat,
      Adherence: adh,
      Compliance: comp,
      Call_Type: callType,
      Issue_Type: issue,
      Resolution_Status: status,
    });
  }

  // 出力先：xentrix/data/xentrix_kpi_mock_260.json
  const outDir = path.join(process.cwd(), "data");
  const outPath = path.join(outDir, "xentrix_kpi_mock_260.json");

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(rows, null, 2), "utf-8");

  console.log(`✅ wrote: ${outPath} (${rows.length} rows)`);
}

main();
