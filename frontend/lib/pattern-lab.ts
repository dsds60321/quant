import type { BacktestResult, MarketCandle, StockDataDetail } from "@/lib/api";
import type { QuantPattern, SignalPlan } from "@/lib/quant-workbench";

export type PatternExecutionModel = "SIGNAL_CLOSE" | "NEXT_OPEN" | "BREAKOUT_PRICE" | "BREAKOUT_SLIPPAGE" | "VWAP_PROXY";
export type PatternLabSignalType = "BUY" | "SELL" | "HOLD" | "NONE";
export type PatternLabViewMode = "grid" | "focus";
export type PatternLabPriceLevelType = "trigger" | "buy" | "buyRangeLow" | "buyRangeHigh" | "stop" | "target1" | "target2" | "sell";
export type PatternLabZoneType = "BUY" | "SELL" | "HOLD" | "DETECTION";

type BacktestStockLike = NonNullable<BacktestResult["stockBreakdown"]>[number];

type OpenTradeState = {
  patternId: string;
  patternName: string;
  stockName: string;
  symbol: string;
  entryDate: string;
  entryPrice: number;
  triggerPrice: number;
  stopPrice: number;
  targetPrice1: number;
  targetPrice2: number;
  entryRangeLow: number;
  entryRangeHigh: number;
  reason: string;
  entryIndex: number;
  highestHigh: number;
  lowestLow: number;
  highestClose: number;
  lastPrice: number;
};

type PatternEvaluation = {
  triggered: boolean;
  triggerPrice: number;
  signalPrice: number;
  momentumPercent: number;
  slopePercent: number;
  volumeRatio: number;
  reason: string;
  detectionStartIndex?: number;
  detectionEndIndex?: number;
  stopPrice?: number;
  targetPrice1?: number;
  targetPrice2?: number;
};

export type PatternLabPricePlan = {
  triggerPrice: number;
  recommendedBuyPrice: number;
  entryRangeLow: number;
  entryRangeHigh: number;
  entryDistancePercent: number;
  entryAllowed: boolean;
  stopPrice: number;
  trailingStopPrice: number;
  targetPrice1: number;
  targetPrice2: number;
  recommendedSellPrice: number;
  expectedExitPrice: number;
  realizedExitPrice: number | null;
  expectedReturnPercent: number;
  expectedReturnPercent2: number;
  realizedReturnPercent: number | null;
  riskReward: number;
  splitExitRatio: string;
  executionModel: PatternExecutionModel;
  executionLabel: string;
};

export type PatternLabSignalRow = {
  id: string;
  symbol: string;
  stockName: string;
  patternId: string;
  patternName: string;
  signalDate: string;
  signalType: PatternLabSignalType;
  signalPrice: number;
  currentPrice: number;
  signalReason: string;
  recommendation: PatternLabPricePlan;
  openPosition: boolean;
  detectionStartDate?: string | null;
  detectionEndDate?: string | null;
};

export type PatternLabTradeRow = {
  id: string;
  symbol: string;
  stockName: string;
  patternId: string;
  patternName: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string | null;
  exitPrice: number | null;
  holdingDays: number;
  returnPercent: number | null;
  expectedExitPrice: number;
  mfePercent: number;
  maePercent: number;
  exitReason: string;
  openPosition: boolean;
  currentState: PatternLabSignalType;
  recommendation: PatternLabPricePlan;
};

export type PatternLabRecommendationRow = {
  symbol: string;
  stockName: string;
  patternId: string;
  patternName: string;
  currentPrice: number;
  signalDate: string;
  signalType: PatternLabSignalType;
  triggerPrice: number;
  recommendedBuyPrice: number;
  entryRangeLow: number;
  entryRangeHigh: number;
  entryDistancePercent: number;
  entryAllowed: boolean;
  stopPrice: number;
  trailingStopPrice: number;
  targetPrice1: number;
  targetPrice2: number;
  recommendedSellPrice: number;
  expectedExitPrice: number;
  realizedExitPrice: number | null;
  expectedReturnPercent: number;
  expectedReturnPercent2: number;
  realizedReturnPercent: number | null;
  riskReward: number;
  splitExitRatio: string;
  executionLabel: string;
  latestUpdatedAt: string;
  openPosition: boolean;
};

export type PatternLabChartMarker = {
  id: string;
  date: string;
  signalType: PatternLabSignalType;
  label: string;
  patternId: string;
  patternName: string;
  signalPrice: number;
  recommendation: PatternLabPricePlan;
  signalReason: string;
  openPosition: boolean;
  entryDate?: string | null;
  exitDate?: string | null;
  entryPrice?: number | null;
  exitPrice?: number | null;
  returnPercent?: number | null;
  exitReason?: string | null;
  mfePercent?: number | null;
  maePercent?: number | null;
  holdingDays?: number | null;
};

export type PatternLabHoldingRange = {
  id: string;
  patternId: string;
  patternName: string;
  startDate: string;
  endDate: string;
  openPosition: boolean;
  entryPrice: number;
  currentPrice: number;
  currentReturnPercent: number;
  stopPrice: number;
  trailingStopPrice: number;
  targetPrice1: number;
  targetPrice2: number;
  expectedExitPrice: number;
  holdingDays: number;
};

export type PatternLabSignalZone = {
  id: string;
  patternId: string;
  patternName: string;
  zoneType: PatternLabZoneType;
  label: string;
  startDate: string;
  endDate: string;
  signalDate: string | null;
  signalPrice: number | null;
  entryDate: string | null;
  exitDate: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
  currentPrice: number | null;
  returnPercent: number | null;
  holdingDays: number | null;
  mfePercent: number | null;
  maePercent: number | null;
  reason: string;
  openPosition: boolean;
  recommendation: PatternLabPricePlan | null;
};

export type PatternLabPriceLevel = {
  id: string;
  type: PatternLabPriceLevelType;
  value: number;
  label: string;
  tone: "buy" | "sell" | "hold" | "neutral";
  patternId: string;
  patternName: string;
  signalDate: string;
  signalType: PatternLabSignalType;
  recommendation: PatternLabPricePlan;
};

export type PatternLabPatternSummary = {
  patternId: string;
  name: string;
  shortLabel: string;
  description: string;
  appliedStockCount: number;
  signalCount: number;
  tradeCount: number;
  recentSignalCount: number;
  averageReturnPercent: number;
  medianReturnPercent: number;
  winRate: number;
  cagr: number;
  maxDrawdown: number;
  sharpe: number;
  avgHoldingDays: number;
  recentTrend: number;
  latest20Summary: string;
};

export type PatternLabMatrixCell = {
  symbol: string;
  patternId: string;
  returnPercent: number | null;
  winRate: number;
  latestSignal: PatternLabSignalType;
  latestSignalDate: string | null;
};

export type PatternLabStockSummary = {
  symbol: string;
  name: string;
  market: string;
  sector: string;
  currentPrice: number;
  backtestReturnPercent: number;
  backtestContributionPercent: number;
  cumulativeReturnPercent: number;
  cagr: number;
  maxDrawdown: number;
  winRate: number;
  tradeCount: number;
  avgHoldingDays: number;
  currentState: PatternLabSignalType;
  currentRecommendation: PatternLabRecommendationRow | null;
  recentSignalDate: string | null;
  recentPatternSignal: string;
  selectedPatternCount: number;
  sparkline: number[];
  inclusionCount: number;
  finalScore: number;
  distanceTo52WeekHigh: number | null;
  momentumScore: number | null;
  liquidityStatus: string;
  currentVolume: number;
};

export type PatternLabStockCard = {
  summary: PatternLabStockSummary;
  candles: MarketCandle[];
  markers: PatternLabChartMarker[];
  holdingRanges: PatternLabHoldingRange[];
  zones: PatternLabSignalZone[];
  priceLevels: PatternLabPriceLevel[];
  signals: PatternLabSignalRow[];
  trades: PatternLabTradeRow[];
  dominantPatternId: string | null;
  dominantPatternName: string | null;
};

export type PatternLabResult = {
  stocks: PatternLabStockCard[];
  signals: PatternLabSignalRow[];
  trades: PatternLabTradeRow[];
  patterns: PatternLabPatternSummary[];
  matrix: PatternLabMatrixCell[];
  recommendations: PatternLabRecommendationRow[];
  bestStock: PatternLabStockSummary | null;
  bestPattern: PatternLabPatternSummary | null;
};

export type PatternLabInput = {
  detailsBySymbol: Record<string, StockDataDetail>;
  backtest: BacktestResult | null;
  selectedSymbols: string[];
  patterns: QuantPattern[];
  signalPlan: SignalPlan;
  executionModel: PatternExecutionModel;
  startDate?: string | null;
  endDate?: string | null;
  candidateScores?: Record<string, number>;
};

const EXECUTION_MODEL_LABELS: Record<PatternExecutionModel, string> = {
  SIGNAL_CLOSE: "신호 캔들 종가 기준",
  NEXT_OPEN: "다음 봉 시가 기준",
  BREAKOUT_PRICE: "돌파 가격 기준",
  BREAKOUT_SLIPPAGE: "돌파 가격 + 슬리피지 기준",
  VWAP_PROXY: "VWAP 근사 기준",
};

