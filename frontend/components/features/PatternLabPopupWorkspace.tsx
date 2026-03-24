"use client";

import { PatternLabChart } from "@/components/features/PatternLabChart";
import { Icon } from "@/components/ui/Icon";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { SignalBadge } from "@/components/ui/SignalBadge";
import { formatPercent } from "@/lib/format";
import type { PatternLabStockCard, PatternLabViewMode } from "@/lib/pattern-lab";
import type { PatternLabDisplayOptions, PatternLabWindowMode, PatternLabWindowSyncMode } from "@/lib/pattern-lab-window";
import type { QuantPattern } from "@/lib/quant-workbench";

function formatPrice(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(value);
}

function safePercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }
  return formatPercent(value);
}

function signalTone(signal: string): "buy" | "sell" | "hold" | "neutral" {
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

const DISPLAY_LABELS: Record<keyof PatternLabDisplayOptions, string> = {
  showMovingAverage: "이동평균",
  showVolume: "거래량",
  showSignalZones: "신호 구간",
  showHoldingRanges: "HOLD 구간",
  showPriceLevels: "가격선",
  showPatternLegend: "패턴 범례",
};

function WindowHeader({
  mode,
  syncMode,
  displayOptions,
  enabledPatterns,
  onToggleSync,
  onToggleDisplayOption,
  onTogglePattern,
  viewMode,
  onSetViewMode,
  onClose,
}: {
  mode: PatternLabWindowMode;
  syncMode: PatternLabWindowSyncMode;
  displayOptions: PatternLabDisplayOptions;
  enabledPatterns: QuantPattern[];
  onToggleSync?: () => void;
  onToggleDisplayOption: (key: keyof PatternLabDisplayOptions) => void;
  onTogglePattern: (patternId: string) => void;
  viewMode: PatternLabViewMode;
  onSetViewMode: (value: PatternLabViewMode) => void;
  onClose?: () => void;
}) {
  const title = mode === "multi" ? "멀티 차트 분석 창" : mode === "detached" ? "패턴 분리 창" : "패턴 분석 팝업";
  const description = mode === "multi"
    ? "선택 종목 여러 개를 동시에 비교하는 멀티 모니터 분석용 차트입니다."
    : "현재 종목의 패턴별 신호, 추천 가격, 최근 거래 결과를 독립 창에서 검토합니다.";

  return (
    <div className="rounded-md border border-[color:rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,#ffffff,#f5f8ff)] px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Icon name="window" className="h-4 w-4 text-[color:var(--kpi)]" />
            <p className="text-[16px] font-semibold text-[color:var(--fg)]">{title}</p>
          </div>
          <p className="mt-1 text-[12px] text-[color:var(--fg-muted)]">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mode !== "multi" ? (
            <SecondaryButton label={viewMode === "grid" ? "포커스 보기" : "멀티 보기"} icon={viewMode === "grid" ? "arrowRight" : "comparison"} onClick={() => onSetViewMode(viewMode === "grid" ? "focus" : "grid")} />
          ) : null}
          {onToggleSync ? (
            <SecondaryButton label={syncMode === "sync" ? "동기화 중" : "독립 모드"} icon={syncMode === "sync" ? "link" : "window"} onClick={onToggleSync} />
          ) : null}
          {onClose ? <SecondaryButton label="닫기" icon="close" onClick={onClose} /> : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {enabledPatterns.map((pattern) => (
          <button
            key={pattern.id}
            type="button"
            onClick={() => onTogglePattern(pattern.id)}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${pattern.enabled ? "border-black bg-black text-white" : "border-[color:var(--line)] bg-white text-[color:var(--fg-muted)]"}`}
          >
            {pattern.shortLabel}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(displayOptions) as Array<keyof PatternLabDisplayOptions>).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onToggleDisplayOption(key)}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${displayOptions[key] ? "border-[color:var(--kpi)] bg-[rgba(21,94,239,0.08)] text-[color:var(--kpi)]" : "border-[color:var(--line)] bg-white text-[color:var(--fg-muted)]"}`}
          >
            {DISPLAY_LABELS[key]}
          </button>
        ))}
      </div>
    </div>
  );
}

