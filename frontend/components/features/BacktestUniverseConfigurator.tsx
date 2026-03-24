"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { StatusNotice } from "@/components/ui/StatusNotice";
import {
  getMarketSectors,
  getPortfolioDetail,
  listPortfolios,
  searchStocks,
  type MarketSector,
  type PortfolioDetail,
  type PortfolioListItem,
  type StockLookupItem,
} from "@/lib/api";
import {
  BACKTEST_UNIVERSE_ASSET_OPTIONS,
  BACKTEST_INTEREST_STOCK_PRESETS,
  BACKTEST_THEME_OPTIONS,
  BACKTEST_UNIVERSE_MARKET_OPTIONS,
  BACKTEST_UNIVERSE_MODE_OPTIONS,
  BACKTEST_WATCHLIST_OPTIONS,
  mergeUniverseStocks,
  parseTickerList,
  summarizeBacktestUniverseScope,
  type BacktestUniversePortfolioSource,
  type BacktestUniverseScopePayload,
  type BacktestUniverseStock,
} from "@/lib/backtest-universe";

function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(parsed));
}

function modeButtonClass(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
    active
      ? "border-[color:var(--kpi)] bg-[rgba(21,94,239,0.08)] text-[color:var(--kpi)]"
      : "border-[color:var(--line)] bg-white text-[color:var(--fg-muted)]"
  }`;
}

function scopeToggleClass(active: boolean) {
  return `rounded-md border px-3 py-2 text-left transition ${
    active
      ? "border-[color:var(--fg)] bg-[color:var(--surface-muted)] text-[color:var(--fg)]"
      : "border-[color:var(--line)] bg-white text-[color:var(--fg-muted)]"
  }`;
}

function toUniverseStock(item: StockLookupItem): BacktestUniverseStock {
  return {
    symbol: item.symbol,
    name: item.name,
    exchange: item.exchange,
    marketType: item.marketType,
    assetGroup: item.assetGroup,
  };
}

export function BacktestUniverseConfigurator({
  value,
  onChange,
  validationError,
}: {
  value: BacktestUniverseScopePayload;
  onChange: (next: BacktestUniverseScopePayload) => void;
  validationError?: string | null;
}) {
  const [stockQuery, setStockQuery] = useState("");
  const [bulkTickers, setBulkTickers] = useState("");
  const [stockSuggestions, setStockSuggestions] = useState<StockLookupItem[]>([]);
  const [recentSelections, setRecentSelections] = useState<BacktestUniverseStock[]>([]);
  const [stockSearchBusy, setStockSearchBusy] = useState(false);
  const [sectorOptions, setSectorOptions] = useState<MarketSector[]>([]);
  const [portfolioOptions, setPortfolioOptions] = useState<PortfolioListItem[]>([]);
  const [selectedPortfolioDetail, setSelectedPortfolioDetail] = useState<PortfolioDetail | null>(null);
  const [themeQuery, setThemeQuery] = useState("");
  const bulkInputRef = useRef<HTMLTextAreaElement | null>(null);

  const summary = useMemo(() => summarizeBacktestUniverseScope(value), [value]);
  const filteredThemeOptions = useMemo(() => {
    const normalized = themeQuery.trim().toLowerCase();
    if (!normalized) {
      return BACKTEST_THEME_OPTIONS;
    }
    return BACKTEST_THEME_OPTIONS.filter((option) => {
      return option.label.toLowerCase().includes(normalized) || option.description.toLowerCase().includes(normalized);
    });
  }, [themeQuery]);

  useEffect(() => {
    let cancelled = false;
    void getMarketSectors()
      .then((items) => {
        if (!cancelled) {
          setSectorOptions(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSectorOptions([]);
        }
      });
    void listPortfolios()
      .then((items) => {
        if (!cancelled) {
          setPortfolioOptions(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPortfolioOptions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (value.mode !== "SPECIFIC_STOCKS") {
      return;
    }
    if (value.estimatedStockCount === value.selectedStocks.length) {
      return;
    }
    onChange({
      ...value,
      estimatedStockCount: value.selectedStocks.length,
    });
  }, [onChange, value]);

  useEffect(() => {
    if (value.mode !== "SECTOR") {
      return;
    }
    const nextCount = value.selectedSectors.reduce((sum, sector) => {
      const found = sectorOptions.find((item) => item.sector === sector);
      return sum + (found?.stockCount ?? 0);
    }, 0);
    if (value.estimatedStockCount === nextCount) {
      return;
    }
    onChange({
      ...value,
      estimatedStockCount: nextCount,
    });
  }, [onChange, sectorOptions, value]);

  useEffect(() => {
    if (value.mode !== "THEME") {
      return;
    }
    const nextCount = value.selectedThemes.reduce((sum, theme) => {
      const found = BACKTEST_THEME_OPTIONS.find((item) => item.label === theme);
      return sum + (found?.stockCount ?? 0);
    }, 0);
    if (value.estimatedStockCount === nextCount) {
      return;
    }
    onChange({
      ...value,
      estimatedStockCount: nextCount,
    });
  }, [onChange, value]);

  useEffect(() => {
    if (value.mode !== "PORTFOLIO") {
      return;
    }
    if (value.portfolioSource === "WATCHLIST") {
      const selected = BACKTEST_WATCHLIST_OPTIONS.find((item) => item.key === value.portfolioKey) ?? null;
      const nextScope = {
        ...value,
        portfolioName: selected?.name ?? null,
        estimatedStockCount: selected?.stockCount ?? null,
        lastUpdatedAt: selected?.lastUpdatedAt ?? null,
      };
      if (
        nextScope.portfolioName !== value.portfolioName ||
        nextScope.estimatedStockCount !== value.estimatedStockCount ||
        nextScope.lastUpdatedAt !== value.lastUpdatedAt
      ) {
        onChange(nextScope);
      }
      return;
    }

    const nextName = selectedPortfolioDetail
      ? value.portfolioSource === "CURRENT_HOLDINGS"
        ? `${selectedPortfolioDetail.name} 현재 보유`
        : selectedPortfolioDetail.name
      : value.portfolioName;
    const nextCount = selectedPortfolioDetail?.positions.length ?? value.estimatedStockCount;
    const nextUpdatedAt = value.lastUpdatedAt ?? new Date().toISOString().slice(0, 10);
    if (nextName !== value.portfolioName || nextCount !== value.estimatedStockCount || nextUpdatedAt !== value.lastUpdatedAt) {
      onChange({
        ...value,
        portfolioName: nextName,
        estimatedStockCount: nextCount,
        lastUpdatedAt: nextUpdatedAt,
      });
    }
  }, [onChange, selectedPortfolioDetail, value]);

  useEffect(() => {
    if (!stockQuery.trim() || value.mode !== "SPECIFIC_STOCKS" || value.overrideMode !== "ONE_TIME_OVERRIDE") {
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setStockSearchBusy(true);
      void searchStocks({ query: stockQuery.trim(), limit: 8 })
        .then((items) => {
          if (!cancelled) {
            setStockSuggestions(items);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setStockSuggestions([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setStockSearchBusy(false);
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [stockQuery, value.mode, value.overrideMode]);

  useEffect(() => {
    if (value.mode !== "PORTFOLIO" || value.portfolioSource === "WATCHLIST" || !value.portfolioId) {
      return;
    }
    let cancelled = false;
    void getPortfolioDetail(value.portfolioId)
      .then((detail) => {
        if (!cancelled) {
          setSelectedPortfolioDetail(detail);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedPortfolioDetail(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [value.mode, value.portfolioId, value.portfolioSource]);

  function updateScope(next: Partial<BacktestUniverseScopePayload>) {
    onChange({ ...value, ...next });
  }

  function addStocks(items: BacktestUniverseStock[]) {
    const merged = mergeUniverseStocks(value.selectedStocks, items);
    updateScope({
      selectedStocks: merged,
      estimatedStockCount: merged.length,
    });
    setRecentSelections((current) => mergeUniverseStocks(items, current).slice(0, 8));
  }

  function removeStock(symbol: string) {
    const filtered = value.selectedStocks.filter((item) => item.symbol !== symbol);
    updateScope({
      selectedStocks: filtered,
      estimatedStockCount: filtered.length,
    });
  }

  function toggleSector(sector: string) {
    const exists = value.selectedSectors.includes(sector);
    const nextSectors = exists ? value.selectedSectors.filter((item) => item !== sector) : [...value.selectedSectors, sector];
    const nextCount = nextSectors.reduce((sum, item) => {
      const found = sectorOptions.find((option) => option.sector === item);
      return sum + (found?.stockCount ?? 0);
    }, 0);
    updateScope({
      selectedSectors: nextSectors,
      estimatedStockCount: nextCount,
    });
  }

  function toggleTheme(theme: string) {
    const exists = value.selectedThemes.includes(theme);
    const nextThemes = exists ? value.selectedThemes.filter((item) => item !== theme) : [...value.selectedThemes, theme];
    const nextCount = nextThemes.reduce((sum, item) => {
      const found = BACKTEST_THEME_OPTIONS.find((option) => option.label === item);
      return sum + (found?.stockCount ?? 0);
    }, 0);
    updateScope({
      selectedThemes: nextThemes,
      estimatedStockCount: nextCount,
    });
  }

  function handleBulkTickerAdd() {
    const parsed = parseTickerList(bulkTickers);
    if (parsed.length === 0) {
      return;
    }
    addStocks(parsed.map((symbol) => ({ symbol, name: symbol })));
    setBulkTickers("");
  }

  function handleSelectPortfolioSource(source: BacktestUniversePortfolioSource) {
    setSelectedPortfolioDetail(null);
    if (source === "WATCHLIST") {
      const defaultWatchlist = BACKTEST_WATCHLIST_OPTIONS[0] ?? null;
      updateScope({
        portfolioSource: source,
        portfolioKey: defaultWatchlist?.key ?? null,
        portfolioId: null,
        portfolioName: defaultWatchlist?.name ?? null,
        estimatedStockCount: defaultWatchlist?.stockCount ?? null,
        lastUpdatedAt: defaultWatchlist?.lastUpdatedAt ?? null,
      });
      return;
    }
    const defaultPortfolio = portfolioOptions[0] ?? null;
    updateScope({
      portfolioSource: source,
      portfolioKey: null,
      portfolioId: defaultPortfolio?.portfolioId ?? null,
      portfolioName: defaultPortfolio ? (source === "CURRENT_HOLDINGS" ? `${defaultPortfolio.name} 현재 보유` : defaultPortfolio.name) : null,
      estimatedStockCount: defaultPortfolio?.positionCount ?? null,
      lastUpdatedAt: new Date().toISOString().slice(0, 10),
    });
  }

  function renderSpecificStocksPanel() {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-2">
            <label className="block space-y-2 text-[12px] font-semibold text-[color:var(--fg)]">
              <span>종목 검색</span>
              <input
                value={stockQuery}
                onChange={(event) => setStockQuery(event.target.value)}
                placeholder="티커 또는 회사명을 검색하세요. 예: NVDA, NVIDIA"
                className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium"
              />
            </label>
            <div className="rounded-md border border-[color:var(--line)] bg-white">
              <div className="flex flex-wrap gap-2 border-b border-[color:var(--line)] px-3 py-2 text-[11px]">
                <button type="button" onClick={() => addStocks(recentSelections.slice(0, 5))} className={modeButtonClass(false)} disabled={recentSelections.length === 0}>최근 검색</button>
                <button type="button" onClick={() => addStocks(BACKTEST_INTEREST_STOCK_PRESETS)} className={modeButtonClass(false)}>관심종목</button>
                <button type="button" onClick={() => bulkInputRef.current?.focus()} className={modeButtonClass(false)}>직접 입력</button>
              </div>
              <div className="max-h-56 overflow-y-auto px-3 py-2">
                {stockSearchBusy ? (
                  <p className="py-3 text-[12px] text-[color:var(--fg-muted)]">종목 후보를 검색하는 중입니다.</p>
                ) : stockQuery.trim() && stockSuggestions.length > 0 ? (
                  <div className="space-y-2">
                    {stockSuggestions.map((item) => (
                      <button
                        key={`${item.symbol}-${item.exchange}`}
                        type="button"
                        onClick={() => {
                          addStocks([toUniverseStock(item)]);
                          setStockQuery("");
                          setStockSuggestions([]);
                        }}
                        className="flex w-full items-center justify-between rounded-md border border-[color:var(--line)] px-3 py-2 text-left hover:bg-[color:var(--surface-muted)]"
                      >
                        <div>
                          <p className="text-[12px] font-semibold text-[color:var(--fg)]">{item.symbol} · {item.name}</p>
                          <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{item.exchange} · {item.currency}</p>
                        </div>
                        <span className="text-[11px] font-semibold text-[color:var(--kpi)]">추가</span>
                      </button>
                    ))}
                  </div>
                ) : stockQuery.trim() ? (
                  <p className="py-3 text-[12px] text-[color:var(--fg-muted)]">검색 결과가 없으면 아래 직접 입력에 티커를 붙여넣어 추가할 수 있습니다.</p>
                ) : (
                  <p className="py-3 text-[12px] text-[color:var(--fg-muted)]">티커 또는 회사명을 검색해 종목을 추가하거나 관심종목/직접 입력을 사용하세요.</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block space-y-2 text-[12px] font-semibold text-[color:var(--fg)]">
              <span>종목 직접 입력</span>
              <textarea
                ref={bulkInputRef}
                value={bulkTickers}
                onChange={(event) => setBulkTickers(event.target.value)}
                placeholder={"NVDA, NVDL, SOXL, AVGO\n콤마 또는 줄바꿈으로 여러 종목을 추가하세요."}
                className="min-h-32 w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <SecondaryButton label="붙여넣은 종목 추가" icon="plus" onClick={handleBulkTickerAdd} disabled={parseTickerList(bulkTickers).length === 0} />
              <SecondaryButton label="전체 제거" icon="close" onClick={() => updateScope({ selectedStocks: [], estimatedStockCount: 0 })} disabled={value.selectedStocks.length === 0} />
            </div>
          </div>
        </div>

        <div className="rounded-md border border-[color:var(--line)] bg-white px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-[color:var(--fg)]">선택 종목</p>
            <span className="rounded-full border border-[color:var(--line)] px-2 py-1 text-[11px] font-semibold text-[color:var(--fg-muted)]">
              선택 종목 {value.selectedStocks.length}개
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {value.selectedStocks.length > 0 ? value.selectedStocks.map((stock) => (
              <span key={stock.symbol} className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-1 text-[11px] font-semibold text-[color:var(--fg)]">
                {stock.symbol}
                <button type="button" onClick={() => removeStock(stock.symbol)} className="text-[color:var(--fg-muted)]">x</button>
              </span>
            )) : <p className="text-[12px] text-[color:var(--fg-muted)]">아직 선택된 종목이 없습니다.</p>}
          </div>
        </div>
      </div>
    );
  }

  function renderSectorPanel() {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <SecondaryButton label="전체 선택" onClick={() => updateScope({ selectedSectors: sectorOptions.map((item) => item.sector), estimatedStockCount: sectorOptions.reduce((sum, item) => sum + item.stockCount, 0) })} disabled={sectorOptions.length === 0} />
          <SecondaryButton label="전부 해제" onClick={() => updateScope({ selectedSectors: [], estimatedStockCount: 0 })} disabled={value.selectedSectors.length === 0} />
          <SecondaryButton label="선택 초기화" onClick={() => updateScope({ selectedSectors: [], estimatedStockCount: 0 })} disabled={value.selectedSectors.length === 0} />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sectorOptions.map((sector) => {
            const active = value.selectedSectors.includes(sector.sector);
            return (
              <button
                key={sector.sector}
                type="button"
                onClick={() => toggleSector(sector.sector)}
                className={`rounded-md border px-4 py-3 text-left transition ${
                  active ? "border-[color:var(--kpi)] bg-[rgba(21,94,239,0.08)]" : "border-[color:var(--line)] bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold text-[color:var(--fg)]">{sector.sector}</p>
                  <span className="text-[11px] font-semibold text-[color:var(--fg-muted)]">{sector.stockCount.toLocaleString("ko-KR")}개</span>
                </div>
                <p className="mt-2 text-[11px] text-[color:var(--fg-muted)]">선택 시 해당 섹터 내부에서만 전략 후보를 선별합니다.</p>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full border border-[color:var(--line)] px-2 py-1">선택 섹터 {value.selectedSectors.length}개</span>
          <span className="rounded-full border border-[color:var(--line)] px-2 py-1">후보 종목 수 {value.estimatedStockCount?.toLocaleString("ko-KR") ?? 0}개</span>
          {value.selectedSectors.map((sector) => (
            <span key={sector} className="rounded-full border border-[color:var(--line)] bg-white px-2 py-1">{sector}</span>
          ))}
        </div>
      </div>
    );
  }

  function renderThemePanel() {
    return (
      <div className="space-y-3">
        <label className="block space-y-2 text-[12px] font-semibold text-[color:var(--fg)]">
          <span>테마 검색</span>
          <input
            value={themeQuery}
            onChange={(event) => setThemeQuery(event.target.value)}
            placeholder="AI, 반도체, 2차전지, 방산, 생활소비재"
            className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium"
          />
        </label>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredThemeOptions.map((theme) => {
            const active = value.selectedThemes.includes(theme.label);
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => toggleTheme(theme.label)}
                className={`rounded-md border px-4 py-3 text-left transition ${
                  active ? "border-[color:var(--kpi)] bg-[rgba(21,94,239,0.08)]" : "border-[color:var(--line)] bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold text-[color:var(--fg)]">{theme.label}</p>
                  <span className="text-[11px] font-semibold text-[color:var(--fg-muted)]">{theme.stockCount.toLocaleString("ko-KR")}개</span>
                </div>
                <p className="mt-2 text-[11px] text-[color:var(--fg-muted)]">{theme.description}</p>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full border border-[color:var(--line)] px-2 py-1">선택 테마 {value.selectedThemes.length}개</span>
          <span className="rounded-full border border-[color:var(--line)] px-2 py-1">후보 종목 수 {value.estimatedStockCount?.toLocaleString("ko-KR") ?? 0}개</span>
          {value.selectedThemes.map((theme) => (
            <span key={theme} className="rounded-full border border-[color:var(--line)] bg-white px-2 py-1">{theme}</span>
          ))}
        </div>
      </div>
    );
  }

  function renderPortfolioPanel() {
    const watchlistItems = BACKTEST_WATCHLIST_OPTIONS;
    const activeSummary = value.portfolioSource === "WATCHLIST"
      ? watchlistItems.find((item) => item.key === value.portfolioKey) ?? null
      : selectedPortfolioDetail
        ? {
            key: String(selectedPortfolioDetail.portfolioId),
            name: value.portfolioSource === "CURRENT_HOLDINGS" ? `${selectedPortfolioDetail.name} 현재 보유` : selectedPortfolioDetail.name,
            stockCount: selectedPortfolioDetail.positions.length,
            lastUpdatedAt: value.lastUpdatedAt ?? new Date().toISOString().slice(0, 10),
          }
        : null;

    return (
      <div className="space-y-3">
        <div className="grid gap-3 xl:grid-cols-[0.8fr_1fr_0.8fr]">
          <label className="space-y-2 text-[12px] font-semibold text-[color:var(--fg)]">
            <span>포트폴리오 소스</span>
            <select
              value={value.portfolioSource}
              onChange={(event) => handleSelectPortfolioSource(event.target.value as BacktestUniversePortfolioSource)}
              className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium"
            >
              <option value="SAVED_PORTFOLIO">저장 포트폴리오</option>
              <option value="CURRENT_HOLDINGS">현재 보유</option>
              <option value="WATCHLIST">관심종목</option>
            </select>
          </label>

          {value.portfolioSource === "WATCHLIST" ? (
            <label className="space-y-2 text-[12px] font-semibold text-[color:var(--fg)]">
              <span>선택 포트폴리오</span>
              <select
                value={value.portfolioKey ?? ""}
                onChange={(event) => {
                  const selected = watchlistItems.find((item) => item.key === event.target.value) ?? null;
                  updateScope({
                    portfolioKey: selected?.key ?? null,
                    portfolioId: null,
                    portfolioName: selected?.name ?? null,
                    estimatedStockCount: selected?.stockCount ?? null,
                    lastUpdatedAt: selected?.lastUpdatedAt ?? null,
                  });
                }}
                className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium"
              >
                {watchlistItems.map((item) => (
                  <option key={item.key} value={item.key}>{item.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="space-y-2 text-[12px] font-semibold text-[color:var(--fg)]">
              <span>선택 포트폴리오</span>
              <select
                value={value.portfolioId ?? ""}
                onChange={(event) => {
                  const nextId = event.target.value ? Number(event.target.value) : null;
                  const selected = portfolioOptions.find((item) => item.portfolioId === nextId) ?? null;
                  setSelectedPortfolioDetail(null);
                  updateScope({
                    portfolioId: nextId,
                    portfolioKey: null,
                    portfolioName: selected ? (value.portfolioSource === "CURRENT_HOLDINGS" ? `${selected.name} 현재 보유` : selected.name) : null,
                    estimatedStockCount: selected?.positionCount ?? null,
                    lastUpdatedAt: new Date().toISOString().slice(0, 10),
                  });
                }}
                className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium"
              >
                {portfolioOptions.map((item) => (
                  <option key={item.portfolioId} value={item.portfolioId}>{item.name}</option>
                ))}
              </select>
            </label>
          )}

          <div className="space-y-2">
            <span className="block text-[12px] font-semibold text-[color:var(--fg)]">포트폴리오 상세</span>
            <div className="flex flex-wrap gap-2">
              <SecondaryButton
                label="포지션 보기"
                icon="arrowRight"
                onClick={() => {
                  if (value.portfolioId) {
                    window.location.assign(`/portfolio/positions?portfolioId=${value.portfolioId}`);
                  }
                }}
                disabled={!value.portfolioId || value.portfolioSource === "WATCHLIST"}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-[color:var(--line)] bg-white px-3 py-3">
            <p className="text-[11px] text-[color:var(--fg-muted)]">포트폴리오명</p>
            <p className="mt-2 text-[15px] font-semibold text-[color:var(--fg)]">{activeSummary?.name ?? value.portfolioName ?? "-"}</p>
          </div>
          <div className="rounded-md border border-[color:var(--line)] bg-white px-3 py-3">
            <p className="text-[11px] text-[color:var(--fg-muted)]">종목 수</p>
            <p className="mt-2 text-[15px] font-semibold text-[color:var(--fg)]">{activeSummary?.stockCount?.toLocaleString("ko-KR") ?? value.estimatedStockCount?.toLocaleString("ko-KR") ?? "-"}</p>
          </div>
          <div className="rounded-md border border-[color:var(--line)] bg-white px-3 py-3">
            <p className="text-[11px] text-[color:var(--fg-muted)]">마지막 업데이트</p>
            <p className="mt-2 text-[15px] font-semibold text-[color:var(--fg)]">{formatDateLabel(activeSummary?.lastUpdatedAt ?? value.lastUpdatedAt)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-4 py-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[13px] font-semibold text-[color:var(--fg)]">백테스트 대상 범위</p>
          <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">Backtest = Strategy x Universe Scope x Date Range x Weight Snapshot</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => updateScope({ overrideMode: "STRATEGY_DEFAULT" })} className={scopeToggleClass(value.overrideMode === "STRATEGY_DEFAULT")}>
            <p className="text-[12px] font-semibold">전략 기본 유니버스 사용</p>
            <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">저장된 전략의 기본 시장 및 유니버스 조건을 그대로 사용합니다.</p>
          </button>
          <button type="button" onClick={() => updateScope({ overrideMode: "ONE_TIME_OVERRIDE" })} className={scopeToggleClass(value.overrideMode === "ONE_TIME_OVERRIDE")}>
            <p className="text-[12px] font-semibold">이번 실행만 재지정</p>
            <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">특정 종목, 섹터, 테마, 포트폴리오로 범위를 제한해 단건 백테스트를 실행합니다.</p>
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-1 font-semibold text-[color:var(--fg)]">현재 백테스트 대상 {summary.shortLabel}</span>
        <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-1">{summary.isRestricted ? "유니버스 제한 적용 중" : "전략 기본 범위"}</span>
        <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-1">후보 종목 수 {summary.estimatedStockCountLabel}</span>
        {summary.selectedStockCount ? <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-1">선택 종목 {summary.selectedStockCount}개</span> : null}
        {summary.selectedSectorCount ? <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-1">선택 섹터 {summary.selectedSectorCount}개</span> : null}
        {summary.selectedThemeCount ? <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-1">선택 테마 {summary.selectedThemeCount}개</span> : null}
        {summary.portfolioName ? <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-1">선택 포트폴리오 {summary.portfolioName}</span> : null}
      </div>

      {value.overrideMode === "ONE_TIME_OVERRIDE" ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {BACKTEST_UNIVERSE_MODE_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => updateScope({
                  mode: item.value,
                  estimatedStockCount: item.value === "FULL_MARKET" ? null : value.estimatedStockCount,
                })}
                className={modeButtonClass(value.mode === item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-md border border-[color:var(--line)] bg-white px-4 py-4">
            {value.mode === "FULL_MARKET" ? (
              <div className="space-y-3">
                <div>
                  <p className="text-[12px] font-semibold text-[color:var(--fg)]">시장 범위</p>
                  <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {BACKTEST_UNIVERSE_MARKET_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateScope({ marketScope: option.value, estimatedStockCount: null })}
                        className={`rounded-md border px-4 py-3 text-left transition ${
                          value.marketScope === option.value ? "border-[color:var(--kpi)] bg-[rgba(21,94,239,0.08)]" : "border-[color:var(--line)] bg-white"
                        }`}
                      >
                        <p className="text-[13px] font-semibold text-[color:var(--fg)]">{option.label}</p>
                        <p className="mt-2 text-[11px] text-[color:var(--fg-muted)]">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-[color:var(--fg)]">자산군</p>
                  <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {BACKTEST_UNIVERSE_ASSET_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateScope({ assetScope: option.value, estimatedStockCount: null })}
                        className={`rounded-md border px-4 py-3 text-left transition ${
                          value.assetScope === option.value ? "border-[color:var(--buy)] bg-[rgba(16,185,129,0.08)]" : "border-[color:var(--line)] bg-white"
                        }`}
                      >
                        <p className="text-[13px] font-semibold text-[color:var(--fg)]">{option.label}</p>
                        <p className="mt-2 text-[11px] text-[color:var(--fg-muted)]">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            {value.mode === "SPECIFIC_STOCKS" ? renderSpecificStocksPanel() : null}
            {value.mode === "SECTOR" ? renderSectorPanel() : null}
            {value.mode === "THEME" ? renderThemePanel() : null}
            {value.mode === "PORTFOLIO" ? renderPortfolioPanel() : null}
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-md border border-[color:var(--line)] bg-white px-4 py-3">
          <p className="text-[12px] font-semibold text-[color:var(--fg)]">전략 기본 유니버스 사용 중</p>
          <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">
            현재는 저장된 전략의 기본 유니버스로 백테스트합니다. 특정 섹터, 테마, 종목, 포트폴리오만 테스트하려면 이번 실행만 재지정을 선택하세요.
          </p>
        </div>
      )}

      {validationError ? <div className="mt-4"><StatusNotice title="유니버스 설정 확인 필요" description={validationError} tone="warning" /></div> : null}
    </div>
  );
}