function toFixedNumber(value: number, digits = 2) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Number(value.toFixed(digits));
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[]) {
  if (values.length <= 1) {
    return 0;
  }
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function formatDateDiff(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function toCandles(detail: StockDataDetail, startDate?: string | null, endDate?: string | null): MarketCandle[] {
  return detail.priceSeries
    .filter((point) => {
      if (startDate && point.date < startDate) {
        return false;
      }
      if (endDate && point.date > endDate) {
        return false;
      }
      const close = point.adjClose ?? point.close;
      return close != null && Number.isFinite(close);
    })
    .map((point) => {
      const close = point.adjClose ?? point.close ?? 0;
      const open = point.open ?? close;
      const high = point.high ?? Math.max(open, close);
      const low = point.low ?? Math.min(open, close);
      return {
        date: point.date,
        open,
        high,
        low,
        close,
        volume: point.volume ?? 0,
      };
    });
}

function calculateMomentumPercent(candles: MarketCandle[], endIndex: number, lookbackDays: number) {
  const startIndex = Math.max(0, endIndex - lookbackDays);
  const basePrice = candles[startIndex]?.close ?? candles[endIndex]?.close ?? 0;
  const currentPrice = candles[endIndex]?.close ?? 0;
  if (basePrice <= 0 || currentPrice <= 0) {
    return 0;
  }
  return ((currentPrice / basePrice) - 1) * 100;
}

function calculateSlopePercent(candles: MarketCandle[], endIndex: number, lookbackDays: number) {
  const window = candles.slice(Math.max(0, endIndex - lookbackDays + 1), endIndex + 1);
  if (window.length <= 1) {
    return 0;
  }
  const xs = window.map((_, index) => index + 1);
  const ys = window.map((item) => item.close);
  const avgX = average(xs);
  const avgY = average(ys);
  const numerator = xs.reduce((sum, x, index) => sum + (x - avgX) * (ys[index] - avgY), 0);
  const denominator = xs.reduce((sum, x) => sum + (x - avgX) ** 2, 0);
  if (denominator === 0 || avgY === 0) {
    return 0;
  }
  const slope = numerator / denominator;
  return (slope / avgY) * 100;
}

function calculateReturns(candles: MarketCandle[], period = 20) {
  const output: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1]?.close ?? 0;
    const current = candles[index]?.close ?? 0;
    if (previous <= 0 || current <= 0) {
      continue;
    }
    output.push((current / previous) - 1);
  }
  return output.slice(-period);
}

function calculateRollingHigh(candles: MarketCandle[], endIndex: number, lookbackDays: number) {
  const window = candles.slice(Math.max(0, endIndex - lookbackDays + 1), endIndex + 1);
  return Math.max(...window.map((item) => item.high), 0);
}

function calculateRollingLow(candles: MarketCandle[], endIndex: number, lookbackDays: number) {
  const window = candles.slice(Math.max(0, endIndex - lookbackDays + 1), endIndex + 1);
  return Math.min(...window.map((item) => item.low), Number.POSITIVE_INFINITY);
}

function calculateAverageVolume(candles: MarketCandle[], endIndex: number, lookbackDays: number) {
  const window = candles.slice(Math.max(0, endIndex - lookbackDays + 1), endIndex + 1);
  return average(window.map((item) => item.volume || 0));
}

function calculateVolumeRatioAt(candles: MarketCandle[], index: number, lookbackDays: number) {
  const averageVolume = calculateAverageVolume(candles, index, lookbackDays);
  const currentVolume = candles[index]?.volume ?? 0;
  return averageVolume > 0 ? currentVolume / averageVolume : 1;
}

function calculateAverageTrueRange(candles: MarketCandle[], endIndex: number, lookbackDays: number) {
  const startIndex = Math.max(1, endIndex - lookbackDays + 1);
  const ranges: number[] = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    const candle = candles[index];
    const previousClose = candles[index - 1]?.close ?? candle?.close ?? 0;
    if (!candle) {
      continue;
    }
    ranges.push(Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose)));
  }
  return average(ranges);
}

function findRecentPivotLow(candles: MarketCandle[], startIndex: number, endIndex: number, pivotSpan = 2) {
  const leftBound = Math.max(startIndex + pivotSpan, pivotSpan);
  const rightBound = Math.min(endIndex - pivotSpan, candles.length - pivotSpan - 1);
  for (let index = rightBound; index >= leftBound; index -= 1) {
    const pivot = candles[index];
    if (!pivot) {
      continue;
    }
    let isPivot = true;
    for (let offset = 1; offset <= pivotSpan; offset += 1) {
      const left = candles[index - offset];
      const right = candles[index + offset];
      if (!left || !right || pivot.low >= left.low || pivot.low > right.low) {
        isPivot = false;
        break;
      }
    }
    if (isPivot) {
      return pivot.low;
    }
  }
  return null;
}

function evaluateLiquiditySweepReversal(
  pattern: QuantPattern,
  candles: MarketCandle[],
  index: number,
  momentumPercent: number,
  slopePercent: number,
  requiredVolumeRatio: number,
) {
  const current = candles[index];
  if (!current) {
    return null;
  }

  const sweepStart = Math.max(1, index - Math.max(pattern.maxReentryBars, 1) + 1);
  for (let sweepIndex = index; sweepIndex >= sweepStart; sweepIndex -= 1) {
    const sweepBar = candles[sweepIndex];
    const structureWindow = candles.slice(Math.max(0, sweepIndex - pattern.lookbackDays), sweepIndex);
    if (!sweepBar || structureWindow.length < 6) {
      continue;
    }

    const recentPivotLow = findRecentPivotLow(candles, Math.max(0, sweepIndex - pattern.lookbackDays), sweepIndex - 1);
    const structureLow = recentPivotLow ?? Math.min(...structureWindow.map((item) => item.low));
    const structureHigh = Math.max(...structureWindow.map((item) => item.high));
    if (!Number.isFinite(structureLow) || !Number.isFinite(structureHigh) || structureHigh <= structureLow) {
      continue;
    }

    const sweepThreshold = structureLow * (1 - pattern.sweepBufferPercent / 100);
    const atr = calculateAverageTrueRange(candles, sweepIndex, Math.min(14, pattern.lookbackDays));
    if (sweepBar.low > sweepThreshold) {
      continue;
    }

    const barRange = Math.max(sweepBar.high - sweepBar.low, sweepBar.close * 0.001, 0.01);
    const body = Math.max(Math.abs(sweepBar.close - sweepBar.open), barRange * 0.08);
    const lowerWick = Math.max(Math.min(sweepBar.open, sweepBar.close) - sweepBar.low, 0);
    const wickRatio = lowerWick / body;
    const closeRecovery = ((current.close - sweepBar.low) / barRange) * 100;
    const sweepVolumeRatio = calculateVolumeRatioAt(candles, sweepIndex, 20);
    const recoveredPrice = structureLow * (1 + pattern.breakoutPercent / 100 * 0.15);

    if (wickRatio < pattern.wickRatioThreshold) {
      continue;
    }
    if (atr > 0 && barRange < atr * 0.65) {
      continue;
    }
    if (closeRecovery < pattern.closeRecoveryPercent) {
      continue;
    }
    if (current.close < recoveredPrice) {
      continue;
    }
    if (sweepIndex < index && current.close <= Math.max(structureLow, sweepBar.close)) {
      continue;
    }
    if (sweepVolumeRatio < Math.max(requiredVolumeRatio * 0.85, 1.02)) {
      continue;
    }

    const structureRange = structureHigh - structureLow;
    const triggerPrice = Math.max(recoveredPrice, current.close);
    const stopPrice = sweepBar.low * (1 - pattern.sweepBufferPercent / 200);
    const targetPrice1 = Math.max(triggerPrice * (1 + pattern.target1Percent / 100), structureLow + structureRange * 0.5);
    const targetPrice2 = Math.max(triggerPrice * (1 + pattern.target2Percent / 100), structureHigh);

    return {
      triggered: true,
      triggerPrice: toFixedNumber(triggerPrice),
      signalPrice: toFixedNumber(current.close),
      momentumPercent: toFixedNumber(momentumPercent),
      slopePercent: toFixedNumber(slopePercent, 3),
      volumeRatio: toFixedNumber(sweepVolumeRatio, 2),
      reason: `구조 하단 스윕 후 ${index - sweepIndex}봉 내 복귀 · 꼬리비 ${toFixedNumber(wickRatio, 2)} · 복귀 ${toFixedNumber(closeRecovery, 1)}%`,
      detectionStartIndex: Math.max(0, sweepIndex - Math.min(pattern.lookbackDays, 12)),
      detectionEndIndex: index,
      stopPrice: toFixedNumber(stopPrice),
      targetPrice1: toFixedNumber(targetPrice1),
      targetPrice2: toFixedNumber(targetPrice2),
    } satisfies PatternEvaluation;
  }

  return null;
}

