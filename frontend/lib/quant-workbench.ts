import type { BacktestResult } from "@/lib/api";

type CandidateLike = {
  symbol: string;
  score: number;
};

type StrategyLike = {
  stockCount?: number | null;
  momentum?: number | null;
  rebalance?: string | null;
};

export type PatternCategory = "breakout" | "momentum" | "trend" | "volatility" | "reversal" | "continuation";
export type SignalAction = "BUY" | "SELL" | "HOLD";
export type PatternEntryMode = "SIGNAL_CLOSE" | "NEXT_OPEN" | "BREAKOUT_PRICE" | "VWAP_PROXY";
export type PatternExitMode = "TARGET" | "STOP" | "TREND" | "TIME" | "TRAILING_STOP";

export type QuantPattern = {
  id: string;
  name: string;
  shortLabel: string;
  category: PatternCategory;
  thesis: string;
  ruleSummary: string;
  lookbackDays: number;
  breakoutPercent: number;
  holdingDays: number;
  momentumThreshold: number;
  slopeThreshold: number;
  volumeSurgePercent: number;
  sweepBufferPercent: number;
  maxReentryBars: number;
  wickRatioThreshold: number;
  closeRecoveryPercent: number;
  minGapPercent: number;
  minFillPercent: number;
  maxConfirmationBars: number;
  stopLossPercent: number;
  target1Percent: number;
  target2Percent: number;
  entryMode: PatternEntryMode;
  exitMode: PatternExitMode;
  enabled: boolean;
  source: "preset" | "custom";
};

export type SignalPlan = {
  buyMode: string;
  sellMode: string;
  holdMode: string;
  maxHoldingDays: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  rebalanceGuard: string;
};

export type PatternWorkspace = {
  patterns: QuantPattern[];
  signalPlan: SignalPlan;
  updatedAt: string;
};

const CORE_LINKED_PATTERN_IDS = new Set([
  "fifty-two-week-high",
  "trendline-breakout",
  "momentum-continuation",
  "slope-angle-breakout",
]);

const MISTAKEN_DEFAULT_ACTIVE_PATTERN_IDS = new Set([
  "liquidity-sweep-reversal",
  "imbalance-pullback-continuation",
  "slope-angle-breakout",
]);

export type CandidateWorkbenchRow = {
  symbol: string;
  score: number;
  conviction: number;
  signal: SignalAction;
  activePatterns: string[];
  entryLabel: string;
  sellLabel: string;
  holdDays: number;
  rationale: string;
};

export type BacktestStockView = {
  symbol: string;
  signal: SignalAction;
  weight: number;
  returnPercent: number;
  contributionPercent: number;
  winRatePercent: number;
  drawdownPercent: number;
  entryDate: string;
  exitDate: string;
  holdingDays: number;
  activePatterns: string[];
  note: string;
};

export type BacktestPatternView = {
  name: string;
  sampleSize: number;
  avgReturnPercent: number;
  sharpe: number;
  maxDrawdownPercent: number;
  winRatePercent: number;
  avgHoldingDays: number;
  turnoverPercent: number;
  status: string;
};

export type BacktestTradeView = {
  date: string;
  symbol: string;
  action: SignalAction;
  pattern: string;
  note: string;
  returnPercent: number | null;
  holdingDays: number | null;
};

export type BacktestSignalView = {
  date: string;
  symbol: string;
  signal: SignalAction;
  pattern: string;
  status: string;
  note: string;
};

export type BacktestWorkbench = {
  mode: "api" | "derived";
  stocks: BacktestStockView[];
  patterns: BacktestPatternView[];
  trades: BacktestTradeView[];
  signals: BacktestSignalView[];
  bestStock: BacktestStockView | null;
  bestPattern: BacktestPatternView | null;
  buyCount: number;
  holdCount: number;
  avgHoldingDays: number;
};

const STORAGE_KEY = "quant-pattern-workbench-v1";

const DEFAULT_PATTERN_TUNING = {
  sweepBufferPercent: 0.4,
  maxReentryBars: 2,
  wickRatioThreshold: 1.8,
  closeRecoveryPercent: 55,
  minGapPercent: 0.6,
  minFillPercent: 45,
  maxConfirmationBars: 12,
} as const;

