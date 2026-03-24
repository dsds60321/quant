import type { BacktestUniverseScopePayload } from "@/lib/backtest-universe";

const SERVER_API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8080";
const BROWSER_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/backend-api";
const ENABLE_API_FALLBACK = process.env.ENABLE_API_FALLBACK === "true" || process.env.NEXT_PUBLIC_ENABLE_API_FALLBACK === "true";

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string | null;
  timestamp?: string;
};

export class ApiRequestError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

function getApiBaseUrl(): string {
  return typeof window === "undefined" ? SERVER_API_BASE_URL : BROWSER_API_BASE_URL;
}

async function parseEnvelope<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok) {
    throw new ApiRequestError(payload?.message ?? `API 요청 실패: ${response.status}`, response.status);
  }

  if (!payload || !payload.success || payload.data === undefined || payload.data === null) {
    throw new ApiRequestError(payload?.message ?? "API 응답 데이터가 비어 있습니다.", response.status);
  }

  return payload.data;
}

async function requestJson<T>(path: string, fallback?: T): Promise<T> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });

    return await parseEnvelope<T>(response);
  } catch (error) {
    if (ENABLE_API_FALLBACK && fallback !== undefined) {
      return fallback;
    }
    throw error;
  }
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return parseEnvelope<T>(response);
}

async function postJsonAllowEmpty<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  return parseEnvelope<T>(response);
}

export type DashboardSummary = {
  portfolioValue: number;
  dailyReturn: number;
  sharpe: number;
  alpha: number;
  maxDrawdown: number;
  activeStrategies: number;
};

export type MarketIndex = {
  symbol: string;
  name: string;
  lastPrice: number;
  changePercent: number;
  series: number[];
  rangeSeries: Record<string, number[]>;
  candles: MarketCandle[];
  rangeCandles: Record<string, MarketCandle[]>;
};

export type MarketCandle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MarketSector = {
  sector: string;
  changePercent: number;
  stockCount: number;
};

export type PortfolioPosition = {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
};

export type PortfolioSummary = {
  portfolioId: number;
  portfolioName: string;
  totalMarketValue: number;
  totalUnrealizedPnl: number;
  positions: PortfolioPosition[];
};

export type PortfolioListItem = {
  portfolioId: number;
  name: string;
  baseCurrency: string;
  status: string;
  portfolioValue: number;
  pnl: number;
  dailyReturn: number;
  positionCount: number;
};

export type ManagedPosition = {
  id: number;
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
};

export type PortfolioDetail = {
  portfolioId: number;
  name: string;
  baseCurrency: string;
  status: string;
  portfolioValue: number;
  pnl: number;
  dailyReturn: number;
  positions: ManagedPosition[];
};

export type StockLookupItem = {
  symbol: string;
  name: string;
  exchange: string;
  marketType: "DOMESTIC" | "INTERNATIONAL";
  assetGroup: "KOSPI" | "KOSDAQ" | "ETF" | "STOCK";
  currency: string;
  marketCap?: number | null;
};

export type StockRegistrationResult = StockLookupItem;

export type StockDataPricePoint = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  adjClose: number | null;
  volume: number;
};

export type StockDataFundamentalPoint = {
  date: string;
  per: number | null;
  pbr: number | null;
  roe: number | null;
  eps: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  revenue: number | null;
  netIncome: number | null;
};

export type StockDataNewsItem = {
  title: string;
  source: string;
  publishedAt: string | null;
  sentimentScore: number | null;
  impactScore: number | null;
  url: string;
};

export type StockDataEventItem = {
  eventType: string;
  eventDate: string | null;
  description: string | null;
  priceT1: number | null;
  priceT5: number | null;
  priceT20: number | null;
};

export type StockDataDetail = {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  latestPriceDate: string | null;
  latestPrice: number | null;
  previousClose: number | null;
  changePercent: number | null;
  priceRowCount: number;
  fundamentalsRowCount: number;
  newsCount: number;
  eventCount: number;
  priceSeries: StockDataPricePoint[];
  fundamentals: StockDataFundamentalPoint[];
  news: StockDataNewsItem[];
  events: StockDataEventItem[];
};

export type PortfolioCreateResponse = {
  portfolioId: number;
};