function evaluateImbalancePullbackContinuation(
  pattern: QuantPattern,
  candles: MarketCandle[],
  index: number,
  momentumPercent: number,
  slopePercent: number,
  requiredVolumeRatio: number,
) {
  const current = candles[index];
  if (!current || momentumPercent < pattern.momentumThreshold || slopePercent < pattern.slopeThreshold) {
    return null;
  }

  const searchStart = Math.max(2, index - Math.max(pattern.lookbackDays, pattern.maxConfirmationBars + 3) + 1);
  for (let fvgIndex = index - 1; fvgIndex >= searchStart; fvgIndex -= 1) {
    const first = candles[fvgIndex - 2];
    const middle = candles[fvgIndex - 1];
    const third = candles[fvgIndex];
    if (!first || !middle || !third) {
      continue;
    }

    const gapLow = first.high;
    const gapHigh = third.low;
    const gapSize = gapHigh - gapLow;
    const gapPercent = gapLow > 0 ? (gapSize / gapLow) * 100 : 0;
    const atr = calculateAverageTrueRange(candles, fvgIndex, 14);
    const middleBody = Math.abs(middle.close - middle.open);
    const adjacentAverageBody = average([
      Math.abs(first.close - first.open),
      Math.abs(third.close - third.open),
    ]);
    const impulseBodyPercent = middle.open > 0 ? (middleBody / middle.open) * 100 : 0;
    if (gapSize <= 0 || gapPercent < pattern.minGapPercent || (atr > 0 && gapSize < atr * 0.2)) {
      continue;
    }
    if (middle.close <= middle.open || impulseBodyPercent < Math.max(pattern.breakoutPercent * 0.8, gapPercent * 0.8)) {
      continue;
    }
    if (adjacentAverageBody > 0 && middleBody / adjacentAverageBody < 1.8) {
      continue;
    }

    const barsSinceFormation = index - fvgIndex;
    if (barsSinceFormation < 2 || barsSinceFormation > pattern.maxConfirmationBars) {
      continue;
    }

    const pullback = candles.slice(fvgIndex + 1, index);
    if (pullback.length === 0) {
      continue;
    }

    const pullbackLow = Math.min(...pullback.map((item) => item.low));
    const fillPercent = ((gapHigh - pullbackLow) / gapSize) * 100;
    const invalidated = pullback.some((item) => item.close < gapLow * (1 - pattern.breakoutPercent / 100 * 0.5));
    const volumeRatio = calculateVolumeRatioAt(candles, index, 20);
    const rebreakPrice = gapHigh * (1 + pattern.breakoutPercent / 100 * 0.1);

    if (pullbackLow > gapHigh) {
      continue;
    }
    if (fillPercent < pattern.minFillPercent) {
      continue;
    }
    if (invalidated) {
      continue;
    }
    if (current.close < rebreakPrice) {
      continue;
    }
    if (volumeRatio < Math.max(requiredVolumeRatio * 0.8, 1)) {
      continue;
    }

    const stopPrice = Math.min(pullbackLow, gapLow) * (1 - pattern.minGapPercent / 200);
    const targetBase = Math.max(current.close, rebreakPrice);
    const targetPrice1 = Math.max(targetBase * (1 + pattern.target1Percent / 100), targetBase + gapSize * 1.5);
    const targetPrice2 = Math.max(targetBase * (1 + pattern.target2Percent / 100), targetBase + gapSize * 3);

    return {
      triggered: true,
      triggerPrice: toFixedNumber(rebreakPrice),
      signalPrice: toFixedNumber(current.close),
      momentumPercent: toFixedNumber(momentumPercent),
      slopePercent: toFixedNumber(slopePercent, 3),
      volumeRatio: toFixedNumber(volumeRatio, 2),
      reason: `Bullish FVG ${toFixedNumber(gapPercent, 2)}% · fill ${toFixedNumber(fillPercent, 1)}% · ${barsSinceFormation}봉 내 재돌파`,
      detectionStartIndex: Math.max(0, fvgIndex - 2),
      detectionEndIndex: index,
      stopPrice: toFixedNumber(stopPrice),
      targetPrice1: toFixedNumber(targetPrice1),
      targetPrice2: toFixedNumber(targetPrice2),
    } satisfies PatternEvaluation;
  }

  return null;
}

function evaluatePatternTrigger(pattern: QuantPattern, candles: MarketCandle[], index: number): PatternEvaluation {
  const current = candles[index];
  const highest = calculateRollingHigh(candles, index - 1, pattern.lookbackDays);
  const lowest = calculateRollingLow(candles, index - 1, pattern.lookbackDays);
  const momentumPercent = calculateMomentumPercent(candles, index, Math.min(pattern.lookbackDays, 63));
  const slopePercent = calculateSlopePercent(candles, index, Math.min(pattern.lookbackDays, 80));
  const volumeRatio = calculateVolumeRatioAt(candles, index, 20);
  const recentReturns = calculateReturns(candles.slice(Math.max(0, index - 30), index + 1), 10);
  const recentVolatility = stddev(recentReturns) * 100;
  const baselineVolatility = stddev(calculateReturns(candles.slice(Math.max(0, index - 60), index + 1), 30)) * 100;
  const breakoutBuffer = pattern.breakoutPercent / 100;
  const requiredVolumeRatio = 1 + pattern.volumeSurgePercent / 100;

  let triggered = false;
  let triggerPrice = current.close;
  let reason = "";

  if (pattern.id === "liquidity-sweep-reversal") {
    return evaluateLiquiditySweepReversal(pattern, candles, index, momentumPercent, slopePercent, requiredVolumeRatio) ?? {
      triggered: false,
      triggerPrice: toFixedNumber(current.close),
      signalPrice: toFixedNumber(current.close),
      momentumPercent: toFixedNumber(momentumPercent),
      slopePercent: toFixedNumber(slopePercent, 3),
      volumeRatio: toFixedNumber(volumeRatio, 2),
      reason: "유동성 스윕 조건 미충족",
    };
  }

  if (pattern.id === "imbalance-pullback-continuation") {
    return evaluateImbalancePullbackContinuation(pattern, candles, index, momentumPercent, slopePercent, requiredVolumeRatio) ?? {
      triggered: false,
      triggerPrice: toFixedNumber(current.close),
      signalPrice: toFixedNumber(current.close),
      momentumPercent: toFixedNumber(momentumPercent),
      slopePercent: toFixedNumber(slopePercent, 3),
      volumeRatio: toFixedNumber(volumeRatio, 2),
      reason: "FVG 되돌림 조건 미충족",
    };
  }

  if (pattern.id === "fifty-two-week-high") {
    triggerPrice = highest * (1 - breakoutBuffer);
    triggered = current.close >= triggerPrice && momentumPercent >= pattern.momentumThreshold && slopePercent > 0 && volumeRatio >= Math.max(requiredVolumeRatio * 0.85, 1);
    reason = `52주 고점 ${toFixedNumber(highest)} 대비 ${toFixedNumber(((current.close / highest) - 1) * 100)}% / 거래량 ${toFixedNumber(volumeRatio, 2)}배`;
  } else if (pattern.id === "trendline-breakout") {
    triggerPrice = highest * (1 + breakoutBuffer * 0.55);
    triggered = current.close >= triggerPrice && slopePercent >= pattern.slopeThreshold * 0.8 && volumeRatio >= requiredVolumeRatio;
    reason = `회귀 추세선 돌파 · 기울기 ${toFixedNumber(slopePercent, 3)}% · 거래량 ${toFixedNumber(volumeRatio, 2)}배`;
  } else if (pattern.id === "momentum-continuation") {
    triggerPrice = highest * (1 - breakoutBuffer * 0.5);
    triggered = momentumPercent >= pattern.momentumThreshold && current.close >= triggerPrice && volumeRatio >= Math.max(requiredVolumeRatio * 0.8, 1);
    reason = `중기 모멘텀 ${toFixedNumber(momentumPercent)}% / 거래량 ${toFixedNumber(volumeRatio, 2)}배`;
  } else if (pattern.id === "slope-angle-breakout") {
    triggerPrice = highest * (1 + breakoutBuffer * 0.35);
    triggered = slopePercent >= pattern.slopeThreshold && current.close >= triggerPrice && volumeRatio >= Math.max(requiredVolumeRatio * 0.9, 1);
    reason = `기울기 ${toFixedNumber(slopePercent, 3)}% / 채널 상단 ${toFixedNumber(triggerPrice)} / 거래량 ${toFixedNumber(volumeRatio, 2)}배`;
  } else if (pattern.id === "volatility-squeeze") {
    triggerPrice = highest * (1 + breakoutBuffer * 0.45);
    triggered = baselineVolatility > 0 && recentVolatility <= baselineVolatility * 0.8 && current.close >= triggerPrice && volumeRatio >= Math.max(requiredVolumeRatio, 1.1);
    reason = `변동성 수축 ${toFixedNumber(recentVolatility, 3)}% -> 확장`;
  } else if (pattern.category === "breakout") {
    triggerPrice = highest * (1 + breakoutBuffer * 0.35);
    triggered = current.close >= triggerPrice && volumeRatio >= requiredVolumeRatio;
    reason = `커스텀 돌파 ${toFixedNumber(triggerPrice)} / 거래량 ${toFixedNumber(volumeRatio, 2)}배`;
  } else if (pattern.category === "momentum") {
    triggerPrice = highest * (1 - breakoutBuffer * 0.35);
    triggered = momentumPercent >= pattern.momentumThreshold && slopePercent > 0 && volumeRatio >= Math.max(requiredVolumeRatio * 0.85, 1);
    reason = `커스텀 모멘텀 ${toFixedNumber(momentumPercent)}% / 거래량 ${toFixedNumber(volumeRatio, 2)}배`;
  } else if (pattern.category === "trend") {
    triggerPrice = lowest + (highest - lowest) * 0.72;
    triggered = slopePercent >= pattern.slopeThreshold && current.close >= triggerPrice && volumeRatio >= Math.max(requiredVolumeRatio * 0.85, 1);
    reason = `커스텀 추세 ${toFixedNumber(slopePercent, 3)}% / 거래량 ${toFixedNumber(volumeRatio, 2)}배`;
  } else {
    triggerPrice = highest * (1 + breakoutBuffer * 0.4);
    triggered = baselineVolatility > 0 && recentVolatility <= baselineVolatility * 0.82 && current.close >= triggerPrice && volumeRatio >= Math.max(requiredVolumeRatio * 0.9, 1);
    reason = `커스텀 변동성 ${toFixedNumber(recentVolatility, 3)}% / 거래량 ${toFixedNumber(volumeRatio, 2)}배`;
  }

  return {
    triggered,
    triggerPrice: toFixedNumber(triggerPrice),
    signalPrice: toFixedNumber(current.close),
    momentumPercent: toFixedNumber(momentumPercent),
    slopePercent: toFixedNumber(slopePercent, 3),
    volumeRatio: toFixedNumber(volumeRatio, 2),
    reason,
  } satisfies PatternEvaluation;
}

