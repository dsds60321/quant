"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MarketCandlestickChart } from "@/components/features/MarketCandlestickChart";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { DataTable } from "@/components/ui/DataTable";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { SignalBadge } from "@/components/ui/SignalBadge";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { getStockDataDetail, type BacktestResult, type StockDataDetail } from "@/lib/api";
import { summarizeBacktestUniverseScope, type BacktestUniverseScopePayload } from "@/lib/backtest-universe";
import { formatPercent } from "@/lib/format";
import type { BacktestStockView } from "@/lib/quant-workbench";

function formatPrice(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(value);
}

function getSignalTone(signal: string): "buy" | "sell" | "hold" | "neutral" {
  if (signal === "BUY") {
    return "buy";
  }
  if (signal === "SELL") {
    return "sell";
  }
  if (signal === "HOLD") {
    return "hold";
  }
  return "neutral";
}

function calculateDistanceToHigh(detail?: StockDataDetail) {
  if (!detail?.priceSeries?.length || detail.latestPrice == null || detail.latestPrice <= 0) {
    return null;
  }
  const prices = detail.priceSeries.slice(-252).map((point) => point.adjClose ?? point.close ?? 0).filter((value) => value > 0);
  if (prices.length === 0) {
    return null;
  }
  const high = Math.max(...prices);
  return ((detail.latestPrice / high) - 1) * 100;
}

function calculateMomentum(detail?: StockDataDetail) {
  if (!detail?.priceSeries?.length) {
    return null;
  }
  const closes = detail.priceSeries.map((point) => point.adjClose ?? point.close ?? 0).filter((value) => value > 0);
  if (closes.length < 64) {
    return null;
  }
  const current = closes[closes.length - 1] ?? 0;
  const base = closes[Math.max(0, closes.length - 64)] ?? 0;
  if (current <= 0 || base <= 0) {
    return null;
  }
  return ((current / base) - 1) * 100;
}