export type AssetRegistrationResponse = {
  assetId: number;
  portfolioId: number;
  symbol: string;
  quantity: number;
  avgPrice: number;
};

export type AssetDeleteResponse = {
  assetId: number;
  deleted: boolean;
};

export type DeleteResult = {
  id: number;
  deleted: boolean;
};

export type DataSourceStatus = {
  name: string;
  provider: string;
  status: string;
  lastSyncTime: string | null;
  rowCount?: number | null;
};

export type ActiveDataJob = {
  jobId: number;
  jobType: string;
  status: string;
  startedAt: string | null;
  message: string | null;
  progressPercent: number | null;
  stage: string | null;
  stageLabel: string | null;
  processedCount: number | null;
  totalCount: number | null;
};

export type DataStatus = {
  lastCrawlTime: string;
  latestPriceDate: string | null;
  latestFundamentalsDate: string | null;
  latestBenchmarkDate: string | null;
  priceRowCount: number;
  fundamentalsRowCount: number;
  benchmarkRowCount: number;
  newsIngestionRate: string;
  nlpStatus: string;
  featureGenerationStatus: string;
  sources: DataSourceStatus[];
  queueStatus: string;
  activeJob: ActiveDataJob | null;
};

export type AlternativeDataset = {
  dataset: string;
  provider: string;
  lastCollectedAt: string | null;
  recordCount: number;
  status: string;
};

export type AlternativeDataSummary = {
  totalDatasets: number;
  activeDatasets: number;
  totalRecords: number;
  datasets: AlternativeDataset[];
};

export type DataUpdateResult = {
  accepted: boolean;
  jobId: number | null;
  status: string;
  message: string;
  pricesUpdated: number | null;
  fundamentalsUpdated: number | null;
  benchmarksUpdated: number | null;
  jobsWritten: number[];
};

export type JobItem = {
  id: number;
  jobType: string;
  parentJobId: number | null;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  message: string | null;
  metadataJson: string | null;
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return requestJson("/api/dashboard?portfolioId=1", {
    portfolioValue: 1284000000,
    dailyReturn: 1.28,
    sharpe: 1.94,
    alpha: 3.12,
    maxDrawdown: -7.8,
    activeStrategies: 3,
  });
}

export async function getMarketIndices(): Promise<MarketIndex[]> {
  return requestJson("/api/market/indices");
}

export async function getMarketSectors(): Promise<MarketSector[]> {
  return requestJson("/api/market/sectors", [
    { sector: "정보기술", changePercent: 2.4, stockCount: 138 },
    { sector: "금융", changePercent: -1.1, stockCount: 84 },
    { sector: "헬스케어", changePercent: 0.7, stockCount: 66 },
    { sector: "에너지", changePercent: -0.4, stockCount: 42 },
    { sector: "경기소비재", changePercent: 1.0, stockCount: 91 },
  ]);
}

export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  return requestJson("/api/portfolio?portfolioId=1", {
    portfolioId: 1,
    portfolioName: "기본 포트폴리오",
    totalMarketValue: 1824000000,
    totalUnrealizedPnl: 74200000,
    positions: [
      { symbol: "삼성전자", quantity: 1240, avgPrice: 61000, currentPrice: 64300, marketValue: 79732000, unrealizedPnl: 4092000 },
      { symbol: "TIGER 미국S&P500", quantity: 820, avgPrice: 17840, currentPrice: 18420, marketValue: 15104400, unrealizedPnl: 475600 },
      { symbol: "국고채 10년", quantity: 140, avgPrice: 102400, currentPrice: 103400, marketValue: 14476000, unrealizedPnl: 140000 },
    ],
  });
}

export async function listPortfolios(): Promise<PortfolioListItem[]> {
  return requestJson("/api/portfolio", [
    {
      portfolioId: 1,
      name: "AI 성장 포트폴리오",
      baseCurrency: "USD",
      status: "ACTIVE",
      portfolioValue: 128000,
      pnl: 5400,
      dailyReturn: 1.2,
      positionCount: 4,
    },
    {
      portfolioId: 2,
      name: "퀄리티 인컴 포트폴리오",
      baseCurrency: "KRW",
      status: "ACTIVE",
      portfolioValue: 342000000,
      pnl: -4200000,
      dailyReturn: -0.48,
      positionCount: 6,
    },
  ]);
}

