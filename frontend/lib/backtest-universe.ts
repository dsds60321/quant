export type BacktestUniverseOverrideMode = "STRATEGY_DEFAULT" | "ONE_TIME_OVERRIDE";

export type BacktestUniverseMode = "FULL_MARKET" | "SPECIFIC_STOCKS" | "SECTOR" | "THEME" | "PORTFOLIO";

export type BacktestUniverseMarketScope = "STRATEGY_DEFAULT" | "US" | "KOREA" | "GLOBAL";
export type BacktestUniverseAssetScope = "STRATEGY_DEFAULT" | "STOCK" | "ETF" | "ALL";

export type BacktestUniversePortfolioSource = "SAVED_PORTFOLIO" | "CURRENT_HOLDINGS" | "WATCHLIST";

export type BacktestUniverseStock = {
  symbol: string;
  name: string;
  exchange?: string | null;
  marketType?: "DOMESTIC" | "INTERNATIONAL";
  assetGroup?: string | null;
};

export type BacktestUniverseScopePayload = {
  overrideMode: BacktestUniverseOverrideMode;
  mode: BacktestUniverseMode;
  marketScope: BacktestUniverseMarketScope;
  assetScope: BacktestUniverseAssetScope;
  selectedStocks: BacktestUniverseStock[];
  selectedSectors: string[];
  selectedThemes: string[];
  portfolioSource: BacktestUniversePortfolioSource;
  portfolioKey: string | null;
  portfolioId: number | null;
  portfolioName: string | null;
  estimatedStockCount: number | null;
  lastUpdatedAt: string | null;
};

export type BacktestUniverseThemeOption = {
  id: string;
  label: string;
  description: string;
  stockCount: number;
};

export type BacktestUniversePresetOption = {
  key: string;
  name: string;
  stockCount: number;
  lastUpdatedAt: string | null;
  source: BacktestUniversePortfolioSource;
};

export type BacktestUniverseSummary = {
  title: string;
  shortLabel: string;
  modeLabel: string;
  description: string;
  isRestricted: boolean;
  selectedStockCount: number | null;
  selectedSectorCount: number | null;
  selectedThemeCount: number | null;
  estimatedStockCount: number | null;
  estimatedStockCountLabel: string;
  portfolioName: string | null;
};

export const BACKTEST_UNIVERSE_MODE_OPTIONS: Array<{ value: BacktestUniverseMode; label: string }> = [
  { value: "FULL_MARKET", label: "전체 시장" },
  { value: "SPECIFIC_STOCKS", label: "특정 종목" },
  { value: "SECTOR", label: "섹터" },
  { value: "THEME", label: "테마" },
  { value: "PORTFOLIO", label: "포트폴리오" },
];

export const BACKTEST_UNIVERSE_MARKET_OPTIONS: Array<{ value: BacktestUniverseMarketScope; label: string; description: string }> = [
  { value: "STRATEGY_DEFAULT", label: "전략 기본 시장", description: "저장된 전략의 기본 시장 유니버스를 그대로 사용합니다." },
  { value: "US", label: "미국 전체", description: "NASDAQ / NYSE / NYSE Arca 범위를 사용합니다." },
  { value: "KOREA", label: "한국 전체", description: "KOSPI / KOSDAQ 범위를 사용합니다." },
  { value: "GLOBAL", label: "전체 시장", description: "미국과 한국 등록 심볼 전체 범위를 사용합니다." },
];

export const BACKTEST_UNIVERSE_ASSET_OPTIONS: Array<{ value: BacktestUniverseAssetScope; label: string; description: string }> = [
  { value: "STRATEGY_DEFAULT", label: "전략 기본 자산군", description: "저장된 전략의 기본 자산군을 그대로 사용합니다." },
  { value: "STOCK", label: "주식", description: "공통주 중심 유니버스로 제한합니다." },
  { value: "ETF", label: "ETF", description: "시장별 ETF 유니버스로 제한합니다." },
  { value: "ALL", label: "주식 + ETF", description: "주식과 ETF를 함께 포함합니다." },
];