function resolveExecutionPrice(
  executionModel: PatternExecutionModel | "BREAKOUT_PRICE",
  candle: MarketCandle,
  nextCandle: MarketCandle | null,
  triggerPrice: number,
) {
  if (executionModel === "NEXT_OPEN") {
    return nextCandle?.open ?? candle.close;
  }
  if (executionModel === "BREAKOUT_PRICE") {
    return Math.max(triggerPrice, candle.close);
  }
  if (executionModel === "BREAKOUT_SLIPPAGE") {
    return Math.max(triggerPrice, candle.close) * 1.003;
  }
  if (executionModel === "VWAP_PROXY") {
    return (candle.high + candle.low + candle.close) / 3;
  }
  return candle.close;
}

function buildPricePlan(
  entryPrice: number,
  triggerPrice: number,
  currentPrice: number,
  signalPlan: SignalPlan,
  executionModel: PatternExecutionModel,
  pattern: QuantPattern,
  trailingStopPrice: number,
  overrides?: {
    stopPrice?: number | null;
    targetPrice1?: number | null;
    targetPrice2?: number | null;
  },
  exitPrice?: number | null,
  overrideSellPrice?: number | null,
) {
  const entryBandPercent = Math.max(0.35, Math.min(1.2, pattern.breakoutPercent * 0.45));
  const entryRangeLow = entryPrice * (1 - entryBandPercent / 100);
  const entryRangeHigh = entryPrice * (1 + entryBandPercent / 100);
  const stopLossPercent = pattern.stopLossPercent || signalPlan.stopLossPercent;
  const target1Percent = pattern.target1Percent || Math.max(8, signalPlan.takeProfitPercent * 0.55);
  const target2Percent = pattern.target2Percent || signalPlan.takeProfitPercent;
  const stopPrice = overrides?.stopPrice && overrides.stopPrice > 0 ? overrides.stopPrice : entryPrice * (1 - stopLossPercent / 100);
  const targetPrice1 = overrides?.targetPrice1 && overrides.targetPrice1 > 0 ? overrides.targetPrice1 : entryPrice * (1 + target1Percent / 100);
  const targetPrice2 = overrides?.targetPrice2 && overrides.targetPrice2 > 0 ? overrides.targetPrice2 : entryPrice * (1 + target2Percent / 100);
  const recommendedSellPrice = overrideSellPrice ?? Math.max(Math.max(trailingStopPrice, stopPrice), currentPrice >= targetPrice1 ? currentPrice : targetPrice1);
  const expectedExitPrice = exitPrice ?? recommendedSellPrice;
  const expectedReturnPercent = ((expectedExitPrice / entryPrice) - 1) * 100;
  const expectedReturnPercent2 = ((targetPrice2 / entryPrice) - 1) * 100;
  const realizedReturnPercent = exitPrice != null ? ((exitPrice / entryPrice) - 1) * 100 : null;
  const risk = entryPrice - stopPrice;
  const reward = targetPrice1 - entryPrice;
  const entryDistancePercent = entryPrice > 0 ? ((currentPrice / entryPrice) - 1) * 100 : 0;

  return {
    triggerPrice: toFixedNumber(triggerPrice),
    recommendedBuyPrice: toFixedNumber(entryPrice),
    entryRangeLow: toFixedNumber(entryRangeLow),
    entryRangeHigh: toFixedNumber(entryRangeHigh),
    entryDistancePercent: toFixedNumber(entryDistancePercent),
    entryAllowed: currentPrice >= entryRangeLow && currentPrice <= entryRangeHigh,
    stopPrice: toFixedNumber(stopPrice),
    trailingStopPrice: toFixedNumber(Math.max(trailingStopPrice, stopPrice)),
    targetPrice1: toFixedNumber(targetPrice1),
    targetPrice2: toFixedNumber(targetPrice2),
    recommendedSellPrice: toFixedNumber(recommendedSellPrice),
    expectedExitPrice: toFixedNumber(expectedExitPrice),
    realizedExitPrice: exitPrice != null ? toFixedNumber(exitPrice) : null,
    expectedReturnPercent: toFixedNumber(expectedReturnPercent),
    expectedReturnPercent2: toFixedNumber(expectedReturnPercent2),
    realizedReturnPercent: realizedReturnPercent != null ? toFixedNumber(realizedReturnPercent) : null,
    riskReward: risk > 0 ? toFixedNumber(reward / risk, 2) : 0,
    splitExitRatio: "50% / 50%",
    executionModel,
    executionLabel: EXECUTION_MODEL_LABELS[executionModel],
  } satisfies PatternLabPricePlan;
}

function buildPriceLevels(
  recommendation: PatternLabPricePlan,
  meta: {
    patternId: string;
    patternName: string;
    signalDate: string;
    signalType: PatternLabSignalType;
  },
): PatternLabPriceLevel[] {
  return [
    { id: `${meta.patternId}-${meta.signalDate}-trigger`, type: "trigger", value: recommendation.triggerPrice, label: "트리거", tone: "neutral", ...meta, recommendation },
    { id: `${meta.patternId}-${meta.signalDate}-buy`, type: "buy", value: recommendation.recommendedBuyPrice, label: "권장 매수가", tone: "buy", ...meta, recommendation },
    { id: `${meta.patternId}-${meta.signalDate}-buy-range-low`, type: "buyRangeLow", value: recommendation.entryRangeLow, label: "진입 하단", tone: "buy", ...meta, recommendation },
    { id: `${meta.patternId}-${meta.signalDate}-buy-range-high`, type: "buyRangeHigh", value: recommendation.entryRangeHigh, label: "진입 상단", tone: "buy", ...meta, recommendation },
    { id: `${meta.patternId}-${meta.signalDate}-stop`, type: "stop", value: recommendation.stopPrice, label: "손절가", tone: "sell", ...meta, recommendation },
    { id: `${meta.patternId}-${meta.signalDate}-target1`, type: "target1", value: recommendation.targetPrice1, label: "1차 목표가", tone: "hold", ...meta, recommendation },
    { id: `${meta.patternId}-${meta.signalDate}-target2`, type: "target2", value: recommendation.targetPrice2, label: "2차 목표가", tone: "hold", ...meta, recommendation },
    { id: `${meta.patternId}-${meta.signalDate}-sell`, type: "sell", value: recommendation.recommendedSellPrice, label: "권장 매도가", tone: "sell", ...meta, recommendation },
  ];
}

function createMarkerLabel(signalType: PatternLabSignalType, shortLabel: string) {
  if (signalType === "BUY") {
    return `B ${shortLabel}`;
  }
  if (signalType === "SELL") {
    return `S ${shortLabel}`;
  }
  if (signalType === "HOLD") {
    return `H ${shortLabel}`;
  }
  return shortLabel;
}

function createTradeId(symbol: string, patternId: string, date: string, suffix: string) {
  return `${symbol}-${patternId}-${date}-${suffix}`;
}

function summarizeTradeState(openPosition: boolean, entryIndex: number, totalCandles: number): PatternLabSignalType {
  if (!openPosition) {
    return "SELL";
  }
  return entryIndex >= totalCandles - 5 ? "BUY" : "HOLD";
}