export async function createPortfolio(request: {
  name: string;
  baseCurrency: string;
}): Promise<PortfolioCreateResponse> {
  return postJson("/api/portfolio", request);
}

export async function registerPortfolioAsset(request: {
  portfolioId: number;
  symbol: string;
  quantity: number;
  avgPrice: number;
}): Promise<AssetRegistrationResponse> {
  return postJson("/api/portfolio/asset", request);
}

export async function getPortfolioDetail(portfolioId: number): Promise<PortfolioDetail> {
  return requestJson(`/api/portfolio/${portfolioId}`, {
    portfolioId,
    name: portfolioId === 1 ? "AI 성장 포트폴리오" : "기본 포트폴리오",
    baseCurrency: portfolioId === 1 ? "USD" : "KRW",
    status: "ACTIVE",
    portfolioValue: portfolioId === 1 ? 128000 : 1824000000,
    pnl: portfolioId === 1 ? 5400 : 74200000,
    dailyReturn: portfolioId === 1 ? 1.2 : 0.84,
    positions: [
      { id: 1, symbol: "NVDA", quantity: 10, avgPrice: 900, currentPrice: 920, marketValue: 9200, pnl: 200 },
      { id: 2, symbol: "MSFT", quantity: 8, avgPrice: 412, currentPrice: 426, marketValue: 3408, pnl: 112 },
    ],
  });
}

export async function deletePortfolioAsset(assetId: number): Promise<AssetDeleteResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/portfolio/asset/${assetId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  return parseEnvelope<AssetDeleteResponse>(response);
}