export const BACKTEST_THEME_OPTIONS: BacktestUniverseThemeOption[] = [
  { id: "ai", label: "AI", description: "생성형 AI, 데이터센터, 인프라 수혜 종목군", stockCount: 42 },
  { id: "semiconductor", label: "반도체", description: "GPU, 메모리, 장비, 파운드리 중심", stockCount: 58 },
  { id: "secondary-battery", label: "2차전지", description: "셀, 소재, 장비, 리사이클링 포함", stockCount: 31 },
  { id: "defense", label: "방산", description: "국방, 항공우주, 방위 시스템", stockCount: 18 },
  { id: "ev", label: "EV", description: "전기차 완성차, 부품, 충전 인프라", stockCount: 27 },
  { id: "biotech", label: "바이오", description: "신약, 진단, 바이오 플랫폼", stockCount: 34 },
  { id: "consumer-lifestyle", label: "생활소비재", description: "브랜드 소비재, 리테일, 라이프스타일", stockCount: 25 },
];

export const BACKTEST_WATCHLIST_OPTIONS: BacktestUniversePresetOption[] = [
  { key: "watchlist-semiconductor", name: "반도체 레버리지", stockCount: 6, lastUpdatedAt: "2026-03-09", source: "WATCHLIST" },
  { key: "watchlist-ai-core", name: "AI 코어", stockCount: 8, lastUpdatedAt: "2026-03-08", source: "WATCHLIST" },
  { key: "watchlist-defense", name: "방산 추적", stockCount: 5, lastUpdatedAt: "2026-03-07", source: "WATCHLIST" },
];

