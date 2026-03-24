"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { DataTable } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { StatusNotice } from "@/components/ui/StatusNotice";
import {
  createStrategy,
  createStrategySnapshot,
  deleteStrategy,
  getStockDataDetail,
  getStrategies,
  getStrategyDiagnostics,
  getStrategySnapshots,
  updateStrategy,
  type StockDataDetail,
  type StrategyCandidateResult,
  type StrategySummary,
  type StrategyWeightSnapshot,
} from "@/lib/api";
import {
  BACKTEST_UNIVERSE_ASSET_OPTIONS,
  createDefaultBacktestUniverseScope,
  summarizeBacktestUniverseScope,
  type BacktestUniverseAssetScope,
  type BacktestUniverseMarketScope,
  type BacktestUniverseScopePayload,
} from "@/lib/backtest-universe";
import {
  DEFAULT_PATTERNS,
  DEFAULT_SIGNAL_PLAN,
  buildCandidateWorkbench,
  loadPatternWorkspace,
  savePatternWorkspace,
  type QuantPattern,
  type SignalPlan,
} from "@/lib/quant-workbench";

type FactorMode = "AUTO" | "MANUAL";
type WeightKey = "momentum" | "value" | "quality" | "news" | "earnings_surprise" | "insider_activity";
type WeightMap = Record<WeightKey, number>;
type StrategyUniverseMarketScope = Extract<BacktestUniverseMarketScope, "US" | "KOREA" | "GLOBAL">;
type StrategyUniverseAssetScope = Extract<BacktestUniverseAssetScope, "STOCK" | "ETF" | "ALL">;

const FACTOR_ORDER: Array<{ key: WeightKey; label: string }> = [
  { key: "momentum", label: "모멘텀" },
  { key: "value", label: "가치" },
  { key: "quality", label: "퀄리티" },
  { key: "news", label: "뉴스 감성" },
  { key: "earnings_surprise", label: "실적 서프라이즈" },
  { key: "insider_activity", label: "내부자 거래" },
];

const DEFAULT_WEIGHTS: WeightMap = {
  momentum: 35,
  value: 25,
  quality: 20,
  news: 5,
  earnings_surprise: 10,
  insider_activity: 5,
};

const PRESETS: Array<{ label: string; description: string; values: WeightMap }> = [
  { label: "안정형", description: "가치 35 / 퀄리티 30 / 모멘텀 20 / 뉴스 5 / 실적 5 / 내부자 5", values: { momentum: 20, value: 35, quality: 30, news: 5, earnings_surprise: 5, insider_activity: 5 } },
  { label: "균형형", description: "모멘텀 30 / 가치 25 / 퀄리티 20 / 뉴스 5 / 실적 10 / 내부자 10", values: { momentum: 30, value: 25, quality: 20, news: 5, earnings_surprise: 10, insider_activity: 10 } },
  { label: "추세형", description: "모멘텀 45 / 가치 20 / 퀄리티 15 / 뉴스 5 / 실적 10 / 내부자 5", values: { momentum: 45, value: 20, quality: 15, news: 5, earnings_surprise: 10, insider_activity: 5 } },
  { label: "이벤트형", description: "모멘텀 25 / 가치 20 / 퀄리티 15 / 뉴스 10 / 실적 20 / 내부자 10", values: { momentum: 25, value: 20, quality: 15, news: 10, earnings_surprise: 20, insider_activity: 10 } },
];

const FACTOR_GUIDES: Record<string, string> = {
  ROE: "주주가 넣은 돈(자기자본)으로 회사가 얼마나 효율적으로 이익을 내는지 보여주는 수익성 지표.",
  PBR: "회사의 순자산(장부가치) 대비 주가가 비싼지/싼지를 보는 저평가 지표.",
  모멘텀: "최근 주가 흐름이 상승 추세인지를 측정하는 추세(탄력) 지표.",
  시가총액: "회사의 시장 규모(주가×주식수)로, 대형주/소형주 특성을 가르는 기준.",
  거래량: "주식이 얼마나 활발히 거래되는지로, 사고팔기 쉬운 정도(유동성)를 나타내는 지표.",
  "뉴스 감성": "뉴스 내용의 긍·부정을 점수화해 시장 분위기(센티먼트)를 반영한 지표.",
  "실적 서프라이즈": "실제 EPS가 컨센서스를 얼마나 상회·하회했는지를 반영하는 구조화 이벤트 지표.",
  "내부자 거래": "임원·대주주의 순매수·순매도 활동을 반영하는 구조화 이벤트 지표.",
  "애널리스트 상향": "목표가/투자의견 상향 여부로 전문가 기대 변화를 반영한 지표.",
  "소셜 트렌드 점수": "온라인 언급량·관심도를 점수화해 대중 관심(유행)을 반영한 지표.",
};

const STRATEGY_UNIVERSE_OPTIONS: Array<{
  value: StrategyUniverseMarketScope;
  label: string;
  description: string;
}> = [
  { value: "GLOBAL", label: "전체 시장", description: "미국과 한국 등록 심볼 전체를 후보 범위로 사용합니다." },
  { value: "US", label: "미국 시장", description: "NASDAQ / NYSE / NYSE Arca 범위를 후보로 사용합니다." },
  { value: "KOREA", label: "국내 시장", description: "KOSPI / KOSDAQ 범위를 후보로 사용합니다." },
];

const STRATEGY_UNIVERSE_ASSET_OPTIONS = BACKTEST_UNIVERSE_ASSET_OPTIONS.filter(
  (option): option is { value: StrategyUniverseAssetScope; label: string; description: string } =>
    option.value === "STOCK" || option.value === "ETF" || option.value === "ALL",
);

function createZeroWeightMap(): WeightMap {
  return {
    momentum: 0,
    value: 0,
    quality: 0,
    news: 0,
    earnings_surprise: 0,
    insider_activity: 0,
  };
}

function normalizeWeights(weights: WeightMap): WeightMap {
  const total = Object.values(weights).reduce((sum, value) => sum + Math.max(value, 0), 0);
  if (total <= 0) {
    return createZeroWeightMap();
  }
  return FACTOR_ORDER.reduce((acc, { key }) => {
    acc[key] = Number(((weights[key] / total) * 100).toFixed(1));
    return acc;
  }, createZeroWeightMap());
}

function toRequestWeights(weights: WeightMap) {
  return (Object.entries(weights) as Array<[WeightKey, number]>).map(([factorName, factorWeight]) => ({ factorName, factorWeight }));
}

function formatWeightSummary(weights: Partial<Record<WeightKey, number>>) {
  return FACTOR_ORDER.map(({ key, label }) => `${label} ${weights[key] ?? DEFAULT_WEIGHTS[key]}%`).join(" / ");
}