function resolvePatternExecutionModel(pattern: QuantPattern, fallback: PatternExecutionModel): PatternExecutionModel {
  if (pattern.entryMode === "SIGNAL_CLOSE" || pattern.entryMode === "NEXT_OPEN" || pattern.entryMode === "BREAKOUT_PRICE" || pattern.entryMode === "VWAP_PROXY") {
    return pattern.entryMode;
  }
  return fallback;
}

function simulatePatternForStock(
  detail: StockDataDetail,
  candles: MarketCandle[],
  pattern: QuantPattern,
  signalPlan: SignalPlan,
  executionModel: PatternExecutionModel,
) {
  const signals: PatternLabSignalRow[] = [];
  const trades: PatternLabTradeRow[] = [];
  const recommendations: PatternLabRecommendationRow[] = [];
  let openTrade: OpenTradeState | null = null;
  const resolvedExecutionModel = resolvePatternExecutionModel(pattern, executionModel);

  for (let index = Math.max(20, pattern.lookbackDays); index < candles.length; index += 1) {
    const candle = candles[index];
    const nextCandle = candles[index + 1] ?? null;
    const evaluation = evaluatePatternTrigger(pattern, candles, index);

    if (!openTrade && evaluation.triggered) {
      const entryPrice = resolveExecutionPrice(resolvedExecutionModel, candle, nextCandle, evaluation.triggerPrice);
      const trailingStop = evaluation.stopPrice ?? entryPrice * (1 - Math.max(pattern.stopLossPercent, signalPlan.stopLossPercent) / 100);
      const recommendation = buildPricePlan(
        entryPrice,
        evaluation.triggerPrice,
        candle.close,
        signalPlan,
        resolvedExecutionModel,
        pattern,
        trailingStop,
        {
          stopPrice: evaluation.stopPrice,
          targetPrice1: evaluation.targetPrice1,
          targetPrice2: evaluation.targetPrice2,
        },
      );
      const detectionStartDate = candles[evaluation.detectionStartIndex ?? Math.max(0, index - Math.min(pattern.lookbackDays, 12) + 1)]?.date ?? candle.date;
      const detectionEndDate = candles[evaluation.detectionEndIndex ?? index]?.date ?? candle.date;

      openTrade = {
        patternId: pattern.id,
        patternName: pattern.name,
        stockName: detail.name,
        symbol: detail.symbol,
        entryDate: resolvedExecutionModel === "NEXT_OPEN" && nextCandle ? nextCandle.date : candle.date,
        entryPrice,
        triggerPrice: evaluation.triggerPrice,
        stopPrice: recommendation.stopPrice,
        targetPrice1: recommendation.targetPrice1,
        targetPrice2: recommendation.targetPrice2,
        entryRangeLow: recommendation.entryRangeLow,
        entryRangeHigh: recommendation.entryRangeHigh,
        reason: `${evaluation.reason} / ${signalPlan.buyMode}`,
        entryIndex: resolvedExecutionModel === "NEXT_OPEN" && nextCandle ? index + 1 : index,
        highestHigh: candle.high,
        lowestLow: candle.low,
        highestClose: candle.close,
        lastPrice: candle.close,
      };

      signals.push({
        id: createTradeId(detail.symbol, pattern.id, openTrade.entryDate, "buy"),
        symbol: detail.symbol,
        stockName: detail.name,
        patternId: pattern.id,
        patternName: pattern.name,
        signalDate: candle.date,
        signalType: "BUY",
        signalPrice: evaluation.signalPrice,
        currentPrice: candle.close,
        signalReason: `${evaluation.reason} / 권장 진입 ${toFixedNumber(entryPrice)}`,
        recommendation,
        openPosition: true,
        detectionStartDate,
        detectionEndDate,
      });
      continue;
    }

    if (!openTrade) {
      continue;
    }

    openTrade.highestHigh = Math.max(openTrade.highestHigh, candle.high);
    openTrade.lowestLow = Math.min(openTrade.lowestLow, candle.low);
    openTrade.highestClose = Math.max(openTrade.highestClose, candle.close);
    openTrade.lastPrice = candle.close;

    const holdingDays = formatDateDiff(openTrade.entryDate, candle.date);
    const trailingStop = Math.max(openTrade.stopPrice, openTrade.highestClose * (1 - Math.max(pattern.stopLossPercent, signalPlan.stopLossPercent) * 0.007));
    const trendFloor = average(candles.slice(Math.max(0, index - 19), index + 1).map((item) => item.close));
    let exitPrice: number | null = null;
    let exitReason = "";

    if ((pattern.exitMode === "STOP" || pattern.exitMode === "TRAILING_STOP") && candle.low <= trailingStop) {
      exitPrice = trailingStop;
      exitReason = "손절/트레일링 스탑";
    } else if ((pattern.exitMode === "TARGET" || pattern.exitMode === "TRAILING_STOP") && candle.high >= openTrade.targetPrice2) {
      exitPrice = openTrade.targetPrice2;
      exitReason = "2차 목표가 도달";
    } else if ((pattern.exitMode === "TARGET" || pattern.exitMode === "TRAILING_STOP") && candle.high >= openTrade.targetPrice1 && holdingDays >= Math.max(3, Math.floor(pattern.holdingDays * 0.45))) {
      exitPrice = openTrade.targetPrice1;
      exitReason = "1차 목표가 도달";
    } else if (pattern.exitMode === "TREND" && candle.close < trendFloor) {
      exitPrice = candle.close;
      exitReason = "추세 이탈";
    } else if (holdingDays >= Math.min(signalPlan.maxHoldingDays, pattern.holdingDays)) {
      exitPrice = candle.close;
      exitReason = pattern.exitMode === "TIME" ? "보유일 초과" : "최대 보유일 도달";
    } else if (exitPrice == null && candle.low <= trailingStop) {
      exitPrice = trailingStop;
      exitReason = "손절가 이탈";
    } else if (exitPrice == null && candle.high >= openTrade.targetPrice2) {
      exitPrice = openTrade.targetPrice2;
      exitReason = "2차 목표가 도달";
    }

    if (exitPrice == null) {
      continue;
    }

    const recommendation = buildPricePlan(
      openTrade.entryPrice,
      openTrade.triggerPrice,
      candle.close,
      signalPlan,
      resolvedExecutionModel,
      pattern,
      trailingStop,
      {
        stopPrice: openTrade.stopPrice,
        targetPrice1: openTrade.targetPrice1,
        targetPrice2: openTrade.targetPrice2,
      },
      exitPrice,
      exitPrice,
    );
    const mfePercent = ((openTrade.highestHigh / openTrade.entryPrice) - 1) * 100;
    const maePercent = ((openTrade.lowestLow / openTrade.entryPrice) - 1) * 100;

    trades.push({
      id: createTradeId(detail.symbol, pattern.id, openTrade.entryDate, candle.date),
      symbol: detail.symbol,
      stockName: detail.name,
      patternId: pattern.id,
      patternName: pattern.name,
      entryDate: openTrade.entryDate,
      entryPrice: toFixedNumber(openTrade.entryPrice),
      exitDate: candle.date,
      exitPrice: toFixedNumber(exitPrice),
      holdingDays,
      returnPercent: recommendation.realizedReturnPercent,
      expectedExitPrice: recommendation.expectedExitPrice,
      mfePercent: toFixedNumber(mfePercent),
      maePercent: toFixedNumber(maePercent),
      exitReason,
      openPosition: false,
      currentState: "SELL",
      recommendation,
    });

    signals.push({
      id: createTradeId(detail.symbol, pattern.id, candle.date, "sell"),
      symbol: detail.symbol,
      stockName: detail.name,
      patternId: pattern.id,
      patternName: pattern.name,
      signalDate: candle.date,
      signalType: "SELL",
      signalPrice: toFixedNumber(exitPrice),
      currentPrice: candle.close,
      signalReason: `${exitReason} / ${signalPlan.sellMode}`,
      recommendation,
      openPosition: false,
      detectionStartDate: null,
      detectionEndDate: null,
    });

    recommendations.push({
      symbol: detail.symbol,
      stockName: detail.name,
      patternId: pattern.id,
      patternName: pattern.name,
      currentPrice: toFixedNumber(candle.close),
      signalDate: candle.date,
      signalType: "SELL",
      triggerPrice: recommendation.triggerPrice,
      recommendedBuyPrice: recommendation.recommendedBuyPrice,
      entryRangeLow: recommendation.entryRangeLow,
      entryRangeHigh: recommendation.entryRangeHigh,
      entryDistancePercent: recommendation.entryDistancePercent,
      entryAllowed: recommendation.entryAllowed,
      stopPrice: recommendation.stopPrice,
      trailingStopPrice: recommendation.trailingStopPrice,
      targetPrice1: recommendation.targetPrice1,
      targetPrice2: recommendation.targetPrice2,
      recommendedSellPrice: recommendation.recommendedSellPrice,
      expectedExitPrice: recommendation.expectedExitPrice,
      realizedExitPrice: recommendation.realizedExitPrice,
      expectedReturnPercent: recommendation.expectedReturnPercent,
      expectedReturnPercent2: recommendation.expectedReturnPercent2,
      realizedReturnPercent: recommendation.realizedReturnPercent,
      riskReward: recommendation.riskReward,
      splitExitRatio: recommendation.splitExitRatio,
      executionLabel: recommendation.executionLabel,
      latestUpdatedAt: candle.date,
      openPosition: false,
    });

    openTrade = null;
  }

  if (openTrade) {
    const lastCandle = candles[candles.length - 1];
    const trailingStop = Math.max(openTrade.stopPrice, openTrade.highestClose * (1 - Math.max(pattern.stopLossPercent, signalPlan.stopLossPercent) * 0.007));
    const recommendation = buildPricePlan(
      openTrade.entryPrice,
      openTrade.triggerPrice,
      lastCandle.close,
      signalPlan,
      resolvedExecutionModel,
      pattern,
      trailingStop,
      {
        stopPrice: openTrade.stopPrice,
        targetPrice1: openTrade.targetPrice1,
        targetPrice2: openTrade.targetPrice2,
      },
      null,
      Math.max(trailingStop, lastCandle.close >= openTrade.targetPrice1 ? lastCandle.close : openTrade.targetPrice1),
    );
    const holdingDays = formatDateDiff(openTrade.entryDate, lastCandle.date);
    const mfePercent = ((openTrade.highestHigh / openTrade.entryPrice) - 1) * 100;
    const maePercent = ((openTrade.lowestLow / openTrade.entryPrice) - 1) * 100;
    const currentState = summarizeTradeState(true, openTrade.entryIndex, candles.length);

    trades.push({
      id: createTradeId(detail.symbol, pattern.id, openTrade.entryDate, "open"),
      symbol: detail.symbol,
      stockName: detail.name,
      patternId: pattern.id,
      patternName: pattern.name,
      entryDate: openTrade.entryDate,
      entryPrice: toFixedNumber(openTrade.entryPrice),
      exitDate: null,
      exitPrice: null,
      holdingDays,
      returnPercent: null,
      expectedExitPrice: recommendation.expectedExitPrice,
      mfePercent: toFixedNumber(mfePercent),
      maePercent: toFixedNumber(maePercent),
      exitReason: "백테스트 종료 전 열린 포지션",
      openPosition: true,
      currentState,
      recommendation,
    });

    signals.push({
      id: createTradeId(detail.symbol, pattern.id, lastCandle.date, "hold"),
      symbol: detail.symbol,
      stockName: detail.name,
      patternId: pattern.id,
      patternName: pattern.name,
      signalDate: lastCandle.date,
      signalType: currentState,
      signalPrice: toFixedNumber(lastCandle.close),
      currentPrice: toFixedNumber(lastCandle.close),
      signalReason: `열린 포지션 / 트레일링 스탑 ${toFixedNumber(trailingStop)} / ${signalPlan.holdMode}`,
      recommendation,
      openPosition: true,
      detectionStartDate: null,
      detectionEndDate: null,
    });

    recommendations.push({
      symbol: detail.symbol,
      stockName: detail.name,
      patternId: pattern.id,
      patternName: pattern.name,
      currentPrice: toFixedNumber(lastCandle.close),
      signalDate: lastCandle.date,
      signalType: currentState,
      triggerPrice: recommendation.triggerPrice,
      recommendedBuyPrice: recommendation.recommendedBuyPrice,
      entryRangeLow: recommendation.entryRangeLow,
      entryRangeHigh: recommendation.entryRangeHigh,
      entryDistancePercent: recommendation.entryDistancePercent,
      entryAllowed: recommendation.entryAllowed,
      stopPrice: recommendation.stopPrice,
      trailingStopPrice: recommendation.trailingStopPrice,
      targetPrice1: recommendation.targetPrice1,
      targetPrice2: recommendation.targetPrice2,
      recommendedSellPrice: recommendation.recommendedSellPrice,
      expectedExitPrice: recommendation.expectedExitPrice,
      realizedExitPrice: null,
      expectedReturnPercent: recommendation.expectedReturnPercent,
      expectedReturnPercent2: recommendation.expectedReturnPercent2,
      realizedReturnPercent: null,
      riskReward: recommendation.riskReward,
      splitExitRatio: recommendation.splitExitRatio,
      executionLabel: recommendation.executionLabel,
      latestUpdatedAt: lastCandle.date,
      openPosition: true,
    });
  }

  return { signals, trades, recommendations };
}

