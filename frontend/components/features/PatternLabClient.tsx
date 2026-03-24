"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PatternLabChart } from "@/components/features/PatternLabChart";
import { PatternLabPopupWorkspace } from "@/components/features/PatternLabPopupWorkspace";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { DataTable } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/ui/MetricCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { Icon } from "@/components/ui/Icon";
import { SignalBadge } from "@/components/ui/SignalBadge";
import { StatusNotice } from "@/components/ui/StatusNotice";
import {
  getBacktestDetail,
  getBacktestHistory,
  runBacktest,
  getStockDataDetail,
  getStrategyDiagnostics,
  getStrategySnapshots,
  type BacktestHistoryItem,
  type BacktestResult,
  type StockDataDetail,
  type StrategyDiagnosticsResult,
  type StrategySummary,
  type StrategyWeightSnapshot,
} from "@/lib/api";
import { summarizeBacktestUniverseScope } from "@/lib/backtest-universe";
import { formatPercent } from "@/lib/format";
import {
  buildPatternLabResult,
  type PatternExecutionModel,
  type PatternLabHoldingRange,
  type PatternLabPricePlan,
  type PatternLabRecommendationRow,
  type PatternLabResult,
  type PatternLabSignalRow,
  type PatternLabSignalType,
  type PatternLabSignalZone,
  type PatternLabStockCard,
  type PatternLabTradeRow,
  type PatternLabViewMode,
  type PatternLabChartMarker,
  type PatternLabPriceLevel,
} from "@/lib/pattern-lab";
import {
  PATTERN_LAB_WINDOW_SYNC_CHANNEL,
  buildPatternLabWindowTitle,
  clonePatternLabDisplayOptions,
  createPatternLabWindowStateId,
  loadPatternLabWindowState,
  parsePatternLabDisplayOptions,
  parsePatternLabWindowMode,
  parsePatternLabWindowSyncMode,
  savePatternLabWindowState,
  serializePatternLabDisplayOptions,
  type PatternLabDisplayOptions,
  type PatternLabWindowMode,
  type PatternLabWindowState,
  type PatternLabWindowSyncMode,
} from "@/lib/pattern-lab-window";
import {
  DEFAULT_PATTERNS,
  DEFAULT_SIGNAL_PLAN,
  createCustomPattern,
  loadPatternWorkspace,
  savePatternWorkspace,
  type PatternEntryMode,
  type PatternExitMode,
  type QuantPattern,
  type SignalPlan,
} from "@/lib/quant-workbench";

const SNAPSHOT_STORAGE_KEY = "quant-pattern-lab-snapshots-v1";

type PatternLabSnapshot = {
  id: string;
  strategyId: number | null;
  backtestId: number | null;
  name: string;
  createdAt: string;
  executionModel: PatternExecutionModel;
  patterns: QuantPattern[];
  signalPlan: SignalPlan;
};

type StockCatalogRow = {
  symbol: string;
  name: string;
  market: string;
  sector: string;
  currentPrice: number;
  changePercent: number | null;
  backtestReturnPercent: number;
  finalScore: number;
  recentSignal: PatternLabSignalType;
  recentSignalDate: string | null;
  selectedPatternCount: number;
  sparkline: number[];
  currentVolume: number;
};

type ChartWindowRequest = {
  mode: PatternLabWindowMode;
  symbols: string[];
  focusedSymbol: string | null;
  viewMode?: PatternLabViewMode;
};

type WorkspaceDetailTab = "patterns" | "summary";

type FocusPatternPerformanceRow = {
  patternId: string;
  patternName: string;
  shortLabel: string;
  signalCount: number;
  tradeCount: number;
  latestSignalType: PatternLabSignalType;
  latestSignalDate: string | null;
  averageReturn: number | null;
  bestReturn: number | null;
  compoundedReturn: number | null;
  winRate: number | null;
  buyCount: number;
  sellCount: number;
  holdCount: number;
  lastBuyDate: string | null;
  lastSellDate: string | null;
};

type WorkspacePatternBadge = {
  id: string;
  label: string;
};

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

function normalizeMarketLabel(market?: string | null) {
  const value = market?.toUpperCase() ?? "";
  if (value.includes("KOSPI") || value.includes("KOSDAQ") || value.includes("KRX") || value.includes("KOREA")) {
    return "한국";
  }
  if (value.includes("NASDAQ") || value.includes("NYSE") || value.includes("AMEX") || value.includes("USA") || value.includes("US")) {
    return "미국";
  }
  return "전체";
}

function calculateCompoundedReturn(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((factor, value) => factor * (1 + value / 100), 1) * 100 - 100;
}

function resolveTradeReturnPercent(trade: PatternLabTradeRow) {
  return trade.returnPercent ?? trade.recommendation.expectedReturnPercent;
}

function percentTextClass(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "text-[color:var(--fg-muted)]";
  }
  if (value > 0) {
    return "text-emerald-600";
  }
  if (value < 0) {
    return "text-rose-600";
  }
  return "text-[color:var(--fg)]";
}

function percentPillClass(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "border-[color:var(--line)] bg-white text-[color:var(--fg-muted)]";
  }
  if (value > 0) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (value < 0) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-[color:var(--line)] bg-[#f7f9fc] text-[color:var(--fg)]";
}

function calculateChangePercent(detail?: StockDataDetail) {
  const recent = detail?.priceSeries?.slice(-2) ?? [];
  if (recent.length < 2) {
    return null;
  }
  const previous = recent[recent.length - 2]?.adjClose ?? recent[recent.length - 2]?.close ?? 0;
  const current = recent[recent.length - 1]?.adjClose ?? recent[recent.length - 1]?.close ?? 0;
  if (previous <= 0 || current <= 0) {
    return null;
  }
  return ((current / previous) - 1) * 100;
}

function entryModeLabel(value: PatternEntryMode) {
  if (value === "NEXT_OPEN") {
    return "다음 봉 시가 기준";
  }
  if (value === "BREAKOUT_PRICE") {
    return "돌파 가격 기준";
  }
  if (value === "VWAP_PROXY") {
    return "VWAP 근사 기준";
  }
  return "종가 기준";
}

function exitModeLabel(value: PatternExitMode) {
  if (value === "TARGET") {
    return "목표가 도달";
  }
  if (value === "STOP") {
    return "손절가 이탈";
  }
  if (value === "TREND") {
    return "추세 이탈";
  }
  if (value === "TIME") {
    return "보유일 초과";
  }
  return "트레일링 스탑";
}

function breakoutInputLabel(pattern: QuantPattern) {
  if (pattern.id === "liquidity-sweep-reversal") {
    return "복귀 확인 버퍼(%)";
  }
  if (pattern.id === "imbalance-pullback-continuation") {
    return "재돌파 버퍼(%)";
  }
  return "돌파 비율(%)";
}

function momentumInputLabel(pattern: QuantPattern) {
  if (pattern.id === "imbalance-pullback-continuation") {
    return "추세 모멘텀 임계치";
  }
  if (pattern.id === "liquidity-sweep-reversal") {
    return "보조 모멘텀 필터";
  }
  return "모멘텀 임계치";
}

function slopeInputLabel(pattern: QuantPattern) {
  if (pattern.id === "imbalance-pullback-continuation") {
    return "추세 기울기 필터";
  }
  if (pattern.id === "liquidity-sweep-reversal") {
    return "보조 기울기 필터";
  }
  return "기울기 threshold";
}

function toQuantPatternFromBacktest(
  pattern: NonNullable<BacktestResult["researchConfig"]>["patternDefinitions"][number],
  signalPlan: SignalPlan | null | undefined,
): QuantPattern {
  return {
    id: pattern.id,
    name: pattern.name,
    shortLabel: pattern.shortLabel ?? pattern.name.slice(0, 4).toUpperCase(),
    category: (pattern.category as QuantPattern["category"]) ?? "momentum",
    thesis: pattern.thesis ?? "저장된 백테스트 연구 설정",
    ruleSummary: pattern.ruleSummary ?? `${pattern.lookbackDays}일 규칙`,
    lookbackDays: pattern.lookbackDays,
    breakoutPercent: pattern.breakoutPercent,
    holdingDays: pattern.holdingDays,
    momentumThreshold: pattern.momentumThreshold,
    slopeThreshold: pattern.slopeThreshold,
    volumeSurgePercent: pattern.volumeSurgePercent ?? 12,
    sweepBufferPercent: pattern.sweepBufferPercent ?? 0.4,
    maxReentryBars: pattern.maxReentryBars ?? 2,
    wickRatioThreshold: pattern.wickRatioThreshold ?? 1.8,
    closeRecoveryPercent: pattern.closeRecoveryPercent ?? 55,
    minGapPercent: pattern.minGapPercent ?? 0.6,
    minFillPercent: pattern.minFillPercent ?? 45,
    maxConfirmationBars: pattern.maxConfirmationBars ?? 12,
    stopLossPercent: pattern.stopLossPercent ?? signalPlan?.stopLossPercent ?? DEFAULT_SIGNAL_PLAN.stopLossPercent,
    target1Percent: pattern.target1Percent ?? Math.max(8, Math.round((signalPlan?.takeProfitPercent ?? DEFAULT_SIGNAL_PLAN.takeProfitPercent) * 0.55)),
    target2Percent: pattern.target2Percent ?? signalPlan?.takeProfitPercent ?? DEFAULT_SIGNAL_PLAN.takeProfitPercent,
    entryMode: (pattern.entryMode as PatternEntryMode | undefined) ?? "SIGNAL_CLOSE",
    exitMode: (pattern.exitMode as PatternExitMode | undefined) ?? "TRAILING_STOP",
    enabled: pattern.enabled,
    source: pattern.source === "custom" ? "custom" : "preset",
  };
}

function loadSnapshots(): PatternLabSnapshot[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSnapshots(items: PatternLabSnapshot[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(items));
}

function ToggleButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-[12px] font-semibold ${active ? "border-black bg-black text-white" : "border-[color:var(--line)] bg-white"}`}
    >
      {label}
    </button>
  );
}

function WorkPanel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[color:rgba(15,23,42,0.08)] bg-[#fbfcfe] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-[color:var(--fg)]">{title}</p>
          {subtitle ? <p className="mt-1 text-[11px] leading-5 text-[color:var(--fg-muted)]">{subtitle}</p> : null}
        </div>
        {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}

function PercentPill({
  value,
  fallback = "-",
}: {
  value: number | null | undefined;
  fallback?: string;
}) {
  if (value == null || !Number.isFinite(value)) {
    return <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${percentPillClass(null)}`}>{fallback}</span>;
  }
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${percentPillClass(value)}`}>{formatPercent(value)}</span>;
}

function StatusPill({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${
        active
          ? "border-[rgba(21,94,239,0.18)] bg-[rgba(21,94,239,0.1)] text-[color:var(--kpi)]"
          : "border-[color:var(--line)] bg-[#f7f9fc] text-[color:var(--fg-muted)]"
      }`}
    >
      {label}
    </span>
  );
}