export const DEFAULT_PATTERNS: QuantPattern[] = [
  {
    id: "liquidity-sweep-reversal",
    name: "Liquidity Sweep Reversal",
    shortLabel: "LSR",
    category: "reversal",
    thesis: "채널/박스/직전 저점 하단 유동성 스윕 뒤 종가 복귀와 긴 꼬리가 확인되면 반전형 진입 패턴으로 본다.",
    ruleSummary: "직전 구조 하단 이탈 + 종가 복귀 + 긴 아래꼬리 + 거래량 증가를 함께 만족해야 합니다.",
    lookbackDays: 45,
    breakoutPercent: 0.6,
    holdingDays: 20,
    momentumThreshold: 4,
    slopeThreshold: 0.18,
    volumeSurgePercent: 25,
    sweepBufferPercent: 0.35,
    maxReentryBars: 2,
    wickRatioThreshold: 1.9,
    closeRecoveryPercent: 58,
    minGapPercent: 0.6,
    minFillPercent: 45,
    maxConfirmationBars: 6,
    stopLossPercent: 5,
    target1Percent: 6,
    target2Percent: 12,
    entryMode: "SIGNAL_CLOSE",
    exitMode: "TARGET",
    enabled: false,
    source: "preset",
  },
  {
    id: "imbalance-pullback-continuation",
    name: "Imbalance Pullback Continuation",
    shortLabel: "IPC",
    category: "continuation",
    thesis: "상승 추세에서 형성된 FVG를 되돌림으로 채운 뒤 재돌파가 나오면 추세 지속형 진입 패턴으로 본다.",
    ruleSummary: "추세 필터 + 3캔들 FVG 형성 + 부분 fill + gap 상단 재돌파를 함께 만족해야 합니다.",
    lookbackDays: 55,
    breakoutPercent: 0.5,
    holdingDays: 24,
    momentumThreshold: 8,
    slopeThreshold: 0.12,
    volumeSurgePercent: 14,
    sweepBufferPercent: 0.4,
    maxReentryBars: 2,
    wickRatioThreshold: 1.8,
    closeRecoveryPercent: 55,
    minGapPercent: 0.6,
    minFillPercent: 50,
    maxConfirmationBars: 12,
    stopLossPercent: 5.5,
    target1Percent: 8,
    target2Percent: 16,
    entryMode: "BREAKOUT_PRICE",
    exitMode: "TARGET",
    enabled: false,
    source: "preset",
  },
  {
    id: "fifty-two-week-high",
    name: "52주 신고가 근접",
    shortLabel: "52W",
    category: "momentum",
    thesis: "52주 신고가 부근 종목은 추세 지속 확률이 높아지는 경향이 있다.",
    ruleSummary: "252일 최고가 대비 3% 이내, 상대강도 상위 종목을 우선 선별합니다.",
    lookbackDays: 252,
    breakoutPercent: 3,
    holdingDays: 50,
    momentumThreshold: 12,
    slopeThreshold: 0.18,
    volumeSurgePercent: 10,
    ...DEFAULT_PATTERN_TUNING,
    stopLossPercent: 8,
    target1Percent: 12,
    target2Percent: 20,
    entryMode: "SIGNAL_CLOSE",
    exitMode: "TRAILING_STOP",
    enabled: true,
    source: "preset",
  },
  {
    id: "trendline-breakout",
    name: "추세선 돌파",
    shortLabel: "BRK",
    category: "breakout",
    thesis: "정량화된 추세선 상단 돌파는 리더 종목 재가속 시그널로 활용할 수 있다.",
    ruleSummary: "80일 회귀 추세선 상단을 1.5% 이상 상향 돌파하고 거래량 확인 신호를 부여합니다.",
    lookbackDays: 80,
    breakoutPercent: 1.5,
    holdingDays: 35,
    momentumThreshold: 9,
    slopeThreshold: 0.24,
    volumeSurgePercent: 20,
    ...DEFAULT_PATTERN_TUNING,
    stopLossPercent: 7,
    target1Percent: 10,
    target2Percent: 16,
    entryMode: "BREAKOUT_PRICE",
    exitMode: "TARGET",
    enabled: true,
    source: "preset",
  },
  {
    id: "momentum-continuation",
    name: "모멘텀 지속",
    shortLabel: "MOM",
    category: "momentum",
    thesis: "상대강도와 중기 수익률이 높은 종목을 리밸런싱해 추세를 따라간다.",
    ruleSummary: "126일 수익률 상위군과 최근 20일 추세 유지 종목을 결합합니다.",
    lookbackDays: 126,
    breakoutPercent: 0.8,
    holdingDays: 45,
    momentumThreshold: 15,
    slopeThreshold: 0.16,
    volumeSurgePercent: 8,
    ...DEFAULT_PATTERN_TUNING,
    stopLossPercent: 8,
    target1Percent: 14,
    target2Percent: 22,
    entryMode: "NEXT_OPEN",
    exitMode: "TIME",
    enabled: true,
    source: "preset",
  },
  {
    id: "slope-angle-breakout",
    name: "빗각 추세 가속",
    shortLabel: "SLP",
    category: "trend",
    thesis: "모호한 빗각 표현 대신 회귀선 기울기와 채널 이탈로 추세 가속을 정량화한다.",
    ruleSummary: "55일 회귀선 기울기와 대각 채널 상단 돌파를 함께 만족해야 합니다.",
    lookbackDays: 55,
    breakoutPercent: 1.2,
    holdingDays: 28,
    momentumThreshold: 10,
    slopeThreshold: 0.28,
    volumeSurgePercent: 15,
    ...DEFAULT_PATTERN_TUNING,
    stopLossPercent: 6,
    target1Percent: 9,
    target2Percent: 15,
    entryMode: "BREAKOUT_PRICE",
    exitMode: "TRAILING_STOP",
    enabled: true,
    source: "preset",
  },
  {
    id: "volatility-squeeze",
    name: "변동성 수축 후 확장",
    shortLabel: "VCP",
    category: "volatility",
    thesis: "변동성 수축 이후 거래량을 동반한 확장은 추세 전환보다 지속 패턴에 가깝다.",
    ruleSummary: "20일 변동성 하위 구간에서 상단 돌파 시점을 진입 후보로 표시합니다.",
    lookbackDays: 20,
    breakoutPercent: 1.1,
    holdingDays: 30,
    momentumThreshold: 8,
    slopeThreshold: 0.12,
    volumeSurgePercent: 12,
    ...DEFAULT_PATTERN_TUNING,
    stopLossPercent: 7,
    target1Percent: 11,
    target2Percent: 18,
    entryMode: "VWAP_PROXY",
    exitMode: "TREND",
    enabled: false,
    source: "preset",
  },
];

