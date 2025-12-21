// lib/kpi/kpi.ts
import { normalizeRow } from "./normalize";

export type KpiSummary = {
  rowCount: number;
  csatCount: number;
  avgCsat: number | null;
  ahtCount: number;
  avgAht: number | null;
};

export function computeSummary(rows: any[]): KpiSummary {
  const normalized = rows.map(normalizeRow);

  const csat = normalized
    .map((r) => r.CSAT)
    .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));

  const aht = normalized
    .map((r) => r.AvgHandleTimeSeconds)
    .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));

  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 10) / 10 : null;

  return {
    rowCount: normalized.length,
    csatCount: csat.length,
    avgCsat: avg(csat),
    ahtCount: aht.length,
    avgAht: avg(aht),
  };
}