function buildLiquidityStatus(detail: StockDataDetail) {
  const recent = detail.priceSeries.slice(-20);
  const averageVolume = average(recent.map((point) => point.volume || 0));
  if (averageVolume >= 5_000_000) {
    return "매우 유동적";
  }
  if (averageVolume >= 1_000_000) {
    return "유동성 양호";
  }
  if (averageVolume >= 250_000) {
    return "보통";
  }
  return "주의";
}

function buildSparkline(detail: StockDataDetail) {
  return detail.priceSeries
    .slice(-20)
    .map((point) => point.adjClose ?? point.close ?? 0)
    .filter((value) => value > 0);
}

function calculateDistanceTo52WeekHigh(detail: StockDataDetail) {
  const prices = detail.priceSeries.slice(-252).map((point) => point.adjClose ?? point.close ?? 0).filter((value) => value > 0);
  if (prices.length === 0 || detail.latestPrice == null || detail.latestPrice <= 0) {
    return null;
  }
  const high = Math.max(...prices);
  return ((detail.latestPrice / high) - 1) * 100;
}

function calculateDetailMomentumScore(detail: StockDataDetail) {
  const prices = detail.priceSeries.map((point) => point.adjClose ?? point.close ?? 0).filter((value) => value > 0);
  if (prices.length < 64) {
    return null;
  }
  const current = prices[prices.length - 1] ?? 0;
  const base = prices[Math.max(0, prices.length - 64)] ?? 0;
  if (current <= 0 || base <= 0) {
    return null;
  }
  return ((current / base) - 1) * 100;
}

function buildEquityMetricsFromTrades(trades: PatternLabTradeRow[]) {
  if (trades.length === 0) {
    return {
      cumulativeReturnPercent: 0,
      cagr: 0,
      maxDrawdown: 0,
      winRate: 0,
      avgHoldingDays: 0,
    };
  }

  const realizedReturns = trades.map((trade) => trade.returnPercent ?? trade.recommendation.expectedReturnPercent);
  const cumulativeFactor = realizedReturns.reduce((factor, value) => factor * (1 + value / 100), 1);
  let runningPeak = 1;
  let equity = 1;
  let maxDrawdown = 0;
  realizedReturns.forEach((value) => {
    equity *= 1 + value / 100;
    runningPeak = Math.max(runningPeak, equity);
    maxDrawdown = Math.min(maxDrawdown, (equity / runningPeak - 1) * 100);
  });
  const totalHoldingDays = trades.reduce((sum, trade) => sum + trade.holdingDays, 0);
  const annualFactor = totalHoldingDays > 0 ? 365 / totalHoldingDays : 1;

  return {
    cumulativeReturnPercent: toFixedNumber((cumulativeFactor - 1) * 100),
    cagr: toFixedNumber((cumulativeFactor ** annualFactor - 1) * 100),
    maxDrawdown: toFixedNumber(maxDrawdown),
    winRate: toFixedNumber((trades.filter((trade) => (trade.returnPercent ?? trade.recommendation.expectedReturnPercent) > 0).length / trades.length) * 100),
    avgHoldingDays: Math.round(totalHoldingDays / trades.length),
  };
}

function buildPatternSummary(
  pattern: QuantPattern,
  trades: PatternLabTradeRow[],
  signals: PatternLabSignalRow[],
): PatternLabPatternSummary {
  const tradeReturns = trades.map((trade) => trade.returnPercent ?? trade.recommendation.expectedReturnPercent);
  const metrics = buildEquityMetricsFromTrades(trades);
  const sharpe = tradeReturns.length > 1 ? (average(tradeReturns) / Math.max(stddev(tradeReturns), 0.01)) * Math.sqrt(Math.max(tradeReturns.length, 1)) : 0;
  const recentSignals = signals.filter((signal) => signal.signalDate >= (signals[signals.length - 20]?.signalDate ?? "")).length;
  const latest20 = tradeReturns.slice(-20);

  return {
    patternId: pattern.id,
    name: pattern.name,
    shortLabel: pattern.shortLabel,
    description: pattern.ruleSummary,
    appliedStockCount: new Set(trades.map((trade) => trade.symbol)).size,
    signalCount: signals.length,
    tradeCount: trades.length,
    recentSignalCount: recentSignals,
    averageReturnPercent: toFixedNumber(average(tradeReturns)),
    medianReturnPercent: toFixedNumber(median(tradeReturns)),
    winRate: metrics.winRate,
    cagr: metrics.cagr,
    maxDrawdown: metrics.maxDrawdown,
    sharpe: toFixedNumber(sharpe, 2),
    avgHoldingDays: metrics.avgHoldingDays,
    recentTrend: toFixedNumber(average(latest20)),
    latest20Summary: latest20.length > 0
      ? `최근 ${latest20.length}건 평균 ${toFixedNumber(average(latest20))}% / 승률 ${toFixedNumber((latest20.filter((value) => value > 0).length / latest20.length) * 100)}%`
      : "최근 신호 없음",
  };
}