export async function searchStocks(request: {
  query: string;
  marketType?: "DOMESTIC" | "INTERNATIONAL";
  assetGroup?: "KOSPI" | "KOSDAQ" | "ETF" | "STOCK";
  limit?: number;
}): Promise<StockLookupItem[]> {
  const params = new URLSearchParams({ q: request.query, limit: String(request.limit ?? 20) });
  if (request.marketType) {
    params.set("marketType", request.marketType);
  }
  if (request.assetGroup) {
    params.set("assetGroup", request.assetGroup);
  }

  return requestJson(`/api/stocks/search?${params.toString()}`, [
    { symbol: "005930", name: "삼성전자", exchange: "KOSPI", marketType: "DOMESTIC", assetGroup: "KOSPI", currency: "KRW", marketCap: 1000 },
    { symbol: "069500", name: "KODEX 200", exchange: "KOSPI", marketType: "DOMESTIC", assetGroup: "ETF", currency: "KRW", marketCap: 800 },
    { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", marketType: "INTERNATIONAL", assetGroup: "STOCK", currency: "USD", marketCap: 2000 },
    { symbol: "QQQ", name: "Invesco QQQ Trust", exchange: "NASDAQ", marketType: "INTERNATIONAL", assetGroup: "ETF", currency: "USD", marketCap: 1500 },
  ]);
}

export async function getStockDataDetail(symbol: string): Promise<StockDataDetail> {
  return requestJson(`/api/stocks/${encodeURIComponent(symbol)}/data`);
}

export async function registerStockSymbol(request: {
  symbol: string;
  marketType?: "DOMESTIC" | "INTERNATIONAL";
  assetGroup?: "KOSPI" | "KOSDAQ" | "ETF" | "STOCK";
  period?: string;
  interval?: string;
}): Promise<StockRegistrationResult> {
  return postJson("/api/stocks/register", request);
}

export async function getDataStatus(): Promise<DataStatus> {
  return requestJson("/api/data/status");
}

export async function triggerDataUpdate(request?: {
  preset?: string;
  symbols?: string[];
  benchmarkSymbols?: string[];
  period?: string;
  interval?: string;
}): Promise<DataUpdateResult> {
  return postJsonAllowEmpty("/api/data/update", request);
}

export async function getJobs(): Promise<JobItem[]> {
  return requestJson("/api/jobs");
}

export type StrategyCandidateResult = {
  strategyId: number;
  candidates: Array<{ symbol: string; score: number }>;
  diagnostics: {
    totalSymbols: number;
    priceReadyCount: number;
    fundamentalsReadyCount: number;
    roePassCount: number;
    pbrPassCount: number;
    momentumPassCount: number;
    finalSelectedCount: number;
  };
  analysisJobId?: number | null;
  analysisStatus?: string | null;
  analysisMessage?: string | null;
};

export type StrategyDiagnosticsResult = StrategyCandidateResult;

export type BacktestQueueResponse = {
  accepted: boolean;
  jobId: number | null;
  status: string;
  message: string;
};

export type BacktestJobStatus = {
  jobId: number;
  status: string;
  message: string | null;
  backtestId: number | null;
  strategyId: number | null;
  snapshotId: number | null;
  startDate: string | null;
  endDate: string | null;
  universeScope?: BacktestUniverseScopePayload | null;
  rebalanceCount: number | null;
  averageSelectionCount: number | null;
  latestSelectionCount: number | null;
  progressPercent: number | null;
  stage: string | null;
  stageLabel: string | null;
  processedCount: number | null;
  totalCount: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string | null;
  patternCount?: number | null;
  patternNames?: string[];
};

export type BacktestSnapshot = {
  backtestId: number;
  snapshotId: number | null;
  snapshotName: string | null;
  startDate: string | null;
  endDate: string | null;
  cagr: number | null;
  sharpe: number | null;
  maxDrawdown: number | null;
  winRate: number | null;
  createdAt: string;
};

export type StrategySummary = {
  strategyId: number;
  name: string;
  description: string | null;
  roe: number | null;
  pbr: number | null;
  momentum: number | null;
  stockCount: number | null;
  rebalance: string | null;
  weightingMethod: string | null;
  factorWeightMode: string;
  factorWeights: Record<string, number>;
  universeScope?: BacktestUniverseScopePayload | null;
  status: string;
  createdAt: string;
  latestBacktest: BacktestSnapshot | null;
};

export type BacktestResult = {
  backtestId: number;
  cagr: number | null;
  sharpe: number | null;
  maxDrawdown: number | null;
  winRate: number | null;
  universeScope?: BacktestUniverseScopePayload | null;
  equityCurve: Array<{ date: string; value: number }>;
  drawdownCurve: Array<{ date: string; value: number }>;
  monthlyReturns: Array<{ date: string; value: number }>;
  stockBreakdown?: Array<{
    symbol: string;
    weight: number;
    returnPercent: number;
    contributionPercent: number;
    winRatePercent?: number | null;
    drawdownPercent?: number | null;
    signal?: string | null;
    entryDate?: string | null;
    exitDate?: string | null;
    holdingDays?: number | null;
    activePatterns?: string[] | null;
    note?: string | null;
  }>;
  patternBreakdown?: Array<{
    name: string;
    sampleSize: number;
    avgReturnPercent: number;
    sharpe?: number | null;
    maxDrawdownPercent?: number | null;
    winRatePercent?: number | null;
    avgHoldingDays?: number | null;
    turnoverPercent?: number | null;
    status?: string | null;
  }>;
  tradeLog?: Array<{
    date: string;
    symbol: string;
    action: string;
    patternId?: string | null;
    pattern?: string | null;
    signalDate?: string | null;
    signalPrice?: number | null;
    triggerPrice?: number | null;
    recommendedBuyPrice?: number | null;
    entryRangeLow?: number | null;
    entryRangeHigh?: number | null;
    entryDistancePercent?: number | null;
    entryAllowed?: boolean | null;
    stopPrice?: number | null;
    trailingStopPrice?: number | null;
    targetPrice1?: number | null;
    targetPrice2?: number | null;
    recommendedSellPrice?: number | null;
    expectedExitPrice?: number | null;
    expectedReturnPercent?: number | null;
    expectedReturnPercent2?: number | null;
    riskReward?: number | null;
    executionLabel?: string | null;
    signalReason?: string | null;
    exitReason?: string | null;
    currentState?: string | null;
    currentPrice?: number | null;
    openPosition?: boolean | null;
    entryDate?: string | null;
    entryPrice?: number | null;
    exitDate?: string | null;
    exitPrice?: number | null;
    note?: string | null;
    returnPercent?: number | null;
    holdingDays?: number | null;
    mfePercent?: number | null;
    maePercent?: number | null;
    detectionStartDate?: string | null;
    detectionEndDate?: string | null;
  }>;
  signalTimeline?: Array<{
    date: string;
    symbol: string;
    signal: string;
    patternId?: string | null;
    pattern?: string | null;
    signalPrice?: number | null;
    triggerPrice?: number | null;
    recommendedBuyPrice?: number | null;
    entryRangeLow?: number | null;
    entryRangeHigh?: number | null;
    entryDistancePercent?: number | null;
    entryAllowed?: boolean | null;
    stopPrice?: number | null;
    trailingStopPrice?: number | null;
    targetPrice1?: number | null;
    targetPrice2?: number | null;
    recommendedSellPrice?: number | null;
    expectedExitPrice?: number | null;
    expectedReturnPercent?: number | null;
    expectedReturnPercent2?: number | null;
    riskReward?: number | null;
    executionLabel?: string | null;
    signalReason?: string | null;
    exitReason?: string | null;
    currentState?: string | null;
    currentPrice?: number | null;
    openPosition?: boolean | null;
    entryDate?: string | null;
    entryPrice?: number | null;
    exitDate?: string | null;
    exitPrice?: number | null;
    status?: string | null;
    note?: string | null;
    returnPercent?: number | null;
    holdingDays?: number | null;
    mfePercent?: number | null;
    maePercent?: number | null;
    detectionStartDate?: string | null;
    detectionEndDate?: string | null;
  }>;
  researchConfig?: {
    patternDefinitions: Array<{
      id: string;
      name: string;
      shortLabel?: string | null;
      category: string;
      thesis?: string | null;
      ruleSummary?: string | null;
      lookbackDays: number;
      breakoutPercent: number;
      holdingDays: number;
      momentumThreshold: number;
      slopeThreshold: number;
      volumeSurgePercent?: number | null;
      sweepBufferPercent?: number | null;
      maxReentryBars?: number | null;
      wickRatioThreshold?: number | null;
      closeRecoveryPercent?: number | null;
      minGapPercent?: number | null;
      minFillPercent?: number | null;
      maxConfirmationBars?: number | null;
      stopLossPercent?: number | null;
      target1Percent?: number | null;
      target2Percent?: number | null;
      entryMode?: string | null;
      exitMode?: string | null;
      enabled: boolean;
      source: string;
    }>;
    signalPlan?: {
      buyMode: string;
      sellMode: string;
      holdMode: string;
      maxHoldingDays: number;
      stopLossPercent: number;
      takeProfitPercent: number;
      rebalanceGuard: string;
    } | null;
  } | null;
};

export type BacktestHistoryItem = {
  backtestId: number;
  strategyId: number;
  strategyName: string;
  snapshotId: number | null;
  snapshotName: string | null;
  universeScope?: BacktestUniverseScopePayload | null;
  startDate: string | null;
  endDate: string | null;
  cagr: number | null;
  sharpe: number | null;
  maxDrawdown: number | null;
  winRate: number | null;
  createdAt: string;
};

export type OptimizationTrial = {
  parameters: Record<string, number | string | null>;
  objectiveValue: number | null;
  metrics: Record<string, number | null>;
};

export type OptimizationResult = {
  strategyId: number;
  objective: string;
  bestParameters: Record<string, number | string | null>;
  trials: OptimizationTrial[];
};

export type ComparisonStrategy = {
  strategyId: number;
  equityCurve: Array<{ date: string; value: number }>;
  metrics: Record<string, number | null>;
  rank: Record<string, number>;
};

export type StrategyComparisonResult = {
  benchmarkSymbol: string;
  benchmarkCurve: Array<{ date: string; value: number }>;
  strategies: ComparisonStrategy[];
};

export type StrategyOptimizationHistoryItem = {
  id: number;
  strategyId: number;
  strategyName: string;
  parameterName: string;
  objective: string;
  benchmarkSymbol: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  bestParametersJson: string | null;
  resultJson: string | null;
};

export type StrategyComparisonHistoryItem = {
  id: number;
  benchmarkSymbol: string;
  strategyIdsJson: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  resultJson: string | null;
};

export type StrategyWeightSnapshot = {
  snapshotId: number;
  strategyId: number;
  name: string;
  factorWeightMode: string;
  factorWeights: Record<string, number>;
  createdAt: string;
};

export type OrderItem = {
  id: number;
  symbol: string;
  side: string;
  orderType: string;
  price: number | null;
  quantity: number;
  status: string;
  submittedAt: string | null;
};

export type StrategyRunItem = {
  id: number;
  strategyId: number;
  strategyName: string;
  portfolioId: number;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type NewsImpactStock = {
  symbol: string;
  newsScore: number;
  sentimentScore: number;
  newsCount: number;
};

export type NewsIntelligenceSummary = {
  selectedSymbol: string | null;
  scopeLabel: string;
  totalNewsCount: number;
  averageSentiment: number;
  detectedEventCount: number;
  heatmap: number[];
  sentimentSeries: number[];
  impactStocks: NewsImpactStock[];
};

export type NewsImpactNode = {
  id: number;
  title: string;
  summary?: string | null;
  translatedTitle?: string | null;
  translatedSummary?: string | null;
  sentiment: "positive" | "negative" | "neutral";
  impact: number;
  distance: number;
  color: "blue" | "red" | "gray";
  source: string;
  url: string;
  publishedAt: string;
};

export type NewsImpactLink = {
  source: string;
  target: string;
  distance: number;
};

export type NewsImpactGraph = {
  center: string;
  sentimentScore: number;
  generatedAt: string;
  nodes: NewsImpactNode[];
  links: NewsImpactLink[];
};

export type EventReaction = {
  eventType: string;
  averageReaction: number;
  recentCount: number;
};

export type EventAnalysisSummary = {
  selectedSymbol: string | null;
  scopeLabel: string;
  earningsBeat: number;
  maAnnouncement: number;
  ceoChange: number;
  regulation: number;
  priceReactionSeries: number[];
  reactions: EventReaction[];
};

export async function createStrategy(request: {
  name: string;
  roe: number;
  pbr: number;
  momentum: number;
  stockCount: number;
  rebalance: string;
  factorWeightMode: string;
  factorWeights: Array<{ factorName: string; factorWeight: number }>;
  universeScope?: BacktestUniverseScopePayload | null;
}): Promise<StrategyCandidateResult> {
  return postJson("/api/strategy", request);
}

export async function updateStrategy(
  strategyId: number,
  request: {
    name: string;
    roe: number;
    pbr: number;
    momentum: number;
    stockCount: number;
    rebalance: string;
    factorWeightMode: string;
    factorWeights: Array<{ factorName: string; factorWeight: number }>;
    universeScope?: BacktestUniverseScopePayload | null;
  },
): Promise<StrategyCandidateResult> {
  const response = await fetch(`${getApiBaseUrl()}/api/strategy/${strategyId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return parseEnvelope<StrategyCandidateResult>(response);
}

export async function deleteStrategy(strategyId: number): Promise<DeleteResult> {
  const response = await fetch(`${getApiBaseUrl()}/api/strategy/${strategyId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  return parseEnvelope<DeleteResult>(response);
}

export async function getStrategies(): Promise<StrategySummary[]> {
  return requestJson("/api/strategy", []);
}

export async function getStrategyDiagnostics(strategyId: number): Promise<StrategyDiagnosticsResult> {
  return requestJson(`/api/strategy/${strategyId}/diagnostics`);
}

export async function getStrategySnapshots(strategyId: number): Promise<StrategyWeightSnapshot[]> {
  return requestJson(`/api/strategy/${strategyId}/snapshots`, []);
}

export async function createStrategySnapshot(request: {
  strategyId: number;
  name: string;
  factorWeightMode: string;
  factorWeights: Array<{ factorName: string; factorWeight: number }>;
}): Promise<StrategyWeightSnapshot> {
  return postJson("/api/strategy/snapshot", request);
}

export async function runBacktest(request: {
  strategyId: number;
  startDate: string;
  endDate: string;
  snapshotId?: number | null;
  universeScope?: BacktestUniverseScopePayload | null;
  patternDefinitions?: Array<{
    id: string;
    name: string;
    shortLabel?: string | null;
    category: string;
    thesis?: string | null;
    ruleSummary?: string | null;
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
    entryMode: string;
    exitMode: string;
    enabled: boolean;
    source: string;
  }>;
  signalPlan?: {
    buyMode: string;
    sellMode: string;
    holdMode: string;
    maxHoldingDays: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    rebalanceGuard: string;
  } | null;
}): Promise<BacktestQueueResponse> {
  return postJson("/api/backtest", request);
}

export async function getBacktestJobStatus(jobId: number): Promise<BacktestJobStatus> {
  return requestJson(`/api/backtest/job/${jobId}`);
}

export async function getBacktestHistory(strategyId?: number): Promise<BacktestHistoryItem[]> {
  const suffix = strategyId ? `?strategyId=${strategyId}` : "";
  return requestJson(`/api/backtest/history${suffix}`, []);
}

export async function getBacktestDetail(backtestId: number): Promise<BacktestResult> {
  return requestJson(`/api/backtest/${backtestId}`);
}

export async function optimizeStrategy(request: {
  strategyId: number;
  parameter: string;
  start: number;
  end: number;
  step: number;
  objective: string;
  startDate?: string;
  endDate?: string;
  benchmarkSymbol?: string;
}): Promise<OptimizationResult> {
  return postJson("/api/strategy/optimize", request);
}

export async function getOptimizationHistory(): Promise<StrategyOptimizationHistoryItem[]> {
  return requestJson("/api/strategy/optimize/history");
}

export async function compareStrategies(request: {
  strategyIds: number[];
  startDate?: string;
  endDate?: string;
  benchmarkSymbol?: string;
}): Promise<StrategyComparisonResult> {
  return postJson("/api/strategy/compare", request);
}

export async function getComparisonHistory(): Promise<StrategyComparisonHistoryItem[]> {
  return requestJson("/api/strategy/compare/history");
}

export async function getRiskSummary() {
  return requestJson("/api/risk?portfolioId=1", {
    var: 124000000,
    beta: 0.81,
    volatility: 11.2,
    maxDrawdown: -7.4,
  });
}

export async function getOrders(): Promise<OrderItem[]> {
  return requestJson("/api/orders?portfolioId=1", [
    { id: 1, symbol: "005930", side: "BUY", orderType: "LIMIT", price: 64300, quantity: 10, status: "PENDING", submittedAt: "2026-03-08T09:31:00" },
  ]);
}

export async function createOrder(request: {
  portfolioId: number;
  symbol: string;
  side: string;
  orderType: string;
  price: number | null;
  quantity: number;
}): Promise<OrderItem> {
  return postJson("/api/order", request);
}

export async function cancelOrder(orderId: number): Promise<OrderItem> {
  return postJson(`/api/order/cancel?orderId=${orderId}`);
}

export async function getStrategyRuns(): Promise<StrategyRunItem[]> {
  return requestJson("/api/strategy/runs", []);
}

export async function startStrategy(request: { strategyId: number; portfolioId: number }): Promise<StrategyRunItem> {
  return postJson("/api/strategy/start", request);
}

export async function stopStrategy(strategyRunId: number): Promise<StrategyRunItem> {
  return postJson(`/api/strategy/stop?strategyRunId=${strategyRunId}`);
}

export async function getNewsIntelligence(symbol?: string): Promise<NewsIntelligenceSummary> {
  const params = new URLSearchParams();
  if (symbol?.trim()) {
    params.set("symbol", symbol.trim().toUpperCase());
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return requestJson(`/api/news-intelligence/summary${suffix}`);
}

export async function getEventAnalysis(symbol?: string): Promise<EventAnalysisSummary> {
  const params = new URLSearchParams();
  if (symbol?.trim()) {
    params.set("symbol", symbol.trim().toUpperCase());
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return requestJson(`/api/event-analysis/summary${suffix}`);
}

export async function getNewsImpactGraph(symbol: string): Promise<NewsImpactGraph> {
  return requestJson(`/api/news/impact/${symbol}`);
}

export async function getAlternativeDataSummary(): Promise<AlternativeDataSummary> {
  return requestJson("/api/alternative-data-center/summary");
}