function StockAnalysisCard({
  stock,
  compact = false,
  displayOptions,
  onFocus,
}: {
  stock: PatternLabStockCard;
  compact?: boolean;
  displayOptions: PatternLabDisplayOptions;
  onFocus?: () => void;
}) {
  const latestTrade = stock.trades[0] ?? null;

  return (
    <div className="rounded-md border border-[color:var(--line)] bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[15px] font-semibold text-[color:var(--fg)]">{stock.summary.name}</p>
          <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{stock.summary.symbol} · {stock.summary.market} · {stock.summary.sector}</p>
          <p className="mt-2 text-[11px] text-[color:var(--fg-muted)]">현재가 {formatPrice(stock.summary.currentPrice)} · 최근 신호 {stock.summary.recentSignalDate ?? "-"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SignalBadge label={stock.summary.currentState} tone={signalTone(stock.summary.currentState)} />
          <span className="rounded-full border border-[color:var(--line)] px-2 py-1 text-[10px] font-semibold text-[color:var(--fg-muted)]">패턴 {stock.summary.selectedPatternCount}</span>
          {onFocus ? <PrimaryButton label="포커스" icon="arrowRight" onClick={onFocus} /> : null}
        </div>
      </div>

      <div className="mt-3">
        <PatternLabChart
          title={`${stock.summary.name} 분석 차트`}
          subtitle={`${stock.summary.recentPatternSignal} · BUY/SELL/HOLD 구간 + 권장 가격`}
          candles={stock.candles}
          markers={stock.markers}
          holdingRanges={stock.holdingRanges}
          zones={stock.zones}
          priceLevels={stock.priceLevels}
          compact={compact}
          showMovingAverage={displayOptions.showMovingAverage}
          showVolume={displayOptions.showVolume}
          showSignalZones={displayOptions.showSignalZones}
          showHoldingRanges={displayOptions.showHoldingRanges}
          showPriceLevels={displayOptions.showPriceLevels}
          showPatternLegend={displayOptions.showPatternLegend}
        />
      </div>

      <div className="mt-3 grid gap-2 text-[11px] text-[color:var(--fg-muted)] md:grid-cols-3">
        <div className="rounded-md border border-[color:var(--line)] px-3 py-2">
          <p>최근 신호 {stock.summary.currentState} · {stock.summary.recentPatternSignal}</p>
          <p className="mt-1">권장 매수가 {stock.summary.currentRecommendation ? `${formatPrice(stock.summary.currentRecommendation.entryRangeLow)} ~ ${formatPrice(stock.summary.currentRecommendation.entryRangeHigh)}` : "-"}</p>
          <p className="mt-1">권장 매도가 {stock.summary.currentRecommendation ? formatPrice(stock.summary.currentRecommendation.recommendedSellPrice) : "-"}</p>
        </div>
        <div className="rounded-md border border-[color:var(--line)] px-3 py-2">
          <p>손절가 {stock.summary.currentRecommendation ? formatPrice(stock.summary.currentRecommendation.stopPrice) : "-"}</p>
          <p className="mt-1">1차 / 2차 목표가 {stock.summary.currentRecommendation ? `${formatPrice(stock.summary.currentRecommendation.targetPrice1)} / ${formatPrice(stock.summary.currentRecommendation.targetPrice2)}` : "-"}</p>
          <p className="mt-1">누적 수익률 {safePercent(stock.summary.cumulativeReturnPercent)}</p>
        </div>
        <div className="rounded-md border border-[color:var(--line)] px-3 py-2">
          <p>최근 거래 결과 {latestTrade?.returnPercent == null ? "-" : safePercent(latestTrade.returnPercent)}</p>
          <p className="mt-1">보유 {latestTrade?.holdingDays ? `${latestTrade.holdingDays}일` : "-"}</p>
          <p className="mt-1">승률 {safePercent(stock.summary.winRate)} · MDD {safePercent(stock.summary.maxDrawdown)}</p>
        </div>
      </div>
    </div>
  );
}

export function PatternLabPopupWorkspace({
  mode,
  syncMode,
  viewMode,
  focusedCard,
  stocks,
  displayOptions,
  enabledPatterns,
  onToggleSync,
  onToggleDisplayOption,
  onTogglePattern,
  onFocusSymbol,
  onSetViewMode,
  onClose,
}: {
  mode: PatternLabWindowMode;
  syncMode: PatternLabWindowSyncMode;
  viewMode: PatternLabViewMode;
  focusedCard: PatternLabStockCard | null;
  stocks: PatternLabStockCard[];
  displayOptions: PatternLabDisplayOptions;
  enabledPatterns: QuantPattern[];
  onToggleSync?: () => void;
  onToggleDisplayOption: (key: keyof PatternLabDisplayOptions) => void;
  onTogglePattern: (patternId: string) => void;
  onFocusSymbol: (symbol: string) => void;
  onSetViewMode: (value: PatternLabViewMode) => void;
  onClose?: () => void;
}) {
  return (
    <div className="space-y-4">
      <WindowHeader
        mode={mode}
        syncMode={syncMode}
        displayOptions={displayOptions}
        enabledPatterns={enabledPatterns}
        onToggleSync={onToggleSync}
        onToggleDisplayOption={onToggleDisplayOption}
        onTogglePattern={onTogglePattern}
        viewMode={viewMode}
        onSetViewMode={onSetViewMode}
        onClose={onClose}
      />

      {viewMode === "grid" || mode === "multi" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {stocks.map((stock) => (
            <StockAnalysisCard
              key={stock.summary.symbol}
              stock={stock}
              compact
              displayOptions={displayOptions}
              onFocus={mode === "multi" ? undefined : () => {
                onFocusSymbol(stock.summary.symbol);
                onSetViewMode("focus");
              }}
            />
          ))}
        </div>
      ) : focusedCard ? (
        <StockAnalysisCard stock={focusedCard} displayOptions={displayOptions} />
      ) : (
        <div className="rounded-md border border-dashed border-[color:var(--line)] bg-white px-4 py-8 text-center text-[12px] text-[color:var(--fg-muted)]">
          표시할 포커스 종목이 없습니다.
        </div>
      )}
    </div>
  );
}
