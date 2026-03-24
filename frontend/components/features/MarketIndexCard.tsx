"use client";

import { useMemo, useState } from "react";
import { MarketCandlestickChart } from "@/components/features/MarketCandlestickChart";
import { MetricCard } from "@/components/ui/MetricCard";
import type { MarketCandle, MarketIndex } from "@/lib/api";
import { formatPercent } from "@/lib/format";

function normalizeCandles(candles?: MarketCandle[] | null): MarketCandle[] {
  return (Array.isArray(candles) ? candles : []).filter(
    (item): item is MarketCandle =>
      Boolean(item)
      && typeof item.date === "string"
      && [item.open, item.high, item.low, item.close, item.volume].every((value) => typeof value === "number" && Number.isFinite(value)),
  );
}

function computeRangeChange(candles: MarketCandle[]): number {
  if (candles.length < 2) {
    return 0;
  }
  const first = candles[0]?.close ?? 0;
  const last = candles[candles.length - 1]?.close ?? 0;
  if (!first) {
    return 0;
  }
  return ((last / first) - 1) * 100;
}

export function MarketIndexCard({ index, ranges }: { index: MarketIndex; ranges: string[] }) {
  const safeRanges = ranges.length > 0 ? ranges : ["5일"];
  const [activeRange, setActiveRange] = useState(safeRanges[0] ?? "5일");

  const activeCandles = useMemo(() => {
    const ranged = index.rangeCandles?.[activeRange];
    const normalizedRanged = normalizeCandles(ranged);
    if (normalizedRanged.length > 0) {
      return normalizedRanged;
    }
    return normalizeCandles(index.candles);
  }, [activeRange, index.candles, index.rangeCandles]);

  const lastClose = activeCandles[activeCandles.length - 1]?.close ?? index.lastPrice;
  const changePercent = activeCandles.length > 1 ? computeRangeChange(activeCandles) : index.changePercent;
  const accent = changePercent > 0 ? "buy" : changePercent < 0 ? "sell" : "kpi";

  return (
    <div className="space-y-3 ui-card p-3">
      <MetricCard
        label={index.name}
        value={lastClose.toLocaleString("ko-KR")}
        change={`${activeRange} 변동률 ${formatPercent(changePercent)}`}
        accent={accent}
      />
      <MarketCandlestickChart
        candles={index.candles ?? []}
        rangeCandles={index.rangeCandles ?? {}}
        ranges={safeRanges}
        activeRange={activeRange}
        onRangeChange={setActiveRange}
      />
    </div>
  );
}
