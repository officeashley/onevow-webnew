// lib/kpi/rank.ts
import { quantile } from "@/lib/kpi/quantile";

export type MetricDirection = "higher_is_better" | "lower_is_better";

export type RankItem = {
  id: string;          // agentName など
  value: number | null;
  sample?: number;     // calls等（フィルタ用）
};

export type RankResult = {
  top: RankItem[];
  bottom: RankItem[];
  meta: {
    ratio: number;
    minItems: number;
    minSample: number;
    eligible: number;
    thresholdTop: number | null;
    thresholdBottom: number | null;
    reason?: string;
  };
};

function toFinite(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function pickTopBottomByQuantile(
  items: RankItem[],
  opts: {
    ratio: number;          // e.g. 0.1
    minItems?: number;      // e.g. 2
    minSample?: number;     // e.g. 30
    direction: MetricDirection;
  }
): RankResult {
  const ratio = Math.min(0.5, Math.max(0, opts.ratio));
  const minItems = opts.minItems ?? 2;
  const minSample = opts.minSample ?? 0;

  const eligible = (items ?? [])
    .map((x) => ({
      ...x,
      value: toFinite(x.value),
      sample: x.sample ?? 0,
    }))
    .filter((x) => x.value !== null && (x.sample ?? 0) >= minSample) as Array<
      Required<Pick<RankItem, "id" | "value" | "sample">>
    >;

  if (eligible.length === 0) {
    return {
      top: [],
      bottom: [],
      meta: {
        ratio,
        minItems,
        minSample,
        eligible: 0,
        thresholdTop: null,
        thresholdBottom: null,
        reason: "no_eligible_items",
      },
    };
  }

  // direction により「良い側」が違う
  // higher_is_better: top = high, bottom = low
  // lower_is_better : top = low,  bottom = high
  const values = eligible.map((x) => x.value);

  const qTop =
    opts.direction === "higher_is_better" ? 1 - ratio : ratio;
  const qBottom =
    opts.direction === "higher_is_better" ? ratio : 1 - ratio;

  const thresholdTop = ratio === 0 ? null : quantile(values, qTop);
  const thresholdBottom = ratio === 0 ? null : quantile(values, qBottom);

  // ratio=0 のときは空で返す
  if (ratio === 0 || thresholdTop === null || thresholdBottom === null) {
    return {
      top: [],
      bottom: [],
      meta: {
        ratio,
        minItems,
        minSample,
        eligible: eligible.length,
        thresholdTop,
        thresholdBottom,
        reason: "ratio_zero_or_threshold_null",
      },
    };
  }

  // top/bottom を閾値で抽出（同点が多い場合に人数が膨らむのはv1として許容）
  const top = eligible
    .filter((x) =>
      opts.direction === "higher_is_better" ? x.value >= thresholdTop : x.value <= thresholdTop
    )
    .sort((a, b) =>
      opts.direction === "higher_is_better" ? b.value - a.value : a.value - b.value
    );

  const bottom = eligible
    .filter((x) =>
      opts.direction === "higher_is_better" ? x.value <= thresholdBottom : x.value >= thresholdBottom
    )
    .sort((a, b) =>
      opts.direction === "higher_is_better" ? a.value - b.value : b.value - a.value
    );

  // 最低人数保障：足りない場合は「ソートして上位/下位からminItems取る」
  const sortedAll = [...eligible].sort((a, b) =>
    opts.direction === "higher_is_better" ? b.value - a.value : a.value - b.value
  );

  const ensuredTop = top.length >= minItems ? top : sortedAll.slice(0, Math.min(minItems, sortedAll.length));
  const ensuredBottom =
    bottom.length >= minItems
      ? bottom
      : [...sortedAll].reverse().slice(0, Math.min(minItems, sortedAll.length));

  return {
    top: ensuredTop,
    bottom: ensuredBottom,
    meta: {
      ratio,
      minItems,
      minSample,
      eligible: eligible.length,
      thresholdTop,
      thresholdBottom,
    },
  };
}
