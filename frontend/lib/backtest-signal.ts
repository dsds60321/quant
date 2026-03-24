import type { BacktestResult } from "@/lib/api";

export type SignalTone = "buy" | "sell" | "hold";

export type SignalOverlayMarker = {
  date: string;
  label: string;
  tone: SignalTone;
  description: string;
  buyCount: number;
  sellCount: number;
  holdCount: number;
};

type SignalSummary = {
  buyCount: number;
  sellCount: number;
  holdCount: number;
  dominantSignal: "BUY" | "SELL" | "HOLD";
};

function toSignalTone(signal: string): SignalTone {
  if (signal === "BUY") {
    return "buy";
  }
  if (signal === "SELL") {
    return "sell";
  }
  return "hold";
}

function formatMarkerLabel(buyCount: number, sellCount: number, holdCount: number) {
  const segments: string[] = [];
  if (buyCount > 0) {
    segments.push(`B${buyCount}`);
  }
  if (sellCount > 0) {
    segments.push(`S${sellCount}`);
  }
  if (holdCount > 0) {
    segments.push(`H${holdCount}`);
  }
  return segments.join(" ") || "H0";
}

export function buildSignalOverlayMarkers(signalTimeline?: BacktestResult["signalTimeline"]): SignalOverlayMarker[] {
  const grouped = new Map<string, { buyCount: number; sellCount: number; holdCount: number; symbols: Set<string>; patterns: Set<string> }>();

  for (const item of signalTimeline ?? []) {
    const bucket = grouped.get(item.date) ?? {
      buyCount: 0,
      sellCount: 0,
      holdCount: 0,
      symbols: new Set<string>(),
      patterns: new Set<string>(),
    };

    if (item.signal === "BUY") {
      bucket.buyCount += 1;
    } else if (item.signal === "SELL") {
      bucket.sellCount += 1;
    } else {
      bucket.holdCount += 1;
    }

    bucket.symbols.add(item.symbol);
    if (item.pattern) {
      bucket.patterns.add(item.pattern);
    }
    grouped.set(item.date, bucket);
  }

  return Array.from(grouped.entries())
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .map(([date, bucket]) => {
      const dominantSignal = bucket.sellCount > 0 ? "SELL" : bucket.buyCount > 0 ? "BUY" : "HOLD";
      const symbolPreview = Array.from(bucket.symbols).slice(0, 3).join(", ");
      const patternPreview = Array.from(bucket.patterns).slice(0, 2).join(", ");

      return {
        date,
        label: formatMarkerLabel(bucket.buyCount, bucket.sellCount, bucket.holdCount),
        tone: toSignalTone(dominantSignal),
        description: `${symbolPreview || "종목 없음"}${patternPreview ? ` · ${patternPreview}` : ""}`,
        buyCount: bucket.buyCount,
        sellCount: bucket.sellCount,
        holdCount: bucket.holdCount,
      };
    });
}

export function summarizeSignalState(result?: Pick<BacktestResult, "stockBreakdown" | "signalTimeline"> | null): SignalSummary {
  const counts = {
    buyCount: 0,
    sellCount: 0,
    holdCount: 0,
  };

  for (const stock of result?.stockBreakdown ?? []) {
    if (stock.signal === "BUY") {
      counts.buyCount += 1;
    } else if (stock.signal === "SELL") {
      counts.sellCount += 1;
    } else if (stock.signal === "HOLD") {
      counts.holdCount += 1;
    }
  }

  if (counts.buyCount === 0 && counts.sellCount === 0 && counts.holdCount === 0) {
    const latestBySymbol = new Map<string, string>();
    for (const item of result?.signalTimeline ?? []) {
      latestBySymbol.set(item.symbol, item.signal);
    }
    for (const signal of latestBySymbol.values()) {
      if (signal === "BUY") {
        counts.buyCount += 1;
      } else if (signal === "SELL") {
        counts.sellCount += 1;
      } else {
        counts.holdCount += 1;
      }
    }
  }

  const dominantSignal = counts.sellCount > counts.buyCount && counts.sellCount >= counts.holdCount
    ? "SELL"
    : counts.buyCount > counts.holdCount
      ? "BUY"
      : "HOLD";

  return {
    ...counts,
    dominantSignal,
  };
}

export function getBestPatternName(result?: Pick<BacktestResult, "patternBreakdown"> | null): string | null {
  const bestPattern = (result?.patternBreakdown ?? []).reduce<NonNullable<BacktestResult["patternBreakdown"]>[number] | null>(
    (best, pattern) => (best == null || pattern.avgReturnPercent > best.avgReturnPercent ? pattern : best),
    null,
  );

  return bestPattern?.name ?? null;
}