export const BACKTEST_INTEREST_STOCK_PRESETS: BacktestUniverseStock[] = [
  { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", marketType: "INTERNATIONAL", assetGroup: "STOCK" },
  { symbol: "NVDL", name: "GraniteShares 2x Long NVDA Daily ETF", exchange: "NASDAQ", marketType: "INTERNATIONAL", assetGroup: "ETF" },
  { symbol: "SOXL", name: "Direxion Daily Semiconductor Bull 3X", exchange: "NYSE ARCA", marketType: "INTERNATIONAL", assetGroup: "ETF" },
  { symbol: "AVGO", name: "Broadcom Inc.", exchange: "NASDAQ", marketType: "INTERNATIONAL", assetGroup: "STOCK" },
  { symbol: "TSM", name: "Taiwan Semiconductor", exchange: "NYSE", marketType: "INTERNATIONAL", assetGroup: "STOCK" },
];

export function createDefaultBacktestUniverseScope(): BacktestUniverseScopePayload {
  return {
    overrideMode: "STRATEGY_DEFAULT",
    mode: "FULL_MARKET",
    marketScope: "STRATEGY_DEFAULT",
    assetScope: "STRATEGY_DEFAULT",
    selectedStocks: [],
    selectedSectors: [],
    selectedThemes: [],
    portfolioSource: "SAVED_PORTFOLIO",
    portfolioKey: null,
    portfolioId: null,
    portfolioName: null,
    estimatedStockCount: null,
    lastUpdatedAt: null,
  };
}

export function isUniverseRestrictionActive(scope: BacktestUniverseScopePayload | null | undefined) {
  if (!scope || scope.overrideMode !== "ONE_TIME_OVERRIDE") {
    return false;
  }
  if (scope.mode === "FULL_MARKET") {
    return scope.marketScope !== "STRATEGY_DEFAULT" || scope.assetScope !== "STRATEGY_DEFAULT";
  }
  return true;
}

export function parseTickerList(text: string) {
  return Array.from(
    new Set(
      text
        .split(/[\s,\n\r\t;]+/)
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

export function mergeUniverseStocks(existing: BacktestUniverseStock[], additions: BacktestUniverseStock[]) {
  const bySymbol = new Map(existing.map((item) => [item.symbol, item]));
  for (const stock of additions) {
    bySymbol.set(stock.symbol, stock);
  }
  return Array.from(bySymbol.values());
}

function normalizeAssetScope(scope: BacktestUniverseAssetScope | null | undefined) {
  return scope ?? "STRATEGY_DEFAULT";
}

function resolveAssetScopeLabel(scope: BacktestUniverseAssetScope | null | undefined) {
  const normalized = normalizeAssetScope(scope);
  if (normalized === "ETF") {
    return "ETF";
  }
  if (normalized === "ALL") {
    return "주식 + ETF";
  }
  if (normalized === "STOCK") {
    return "주식";
  }
  return "전략 기본 자산군";
}

function resolveFullMarketTitle(marketScope: BacktestUniverseMarketScope, assetScope: BacktestUniverseAssetScope) {
  const assetLabel = resolveAssetScopeLabel(assetScope);
  if (marketScope === "US") {
    return {
      title: `미국 ${assetLabel} 백테스트`,
      shortLabel: `미국 ${assetLabel}`,
      description: `미국 시장의 ${assetLabel} 범위에서 전략 규칙을 재적용합니다.`,
      estimatedLabel: `미국 ${assetLabel} 기준`,
    };
  }
  if (marketScope === "KOREA") {
    return {
      title: `한국 ${assetLabel} 백테스트`,
      shortLabel: `한국 ${assetLabel}`,
      description: `한국 시장의 ${assetLabel} 범위에서 전략 규칙을 재적용합니다.`,
      estimatedLabel: `한국 ${assetLabel} 기준`,
    };
  }
  if (marketScope === "GLOBAL") {
    return {
      title: `전체 시장 ${assetLabel} 백테스트`,
      shortLabel: `전체 시장 ${assetLabel}`,
      description: `미국과 한국 등록 심볼 중 ${assetLabel} 범위에서 전략 규칙을 재적용합니다.`,
      estimatedLabel: `전체 시장 ${assetLabel} 기준`,
    };
  }
  return {
    title: "전략 기본 유니버스 기준 백테스트",
    shortLabel: "전략 기본 유니버스",
    description: `전략 기본 시장 범위를 유지한 채 이번 실행만 ${assetLabel} 옵션을 열어둡니다.`,
    estimatedLabel: "전략 기본 유니버스 기준",
  };
}

export function summarizeBacktestUniverseScope(scope: BacktestUniverseScopePayload | null | undefined): BacktestUniverseSummary {
  const safeScope = scope ?? createDefaultBacktestUniverseScope();
  const restricted = isUniverseRestrictionActive(safeScope);
  const selectedStockCount = safeScope.selectedStocks.length || null;
  const selectedSectorCount = safeScope.selectedSectors.length || null;
  const selectedThemeCount = safeScope.selectedThemes.length || null;
  const estimatedStockCount = safeScope.estimatedStockCount;
  const estimatedStockCountLabel = estimatedStockCount == null ? "전략 진단 기준" : `${estimatedStockCount.toLocaleString("ko-KR")}개`;

  if (safeScope.overrideMode !== "ONE_TIME_OVERRIDE") {
    return {
      title: "전체 시장 대상 백테스트",
      shortLabel: "전략 기본 유니버스",
      modeLabel: "전략 기본 유니버스 사용",
      description: "저장된 전략의 기본 유니버스를 그대로 사용합니다.",
      isRestricted: false,
      selectedStockCount,
      selectedSectorCount,
      selectedThemeCount,
      estimatedStockCount: null,
      estimatedStockCountLabel: "전략 기본 유니버스 기준",
      portfolioName: safeScope.portfolioName,
    };
  }

  if (safeScope.mode === "FULL_MARKET") {
    const fullMarketTitle = resolveFullMarketTitle(safeScope.marketScope, safeScope.assetScope);
    return {
      title: fullMarketTitle.title,
      shortLabel: fullMarketTitle.shortLabel,
      modeLabel: "전체 시장",
      description: fullMarketTitle.description,
      isRestricted: restricted,
      selectedStockCount,
      selectedSectorCount,
      selectedThemeCount,
      estimatedStockCount,
      estimatedStockCountLabel: estimatedStockCount == null ? fullMarketTitle.estimatedLabel : estimatedStockCountLabel,
      portfolioName: safeScope.portfolioName,
    };
  }

  if (safeScope.mode === "SPECIFIC_STOCKS") {
    const label = safeScope.selectedStocks.slice(0, 4).map((stock) => stock.symbol).join(", ");
    return {
      title: `사용자 지정 ${safeScope.selectedStocks.length}종목 백테스트`,
      shortLabel: `직접 선택 ${safeScope.selectedStocks.length}종목`,
      modeLabel: "특정 종목",
      description: label ? `${label}${safeScope.selectedStocks.length > 4 ? " 외" : ""} 범위 안에서만 전략을 실행합니다.` : "선택된 종목 범위 안에서만 전략을 실행합니다.",
      isRestricted: restricted,
      selectedStockCount,
      selectedSectorCount,
      selectedThemeCount,
      estimatedStockCount: safeScope.selectedStocks.length,
      estimatedStockCountLabel: `${safeScope.selectedStocks.length.toLocaleString("ko-KR")}개`,
      portfolioName: safeScope.portfolioName,
    };
  }

  if (safeScope.mode === "SECTOR") {
    const sectorLabel = safeScope.selectedSectors.join(" + ");
    return {
      title: `${sectorLabel || "선택 섹터"} 제한 백테스트`,
      shortLabel: sectorLabel || "섹터 제한",
      modeLabel: "섹터별",
      description: "선택한 섹터 내부에서만 전략의 팩터 랭킹과 선별이 진행됩니다.",
      isRestricted: restricted,
      selectedStockCount,
      selectedSectorCount,
      selectedThemeCount,
      estimatedStockCount,
      estimatedStockCountLabel,
      portfolioName: safeScope.portfolioName,
    };
  }

  if (safeScope.mode === "THEME") {
    const themeLabel = safeScope.selectedThemes.join(" + ");
    return {
      title: `${themeLabel || "선택 테마"} 제한 백테스트`,
      shortLabel: themeLabel || "테마 제한",
      modeLabel: "테마별",
      description: "선택한 테마에 속한 종목 집합 내부에서만 전략을 재적용합니다.",
      isRestricted: restricted,
      selectedStockCount,
      selectedSectorCount,
      selectedThemeCount,
      estimatedStockCount,
      estimatedStockCountLabel,
      portfolioName: safeScope.portfolioName,
    };
  }

  return {
    title: safeScope.portfolioName ? `포트폴리오 "${safeScope.portfolioName}" 기반 백테스트` : "포트폴리오 기준 백테스트",
    shortLabel: safeScope.portfolioName ?? "포트폴리오 제한",
    modeLabel: "포트폴리오별",
    description: "선택한 포트폴리오, 현재 보유, 또는 관심 목록 종목 안에서만 전략을 실행합니다.",
    isRestricted: restricted,
    selectedStockCount,
    selectedSectorCount,
    selectedThemeCount,
    estimatedStockCount,
    estimatedStockCountLabel,
    portfolioName: safeScope.portfolioName,
  };
}

export function validateBacktestUniverseScope(scope: BacktestUniverseScopePayload | null | undefined) {
  if (!scope || scope.overrideMode !== "ONE_TIME_OVERRIDE") {
    return null;
  }
  if (scope.mode === "SPECIFIC_STOCKS" && scope.selectedStocks.length === 0) {
    return "특정 종목 범위를 사용하려면 1개 이상 종목을 선택해 주세요.";
  }
  if (scope.mode === "SECTOR" && scope.selectedSectors.length === 0) {
    return "섹터별 범위를 사용하려면 1개 이상 섹터를 선택해 주세요.";
  }
  if (scope.mode === "THEME" && scope.selectedThemes.length === 0) {
    return "테마별 범위를 사용하려면 1개 이상 테마를 선택해 주세요.";
  }
  if (scope.mode === "PORTFOLIO" && !scope.portfolioKey && !scope.portfolioId && !scope.portfolioName) {
    return "포트폴리오별 범위를 사용하려면 백테스트 대상 포트폴리오를 선택해 주세요.";
  }
  if (scope.mode === "PORTFOLIO" && scope.estimatedStockCount === 0) {
    return "선택한 포트폴리오에 종목이 없습니다. 다른 포트폴리오나 소스를 선택해 주세요.";
  }
  return null;
}

export function getUniverseTableBadge(scope: BacktestUniverseScopePayload | null | undefined) {
  const summary = summarizeBacktestUniverseScope(scope);
  return summary.shortLabel;
}