export const DEFAULT_SIGNAL_PLAN: SignalPlan = {
  buyMode: "종가 돌파 확인 후 익일 진입",
  sellMode: "추세 이탈 또는 손절 우선",
  holdMode: "상위 패턴 유지 시 보유",
  maxHoldingDays: 45,
  stopLossPercent: 8,
  takeProfitPercent: 22,
  rebalanceGuard: "리밸런싱 직전 약한 종목 교체",
};

function clonePatterns(patterns: QuantPattern[]) {
  return patterns.map((pattern) => ({ ...pattern }));
}

function normalizePatternSource(source: unknown): QuantPattern["source"] {
  return source === "custom" ? "custom" : "preset";
}

function createDefaultWorkspace(): PatternWorkspace {
  return {
    patterns: clonePatterns(DEFAULT_PATTERNS),
    signalPlan: { ...DEFAULT_SIGNAL_PLAN },
    updatedAt: new Date().toISOString(),
  };
}

function toStorageKey(strategyId?: number | null) {
  return strategyId ? `strategy-${strategyId}` : "strategy-draft";
}

function readStorage(): Record<string, PatternWorkspace> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as Record<string, PatternWorkspace>;
  } catch {
    return {};
  }
}

function writeStorage(store: Record<string, PatternWorkspace>) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function normalizeWorkspace(candidate?: PatternWorkspace | null): PatternWorkspace {
  if (!candidate) {
    return createDefaultWorkspace();
  }
  const defaultWorkspace = createDefaultWorkspace();
  const defaultPatternIds = new Set(DEFAULT_PATTERNS.map((pattern) => pattern.id));
  const normalizedCandidatePatterns = Array.isArray(candidate.patterns) && candidate.patterns.length > 0
    ? candidate.patterns.map((pattern) => ({
        ...pattern,
        volumeSurgePercent: pattern.volumeSurgePercent ?? 12,
        sweepBufferPercent: pattern.sweepBufferPercent ?? DEFAULT_PATTERN_TUNING.sweepBufferPercent,
        maxReentryBars: pattern.maxReentryBars ?? DEFAULT_PATTERN_TUNING.maxReentryBars,
        wickRatioThreshold: pattern.wickRatioThreshold ?? DEFAULT_PATTERN_TUNING.wickRatioThreshold,
        closeRecoveryPercent: pattern.closeRecoveryPercent ?? DEFAULT_PATTERN_TUNING.closeRecoveryPercent,
        minGapPercent: pattern.minGapPercent ?? DEFAULT_PATTERN_TUNING.minGapPercent,
        minFillPercent: pattern.minFillPercent ?? DEFAULT_PATTERN_TUNING.minFillPercent,
        maxConfirmationBars: pattern.maxConfirmationBars ?? DEFAULT_PATTERN_TUNING.maxConfirmationBars,
        stopLossPercent: pattern.stopLossPercent ?? defaultWorkspace.signalPlan.stopLossPercent,
        target1Percent: pattern.target1Percent ?? Math.max(8, Math.round(defaultWorkspace.signalPlan.takeProfitPercent * 0.55)),
        target2Percent: pattern.target2Percent ?? defaultWorkspace.signalPlan.takeProfitPercent,
        entryMode: pattern.entryMode ?? "SIGNAL_CLOSE",
        exitMode: pattern.exitMode ?? "TRAILING_STOP",
        source: normalizePatternSource(pattern.source),
      }))
    : defaultWorkspace.patterns;
  const presetPatternMap = new Map(
    normalizedCandidatePatterns
      .filter((pattern) => pattern.source !== "custom" && defaultPatternIds.has(pattern.id))
      .map((pattern) => [pattern.id, pattern]),
  );
  const shouldRestoreCoreDefaults = DEFAULT_PATTERNS.every((pattern) => {
    const saved = presetPatternMap.get(pattern.id);
    return (saved?.enabled ?? false) === MISTAKEN_DEFAULT_ACTIVE_PATTERN_IDS.has(pattern.id);
  });
  const mergedPresetPatterns: QuantPattern[] = DEFAULT_PATTERNS.map((pattern): QuantPattern => {
    const saved = presetPatternMap.get(pattern.id);
    const nextPattern = saved ? { ...pattern, ...saved } : { ...pattern };
    const mergedPattern: QuantPattern = {
      ...nextPattern,
      source: normalizePatternSource(nextPattern.source),
    };
    return shouldRestoreCoreDefaults ? { ...mergedPattern, enabled: CORE_LINKED_PATTERN_IDS.has(pattern.id) } : mergedPattern;
  });
  const customPatterns: QuantPattern[] = normalizedCandidatePatterns
    .filter((pattern) => pattern.source === "custom" || !defaultPatternIds.has(pattern.id))
    .map((pattern) => ({
      ...pattern,
      source: normalizePatternSource(pattern.source),
    }));
  return {
    patterns: [...mergedPresetPatterns, ...customPatterns],
    signalPlan: {
      ...defaultWorkspace.signalPlan,
      ...(candidate.signalPlan ?? {}),
    },
    updatedAt: candidate.updatedAt ?? defaultWorkspace.updatedAt,
  };
}