function buildMatrixCell(symbol: string, pattern: QuantPattern, trades: PatternLabTradeRow[], signals: PatternLabSignalRow[]): PatternLabMatrixCell {
  const tradeReturns = trades.map((trade) => trade.returnPercent ?? trade.recommendation.expectedReturnPercent);
  const latestSignal = signals[signals.length - 1];

  return {
    symbol,
    patternId: pattern.id,
    returnPercent: tradeReturns.length > 0 ? toFixedNumber(average(tradeReturns)) : null,
    winRate: tradeReturns.length > 0 ? toFixedNumber((tradeReturns.filter((value) => value > 0).length / tradeReturns.length) * 100) : 0,
    latestSignal: latestSignal?.signalType ?? "NONE",
    latestSignalDate: latestSignal?.signalDate ?? null,
  };
}

function findRelatedTrade(signal: PatternLabSignalRow, trades: PatternLabTradeRow[]) {
  return trades.find((trade) => {
    if (trade.patternId !== signal.patternId) {
      return false;
    }
    if (signal.signalType === "SELL") {
      return trade.exitDate === signal.signalDate;
    }
    if (signal.signalType === "BUY") {
      return trade.entryDate === signal.signalDate || trade.entryDate >= signal.signalDate;
    }
    return trade.openPosition;
  });
}

function buildSignalZones(
  candles: MarketCandle[],
  signals: PatternLabSignalRow[],
  trades: PatternLabTradeRow[],
): PatternLabSignalZone[] {
  const lastCandle = candles[candles.length - 1];
  const zones: PatternLabSignalZone[] = [];

  for (const signal of signals) {
    const relatedTrade = findRelatedTrade(signal, trades);

    if (signal.signalType === "BUY") {
      if (signal.detectionStartDate && signal.detectionEndDate) {
        zones.push({
          id: `${signal.id}-detection`,
          patternId: signal.patternId,
          patternName: signal.patternName,
          zoneType: "DETECTION",
          label: `${signal.patternName} 감지`,
          startDate: signal.detectionStartDate,
          endDate: signal.detectionEndDate,
          signalDate: signal.signalDate,
          signalPrice: signal.signalPrice,
          entryDate: relatedTrade?.entryDate ?? signal.signalDate,
          exitDate: relatedTrade?.exitDate ?? null,
          entryPrice: relatedTrade?.entryPrice ?? signal.recommendation.recommendedBuyPrice,
          exitPrice: relatedTrade?.exitPrice ?? null,
          currentPrice: signal.currentPrice,
          returnPercent: relatedTrade?.returnPercent ?? signal.recommendation.realizedReturnPercent ?? null,
          holdingDays: relatedTrade?.holdingDays ?? null,
          mfePercent: relatedTrade?.mfePercent ?? null,
          maePercent: relatedTrade?.maePercent ?? null,
          reason: signal.signalReason,
          openPosition: signal.openPosition,
          recommendation: signal.recommendation,
        });
      }

      zones.push({
        id: `${signal.id}-buy-zone`,
        patternId: signal.patternId,
        patternName: signal.patternName,
        zoneType: "BUY",
        label: `${signal.patternName} BUY`,
        startDate: signal.signalDate,
        endDate: relatedTrade?.entryDate ?? signal.signalDate,
        signalDate: signal.signalDate,
        signalPrice: signal.signalPrice,
        entryDate: relatedTrade?.entryDate ?? signal.signalDate,
        exitDate: relatedTrade?.exitDate ?? null,
        entryPrice: relatedTrade?.entryPrice ?? signal.recommendation.recommendedBuyPrice,
        exitPrice: relatedTrade?.exitPrice ?? null,
        currentPrice: signal.currentPrice,
        returnPercent: relatedTrade?.returnPercent ?? signal.recommendation.realizedReturnPercent ?? null,
        holdingDays: relatedTrade?.holdingDays ?? null,
        mfePercent: relatedTrade?.mfePercent ?? null,
        maePercent: relatedTrade?.maePercent ?? null,
        reason: signal.signalReason,
        openPosition: signal.openPosition,
        recommendation: signal.recommendation,
      });
      continue;
    }

    if (signal.signalType === "SELL") {
      zones.push({
        id: `${signal.id}-sell-zone`,
        patternId: signal.patternId,
        patternName: signal.patternName,
        zoneType: "SELL",
        label: `${signal.patternName} SELL`,
        startDate: signal.signalDate,
        endDate: signal.signalDate,
        signalDate: signal.signalDate,
        signalPrice: signal.signalPrice,
        entryDate: relatedTrade?.entryDate ?? null,
        exitDate: relatedTrade?.exitDate ?? signal.signalDate,
        entryPrice: relatedTrade?.entryPrice ?? null,
        exitPrice: relatedTrade?.exitPrice ?? signal.signalPrice,
        currentPrice: signal.currentPrice,
        returnPercent: relatedTrade?.returnPercent ?? signal.recommendation.realizedReturnPercent ?? null,
        holdingDays: relatedTrade?.holdingDays ?? null,
        mfePercent: relatedTrade?.mfePercent ?? null,
        maePercent: relatedTrade?.maePercent ?? null,
        reason: signal.signalReason,
        openPosition: false,
        recommendation: signal.recommendation,
      });
    }
  }

  for (const trade of trades) {
    zones.push({
      id: `${trade.id}-hold-zone`,
      patternId: trade.patternId,
      patternName: trade.patternName,
      zoneType: "HOLD",
      label: `${trade.patternName} HOLD`,
      startDate: trade.entryDate,
      endDate: trade.exitDate ?? lastCandle?.date ?? trade.entryDate,
      signalDate: trade.exitDate ?? lastCandle?.date ?? trade.entryDate,
      signalPrice: trade.exitPrice ?? lastCandle?.close ?? trade.entryPrice,
      entryDate: trade.entryDate,
      exitDate: trade.exitDate,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      currentPrice: lastCandle?.close ?? trade.entryPrice,
      returnPercent: trade.returnPercent ?? trade.recommendation.expectedReturnPercent,
      holdingDays: trade.holdingDays,
      mfePercent: trade.mfePercent,
      maePercent: trade.maePercent,
      reason: trade.exitReason,
      openPosition: trade.openPosition,
      recommendation: trade.recommendation,
    });
  }

  return zones.sort((left, right) => {
    const order = { DETECTION: 0, BUY: 1, HOLD: 2, SELL: 3 } satisfies Record<PatternLabZoneType, number>;
    if (order[left.zoneType] !== order[right.zoneType]) {
      return order[left.zoneType] - order[right.zoneType];
    }
    return left.startDate.localeCompare(right.startDate);
  });
}

