// lib/toCsv.ts
export function toCsv(rows: Record<string, any>[]) {
  if (!rows || rows.length === 0) return "";

  // 全行に存在するキーを集めて、列順を安定化
  const headerSet = new Set<string>();
  rows.forEach((r) => Object.keys(r ?? {}).forEach((k) => headerSet.add(k)));
  const headers = Array.from(headerSet);

  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    // CSV的に危ない文字があればダブルクォートで囲う
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r?.[h])).join(",")),
  ];
  return lines.join("\n");
}