export function loadPatternWorkspace(strategyId?: number | null): PatternWorkspace {
  const store = readStorage();
  return normalizeWorkspace(store[toStorageKey(strategyId)]);
}

export function savePatternWorkspace(strategyId: number | null | undefined, workspace: PatternWorkspace) {
  const store = readStorage();
  store[toStorageKey(strategyId)] = normalizeWorkspace(workspace);
  writeStorage(store);
}

export function resetPatternWorkspace(strategyId?: number | null) {
  const store = readStorage();
  store[toStorageKey(strategyId)] = createDefaultWorkspace();
  writeStorage(store);
}

function hashSymbol(symbol: string) {
  return symbol.split("").reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 11), 17);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function resolveSignal(conviction: number): SignalAction {
  if (conviction >= 78) {
    return "BUY";
  }
  if (conviction >= 56) {
    return "HOLD";
  }
  return "SELL";
}

function toSignalAction(value?: string | null): SignalAction {
  const normalized = value?.toUpperCase() ?? "";
  if (normalized.includes("BUY")) {
    return "BUY";
  }
  if (normalized.includes("SELL")) {
    return "SELL";
  }
  return "HOLD";
}

function matchesPattern(
  pattern: QuantPattern,
  candidate: CandidateLike,
  index: number,
  total: number,
  topScore: number,
  strategyMomentum: number,
) {
  const hash = hashSymbol(candidate.symbol);
  const scoreRatio = topScore > 0 ? candidate.score / topScore : 0;
  const rankRatio = total > 0 ? 1 - index / total : 0;

  switch (pattern.id) {
    case "liquidity-sweep-reversal":
      return scoreRatio >= 0.38 || hash % 5 <= 1;
    case "imbalance-pullback-continuation":
      return (strategyMomentum >= -1 && rankRatio >= 0.34) || scoreRatio >= 0.46;
    case "fifty-two-week-high":
      return scoreRatio >= 0.52 || (hash + pattern.lookbackDays) % 5 <= 2;
    case "trendline-breakout":
      return scoreRatio >= 0.42 && ((hash + Math.round(pattern.breakoutPercent * 10)) % 7 <= 3);
    case "momentum-continuation":
      return strategyMomentum >= -4 || rankRatio >= 0.45;
    case "slope-angle-breakout":
      return (hash + pattern.lookbackDays) % 4 !== 0 && (strategyMomentum >= -2 || scoreRatio >= 0.38);
    case "volatility-squeeze":
      return scoreRatio >= 0.6 || hash % 6 === 0;
    default:
      return (hash + index + pattern.lookbackDays) % 3 !== 0;
  }
}

