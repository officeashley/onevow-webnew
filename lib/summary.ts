export interface CleanRow {
  CSAT: number | null;
  AvgHandleTimeSeconds: number | null;
  AgentName: string;
  // 必要なら他も
}

export function calcSummary(rows: CleanRow[]) {
  const total = rows.length;

  const csatValues = rows
    .map(r => r.CSAT)
    .filter((v): v is number => typeof v === "number");

  const ahtValues = rows
    .map(r => r.AvgHandleTimeSeconds)
    .filter((v): v is number => typeof v === "number");

  const avgCsat =
    csatValues.length > 0
      ? csatValues.reduce((a, b) => a + b, 0) / csatValues.length
      : null;

  const avgAht =
    ahtValues.length > 0
      ? ahtValues.reduce((a, b) => a + b, 0) / ahtValues.length
      : null;

  const lowCsatCount = rows.filter(r => (r.CSAT ?? 100) < 80).length;
  const highAhtCount = rows.filter(r => (r.AvgHandleTimeSeconds ?? 0) > 300).length;

  return {
    total,
    avgCsat,
    avgAht,
    lowCsatCount,
    highAhtCount,
  };
}
