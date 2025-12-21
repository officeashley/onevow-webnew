import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { computeSummary } from "../lib/kpi/kpi";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockPath = path.resolve(__dirname, "../data/xentrix_clean_20rows_mock.json");
const mock = JSON.parse(fs.readFileSync(mockPath, "utf8"));

const rows = (mock?.cleanedRows ?? []) as any[];

const summary = computeSummary(rows);
console.log("Summary:", summary);

// 簡易assert（期待値は一回console見てから固定でOK）
if (summary.rowCount !== rows.length) throw new Error("rowCount mismatch");
if (summary.avgCsat === null) throw new Error("avgCsat should not be null (if data exists)");
if (summary.avgAht === null) throw new Error("avgAht should not be null (if data exists)");

console.log("Day2 smoke OK ✅");