function buildStockCard(
  detail: StockDataDetail,
  candles: MarketCandle[],
  backtestStock: BacktestStockLike | null,
  candidateScore: number,
  patternSignals: PatternLabSignalRow[],
  patternTrades: PatternLabTradeRow[],
  recommendations: PatternLabRecommendationRow[],
): PatternLabStockCard {
  const summaryMetrics = buildEquityMetricsFromTrades(patternTrades);
  const latestSignal = patternSignals[patternSignals.length - 1];
  const latestRecommendation = recommendations
    .slice()
    .sort((left, right) => {
      if (Number(right.openPosition) !== Number(left.openPosition)) {
        return Number(right.openPosition) - Number(left.openPosition);
      }
      return right.signalDate.localeCompare(left.signalDate);
    })[0] ?? null;
  const dominantPattern = latestRecommendation ?? recommendations[0] ?? null;
  const markers = patternSignals
    .slice(-18)
    .map((signal) => {
      const relatedTrade = findRelatedTrade(signal, patternTrades);
      return {
        id: signal.id,
        date: signal.signalDate,
        signalType: signal.signalType,
        label: createMarkerLabel(signal.signalType, signal.patternName.slice(0, 4).toUpperCase()),
        patternId: signal.patternId,
        patternName: signal.patternName,
        signalPrice: signal.signalPrice,
        recommendation: signal.recommendation,
        signalReason: signal.signalReason,
        openPosition: signal.openPosition,
        entryDate: relatedTrade?.entryDate ?? null,
        exitDate: relatedTrade?.exitDate ?? null,
        entryPrice: relatedTrade?.entryPrice ?? null,
        exitPrice: relatedTrade?.exitPrice ?? null,
        returnPercent: relatedTrade?.returnPercent ?? null,
        exitReason: relatedTrade?.exitReason ?? null,
        mfePercent: relatedTrade?.mfePercent ?? null,
        maePercent: relatedTrade?.maePercent ?? null,
        holdingDays: relatedTrade?.holdingDays ?? null,
      };
    });
  const holdingRanges = patternTrades.slice(-8).map((trade) => {
    const currentPrice = candles[candles.length - 1]?.close ?? trade.entryPrice;
    const currentReturnPercent = ((currentPrice / trade.entryPrice) - 1) * 100;
    return {
      id: trade.id,
      patternId: trade.patternId,
      patternName: trade.patternName,
      startDate: trade.entryDate,
      endDate: trade.exitDate ?? candles[candles.length - 1]?.date ?? trade.entryDate,
      openPosition: trade.openPosition,
      entryPrice: trade.entryPrice,
      currentPrice: toFixedNumber(currentPrice),
      currentReturnPercent: toFixedNumber(currentReturnPercent),
      stopPrice: trade.recommendation.stopPrice,
      trailingStopPrice: trade.recommendation.trailingStopPrice,
      targetPrice1: trade.recommendation.targetPrice1,
      targetPrice2: trade.recommendation.targetPrice2,
      expectedExitPrice: trade.recommendation.expectedExitPrice,
      holdingDays: trade.holdingDays,
    };
  });
  const latestRecommendationsByPattern = recommendations
    .slice()
    .sort((left, right) => {
      if (Number(right.openPosition) !== Number(left.openPosition)) {
        return Number(right.openPosition) - Number(left.openPosition);
      }
      return right.signalDate.localeCompare(left.signalDate);
    })
    .reduce((accumulator, recommendation) => {
      if (!accumulator.has(recommendation.patternId)) {
        accumulator.set(recommendation.patternId, recommendation);
      }
      return accumulator;
    }, new Map<string, PatternLabRecommendationRow>());
  const priceLevels = Array.from(latestRecommendationsByPattern.values()).flatMap((recommendation) =>
    buildPriceLevels(
      {
        triggerPrice: recommendation.triggerPrice,
        recommendedBuyPrice: recommendation.recommendedBuyPrice,
        entryRangeLow: recommendation.entryRangeLow,
        entryRangeHigh: recommendation.entryRangeHigh,
        entryDistancePercent: recommendation.entryDistancePercent,
        entryAllowed: recommendation.entryAllowed,
        stopPrice: recommendation.stopPrice,
        trailingStopPrice: recommendation.trailingStopPrice,
        targetPrice1: recommendation.targetPrice1,
        targetPrice2: recommendation.targetPrice2,
        recommendedSellPrice: recommendation.recommendedSellPrice,
        expectedExitPrice: recommendation.expectedExitPrice,
        realizedExitPrice: recommendation.realizedExitPrice,
        expectedReturnPercent: recommendation.expectedReturnPercent,
        expectedReturnPercent2: recommendation.expectedReturnPercent2,
        realizedReturnPercent: recommendation.realizedReturnPercent,
        riskReward: recommendation.riskReward,
        splitExitRatio: recommendation.splitExitRatio,
        executionModel: "SIGNAL_CLOSE",
        executionLabel: recommendation.executionLabel,
      },
      {
        patternId: recommendation.patternId,
        patternName: recommendation.patternName,
        signalDate: recommendation.signalDate,
        signalType: recommendation.signalType,
      },
    ),
  );
  const zones = buildSignalZones(candles, patternSignals, patternTrades);

  return {
    summary: {
      symbol: detail.symbol,
      name: detail.name,
      market: detail.exchange,
      sector: detail.sector ?? "-",
      currentPrice: toFixedNumber(detail.latestPrice ?? candles[candles.length - 1]?.close ?? 0),
      backtestReturnPercent: backtestStock?.returnPercent ?? 0,
      backtestContributionPercent: backtestStock?.contributionPercent ?? 0,
      cumulativeReturnPercent: summaryMetrics.cumulativeReturnPercent || backtestStock?.returnPercent || 0,
      cagr: summaryMetrics.cagr || backtestStock?.returnPercent || 0,
      maxDrawdown: summaryMetrics.maxDrawdown || Math.abs(backtestStock?.drawdownPercent ?? 0) * -1,
      winRate: summaryMetrics.winRate || backtestStock?.winRatePercent || 0,
      tradeCount: patternTrades.length,
      avgHoldingDays: summaryMetrics.avgHoldingDays || backtestStock?.holdingDays || 0,
      currentState: latestSignal?.signalType ?? (backtestStock?.signal?.toUpperCase().includes("SELL") ? "SELL" : backtestStock?.signal?.toUpperCase().includes("BUY") ? "BUY" : "NONE"),
      currentRecommendation: latestRecommendation,
      recentSignalDate: latestSignal?.signalDate ?? null,
      recentPatternSignal: latestSignal ? `${latestSignal.patternName} · ${latestSignal.signalType}` : "신호 없음",
      selectedPatternCount: new Set(patternSignals.map((signal) => signal.patternId)).size,
      sparkline: buildSparkline(detail),
      inclusionCount: patternSignals.filter((signal) => signal.signalType === "BUY").length,
      finalScore: toFixedNumber(candidateScore, 2),
      distanceTo52WeekHigh: calculateDistanceTo52WeekHigh(detail),
      momentumScore: calculateDetailMomentumScore(detail),
      liquidityStatus: buildLiquidityStatus(detail),
      currentVolume: candles[candles.length - 1]?.volume ?? 0,
    },
    candles,
    markers,
    holdingRanges,
    zones,
    priceLevels,
    signals: patternSignals,
    trades: patternTrades,
    dominantPatternId: dominantPattern?.patternId ?? null,
    dominantPatternName: dominantPattern?.patternName ?? null,
  };
}

export function buildPatternLabResult({
  detailsBySymbol,
  backtest,
  selectedSymbols,
  patterns,
  signalPlan,
  executionModel,
  startDate,
  endDate,
  candidateScores,
}: PatternLabInput): PatternLabResult {
  const enabledPatterns = patterns.filter((pattern) => pattern.enabled);
  const backtestStocks = new Map((backtest?.stockBreakdown ?? []).map((stock) => [stock.symbol, stock]));
  const stockCards: PatternLabStockCard[] = [];
  const allSignals: PatternLabSignalRow[] = [];
  const allTrades: PatternLabTradeRow[] = [];
  const allRecommendations: PatternLabRecommendationRow[] = [];
  const matrix: PatternLabMatrixCell[] = [];
  const patternsSummary: PatternLabPatternSummary[] = [];

  if (selectedSymbols.length === 0 || enabledPatterns.length === 0) {
    return {
      stocks: [],
      signals: [],
      trades: [],
      patterns: [],
      matrix: [],
      recommendations: [],
      bestStock: null,
      bestPattern: null,
    };
  }

  for (const symbol of selectedSymbols) {
    const detail = detailsBySymbol[symbol];
    if (!detail) {
      continue;
    }
    const candles = toCandles(detail, startDate, endDate);
    if (candles.length < 30) {
      continue;
    }

    const symbolSignals: PatternLabSignalRow[] = [];
    const symbolTrades: PatternLabTradeRow[] = [];
    const symbolRecommendations: PatternLabRecommendationRow[] = [];

    for (const pattern of enabledPatterns) {
      const simulation = simulatePatternForStock(detail, candles, pattern, signalPlan, executionModel);
      symbolSignals.push(...simulation.signals);
      symbolTrades.push(...simulation.trades);
      symbolRecommendations.push(...simulation.recommendations);
      matrix.push(
        buildMatrixCell(
          symbol,
          pattern,
          simulation.trades.filter((trade) => trade.patternId === pattern.id),
          simulation.signals.filter((signal) => signal.patternId === pattern.id),
        ),
      );
    }

    const stockCard = buildStockCard(
      detail,
      candles,
      backtestStocks.get(symbol) ?? null,
      candidateScores?.[symbol] ?? backtestStocks.get(symbol)?.returnPercent ?? 0,
      symbolSignals.sort((left, right) => left.signalDate.localeCompare(right.signalDate)),
      symbolTrades.sort((left, right) => left.entryDate.localeCompare(right.entryDate)),
      symbolRecommendations.sort((left, right) => left.signalDate.localeCompare(right.signalDate)),
    );
    stockCards.push(stockCard);
    allSignals.push(...stockCard.signals);
    allTrades.push(...stockCard.trades);
    allRecommendations.push(...symbolRecommendations);
  }

  for (const pattern of enabledPatterns) {
    const patternTrades = allTrades.filter((trade) => trade.patternId === pattern.id);
    const patternSignals = allSignals.filter((signal) => signal.patternId === pattern.id);
    patternsSummary.push(buildPatternSummary(pattern, patternTrades, patternSignals));
  }

  const sortedStocks = stockCards.sort((left, right) => right.summary.cumulativeReturnPercent - left.summary.cumulativeReturnPercent);
  const sortedPatterns = patternsSummary.sort((left, right) => right.averageReturnPercent - left.averageReturnPercent);

  return {
    stocks: sortedStocks,
    signals: allSignals.sort((left, right) => right.signalDate.localeCompare(left.signalDate)),
    trades: allTrades.sort((left, right) => {
      const leftDate = left.exitDate ?? left.entryDate;
      const rightDate = right.exitDate ?? right.entryDate;
      return rightDate.localeCompare(leftDate);
    }),
    patterns: sortedPatterns,
    matrix,
    recommendations: allRecommendations.sort((left, right) => right.signalDate.localeCompare(left.signalDate)),
    bestStock: sortedStocks[0]?.summary ?? null,
    bestPattern: sortedPatterns[0] ?? null,
  };
}