function createStrategyUniverseScope(
  marketScope: StrategyUniverseMarketScope = "GLOBAL",
  assetScope: StrategyUniverseAssetScope = "STOCK",
): BacktestUniverseScopePayload {
  return {
    ...createDefaultBacktestUniverseScope(),
    overrideMode: "ONE_TIME_OVERRIDE",
    mode: "FULL_MARKET",
    marketScope,
    assetScope,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function cloneUniverseScope(scope: BacktestUniverseScopePayload | null | undefined): BacktestUniverseScopePayload {
  if (!scope) {
    return createStrategyUniverseScope();
  }
  return {
    ...scope,
    assetScope: scope.assetScope ?? "STOCK",
    selectedStocks: scope.selectedStocks.map((stock) => ({ ...stock, assetGroup: stock.assetGroup ?? null })),
    selectedSectors: [...scope.selectedSectors],
    selectedThemes: [...scope.selectedThemes],
  };
}

function resolveStrategyUniverseScope(scope: BacktestUniverseScopePayload | null | undefined): BacktestUniverseScopePayload {
  if (!scope) {
    return createStrategyUniverseScope();
  }
  if (scope.mode !== "FULL_MARKET") {
    return cloneUniverseScope(scope);
  }
  const marketScope = scope.marketScope === "US" || scope.marketScope === "KOREA" || scope.marketScope === "GLOBAL"
    ? scope.marketScope
    : "GLOBAL";
  const assetScope = scope.assetScope === "ETF" || scope.assetScope === "ALL" || scope.assetScope === "STOCK"
    ? scope.assetScope
    : "STOCK";
  return {
    ...cloneUniverseScope(scope),
    overrideMode: "ONE_TIME_OVERRIDE",
    mode: "FULL_MARKET",
    marketScope,
    assetScope,
    lastUpdatedAt: scope.lastUpdatedAt ?? new Date().toISOString(),
  };
}

function TooltipLabel({ label }: { label: string }) {
  const description = FACTOR_GUIDES[label];
  return (
    <div className="flex items-center gap-1.5">
      <span>{label}</span>
      {description ? (
        <div className="group relative">
          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[color:var(--line)] text-[10px] text-[color:var(--fg-muted)]">
            <Icon name="status" className="h-2.5 w-2.5" />
          </span>
          <div className="pointer-events-none absolute left-0 top-6 z-20 hidden w-64 rounded-md border border-[color:var(--line)] bg-white p-2 text-[11px] leading-5 text-[color:var(--fg)] shadow-[0_16px_30px_rgba(15,23,42,0.08)] group-hover:block">
            {description}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SliderRow({
  label,
  hint,
  badge,
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  badge?: string;
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold"><TooltipLabel label={label} /></div>
          <p className="text-[11px] text-[color:var(--fg-muted)]">{hint}</p>
          {badge ? (
            <span className="mt-2 inline-flex rounded-full border border-[color:var(--line)] bg-white px-2 py-0.5 text-[10px] font-semibold text-[color:var(--fg-muted)]">
              {badge}
            </span>
          ) : null}
        </div>
        <span className="rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold">{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-3 w-full accent-black" />
    </div>
  );
}

function WeightControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13px] font-semibold"><TooltipLabel label={label} /></div>
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-16 rounded-md border border-[color:var(--line)] bg-white px-2 py-1 text-right text-[12px] font-semibold"
        />
      </div>
      <input type="range" min={0} max={100} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-3 w-full accent-black" />
    </div>
  );
}

function normalizeMarketLabel(exchange?: string | null) {
  const value = exchange?.toUpperCase() ?? "";
  if (value.includes("KOSPI") || value.includes("KOSDAQ") || value.includes("KRX") || value.includes("KOREA")) {
    return "한국";
  }
  if (value.includes("NASDAQ") || value.includes("NYSE") || value.includes("AMEX") || value.includes("USA") || value.includes("US")) {
    return "미국";
  }
  return "기타";
}

function getStrategyFlavor(weights: WeightMap) {
  const momentum = weights.momentum;
  const valueQuality = weights.value + weights.quality;
  const event = weights.news + weights.earnings_surprise + weights.insider_activity;
  if (event >= 30) {
    return "이벤트 반응형";
  }
  if (momentum >= 40 && momentum > valueQuality) {
    return "모멘텀 중심";
  }
  if (valueQuality >= 45) {
    return "가치+퀄리티 혼합";
  }
  return "균형 멀티 팩터";
}

const CORE_PATTERN_IDS = new Set([
  "fifty-two-week-high",
  "trendline-breakout",
  "momentum-continuation",
  "slope-angle-breakout",
]);

export function StrategyBuilderClient({
  initialStrategies,
  initialRequestedStrategyId,
}: {
  initialStrategies: StrategySummary[];
  initialRequestedStrategyId?: number;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roe, setRoe] = useState(0);
  const [pbr, setPbr] = useState(5);
  const [momentum, setMomentum] = useState(-10);
  const [stockCount, setStockCount] = useState(20);
  const [rebalance, setRebalance] = useState("monthly");
  const [universeScope, setUniverseScope] = useState<BacktestUniverseScopePayload>(() => createStrategyUniverseScope());
  const [factorMode, setFactorMode] = useState<FactorMode>("AUTO");
  const [weights, setWeights] = useState<WeightMap>(DEFAULT_WEIGHTS);
  const [selectedPreset, setSelectedPreset] = useState("균형형");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StrategyCandidateResult | null>(null);
  const [strategies, setStrategies] = useState(initialStrategies);
  const [snapshots, setSnapshots] = useState<StrategyWeightSnapshot[]>([]);
  const [candidateDetailsBySymbol, setCandidateDetailsBySymbol] = useState<Record<string, StockDataDetail>>({});
  const [editingStrategyId, setEditingStrategyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisToast, setAnalysisToast] = useState<{ tone: "success" | "error"; title: string; description: string } | null>(null);
  const [watchingAnalysisJobId, setWatchingAnalysisJobId] = useState<number | null>(null);
  const [patterns, setPatterns] = useState<QuantPattern[]>(() => DEFAULT_PATTERNS.map((pattern) => ({ ...pattern })));
  const [signalPlan, setSignalPlan] = useState<SignalPlan>({ ...DEFAULT_SIGNAL_PLAN });

  const rawTotal = useMemo(() => Object.values(weights).reduce((sum, value) => sum + value, 0), [weights]);
  const normalizedWeights = useMemo(() => normalizeWeights(factorMode === "AUTO" ? DEFAULT_WEIGHTS : weights), [factorMode, weights]);
  const hasPositiveWeight = useMemo(() => Object.values(weights).some((value) => value > 0), [weights]);
  const activeWeightMode = factorMode === "AUTO" ? DEFAULT_WEIGHTS : weights;
  const analysisInProgress = useMemo(() => ["QUEUED", "PENDING", "RUNNING"].includes(result?.analysisStatus ?? ""), [result?.analysisStatus]);
  const requestedStrategyId = initialRequestedStrategyId ?? null;
  const strategyUniverseSummary = useMemo(() => summarizeBacktestUniverseScope(universeScope), [universeScope]);

  const formulaPreview = useMemo(
    () => `복합 점수 = ${FACTOR_ORDER.map(({ key, label }) => `${label}(${normalizedWeights[key]}%)`).join(" + ")}`,
    [normalizedWeights],
  );

  const enabledPatterns = useMemo(() => patterns.filter((pattern) => pattern.enabled), [patterns]);
  const candidateWorkbench = useMemo(
    () => buildCandidateWorkbench(result?.candidates ?? [], patterns, signalPlan, { stockCount, momentum, rebalance }),
    [momentum, patterns, rebalance, result?.candidates, signalPlan, stockCount],
  );
  const topPatternName = useMemo(() => enabledPatterns[0]?.name ?? "패턴 없음", [enabledPatterns]);
  const patternSummary = useMemo(
    () => (enabledPatterns.length > 0 ? enabledPatterns.map((pattern) => pattern.shortLabel).join(" / ") : "선택된 패턴이 없습니다."),
    [enabledPatterns],
  );
  const currentStrategySummary = useMemo(
    () => strategies.find((strategy) => strategy.strategyId === (editingStrategyId ?? result?.strategyId ?? -1)) ?? null,
    [editingStrategyId, result?.strategyId, strategies],
  );

  async function refreshStrategies() {
    const latest = await getStrategies();
    setStrategies(latest);
  }

  async function refreshSnapshots(strategyId: number) {
    const latest = await getStrategySnapshots(strategyId);
    setSnapshots(latest);
  }

  async function refreshDiagnostics(strategyId: number) {
    const latest = await getStrategyDiagnostics(strategyId);
    setResult(latest);
    return latest;
  }

  function togglePattern(patternId: string) {
    setPatterns((current) => current.map((pattern) => (pattern.id === patternId ? { ...pattern, enabled: !pattern.enabled } : pattern)));
  }

  function restoreCorePatternSet() {
    setPatterns((current) => current.map((pattern) => ({ ...pattern, enabled: CORE_PATTERN_IDS.has(pattern.id) })));
  }

  function enableAllPresetPatterns() {
    setPatterns((current) => current.map((pattern) => ({ ...pattern, enabled: pattern.source === "preset" })));
  }

  function updateWeight(key: WeightKey, value: number) {
    setFactorMode("MANUAL");
    setWeights((current) => ({ ...current, [key]: Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)) }));
    setSelectedPreset("사용자 커스텀");
  }

  function applyPreset(values: WeightMap, label: string) {
    setWeights(values);
    setFactorMode("MANUAL");
    setSelectedPreset(label);
  }

  function handleSelectUniverseMarket(marketScope: StrategyUniverseMarketScope) {
    setUniverseScope((current) => createStrategyUniverseScope(marketScope, current.assetScope === "ETF" || current.assetScope === "ALL" ? current.assetScope : "STOCK"));
  }

  function handleSelectUniverseAsset(assetScope: StrategyUniverseAssetScope) {
    setUniverseScope((current) => createStrategyUniverseScope(
      current.marketScope === "US" || current.marketScope === "KOREA" || current.marketScope === "GLOBAL" ? current.marketScope : "GLOBAL",
      assetScope,
    ));
  }

  async function persistStrategy(options?: { moveToBacktest?: boolean }) {
    if (!name.trim()) {
      setError("전략 이름을 입력해야 저장할 수 있습니다.");
      return null;
    }
    if (factorMode === "MANUAL" && !hasPositiveWeight) {
      setError("수동 가중치는 최소 1개 이상 0보다 커야 합니다.");
      return null;
    }
    if (enabledPatterns.length === 0) {
      setError("최소 1개 이상의 패턴을 활성화해야 합니다.");
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        roe,
        pbr,
        momentum,
        stockCount,
        rebalance,
        factorWeightMode: factorMode,
        factorWeights: toRequestWeights(activeWeightMode),
        universeScope,
      };
      const response = editingStrategyId
        ? await updateStrategy(editingStrategyId, payload)
        : await createStrategy(payload);
      setResult(response);
      setEditingStrategyId(response.strategyId);
      setWatchingAnalysisJobId(
        response.analysisJobId && ["QUEUED", "PENDING", "RUNNING"].includes(response.analysisStatus ?? "")
          ? response.analysisJobId
          : null,
      );
      savePatternWorkspace(response.strategyId, { patterns, signalPlan, updatedAt: new Date().toISOString() });
      await refreshStrategies();
      await refreshSnapshots(response.strategyId);
      if (options?.moveToBacktest) {
        router.push(`/backtest-results?strategyId=${response.strategyId}`);
      }
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : "전략 저장 중 오류가 발생했습니다.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateStrategy() {
    await persistStrategy();
  }

  async function handleSaveAndMoveToBacktest() {
    await persistStrategy({ moveToBacktest: true });
  }

  async function handleDeleteStrategy(strategyId: number) {
    if (!window.confirm("전략을 삭제하면 목록에서 숨겨집니다. 계속하시겠습니까?")) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await deleteStrategy(strategyId);
      if (editingStrategyId === strategyId) {
        handleCancelEdit();
      }
      await refreshStrategies();
    } catch (err) {
      setError(err instanceof Error ? err.message : "전략 삭제 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const applyStrategyToEditor = useCallback((strategy: StrategySummary) => {
    setEditingStrategyId(strategy.strategyId);
    setName(strategy.name);
    setRoe(strategy.roe ?? 0);
    setPbr(strategy.pbr ?? 5);
    setMomentum(strategy.momentum ?? -10);
    setStockCount(strategy.stockCount ?? 20);
    setRebalance(strategy.rebalance ?? "monthly");
    setUniverseScope(resolveStrategyUniverseScope(strategy.universeScope));
    setFactorMode((strategy.factorWeightMode?.toUpperCase() as FactorMode) || "AUTO");
    setWeights({
      momentum: strategy.factorWeights.momentum ?? DEFAULT_WEIGHTS.momentum,
      value: strategy.factorWeights.value ?? DEFAULT_WEIGHTS.value,
      quality: strategy.factorWeights.quality ?? DEFAULT_WEIGHTS.quality,
      news: strategy.factorWeights.news ?? DEFAULT_WEIGHTS.news,
      earnings_surprise: strategy.factorWeights.earnings_surprise ?? DEFAULT_WEIGHTS.earnings_surprise,
      insider_activity: strategy.factorWeights.insider_activity ?? DEFAULT_WEIGHTS.insider_activity,
    });
    setSelectedPreset("사용자 커스텀");
    setError(null);
    void refreshSnapshots(strategy.strategyId);
    void refreshDiagnostics(strategy.strategyId);
  }, []);

  function handleEditStrategy(strategy: StrategySummary) {
    applyStrategyToEditor(strategy);
  }

  function handleDuplicateStrategy(strategy: StrategySummary) {
    const workspace = loadPatternWorkspace(strategy.strategyId);
    setEditingStrategyId(null);
    setName(`${strategy.name} 복제`);
    setRoe(strategy.roe ?? 0);
    setPbr(strategy.pbr ?? 5);
    setMomentum(strategy.momentum ?? -10);
    setStockCount(strategy.stockCount ?? 20);
    setRebalance(strategy.rebalance ?? "monthly");
    setUniverseScope(resolveStrategyUniverseScope(strategy.universeScope));
    setFactorMode((strategy.factorWeightMode?.toUpperCase() as FactorMode) || "AUTO");
    setWeights({
      momentum: strategy.factorWeights.momentum ?? DEFAULT_WEIGHTS.momentum,
      value: strategy.factorWeights.value ?? DEFAULT_WEIGHTS.value,
      quality: strategy.factorWeights.quality ?? DEFAULT_WEIGHTS.quality,
      news: strategy.factorWeights.news ?? DEFAULT_WEIGHTS.news,
      earnings_surprise: strategy.factorWeights.earnings_surprise ?? DEFAULT_WEIGHTS.earnings_surprise,
      insider_activity: strategy.factorWeights.insider_activity ?? DEFAULT_WEIGHTS.insider_activity,
    });
    setSelectedPreset(strategy.factorWeightMode === "MANUAL" ? "사용자 커스텀" : "균형형");
    setPatterns(workspace.patterns);
    setSignalPlan(workspace.signalPlan);
    setSnapshots([]);
    setResult(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingStrategyId(null);
    setName("");
    setResult(null);
    setUniverseScope(createStrategyUniverseScope());
    setFactorMode("AUTO");
    setWeights(DEFAULT_WEIGHTS);
    setSelectedPreset("균형형");
    setSnapshots([]);
    setError(null);
    setSignalPlan({ ...DEFAULT_SIGNAL_PLAN });
    setPatterns(DEFAULT_PATTERNS.map((pattern) => ({ ...pattern })));
    if (requestedStrategyId) {
      router.replace("/strategy-builder");
    }
  }

  async function handleSaveSnapshot() {
    if (!editingStrategyId) {
      setError("전략을 먼저 저장한 뒤 스냅샷을 만들 수 있습니다.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await createStrategySnapshot({
        strategyId: editingStrategyId,
        name: `${name.trim() || "전략"} 가중치 ${new Date().toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`,
        factorWeightMode: factorMode,
        factorWeights: toRequestWeights(activeWeightMode),
      });
      await refreshSnapshots(editingStrategyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "스냅샷 저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleMoveToBacktest() {
    if (!result?.strategyId && !editingStrategyId) {
      setError("먼저 전략을 저장한 뒤 백테스트를 실행해야 합니다.");
      return;
    }
    if (analysisInProgress) {
      setError("후보 종목 분석이 아직 진행 중입니다. 완료 후 백테스트를 실행하세요.");
      return;
    }
    router.push(`/backtest-results?strategyId=${result?.strategyId ?? editingStrategyId}`);
  }

  function handleMoveToPatternLab() {
    const strategyId = result?.strategyId ?? editingStrategyId;
    const latestBacktestId = currentStrategySummary?.latestBacktest?.backtestId ?? null;
    if (!strategyId || !latestBacktestId) {
      setError("패턴 실험실은 백테스트 완료 후 열 수 있습니다. 먼저 백테스트를 실행하세요.");
      return;
    }
    router.push(`/pattern-lab?strategyId=${strategyId}&backtestId=${latestBacktestId}`);
  }

  function handleBacktestFromTable(strategyId: number) {
    router.push(`/backtest-results?strategyId=${strategyId}`);
  }

  useEffect(() => {
    if (!editingStrategyId || !result?.analysisJobId || !analysisInProgress) {
      return;
    }

    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const latest = await refreshDiagnostics(editingStrategyId);
        if (cancelled) {
          return;
        }
        if (latest.analysisStatus === "COMPLETED") {
          await refreshStrategies();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "전략 분석 상태 조회 중 오류가 발생했습니다.");
        }
      }
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [analysisInProgress, editingStrategyId, result?.analysisJobId]);

  useEffect(() => {
    if (!watchingAnalysisJobId || result?.analysisJobId !== watchingAnalysisJobId) {
      return;
    }
    if (result.analysisStatus === "COMPLETED") {
      setAnalysisToast({
        tone: "success",
        title: "후보 종목 분석 완료",
        description: result.analysisMessage ?? `전략 ${result.strategyId} 후보 종목 분석이 완료되었습니다.`,
      });
      setWatchingAnalysisJobId(null);
      return;
    }
    if (result.analysisStatus === "FAILED") {
      setAnalysisToast({
        tone: "error",
        title: "후보 종목 분석 실패",
        description: result.analysisMessage ?? "전략은 저장되었지만 후보 종목 분석에 실패했습니다.",
      });
      setWatchingAnalysisJobId(null);
    }
  }, [result?.analysisJobId, result?.analysisMessage, result?.analysisStatus, result?.strategyId, watchingAnalysisJobId]);

  useEffect(() => {
    if (!analysisToast) {
      return;
    }
    const timer = window.setTimeout(() => {
      setAnalysisToast(null);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [analysisToast]);

  useEffect(() => {
    if (!requestedStrategyId || strategies.length === 0 || editingStrategyId === requestedStrategyId) {
      return;
    }
    const matched = strategies.find((strategy) => strategy.strategyId === requestedStrategyId);
    if (matched) {
      applyStrategyToEditor(matched);
    }
  }, [applyStrategyToEditor, editingStrategyId, requestedStrategyId, strategies]);

  useEffect(() => {
    const workspace = loadPatternWorkspace(editingStrategyId);
    setPatterns(workspace.patterns);
    setSignalPlan(workspace.signalPlan);
  }, [editingStrategyId]);

  useEffect(() => {
    savePatternWorkspace(editingStrategyId, { patterns, signalPlan, updatedAt: new Date().toISOString() });
  }, [editingStrategyId, patterns, signalPlan]);

  useEffect(() => {
    const symbols = (result?.candidates ?? []).slice(0, 12).map((candidate) => candidate.symbol).filter((symbol) => candidateDetailsBySymbol[symbol] == null);
    if (symbols.length === 0) {
      return;
    }
    let cancelled = false;
    void Promise.all(
      symbols.map(async (symbol) => {
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
        setCandidateDetailsBySymbol((current) => ({ ...current, ...Object.fromEntries(resolved) }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [candidateDetailsBySymbol, result?.candidates]);

  const previewDetails = useMemo(
    () => (result?.candidates ?? []).slice(0, 12).map((candidate) => candidateDetailsBySymbol[candidate.symbol]).filter((detail): detail is StockDataDetail => detail != null),
    [candidateDetailsBySymbol, result?.candidates],
  );
  const topSectorSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const detail of previewDetails) {
      const sector = detail.sector ?? "섹터 미분류";
      counts.set(sector, (counts.get(sector) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
    return top ? `${top[0]} 중심` : "섹터 데이터 수집 중";
  }, [previewDetails]);
  const marketMixSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const detail of previewDetails) {
      const market = normalizeMarketLabel(detail.exchange);
      counts.set(market, (counts.get(market) ?? 0) + 1);
    }
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
      return "시장 데이터 수집 중";
    }
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([market, count]) => `${market} ${Math.round((count / total) * 100)}%`)
      .join(" / ");
  }, [previewDetails]);
  const strategyFlavor = useMemo(() => getStrategyFlavor(normalizedWeights), [normalizedWeights]);
  const currentWeightProfile = useMemo(
    () => (factorMode === "AUTO" ? "엔진 추천 프로필" : `${selectedPreset} · 직접 설정`),
    [factorMode, selectedPreset],
  );

  return (
    <div className="space-y-4">
      {analysisToast ? (
        <div className="pointer-events-none fixed right-4 top-20 z-50 flex w-[320px] flex-col gap-2">
          <div
            className={`pointer-events-auto rounded-md border p-3 shadow-[0_18px_40px_rgba(15,23,42,0.16)] ${
              analysisToast.tone === "success" ? "border-emerald-200 bg-white" : "border-rose-200 bg-white"
            }`}
          >
            <div className="flex items-start gap-2">
              <div className={`mt-0.5 h-2.5 w-2.5 rounded-full ${analysisToast.tone === "success" ? "bg-emerald-500" : "bg-rose-500"}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] font-semibold ${analysisToast.tone === "success" ? "text-emerald-700" : "text-rose-700"}`}>{analysisToast.title}</p>
                <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{analysisToast.description}</p>
              </div>
              <button type="button" onClick={() => setAnalysisToast(null)} className="flex h-5 w-5 items-center justify-center rounded-sm text-[color:var(--fg-muted)] hover:bg-[#f5f7fb] hover:text-[color:var(--fg)]">
                <Icon name="close" className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DashboardCard
        title="전략 생성 액션"
        subtitle="설정 → 검증 → 실험 흐름으로 바로 이어질 수 있도록 저장, 백테스트, 스냅샷 작업을 상단에서 처리합니다."
        action={
          <>
            <PrimaryButton label={loading ? (editingStrategyId ? "전략 수정 중" : "전략 저장 중") : "전략 저장"} onClick={handleCreateStrategy} disabled={loading} />
            <SecondaryButton label="저장 후 백테스트" onClick={handleSaveAndMoveToBacktest} disabled={loading} icon="backtest" />
            <SecondaryButton label="가중치 스냅샷 저장" onClick={handleSaveSnapshot} disabled={!editingStrategyId || loading} />
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["현재 편집 상태", editingStrategyId ? "기존 전략 수정" : "신규 전략 설계", editingStrategyId ? name || "저장된 전략" : "아직 저장되지 않은 초안"],
            ["현재 전략 유니버스", strategyUniverseSummary.shortLabel, strategyUniverseSummary.description],
            ["현재 가중치 프로필", currentWeightProfile, factorMode === "AUTO" ? "추천 가중치가 자동 적용됩니다." : "직접 설정값은 저장 시 정규화됩니다."],
            ["연결된 최신 백테스트", currentStrategySummary?.latestBacktest ? `#${currentStrategySummary.latestBacktest.backtestId}` : "없음", currentStrategySummary?.latestBacktest ? "백테스트에서 종목 선별 성과를 검증할 수 있습니다." : "저장 후 백테스트 단계로 넘어가세요."],
            ["연결된 패턴 요약", `${enabledPatterns.length}개`, "패턴 상세 실험은 패턴 실험실에서 진행합니다."],
          ].map(([label, value, caption]) => (
            <div key={label} className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--fg-muted)]">{label}</p>
              <p className="mt-2 text-[18px] font-semibold text-[color:var(--fg)]">{value}</p>
              <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{caption}</p>
            </div>
          ))}
        </div>
      </DashboardCard>

      {error ? <StatusNotice title="전략 생성 실패" description={error} /> : null}
      {result?.analysisStatus === "QUEUED" || result?.analysisStatus === "PENDING" || result?.analysisStatus === "RUNNING" ? (
        <StatusNotice title="전략 저장 완료" description={result.analysisMessage ?? "후보 종목 분석을 백그라운드에서 진행 중입니다. 완료되면 자동으로 반영됩니다."} />
      ) : null}
      {result?.analysisStatus === "FAILED" ? (
        <StatusNotice title="후보 종목 분석 실패" description={result.analysisMessage ?? "전략은 저장되었지만 후보 종목 분석에는 실패했습니다."} />
      ) : null}
      {result?.analysisStatus === "STALE" ? (
        <StatusNotice title="후보 종목 분석 필요" description={result.analysisMessage ?? "현재 전략의 최신 후보 종목 분석이 없습니다. 전략을 다시 저장하면 백그라운드 분석이 시작됩니다."} />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.18fr_0.98fr]">
        <DashboardCard title="1. 종목 선별 규칙" subtitle="재무 팩터, 이벤트 팩터, 유니버스 크기, 리밸런싱 규칙을 정의해 선별 전략의 골격을 만듭니다.">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-2 rounded-md border border-[color:var(--line)] bg-white p-3">
                <span className="text-[13px] font-semibold">전략 이름</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="예: AI 성장 모멘텀"
                  className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium"
                />
                <p className="text-[11px] text-[color:var(--fg-muted)]">전략 저장 후 백테스트, 비교, 최적화 화면에서 공통 식별자로 사용됩니다.</p>
              </label>
              <div className="rounded-md border border-[color:var(--line)] bg-white p-3">
                <p className="text-[13px] font-semibold">종목 수</p>
                <input type="range" min={5} max={50} value={stockCount} onChange={(event) => setStockCount(Number(event.target.value))} className="mt-3 w-full accent-black" />
                <p className="mt-2 text-[18px] font-semibold text-[color:var(--fg)]">{stockCount} 종목</p>
                <p className="text-[11px] text-[color:var(--fg-muted)]">리밸런싱 시점마다 편입할 목표 종목 수</p>
              </div>
              <div className="rounded-md border border-[color:var(--line)] bg-white p-3">
                <p className="text-[13px] font-semibold">리밸런싱 주기</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                  {[
                    ["월간", "monthly"],
                    ["분기", "quarterly"],
                    ["반기", "semiannual"],
                  ].map(([label, value]) => (
                    <button key={value} type="button" onClick={() => setRebalance(value)} className={`rounded-md border px-3 py-2 font-medium ${rebalance === value ? "border-black bg-black text-white" : "border-[color:var(--line)] hover:bg-[color:var(--surface-muted)]"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-[color:var(--fg-muted)]">선별 주기와 turnover 수준에 직접 영향을 줍니다.</p>
              </div>
            </div>

            <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-[color:var(--fg)]">전략 유니버스</p>
                  <p className="mt-1 text-[12px] leading-6 text-[color:var(--fg-muted)]">
                    전략 생성 단계에서 후보를 고를 기본 시장과 자산군을 지정합니다. 시장과 자산군 조합은 후보 분석, 백테스트 기본값, 패턴 실험실 전달 대상에 그대로 이어집니다.
                  </p>
                </div>
                <span className="inline-flex h-8 items-center rounded-full border border-[rgba(59,130,246,0.2)] bg-[rgba(59,130,246,0.08)] px-3 text-[12px] font-semibold text-[color:var(--kpi)]">
                  {strategyUniverseSummary.shortLabel}
                </span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {STRATEGY_UNIVERSE_OPTIONS.map((option) => {
                  const active = universeScope.mode === "FULL_MARKET" && universeScope.marketScope === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelectUniverseMarket(option.value)}
                      className={`rounded-md border px-3 py-3 text-left transition ${
                        active
                          ? "border-[color:var(--kpi)] bg-[rgba(21,94,239,0.08)]"
                          : "border-[color:var(--line)] bg-white hover:bg-[#f8fafc]"
                      }`}
                    >
                      <p className="text-[13px] font-semibold text-[color:var(--fg)]">{option.label}</p>
                      <p className="mt-1 text-[11px] leading-5 text-[color:var(--fg-muted)]">{option.description}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {STRATEGY_UNIVERSE_ASSET_OPTIONS.map((option) => {
                  const active = universeScope.mode === "FULL_MARKET" && universeScope.assetScope === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelectUniverseAsset(option.value)}
                      className={`rounded-md border px-3 py-3 text-left transition ${
                        active
                          ? "border-[color:var(--buy)] bg-[rgba(16,185,129,0.08)]"
                          : "border-[color:var(--line)] bg-white hover:bg-[#f8fafc]"
                      }`}
                    >
                      <p className="text-[13px] font-semibold text-[color:var(--fg)]">{option.label}</p>
                      <p className="mt-1 text-[11px] leading-5 text-[color:var(--fg-muted)]">{option.description}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[color:var(--fg-muted)]">
                <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-1">현재 범위 {strategyUniverseSummary.title}</span>
                <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-1">자산군 {universeScope.assetScope === "ETF" ? "ETF" : universeScope.assetScope === "ALL" ? "주식 + ETF" : "주식"}</span>
                <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-1">백테스트 기본값으로 이어짐</span>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div>
                <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-[color:var(--fg-muted)]">재무 팩터</p>
                <div className="grid gap-3">
                  <SliderRow label="ROE" hint="0이면 사실상 필터를 거의 사용하지 않습니다." badge="높을수록 우선" min={0} max={30} value={roe} onChange={setRoe} />
                  <SliderRow label="PBR" hint="상한이 낮을수록 저평가 종목 위주로 선별합니다." badge="낮을수록 우선" min={0.1} max={5} step={0.1} value={pbr} onChange={setPbr} />
                  <SliderRow label="모멘텀" hint="-10이면 짧은 이력 종목도 폭넓게 검토합니다." badge="높을수록 우선" min={-10} max={10} value={momentum} onChange={setMomentum} />
                  <SliderRow label="시가총액" hint="현재 엔진 미리보기 전용" badge="현재 미리보기 전용" min={0} max={100} value={30} onChange={() => {}} />
                  <SliderRow label="거래량" hint="현재 엔진 미리보기 전용" badge="현재 미리보기 전용" min={0} max={100} value={50} onChange={() => {}} />
                </div>
              </div>
              <div>
                <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-[color:var(--fg-muted)]">이벤트 팩터</p>
                <div className="grid gap-3">
                  <SliderRow label="뉴스 감성" hint="DB에 저장된 최근 뉴스 감성 평균을 보조 팩터로 반영합니다." badge="높을수록 우선" min={0} max={100} value={weights.news} onChange={(value) => updateWeight("news", value)} />
                  <SliderRow label="실적 서프라이즈" hint="EPS 컨센서스 대비 실제 실적의 상회·하회를 구조화 이벤트로 반영합니다." badge="높을수록 우선" min={0} max={100} value={weights.earnings_surprise} onChange={(value) => updateWeight("earnings_surprise", value)} />
                  <SliderRow label="내부자 거래" hint="내부자 순매수·순매도 활동을 구조화 이벤트로 반영합니다." badge="높을수록 우선" min={0} max={100} value={weights.insider_activity} onChange={(value) => updateWeight("insider_activity", value)} />
                </div>
              </div>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard title="가중치 설정 / 복합 점수 미리보기" subtitle={factorMode === "AUTO" ? "추천 가중치로 빠르게 전략 성격을 잡습니다." : "직접 가중치를 조절해 전략 성격을 미세 조정합니다."}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              {[
                ["AUTO", "추천"],
                ["MANUAL", "직접 설정"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFactorMode(value as FactorMode)}
                  className={`rounded-md border px-3 py-2 font-semibold ${factorMode === value ? "border-black bg-black text-white" : "border-[color:var(--line)] bg-white"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-3 text-[12px]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[color:var(--fg)]">현재 가중치 프로필</p>
                  <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{currentWeightProfile}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${factorMode === "AUTO" ? "bg-blue-50 text-[color:var(--kpi)]" : rawTotal === 100 ? "bg-emerald-50 text-[color:var(--buy)]" : "bg-amber-50 text-amber-700"}`}>
                  {factorMode === "AUTO" ? "합계 100%" : rawTotal === 100 ? "합계 100%" : `합계 ${rawTotal}%`}
                </span>
              </div>
            </div>

            {factorMode === "MANUAL" ? (
              <>
                <div className="grid gap-2 md:grid-cols-2">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset.values, preset.label)}
                      className={`rounded-md border px-3 py-2 text-left ${selectedPreset === preset.label ? "border-black bg-[color:var(--surface-muted)]" : "border-[color:var(--line)] bg-white"}`}
                    >
                      <p className="text-[12px] font-semibold">{preset.label}</p>
                      <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{preset.description}</p>
                    </button>
                  ))}
                </div>
                <div className="grid gap-3">
                  <WeightControl label="모멘텀" value={weights.momentum} onChange={(value) => updateWeight("momentum", value)} />
                  <WeightControl label="가치" value={weights.value} onChange={(value) => updateWeight("value", value)} />
                  <WeightControl label="퀄리티" value={weights.quality} onChange={(value) => updateWeight("quality", value)} />
                  <WeightControl label="뉴스 감성" value={weights.news} onChange={(value) => updateWeight("news", value)} />
                  <WeightControl label="실적 서프라이즈" value={weights.earnings_surprise} onChange={(value) => updateWeight("earnings_surprise", value)} />
                  <WeightControl label="내부자 거래" value={weights.insider_activity} onChange={(value) => updateWeight("insider_activity", value)} />
                </div>
              </>
            ) : (
              <div className="space-y-3 text-[12px]">
                {FACTOR_ORDER.map(({ key, label }) => (
                  <div key={label} className="flex items-center justify-between rounded-md border border-[color:var(--line)] bg-white px-3 py-2">
                    <span className="font-semibold">{label}</span>
                    <span>{DEFAULT_WEIGHTS[key]}%</span>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-md border border-[color:var(--line)] bg-[#f7f9fc] p-3 font-mono text-[12px] leading-6 text-[color:var(--fg)]">
              <p>{formulaPreview}</p>
              <p className="mt-2 text-[color:var(--fg-muted)]">저장 필드: ROE {roe} / PBR {pbr} / 모멘텀 {momentum} / 종목수 {stockCount} / 리밸런싱 {rebalance}</p>
              <p className="mt-2 text-[color:var(--fg-muted)]">전략 유니버스: {strategyUniverseSummary.shortLabel}</p>
              <p className="mt-2 text-[11px] text-[color:var(--fg-muted)]">정규화 결과 {formatWeightSummary(normalizedWeights)}</p>
            </div>

            {normalizedWeights.news + normalizedWeights.earnings_surprise + normalizedWeights.insider_activity >= 35 ? (
              <StatusNotice title="이벤트 비중 경고" description="이벤트 비중이 높아 단기 변동성과 과최적화 가능성이 커질 수 있습니다. 기간 분리 백테스트를 권장합니다." />
            ) : null}
          </div>
        </DashboardCard>
      </section>

      <DashboardCard
        title="보조 패턴 연결"
        subtitle="전략 생성 단계에서는 사용할 패턴 세트만 선택합니다. 세부 파라미터 조정과 시그널 검증은 패턴 실험실에서 이어집니다."
        action={
          <>
            <SecondaryButton label="핵심 4패턴 복원" onClick={restoreCorePatternSet} />
            <SecondaryButton label="전체 기본 패턴" onClick={enableAllPresetPatterns} />
          </>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-[color:var(--fg-muted)]">
          <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-1">활성 패턴 {enabledPatterns.length}개</span>
          <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-1">{patternSummary}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {patterns.map((pattern) => (
            <button
              key={pattern.id}
              type="button"
              onClick={() => togglePattern(pattern.id)}
              className={`rounded-md border p-3 text-left transition ${pattern.enabled ? "border-black bg-[color:var(--surface-muted)]" : "border-[color:var(--line)] bg-white hover:bg-[color:var(--surface-muted)]"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-[color:var(--line)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--fg-muted)]">{pattern.shortLabel}</span>
                    <span className="text-[11px] text-[color:var(--fg-muted)]">{pattern.category}</span>
                  </div>
                  <p className="mt-2 text-[14px] font-semibold text-[color:var(--fg)]">{pattern.name}</p>
                  <p className="mt-1 text-[11px] leading-5 text-[color:var(--fg-muted)]">{pattern.ruleSummary}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${pattern.enabled ? "bg-black text-white" : "border border-[color:var(--line)] bg-white text-[color:var(--fg-muted)]"}`}>
                  {pattern.enabled ? "ON" : "OFF"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-[color:var(--fg-muted)]">
                <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-0.5">보유 {pattern.holdingDays}일</span>
                <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-0.5">룩백 {pattern.lookbackDays}일</span>
                <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-0.5">거래량 {pattern.volumeSurgePercent}%</span>
              </div>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-5 text-[color:var(--fg-muted)]">
          여기서 켠 패턴 세트는 저장 후 백테스트와 패턴 실험실에 동일하게 전달됩니다. `LSR / IPC`도 기존 `52W / BRK / MOM / SLP / VCP`와 같은 방식으로 비교할 수 있습니다.
        </p>
      </DashboardCard>

      <DashboardCard title="2. 전략 결과 미리보기" subtitle="설정값 기준으로 예상 선별 종목군과 전략 성격을 먼저 요약합니다. 실제 성과 검증은 다음 단계인 백테스트에서 수행합니다.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["전략 유니버스", strategyUniverseSummary.shortLabel, strategyUniverseSummary.description],
            ["예상 선별 종목 수", result?.candidates.length ? `${result.candidates.length}개` : "-", result ? "현재 조건을 통과한 예상 종목 수" : "전략 저장 후 계산됩니다."],
            ["예상 상위 섹터", topSectorSummary, previewDetails.length > 0 ? "상위 후보 상세 데이터 기준" : "후보 종목 상세 로딩 후 계산됩니다."],
            ["예상 시장 비중", marketMixSummary, previewDetails.length > 0 ? "상위 후보 상세 데이터 기준" : "후보 종목 상세 로딩 후 계산됩니다."],
            ["현재 전략 성격", strategyFlavor, factorMode === "AUTO" ? "추천 가중치 해석" : "현재 가중치 구성 해석"],
            ["현재 연결된 패턴 수", `${enabledPatterns.length}개`, patternSummary],
          ].map(([label, value, caption]) => (
            <div key={label} className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--fg-muted)]">{label}</p>
              <p className="mt-2 text-[18px] font-semibold text-[color:var(--fg)]">{value}</p>
              <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{caption}</p>
            </div>
          ))}
        </div>

        {result ? (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {[
              ["전략 유니버스", result.diagnostics.totalSymbols],
              ["재무 데이터 보유", result.diagnostics.fundamentalsReadyCount],
              ["ROE 통과", result.diagnostics.roePassCount],
              ["PBR 통과", result.diagnostics.pbrPassCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-[color:var(--line)] bg-white px-3 py-3">
                <p className="text-[11px] text-[color:var(--fg-muted)]">{label}</p>
                <p className="mt-2 text-[18px] font-semibold text-[color:var(--fg)]">{value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4">
          {analysisInProgress ? (
            <StatusNotice title="후보 종목 분석 진행 중" description={result?.analysisMessage ?? `저장된 전략 기준으로 ${strategyUniverseSummary.shortLabel} 유니버스를 분석하고 있습니다. 완료되면 예상 선별 종목과 미리보기가 자동 갱신됩니다.`} />
          ) : candidateWorkbench.length > 0 ? (
            <DataTable
              title="예상 상위 종목"
              columns={["종목", "예상 점수", "연결 패턴", "전략 요약", "선택 근거"]}
              rows={candidateWorkbench.map((candidate) => [
                candidate.symbol,
                `${candidate.score.toFixed(2)} / ${candidate.conviction}점`,
                <div key={`${candidate.symbol}-patterns`} className="flex flex-wrap gap-1.5">
                  {candidate.activePatterns.map((patternName) => (
                    <span key={`${candidate.symbol}-${patternName}`} className="rounded-full border border-[color:var(--line)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--fg-muted)]">
                      {patternName}
                    </span>
                  ))}
                </div>,
                `${strategyFlavor} · ${candidate.entryLabel}`,
                `${candidate.rationale} / ${candidate.sellLabel}`,
              ])}
              pageSize={8}
            />
          ) : result ? (
            <StatusNotice
              title="후보 종목이 없습니다."
              description={`현재 전략 조건으로는 선택 가능한 종목이 없습니다. ${strategyUniverseSummary.shortLabel} ${result.diagnostics.totalSymbols}개 중 가격 통과 ${result.diagnostics.priceReadyCount}개, 재무 데이터 보유 ${result.diagnostics.fundamentalsReadyCount}개, ROE 통과 ${result.diagnostics.roePassCount}개, PBR 통과 ${result.diagnostics.pbrPassCount}개, 모멘텀 통과 ${result.diagnostics.momentumPassCount}개입니다.`}
            />
          ) : (
            <StatusNotice title="전략 결과 미리보기가 아직 없습니다." description="전략을 저장하면 예상 선별 종목 수, 섹터/시장 비중, 상위 종목 목록을 여기서 미리 확인할 수 있습니다." />
          )}
        </div>
      </DashboardCard>

      <DashboardCard title="3. 액션 / handoff" subtitle="전략 생성은 설계에 집중하고, 종목 검증은 백테스트에서, 매수/매도 패턴 실험은 패턴 실험실에서 이어집니다.">
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-[color:var(--line)] bg-white px-3 py-3">
              <p className="text-[13px] font-semibold text-[color:var(--fg)]">1. 전략 저장</p>
              <p className="mt-2 text-[12px] leading-6 text-[color:var(--fg-muted)]">팩터, 가중치, 유니버스, 리밸런싱 규칙을 저장해 선별 전략을 확정합니다.</p>
              <div className="mt-4">
                <PrimaryButton label="지금 저장" onClick={handleCreateStrategy} disabled={loading} />
              </div>
            </div>
            <div className="rounded-md border border-[color:var(--line)] bg-white px-3 py-3">
              <p className="text-[13px] font-semibold text-[color:var(--fg)]">2. 백테스트 실행</p>
              <p className="mt-2 text-[12px] leading-6 text-[color:var(--fg-muted)]">과거 시점에서 어떤 종목이 선별됐고 성과가 어땠는지 검증합니다.</p>
              <div className="mt-4">
                <SecondaryButton label="백테스트로 이동" onClick={handleMoveToBacktest} disabled={analysisInProgress || (result?.diagnostics.finalSelectedCount ?? 0) === 0} icon="backtest" />
              </div>
            </div>
            <div className="rounded-md border border-[color:var(--line)] bg-white px-3 py-3">
              <p className="text-[13px] font-semibold text-[color:var(--fg)]">3. 패턴 실험실 이동</p>
              <p className="mt-2 text-[12px] leading-6 text-[color:var(--fg-muted)]">선별 종목의 BUY / SELL / HOLD 타이밍과 권장 가격은 별도 실험실에서 검증합니다.</p>
              <p className="mt-2 text-[11px] font-semibold text-[color:var(--fg-muted)]">백테스트 후 권장</p>
              <div className="mt-4">
                <SecondaryButton label="패턴 실험실 보기" onClick={handleMoveToPatternLab} disabled={!currentStrategySummary?.latestBacktest?.backtestId} icon="research" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-3">
              <p className="text-[13px] font-semibold text-[color:var(--fg)]">패턴 연구 handoff</p>
              <p className="mt-2 text-[12px] leading-6 text-[color:var(--fg-muted)]">패턴 설정은 별도 실험실에서 관리됩니다. 현재 전략과 연결된 패턴 요약만 표시합니다.</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-[color:var(--line)] bg-white px-3 py-3">
                  <p className="text-[11px] text-[color:var(--fg-muted)]">연결 패턴 수</p>
                  <p className="mt-2 text-[18px] font-semibold text-[color:var(--fg)]">{enabledPatterns.length}개</p>
                  <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">현재 리더 패턴 {topPatternName}</p>
                </div>
                <div className="rounded-md border border-[color:var(--line)] bg-white px-3 py-3">
                  <p className="text-[11px] text-[color:var(--fg-muted)]">진입 / 청산 규칙</p>
                  <p className="mt-2 text-[14px] font-semibold text-[color:var(--fg)]">{signalPlan.buyMode}</p>
                  <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{signalPlan.sellMode}</p>
                </div>
                <div className="rounded-md border border-[color:var(--line)] bg-white px-3 py-3">
                  <p className="text-[11px] text-[color:var(--fg-muted)]">연결 상태</p>
                  <p className="mt-2 text-[14px] font-semibold text-[color:var(--fg)]">{currentStrategySummary?.latestBacktest ? "백테스트 연결됨" : "백테스트 대기"}</p>
                  <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">최신 백테스트 {currentStrategySummary?.latestBacktest ? `#${currentStrategySummary.latestBacktest.backtestId}` : "없음"}</p>
                </div>
                <div className="rounded-md border border-[color:var(--line)] bg-white px-3 py-3">
                  <p className="text-[11px] text-[color:var(--fg-muted)]">액션</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <SecondaryButton label="패턴 실험실 열기" onClick={handleMoveToPatternLab} disabled={!currentStrategySummary?.latestBacktest?.backtestId} icon="research" />
                    <SecondaryButton label="백테스트 결과 보기" onClick={handleMoveToBacktest} disabled={analysisInProgress || (result?.diagnostics.finalSelectedCount ?? 0) === 0} icon="backtest" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardCard>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <DashboardCard title="가중치 스냅샷" subtitle="현재 전략에서 저장한 가중치 실험 버전입니다. 백테스트에서 선택해 비교할 수 있습니다.">
          {snapshots.length > 0 ? (
            <DataTable
              columns={["스냅샷", "모드", "가중치", "생성 시각"]}
              rows={snapshots.map((snapshot) => [
                snapshot.name,
                snapshot.factorWeightMode === "MANUAL" ? "직접 설정" : "추천",
                formatWeightSummary(snapshot.factorWeights as Partial<Record<WeightKey, number>>),
                new Date(snapshot.createdAt).toLocaleString("ko-KR"),
              ])}
              pageSize={5}
            />
          ) : (
            <StatusNotice title="저장된 스냅샷이 없습니다." description="전략 저장 후 가중치 스냅샷 저장 버튼으로 버전을 쌓아 비교할 수 있습니다." />
          )}
        </DashboardCard>

        <DashboardCard title="저장된 전략" subtitle="전략 생성 화면은 설계 허브 역할을 하며, 저장된 전략을 수정·복제·백테스트 단계로 넘깁니다.">
          {strategies.length > 0 ? (
            <DataTable
              columns={["전략", "유니버스", "가중치 모드", "가중치", "상태", "작업"]}
              rows={strategies.map((strategy) => [
                strategy.name,
                summarizeBacktestUniverseScope(resolveStrategyUniverseScope(strategy.universeScope)).shortLabel,
                strategy.factorWeightMode === "MANUAL" ? "직접 설정" : "추천",
                formatWeightSummary(strategy.factorWeights as Partial<Record<WeightKey, number>>),
                strategy.status,
                <div key={`actions-${strategy.strategyId}`} className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => handleEditStrategy(strategy)} className="text-[11px] font-semibold text-[color:var(--kpi)]">수정</button>
                  <button type="button" onClick={() => handleDuplicateStrategy(strategy)} className="text-[11px] font-semibold text-[color:var(--fg)]">복제</button>
                  <button type="button" onClick={() => handleBacktestFromTable(strategy.strategyId)} className="text-[11px] font-semibold text-[color:var(--buy)]">백테스트</button>
                  <button type="button" onClick={() => void handleDeleteStrategy(strategy.strategyId)} className="text-[11px] font-semibold text-[color:var(--sell)]">삭제</button>
                </div>,
              ])}
              pageSize={6}
            />
          ) : (
            <StatusNotice title="등록된 전략이 없습니다." description="전략을 저장하면 백테스트, 최적화, 비교 페이지에서 바로 선택할 수 있습니다." />
          )}
          {editingStrategyId ? (
            <div className="mt-3 flex justify-end">
              <SecondaryButton label="수정 취소" onClick={handleCancelEdit} />
            </div>
          ) : null}
        </DashboardCard>
      </section>
    </div>
  );
}