function WorkspaceToolbarButton({
  label,
  active,
  disabled = false,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex items-center rounded-lg border px-3 py-2 text-[12px] font-semibold transition ${
        active
          ? "border-black bg-black text-white"
          : "border-[color:var(--line)] bg-white text-[color:var(--fg-muted)] hover:border-[color:var(--kpi)] hover:text-[color:var(--fg)]"
      } disabled:cursor-not-allowed disabled:opacity-45`}
    >
      {label}
    </button>
  );
}

function WorkspaceMetricTile({
  label,
  value,
  helper,
  accentClassName,
}: {
  label: string;
  value: React.ReactNode;
  helper: React.ReactNode;
  accentClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-[color:rgba(15,23,42,0.08)] bg-white px-3 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
      <p className="text-[11px] text-[color:var(--fg-muted)]">{label}</p>
      <div className={`mt-2 text-[16px] font-semibold ${accentClassName ?? "text-[color:var(--fg)]"}`}>{value}</div>
      <div className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{helper}</div>
    </div>
  );
}

function getWorkspacePatternBadges(
  stock: PatternLabStockCard,
  enabledPatternMap: Map<string, QuantPattern>,
  workspacePatternFilter: string,
): WorkspacePatternBadge[] {
  if (workspacePatternFilter !== "ALL") {
    const pattern = enabledPatternMap.get(workspacePatternFilter);
    if (!pattern) {
      return [{ id: workspacePatternFilter, label: workspacePatternFilter }];
    }
    return [{ id: pattern.id, label: `${pattern.shortLabel} ${pattern.name}` }];
  }

  const patternIds = Array.from(
    new Set(
      [
        stock.dominantPatternId,
        ...stock.signals.slice(-8).map((signal) => signal.patternId),
        ...stock.trades.slice(-5).map((trade) => trade.patternId),
      ].filter((value): value is string => Boolean(value)),
    ),
  ).slice(0, 3);

  return patternIds.map((patternId) => {
    const pattern = enabledPatternMap.get(patternId);
    return {
      id: patternId,
      label: pattern ? `${pattern.shortLabel} ${pattern.name}` : patternId,
    };
  });
}

function WorkspaceChartCard({
  stock,
  checked,
  focused,
  currentState,
  latestSignal,
  latestRecommendation,
  latestTrade,
  scopedSignals,
  scopedTrades,
  scopedMarkers,
  scopedHoldingRanges,
  scopedZones,
  scopedPriceLevels,
  displayOptions,
  workspacePatternFilter,
  enabledPatternMap,
  onFocus,
  onToggleSelect,
  onOpenPopup,
}: {
  stock: PatternLabStockCard;
  checked: boolean;
  focused: boolean;
  currentState: PatternLabSignalType;
  latestSignal: PatternLabSignalRow | null;
  latestRecommendation: PatternLabPricePlan | PatternLabRecommendationRow | null;
  latestTrade: PatternLabTradeRow | null;
  scopedSignals: PatternLabSignalRow[];
  scopedTrades: PatternLabTradeRow[];
  scopedMarkers: PatternLabChartMarker[];
  scopedHoldingRanges: PatternLabHoldingRange[];
  scopedZones: PatternLabSignalZone[];
  scopedPriceLevels: PatternLabPriceLevel[];
  displayOptions: PatternLabDisplayOptions;
  workspacePatternFilter: string;
  enabledPatternMap: Map<string, QuantPattern>;
  onFocus: () => void;
  onToggleSelect: () => void;
  onOpenPopup: () => void;
}) {
  const badges = getWorkspacePatternBadges(stock, enabledPatternMap, workspacePatternFilter);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onFocus}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onFocus();
        }
      }}
      className={`rounded-2xl border bg-white p-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition ${
        focused
          ? "border-[rgba(21,94,239,0.28)] shadow-[0_18px_36px_rgba(21,94,239,0.12)]"
          : "border-[color:rgba(15,23,42,0.08)] hover:border-[rgba(21,94,239,0.22)] hover:shadow-[0_16px_34px_rgba(15,23,42,0.08)]"
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--kpi)] focus-visible:ring-offset-2`}
      aria-label={`${stock.summary.symbol} 차트 포커스`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <input
            type="checkbox"
            aria-label={`${stock.summary.symbol} ${checked ? "선택 해제" : "선택"}`}
            checked={checked}
            onChange={onToggleSelect}
            onClick={(event) => event.stopPropagation()}
            className="mt-1 h-4 w-4 rounded border-[color:var(--line)] text-[color:var(--kpi)] focus:ring-[color:var(--kpi)]"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[15px] font-semibold text-[color:var(--fg)]">{stock.summary.name}</p>
              {focused ? <StatusPill label="포커스" active /> : null}
              {checked ? <StatusPill label="선택됨" active /> : null}
            </div>
            <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{stock.summary.symbol} · {stock.summary.market} · {stock.summary.sector}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`${stock.summary.symbol} 현재 차트 팝업으로 열기`}
            onClick={(event) => {
              event.stopPropagation();
              onOpenPopup();
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--line)] bg-white text-[color:var(--fg-muted)] transition hover:border-[color:var(--kpi)] hover:text-[color:var(--fg)]"
          >
            <Icon name="window" className="h-4 w-4" />
          </button>
          <SignalBadge label={currentState} tone={getSignalTone(currentState)} />
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <WorkspaceMetricTile
          label="백테스트 수익률"
          value={<PercentPill value={stock.summary.backtestReturnPercent} />}
          helper={`최근 신호 ${latestSignal?.signalDate ?? stock.summary.recentSignalDate ?? "-"}`}
        />
        <WorkspaceMetricTile
          label="권장 매수가"
          value={latestRecommendation ? `${formatPrice(latestRecommendation.entryRangeLow)} ~ ${formatPrice(latestRecommendation.entryRangeHigh)}` : "-"}
          helper={`권장 매도가 ${latestRecommendation ? formatPrice(latestRecommendation.recommendedSellPrice) : "-"}`}
          accentClassName="text-[color:var(--buy)]"
        />
        <WorkspaceMetricTile
          label="최근 거래 수익률"
          value={<PercentPill value={latestTrade == null ? null : resolveTradeReturnPercent(latestTrade)} />}
          helper={`패턴 거래 ${scopedTrades.length}건`}
        />
        <WorkspaceMetricTile
          label="적용 패턴 / 신호"
          value={`${workspacePatternFilter === "ALL" ? stock.summary.selectedPatternCount : scopedSignals.length} / ${scopedSignals.length}`}
          helper={`${workspacePatternFilter === "ALL" ? "활성 패턴 수 / 신호 건수" : "선택 패턴 신호 건수"}`}
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-[color:rgba(15,23,42,0.08)] bg-[#fbfcfe]">
        <PatternLabChart
          title={`${stock.summary.symbol} 차트`}
          subtitle={`${latestSignal ? `${latestSignal.patternName} · ${latestSignal.signalType}` : stock.summary.recentPatternSignal} · ${workspacePatternFilter === "ALL" ? `활성 패턴 ${stock.summary.selectedPatternCount}개 동시 오버레이` : "선택 패턴 필터 적용"}`}
          candles={stock.candles}
          markers={scopedMarkers}
          holdingRanges={scopedHoldingRanges}
          zones={scopedZones}
          priceLevels={scopedPriceLevels}
          compact
          showMovingAverage={displayOptions.showMovingAverage}
          showVolume={displayOptions.showVolume}
          showSignalZones={displayOptions.showSignalZones}
          showHoldingRanges={displayOptions.showHoldingRanges}
          showPriceLevels={displayOptions.showPriceLevels}
          showPatternLegend={displayOptions.showPatternLegend}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {badges.length > 0 ? badges.map((badge) => (
            <span key={`${stock.summary.symbol}-${badge.id}`} className="rounded-full border border-[color:var(--line)] bg-[#f7f9fc] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--fg-muted)]">
              {badge.label}
            </span>
          )) : (
            <span className="rounded-full border border-[color:var(--line)] bg-[#f7f9fc] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--fg-muted)]">
              패턴 정보 없음
            </span>
          )}
        </div>
        <div className="text-[11px] text-[color:var(--fg-muted)]">
          최근 신호일 {latestSignal?.signalDate ?? stock.summary.recentSignalDate ?? "-"} · 누적 수익률 <span className={percentTextClass(stock.summary.cumulativeReturnPercent)}>{formatPercent(stock.summary.cumulativeReturnPercent)}</span>
        </div>
      </div>
    </article>
  );
}

export function PatternLabClient({
  initialStrategies,
  initialStrategyId,
  initialBacktestId,
  initialSnapshotId,
  initialHistory = [],
  initialBacktest = null,
  initialSymbols,
  initialStartDate,
  initialEndDate,
  initialMarket,
  initialUniverseLabel,
  initialExecutionModel,
  standalone = false,
}: {
  initialStrategies: StrategySummary[];
  initialStrategyId?: number;
  initialBacktestId?: number;
  initialSnapshotId?: number;
  initialHistory?: BacktestHistoryItem[];
  initialBacktest?: BacktestResult | null;
  initialSymbols: string[];
  initialStartDate?: string;
  initialEndDate?: string;
  initialMarket?: string;
  initialUniverseLabel?: string;
  initialExecutionModel?: PatternExecutionModel;
  standalone?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedWindowMode = parsePatternLabWindowMode(searchParams.get("windowMode"));
  const popupStateId = searchParams.get("popupStateId");
  const queryDisplayOptions = searchParams.get("display");
  const queryFocusedSymbol = searchParams.get("focus");
  const queryViewMode = searchParams.get("view") === "focus" ? "focus" : "grid";
  const queryActivePatternId = searchParams.get("activePattern");
  const queryPatternIds = useMemo(() => new Set((searchParams.get("patterns") ?? "").split(",").map((value) => value.trim()).filter(Boolean)), [searchParams]);
  const windowMode: PatternLabWindowMode = standalone ? requestedWindowMode : "main";
  const resolvedInitialStrategy = (initialStrategyId
    ? initialStrategies.find((strategy) => strategy.strategyId === initialStrategyId) ?? null
    : null) ?? initialStrategies[0] ?? null;
  const resolvedInitialBacktestId = initialBacktestId ?? initialHistory[0]?.backtestId ?? resolvedInitialStrategy?.latestBacktest?.backtestId ?? null;
  const resolvedInitialSymbols = useMemo(() => {
    if (initialSymbols.length > 0) {
      return initialSymbols;
    }
    const symbolsFromBacktest = Array.from(
      new Set([
        ...(initialBacktest?.stockBreakdown ?? []).map((stock) => stock.symbol),
        ...(initialBacktest?.signalTimeline ?? []).map((signal) => signal.symbol),
      ]),
    ).filter(Boolean);
    return symbolsFromBacktest;
  }, [initialBacktest?.signalTimeline, initialBacktest?.stockBreakdown, initialSymbols]);
  const [isRouting, startTransition] = useTransition();
  const popupStateAppliedRef = useRef(false);
  const hydratedBacktestIdRef = useRef<number | null>(null);
  const skipWorkspaceHydrationRef = useRef<number | null>(null);
  const selectionUniverseKeyRef = useRef<string | null>(null);
  const [strategies] = useState(initialStrategies);
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(initialStrategyId ?? initialStrategies[0]?.strategyId ?? null);
  const [selectedBacktestId, setSelectedBacktestId] = useState<number | null>(resolvedInitialBacktestId);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(initialSnapshotId ?? null);
  const [history, setHistory] = useState<BacktestHistoryItem[]>(initialHistory);
  const [snapshots, setSnapshots] = useState<StrategyWeightSnapshot[]>([]);
  const [backtest, setBacktest] = useState<BacktestResult | null>(initialBacktest);
  const [diagnostics, setDiagnostics] = useState<StrategyDiagnosticsResult | null>(null);
  const [detailsBySymbol, setDetailsBySymbol] = useState<Record<string, StockDataDetail>>({});
  const [draftPatterns, setDraftPatterns] = useState<QuantPattern[]>([]);
  const [draftSignalPlan, setDraftSignalPlan] = useState<SignalPlan>({ ...DEFAULT_SIGNAL_PLAN });
  const [appliedPatterns, setAppliedPatterns] = useState<QuantPattern[]>([]);
  const [appliedSignalPlan, setAppliedSignalPlan] = useState<SignalPlan>({ ...DEFAULT_SIGNAL_PLAN });
  const [draftExecutionModel, setDraftExecutionModel] = useState<PatternExecutionModel>(initialExecutionModel ?? "SIGNAL_CLOSE");
  const [appliedExecutionModel, setAppliedExecutionModel] = useState<PatternExecutionModel>(initialExecutionModel ?? "SIGNAL_CLOSE");
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(resolvedInitialSymbols);
  const [focusedSymbol, setFocusedSymbol] = useState<string | null>(queryFocusedSymbol ?? resolvedInitialSymbols[0] ?? null);
  const [marketFilter, setMarketFilter] = useState(initialMarket ?? "ALL");
  const [startDate, setStartDate] = useState(initialStartDate ?? "2024-01-01");
  const [endDate, setEndDate] = useState(initialEndDate ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState("ALL");
  const [signalFilter, setSignalFilter] = useState<PatternLabSignalType | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<"return" | "score" | "signalDate" | "volume" | "price">("return");
  const [viewMode, setViewMode] = useState<"grid" | "focus">(queryViewMode);
  const [workspaceDetailTab, setWorkspaceDetailTab] = useState<WorkspaceDetailTab>("summary");
  const [workspacePatternFilter, setWorkspacePatternFilter] = useState<string>(queryActivePatternId ?? "ALL");
  const [displayOptions, setDisplayOptions] = useState<PatternLabDisplayOptions>(() => parsePatternLabDisplayOptions(queryDisplayOptions));
  const [windowSyncMode, setWindowSyncMode] = useState<PatternLabWindowSyncMode>(() => parsePatternLabWindowSyncMode(searchParams.get("syncMode")));
  const [activePatternId, setActivePatternId] = useState<string | null>(null);
  const [favoritePatternIds, setFavoritePatternIds] = useState<string[]>([]);
  const [patternTab, setPatternTab] = useState<"preset" | "custom" | "favorite">("preset");
  const [activeTab, setActiveTab] = useState<"signals" | "trades" | "stocks" | "patterns" | "matrix" | "recommendations">("signals");
  const [patternSnapshots, setPatternSnapshots] = useState<PatternLabSnapshot[]>([]);
  const [comparisonBanner, setComparisonBanner] = useState<{ previousWinRate: number; currentWinRate: number; previousAverageReturn: number; currentAverageReturn: number } | null>(null);
  const [gridPage, setGridPage] = useState(1);
  const [dismissedFocusFilterConflictKey, setDismissedFocusFilterConflictKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingBacktest, setLoadingBacktest] = useState(false);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [submittingBacktest, setSubmittingBacktest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasExplicitInitialSymbols = initialSymbols.length > 0;

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.strategyId === selectedStrategyId) ?? null,
    [selectedStrategyId, strategies],
  );

  const applyWindowState = useEffectEvent((state: PatternLabWindowState) => {
    skipWorkspaceHydrationRef.current = state.selectedStrategyId;
    setSelectedStrategyId(state.selectedStrategyId);
    setSelectedBacktestId(state.selectedBacktestId);
    setSelectedSnapshotId(state.selectedSnapshotId);
    setSelectedSymbols(state.selectedSymbols);
    setFocusedSymbol(state.focusedSymbol ?? state.selectedSymbols[0] ?? null);
    setMarketFilter(state.marketFilter || "ALL");
    setStartDate(state.startDate);
    setEndDate(state.endDate);
    setDraftPatterns(state.draftPatterns.map((pattern) => ({ ...pattern })));
    setAppliedPatterns(state.appliedPatterns.map((pattern) => ({ ...pattern })));
    setDraftSignalPlan({ ...state.draftSignalPlan });
    setAppliedSignalPlan({ ...state.appliedSignalPlan });
    setDraftExecutionModel(state.draftExecutionModel);
    setAppliedExecutionModel(state.appliedExecutionModel);
    setViewMode(state.viewMode);
    setWorkspacePatternFilter(state.activePatternId ?? "ALL");
    setDisplayOptions(clonePatternLabDisplayOptions(state.displayOptions));
    setWindowSyncMode(state.syncMode);
    setActivePatternId(state.activePatternId ?? state.draftPatterns.find((pattern) => pattern.enabled)?.id ?? state.draftPatterns[0]?.id ?? null);
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPatternSnapshots(loadSnapshots());
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (standalone && popupStateId && !popupStateAppliedRef.current) {
      const popupState = loadPatternLabWindowState(popupStateId);
      if (popupState) {
        popupStateAppliedRef.current = true;
        applyWindowState(popupState);
        return;
      }
    }
    if (skipWorkspaceHydrationRef.current === selectedStrategyId) {
      skipWorkspaceHydrationRef.current = null;
      return;
    }
    const workspace = loadPatternWorkspace(selectedStrategyId);
    const timeout = window.setTimeout(() => {
      const nextPatterns = queryPatternIds.size > 0
        ? workspace.patterns.map((pattern) => ({ ...pattern, enabled: queryPatternIds.has(pattern.id) }))
        : workspace.patterns;
      setDraftPatterns(nextPatterns);
      setDraftSignalPlan(workspace.signalPlan);
      setAppliedPatterns(nextPatterns.map((pattern) => ({ ...pattern })));
      setAppliedSignalPlan({ ...workspace.signalPlan });
      setActivePatternId(queryActivePatternId ?? nextPatterns.find((pattern) => pattern.enabled)?.id ?? nextPatterns[0]?.id ?? null);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [popupStateId, queryActivePatternId, queryPatternIds, selectedStrategyId, standalone]);

  useEffect(() => {
    if (!selectedStrategyId) {
      const timeout = window.setTimeout(() => {
        setHistory([]);
        setSnapshots([]);
        setDiagnostics(null);
      }, 0);
      return () => window.clearTimeout(timeout);
    }

    const strategyId = selectedStrategyId;
    let cancelled = false;
    async function loadStrategyResearchContext() {
      setLoadingHistory(true);
      try {
        const [nextHistory, nextSnapshots, nextDiagnostics] = await Promise.all([
          getBacktestHistory(strategyId),
          getStrategySnapshots(strategyId),
          getStrategyDiagnostics(strategyId).catch(() => null),
        ]);
        if (cancelled) {
          return;
        }
        setHistory(nextHistory);
        setSnapshots(nextSnapshots);
        setDiagnostics(nextDiagnostics);
        setSelectedBacktestId((current) => {
          if (current && nextHistory.some((item) => item.backtestId === current)) {
            return current;
          }
          return nextHistory[0]?.backtestId ?? selectedStrategy?.latestBacktest?.backtestId ?? null;
        });
        setLoadingHistory(false);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setHistory((current) => (current.some((item) => item.strategyId === strategyId) ? current : []));
        setSnapshots([]);
        setDiagnostics(null);
        setLoadingHistory(false);
        setError(err instanceof Error ? err.message : "패턴 실험용 전략 데이터를 불러오지 못했습니다.");
      }
    }

    void loadStrategyResearchContext();

    return () => {
      cancelled = true;
    };
  }, [selectedStrategy?.latestBacktest?.backtestId, selectedStrategyId]);

  useEffect(() => {
    if (!selectedBacktestId) {
      hydratedBacktestIdRef.current = null;
      const timeout = window.setTimeout(() => {
        setBacktest(null);
      }, 0);
      return () => window.clearTimeout(timeout);
    }

    const backtestId = selectedBacktestId;
    let cancelled = false;
    async function loadBacktest() {
      setLoadingBacktest(true);
      try {
        const detail = await getBacktestDetail(backtestId);
        if (cancelled) {
          return;
        }
        setBacktest(detail);
        setLoadingBacktest(false);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setBacktest((current) => (current?.backtestId === backtestId ? current : null));
        setLoadingBacktest(false);
        setError(err instanceof Error ? err.message : "패턴 실험용 백테스트 상세를 불러오지 못했습니다.");
      }
    }

    void loadBacktest();

    return () => {
      cancelled = true;
    };
  }, [selectedBacktestId]);

  useEffect(() => {
    if (!backtest?.researchConfig?.patternDefinitions || backtest.researchConfig.patternDefinitions.length === 0) {
      return;
    }
    if (hydratedBacktestIdRef.current === selectedBacktestId) {
      return;
    }
    if (standalone && popupStateId) {
      return;
    }

    const nextSignalPlan = backtest.researchConfig.signalPlan ?? DEFAULT_SIGNAL_PLAN;
    const nextPatterns = backtest.researchConfig.patternDefinitions.map((pattern) => toQuantPatternFromBacktest(pattern, nextSignalPlan));
    const resolvedPatterns = queryPatternIds.size > 0
      ? nextPatterns.map((pattern) => ({ ...pattern, enabled: queryPatternIds.has(pattern.id) }))
      : nextPatterns;

    const timeout = window.setTimeout(() => {
      hydratedBacktestIdRef.current = selectedBacktestId;
      setDraftPatterns(resolvedPatterns);
      setAppliedPatterns(resolvedPatterns.map((pattern) => ({ ...pattern })));
      setDraftSignalPlan({ ...nextSignalPlan });
      setAppliedSignalPlan({ ...nextSignalPlan });
      setActivePatternId(queryActivePatternId ?? resolvedPatterns.find((pattern) => pattern.enabled)?.id ?? resolvedPatterns[0]?.id ?? null);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [backtest?.researchConfig?.patternDefinitions, backtest?.researchConfig?.signalPlan, popupStateId, queryActivePatternId, queryPatternIds, selectedBacktestId, standalone]);

  const availableSymbols = useMemo(() => {
    const fromBacktest = (backtest?.stockBreakdown ?? []).map((stock) => stock.symbol);
    const fromSignals = (backtest?.signalTimeline ?? []).map((signal) => signal.symbol);
    const fallback = initialSymbols;
    return Array.from(new Set([...fromBacktest, ...fromSignals, ...fallback])).filter(Boolean);
  }, [backtest?.signalTimeline, backtest?.stockBreakdown, initialSymbols]);

  const selectionUniverseKey = useMemo(() => availableSymbols.join(","), [availableSymbols]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (availableSymbols.length === 0) {
        selectionUniverseKeyRef.current = selectionUniverseKey;
        setSelectedSymbols([]);
        setFocusedSymbol(null);
        return;
      }
      setSelectedSymbols((current) => {
        const existing = current.filter((symbol) => availableSymbols.includes(symbol));
        if (selectionUniverseKeyRef.current === selectionUniverseKey) {
          return existing.length === current.length ? current : existing;
        }
        selectionUniverseKeyRef.current = selectionUniverseKey;
        if (hasExplicitInitialSymbols) {
          const explicitSelection = initialSymbols.filter((symbol) => availableSymbols.includes(symbol));
          return explicitSelection.length > 0 ? explicitSelection : availableSymbols;
        }
        return availableSymbols;
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [availableSymbols, hasExplicitInitialSymbols, initialSymbols, selectionUniverseKey]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!focusedSymbol || !selectedSymbols.includes(focusedSymbol)) {
        setFocusedSymbol(selectedSymbols[0] ?? null);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [focusedSymbol, selectedSymbols]);

  useEffect(() => {
    if (availableSymbols.length === 0) {
      return;
    }

    let cancelled = false;
    const missingSymbols = availableSymbols.filter((symbol) => detailsBySymbol[symbol] == null);
    if (missingSymbols.length === 0) {
      return;
    }

    async function loadStockDetails() {
      setLoadingStocks(true);
      const entries = await Promise.all(
        missingSymbols.map(async (symbol) => {
          try {
            const detail = await getStockDataDetail(symbol);
            return [symbol, detail] as const;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) {
        return;
      }
      const resolved = entries.filter((entry): entry is readonly [string, StockDataDetail] => entry != null);
      if (resolved.length > 0) {
        setDetailsBySymbol((current) => ({ ...current, ...Object.fromEntries(resolved) }));
      }
      setLoadingStocks(false);
    }

    void loadStockDetails();

    return () => {
      cancelled = true;
    };
  }, [availableSymbols, detailsBySymbol]);

  const candidateScores = useMemo(
    () => Object.fromEntries((diagnostics?.candidates ?? []).map((candidate) => [candidate.symbol, candidate.score])),
    [diagnostics?.candidates],
  );

  const experimentResult = useMemo<PatternLabResult>(
    () =>
      buildPatternLabResult({
        detailsBySymbol,
        backtest,
        selectedSymbols,
        patterns: appliedPatterns,
        signalPlan: appliedSignalPlan,
        executionModel: appliedExecutionModel,
        startDate,
        endDate,
        candidateScores,
      }),
    [appliedExecutionModel, appliedPatterns, appliedSignalPlan, backtest, candidateScores, detailsBySymbol, endDate, selectedSymbols, startDate],
  );

  const draftResult = useMemo<PatternLabResult>(
    () =>
      buildPatternLabResult({
        detailsBySymbol,
        backtest,
        selectedSymbols,
        patterns: draftPatterns,
        signalPlan: draftSignalPlan,
        executionModel: draftExecutionModel,
        startDate,
        endDate,
        candidateScores,
      }),
    [backtest, candidateScores, detailsBySymbol, draftExecutionModel, draftPatterns, draftSignalPlan, endDate, selectedSymbols, startDate],
  );

  const summaryMetrics = useMemo(() => {
    const returns = experimentResult.trades.map((trade) => trade.returnPercent ?? trade.recommendation.expectedReturnPercent);
    const averageReturn = returns.length > 0 ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;
    const winRate = returns.length > 0 ? (returns.filter((value) => value > 0).length / returns.length) * 100 : 0;
    const cumulativeReturn = experimentResult.stocks.reduce((sum, stock) => sum + stock.summary.cumulativeReturnPercent, 0);
    const maxDrawdown = experimentResult.stocks.length > 0 ? Math.min(...experimentResult.stocks.map((stock) => stock.summary.maxDrawdown)) : 0;
    return {
      tradeCount: experimentResult.trades.length,
      winRate,
      averageReturn,
      cumulativeReturn,
      maxDrawdown,
      buyCount: experimentResult.stocks.filter((stock) => stock.summary.currentState === "BUY").length,
      holdCount: experimentResult.stocks.filter((stock) => stock.summary.currentState === "HOLD").length,
      sellCount: experimentResult.stocks.filter((stock) => stock.summary.currentState === "SELL").length,
    };
  }, [experimentResult.stocks, experimentResult.trades]);

  const catalogRows = useMemo<StockCatalogRow[]>(() => {
    return availableSymbols.map((symbol) => {
      const detail = detailsBySymbol[symbol];
      const stockResult = experimentResult.stocks.find((item) => item.summary.symbol === symbol);
      const backtestStock = backtest?.stockBreakdown?.find((item) => item.symbol === symbol);

      return {
        symbol,
        name: detail?.name ?? symbol,
        market: normalizeMarketLabel(detail?.exchange),
        sector: detail?.sector ?? "-",
        currentPrice: detail?.latestPrice ?? 0,
        changePercent: calculateChangePercent(detail),
        backtestReturnPercent: stockResult?.summary.backtestReturnPercent ?? backtestStock?.returnPercent ?? 0,
        finalScore: candidateScores[symbol] ?? 0,
        recentSignal: stockResult?.summary.currentState ?? (backtestStock?.signal?.toUpperCase().includes("BUY") ? "BUY" : backtestStock?.signal?.toUpperCase().includes("SELL") ? "SELL" : "NONE"),
        recentSignalDate: stockResult?.summary.recentSignalDate ?? null,
        selectedPatternCount: stockResult?.summary.selectedPatternCount ?? 0,
        sparkline: stockResult?.summary.sparkline ?? (detail ? detail.priceSeries.slice(-20).map((point) => point.adjClose ?? point.close ?? 0).filter((value) => value > 0) : []),
        currentVolume: stockResult?.summary.currentVolume ?? (detail?.priceSeries[detail.priceSeries.length - 1]?.volume ?? 0),
      };
    });
  }, [availableSymbols, backtest?.stockBreakdown, candidateScores, detailsBySymbol, experimentResult.stocks]);

  const sectors = useMemo(
    () => Array.from(new Set(catalogRows.map((row) => row.sector).filter((sector) => sector && sector !== "-"))).sort(),
    [catalogRows],
  );

  const filteredRows = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    const rows = catalogRows.filter((row) => {
      if (marketFilter !== "ALL" && row.market !== marketFilter) {
        return false;
      }
      if (sectorFilter !== "ALL" && row.sector !== sectorFilter) {
        return false;
      }
      if (signalFilter !== "ALL" && row.recentSignal !== signalFilter) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return row.symbol.toLowerCase().includes(normalized) || row.name.toLowerCase().includes(normalized);
    });

    return rows.sort((left, right) => {
      if (sortKey === "score") {
        return right.finalScore - left.finalScore;
      }
      if (sortKey === "signalDate") {
        return (right.recentSignalDate ?? "").localeCompare(left.recentSignalDate ?? "");
      }
      if (sortKey === "volume") {
        return right.currentVolume - left.currentVolume;
      }
      if (sortKey === "price") {
        return right.currentPrice - left.currentPrice;
      }
      return right.backtestReturnPercent - left.backtestReturnPercent;
    });
  }, [catalogRows, marketFilter, searchQuery, sectorFilter, signalFilter, sortKey]);

  const enabledDraftPatterns = useMemo(() => draftPatterns.filter((pattern) => pattern.enabled), [draftPatterns]);
  const enabledPatternMap = useMemo(
    () => new Map(enabledDraftPatterns.map((pattern) => [pattern.id, pattern])),
    [enabledDraftPatterns],
  );
  const activePattern = useMemo(
    () => draftPatterns.find((pattern) => pattern.id === activePatternId) ?? draftPatterns[0] ?? null,
    [activePatternId, draftPatterns],
  );

  const selectedBacktestSummary = useMemo(
    () => history.find((item) => item.backtestId === selectedBacktestId) ?? null,
    [history, selectedBacktestId],
  );
  const selectedBacktestDisplayId = selectedBacktestSummary?.backtestId ?? selectedBacktestId ?? backtest?.backtestId ?? null;
  const selectedBacktestLabel = selectedBacktestDisplayId ? `백테스트 #${selectedBacktestDisplayId}` : "백테스트 미선택";
  const selectedBacktestSelectPlaceholder = selectedBacktestDisplayId
    ? `#${selectedBacktestDisplayId} · 로딩 중`
    : loadingHistory
      ? "백테스트 결과 불러오는 중"
      : "백테스트 결과 없음";
  const activeUniverseLabel = selectedBacktestSummary?.universeScope
    ? summarizeBacktestUniverseScope(selectedBacktestSummary.universeScope).shortLabel
    : initialUniverseLabel ?? "전략 기본 유니버스";

  useEffect(() => {
    if (!selectedBacktestSummary) {
      return;
    }
    const timeout = window.setTimeout(() => {
      if (selectedBacktestSummary.startDate) {
        setStartDate(selectedBacktestSummary.startDate);
      }
      if (selectedBacktestSummary.endDate) {
        setEndDate(selectedBacktestSummary.endDate);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [selectedBacktestSummary]);

  const isDirty = useMemo(() => {
    return JSON.stringify({
      patterns: draftPatterns,
      signalPlan: draftSignalPlan,
      executionModel: draftExecutionModel,
    }) !== JSON.stringify({
      patterns: appliedPatterns,
      signalPlan: appliedSignalPlan,
      executionModel: appliedExecutionModel,
    });
  }, [appliedExecutionModel, appliedPatterns, appliedSignalPlan, draftExecutionModel, draftPatterns, draftSignalPlan]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedStrategyId) {
      params.set("strategyId", String(selectedStrategyId));
    }
    if (selectedBacktestId) {
      params.set("backtestId", String(selectedBacktestId));
    }
    if (selectedSnapshotId) {
      params.set("snapshotId", String(selectedSnapshotId));
    }
    if (selectedSymbols.length > 0) {
      params.set("symbols", selectedSymbols.join(","));
    }
    if (startDate) {
      params.set("startDate", startDate);
    }
    if (endDate) {
      params.set("endDate", endDate);
    }
    if (marketFilter !== "ALL") {
      params.set("market", marketFilter);
    }
    if (focusedSymbol) {
      params.set("focus", focusedSymbol);
    }
    if (viewMode !== "grid") {
      params.set("view", viewMode);
    }
    if (draftExecutionModel !== "SIGNAL_CLOSE") {
      params.set("executionModel", draftExecutionModel);
    }
    if (activePatternId) {
      params.set("activePattern", activePatternId);
    }
    const displayParam = serializePatternLabDisplayOptions(displayOptions);
    if (displayParam) {
      params.set("display", displayParam);
    }
    const enabledIds = draftPatterns.filter((pattern) => pattern.enabled).map((pattern) => pattern.id);
    if (enabledIds.length > 0) {
      params.set("patterns", enabledIds.join(","));
    }
    if (standalone && windowMode !== "main") {
      params.set("windowMode", windowMode);
    }
    if (standalone && popupStateId) {
      params.set("popupStateId", popupStateId);
      params.set("syncMode", windowSyncMode);
    }
    const nextQuery = params.toString();
    if (typeof window === "undefined") {
      return;
    }
    const currentQuery = window.location.search.replace(/^\?/, "");
    if (nextQuery === currentQuery) {
      return;
    }
    const next = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    window.history.replaceState(window.history.state, "", next);
  }, [activePatternId, displayOptions, draftExecutionModel, draftPatterns, endDate, focusedSymbol, marketFilter, pathname, popupStateId, selectedBacktestId, selectedSnapshotId, selectedStrategyId, selectedSymbols, standalone, startDate, viewMode, windowMode, windowSyncMode]);

  function updatePattern(patternId: string, updater: (pattern: QuantPattern) => QuantPattern) {
    setDraftPatterns((current) => current.map((pattern) => (pattern.id === patternId ? updater(pattern) : pattern)));
  }

  function togglePattern(patternId: string) {
    setDraftPatterns((current) => current.map((pattern) => (pattern.id === patternId ? { ...pattern, enabled: !pattern.enabled } : pattern)));
    setAppliedPatterns((current) => current.map((pattern) => (pattern.id === patternId ? { ...pattern, enabled: !pattern.enabled } : pattern)));
  }

  function duplicatePattern(pattern: QuantPattern) {
    const duplicated = createCustomPattern({
      name: `${pattern.name} 복제`,
      category: pattern.category,
      lookbackDays: pattern.lookbackDays,
      breakoutPercent: pattern.breakoutPercent,
      holdingDays: pattern.holdingDays,
      momentumThreshold: pattern.momentumThreshold,
      slopeThreshold: pattern.slopeThreshold,
      volumeSurgePercent: pattern.volumeSurgePercent,
      sweepBufferPercent: pattern.sweepBufferPercent,
      maxReentryBars: pattern.maxReentryBars,
      wickRatioThreshold: pattern.wickRatioThreshold,
      closeRecoveryPercent: pattern.closeRecoveryPercent,
      minGapPercent: pattern.minGapPercent,
      minFillPercent: pattern.minFillPercent,
      maxConfirmationBars: pattern.maxConfirmationBars,
      stopLossPercent: pattern.stopLossPercent,
      target1Percent: pattern.target1Percent,
      target2Percent: pattern.target2Percent,
      entryMode: pattern.entryMode,
      exitMode: pattern.exitMode,
    });
    setDraftPatterns((current) => [...current, duplicated]);
    setActivePatternId(duplicated.id);
  }

  function deletePattern(patternId: string) {
    setDraftPatterns((current) => current.filter((pattern) => pattern.id !== patternId));
    setAppliedPatterns((current) => current.filter((pattern) => pattern.id !== patternId));
    setActivePatternId((current) => (current === patternId ? draftPatterns.find((pattern) => pattern.id !== patternId)?.id ?? null : current));
  }

  function toggleFavorite(patternId: string) {
    setFavoritePatternIds((current) => (current.includes(patternId) ? current.filter((id) => id !== patternId) : [...current, patternId]));
  }

  function applyExperiment() {
    const previousReturns = experimentResult.trades.map((trade) => trade.returnPercent ?? trade.recommendation.expectedReturnPercent);
    const currentReturns = draftResult.trades.map((trade) => trade.returnPercent ?? trade.recommendation.expectedReturnPercent);
    const previousWinRate = previousReturns.length > 0 ? (previousReturns.filter((value) => value > 0).length / previousReturns.length) * 100 : 0;
    const currentWinRate = currentReturns.length > 0 ? (currentReturns.filter((value) => value > 0).length / currentReturns.length) * 100 : 0;
    const previousAverageReturn = previousReturns.length > 0 ? previousReturns.reduce((sum, value) => sum + value, 0) / previousReturns.length : 0;
    const currentAverageReturn = currentReturns.length > 0 ? currentReturns.reduce((sum, value) => sum + value, 0) / currentReturns.length : 0;
    setIsApplying(true);
    setAppliedPatterns(draftPatterns.map((pattern) => ({ ...pattern })));
    setAppliedSignalPlan({ ...draftSignalPlan });
    setAppliedExecutionModel(draftExecutionModel);
    setComparisonBanner({ previousWinRate, currentWinRate, previousAverageReturn, currentAverageReturn });
    window.setTimeout(() => setIsApplying(false), 350);
    setMessage("패턴 파라미터를 다시 적용했습니다.");
  }

  function handleSaveWorkspace() {
    savePatternWorkspace(selectedStrategyId, {
      patterns: draftPatterns,
      signalPlan: draftSignalPlan,
      updatedAt: new Date().toISOString(),
    });
    setMessage("패턴 워크스페이스를 저장했습니다.");
  }

  function handleSaveSnapshot() {
    const snapshot: PatternLabSnapshot = {
      id: `snapshot-${Date.now()}`,
      strategyId: selectedStrategyId,
      backtestId: selectedBacktestId,
      name: `${selectedStrategy?.name ?? "전략"} 패턴 스냅샷`,
      createdAt: new Date().toISOString(),
      executionModel: draftExecutionModel,
      patterns: draftPatterns.map((pattern) => ({ ...pattern })),
      signalPlan: { ...draftSignalPlan },
    };
    const next = [snapshot, ...patternSnapshots].slice(0, 12);
    setPatternSnapshots(next);
    saveSnapshots(next);
    setMessage("패턴 스냅샷을 저장했습니다.");
  }

  function applySnapshot(snapshotId: string) {
    const snapshot = patternSnapshots.find((item) => item.id === snapshotId);
    if (!snapshot) {
      return;
    }
    setDraftPatterns(snapshot.patterns.map((pattern) => ({ ...pattern })));
    setDraftSignalPlan({ ...snapshot.signalPlan });
    setDraftExecutionModel(snapshot.executionModel);
    setActivePatternId(snapshot.patterns[0]?.id ?? null);
    setMessage(`"${snapshot.name}" 스냅샷을 불러왔습니다.`);
  }

  function toggleSymbol(symbol: string) {
    setSelectedSymbols((current) => {
      if (current.includes(symbol)) {
        return current.filter((item) => item !== symbol);
      }
      return [...current, symbol];
    });
  }

  function focusSymbol(symbol: string) {
    setFocusedSymbol(symbol);
    setSelectedSymbols((current) => (current.includes(symbol) ? current : [...current, symbol]));
  }

  function selectVisibleSymbols() {
    setSelectedSymbols(filteredRows.map((row) => row.symbol));
  }

  function clearSelection() {
    setSelectedSymbols([]);
  }

  function resetWorkspaceFilters() {
    setSearchQuery("");
    setMarketFilter("ALL");
    setSectorFilter("ALL");
    setSignalFilter("ALL");
    setSortKey("return");
    setWorkspacePatternFilter("ALL");
    setGridPage(1);
  }

  function handleWorkspaceToolbarClick(target: "patterns" | "summary" | "grid" | "focus") {
    if (target === "grid") {
      setViewMode("grid");
      return;
    }
    if (target === "focus") {
      if (!focusedCard) {
        setMessage("종목을 선택하면 포커스 차트가 표시됩니다.");
        return;
      }
      setViewMode("focus");
      return;
    }
    setWorkspaceDetailTab(target === "patterns" ? "patterns" : "summary");
    if (!focusedCard) {
      setMessage("포커스할 종목을 선택하면 상세 패널이 열립니다.");
      return;
    }
    setViewMode("focus");
  }

  function toggleDisplayOption(key: keyof PatternLabDisplayOptions) {
    setDisplayOptions((current) => ({ ...current, [key]: !current[key] }));
  }

  function buildWindowState(request: ChartWindowRequest, syncMode: PatternLabWindowSyncMode): PatternLabWindowState {
    return {
      id: createPatternLabWindowStateId(),
      createdAt: new Date().toISOString(),
      selectedStrategyId,
      selectedBacktestId,
      selectedSnapshotId,
      selectedSymbols: request.symbols,
      focusedSymbol: request.focusedSymbol ?? request.symbols[0] ?? null,
      marketFilter,
      startDate,
      endDate,
      viewMode: request.viewMode ?? (request.mode === "multi" ? "grid" : "focus"),
      activePatternId,
      draftExecutionModel,
      appliedExecutionModel,
      displayOptions: clonePatternLabDisplayOptions(displayOptions),
      draftPatterns: draftPatterns.map((pattern) => ({ ...pattern })),
      appliedPatterns: appliedPatterns.map((pattern) => ({ ...pattern })),
      draftSignalPlan: { ...draftSignalPlan },
      appliedSignalPlan: { ...appliedSignalPlan },
      syncMode,
    };
  }

  function buildWindowUrl(state: PatternLabWindowState, mode: PatternLabWindowMode) {
    const params = new URLSearchParams();
    if (state.selectedStrategyId) {
      params.set("strategyId", String(state.selectedStrategyId));
    }
    if (state.selectedBacktestId) {
      params.set("backtestId", String(state.selectedBacktestId));
    }
    if (state.selectedSnapshotId) {
      params.set("snapshotId", String(state.selectedSnapshotId));
    }
    if (state.selectedSymbols.length > 0) {
      params.set("symbols", state.selectedSymbols.join(","));
    }
    if (state.focusedSymbol) {
      params.set("focus", state.focusedSymbol);
    }
    if (state.startDate) {
      params.set("startDate", state.startDate);
    }
    if (state.endDate) {
      params.set("endDate", state.endDate);
    }
    if (state.marketFilter !== "ALL") {
      params.set("market", state.marketFilter);
    }
    params.set("view", state.viewMode);
    if (state.activePatternId) {
      params.set("activePattern", state.activePatternId);
    }
    params.set("executionModel", state.draftExecutionModel);
    params.set("windowMode", mode);
    params.set("syncMode", state.syncMode);
    params.set("popupStateId", state.id);
    params.set("display", serializePatternLabDisplayOptions(state.displayOptions));
    const enabledIds = state.draftPatterns.filter((pattern) => pattern.enabled).map((pattern) => pattern.id);
    if (enabledIds.length > 0) {
      params.set("patterns", enabledIds.join(","));
    }
    return `/pattern-lab-window?${params.toString()}`;
  }

  function openChartWindow(request: ChartWindowRequest, mode: PatternLabWindowMode, syncMode: PatternLabWindowSyncMode, features: string) {
    if (typeof window === "undefined") {
      return;
    }
    const state = buildWindowState({ ...request, mode }, syncMode);
    savePatternLabWindowState(state);
    const nextWindow = window.open(buildWindowUrl(state, mode), "_blank", features);
    if (!nextWindow) {
      setMessage("브라우저가 새 분석 창 열기를 차단했습니다. 팝업 허용 후 다시 시도하세요.");
      return;
    }
    nextWindow.focus();
  }

  function openDetachedStockWindow(symbol: string) {
    openChartWindow({ mode: "detached", symbols: [symbol], focusedSymbol: symbol }, "detached", "independent", "popup=yes,width=1720,height=1020,left=120,top=48,resizable=yes,scrollbars=yes");
  }

  function openMultiChartWindow(symbols: string[], syncMode: PatternLabWindowSyncMode = "sync") {
    if (symbols.length === 0) {
      setMessage("먼저 하나 이상의 종목을 선택하세요.");
      return;
    }
    openChartWindow({ mode: "multi", symbols, focusedSymbol: symbols[0] ?? null }, "multi", syncMode, "popup=yes,width=1820,height=1040,resizable=yes,scrollbars=yes");
  }

  async function handleRerunBacktest() {
    if (!selectedStrategyId) {
      setError("재백테스트할 전략을 먼저 선택해야 합니다.");
      return;
    }
    const parsedStartDate = Date.parse(startDate);
    const parsedEndDate = Date.parse(endDate);
    if (!Number.isFinite(parsedStartDate) || !Number.isFinite(parsedEndDate) || parsedStartDate > parsedEndDate) {
      setError("시작일과 종료일을 다시 확인해 주세요. 시작일은 종료일보다 늦을 수 없습니다.");
      return;
    }
    const universeScope = selectedBacktestSummary?.universeScope ?? backtest?.universeScope ?? undefined;
    const resolvedSnapshotId = selectedBacktestSummary?.snapshotId ?? selectedSnapshotId;
    const nextWorkspace = {
      patterns: draftPatterns,
      signalPlan: draftSignalPlan,
      updatedAt: new Date().toISOString(),
    };
    savePatternWorkspace(selectedStrategyId, nextWorkspace);
    setSubmittingBacktest(true);
    setError(null);
    try {
      const response = await runBacktest({
        strategyId: selectedStrategyId,
        startDate,
        endDate,
        snapshotId: resolvedSnapshotId,
        universeScope,
        patternDefinitions: draftPatterns,
        signalPlan: draftSignalPlan,
      });
      if (!response.jobId) {
        throw new Error(response.message || "백테스트 작업 ID를 받지 못했습니다.");
      }
      setMessage(response.message || `현재 패턴 세트로 백테스트 작업 ${response.jobId}를 등록했습니다.`);
      startTransition(() => router.push(`/backtest-results?strategyId=${selectedStrategyId}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "현재 패턴 세트로 백테스트를 다시 실행하지 못했습니다.");
    } finally {
      setSubmittingBacktest(false);
    }
  }

  function handleMoveToBacktest() {
    handleSaveWorkspace();
    startTransition(() => router.push(`/backtest-results?strategyId=${selectedStrategyId ?? ""}`));
  }

  function handleReflectToStrategy() {
    handleSaveWorkspace();
    startTransition(() => router.push(`/strategy-builder?strategyId=${selectedStrategyId ?? ""}`));
  }

  function handleMoveToExecutionCenter() {
    handleSaveWorkspace();
    startTransition(() => router.push("/strategy-execution-center"));
  }

  const marketOptions = useMemo(
    () => ["한국", "미국"].filter((market) => catalogRows.some((row) => row.market === market)),
    [catalogRows],
  );

  const visiblePatterns = useMemo(() => {
    if (patternTab === "custom") {
      return draftPatterns.filter((pattern) => pattern.source === "custom");
    }
    if (patternTab === "favorite") {
      return draftPatterns.filter((pattern) => favoritePatternIds.includes(pattern.id));
    }
    return draftPatterns.filter((pattern) => pattern.source === "preset");
  }, [draftPatterns, favoritePatternIds, patternTab]);

  const activeEditorPattern = useMemo(
    () => draftPatterns.find((pattern) => pattern.id === activePatternId) ?? null,
    [activePatternId, draftPatterns],
  );

  const chartStocks = useMemo(() => experimentResult.stocks, [experimentResult.stocks]);
  const chartStocksBySymbol = useMemo(
    () => new Map(chartStocks.map((stock) => [stock.summary.symbol, stock])),
    [chartStocks],
  );
  const orderedFilteredStocks = useMemo(
    () => filteredRows.map((row) => chartStocksBySymbol.get(row.symbol)).filter((item): item is PatternLabStockCard => Boolean(item)),
    [chartStocksBySymbol, filteredRows],
  );
  const visibleWorkspaceStocks = useMemo(() => {
    if (workspacePatternFilter === "ALL") {
      return orderedFilteredStocks;
    }
    return orderedFilteredStocks.filter((stock) => (
      stock.signals.some((signal) => signal.patternId === workspacePatternFilter)
      || stock.trades.some((trade) => trade.patternId === workspacePatternFilter)
      || stock.markers.some((marker) => marker.patternId === workspacePatternFilter)
    ));
  }, [orderedFilteredStocks, workspacePatternFilter]);
  const visibleWorkspaceSymbols = useMemo(
    () => new Set(visibleWorkspaceStocks.map((stock) => stock.summary.symbol)),
    [visibleWorkspaceStocks],
  );
  const pagedGridStocks = useMemo(() => {
    const pageSize = 12;
    return visibleWorkspaceStocks.slice(0, gridPage * pageSize);
  }, [gridPage, visibleWorkspaceStocks]);

  const focusedCard = useMemo(
    () => chartStocks.find((stock) => stock.summary.symbol === focusedSymbol) ?? chartStocks[0] ?? null,
    [chartStocks, focusedSymbol],
  );
  const focusedCardMatchesPatternFilter = useMemo(
    () => (focusedCard ? visibleWorkspaceSymbols.has(focusedCard.summary.symbol) : false),
    [focusedCard, visibleWorkspaceSymbols],
  );
  const focusFilterConflictKey = useMemo(
    () => (focusedCard && workspacePatternFilter !== "ALL" && !focusedCardMatchesPatternFilter ? `${focusedCard.summary.symbol}:${workspacePatternFilter}` : null),
    [focusedCard, focusedCardMatchesPatternFilter, workspacePatternFilter],
  );
  const showFocusFilterConflictNotice = focusFilterConflictKey != null && dismissedFocusFilterConflictKey !== focusFilterConflictKey;
  const focusNavigationStocks = useMemo(
    () => (visibleWorkspaceStocks.length > 0 ? visibleWorkspaceStocks : orderedFilteredStocks),
    [orderedFilteredStocks, visibleWorkspaceStocks],
  );
  const focusedCardIndex = useMemo(
    () => (focusedCard ? focusNavigationStocks.findIndex((stock) => stock.summary.symbol === focusedCard.summary.symbol) : -1),
    [focusNavigationStocks, focusedCard],
  );

  useEffect(() => {
    if (workspacePatternFilter === "ALL") {
      return;
    }
    if (!enabledPatternMap.has(workspacePatternFilter)) {
      setWorkspacePatternFilter("ALL");
    }
  }, [enabledPatternMap, workspacePatternFilter]);

  const focusFilterPatterns = useMemo(
    () => [
      ...draftPatterns.filter((pattern) => pattern.source === "preset"),
      ...draftPatterns.filter((pattern) => pattern.source === "custom" && pattern.enabled),
    ],
    [draftPatterns],
  );
  const workspaceFilterPattern = useMemo(
    () => focusFilterPatterns.find((pattern) => pattern.id === workspacePatternFilter) ?? enabledPatternMap.get(workspacePatternFilter) ?? null,
    [enabledPatternMap, focusFilterPatterns, workspacePatternFilter],
  );

  const filterPatternEntities = useMemo(
    () => ({
      signals: (items: PatternLabSignalRow[]) => (workspacePatternFilter === "ALL" ? items : items.filter((item) => item.patternId === workspacePatternFilter)),
      trades: (items: PatternLabTradeRow[]) => (workspacePatternFilter === "ALL" ? items : items.filter((item) => item.patternId === workspacePatternFilter)),
      markers: (items: PatternLabChartMarker[]) => (workspacePatternFilter === "ALL" ? items : items.filter((item) => item.patternId === workspacePatternFilter)),
      holdingRanges: (items: PatternLabHoldingRange[]) => (workspacePatternFilter === "ALL" ? items : items.filter((item) => item.patternId === workspacePatternFilter)),
      zones: (items: PatternLabSignalZone[]) => (workspacePatternFilter === "ALL" ? items : items.filter((item) => item.patternId === workspacePatternFilter)),
      priceLevels: (items: PatternLabPriceLevel[]) => (workspacePatternFilter === "ALL" ? items : items.filter((item) => item.patternId === workspacePatternFilter)),
    }),
    [workspacePatternFilter],
  );

  const focusedScopedSignals = useMemo(
    () => (focusedCard ? filterPatternEntities.signals(focusedCard.signals) : []),
    [filterPatternEntities, focusedCard],
  );
  const focusedScopedTrades = useMemo(
    () => (focusedCard ? filterPatternEntities.trades(focusedCard.trades) : []),
    [filterPatternEntities, focusedCard],
  );
  const focusedScopedMarkers = useMemo(
    () => (focusedCard ? filterPatternEntities.markers(focusedCard.markers) : []),
    [filterPatternEntities, focusedCard],
  );
  const focusedScopedHoldingRanges = useMemo(
    () => (focusedCard ? filterPatternEntities.holdingRanges(focusedCard.holdingRanges) : []),
    [filterPatternEntities, focusedCard],
  );
  const focusedScopedZones = useMemo(
    () => (focusedCard ? filterPatternEntities.zones(focusedCard.zones) : []),
    [filterPatternEntities, focusedCard],
  );
  const focusedScopedPriceLevels = useMemo(
    () => (focusedCard ? filterPatternEntities.priceLevels(focusedCard.priceLevels) : []),
    [filterPatternEntities, focusedCard],
  );

  const focusedLatestSignal = focusedScopedSignals[focusedScopedSignals.length - 1] ?? null;
  const focusedCurrentRecommendation = workspacePatternFilter === "ALL"
    ? focusedLatestSignal?.recommendation ?? focusedCard?.summary.currentRecommendation ?? null
    : focusedLatestSignal?.recommendation ?? null;
  const focusedCurrentState = workspacePatternFilter === "ALL"
    ? focusedLatestSignal?.signalType ?? focusedCard?.summary.currentState ?? "NONE"
    : focusedLatestSignal?.signalType ?? "NONE";
  const focusedTradeReturns = useMemo(
    () => focusedScopedTrades.map((trade) => resolveTradeReturnPercent(trade)),
    [focusedScopedTrades],
  );
  const focusedBestTradeReturn = focusedTradeReturns.length > 0 ? Math.max(...focusedTradeReturns) : null;
  const focusedAverageTradeReturn = focusedTradeReturns.length > 0 ? focusedTradeReturns.reduce((sum, value) => sum + value, 0) / focusedTradeReturns.length : null;
  const focusedCompoundedReturn = calculateCompoundedReturn(focusedTradeReturns);
  const focusedWinRate = focusedTradeReturns.length > 0 ? (focusedTradeReturns.filter((value) => value > 0).length / focusedTradeReturns.length) * 100 : null;

  const focusedPatternPerformance = useMemo<FocusPatternPerformanceRow[]>(() => {
    if (!focusedCard) {
      return [];
    }

    const patternUniverse = workspacePatternFilter === "ALL"
      ? focusFilterPatterns
      : focusFilterPatterns.filter((pattern) => pattern.id === workspacePatternFilter);

    return patternUniverse
      .map((pattern) => {
        const signals = focusedCard.signals.filter((signal) => signal.patternId === pattern.id);
        const trades = focusedCard.trades.filter((trade) => trade.patternId === pattern.id);
        const returns = trades.map((trade) => resolveTradeReturnPercent(trade));
        const latestSignal = signals[signals.length - 1] ?? null;
        const lastBuyDate = [...signals].reverse().find((signal) => signal.signalType === "BUY")?.signalDate ?? null;
        const lastSellDate = [...signals].reverse().find((signal) => signal.signalType === "SELL")?.signalDate ?? null;
        const compoundedReturn = calculateCompoundedReturn(returns);
        const averageReturn = returns.length > 0 ? returns.reduce((sum, value) => sum + value, 0) / returns.length : null;
        const bestReturn = returns.length > 0 ? Math.max(...returns) : null;
        const winRate = returns.length > 0 ? (returns.filter((value) => value > 0).length / returns.length) * 100 : null;

        return {
          patternId: pattern.id,
          patternName: pattern.name,
          shortLabel: pattern.shortLabel,
          signalCount: signals.length,
          tradeCount: trades.length,
          latestSignalType: latestSignal?.signalType ?? "NONE",
          latestSignalDate: latestSignal?.signalDate ?? null,
          averageReturn,
          bestReturn,
          compoundedReturn,
          winRate,
          buyCount: signals.filter((signal) => signal.signalType === "BUY").length,
          sellCount: signals.filter((signal) => signal.signalType === "SELL").length,
          holdCount: signals.filter((signal) => signal.signalType === "HOLD").length,
          lastBuyDate,
          lastSellDate,
        };
      })
      .sort((left, right) => {
        const rightBest = right.bestReturn ?? Number.NEGATIVE_INFINITY;
        const leftBest = left.bestReturn ?? Number.NEGATIVE_INFINITY;
        if (rightBest !== leftBest) {
          return rightBest - leftBest;
        }
        return (right.latestSignalDate ?? "").localeCompare(left.latestSignalDate ?? "");
      });
  }, [focusFilterPatterns, focusedCard, workspacePatternFilter]);

  const focusedBestPatternRow = focusedPatternPerformance[0] ?? null;

  const focusedTimeline = useMemo(() => {
    if (!focusedCard) {
      return [];
    }
    return [
      ...focusedScopedSignals.slice(-5).map((signal) => ({
        date: signal.signalDate,
        type: signal.signalType,
        label: `${signal.patternName} · ${signal.signalType}`,
      })),
      ...(backtest?.signalTimeline ?? [])
        .filter((item) => item.symbol === focusedCard.summary.symbol && (workspacePatternFilter === "ALL" || item.pattern === workspaceFilterPattern?.name))
        .slice(-3)
        .map((item) => ({
          date: item.date,
          type: item.signal,
          label: `${item.pattern ?? "리밸런싱"} · ${item.signal}`,
        })),
    ]
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 8);
  }, [backtest?.signalTimeline, focusedCard, focusedScopedSignals, workspaceFilterPattern?.name, workspacePatternFilter]);

  const activeChartSignalCount = useMemo(
    () => visibleWorkspaceStocks.reduce((sum, stock) => sum + filterPatternEntities.markers(stock.markers).length, 0),
    [filterPatternEntities, visibleWorkspaceStocks],
  );
  const workspaceContextPattern = useMemo(
    () => (workspacePatternFilter === "ALL" ? activeEditorPattern : workspaceFilterPattern ?? activeEditorPattern),
    [activeEditorPattern, workspaceFilterPattern, workspacePatternFilter],
  );
  const workspaceModeHelpText = useMemo(() => {
    if (viewMode === "grid") {
      return "여러 종목을 빠르게 비교";
    }
    return workspaceDetailTab === "patterns" ? "선택한 종목 상세 분석 · 패턴 중심" : "선택한 종목 상세 분석 · 요약 중심";
  }, [viewMode, workspaceDetailTab]);
  const previousFocusStock = focusedCardIndex > 0 ? focusNavigationStocks[focusedCardIndex - 1] : null;
  const nextFocusStock = focusedCardIndex >= 0 && focusedCardIndex < focusNavigationStocks.length - 1 ? focusNavigationStocks[focusedCardIndex + 1] : null;

  useEffect(() => {
    setGridPage(1);
  }, [marketFilter, searchQuery, sectorFilter, signalFilter, sortKey, workspacePatternFilter]);

  useEffect(() => {
    setDismissedFocusFilterConflictKey(null);
  }, [focusedSymbol, workspacePatternFilter]);

  useEffect(() => {
    if (typeof window === "undefined" || standalone) {
      return;
    }
    const syncState: PatternLabWindowState = {
      id: "main-pattern-lab",
      createdAt: new Date().toISOString(),
      selectedStrategyId,
      selectedBacktestId,
      selectedSnapshotId,
      selectedSymbols,
      focusedSymbol: focusedSymbol ?? selectedSymbols[0] ?? null,
      marketFilter,
      startDate,
      endDate,
      viewMode,
      activePatternId,
      draftExecutionModel,
      appliedExecutionModel,
      displayOptions: clonePatternLabDisplayOptions(displayOptions),
      draftPatterns: draftPatterns.map((pattern) => ({ ...pattern })),
      appliedPatterns: appliedPatterns.map((pattern) => ({ ...pattern })),
      draftSignalPlan: { ...draftSignalPlan },
      appliedSignalPlan: { ...appliedSignalPlan },
      syncMode: "sync",
    };
    const channel = new BroadcastChannel(PATTERN_LAB_WINDOW_SYNC_CHANNEL);
    channel.postMessage(syncState);
    return () => channel.close();
  }, [
    activePatternId,
    appliedExecutionModel,
    appliedPatterns,
    appliedSignalPlan,
    displayOptions,
    draftExecutionModel,
    draftPatterns,
    draftSignalPlan,
    endDate,
    focusedSymbol,
    marketFilter,
    selectedBacktestId,
    selectedSnapshotId,
    selectedStrategyId,
    selectedSymbols,
    standalone,
    startDate,
    viewMode,
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || !standalone) {
      return;
    }
    const channel = new BroadcastChannel(PATTERN_LAB_WINDOW_SYNC_CHANNEL);
    channel.onmessage = (event) => {
      if (windowSyncMode !== "sync") {
        return;
      }
      const nextState = event.data as PatternLabWindowState | null;
      if (!nextState) {
        return;
      }
      applyWindowState({
        ...nextState,
        viewMode: windowMode === "multi" ? "grid" : nextState.viewMode,
        syncMode: windowSyncMode,
      });
    };
    return () => channel.close();
  }, [standalone, windowMode, windowSyncMode]);

  useEffect(() => {
    if (typeof document === "undefined" || !standalone) {
      return;
    }
    document.title = buildPatternLabWindowTitle({
      mode: windowMode,
      stockName: focusedCard?.summary.name ?? null,
      symbol: focusedCard?.summary.symbol ?? null,
    });
  }, [focusedCard?.summary.name, focusedCard?.summary.symbol, standalone, windowMode]);

  const standaloneStocks = useMemo(() => {
    const symbols = selectedSymbols.length > 0 ? selectedSymbols : chartStocks.map((stock) => stock.summary.symbol);
    const scopedStocks = chartStocks.filter((stock) => symbols.includes(stock.summary.symbol));
    if (windowMode === "multi" || viewMode === "grid") {
      return scopedStocks;
    }
    return focusedCard ? [focusedCard] : scopedStocks.slice(0, 1);
  }, [chartStocks, focusedCard, selectedSymbols, viewMode, windowMode]);

  if (standalone) {
    return (
      <PatternLabPopupWorkspace
        mode={windowMode}
        syncMode={windowSyncMode}
        viewMode={windowMode === "multi" ? "grid" : viewMode}
        focusedCard={focusedCard}
        stocks={standaloneStocks}
        displayOptions={displayOptions}
        enabledPatterns={draftPatterns}
        onToggleSync={() => setWindowSyncMode((current) => (current === "sync" ? "independent" : "sync"))}
        onToggleDisplayOption={toggleDisplayOption}
        onTogglePattern={togglePattern}
        onFocusSymbol={setFocusedSymbol}
        onSetViewMode={setViewMode}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="선택 종목 수" value={String(selectedSymbols.length)} change={`${availableSymbols.length}개 후보 중`} accent="kpi" />
        <MetricCard label="선택 패턴 수" value={String(enabledDraftPatterns.length)} change={isDirty ? "미적용 변경 있음" : "현재 적용 상태"} accent="buy" />
        <MetricCard label="총 거래 수" value={String(summaryMetrics.tradeCount)} change={selectedBacktestLabel} accent="default" />
        <MetricCard label="평균 승률" value={formatPercent(summaryMetrics.winRate)} change={experimentResult.bestPattern?.name ?? "활성 패턴 없음"} accent="buy" />
        <MetricCard label="평균 수익률" value={formatPercent(summaryMetrics.averageReturn)} change={experimentResult.bestStock?.symbol ?? "대표 종목 없음"} accent="kpi" />
        <MetricCard label="누적 수익률" value={formatPercent(summaryMetrics.cumulativeReturn)} change="선택 종목 합산 기준" accent="kpi" />
        <MetricCard label="최대 낙폭" value={formatPercent(summaryMetrics.maxDrawdown)} change="선택 종목 중 최저값" accent="default" />
        <MetricCard label="현재 BUY 신호 수" value={String(summaryMetrics.buyCount)} change="활성 신호" accent="buy" />
        <MetricCard label="현재 HOLD 종목 수" value={String(summaryMetrics.holdCount)} change="보유 구간" accent="default" />
        <MetricCard label="현재 SELL 후보 수" value={String(summaryMetrics.sellCount)} change="청산/교체 후보" accent="default" />
      </section>

      <DashboardCard title="패턴 실험실" subtitle="백테스트로 선별된 종목에 여러 패턴을 적용하여 차트 기반 매수/매도 타이밍과 권장 가격, 종목별·패턴별 성과를 검증합니다.">
        <div className="grid gap-3 xl:grid-cols-[1fr_1fr_1fr_0.9fr_0.8fr_0.8fr_auto] xl:items-end">
          <label className="space-y-2 text-[12px] font-semibold text-[color:var(--fg)]">
            <span>전략 선택</span>
            <select value={selectedStrategyId ?? ""} onChange={(event) => setSelectedStrategyId(event.target.value ? Number(event.target.value) : null)} className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium">
              {strategies.map((strategy) => (
                <option key={strategy.strategyId} value={strategy.strategyId}>{strategy.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-[12px] font-semibold text-[color:var(--fg)]">
            <span>백테스트 결과</span>
            <select value={selectedBacktestId ?? ""} onChange={(event) => setSelectedBacktestId(event.target.value ? Number(event.target.value) : null)} className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium">
              {history.length === 0 || (selectedBacktestId != null && !history.some((item) => item.backtestId === selectedBacktestId)) ? (
                <option value={selectedBacktestId ?? ""}>{selectedBacktestSelectPlaceholder}</option>
              ) : null}
              {history.map((item) => (
                <option key={item.backtestId} value={item.backtestId}>#{item.backtestId} · {item.snapshotName ?? "현재 전략"}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-[12px] font-semibold text-[color:var(--fg)]">
            <span>가중치 스냅샷</span>
            <select value={selectedSnapshotId ?? ""} onChange={(event) => setSelectedSnapshotId(event.target.value ? Number(event.target.value) : null)} className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium">
              <option value="">현재 전략</option>
              {snapshots.map((snapshot) => (
                <option key={snapshot.snapshotId} value={snapshot.snapshotId}>{snapshot.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-[12px] font-semibold text-[color:var(--fg)]">
            <span>시장 선택</span>
            <select value={marketFilter} onChange={(event) => setMarketFilter(event.target.value)} className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium">
              <option value="ALL">전체</option>
              {marketOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-[12px] font-semibold text-[color:var(--fg)]">
            <span>시작일</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium" />
          </label>
          <label className="space-y-2 text-[12px] font-semibold text-[color:var(--fg)]">
            <span>종료일</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium" />
          </label>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton label={isDirty ? "재실행" : "재실행"} onClick={applyExperiment} disabled={!isDirty && experimentResult.stocks.length > 0} />
            <SecondaryButton label="패턴 저장" onClick={handleSaveWorkspace} icon="plus" />
            <SecondaryButton label={submittingBacktest ? "재백테스트 등록 중" : "현재 패턴으로 재백테스트"} onClick={handleRerunBacktest} icon="backtest" disabled={submittingBacktest || isRouting} />
            <SecondaryButton label="전략에 반영" onClick={handleReflectToStrategy} icon="link" disabled={isRouting} />
            <SecondaryButton label="스냅샷 저장" onClick={handleSaveSnapshot} icon="plus" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[color:var(--fg-muted)]">
          <span className="rounded-full border border-[color:var(--line)] px-2 py-1">선택 종목 {selectedSymbols.length}개</span>
          <span className="rounded-full border border-[color:var(--line)] px-2 py-1">선택 패턴 {enabledDraftPatterns.length}개</span>
          <span className="rounded-full border border-[color:var(--line)] px-2 py-1">대상 범위 {activeUniverseLabel}</span>
          <span className="rounded-full border border-[color:var(--line)] px-2 py-1">{selectedBacktestLabel}</span>
          <span className="rounded-full border border-[color:var(--line)] px-2 py-1">{selectedSnapshotId ? `스냅샷 ${selectedSnapshotId}` : "현재 전략 가중치"}</span>
        </div>
      </DashboardCard>

      {message ? <StatusNotice title="패턴 실험실 알림" description={message} /> : null}
      {error ? <StatusNotice title="패턴 실험실 데이터 오류" description={error} /> : null}
      {comparisonBanner ? (
        <StatusNotice
          title="변경 전/후 비교"
          description={`이전 승률 ${formatPercent(comparisonBanner.previousWinRate)} → 현재 승률 ${formatPercent(comparisonBanner.currentWinRate)} / 이전 평균 수익률 ${formatPercent(comparisonBanner.previousAverageReturn)} → 현재 평균 수익률 ${formatPercent(comparisonBanner.currentAverageReturn)}`}
        />
      ) : null}
      {loadingHistory || loadingBacktest || loadingStocks ? (
        <StatusNotice
          title="패턴 실험실 데이터 로딩 중"
          description={`전략 ${loadingHistory ? "목록" : ""}${loadingBacktest ? " / 백테스트" : ""}${loadingStocks ? " / 종목 차트" : ""} 데이터를 가져오는 중입니다.`}
        />
      ) : null}
      {isApplying ? (
        <StatusNotice title="계산 중" description="선택한 패턴과 종목 기준으로 신호와 추천 가격을 계산하는 중입니다." />
      ) : null}

      <DashboardCard
        title="패턴 실험 워크스페이스"
        subtitle="멀티 종목 비교 후 한 종목을 크게 포커스하고, 상단 패턴 필터로 차트 오버레이와 패턴별 수익률·날짜별 BUY/SELL 로그를 바로 읽는 구조로 정리했습니다."
      >
        <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-[color:rgba(15,23,42,0.08)] bg-[#f7f9fc] p-3">
          <button
            type="button"
            onClick={() => setWorkspacePatternFilter("ALL")}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${workspacePatternFilter === "ALL" ? "border-black bg-black text-white" : "border-[color:var(--line)] bg-white text-[color:var(--fg-muted)]"}`}
          >
            전체 패턴
          </button>
          {focusFilterPatterns.map((pattern) => (
            <button
              key={`workspace-pattern-${pattern.id}`}
              type="button"
              onClick={() => {
                setWorkspacePatternFilter(pattern.id);
                setActivePatternId(pattern.id);
              }}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${workspacePatternFilter === pattern.id ? "border-black bg-black text-white" : "border-[color:var(--line)] bg-white text-[color:var(--fg-muted)]"}`}
            >
              {pattern.shortLabel} {pattern.name}
            </button>
          ))}
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[color:var(--line)] bg-white px-3 py-3">
            <p className="text-[11px] text-[color:var(--fg-muted)]">현재 포커스 필터</p>
            <p className="mt-2 text-[16px] font-semibold text-[color:var(--fg)]">
              {workspacePatternFilter === "ALL" ? "전체 패턴" : workspaceFilterPattern?.name ?? workspacePatternFilter}
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">차트, 포커스 KPI, 패턴 로그에 동시에 적용됩니다.</p>
          </div>
          <div className="rounded-xl border border-[color:var(--line)] bg-white px-3 py-3">
            <p className="text-[11px] text-[color:var(--fg-muted)]">백테스트 기준 수익률</p>
            <p className={`mt-2 text-[16px] font-semibold ${percentTextClass(focusedCard?.summary.backtestReturnPercent)}`}>
              {focusedCard ? formatPercent(focusedCard.summary.backtestReturnPercent) : "-"}
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">전략 선별 단계에서 기록한 종목 기준 수익률입니다.</p>
          </div>
          <div className="rounded-xl border border-[color:var(--line)] bg-white px-3 py-3">
            <p className="text-[11px] text-[color:var(--fg-muted)]">패턴 최고 거래 수익률</p>
            <p className={`mt-2 text-[16px] font-semibold ${percentTextClass(focusedBestTradeReturn)}`}>
              {focusedBestTradeReturn == null ? "-" : formatPercent(focusedBestTradeReturn)}
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">
              {focusedBestPatternRow ? `${focusedBestPatternRow.patternName} · 최근 ${focusedBestPatternRow.latestSignalDate ?? "-"}` : "포커스 종목 신호 없음"}
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--line)] bg-white px-3 py-3">
            <p className="text-[11px] text-[color:var(--fg-muted)]">패턴 누적/평균 수익률</p>
            <p className={`mt-2 text-[16px] font-semibold ${percentTextClass(focusedCompoundedReturn)}`}>
              {focusedCompoundedReturn == null ? "-" : formatPercent(focusedCompoundedReturn)}
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">
              평균 {focusedAverageTradeReturn == null ? "-" : formatPercent(focusedAverageTradeReturn)} · 승률 {focusedWinRate == null ? "-" : formatPercent(focusedWinRate)}
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <WorkPanel
            title="상단 액션 / 상태 바"
            subtitle="패턴·요약·그리드·포커스 전환과 팝업/멀티차트 액션, 종목 필터를 한 곳에 모아 compare → select → inspect 흐름을 빠르게 만듭니다."
          >
            <div className="space-y-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-[color:rgba(15,23,42,0.08)] bg-[#f7f9fc] p-1">
                    <WorkspaceToolbarButton label="패턴" active={viewMode === "focus" && workspaceDetailTab === "patterns"} disabled={!focusedCard} onClick={() => handleWorkspaceToolbarClick("patterns")} />
                    <WorkspaceToolbarButton label="요약 내용" active={viewMode === "focus" && workspaceDetailTab === "summary"} disabled={!focusedCard} onClick={() => handleWorkspaceToolbarClick("summary")} />
                    <WorkspaceToolbarButton label="그리드" active={viewMode === "grid"} onClick={() => handleWorkspaceToolbarClick("grid")} />
                    <WorkspaceToolbarButton label="포커스" active={viewMode === "focus"} disabled={!focusedCard} onClick={() => handleWorkspaceToolbarClick("focus")} />
                  </div>
                  <span className="rounded-full border border-[color:var(--line)] bg-[#fbfcfe] px-3 py-1 text-[11px] font-medium text-[color:var(--fg-muted)]">
                    {workspaceModeHelpText}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <SecondaryButton label="현재 차트 팝업으로 열기" icon="window" onClick={() => focusedCard ? openDetachedStockWindow(focusedCard.summary.symbol) : undefined} disabled={!focusedCard} />
                  <SecondaryButton label="전체 팝업으로 열기" icon="window" onClick={() => openMultiChartWindow(visibleWorkspaceStocks.map((stock) => stock.summary.symbol), "independent")} disabled={visibleWorkspaceStocks.length === 0} />
                  <SecondaryButton label="선택 종목 멀티 차트 보기" icon="comparison" onClick={() => openMultiChartWindow(selectedSymbols, "independent")} disabled={selectedSymbols.length === 0} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(Object.keys(displayOptions) as Array<keyof PatternLabDisplayOptions>).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleDisplayOption(key)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${displayOptions[key] ? "border-[color:var(--kpi)] bg-[rgba(21,94,239,0.08)] text-[color:var(--kpi)]" : "border-[color:var(--line)] bg-white text-[color:var(--fg-muted)]"}`}
                    aria-pressed={displayOptions[key]}
                  >
                    {{
                      showMovingAverage: "이평선",
                      showVolume: "거래량",
                      showSignalZones: "BUY/SELL/HOLD/감지 구간",
                      showHoldingRanges: "HOLD 강조",
                      showPriceLevels: "권장 가격선",
                      showPatternLegend: "패턴 범례",
                    }[key]}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_auto] xl:items-center">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="종목명, 코드 검색"
                  className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium"
                  aria-label="종목명, 코드 검색"
                />
                <select value={marketFilter} onChange={(event) => setMarketFilter(event.target.value)} className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium" aria-label="시장 필터">
                  <option value="ALL">전체</option>
                  {marketOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <select value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)} className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium" aria-label="섹터 필터">
                  <option value="ALL">전체 섹터</option>
                  {sectors.map((sector) => (
                    <option key={sector} value={sector}>{sector}</option>
                  ))}
                </select>
                <select value={signalFilter} onChange={(event) => setSignalFilter(event.target.value as PatternLabSignalType | "ALL")} className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium" aria-label="신호 필터">
                  <option value="ALL">전체 신호</option>
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                  <option value="HOLD">HOLD</option>
                  <option value="NONE">NONE</option>
                </select>
                <select value={sortKey} onChange={(event) => setSortKey(event.target.value as typeof sortKey)} className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium" aria-label="정렬 옵션">
                  <option value="return">수익률 순</option>
                  <option value="score">점수 순</option>
                  <option value="signalDate">최근 신호일 순</option>
                  <option value="volume">거래량 순</option>
                  <option value="price">현재가 순</option>
                </select>
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <SecondaryButton label="보이는 종목 선택" onClick={selectVisibleSymbols} />
                  <SecondaryButton label="선택 해제" onClick={clearSelection} disabled={selectedSymbols.length === 0} />
                  <SecondaryButton label="필터 초기화" onClick={resetWorkspaceFilters} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] text-[color:var(--fg-muted)]">
                <span className="rounded-full border border-[color:var(--line)] bg-white px-2.5 py-1">표시 후보 {filteredRows.length}개</span>
                <span className="rounded-full border border-[color:var(--line)] bg-white px-2.5 py-1">그리드 표시 {visibleWorkspaceStocks.length}개</span>
                <span className="rounded-full border border-[color:var(--line)] bg-white px-2.5 py-1">선택 종목 {selectedSymbols.length}개</span>
                <span className="rounded-full border border-[color:var(--line)] bg-white px-2.5 py-1">활성 신호 {activeChartSignalCount}건</span>
                <span className="rounded-full border border-[color:var(--line)] bg-white px-2.5 py-1">포커스 {focusedCard?.summary.symbol ?? "-"}</span>
              </div>
            </div>
          </WorkPanel>

        <div className="space-y-6">
          <WorkPanel
            title="마스터-디테일 차트 영역"
            subtitle="기본은 카드 그리드 탐색이며, 카드 클릭 시 같은 본문 영역을 포커스 분석 화면으로 전환합니다."
          >
            {enabledDraftPatterns.length > 0 ? (
              <div className="mb-4 rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[11px] text-[color:var(--fg-muted)]">
                현재 차트 오버레이: <span className="font-semibold text-[color:var(--fg)]">활성 패턴 {enabledDraftPatterns.length}개 동시 적용</span>
                {workspaceContextPattern ? (
                  <span> · 기준 패턴 <span className="font-semibold text-[color:var(--fg)]">{workspaceContextPattern.name}</span></span>
                ) : null}
              </div>
            ) : null}
            {enabledDraftPatterns.length > 0 && activeChartSignalCount === 0 ? (
              <div className="mb-4 rounded-md border border-[rgba(216,95,75,0.18)] bg-[rgba(216,95,75,0.06)] px-3 py-2 text-[11px] text-[color:var(--fg-muted)]">
                현재 활성화된 패턴 조합으로는 선택 종목 구간 내 매수/매도 신호가 생성되지 않았습니다. 차트가 비어 있는 이유가 UI 누락인지, 실제 신호 0건인지 이 메시지로 구분할 수 있습니다.
              </div>
            ) : null}
            {selectedSymbols.length === 0 ? (
              <StatusNotice title="선택된 종목이 없습니다." description="백테스트 결과에서 실험할 종목을 선택해 주세요." />
            ) : enabledDraftPatterns.length === 0 ? (
              <div className="space-y-3">
                <StatusNotice title="패턴을 선택하면 차트에 매수/매도 구간과 추천 가격이 표시됩니다." description="빠른 선택으로 Liquidity Sweep Reversal과 Imbalance Pullback Continuation을 바로 켤 수 있습니다." />
                <div className="flex flex-wrap gap-2">
                  {["liquidity-sweep-reversal", "imbalance-pullback-continuation"].map((patternId) => (
                    <SecondaryButton
                      key={patternId}
                      label={draftPatterns.find((pattern) => pattern.id === patternId)?.name ?? patternId}
                      onClick={() => togglePattern(patternId)}
                    />
                  ))}
                </div>
              </div>
            ) : experimentResult.stocks.length > 0 ? (
              viewMode === "grid" ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[13px] font-semibold text-[color:var(--fg)]">카드형 차트 그리드</p>
                      <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">여러 종목을 빠르게 비교하고, 카드를 클릭하면 같은 본문 영역을 포커스 화면으로 전환합니다.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-[color:var(--fg-muted)]">
                      <span className="rounded-full border border-[color:var(--line)] px-2.5 py-1">현재 모드 그리드</span>
                      <span className="rounded-full border border-[color:var(--line)] px-2.5 py-1">패턴 필터 {workspacePatternFilter === "ALL" ? "전체" : workspaceFilterPattern?.shortLabel ?? workspacePatternFilter}</span>
                    </div>
                  </div>
                  {visibleWorkspaceStocks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[color:rgba(15,23,42,0.14)] bg-[#fbfcfe] px-6 py-8">
                      <StatusNotice
                        title={workspacePatternFilter === "ALL" ? "표시할 종목이 없습니다." : "선택한 패턴에 해당하는 종목이 없습니다."}
                        description={workspacePatternFilter === "ALL" ? "검색/시장/섹터/신호 필터를 조정하거나 보이는 종목 선택으로 실험 대상을 추가해 주세요." : "현재 패턴 필터와 일치하는 종목이 없습니다. 패턴 필터를 바꾸거나 필터를 초기화해 보세요."}
                      />
                      <div className="mt-4 flex flex-wrap gap-2">
                        <SecondaryButton label="필터 초기화" onClick={resetWorkspaceFilters} />
                        <SecondaryButton label="보이는 종목 선택" onClick={selectVisibleSymbols} />
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* TODO: 카드 수가 커지면 server-filtered symbol set 또는 windowed grid로 교체합니다. */}
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {pagedGridStocks.map((stock) => {
                          const scopedSignals = filterPatternEntities.signals(stock.signals);
                          const scopedTrades = filterPatternEntities.trades(stock.trades);
                          const scopedMarkers = filterPatternEntities.markers(stock.markers);
                          const scopedHoldingRanges = filterPatternEntities.holdingRanges(stock.holdingRanges);
                          const scopedZones = filterPatternEntities.zones(stock.zones);
                          const scopedPriceLevels = filterPatternEntities.priceLevels(stock.priceLevels);
                          const latestSignal = scopedSignals[scopedSignals.length - 1] ?? null;
                          const latestRecommendation = workspacePatternFilter === "ALL"
                            ? latestSignal?.recommendation ?? stock.summary.currentRecommendation
                            : latestSignal?.recommendation ?? null;
                          const latestTrade = scopedTrades[scopedTrades.length - 1] ?? null;
                          const scopedCurrentState = workspacePatternFilter === "ALL"
                            ? latestSignal?.signalType ?? stock.summary.currentState
                            : latestSignal?.signalType ?? "NONE";

                          return (
                            <WorkspaceChartCard
                              key={stock.summary.symbol}
                              stock={stock}
                              checked={selectedSymbols.includes(stock.summary.symbol)}
                              focused={focusedSymbol === stock.summary.symbol}
                              currentState={scopedCurrentState}
                              latestSignal={latestSignal}
                              latestRecommendation={latestRecommendation}
                              latestTrade={latestTrade}
                              scopedSignals={scopedSignals}
                              scopedTrades={scopedTrades}
                              scopedMarkers={scopedMarkers}
                              scopedHoldingRanges={scopedHoldingRanges}
                              scopedZones={scopedZones}
                              scopedPriceLevels={scopedPriceLevels}
                              displayOptions={displayOptions}
                              workspacePatternFilter={workspacePatternFilter}
                              enabledPatternMap={enabledPatternMap}
                              onFocus={() => {
                                focusSymbol(stock.summary.symbol);
                                setViewMode("focus");
                              }}
                              onToggleSelect={() => toggleSymbol(stock.summary.symbol)}
                              onOpenPopup={() => openDetachedStockWindow(stock.summary.symbol)}
                            />
                          );
                        })}
                      </div>
                      {visibleWorkspaceStocks.length > pagedGridStocks.length ? (
                        <div className="flex justify-center">
                          <SecondaryButton label="차트 더 보기" onClick={() => setGridPage((current) => current + 1)} />
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ) : focusedCard ? (
                <div className="space-y-4">
                  {showFocusFilterConflictNotice ? (
                    <div className="rounded-xl border border-[rgba(217,119,6,0.2)] bg-[rgba(217,119,6,0.08)] px-4 py-3 text-[12px] text-[color:var(--fg)]">
                      <p className="font-semibold">현재 포커스 종목은 새 필터 조건과 일치하지 않습니다.</p>
                      <p className="mt-1 text-[color:var(--fg-muted)]">포커스를 유지하거나, 현재 필터 결과에 맞는 종목으로 즉시 전환할 수 있습니다.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <SecondaryButton
                          label="포커스 유지"
                          onClick={() => {
                            if (focusFilterConflictKey) {
                              setDismissedFocusFilterConflictKey(focusFilterConflictKey);
                            }
                          }}
                        />
                        <SecondaryButton
                          label="필터 결과 종목으로 전환"
                          onClick={() => {
                            const nextStock = visibleWorkspaceStocks[0];
                            if (!nextStock) {
                              return;
                            }
                            focusSymbol(nextStock.summary.symbol);
                            setViewMode("focus");
                          }}
                          disabled={visibleWorkspaceStocks.length === 0}
                        />
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-3 rounded-xl border border-[color:rgba(15,23,42,0.08)] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)] lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <SecondaryButton label="그리드로 돌아가기" onClick={() => setViewMode("grid")} />
                      <span className="rounded-full border border-[color:var(--line)] bg-[#fbfcfe] px-3 py-1 text-[11px] font-medium text-[color:var(--fg-muted)]">
                        {focusedCard.summary.name} · {focusedCard.summary.symbol}
                      </span>
                      <span className="rounded-full border border-[color:var(--line)] bg-[#fbfcfe] px-3 py-1 text-[11px] font-medium text-[color:var(--fg-muted)]">
                        {workspaceDetailTab === "patterns" ? "패턴 중심" : "요약 중심"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => previousFocusStock && focusSymbol(previousFocusStock.summary.symbol)}
                        disabled={!previousFocusStock}
                        className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-semibold text-[color:var(--fg)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Icon name="arrowLeft" className="h-3.5 w-3.5" />
                        이전 종목
                      </button>
                      <button
                        type="button"
                        onClick={() => nextFocusStock && focusSymbol(nextFocusStock.summary.symbol)}
                        disabled={!nextFocusStock}
                        className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-semibold text-[color:var(--fg)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        다음 종목
                        <Icon name="arrowRight" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
                    <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                      <p className="text-[11px] text-[color:var(--fg-muted)]">포커스 종목</p>
                      <p className="mt-2 text-[18px] font-semibold text-[color:var(--fg)]">{focusedCard.summary.name}</p>
                      <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{focusedCard.summary.symbol} · {focusedCard.summary.market}</p>
                    </div>
                    <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                      <p className="text-[11px] text-[color:var(--fg-muted)]">현재 상태</p>
                      <div className="mt-2"><SignalBadge label={focusedCurrentState} tone={getSignalTone(focusedCurrentState)} /></div>
                      <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{focusedLatestSignal ? `${focusedLatestSignal.patternName} · ${focusedLatestSignal.signalType}` : focusedCard.summary.recentPatternSignal}</p>
                    </div>
                    <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                      <p className="text-[11px] text-[color:var(--fg-muted)]">백테스트 기준 수익률</p>
                      <p className={`mt-2 text-[18px] font-semibold ${percentTextClass(focusedCard.summary.backtestReturnPercent)}`}>{formatPercent(focusedCard.summary.backtestReturnPercent)}</p>
                      <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">
                        전략 선별 단계 기준
                      </p>
                    </div>
                    <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                      <p className="text-[11px] text-[color:var(--fg-muted)]">패턴 최고 거래 수익률</p>
                      <p className={`mt-2 text-[18px] font-semibold ${percentTextClass(focusedBestTradeReturn)}`}>
                        {focusedBestTradeReturn == null ? "-" : formatPercent(focusedBestTradeReturn)}
                      </p>
                      <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">
                        최고 패턴 {focusedBestPatternRow?.shortLabel ?? "-"}
                      </p>
                    </div>
                    <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                      <p className="text-[11px] text-[color:var(--fg-muted)]">권장 매수가 / 권장 매도가</p>
                      <p className="mt-2 text-[18px] font-semibold text-[color:var(--buy)]">
                        {focusedCurrentRecommendation ? `${formatPrice(focusedCurrentRecommendation.entryRangeLow)} ~ ${formatPrice(focusedCurrentRecommendation.entryRangeHigh)}` : "-"}
                      </p>
                      <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">
                        권장 {focusedCurrentRecommendation ? formatPrice(focusedCurrentRecommendation.recommendedSellPrice) : "-"}
                      </p>
                    </div>
                    <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                      <p className="text-[11px] text-[color:var(--fg-muted)]">패턴 누적 / 평균 수익률</p>
                      <p className={`mt-2 text-[18px] font-semibold ${percentTextClass(focusedCompoundedReturn)}`}>
                        {focusedCompoundedReturn == null ? "-" : formatPercent(focusedCompoundedReturn)}
                      </p>
                      <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">
                        평균 {focusedAverageTradeReturn == null ? "-" : formatPercent(focusedAverageTradeReturn)} · 승률 {focusedWinRate == null ? "-" : formatPercent(focusedWinRate)}
                      </p>
                    </div>
                  </div>
                  <PatternLabChart
                    title={`${focusedCard.summary.name} 포커스 차트`}
                    subtitle={`${workspacePatternFilter === "ALL" ? `활성 패턴 ${focusedCard.summary.selectedPatternCount}개 동시 오버레이` : `${workspaceFilterPattern?.name ?? workspacePatternFilter} 필터 적용`} · 최고 거래 수익률 ${focusedBestTradeReturn == null ? "-" : formatPercent(focusedBestTradeReturn)}`}
                    candles={focusedCard.candles}
                    markers={focusedScopedMarkers}
                    holdingRanges={focusedScopedHoldingRanges}
                    zones={focusedScopedZones}
                    priceLevels={focusedScopedPriceLevels}
                    showMovingAverage={displayOptions.showMovingAverage}
                    showVolume={displayOptions.showVolume}
                    showSignalZones={displayOptions.showSignalZones}
                    showHoldingRanges={displayOptions.showHoldingRanges}
                    showPriceLevels={displayOptions.showPriceLevels}
                    showPatternLegend={displayOptions.showPatternLegend}
                  />

                  <div className="grid gap-3 xl:grid-cols-2">
                    <div className={`rounded-md border bg-white px-3 py-3 text-[12px] text-[color:var(--fg-muted)] ${workspaceDetailTab === "summary" ? "border-[rgba(21,94,239,0.22)] shadow-[0_10px_22px_rgba(21,94,239,0.08)]" : "border-[color:var(--line)]"}`}>
                      <p className="font-semibold text-[color:var(--fg)]">추천 가격 요약</p>
                      {focusedCurrentRecommendation ? (
                        <div className="mt-2 space-y-1">
                          <p>트리거 가격 {formatPrice(focusedCurrentRecommendation.triggerPrice)}</p>
                          <p>진입 허용 범위 {formatPrice(focusedCurrentRecommendation.entryRangeLow)} ~ {formatPrice(focusedCurrentRecommendation.entryRangeHigh)}</p>
                          <p>손절가 {formatPrice(focusedCurrentRecommendation.stopPrice)} / 트레일링 스탑 {formatPrice(focusedCurrentRecommendation.trailingStopPrice)}</p>
                          <p>1차 목표가 {formatPrice(focusedCurrentRecommendation.targetPrice1)} / 2차 목표가 {formatPrice(focusedCurrentRecommendation.targetPrice2)}</p>
                          <p>권장 매도가 {formatPrice(focusedCurrentRecommendation.recommendedSellPrice)} / 기대 수익률 {formatPercent(focusedCurrentRecommendation.expectedReturnPercent)} / {formatPercent(focusedCurrentRecommendation.expectedReturnPercent2)}</p>
                          <p>기대 손익비 {focusedCurrentRecommendation.riskReward.toFixed(2)} / 진입 가능 여부 {focusedCurrentRecommendation.entryAllowed ? "진입 가능" : "진입 대기"}</p>
                        </div>
                      ) : (
                        <p className="mt-2">현재 선택한 패턴 조합으로 생성된 추천 가격이 없습니다.</p>
                      )}
                    </div>
                    <div className={`rounded-md border bg-white px-3 py-3 text-[12px] text-[color:var(--fg-muted)] ${workspaceDetailTab === "summary" ? "border-[rgba(21,94,239,0.22)] shadow-[0_10px_22px_rgba(21,94,239,0.08)]" : "border-[color:var(--line)]"}`}>
                      <p className="font-semibold text-[color:var(--fg)]">성과 요약</p>
                      <div className="mt-2 space-y-1">
                        <p>백테스트 누적 수익률 <span className={percentTextClass(focusedCard.summary.cumulativeReturnPercent)}>{formatPercent(focusedCard.summary.cumulativeReturnPercent)}</span> / CAGR <span className={percentTextClass(focusedCard.summary.cagr)}>{formatPercent(focusedCard.summary.cagr)}</span></p>
                        <p>패턴 누적 수익률 <span className={percentTextClass(focusedCompoundedReturn)}>{focusedCompoundedReturn == null ? "-" : formatPercent(focusedCompoundedReturn)}</span> / 패턴 평균 수익률 <span className={percentTextClass(focusedAverageTradeReturn)}>{focusedAverageTradeReturn == null ? "-" : formatPercent(focusedAverageTradeReturn)}</span></p>
                        <p>Max DD <span className={percentTextClass(focusedCard.summary.maxDrawdown)}>{formatPercent(focusedCard.summary.maxDrawdown)}</span> / 패턴 승률 <span className={percentTextClass(focusedWinRate)}>{focusedWinRate == null ? "-" : formatPercent(focusedWinRate)}</span></p>
                        <p>현재가 {formatPrice(focusedCard.summary.currentPrice)} / 52주 고점 대비 {focusedCard.summary.distanceTo52WeekHigh == null ? "-" : formatPercent(focusedCard.summary.distanceTo52WeekHigh)}</p>
                        <p>모멘텀 점수 {focusedCard.summary.momentumScore == null ? "-" : formatPercent(focusedCard.summary.momentumScore)} / 유동성 {focusedCard.summary.liquidityStatus}</p>
                      </div>
                    </div>
                    <div className={`rounded-md border bg-white px-3 py-3 text-[12px] text-[color:var(--fg-muted)] ${workspaceDetailTab === "patterns" ? "border-[rgba(21,94,239,0.22)] shadow-[0_10px_22px_rgba(21,94,239,0.08)]" : "border-[color:var(--line)]"}`}>
                      <p className="font-semibold text-[color:var(--fg)]">패턴 컨텍스트</p>
                      <div className="mt-2 space-y-1">
                        <p>현재 신호 <span className="align-middle"><SignalBadge label={focusedCurrentState} tone={getSignalTone(focusedCurrentState)} /></span></p>
                        <p>최근 신호 {focusedLatestSignal ? `${focusedLatestSignal.signalDate} · ${focusedLatestSignal.patternName}` : "신호 없음"}</p>
                        <p>패턴 신호 {focusedScopedSignals.length}건 · 거래 {focusedScopedTrades.length}건</p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {getWorkspacePatternBadges(focusedCard, enabledPatternMap, workspacePatternFilter).map((badge) => (
                          <span key={`focus-badge-${badge.id}`} className="rounded-full border border-[color:var(--line)] bg-[#f7f9fc] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--fg-muted)]">
                            {badge.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className={`rounded-md border bg-white px-3 py-3 text-[12px] text-[color:var(--fg-muted)] ${workspaceDetailTab === "patterns" ? "border-[rgba(21,94,239,0.22)] shadow-[0_10px_22px_rgba(21,94,239,0.08)]" : "border-[color:var(--line)]"}`}>
                      <p className="font-semibold text-[color:var(--fg)]">파라미터 스냅샷</p>
                      {workspaceContextPattern ? (
                        <div className="mt-2 grid gap-1 sm:grid-cols-2">
                          <p>관찰창 {workspaceContextPattern.lookbackDays}일</p>
                          <p>돌파 비율 {workspaceContextPattern.breakoutPercent}%</p>
                          <p>보유 기간 {workspaceContextPattern.holdingDays}일</p>
                          <p>손절 {workspaceContextPattern.stopLossPercent}%</p>
                          <p>1차/2차 목표 {workspaceContextPattern.target1Percent}% / {workspaceContextPattern.target2Percent}%</p>
                          <p>{workspaceContextPattern.entryMode} / {workspaceContextPattern.exitMode}</p>
                        </div>
                      ) : (
                        <p className="mt-2">현재 선택된 패턴 파라미터 정보가 없습니다.</p>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-[1.05fr_1.15fr]">
                    <DataTable
                      title="포커스 종목 패턴별 수익률"
                      columns={["패턴", "최신 신호", "BUY / SELL / HOLD", "평균 수익률", "최고 수익률", "누적 수익률", "승률", "최근 BUY", "최근 SELL"]}
                      rows={focusedPatternPerformance.map((row) => [
                        <button
                          key={`focus-pattern-${row.patternId}`}
                          type="button"
                          onClick={() => {
                            setWorkspacePatternFilter(row.patternId);
                            setActivePatternId(row.patternId);
                          }}
                          className="space-y-1 text-left"
                        >
                          <span className="block font-semibold text-[color:var(--kpi)]">{row.shortLabel} · {row.patternName}</span>
                          <span className="block text-[11px] text-[color:var(--fg-muted)]">신호 {row.signalCount}건 · 거래 {row.tradeCount}건</span>
                        </button>,
                        row.latestSignalDate ? (
                          <div key={`focus-latest-${row.patternId}`} className="space-y-1">
                            <p className="text-[12px] font-medium text-[color:var(--fg)]">{row.latestSignalDate}</p>
                            <SignalBadge label={row.latestSignalType} tone={getSignalTone(row.latestSignalType)} />
                          </div>
                        ) : (
                          <span key={`focus-latest-empty-${row.patternId}`} className="text-[12px] text-[color:var(--fg-muted)]">신호 없음</span>
                        ),
                        <div key={`focus-counts-${row.patternId}`} className="flex flex-wrap gap-1.5">
                          <StatusPill label={`BUY ${row.buyCount}`} active={row.buyCount > 0} />
                          <StatusPill label={`SELL ${row.sellCount}`} active={row.sellCount > 0} />
                          <StatusPill label={`HOLD ${row.holdCount}`} active={row.holdCount > 0} />
                        </div>,
                        <PercentPill key={`focus-average-${row.patternId}`} value={row.averageReturn} />,
                        <PercentPill key={`focus-best-${row.patternId}`} value={row.bestReturn} />,
                        <PercentPill key={`focus-compounded-${row.patternId}`} value={row.compoundedReturn} />,
                        <PercentPill key={`focus-winrate-${row.patternId}`} value={row.winRate} />,
                        row.lastBuyDate ? <StatusPill key={`focus-buy-date-${row.patternId}`} label={row.lastBuyDate} active /> : <StatusPill key={`focus-buy-date-empty-${row.patternId}`} label="없음" />,
                        row.lastSellDate ? <StatusPill key={`focus-sell-date-${row.patternId}`} label={row.lastSellDate} /> : <StatusPill key={`focus-sell-date-empty-${row.patternId}`} label="없음" />,
                      ])}
                      pageSize={6}
                    />
                    <DataTable
                      title="포커스 종목 패턴 신호 로그"
                      columns={["일자", "패턴", "액션", "신호가", "권장 매수가", "권장 매도가", "기대 수익률", "상태"]}
                      rows={focusedScopedSignals
                        .slice()
                        .sort((left, right) => right.signalDate.localeCompare(left.signalDate))
                        .map((signal) => [
                          <div key={`focus-date-${signal.id}`} className="space-y-1">
                            <p className="text-[12px] font-medium text-[color:var(--fg)]">{signal.signalDate}</p>
                            <p className="text-[11px] text-[color:var(--fg-muted)]">{signal.openPosition ? "열린 포지션" : "종결 신호"}</p>
                          </div>,
                          <div key={`focus-pattern-name-${signal.id}`} className="space-y-1">
                            <p className="font-semibold text-[color:var(--fg)]">{signal.patternName}</p>
                            <p className="text-[11px] text-[color:var(--fg-muted)]">{signal.patternId}</p>
                          </div>,
                          <SignalBadge key={`focus-signal-${signal.id}`} label={signal.signalType} tone={getSignalTone(signal.signalType)} />,
                          formatPrice(signal.signalPrice),
                          `${formatPrice(signal.recommendation.entryRangeLow)} ~ ${formatPrice(signal.recommendation.entryRangeHigh)}`,
                          formatPrice(signal.recommendation.recommendedSellPrice),
                          <div key={`focus-return-${signal.id}`} className="flex flex-wrap gap-1.5">
                            <PercentPill value={signal.recommendation.expectedReturnPercent} />
                            <PercentPill value={signal.recommendation.expectedReturnPercent2} />
                          </div>,
                          <StatusPill key={`focus-status-${signal.id}`} label={signal.openPosition ? "ACTIVE" : "CLOSED"} active={signal.openPosition} />,
                        ])}
                      pageSize={6}
                    />
                  </div>
                  <div className="rounded-md border border-[color:var(--line)] bg-white px-3 py-3 text-[12px] text-[color:var(--fg-muted)]">
                    <p className="font-semibold text-[color:var(--fg)]">이벤트 타임라인</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {focusedTimeline.length > 0 ? focusedTimeline.map((event) => (
                        <span key={`${event.date}-${event.label}`} className="rounded-full border border-[color:var(--line)] px-3 py-1">
                          {event.date} · {event.label}
                        </span>
                      )) : (
                        <span>최근 이벤트가 없습니다.</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <StatusNotice title="포커스할 종목이 없습니다." description="그리드 카드에서 종목을 선택하면 같은 본문 영역에서 포커스 차트와 추천 가격을 크게 볼 수 있습니다." />
              )
            ) : (
              <StatusNotice title="선택한 기간과 조건에서는 패턴 신호가 발생하지 않았습니다." description="관찰창, 돌파율, 손절 규칙을 조정해 보세요." />
            )}
          </WorkPanel>
        </div>

        <WorkPanel
          title="패턴 선택 / 파라미터 조정 패널"
          subtitle="기본 패턴, 사용자 패턴, 즐겨찾기 패턴을 토글하고 세부 파라미터를 조정해 즉시 차트와 테이블에 반영합니다."
          action={
            <>
              <SecondaryButton label="전략에 반영" onClick={handleReflectToStrategy} icon="link" disabled={isRouting} />
              <SecondaryButton label="백테스트 결과로 이동" onClick={handleMoveToBacktest} icon="backtest" disabled={isRouting} />
              <SecondaryButton label="실행 센터로 보내기" onClick={handleMoveToExecutionCenter} icon="execution" disabled={isRouting} />
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <ToggleButton active={patternTab === "preset"} label="기본 패턴" onClick={() => setPatternTab("preset")} />
              <ToggleButton active={patternTab === "custom"} label="사용자 패턴" onClick={() => setPatternTab("custom")} />
              <ToggleButton active={patternTab === "favorite"} label="즐겨찾기 패턴" onClick={() => setPatternTab("favorite")} />
            </div>
            <div className="flex flex-wrap gap-2">
              {enabledDraftPatterns.length > 0 ? enabledDraftPatterns.map((pattern) => (
                <div key={pattern.id} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${activePatternId === pattern.id ? "border-black bg-black text-white" : "border-[color:var(--line)] bg-white text-[color:var(--fg-muted)]"}`}>
                  <button type="button" onClick={() => setActivePatternId(pattern.id)}>{pattern.shortLabel}</button>
                  <button type="button" onClick={() => togglePattern(pattern.id)} aria-label={`${pattern.name} 해제`} className="text-[10px]">X</button>
                </div>
              )) : (
                <span className="text-[11px] text-[color:var(--fg-muted)]">활성 패턴이 없습니다.</span>
              )}
            </div>

            <div className="space-y-3">
              {visiblePatterns.length === 0 ? (
                <StatusNotice title="표시할 패턴이 없습니다." description={patternTab === "favorite" ? "즐겨찾기 패턴을 추가해 주세요." : patternTab === "custom" ? "사용자 패턴을 복제하거나 생성해 주세요." : "패턴 목록을 확인해 주세요."} />
              ) : null}
              {visiblePatterns.map((pattern) => {
                const patternResult = experimentResult.patterns.find((item) => item.patternId === pattern.id);
                const favorite = favoritePatternIds.includes(pattern.id);
                return (
                  <div key={pattern.id} className={`rounded-md border p-3 ${pattern.enabled ? "border-black bg-[color:var(--surface-muted)]" : "border-[color:var(--line)] bg-white"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-[color:var(--line)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--fg-muted)]">{pattern.shortLabel}</span>
                          <span className="text-[11px] text-[color:var(--fg-muted)]">{pattern.source === "custom" ? "사용자 패턴" : "기본 패턴"}</span>
                        </div>
                        <p className="mt-2 text-[14px] font-semibold text-[color:var(--fg)]">{pattern.name}</p>
                        <p className="mt-1 text-[11px] leading-5 text-[color:var(--fg-muted)]">{pattern.thesis}</p>
                      </div>
                      <ToggleButton active={pattern.enabled} label={pattern.enabled ? "ON" : "OFF"} onClick={() => togglePattern(pattern.id)} />
                    </div>
                    <div className="mt-3 grid gap-2 text-[11px] md:grid-cols-2">
                      <div className="rounded-md border border-[color:var(--line)] bg-white px-3 py-2">
                        <p>최근 신호 {patternResult?.recentSignalCount ?? 0}건 / 적용 종목 {patternResult?.appliedStockCount ?? 0}개</p>
                        <p className="mt-1">평균 수익률 {patternResult ? formatPercent(patternResult.averageReturnPercent) : "-"} / 승률 {patternResult ? formatPercent(patternResult.winRate) : "-"}</p>
                      </div>
                      <div className="rounded-md border border-[color:var(--line)] bg-white px-3 py-2">
                        <p>평균 보유 {patternResult?.avgHoldingDays ?? pattern.holdingDays}일 / 샤프 {patternResult?.sharpe.toFixed(2) ?? "-"}</p>
                        <p className="mt-1">{patternResult?.latest20Summary ?? "최근 20건 성과 요약 없음"}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => setActivePatternId(pattern.id)} className="text-[11px] font-semibold text-[color:var(--kpi)]">상세 설정</button>
                      <button type="button" onClick={() => toggleFavorite(pattern.id)} className="text-[11px] font-semibold text-[color:var(--fg)]">{favorite ? "즐겨찾기 해제" : "즐겨찾기"}</button>
                      <button type="button" onClick={() => duplicatePattern(pattern)} className="text-[11px] font-semibold text-[color:var(--kpi)]">복제</button>
                      {pattern.source === "custom" ? (
                        <button type="button" onClick={() => deletePattern(pattern.id)} className="text-[11px] font-semibold text-[color:var(--sell)]">삭제</button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {activePattern ? (
              <div className="rounded-md border border-[color:var(--line)] bg-white p-3">
                <p className="text-[13px] font-semibold text-[color:var(--fg)]">{activePattern.name} 파라미터</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="space-y-2 text-[12px]">
                    <span className="font-semibold">관찰창(Lookback)</span>
                    <input type="number" min={10} max={300} value={activePattern.lookbackDays} onChange={(event) => updatePattern(activePattern.id, (pattern) => ({ ...pattern, lookbackDays: Number(event.target.value) }))} className="w-full rounded-md border border-[color:var(--line)] px-3 py-2" />
                  </label>
                  <label className="space-y-2 text-[12px]">
                    <span className="font-semibold">{breakoutInputLabel(activePattern)}</span>
                    <input type="number" min={0.1} max={10} step={0.1} value={activePattern.breakoutPercent} onChange={(event) => updatePattern(activePattern.id, (pattern) => ({ ...pattern, breakoutPercent: Number(event.target.value) }))} className="w-full rounded-md border border-[color:var(--line)] px-3 py-2" />
                  </label>
                  <label className="space-y-2 text-[12px]">
                    <span className="font-semibold">거래량 증가 조건(%)</span>
                    <input type="number" min={0} max={100} step={1} value={activePattern.volumeSurgePercent} onChange={(event) => updatePattern(activePattern.id, (pattern) => ({ ...pattern, volumeSurgePercent: Number(event.target.value) }))} className="w-full rounded-md border border-[color:var(--line)] px-3 py-2" />
                  </label>
                  <label className="space-y-2 text-[12px]">
                    <span className="font-semibold">{momentumInputLabel(activePattern)}</span>
                    <input type="number" min={1} max={40} value={activePattern.momentumThreshold} onChange={(event) => updatePattern(activePattern.id, (pattern) => ({ ...pattern, momentumThreshold: Number(event.target.value) }))} className="w-full rounded-md border border-[color:var(--line)] px-3 py-2" />
                  </label>
                  <label className="space-y-2 text-[12px]">
                    <span className="font-semibold">{slopeInputLabel(activePattern)}</span>
                    <input type="number" min={0.05} max={1} step={0.01} value={activePattern.slopeThreshold} onChange={(event) => updatePattern(activePattern.id, (pattern) => ({ ...pattern, slopeThreshold: Number(event.target.value) }))} className="w-full rounded-md border border-[color:var(--line)] px-3 py-2" />
                  </label>
                  {activePattern.id === "liquidity-sweep-reversal" ? (
                    <>
                      <label className="space-y-2 text-[12px]">
                        <span className="font-semibold">스윕 버퍼(%)</span>
                        <input type="number" min={0.1} max={3} step={0.05} value={activePattern.sweepBufferPercent} onChange={(event) => updatePattern(activePattern.id, (pattern) => ({ ...pattern, sweepBufferPercent: Number(event.target.value) }))} className="w-full rounded-md border border-[color:var(--line)] px-3 py-2" />
                      </label>
                      <label className="space-y-2 text-[12px]">
                        <span className="font-semibold">재진입 허용 봉 수</span>
                        <input type="number" min={1} max={6} value={activePattern.maxReentryBars} onChange={(event) => updatePattern(activePattern.id, (pattern) => ({ ...pattern, maxReentryBars: Number(event.target.value) }))} className="w-full rounded-md border border-[color:var(--line)] px-3 py-2" />
                      </label>
                      <label className="space-y-2 text-[12px]">
                        <span className="font-semibold">꼬리/몸통 비율</span>
                        <input type="number" min={1} max={5} step={0.1} value={activePattern.wickRatioThreshold} onChange={(event) => updatePattern(activePattern.id, (pattern) => ({ ...pattern, wickRatioThreshold: Number(event.target.value) }))} className="w-full rounded-md border border-[color:var(--line)] px-3 py-2" />
                      </label>
                      <label className="space-y-2 text-[12px]">
                        <span className="font-semibold">종가 복귀 위치(%)</span>
                        <input type="number" min={35} max={95} step={1} value={activePattern.closeRecoveryPercent} onChange={(event) => updatePattern(activePattern.id, (pattern) => ({ ...pattern, closeRecoveryPercent: Number(event.target.value) }))} className="w-full rounded-md border border-[color:var(--line)] px-3 py-2" />
                      </label>
                    </>
                  ) : null}
                  {activePattern.id === "imbalance-pullback-continuation" ? (
                    <>
                      <label className="space-y-2 text-[12px]">
                        <span className="font-semibold">최소 FVG 크기(%)</span>
                        <input type="number" min={0.1} max={5} step={0.1} value={activePattern.minGapPercent} onChange={(event) => updatePattern(activePattern.id, (pattern) => ({ ...pattern, minGapPercent: Number(event.target.value) }))} className="w-full rounded-md border border-[color:var(--line)] px-3 py-2" />
                      </label>
                      <label className="space-y-2 text-[12px]">
                        <span className="font-semibold">최소 fill 비율(%)</span>
                        <input type="number" min={10} max={100} step={5} value={activePattern.minFillPercent} onChange={(event) => updatePattern(activePattern.id, (pattern) => ({ ...pattern, minFillPercent: Number(event.target.value) }))} className="w-full rounded-md border border-[color:var(--line)] px-3 py-2" />
                      </label>
                      <label className="space-y-2 text-[12px]">
                        <span className="font-semibold">재돌파 확인 봉 수</span>
                        <input type="number" min={2} max={30} value={activePattern.maxConfirmationBars} onChange={(event) => updatePattern(activePattern.id, (pattern) => ({ ...pattern, maxConfirmationBars: Number(event.target.value) }))} className="w-full rounded-md border border-[color:var(--line)] px-3 py-2" />
                      </label>
                    </>
                  ) : null}
                  <label className="space-y-2 text-[12px]">
                    <span className="font-semibold">보유 일수</span>
                    <input type="number" min={3} max={120} value={activePattern.holdingDays} onChange={(event) => updatePattern(activePattern.id, (pattern) => ({ ...pattern, holdingDays: Number(event.target.value) }))} className="w-full rounded-md border border-[color:var(--line)] px-3 py-2" />
                  </label>
                  <label className="space-y-2 text-[12px]">
                    <span className="font-semibold">손절률(%)</span>
                    <input type="number" min={1} max={20} value={activePattern.stopLossPercent} onChange={(event) => updatePattern(activePattern.id, (pattern) => ({ ...pattern, stopLossPercent: Number(event.target.value) }))} className="w-full rounded-md border border-[color:var(--line)] px-3 py-2" />
                  </label>
                  <label className="space-y-2 text-[12px]">
                    <span className="font-semibold">1차 목표가(%)</span>
                    <input type="number" min={2} max={30} value={activePattern.target1Percent} onChange={(event) => updatePattern(activePattern.id, (pattern) => ({ ...pattern, target1Percent: Number(event.target.value) }))} className="w-full rounded-md border border-[color:var(--line)] px-3 py-2" />
                  </label>
                  <label className="space-y-2 text-[12px]">
                    <span className="font-semibold">2차 목표가(%)</span>
                    <input type="number" min={4} max={40} value={activePattern.target2Percent} onChange={(event) => updatePattern(activePattern.id, (pattern) => ({ ...pattern, target2Percent: Number(event.target.value) }))} className="w-full rounded-md border border-[color:var(--line)] px-3 py-2" />
                  </label>
                  <label className="space-y-2 text-[12px]">
                    <span className="font-semibold">진입 방식</span>
                    <select value={activePattern.entryMode} onChange={(event) => updatePattern(activePattern.id, (pattern) => ({ ...pattern, entryMode: event.target.value as PatternEntryMode }))} className="w-full rounded-md border border-[color:var(--line)] px-3 py-2">
                      <option value="SIGNAL_CLOSE">{entryModeLabel("SIGNAL_CLOSE")}</option>
                      <option value="NEXT_OPEN">{entryModeLabel("NEXT_OPEN")}</option>
                      <option value="BREAKOUT_PRICE">{entryModeLabel("BREAKOUT_PRICE")}</option>
                      <option value="VWAP_PROXY">{entryModeLabel("VWAP_PROXY")}</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-[12px]">
                    <span className="font-semibold">청산 방식</span>
                    <select value={activePattern.exitMode} onChange={(event) => updatePattern(activePattern.id, (pattern) => ({ ...pattern, exitMode: event.target.value as PatternExitMode }))} className="w-full rounded-md border border-[color:var(--line)] px-3 py-2">
                      <option value="TARGET">{exitModeLabel("TARGET")}</option>
                      <option value="STOP">{exitModeLabel("STOP")}</option>
                      <option value="TREND">{exitModeLabel("TREND")}</option>
                      <option value="TIME">{exitModeLabel("TIME")}</option>
                      <option value="TRAILING_STOP">{exitModeLabel("TRAILING_STOP")}</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-[12px]">
                    <span className="font-semibold">기본 실행 모델</span>
                    <select value={draftExecutionModel} onChange={(event) => setDraftExecutionModel(event.target.value as PatternExecutionModel)} className="w-full rounded-md border border-[color:var(--line)] px-3 py-2">
                      <option value="SIGNAL_CLOSE">종가 기준</option>
                      <option value="NEXT_OPEN">다음 봉 시가 기준</option>
                      <option value="BREAKOUT_SLIPPAGE">돌파 가격 기준</option>
                      <option value="VWAP_PROXY">VWAP 근사 기준</option>
                    </select>
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PrimaryButton label="패턴 적용" onClick={applyExperiment} disabled={!isDirty} />
                  <SecondaryButton
                    label="초기화"
                    onClick={() => updatePattern(activePattern.id, (pattern) => {
                      const preset = DEFAULT_PATTERNS.find((item) => item.id === activePattern.id);
                      if (preset) {
                        return { ...preset, enabled: pattern.enabled };
                      }
                      return {
                        ...createCustomPattern({
                          name: activePattern.name,
                          category: activePattern.category,
                          lookbackDays: 55,
                          breakoutPercent: 1.2,
                          holdingDays: 30,
                          momentumThreshold: 10,
                          slopeThreshold: 0.2,
                          volumeSurgePercent: 12,
                          sweepBufferPercent: 0.4,
                          maxReentryBars: 2,
                          wickRatioThreshold: 1.8,
                          closeRecoveryPercent: 55,
                          minGapPercent: 0.6,
                          minFillPercent: 45,
                          maxConfirmationBars: 12,
                          stopLossPercent: 8,
                          target1Percent: 12,
                          target2Percent: 20,
                          entryMode: "SIGNAL_CLOSE",
                          exitMode: "TRAILING_STOP",
                        }),
                        id: activePattern.id,
                        shortLabel: activePattern.shortLabel,
                        source: activePattern.source,
                        enabled: activePattern.enabled,
                        thesis: activePattern.thesis,
                        ruleSummary: activePattern.ruleSummary,
                      };
                    })}
                  />
                  <SecondaryButton label="복제" onClick={() => duplicatePattern(activePattern)} icon="plus" />
                  <SecondaryButton label="저장" onClick={handleSaveWorkspace} icon="plus" />
                </div>
              </div>
            ) : null}

            {patternSnapshots.length > 0 ? (
              <div className="rounded-md border border-[color:var(--line)] bg-white p-3">
                <p className="text-[13px] font-semibold text-[color:var(--fg)]">패턴 스냅샷</p>
                <div className="mt-3 space-y-2">
                  {patternSnapshots
                    .filter((snapshot) => snapshot.strategyId === selectedStrategyId)
                    .slice(0, 4)
                    .map((snapshot) => (
                      <button key={snapshot.id} type="button" onClick={() => applySnapshot(snapshot.id)} className="w-full rounded-md border border-[color:var(--line)] px-3 py-2 text-left text-[11px]">
                        <p className="font-semibold text-[color:var(--fg)]">{snapshot.name}</p>
                        <p className="mt-1 text-[color:var(--fg-muted)]">{new Date(snapshot.createdAt).toLocaleString("ko-KR")} · 패턴 {snapshot.patterns.filter((pattern) => pattern.enabled).length}개</p>
                      </button>
                    ))}
                </div>
              </div>
            ) : null}
          </div>
        </WorkPanel>
      </div>
      </DashboardCard>

      <DashboardCard title="하단 결과 영역" subtitle="신호 내역, 거래 내역, 종목별 성과, 패턴별 성과, 추천 가격, 패턴×종목 매트릭스를 교차 검증합니다.">
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ["signals", "신호 내역"],
            ["trades", "거래 내역"],
            ["stocks", "종목별 성과"],
            ["patterns", "패턴별 성과"],
            ["recommendations", "추천 가격 요약"],
            ["matrix", "패턴×종목 매트릭스"],
          ].map(([value, label]) => (
            <ToggleButton key={value} active={activeTab === value} label={label} onClick={() => setActiveTab(value as typeof activeTab)} />
          ))}
        </div>

        {experimentResult.stocks.length === 0 ? (
          <StatusNotice title="비교할 패턴 결과가 없습니다." description="종목과 패턴을 선택한 뒤 재실행을 눌러 분석/실험 흐름을 시작하세요." />
        ) : activeTab === "signals" ? (
          <DataTable
            columns={["일자", "종목명", "종목코드", "패턴명", "신호 유형", "신호 가격", "권장 매수가", "손절가", "목표가", "권장 매도가", "기대 수익률", "상태"]}
            rows={experimentResult.signals.map((signal) => [
              signal.signalDate,
              signal.stockName,
              signal.symbol,
              signal.patternName,
              <SignalBadge key={signal.id} label={signal.signalType} tone={getSignalTone(signal.signalType)} />,
              formatPrice(signal.signalPrice),
              `${formatPrice(signal.recommendation.entryRangeLow)} ~ ${formatPrice(signal.recommendation.entryRangeHigh)}`,
              formatPrice(signal.recommendation.stopPrice),
              `${formatPrice(signal.recommendation.targetPrice1)} / ${formatPrice(signal.recommendation.targetPrice2)}`,
              formatPrice(signal.recommendation.recommendedSellPrice),
              `${formatPercent(signal.recommendation.expectedReturnPercent)} / ${formatPercent(signal.recommendation.expectedReturnPercent2)}`,
              signal.openPosition ? "ACTIVE" : "CLOSED",
            ])}
            pageSize={8}
          />
        ) : activeTab === "trades" ? (
          <DataTable
            columns={["진입일", "청산일", "종목명", "패턴명", "진입가", "청산가", "권장 매수가", "권장 매도가", "보유일", "수익률", "성공 여부", "청산 사유", "누적 수익률"]}
            rows={experimentResult.trades.map((trade) => [
              trade.entryDate,
              trade.exitDate ?? "열린 포지션",
              trade.stockName,
              trade.patternName,
              formatPrice(trade.entryPrice),
              trade.exitPrice == null ? "예상 " + formatPrice(trade.expectedExitPrice) : formatPrice(trade.exitPrice),
              `${formatPrice(trade.recommendation.entryRangeLow)} ~ ${formatPrice(trade.recommendation.entryRangeHigh)}`,
              formatPrice(trade.recommendation.recommendedSellPrice),
              `${trade.holdingDays}일`,
              trade.returnPercent == null ? `미실현 / 예상 ${formatPercent(trade.recommendation.expectedReturnPercent)}` : formatPercent(trade.returnPercent),
              trade.returnPercent == null ? <span key={`${trade.id}-open`} className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700">보유중</span> : (trade.returnPercent ?? 0) >= 0 ? <span key={`${trade.id}-success`} className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">성공</span> : <span key={`${trade.id}-fail`} className="rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700">실패</span>,
              trade.exitReason,
              formatPercent(trade.returnPercent ?? trade.recommendation.expectedReturnPercent),
            ])}
            pageSize={8}
          />
        ) : activeTab === "stocks" ? (
          <DataTable
            columns={["종목명", "적용 패턴 수", "총 신호 수", "BUY 횟수", "SELL 횟수", "승률", "평균 수익률", "누적 수익률", "최종 수익률", "현재 상태", "현재 권장 매수가", "현재 권장 매도가"]}
            rows={experimentResult.stocks.map((stock) => [
              `${stock.summary.name} (${stock.summary.symbol})`,
              String(stock.summary.selectedPatternCount),
              String(stock.signals.length),
              String(stock.signals.filter((signal) => signal.signalType === "BUY").length),
              String(stock.signals.filter((signal) => signal.signalType === "SELL").length),
              formatPercent(stock.summary.winRate),
              formatPercent(stock.trades.length > 0 ? stock.trades.reduce((sum, trade) => sum + (trade.returnPercent ?? trade.recommendation.expectedReturnPercent), 0) / stock.trades.length : 0),
              formatPercent(stock.summary.cumulativeReturnPercent),
              formatPercent(stock.summary.cagr),
              <SignalBadge key={`${stock.summary.symbol}-state`} label={stock.summary.currentState} tone={getSignalTone(stock.summary.currentState)} />,
              stock.summary.currentRecommendation ? `${formatPrice(stock.summary.currentRecommendation.entryRangeLow)} ~ ${formatPrice(stock.summary.currentRecommendation.entryRangeHigh)}` : "-",
              stock.summary.currentRecommendation ? formatPrice(stock.summary.currentRecommendation.recommendedSellPrice) : "-",
            ])}
            pageSize={8}
          />
        ) : activeTab === "patterns" ? (
          <DataTable
            columns={["패턴명", "적용 종목 수", "총 거래 수", "승률", "평균 수익률", "중앙값 수익률", "누적 수익률", "최종 수익률", "최대 낙폭", "평균 보유일", "현재 활성 신호 수"]}
            rows={experimentResult.patterns.map((pattern) => [
              <button
                key={pattern.patternId}
                type="button"
                onClick={() => {
                  const draftPattern = draftPatterns.find((item) => item.id === pattern.patternId);
                  setActivePatternId(pattern.patternId);
                  setPatternTab(draftPattern?.source === "custom" ? "custom" : "preset");
                }}
                className="font-semibold text-[color:var(--kpi)]"
              >
                {pattern.name}
              </button>,
              String(pattern.appliedStockCount),
              String(pattern.tradeCount),
              formatPercent(pattern.winRate),
              formatPercent(pattern.averageReturnPercent),
              formatPercent(pattern.medianReturnPercent),
              formatPercent(pattern.cagr),
              formatPercent(pattern.cagr),
              formatPercent(pattern.maxDrawdown),
              `${pattern.avgHoldingDays}일`,
              String(pattern.recentSignalCount),
            ])}
            pageSize={8}
          />
        ) : activeTab === "recommendations" ? (
          <DataTable
            columns={["종목명", "패턴명", "현재가", "권장 매수가", "진입 허용 범위", "손절가", "1차 목표가", "2차 목표가", "권장 매도가", "예상 청산가", "기대 수익률", "기대 손익비", "현재 상태", "업데이트 시각"]}
            rows={experimentResult.recommendations.map((row) => [
              `${row.stockName} (${row.symbol})`,
              row.patternName,
              formatPrice(row.currentPrice),
              `${formatPrice(row.entryRangeLow)} ~ ${formatPrice(row.entryRangeHigh)}`,
              `${Math.abs(row.entryDistancePercent).toFixed(1)}% ${row.entryAllowed ? "이내" : "밖"}`,
              formatPrice(row.stopPrice),
              formatPrice(row.targetPrice1),
              formatPrice(row.targetPrice2),
              formatPrice(row.recommendedSellPrice),
              formatPrice(row.expectedExitPrice),
              `${formatPercent(row.expectedReturnPercent)} / ${formatPercent(row.expectedReturnPercent2)}`,
              row.riskReward.toFixed(2),
              row.signalType,
              row.latestUpdatedAt,
            ])}
            pageSize={8}
          />
        ) : activeTab === "matrix" ? (
          <div className="overflow-hidden rounded-md border border-[color:rgba(15,23,42,0.08)] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <div className="ui-scrollbar overflow-x-auto">
              <table className="ui-table min-w-full bg-white">
                <thead>
                  <tr>
                    <th>종목</th>
                    {experimentResult.patterns.map((pattern) => (
                      <th key={pattern.patternId}>{pattern.shortLabel}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {experimentResult.stocks.map((stock) => (
                    <tr key={stock.summary.symbol}>
                      <td>
                        <button type="button" onClick={() => { setFocusedSymbol(stock.summary.symbol); setViewMode("focus"); }} className="font-semibold text-[color:var(--kpi)]">
                          {stock.summary.symbol}
                        </button>
                      </td>
                      {experimentResult.patterns.map((pattern) => {
                        const cell = experimentResult.matrix.find((item) => item.symbol === stock.summary.symbol && item.patternId === pattern.patternId);
                        const heat = cell?.returnPercent ?? 0;
                        const bgClass = heat >= 12 ? "bg-emerald-100 text-emerald-700" : heat >= 0 ? "bg-blue-50 text-[color:var(--kpi)]" : "bg-rose-100 text-rose-700";
                        return (
                          <td key={`${stock.summary.symbol}-${pattern.patternId}`}>
                            <button
                              type="button"
                              onClick={() => { setFocusedSymbol(stock.summary.symbol); setActivePatternId(pattern.patternId); setViewMode("focus"); }}
                              className={`rounded-md px-2 py-1 text-[11px] font-semibold ${bgClass}`}
                              title={cell ? `${stock.summary.symbol} / ${pattern.name} / 거래수 ${stock.trades.filter((trade) => trade.patternId === pattern.patternId).length} / 승률 ${formatPercent(cell.winRate)} / 최근 신호 ${cell.latestSignal}` : ""}
                            >
                              <p>{cell?.returnPercent == null ? "-" : formatPercent(cell.returnPercent)}</p>
                              <p className="mt-1 text-[10px]">{cell?.latestSignal ?? "NONE"}</p>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </DashboardCard>

      <div className="flex flex-wrap gap-2">
        <PrimaryButton label="패턴 저장" onClick={handleSaveWorkspace} icon="plus" />
        <SecondaryButton label="패턴 복제" onClick={() => activePattern && duplicatePattern(activePattern)} icon="plus" disabled={!activePattern} />
        <SecondaryButton label="전략에 반영" onClick={handleReflectToStrategy} icon="link" disabled={isRouting} />
        <SecondaryButton label={submittingBacktest ? "재백테스트 등록 중" : "이 조합으로 재백테스트"} onClick={handleRerunBacktest} icon="backtest" disabled={submittingBacktest || isRouting} />
        <SecondaryButton label="실행 센터로 보내기" onClick={handleMoveToExecutionCenter} icon="execution" disabled={isRouting} />
      </div>
    </div>
  );
}