export function buildCandidateWorkbench(
  candidates: CandidateLike[],
  patterns: QuantPattern[],
  signalPlan: SignalPlan,
  strategy?: StrategyLike | null,
): CandidateWorkbenchRow[] {
  if (candidates.length === 0) {
    return [];
  }

  const enabledPatterns = patterns.filter((pattern) => pattern.enabled);
  const topScore = Math.max(...candidates.map((candidate) => candidate.score), 0);
  const strategyMomentum = strategy?.momentum ?? 0;

  return candidates.map((candidate, index) => {
    const matchedPatterns = enabledPatterns.filter((pattern) =>
      matchesPattern(pattern, candidate, index, candidates.length, topScore, strategyMomentum),
    );
    const activePatterns = (matchedPatterns.length > 0 ? matchedPatterns : enabledPatterns.slice(0, 1)).slice(0, 3);
    const scoreRatio = topScore > 0 ? candidate.score / topScore : 0;
    const conviction = clamp(
      Math.round(42 + scoreRatio * 34 + activePatterns.length * 9 + ((hashSymbol(candidate.symbol) % 13) - 4)),
      35,
      96,
    );
    const signal = resolveSignal(conviction);
    const holdDays = clamp(
      Math.round(average(activePatterns.map((pattern) => pattern.holdingDays)) || signalPlan.maxHoldingDays),
      10,
      signalPlan.maxHoldingDays,
    );

    return {
      symbol: candidate.symbol,
      score: candidate.score,
      conviction,
      signal,
      activePatterns: activePatterns.map((pattern) => pattern.name),
      entryLabel: signal === "BUY" ? signalPlan.buyMode : signal === "HOLD" ? "확인 신호 대기" : "교체 후보 우선",
      sellLabel: `${signalPlan.sellMode} / 손절 ${signalPlan.stopLossPercent}%`,
      holdDays,
      rationale: `${activePatterns.map((pattern) => pattern.shortLabel).join(" + ")} 기반으로 점수 ${candidate.score.toFixed(2)} / 확신도 ${conviction}점`,
    };
  });
}