function calculateLiquidity(detail?: StockDataDetail) {
  if (!detail?.priceSeries?.length) {
    return "데이터 없음";
  }
  const averageVolume = detail.priceSeries.slice(-20).reduce((sum, point) => sum + (point.volume || 0), 0) / Math.max(detail.priceSeries.slice(-20).length, 1);
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

function normalizeMarketRegion(exchange?: string | null) {
  const value = exchange?.toUpperCase() ?? "";
  if (value.includes("KOSPI") || value.includes("KOSDAQ") || value.includes("KRX") || value.includes("KOREA")) {
    return "한국";
  }
  if (value.includes("NASDAQ") || value.includes("NYSE") || value.includes("AMEX") || value.includes("USA") || value.includes("US")) {
    return "미국";
  }
  return "전체";
}

export function BacktestSelectionWorkbench({
  strategyId,
  backtestId,
  snapshotId,
  backtestStartDate,
  backtestEndDate,
  universeScope,
  stocks,
  candidateScores,
  signalTimeline,
}: {
  strategyId: number | null;
  backtestId: number | null;
  snapshotId: number | null;
  backtestStartDate: string | null;
  backtestEndDate: string | null;
  universeScope?: BacktestUniverseScopePayload | null;
  stocks: BacktestStockView[];
  candidateScores: Record<string, number>;
  signalTimeline?: BacktestResult["signalTimeline"];
}) {
  const router = useRouter();
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [previewSymbol, setPreviewSymbol] = useState<string | null>(stocks[0]?.symbol ?? null);
  const [detailsBySymbol, setDetailsBySymbol] = useState<Record<string, StockDataDetail>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSelectedSymbols(stocks.slice(0, Math.min(6, stocks.length)).map((stock) => stock.symbol));
      setPreviewSymbol(stocks[0]?.symbol ?? null);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [stocks]);

  useEffect(() => {
    if (stocks.length === 0) {
      return;
    }
    const missing = stocks.map((stock) => stock.symbol).filter((symbol) => detailsBySymbol[symbol] == null);
    if (missing.length === 0) {
      return;
    }

    let cancelled = false;
    void Promise.all(
      missing.map(async (symbol) => {
        try {
          const detail = await getStockDataDetail(symbol);
          return [symbol, detail] as const;
        } catch {
          return null;
        }
      }),
    ).then((entries) => {
      if (cancelled) {
        return;
      }
      const resolved = entries.filter((entry): entry is readonly [string, StockDataDetail] => entry != null);
      if (resolved.length > 0) {
        setDetailsBySymbol((current) => ({ ...current, ...Object.fromEntries(resolved) }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [detailsBySymbol, stocks]);

  const previewDetail = previewSymbol ? detailsBySymbol[previewSymbol] ?? null : null;
  const previewStock = useMemo(() => stocks.find((stock) => stock.symbol === previewSymbol) ?? null, [previewSymbol, stocks]);
  const universeSummary = useMemo(() => summarizeBacktestUniverseScope(universeScope), [universeScope]);
  const inclusionCountBySymbol = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of signalTimeline ?? []) {
      counts.set(item.symbol, (counts.get(item.symbol) ?? 0) + 1);
    }
    return counts;
  }, [signalTimeline]);

  function toggleSymbol(symbol: string) {
    setSelectedSymbols((current) => (current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol]));
  }

  function toggleAllSymbols() {
    setSelectedSymbols((current) => {
      const allSelected = stocks.length > 0 && stocks.every((stock) => current.includes(stock.symbol));
      return allSelected ? [] : stocks.map((stock) => stock.symbol);
    });
  }

  function clearSelection() {
    setSelectedSymbols([]);
  }

  function compareSelectedSymbols() {
    if (selectedSymbols.length === 0) {
      setActionError("비교할 종목을 먼저 1개 이상 선택하세요.");
      return;
    }
    setActionError(null);
    setPreviewSymbol(selectedSymbols[0] ?? null);
    window.setTimeout(() => {
      document.getElementById("backtest-preview-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function moveToPatternLab(symbols: string[]) {
    if (!strategyId || !backtestId || symbols.length === 0) {
      setActionError("백테스트 결과 ID가 아직 연결되지 않았습니다. 최근 백테스트 이력에서 결과를 먼저 불러온 뒤 다시 시도하세요.");
      return;
    }
    setActionError(null);
    const selectedMarkets = Array.from(new Set(symbols.map((symbol) => normalizeMarketRegion(detailsBySymbol[symbol]?.exchange)).filter((market) => market !== "전체")));
    const market = selectedMarkets.length === 1 ? selectedMarkets[0] : selectedMarkets[0] ?? "전체";
    const params = new URLSearchParams({
      strategyId: String(strategyId),
      backtestId: String(backtestId),
      symbols: symbols.join(","),
    });
    if (snapshotId) {
      params.set("snapshotId", String(snapshotId));
    }
    if (backtestStartDate) {
      params.set("startDate", backtestStartDate);
    }
    if (backtestEndDate) {
      params.set("endDate", backtestEndDate);
    }
    if (market) {
      params.set("market", market);
    }
    params.set("universeLabel", universeSummary.shortLabel);
    params.set("universeMode", universeSummary.modeLabel);
    if (universeSummary.isRestricted) {
      params.set("universeRestricted", "1");
    }
    window.location.assign(`/pattern-lab?${params.toString()}`);
  }

  function renderUniverseBadges(symbol: string, detail?: StockDataDetail) {
    const badges = [
      universeSummary.shortLabel,
      detail?.sector ?? null,
    ].filter(Boolean) as string[];

    if (universeScope?.mode === "SPECIFIC_STOCKS" && universeScope.selectedStocks.some((item) => item.symbol === symbol)) {
      badges.push("직접 선택");
    }
    if (universeScope?.mode === "THEME" && universeScope.selectedThemes.length > 0) {
      badges.push(universeScope.selectedThemes.join(" + "));
    }
    if (universeScope?.mode === "PORTFOLIO" && universeScope.portfolioName) {
      badges.push(universeScope.portfolioName);
    }

    return (
      <div className="flex flex-wrap gap-1">
        {badges.map((badge) => (
          <span key={`${symbol}-${badge}`} className="rounded-full border border-[color:var(--line)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--fg-muted)]">
            {badge}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardCard
        title="선정 종목 분석 및 선택"
        subtitle="전략이 실제로 어떤 종목을 선별했는지 검증하고, 실험 대상으로 보낼 종목을 선택합니다."
        action={
          <>
            <PrimaryButton label="선택 종목 패턴 실험실로 이동" onClick={() => moveToPatternLab(selectedSymbols)} disabled={selectedSymbols.length === 0 || !strategyId || !backtestId} icon="research" />
            <SecondaryButton label={stocks.length > 0 && stocks.every((stock) => selectedSymbols.includes(stock.symbol)) ? "전체 해제" : "전체 선택"} onClick={toggleAllSymbols} disabled={stocks.length === 0} />
          </>
        }
      >
        {actionError ? <StatusNotice title="패턴 실험실 이동 불가" description={actionError} /> : null}
        <div className="sticky top-20 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-md border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-3">
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[color:var(--fg)]">선택 종목 {selectedSymbols.length}개</span>
          <span className="rounded-full border border-[color:var(--line)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[color:var(--fg-muted)]">{universeSummary.shortLabel}</span>
          <PrimaryButton label="선택 종목 패턴 실험실로 이동" onClick={() => moveToPatternLab(selectedSymbols)} disabled={selectedSymbols.length === 0 || !strategyId || !backtestId} icon="research" />
          <SecondaryButton label="선택 종목 비교" onClick={compareSelectedSymbols} disabled={selectedSymbols.length === 0} />
          <SecondaryButton label="전체 선택" onClick={toggleAllSymbols} disabled={stocks.length === 0} />
          <SecondaryButton label="선택 해제" onClick={clearSelection} disabled={selectedSymbols.length === 0} />
        </div>
        {selectedSymbols.length === 0 ? (
          <p className="mb-3 text-[12px] text-[color:var(--fg-muted)]">패턴 실험을 위해 종목을 1개 이상 선택하세요</p>
        ) : null}
        {stocks.length > 0 ? (
          <DataTable
            title="선정 종목 리스트"
            columns={["선택", "종목코드", "종목명 / 시장", "유니버스 출처", "분류 배지", "최종 점수", "최근 신호", "누적 수익률", "기여 수익률", "52주 신고가 대비", "모멘텀 점수", "거래량 / 유동성", "액션"]}
            rows={stocks.map((stock) => {
              const detail = detailsBySymbol[stock.symbol];
              const distanceToHigh = calculateDistanceToHigh(detail);
              const momentumScore = calculateMomentum(detail);
              const liquidity = calculateLiquidity(detail);
              return [
                <input key={`${stock.symbol}-selected`} type="checkbox" checked={selectedSymbols.includes(stock.symbol)} onChange={() => toggleSymbol(stock.symbol)} />,
                stock.symbol,
                <div key={`${stock.symbol}-meta`} className="space-y-1">
                  <p className="font-semibold text-[color:var(--fg)]">{detail?.name ?? stock.symbol}</p>
                  <p className="text-[11px] text-[color:var(--fg-muted)]">{detail?.exchange ?? "-"} · {detail?.sector ?? "-"}</p>
                </div>,
                universeSummary.modeLabel,
                renderUniverseBadges(stock.symbol, detail),
                (candidateScores[stock.symbol] ?? stock.returnPercent).toFixed(2),
                <SignalBadge key={`${stock.symbol}-signal`} label={stock.signal} tone={getSignalTone(stock.signal)} />,
                formatPercent(stock.returnPercent),
                formatPercent(stock.contributionPercent),
                distanceToHigh == null ? "-" : formatPercent(distanceToHigh),
                momentumScore == null ? "-" : formatPercent(momentumScore),
                <div key={`${stock.symbol}-liquidity`} className="space-y-1">
                  <p>{detail?.priceSeries?.[detail.priceSeries.length - 1]?.volume?.toLocaleString("ko-KR") ?? "-"}</p>
                  <p className="text-[11px] text-[color:var(--fg-muted)]">{liquidity}</p>
                </div>,
                <div key={`${stock.symbol}-actions`} className="flex gap-2">
                  <button type="button" onClick={() => setPreviewSymbol(stock.symbol)} className="text-[11px] font-semibold text-[color:var(--kpi)]">미리보기</button>
                  <button type="button" onClick={() => moveToPatternLab([stock.symbol])} className="text-[11px] font-semibold text-[color:var(--buy)]">이 종목 실험</button>
                  <button type="button" onClick={() => router.push(`/stock-analysis?symbol=${encodeURIComponent(stock.symbol)}`)} className="text-[11px] font-semibold text-[color:var(--fg)]">상세 분석</button>
                </div>,
              ];
            })}
            pageSize={8}
          />
        ) : (
          <StatusNotice title="선정 종목이 없습니다." description="백테스트에서 종목별 성과가 생성되면 여기서 선택 후 패턴 테스트로 보낼 수 있습니다." />
        )}
      </DashboardCard>

      <DashboardCard title="실험 전 빠른 점검" subtitle="패턴 실험실로 보내기 전 최근 가격 흐름과 선별 성과를 빠르게 확인합니다.">
        {previewDetail ? (
          <div id="backtest-preview-panel" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                <p className="text-[11px] text-[color:var(--fg-muted)]">미리보기 종목</p>
                <p className="mt-2 text-[18px] font-semibold text-[color:var(--fg)]">{previewDetail.name}</p>
                <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{previewDetail.symbol} · {previewDetail.exchange}</p>
              </div>
              <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                <p className="text-[11px] text-[color:var(--fg-muted)]">현재가</p>
                <p className="mt-2 text-[18px] font-semibold text-[color:var(--fg)]">{formatPrice(previewDetail.latestPrice)}</p>
                <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">최근 일자 {previewDetail.latestPriceDate ?? "-"}</p>
              </div>
              <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                <p className="text-[11px] text-[color:var(--fg-muted)]">백테스트 누적 수익률 / 최근 신호</p>
                <p className="mt-2 text-[18px] font-semibold text-[color:var(--fg)]">{previewStock ? formatPercent(previewStock.returnPercent) : "-"}</p>
                <div className="mt-1">{previewStock ? <SignalBadge label={previewStock.signal} tone={getSignalTone(previewStock.signal)} /> : null}</div>
              </div>
              <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                <p className="text-[11px] text-[color:var(--fg-muted)]">52주 신고가 대비 / 모멘텀</p>
                <p className="mt-2 text-[18px] font-semibold text-[color:var(--kpi)]">{calculateDistanceToHigh(previewDetail) == null ? "-" : formatPercent(calculateDistanceToHigh(previewDetail) ?? 0)}</p>
                <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">모멘텀 {calculateMomentum(previewDetail) == null ? "-" : formatPercent(calculateMomentum(previewDetail) ?? 0)}</p>
              </div>
              <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                <p className="text-[11px] text-[color:var(--fg-muted)]">실험 액션</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <PrimaryButton label="이 종목 실험" onClick={() => moveToPatternLab([previewDetail.symbol])} disabled={!strategyId || !backtestId} icon="research" />
                  <SecondaryButton label="선택 종목 전체 실험" onClick={() => moveToPatternLab(selectedSymbols)} disabled={selectedSymbols.length === 0 || !strategyId || !backtestId} />
                </div>
              </div>
            </div>
            <MarketCandlestickChart candles={previewDetail.priceSeries.slice(-120).map((point) => ({
              date: point.date,
              open: point.open ?? point.adjClose ?? point.close ?? 0,
              high: point.high ?? point.adjClose ?? point.close ?? 0,
              low: point.low ?? point.adjClose ?? point.close ?? 0,
              close: point.adjClose ?? point.close ?? 0,
              volume: point.volume ?? 0,
            }))} ranges={["최근 120일"]} />
            <p className="text-[11px] text-[color:var(--fg-muted)]">
              패턴 실험실에서 이 종목의 상세 BUY/SELL/HOLD 신호와 추천 가격을 확인할 수 있습니다. 편입 횟수 {inclusionCountBySymbol.get(previewDetail.symbol) ?? 0}회 기준으로 선별에 참여했습니다.
            </p>
          </div>
        ) : (
          <StatusNotice title="차트 미리보기를 선택하세요." description="선정 종목 리스트에서 특정 종목의 차트 미리보기를 누르면 이 영역에서 가격 흐름을 확인할 수 있습니다." />
        )}
      </DashboardCard>
    </div>
  );
}