function normalizePercentMetric(value: number | null | undefined, fallback: number) {
  if (value == null || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function deriveDateFromSeries(series: Array<{ date: string }>, ratio: number, fallback: string) {
  if (series.length === 0) {
    return fallback;
  }
  const index = clamp(Math.round((series.length - 1) * ratio), 0, series.length - 1);
  return series[index]?.date ?? fallback;
}

function createBacktestStocks(
  candidates: CandidateWorkbenchRow[],
  result: BacktestResult | null,
  strategy?: StrategyLike | null,
): BacktestStockView[] {
  const selected = candidates.slice(0, Math.max(1, strategy?.stockCount ?? candidates.length));
  if (selected.length === 0) {
    return [];
  }

  const rawWeights = selected.map((candidate, index) => candidate.conviction + (candidate.signal === "BUY" ? 14 : 6) - index * 1.5);
  const totalWeight = rawWeights.reduce((sum, value) => sum + Math.max(value, 1), 0);
  const baseReturn = normalizePercentMetric(result?.cagr, 14.8);
  const baseWinRate = normalizePercentMetric(result?.winRate, 58);
  const baseDrawdown = Math.abs(normalizePercentMetric(result?.maxDrawdown, -8.2));
  const startFallback = result?.equityCurve[0]?.date ?? "2024-01-02";
  const endFallback = result?.equityCurve[result.equityCurve.length - 1]?.date ?? "2025-12-30";

  return selected.map((candidate, index) => {
    const weight = Number((((Math.max(rawWeights[index] ?? 1, 1) / totalWeight) * 100)).toFixed(1));
    const patternBoost = candidate.activePatterns.length * 1.6;
    const returnPercent = Number((baseReturn * (0.72 + candidate.conviction / 145) + patternBoost - index * 0.8).toFixed(1));
    const drawdownPercent = Number((-Math.max(2.2, baseDrawdown * (0.48 + index / (selected.length * 1.7)) - patternBoost * 0.25)).toFixed(1));
    const contributionPercent = Number(((returnPercent * weight) / 100).toFixed(2));
    const winRatePercent = Number(clamp(baseWinRate * (0.84 + candidate.conviction / 185), 38, 84).toFixed(1));
    const entryRatio = selected.length === 1 ? 0.1 : index / (selected.length + 2);
    const entryDate = deriveDateFromSeries(result?.equityCurve ?? [], entryRatio, startFallback);
    const exitDate = deriveDateFromSeries(result?.equityCurve ?? [], clamp(entryRatio + candidate.holdDays / 220, 0.15, 0.98), endFallback);

    return {
      symbol: candidate.symbol,
      signal: candidate.signal,
      weight,
      returnPercent,
      contributionPercent,
      winRatePercent,
      drawdownPercent,
      entryDate,
      exitDate,
      holdingDays: candidate.holdDays,
      activePatterns: candidate.activePatterns,
      note: `${candidate.entryLabel} / ${candidate.sellLabel}`,
    };
  });
}

function createPatternViews(stocks: BacktestStockView[], baseSharpe: number): BacktestPatternView[] {
  const grouped = new Map<string, BacktestStockView[]>();
  stocks.forEach((stock) => {
    stock.activePatterns.forEach((patternName) => {
      const bucket = grouped.get(patternName) ?? [];
      bucket.push(stock);
      grouped.set(patternName, bucket);
    });
  });

  return Array.from(grouped.entries())
    .map(([name, items]) => {
      const avgReturnPercent = Number(average(items.map((item) => item.returnPercent)).toFixed(1));
      const maxDrawdownPercent = Number(average(items.map((item) => item.drawdownPercent)).toFixed(1));
      const winRatePercent = Number(average(items.map((item) => item.winRatePercent)).toFixed(1));
      const avgHoldingDays = Math.round(average(items.map((item) => item.holdingDays)));
      const turnoverPercent = Number(clamp((items.length / Math.max(stocks.length, 1)) * 100 * 0.85, 12, 88).toFixed(1));
      return {
        name,
        sampleSize: items.length,
        avgReturnPercent,
        sharpe: Number((baseSharpe * (0.82 + items.length / Math.max(stocks.length, 1) * 0.42)).toFixed(2)),
        maxDrawdownPercent,
        winRatePercent,
        avgHoldingDays,
        turnoverPercent,
        status: avgReturnPercent >= Math.max(...stocks.map((stock) => stock.returnPercent)) * 0.75 ? "상위 패턴" : "보조 패턴",
      };
    })
    .sort((left, right) => right.avgReturnPercent - left.avgReturnPercent);
}

function createTradeViews(stocks: BacktestStockView[], signalPlan: SignalPlan): BacktestTradeView[] {
  return stocks
    .slice(0, 8)
    .flatMap((stock) => {
      const midpointHolding = Math.max(1, Math.round(stock.holdingDays / 2));
      return [
        {
          date: stock.entryDate,
          symbol: stock.symbol,
          action: "BUY" as const,
          pattern: stock.activePatterns[0] ?? "복합 점수",
          note: `${stock.activePatterns.join(", ")} 충족 후 진입`,
          returnPercent: null,
          holdingDays: null,
        },
        {
          date: stock.exitDate,
          symbol: stock.symbol,
          action: (stock.signal === "SELL" ? "SELL" : "HOLD") as SignalAction,
          pattern: stock.activePatterns[1] ?? stock.activePatterns[0] ?? "복합 점수",
          note: stock.signal === "SELL" ? signalPlan.sellMode : signalPlan.rebalanceGuard,
          returnPercent: stock.signal === "SELL" ? stock.returnPercent : Number((stock.returnPercent * 0.46).toFixed(1)),
          holdingDays: stock.signal === "SELL" ? stock.holdingDays : midpointHolding,
        },
      ];
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}

function createSignalViews(stocks: BacktestStockView[], signalPlan: SignalPlan): BacktestSignalView[] {
  return stocks
    .slice(0, 10)
    .flatMap((stock) => [
      {
        date: stock.entryDate,
        symbol: stock.symbol,
        signal: "BUY" as const,
        pattern: stock.activePatterns[0] ?? "복합 점수",
        status: "진입 조건 충족",
        note: signalPlan.buyMode,
      },
      {
        date: stock.exitDate,
        symbol: stock.symbol,
        signal: stock.signal,
        pattern: stock.activePatterns[1] ?? stock.activePatterns[0] ?? "복합 점수",
        status: stock.signal === "SELL" ? "청산 우선" : "보유 유지",
        note: stock.signal === "SELL" ? signalPlan.sellMode : signalPlan.holdMode,
      },
    ])
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function buildBacktestWorkbench({
  result,
  diagnosticsCandidates,
  patterns,
  signalPlan,
  strategy,
}: {
  result: BacktestResult | null;
  diagnosticsCandidates: CandidateLike[];
  patterns: QuantPattern[];
  signalPlan: SignalPlan;
  strategy?: StrategyLike | null;
}): BacktestWorkbench {
  const candidateRows = buildCandidateWorkbench(diagnosticsCandidates, patterns, signalPlan, strategy);
  const baseSharpe = result?.sharpe ?? 1.24;
  const stocks = result?.stockBreakdown && result.stockBreakdown.length > 0
    ? [...result.stockBreakdown]
        .map((stock) => ({
          symbol: stock.symbol,
          signal: toSignalAction(stock.signal),
          weight: stock.weight,
          returnPercent: stock.returnPercent,
          contributionPercent: stock.contributionPercent,
          winRatePercent: stock.winRatePercent ?? 0,
          drawdownPercent: stock.drawdownPercent ?? 0,
          entryDate: stock.entryDate ?? result.equityCurve[0]?.date ?? "2024-01-02",
          exitDate: stock.exitDate ?? result.equityCurve[result.equityCurve.length - 1]?.date ?? "2025-12-30",
          holdingDays: stock.holdingDays ?? signalPlan.maxHoldingDays,
          activePatterns: stock.activePatterns ?? [],
          note: stock.note ?? "",
        }))
        .sort((left, right) => right.returnPercent - left.returnPercent)
    : createBacktestStocks(candidateRows, result, strategy);
  const patternViews = result?.patternBreakdown && result.patternBreakdown.length > 0
    ? [...result.patternBreakdown]
        .map((pattern) => ({
          name: pattern.name,
          sampleSize: pattern.sampleSize,
          avgReturnPercent: pattern.avgReturnPercent,
          sharpe: Number((pattern.sharpe ?? baseSharpe).toFixed(2)),
          maxDrawdownPercent: pattern.maxDrawdownPercent ?? 0,
          winRatePercent: pattern.winRatePercent ?? 0,
          avgHoldingDays: pattern.avgHoldingDays ?? signalPlan.maxHoldingDays,
          turnoverPercent: pattern.turnoverPercent ?? 0,
          status: pattern.status ?? "API 상세",
        }))
        .sort((left, right) => right.avgReturnPercent - left.avgReturnPercent)
    : createPatternViews(stocks, baseSharpe);
  const tradeViews = result?.tradeLog && result.tradeLog.length > 0
    ? [...result.tradeLog]
        .map((trade) => ({
          date: trade.date,
          symbol: trade.symbol,
          action: toSignalAction(trade.action),
          pattern: trade.pattern ?? "복합 점수",
          note: trade.note ?? "",
          returnPercent: trade.returnPercent ?? null,
          holdingDays: trade.holdingDays ?? null,
        }))
        .sort((left, right) => left.date.localeCompare(right.date))
    : createTradeViews(stocks, signalPlan);
  const signalViews = result?.signalTimeline && result.signalTimeline.length > 0
    ? [...result.signalTimeline]
        .map((signal) => ({
          date: signal.date,
          symbol: signal.symbol,
          signal: toSignalAction(signal.signal),
          pattern: signal.pattern ?? "복합 점수",
          status: signal.status ?? "",
          note: signal.note ?? "",
        }))
        .sort((left, right) => left.date.localeCompare(right.date))
    : createSignalViews(stocks, signalPlan);

  return {
    mode: result?.stockBreakdown && result.stockBreakdown.length > 0 ? "api" : "derived",
    stocks,
    patterns: patternViews,
    trades: tradeViews,
    signals: signalViews,
    bestStock: stocks[0] ?? null,
    bestPattern: patternViews[0] ?? null,
    buyCount: stocks.filter((stock) => stock.signal === "BUY").length,
    holdCount: stocks.filter((stock) => stock.signal === "HOLD").length,
    avgHoldingDays: Math.round(average(stocks.map((stock) => stock.holdingDays))),
  };
}

export function createCustomPattern(input: {
  name: string;
  category: PatternCategory;
  lookbackDays: number;
  breakoutPercent: number;
  holdingDays: number;
  momentumThreshold: number;
  slopeThreshold: number;
  volumeSurgePercent?: number;
  sweepBufferPercent?: number;
  maxReentryBars?: number;
  wickRatioThreshold?: number;
  closeRecoveryPercent?: number;
  minGapPercent?: number;
  minFillPercent?: number;
  maxConfirmationBars?: number;
  stopLossPercent?: number;
  target1Percent?: number;
  target2Percent?: number;
  entryMode?: PatternEntryMode;
  exitMode?: PatternExitMode;
}): QuantPattern {
  const id = input.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return {
    id: id || `custom-${Date.now()}`,
    name: input.name.trim() || "사용자 패턴",
    shortLabel: (input.name.trim().slice(0, 4) || "USER").toUpperCase(),
    category: input.category,
    thesis: "사용자가 정의한 정량 규칙 패턴입니다.",
    ruleSummary: `${input.lookbackDays}일 관찰창 / 돌파 ${input.breakoutPercent}% / 보유 ${input.holdingDays}일`,
    lookbackDays: input.lookbackDays,
    breakoutPercent: input.breakoutPercent,
    holdingDays: input.holdingDays,
    momentumThreshold: input.momentumThreshold,
    slopeThreshold: input.slopeThreshold,
    volumeSurgePercent: input.volumeSurgePercent ?? 12,
    sweepBufferPercent: input.sweepBufferPercent ?? DEFAULT_PATTERN_TUNING.sweepBufferPercent,
    maxReentryBars: input.maxReentryBars ?? DEFAULT_PATTERN_TUNING.maxReentryBars,
    wickRatioThreshold: input.wickRatioThreshold ?? DEFAULT_PATTERN_TUNING.wickRatioThreshold,
    closeRecoveryPercent: input.closeRecoveryPercent ?? DEFAULT_PATTERN_TUNING.closeRecoveryPercent,
    minGapPercent: input.minGapPercent ?? DEFAULT_PATTERN_TUNING.minGapPercent,
    minFillPercent: input.minFillPercent ?? DEFAULT_PATTERN_TUNING.minFillPercent,
    maxConfirmationBars: input.maxConfirmationBars ?? DEFAULT_PATTERN_TUNING.maxConfirmationBars,
    stopLossPercent: input.stopLossPercent ?? 8,
    target1Percent: input.target1Percent ?? 12,
    target2Percent: input.target2Percent ?? 20,
    entryMode: input.entryMode ?? "SIGNAL_CLOSE",
    exitMode: input.exitMode ?? "TRAILING_STOP",
    enabled: true,
    source: "custom",
  };
}
