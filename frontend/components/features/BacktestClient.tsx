"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { BacktestSelectionWorkbench } from "@/components/features/BacktestSelectionWorkbench";
import { BacktestUniverseConfigurator } from "@/components/features/BacktestUniverseConfigurator";
import { SignalOverlayChart } from "@/components/features/SignalOverlayChart";
import { ChartPanel } from "@/components/ui/ChartPanel";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { DataTable } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/ui/MetricCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SignalBadge } from "@/components/ui/SignalBadge";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { buildSignalOverlayMarkers, summarizeSignalState } from "@/lib/backtest-signal";
import {
  getBacktestDetail,
  getBacktestHistory,
  getBacktestJobStatus,
  getJobs,
  getStrategyDiagnostics,
  getStrategySnapshots,
  runBacktest,
  type BacktestHistoryItem,
  type BacktestJobStatus,
  type JobItem,
  type BacktestResult,
  type StrategyDiagnosticsResult,
  type StrategySummary,
  type StrategyWeightSnapshot,
} from "@/lib/api";
import {
  createDefaultBacktestUniverseScope,
  summarizeBacktestUniverseScope,
  validateBacktestUniverseScope,
  type BacktestUniverseScopePayload,
} from "@/lib/backtest-universe";
import { formatPercent } from "@/lib/format";
import {
  DEFAULT_PATTERNS,
  DEFAULT_SIGNAL_PLAN,
  buildBacktestWorkbench,
  loadPatternWorkspace,
  type QuantPattern,
  type SignalAction,
} from "@/lib/quant-workbench";

type BacktestPatternExecutionMode = "linked" | "all-presets";

const CORE_PATTERN_IDS = new Set([
  "fifty-two-week-high",
  "trendline-breakout",
  "momentum-continuation",
  "slope-angle-breakout",
]);

const REGISTERED_BACKTEST_PATTERN_IDS = new Set([
  "liquidity-sweep-reversal",
  "imbalance-pullback-continuation",
  "fifty-two-week-high",
  "trendline-breakout",
  "momentum-continuation",
  "slope-angle-breakout",
  "volatility-squeeze",
]);

function isBacktestRegisteredPattern(pattern: Pick<QuantPattern, "id" | "source">) {
  return pattern.source === "preset" && REGISTERED_BACKTEST_PATTERN_IDS.has(pattern.id);
}

function sanitizeBacktestSelectablePatterns(patterns: QuantPattern[]) {
  return patterns.map((pattern) => (
    isBacktestRegisteredPattern(pattern)
      ? { ...pattern }
      : { ...pattern, enabled: false }
  ));
}

function toDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getSignalTone(signal: SignalAction) {
  if (signal === "BUY") {
    return "buy" as const;
  }
  if (signal === "SELL") {
    return "sell" as const;
  }
  return "hold" as const;
}

function parseDateMs(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function diffDaysInclusive(startDate: string, endDate: string) {
  const start = Date.parse(startDate);
  const end = Date.parse(endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 365;
  }
  const days = Math.floor((end - start) / 86_400_000) + 1;
  return Math.max(days, 1);
}

function estimateRebalanceCount(rebalance: string | null | undefined, startDate: string, endDate: string) {
  const days = diffDaysInclusive(startDate, endDate);
  const mode = (rebalance ?? "monthly").toLowerCase();
  if (mode.includes("week")) {
    return Math.max(1, Math.ceil(days / 7));
  }
  if (mode.includes("quarter")) {
    return Math.max(1, Math.ceil(days / 90));
  }
  if (mode.includes("year")) {
    return Math.max(1, Math.ceil(days / 365));
  }
  if (mode.includes("day")) {
    return Math.max(1, Math.ceil(days));
  }
  return Math.max(1, Math.ceil(days / 30));
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const remainSeconds = safe % 60;
  if (minutes <= 0) {
    return `${remainSeconds}초`;
  }
  return `${minutes}분 ${remainSeconds}초`;
}

function estimateBacktestSeconds({
  startDate,
  endDate,
  rebalance,
  selectedCount,
  patternCount,
}: {
  startDate: string;
  endDate: string;
  rebalance: string | null | undefined;
  selectedCount: number;
  patternCount: number;
}) {
  const days = diffDaysInclusive(startDate, endDate);
  const rebalanceCount = estimateRebalanceCount(rebalance, startDate, endDate);
  const effectiveSelectedCount = Math.max(selectedCount, 1);
  const effectivePatternCount = Math.max(patternCount, 1);
  const estimateSeconds = Math.max(
    20,
    Math.min(
      300,
      Math.round(
        16
          + Math.min(days / 20, 50) * 0.9
          + rebalanceCount * 2.8
          + effectiveSelectedCount * 0.85
          + effectivePatternCount * 3.5,
      ),
    ),
  );
  return {
    estimateSeconds,
    rebalanceCount,
    periodDays: days,
  };
}

function resolveBacktestStageLabel(status: string, progressPercent: number) {
  if (status === "QUEUED" || status === "PENDING") {
    return "큐 대기 및 실행 슬롯 확보";
  }
  if (progressPercent < 20) {
    return "전략 / 기간 / 패턴 조건 검증";
  }
  if (progressPercent < 55) {
    return "리밸런싱 시점별 종목 선별 계산";
  }
  if (progressPercent < 85) {
    return "종목별 수익률 및 거래 로그 집계";
  }
  return "백테스트 결과 저장 및 마무리";
}

function backtestNoticeTone(status: "running" | "success" | "error") {
  if (status === "success") {
    return "success" as const;
  }
  if (status === "error") {
    return "error" as const;
  }
  return "info" as const;
}

function cloneUniverseScope(scope: BacktestUniverseScopePayload) {
  return {
    ...scope,
    assetScope: scope.assetScope ?? (scope.overrideMode === "ONE_TIME_OVERRIDE" ? "STOCK" : "STRATEGY_DEFAULT"),
    selectedStocks: scope.selectedStocks.map((stock) => ({ ...stock, assetGroup: stock.assetGroup ?? null })),
    selectedSectors: [...scope.selectedSectors],
    selectedThemes: [...scope.selectedThemes],
  };
}

function resolvePatternExecutionModeLabel(mode: BacktestPatternExecutionMode) {
  return mode === "all-presets" ? "전체 기본 패턴 비교" : "전략 연결 패턴";
}

function resolveBacktestPatternDefinitions(patterns: QuantPattern[], mode: BacktestPatternExecutionMode) {
  return patterns
    .filter((pattern) => isBacktestRegisteredPattern(pattern))
    .map((pattern) => (
    mode === "all-presets" && pattern.source === "preset"
      ? { ...pattern, enabled: true }
      : { ...pattern }
    ));
}

function listEnabledPatternNames(patterns: QuantPattern[]) {
  return patterns.filter((pattern) => pattern.enabled).map((pattern) => pattern.name);
}

function toggleBacktestPattern(patterns: QuantPattern[], patternId: string) {
  return patterns.map((pattern) => (
    pattern.id === patternId && isBacktestRegisteredPattern(pattern)
      ? { ...pattern, enabled: !pattern.enabled }
      : pattern
  ));
}

function restoreCorePatternSet(patterns: QuantPattern[]) {
  return patterns.map((pattern) => ({ ...pattern, enabled: CORE_PATTERN_IDS.has(pattern.id) }));
}

function enableAllPresetPatterns(patterns: QuantPattern[]) {
  return patterns.map((pattern) => ({ ...pattern, enabled: isBacktestRegisteredPattern(pattern) }));
}

function parseBacktestJobMetadata(job: JobItem) {
  if (!job.metadataJson) {
    return {};
  }
  try {
    const parsed = JSON.parse(job.metadataJson) as Record<string, unknown>;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function resolveUniverseScopeFromJob(metadata: Record<string, unknown>) {
  const scope = metadata.universeScope;
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    return null;
  }
  return scope as BacktestUniverseScopePayload;
}

function toBacktestJobStatus(job: JobItem): BacktestJobStatus | null {
  if (job.jobType !== "backtest_dispatch") {
    return null;
  }
  const metadata = parseBacktestJobMetadata(job);
  const patternNames = Array.isArray(metadata.patternDefinitions)
    ? metadata.patternDefinitions
      .filter((item): item is Record<string, unknown> => item != null && typeof item === "object" && !Array.isArray(item))
      .filter((item) => item.enabled !== false)
      .map((item) => (typeof item.name === "string" ? item.name : null))
      .filter((item): item is string => Boolean(item))
    : [];
  return {
    jobId: job.id,
    status: job.status,
    message: job.message,
    backtestId: typeof metadata.backtestId === "number" ? metadata.backtestId : null,
    strategyId: typeof metadata.strategyId === "number" ? metadata.strategyId : null,
    snapshotId: typeof metadata.snapshotId === "number" ? metadata.snapshotId : null,
    startDate: typeof metadata.startDate === "string" ? metadata.startDate : null,
    endDate: typeof metadata.endDate === "string" ? metadata.endDate : null,
    universeScope: resolveUniverseScopeFromJob(metadata),
    rebalanceCount: typeof metadata.rebalanceCount === "number" ? metadata.rebalanceCount : null,
    averageSelectionCount: typeof metadata.averageSelectionCount === "number" ? metadata.averageSelectionCount : null,
    latestSelectionCount: typeof metadata.latestSelectionCount === "number" ? metadata.latestSelectionCount : null,
    progressPercent: typeof metadata.progressPercent === "number" ? metadata.progressPercent : null,
    stage: typeof metadata.stage === "string" ? metadata.stage : null,
    stageLabel: typeof metadata.stageLabel === "string" ? metadata.stageLabel : null,
    processedCount: typeof metadata.processedCount === "number" ? metadata.processedCount : null,
    totalCount: typeof metadata.totalCount === "number" ? metadata.totalCount : null,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    updatedAt: job.finishedAt ?? job.startedAt,
    patternCount: patternNames.length,
    patternNames,
  };
}

export function BacktestClient({
  strategies,
  initialStrategyId,
  initialHistory,
}: {
  strategies: StrategySummary[];
  initialStrategyId?: number;
  initialHistory: BacktestHistoryItem[];
}) {
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(initialStrategyId ?? strategies[0]?.strategyId ?? null);
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState(toDateInput(new Date()));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [history, setHistory] = useState<BacktestHistoryItem[]>(initialHistory);
  const [selectedBacktestId, setSelectedBacktestId] = useState<number | null>(initialHistory[0]?.backtestId ?? null);
  const [job, setJob] = useState<BacktestJobStatus | null>(null);
  const [jobSubmittedAtMs, setJobSubmittedAtMs] = useState<number | null>(null);
  const [backtestNotice, setBacktestNotice] = useState<{ status: "running" | "success" | "error"; title: string; description: string } | null>(null);
  const [jobClockMs, setJobClockMs] = useState<number>(() => Date.now());
  const [diagnostics, setDiagnostics] = useState<StrategyDiagnosticsResult | null>(null);
  const [snapshots, setSnapshots] = useState<StrategyWeightSnapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [universeScope, setUniverseScope] = useState<BacktestUniverseScopePayload>(() => createDefaultBacktestUniverseScope());
  const universeScopeCacheRef = useRef<Record<number, BacktestUniverseScopePayload>>(
    Object.fromEntries(initialHistory.filter((item) => item.universeScope).map((item) => [item.backtestId, cloneUniverseScope(item.universeScope as BacktestUniverseScopePayload)])),
  );
  const pendingUniverseScopeRef = useRef<BacktestUniverseScopePayload | null>(null);
  const restoredActiveJobRef = useRef(false);
  const [workspacePatterns, setWorkspacePatterns] = useState<QuantPattern[]>(() => sanitizeBacktestSelectablePatterns(DEFAULT_PATTERNS.map((pattern) => ({ ...pattern }))));
  const [patternNames, setPatternNames] = useState<string[]>([]);
  const [patternExecutionMode, setPatternExecutionMode] = useState<BacktestPatternExecutionMode>("linked");
  const [signalPlanSummary, setSignalPlanSummary] = useState<{
    buyMode: string;
    sellMode: string;
    holdMode: string;
    maxHoldingDays: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    rebalanceGuard: string;
  } | null>({ ...DEFAULT_SIGNAL_PLAN });
  const submittedPatternNamesRef = useRef<string[]>([]);

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.strategyId === selectedStrategyId) ?? null,
    [selectedStrategyId, strategies],
  );
  const isDefaultUniverseExecution = useMemo(
    () => (
      universeScope.overrideMode !== "ONE_TIME_OVERRIDE"
      || (
        universeScope.mode === "FULL_MARKET"
        && universeScope.marketScope === "STRATEGY_DEFAULT"
        && universeScope.assetScope === "STRATEGY_DEFAULT"
      )
    ),
    [universeScope],
  );
  const requiresStrategyDiagnostics = isDefaultUniverseExecution;
  const resolvedStrategyUniverseScope = useMemo(
    () => (selectedStrategy?.universeScope ? cloneUniverseScope(selectedStrategy.universeScope) : null),
    [selectedStrategy?.universeScope],
  );
  const configuredUniverseScope = useMemo(
    () => (isDefaultUniverseExecution ? resolvedStrategyUniverseScope ?? universeScope : universeScope),
    [isDefaultUniverseExecution, resolvedStrategyUniverseScope, universeScope],
  );
  const currentUniverseSummary = useMemo(() => summarizeBacktestUniverseScope(configuredUniverseScope), [configuredUniverseScope]);
  const universeValidationError = useMemo(() => validateBacktestUniverseScope(universeScope), [universeScope]);

  function storeUniverseScope(backtestId: number | null | undefined, scope: BacktestUniverseScopePayload | null | undefined) {
    if (!backtestId || !scope) {
      return;
    }
    universeScopeCacheRef.current[backtestId] = cloneUniverseScope(scope);
  }

  function attachUniverseScopeToHistory(items: BacktestHistoryItem[]) {
    return items.map((item) => {
      if (item.universeScope) {
        universeScopeCacheRef.current[item.backtestId] = cloneUniverseScope(item.universeScope);
        return item;
      }
      const cached = universeScopeCacheRef.current[item.backtestId];
      if (!cached) {
        return item;
      }
      return {
        ...item,
        universeScope: cloneUniverseScope(cached),
      };
    });
  }

  function attachUniverseScopeToDetail(backtestId: number, detail: BacktestResult) {
    if (detail.universeScope) {
      universeScopeCacheRef.current[backtestId] = cloneUniverseScope(detail.universeScope);
      return detail;
    }
    const cached = universeScopeCacheRef.current[backtestId];
    if (!cached) {
      return detail;
    }
    return {
      ...detail,
      universeScope: cloneUniverseScope(cached),
    };
  }

  async function refreshHistory(strategyId: number | null) {
    if (!strategyId) {
      setHistory([]);
      setSelectedBacktestId(null);
      return;
    }
    try {
      const items = await getBacktestHistory(strategyId);
      const nextHistory = attachUniverseScopeToHistory(items);
      setHistory(nextHistory);
      setSelectedBacktestId((current) => (current && nextHistory.some((item) => item.backtestId === current) ? current : nextHistory[0]?.backtestId ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "백테스트 이력 조회 중 오류가 발생했습니다.");
    }
  }

  async function loadBacktestDetail(backtestId: number) {
    try {
      const detail = await getBacktestDetail(backtestId);
      setResult(attachUniverseScopeToDetail(backtestId, detail));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "백테스트 상세 결과 조회 중 오류가 발생했습니다.");
    }
  }

  async function refreshDiagnostics(strategyId: number | null) {
    if (!strategyId) {
      setDiagnostics(null);
      return;
    }
    try {
      const value = await getStrategyDiagnostics(strategyId);
      setDiagnostics(value);
    } catch (err) {
      setDiagnostics(null);
      setError(err instanceof Error ? err.message : "전략 진단 조회 중 오류가 발생했습니다.");
    }
  }

  async function refreshSnapshots(strategyId: number | null) {
    if (!strategyId) {
      setSnapshots([]);
      setSelectedSnapshotId(null);
      return;
    }
    try {
      const value = await getStrategySnapshots(strategyId);
      setSnapshots(value);
      setSelectedSnapshotId(null);
    } catch (err) {
      setSnapshots([]);
      setError(err instanceof Error ? err.message : "가중치 스냅샷 조회 중 오류가 발생했습니다.");
    }
  }

  async function reconnectActiveBacktest(strategyId: number | null) {
    if (!strategyId) {
      return;
    }
    try {
      const jobs = await getJobs();
      const activeJob = jobs
        .map((item) => toBacktestJobStatus(item))
        .find((item) => item && ["QUEUED", "PENDING", "RUNNING"].includes(item.status) && item.strategyId === strategyId);
      if (!activeJob) {
        return;
      }
      if (activeJob.startDate) {
        setStartDate(activeJob.startDate);
      }
      if (activeJob.endDate) {
        setEndDate(activeJob.endDate);
      }
      if (activeJob.snapshotId != null) {
        setSelectedSnapshotId(activeJob.snapshotId);
      }
      if (activeJob.universeScope) {
        const restoredScope = cloneUniverseScope(activeJob.universeScope);
        setUniverseScope(restoredScope);
        pendingUniverseScopeRef.current = restoredScope;
      }
      setJob(activeJob);
      setLoading(true);
      setJobSubmittedAtMs(parseDateMs(activeJob.startedAt) ?? Date.now());
      setBacktestNotice({
        status: "running",
        title: activeJob.status === "RUNNING" ? "백테스트 진행 중" : "백테스트 대기 중",
        description: activeJob.message ?? `백테스트 작업 ${activeJob.jobId}를 다시 연결했습니다.`,
      });
      setError(null);
    } catch {
      // 백그라운드 작업 복구 실패는 기존 페이지 로딩을 막지 않는다.
    }
  }

  const refreshHistoryEffect = useEffectEvent((strategyId: number | null) => refreshHistory(strategyId));
  const loadBacktestDetailEffect = useEffectEvent((backtestId: number) => loadBacktestDetail(backtestId));
  const reconnectActiveBacktestEffect = useEffectEvent((strategyId: number | null) => reconnectActiveBacktest(strategyId));

  useEffect(() => {
    if (restoredActiveJobRef.current) {
      return;
    }
    restoredActiveJobRef.current = true;
    let cancelled = false;
    void getJobs()
      .then((jobs) => {
        if (cancelled) {
          return;
        }
        const activeJob = jobs
          .map((item) => toBacktestJobStatus(item))
          .find((item) => item && ["QUEUED", "PENDING", "RUNNING"].includes(item.status));
        if (!activeJob?.strategyId || activeJob.strategyId === selectedStrategyId) {
          return;
        }
        if (strategies.some((strategy) => strategy.strategyId === activeJob.strategyId)) {
          setSelectedStrategyId(activeJob.strategyId);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedStrategyId, strategies]);

  useEffect(() => {
    pendingUniverseScopeRef.current = null;
    if (selectedStrategy?.universeScope) {
      setUniverseScope(cloneUniverseScope(selectedStrategy.universeScope));
      return;
    }
    setUniverseScope(createDefaultBacktestUniverseScope());
  }, [selectedStrategy?.strategyId, selectedStrategy?.universeScope]);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setJob(null);
    setJobSubmittedAtMs(null);
    setBacktestNotice(null);
    async function loadStrategyContext() {
      await Promise.all([
        refreshHistoryEffect(selectedStrategyId),
        refreshDiagnostics(selectedStrategyId),
        refreshSnapshots(selectedStrategyId),
      ]);
      if (!cancelled) {
        await reconnectActiveBacktestEffect(selectedStrategyId);
      }
    }
    void loadStrategyContext();
    return () => {
      cancelled = true;
    };
  }, [selectedStrategyId]);

  useEffect(() => {
    if (!selectedBacktestId) {
      setResult(null);
      return;
    }
    void loadBacktestDetailEffect(selectedBacktestId);
  }, [selectedBacktestId]);

  useEffect(() => {
    if (!job?.jobId || !["QUEUED", "PENDING", "RUNNING"].includes(job.status)) {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const latest = await getBacktestJobStatus(job.jobId);
        if (latest.universeScope) {
          const restoredScope = cloneUniverseScope(latest.universeScope);
          pendingUniverseScopeRef.current = restoredScope;
          setUniverseScope(restoredScope);
        }
        setJob((current) => ({
          ...latest,
          patternCount: latest.patternCount ?? current?.patternCount ?? submittedPatternNamesRef.current.length,
          patternNames: latest.patternNames ?? current?.patternNames ?? submittedPatternNamesRef.current,
        }));
        if (latest.status === "COMPLETED" && latest.backtestId) {
          window.clearInterval(interval);
          if (pendingUniverseScopeRef.current) {
            storeUniverseScope(latest.backtestId, pendingUniverseScopeRef.current);
            pendingUniverseScopeRef.current = null;
          }
          setSelectedBacktestId(latest.backtestId);
          await refreshHistoryEffect(selectedStrategyId);
          setLoading(false);
          setBacktestNotice({
            status: "success",
            title: "백테스트 완료",
            description: latest.message ?? `백테스트 #${latest.backtestId} 결과가 저장되었습니다.`,
          });
        } else if (latest.status === "COMPLETED") {
          window.clearInterval(interval);
          pendingUniverseScopeRef.current = null;
          setLoading(false);
          setError(latest.message ?? "백테스트는 완료되었지만 결과 ID를 찾지 못했습니다.");
          setBacktestNotice({
            status: "error",
            title: "백테스트 결과 연결 실패",
            description: latest.message ?? "백테스트는 끝났지만 결과 ID를 찾지 못했습니다.",
          });
        } else if (latest.status === "FAILED") {
          window.clearInterval(interval);
          pendingUniverseScopeRef.current = null;
          setLoading(false);
          setError(latest.message ?? "백테스트 작업이 실패했습니다.");
          setBacktestNotice({
            status: "error",
            title: "백테스트 실패",
            description: latest.message ?? "백테스트 작업이 실패했습니다.",
          });
        }
      } catch (err) {
        window.clearInterval(interval);
        pendingUniverseScopeRef.current = null;
        setLoading(false);
        setError(err instanceof Error ? err.message : "백테스트 상태 조회 중 오류가 발생했습니다.");
        setBacktestNotice({
          status: "error",
          title: "백테스트 상태 조회 실패",
          description: err instanceof Error ? err.message : "백테스트 상태 조회 중 오류가 발생했습니다.",
        });
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [job?.jobId, job?.status, selectedStrategyId]);

  useEffect(() => {
    if (!job?.jobId || !["QUEUED", "PENDING", "RUNNING"].includes(job.status)) {
      return;
    }
    setJobClockMs(Date.now());
    const timer = window.setInterval(() => {
      setJobClockMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [job?.jobId, job?.status]);

  useEffect(() => {
    const workspace = loadPatternWorkspace(selectedStrategyId);
    const nextPatterns = sanitizeBacktestSelectablePatterns(workspace.patterns);
    setWorkspacePatterns(nextPatterns);
    setPatternNames(nextPatterns.filter((pattern) => pattern.enabled).map((pattern) => pattern.name));
    setSignalPlanSummary(workspace.signalPlan);
  }, [selectedStrategyId]);

  const effectivePatterns = useMemo<QuantPattern[]>(
    () =>
      sanitizeBacktestSelectablePatterns(
        result?.researchConfig?.patternDefinitions?.map((pattern) => ({
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
          stopLossPercent: pattern.stopLossPercent ?? result?.researchConfig?.signalPlan?.stopLossPercent ?? signalPlanSummary?.stopLossPercent ?? DEFAULT_SIGNAL_PLAN.stopLossPercent,
          target1Percent: pattern.target1Percent ?? Math.max(8, Math.round(((result?.researchConfig?.signalPlan?.takeProfitPercent ?? signalPlanSummary?.takeProfitPercent ?? DEFAULT_SIGNAL_PLAN.takeProfitPercent)) * 0.55)),
          target2Percent: pattern.target2Percent ?? result?.researchConfig?.signalPlan?.takeProfitPercent ?? signalPlanSummary?.takeProfitPercent ?? DEFAULT_SIGNAL_PLAN.takeProfitPercent,
          entryMode: (pattern.entryMode as QuantPattern["entryMode"] | undefined) ?? "SIGNAL_CLOSE",
          exitMode: (pattern.exitMode as QuantPattern["exitMode"] | undefined) ?? "TRAILING_STOP",
          enabled: pattern.enabled,
          source: pattern.source === "custom" ? "custom" : "preset",
        })) ?? workspacePatterns,
      ),
    [result?.researchConfig?.patternDefinitions, result?.researchConfig?.signalPlan?.stopLossPercent, result?.researchConfig?.signalPlan?.takeProfitPercent, signalPlanSummary?.stopLossPercent, signalPlanSummary?.takeProfitPercent, workspacePatterns],
  );
  const effectiveSignalPlan = result?.researchConfig?.signalPlan ?? signalPlanSummary ?? DEFAULT_SIGNAL_PLAN;
  const effectivePatternNames = result?.researchConfig?.patternDefinitions
    ?.filter((pattern) => pattern.enabled)
    .map((pattern) => pattern.name) ?? patternNames;
  const executionPatterns = useMemo(
    () => resolveBacktestPatternDefinitions(workspacePatterns, patternExecutionMode),
    [patternExecutionMode, workspacePatterns],
  );
  const executionPatternNames = useMemo(
    () => listEnabledPatternNames(executionPatterns),
    [executionPatterns],
  );

  async function handleBacktest() {
    if (!selectedStrategyId) {
      setError("백테스트할 전략을 먼저 선택해야 합니다.");
      return;
    }
    const parsedStartDate = Date.parse(startDate);
    const parsedEndDate = Date.parse(endDate);
    if (!Number.isFinite(parsedStartDate) || !Number.isFinite(parsedEndDate) || parsedStartDate > parsedEndDate) {
      setError("시작일과 종료일을 다시 확인해 주세요. 시작일은 종료일보다 늦을 수 없습니다.");
      return;
    }
    if (universeValidationError) {
      setError(universeValidationError);
      return;
    }
    if (requiresStrategyDiagnostics && ["QUEUED", "PENDING", "RUNNING"].includes(diagnostics?.analysisStatus ?? "")) {
      setError(diagnostics?.analysisMessage ?? "전략 후보 분석이 아직 진행 중입니다. 완료 후 다시 시도하세요.");
      return;
    }
    if (requiresStrategyDiagnostics && (diagnostics?.analysisStatus ?? "") === "STALE") {
      setError(diagnostics?.analysisMessage ?? "전략 후보 분석 이력이 없습니다. 전략을 다시 저장해 최신 분석을 생성하세요.");
      return;
    }
    if (requiresStrategyDiagnostics && (diagnostics?.diagnostics.finalSelectedCount ?? 0) === 0) {
      setError(
        diagnostics
          ? `현재 전략으로는 백테스트를 실행할 수 없습니다. 전략 유니버스 ${diagnostics.diagnostics.totalSymbols}개 중 가격 통과 ${diagnostics.diagnostics.priceReadyCount}개, 재무 데이터 보유 ${diagnostics.diagnostics.fundamentalsReadyCount}개, ROE 통과 ${diagnostics.diagnostics.roePassCount}개, PBR 통과 ${diagnostics.diagnostics.pbrPassCount}개, 모멘텀 통과 ${diagnostics.diagnostics.momentumPassCount}개입니다.`
          : "현재 전략으로는 후보 종목이 없어 백테스트를 실행할 수 없습니다.",
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const requestUniverseScope = cloneUniverseScope(configuredUniverseScope);
      const requestPatterns = resolveBacktestPatternDefinitions(workspacePatterns, patternExecutionMode);
      const requestPatternNames = listEnabledPatternNames(requestPatterns);
      submittedPatternNamesRef.current = requestPatternNames;
      pendingUniverseScopeRef.current = requestUniverseScope;
      const response = await runBacktest({
        strategyId: selectedStrategyId,
        startDate,
        endDate,
        snapshotId: selectedSnapshotId,
        universeScope: requestUniverseScope,
        patternDefinitions: requestPatterns,
        signalPlan: signalPlanSummary ?? DEFAULT_SIGNAL_PLAN,
      });
      if (!response.jobId) {
        throw new Error(response.message || "백테스트 작업 ID를 받지 못했습니다.");
      }
      setResult(null);
      setJobSubmittedAtMs(Date.now());
      setBacktestNotice({
        status: "running",
        title: response.status === "RUNNING" ? "백테스트 실행 중" : "백테스트 대기 중",
        description: response.message || `백테스트 작업 ${response.jobId}를 백그라운드에서 실행하고 있습니다.`,
      });
      setJob({
        jobId: response.jobId,
        status: response.status,
        message: response.message,
        backtestId: null,
        strategyId: selectedStrategyId,
        snapshotId: selectedSnapshotId,
        startDate,
        endDate,
        universeScope: requestUniverseScope,
        rebalanceCount: null,
        averageSelectionCount: null,
        latestSelectionCount: null,
        progressPercent: null,
        stage: null,
        stageLabel: null,
        processedCount: null,
        totalCount: null,
        startedAt: null,
        finishedAt: null,
        updatedAt: null,
        patternCount: requestPatternNames.length,
        patternNames: requestPatternNames,
      });
    } catch (err) {
      pendingUniverseScopeRef.current = null;
      setError(err instanceof Error ? err.message : "백테스트 실행 중 오류가 발생했습니다.");
      setLoading(false);
    }
  }

  const metrics = [
    ["총수익률", result?.equityCurve?.length ? ((result.equityCurve[result.equityCurve.length - 1]?.value ?? 0) / (result.equityCurve[0]?.value ?? 1) - 1) * 100 : null, "buy"],
    ["CAGR", result?.cagr ?? selectedStrategy?.latestBacktest?.cagr ?? null, "buy"],
    ["샤프지수", result?.sharpe ?? selectedStrategy?.latestBacktest?.sharpe ?? null, "kpi"],
    ["최대 낙폭", result?.maxDrawdown ?? selectedStrategy?.latestBacktest?.maxDrawdown ?? null, "sell"],
    ["승률", result?.winRate ?? selectedStrategy?.latestBacktest?.winRate ?? null, "buy"],
    ["거래 수", result?.tradeLog?.length ?? null, "default"],
    ["평균 보유일", result?.stockBreakdown?.length ? result.stockBreakdown.reduce((sum, stock) => sum + (stock.holdingDays ?? 0), 0) / result.stockBreakdown.length : null, "kpi"],
    ["벤치마크 대비 초과수익", null, "default"],
  ] as const;

  const equitySeries = result?.equityCurve.map((point) => point.value) ?? [];
  const drawdownSeries = result?.drawdownCurve.map((point) => Math.abs(point.value)) ?? [];
  const monthlySeries = result?.monthlyReturns.map((point) => point.value / 100 + 0.5) ?? [];

  const workbench = useMemo(
    () =>
      buildBacktestWorkbench({
        result,
        diagnosticsCandidates: diagnostics?.candidates ?? [],
        patterns: effectivePatterns,
        signalPlan: effectiveSignalPlan,
        strategy: selectedStrategy ? { stockCount: selectedStrategy.stockCount, momentum: selectedStrategy.momentum, rebalance: selectedStrategy.rebalance } : null,
      }),
    [diagnostics?.candidates, effectivePatterns, effectiveSignalPlan, result, selectedStrategy],
  );
  const signalOverlayMarkers = useMemo(() => buildSignalOverlayMarkers(result?.signalTimeline), [result?.signalTimeline]);
  const signalState = useMemo(() => summarizeSignalState(result), [result]);
  const loadedBacktestHistory = useMemo(
    () => history.find((item) => item.backtestId === selectedBacktestId) ?? null,
    [history, selectedBacktestId],
  );
  const activeJobUniverseScope = useMemo(
    () => (job && ["QUEUED", "PENDING", "RUNNING"].includes(job.status) ? job.universeScope ?? pendingUniverseScopeRef.current ?? configuredUniverseScope : null),
    [configuredUniverseScope, job],
  );
  const displayedUniverseScope = activeJobUniverseScope
    ?? result?.universeScope
    ?? loadedBacktestHistory?.universeScope
    ?? (selectedBacktestId ? universeScopeCacheRef.current[selectedBacktestId] ?? createDefaultBacktestUniverseScope() : null)
    ?? configuredUniverseScope;
  const displayedUniverseSummary = useMemo(() => summarizeBacktestUniverseScope(displayedUniverseScope), [displayedUniverseScope]);
  const displayedUniverseCandidateCount = activeJobUniverseScope?.estimatedStockCount ?? result?.stockBreakdown?.length ?? displayedUniverseSummary.estimatedStockCount;
  const candidateScores = useMemo(
    () => Object.fromEntries((diagnostics?.candidates ?? []).map((candidate) => [candidate.symbol, candidate.score])),
    [diagnostics?.candidates],
  );
  const activeJobProgress = useMemo(() => {
    if (!job || !["QUEUED", "PENDING", "RUNNING"].includes(job.status)) {
      return null;
    }
    const requestedPatternCount = submittedPatternNamesRef.current.length > 0 ? submittedPatternNamesRef.current.length : null;
    const patternCount = job.patternCount ?? job.patternNames?.length ?? requestedPatternCount ?? executionPatternNames.length;
    const selectedCount = displayedUniverseSummary.estimatedStockCount ?? diagnostics?.diagnostics.finalSelectedCount ?? selectedStrategy?.stockCount ?? 0;
    const estimate = estimateBacktestSeconds({
      startDate,
      endDate,
      rebalance: selectedStrategy?.rebalance,
      selectedCount,
      patternCount,
    });
    const startedAtMs = parseDateMs(job.startedAt) ?? jobSubmittedAtMs ?? jobClockMs;
    const updatedAtMs = parseDateMs(job.updatedAt) ?? startedAtMs;
    const elapsedSeconds = Math.max(0, Math.floor((jobClockMs - startedAtMs) / 1000));
    const queuePaddingSeconds = job.status === "RUNNING" ? 0 : 12;
    const estimatedTotalSeconds = estimate.estimateSeconds + queuePaddingSeconds;
    const rawProgress = estimatedTotalSeconds > 0 ? (elapsedSeconds / estimatedTotalSeconds) * 100 : 0;
    const estimatedProgressPercent = job.status === "RUNNING"
      ? Math.max(18, Math.min(94, Math.round(rawProgress)))
      : Math.max(4, Math.min(12, Math.round(rawProgress)));
    const actualProgressPercent = job.progressPercent != null ? Math.max(0, Math.min(100, Math.round(job.progressPercent))) : null;
    const progressPercent = actualProgressPercent ?? estimatedProgressPercent;
    const remainingSeconds = Math.max(0, estimatedTotalSeconds - elapsedSeconds);
    const lowerBoundSeconds = Math.max(12, Math.round(estimatedTotalSeconds * 0.75));
    const upperBoundSeconds = Math.max(lowerBoundSeconds + 8, Math.round(estimatedTotalSeconds * 1.35));
    const secondsSinceUpdate = Math.max(0, Math.floor((jobClockMs - updatedAtMs) / 1000));
    return {
      progressPercent,
      progressSource: actualProgressPercent != null ? "actual" : "estimated",
      stageLabel: job.stageLabel ?? resolveBacktestStageLabel(job.status, progressPercent),
      stage: job.stage,
      elapsedSeconds,
      remainingSeconds,
      estimatedTotalSeconds,
      estimateRangeLabel: `${formatDuration(lowerBoundSeconds)} ~ ${formatDuration(upperBoundSeconds)}`,
      rebalanceCount: job.totalCount ?? job.rebalanceCount ?? estimate.rebalanceCount,
      processedCount: job.processedCount ?? null,
      totalCount: job.totalCount ?? job.rebalanceCount ?? estimate.rebalanceCount,
      selectedCount,
      patternCount,
      periodDays: estimate.periodDays,
      overEstimate: elapsedSeconds > upperBoundSeconds,
      secondsSinceUpdate,
      staleProgress: job.status === "RUNNING" && secondsSinceUpdate >= 90,
    };
  }, [diagnostics?.diagnostics.finalSelectedCount, displayedUniverseSummary.estimatedStockCount, endDate, executionPatternNames.length, job, jobClockMs, jobSubmittedAtMs, selectedStrategy?.rebalance, selectedStrategy?.stockCount, startDate]);

  const liveBacktestNotice = useMemo(() => {
    if (job && ["QUEUED", "PENDING", "RUNNING"].includes(job.status)) {
      const title = job.status === "RUNNING" ? "백테스트 진행중" : "백테스트 대기중";
      const description = [
        activeJobProgress ? `${activeJobProgress.progressPercent}%` : null,
        activeJobProgress?.stageLabel ?? job.stageLabel ?? null,
        job.message ?? null,
        activeJobProgress?.totalCount ? `리밸런싱 ${activeJobProgress.processedCount ?? 0}/${activeJobProgress.totalCount}` : null,
      ].filter(Boolean).join(" · ");
      return {
        status: "running" as const,
        title,
        description: description || `백테스트 작업 ${job.jobId}를 실행하고 있습니다.`,
      };
    }
    return backtestNotice;
  }, [activeJobProgress, backtestNotice, job]);
  const backtestRunDisabled = loading
    || strategies.length === 0
    || Boolean(universeValidationError)
    || (requiresStrategyDiagnostics && (diagnostics?.diagnostics.finalSelectedCount ?? 0) === 0);

  return (
    <div className="space-y-4">
      <DashboardCard title="백테스트 설정" subtitle="저장된 전략을 선택하고 기간을 지정해 실제 백테스트를 실행합니다.">
        <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr_0.9fr_1fr_1fr_auto] lg:items-end">
          <label className="space-y-2 text-[12px] font-semibold text-[color:var(--fg)]">
            <span>전략 선택</span>
            <select value={selectedStrategyId ?? ""} onChange={(event) => setSelectedStrategyId(Number(event.target.value))} className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium">
              {strategies.map((strategy) => (
                <option key={strategy.strategyId} value={strategy.strategyId}>{strategy.name}</option>
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
          <label className="space-y-2 text-[12px] font-semibold text-[color:var(--fg)]">
            <span>가중치 스냅샷</span>
            <select value={selectedSnapshotId ?? ""} onChange={(event) => setSelectedSnapshotId(event.target.value ? Number(event.target.value) : null)} className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium">
              <option value="">현재 전략 가중치</option>
              {snapshots.map((snapshot) => (
                <option key={snapshot.snapshotId} value={snapshot.snapshotId}>{snapshot.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-[12px] font-semibold text-[color:var(--fg)]">
            <span>패턴 실행 모드</span>
            <select value={patternExecutionMode} onChange={(event) => setPatternExecutionMode(event.target.value as BacktestPatternExecutionMode)} className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium">
              <option value="linked">전략 연결 패턴</option>
              <option value="all-presets">전체 기본 패턴 비교</option>
            </select>
          </label>
          <PrimaryButton label={loading ? "백테스트 큐 처리 중" : "백테스트 실행"} onClick={handleBacktest} disabled={backtestRunDisabled} />
        </div>
        <div className="mt-4">
          <BacktestUniverseConfigurator value={universeScope} onChange={setUniverseScope} validationError={universeValidationError} />
        </div>
        <div className="mt-4 rounded-md border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-3">
          <div className="flex flex-wrap gap-2 text-[11px] text-[color:var(--fg-muted)]">
            <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-1">실행 모드 {resolvePatternExecutionModeLabel(patternExecutionMode)}</span>
            <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-1">실행 패턴 {executionPatternNames.length}개</span>
          </div>
          <p className="mt-3 text-[13px] font-semibold text-[color:var(--fg)]">{executionPatternNames.join(" / ") || "활성 패턴이 없습니다."}</p>
          <p className="mt-1 text-[11px] leading-5 text-[color:var(--fg-muted)]">
            {patternExecutionMode === "all-presets"
              ? "이번 백테스트에서만 전체 기본 패턴을 동시에 켜서 패턴 성과 비교를 수행합니다. 전략에 연결된 기본 패턴 구성은 바로 덮어쓰지 않습니다."
              : "현재 전략 워크스페이스에서 활성화된 패턴만 사용합니다. 기본 연결 패턴은 52W / BRK / MOM / SLP입니다."}
          </p>
        </div>
        <div className="mt-4 rounded-md border border-[color:var(--line)] bg-white px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-[color:var(--fg)]">백테스트 패턴 선택</p>
              <p className="mt-1 text-[11px] leading-5 text-[color:var(--fg-muted)]">
                전략 생성에서 저장한 패턴 세트를 기준으로 하되, 여기서 이번 실행에 한해 다른 조합으로 다시 돌릴 수 있습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setWorkspacePatterns((current) => restoreCorePatternSet(current))}
                className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-2 text-[11px] font-semibold"
              >
                핵심 4패턴 복원
              </button>
              <button
                type="button"
                onClick={() => setWorkspacePatterns((current) => enableAllPresetPatterns(current))}
                className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-2 text-[11px] font-semibold"
              >
                전체 기본 패턴
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[color:var(--fg-muted)]">
            <span className="rounded-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-2 py-1">선택 패턴 {listEnabledPatternNames(workspacePatterns).length}개</span>
            <span className="rounded-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-2 py-1">{listEnabledPatternNames(workspacePatterns).map((name) => {
              const pattern = workspacePatterns.find((item) => item.name === name);
              return pattern?.shortLabel ?? name;
            }).join(" / ") || "선택된 패턴이 없습니다."}</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {workspacePatterns.map((pattern) => {
              const registered = isBacktestRegisteredPattern(pattern);
              const registrationNotice = registered ? undefined : "백테스트 엔진에 등록되지 않은 패턴입니다. 백테스트 설정에서는 선택할 수 없습니다.";
              return (
                <div key={pattern.id} title={registrationNotice} className={registered ? undefined : "cursor-not-allowed"}>
                  <button
                    type="button"
                    onClick={() => setWorkspacePatterns((current) => toggleBacktestPattern(current, pattern.id))}
                    disabled={!registered}
                    className={`w-full rounded-md border p-3 text-left transition ${
                      !registered
                        ? "border-dashed border-[color:var(--line)] bg-[color:var(--surface-muted)] opacity-65"
                        : pattern.enabled
                          ? "border-black bg-[color:var(--surface-muted)]"
                          : "border-[color:var(--line)] bg-white hover:bg-[color:var(--surface-muted)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-[color:var(--line)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--fg-muted)]">{pattern.shortLabel}</span>
                          <span className="text-[11px] text-[color:var(--fg-muted)]">{pattern.category}</span>
                          {!registered ? (
                            <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-0.5 text-[10px] font-semibold text-[color:var(--fg-muted)]">
                              미등록
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-[14px] font-semibold text-[color:var(--fg)]">{pattern.name}</p>
                        <p className="mt-1 text-[11px] leading-5 text-[color:var(--fg-muted)]">{pattern.ruleSummary}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${pattern.enabled ? "bg-black text-white" : "border border-[color:var(--line)] bg-white text-[color:var(--fg-muted)]"}`}>
                        {registered ? (pattern.enabled ? "ON" : "OFF") : "LOCK"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-[color:var(--fg-muted)]">
                      <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-0.5">보유 {pattern.holdingDays}일</span>
                      <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-0.5">룩백 {pattern.lookbackDays}일</span>
                      <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-0.5">거래량 {pattern.volumeSurgePercent}%</span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-[color:var(--fg-muted)]">
            `전략 연결 패턴` 모드에서는 여기서 선택한 ON/OFF 조합으로 실행합니다. `전체 기본 패턴 비교` 모드에서는 preset 패턴을 모두 켜서 비교하고, 현재 ON/OFF 상태는 다음 linked 실행을 위한 작업 세트로 유지됩니다.
          </p>
          <p className="mt-2 text-[11px] leading-5 text-[color:var(--fg-muted)]">
            백테스트 엔진에 아직 등록되지 않은 패턴은 선택할 수 없으며, 카드에 마우스를 올리면 제한 사유를 확인할 수 있습니다.
          </p>
        </div>
      </DashboardCard>

      {strategies.length === 0 ? <StatusNotice title="선택 가능한 전략이 없습니다." description="전략 생성 페이지에서 먼저 전략을 저장해야 합니다." /> : null}
      {liveBacktestNotice ? (
        <StatusNotice
          title={liveBacktestNotice.title}
          description={liveBacktestNotice.description}
          tone={backtestNoticeTone(liveBacktestNotice.status)}
        />
      ) : null}
      {diagnostics ? (
        <DashboardCard title="전략 진단" subtitle="현재 선택한 전략의 실시간 후보 종목 진단입니다.">
          <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-1 font-semibold text-[color:var(--fg)]">현재 백테스트 대상 {currentUniverseSummary.shortLabel}</span>
            <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-1">{currentUniverseSummary.isRestricted ? "유니버스 제한 적용 중" : "전략 기본 범위"}</span>
            <span className="rounded-full border border-[color:var(--line)] bg-white px-2 py-1">후보 종목 수 {currentUniverseSummary.estimatedStockCountLabel}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["전략 유니버스", diagnostics.diagnostics.totalSymbols],
              ["가격 통과", diagnostics.diagnostics.priceReadyCount],
              ["재무 데이터 보유", diagnostics.diagnostics.fundamentalsReadyCount],
              ["최종 선택", diagnostics.diagnostics.finalSelectedCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-[color:var(--line)] px-3 py-3">
                <p className="text-[11px] text-[color:var(--fg-muted)]">{label}</p>
                <p className={`mt-2 text-[20px] font-semibold ${label === "최종 선택" && Number(value) === 0 ? "text-[color:var(--sell)]" : "text-[color:var(--fg)]"}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {[
              ["ROE 통과", diagnostics.diagnostics.roePassCount],
              ["PBR 통과", diagnostics.diagnostics.pbrPassCount],
              ["모멘텀 통과", diagnostics.diagnostics.momentumPassCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-[color:var(--line)] px-3 py-2">
                <p className="text-[11px] text-[color:var(--fg-muted)]">{label}</p>
                <p className="mt-1 text-[16px] font-semibold text-[color:var(--fg)]">{value}</p>
              </div>
            ))}
          </div>
          {currentUniverseSummary.isRestricted ? (
            <p className="mt-3 text-[11px] text-[color:var(--fg-muted)]">
              현재 실행은 {currentUniverseSummary.shortLabel} 안에서만 진행됩니다. 위 전략 진단 수치는 저장된 전략 기본 유니버스 기준이며, 실제 백테스트에서는 선택한 범위로 후보 집합이 다시 제한됩니다.
            </p>
          ) : null}
        </DashboardCard>
      ) : null}
      {error ? <StatusNotice title="백테스트 실행 실패" description={error} tone="error" /> : null}
      {job ? (
        <StatusNotice
          title="백테스트 작업 상태"
          description={`작업 ID ${job.jobId} · ${job.status} · ${job.message ?? "메시지 없음"}${
            job.latestSelectionCount != null ? ` · 최근 선택 종목 수 ${job.latestSelectionCount}개` : ""
          }${job.averageSelectionCount != null ? ` · 평균 선택 종목 수 ${job.averageSelectionCount.toFixed(1)}개` : ""}`}
          tone={job.status === "FAILED" ? "error" : job.status === "COMPLETED" ? "success" : "info"}
        />
      ) : null}
      {activeJobProgress ? (
        <div className="space-y-2 rounded-md border border-[color:var(--line)] bg-white px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px]">
            <div>
              <p className="font-semibold text-[color:var(--fg)]">{activeJobProgress.stageLabel}</p>
              <p className="mt-1 text-[color:var(--fg-muted)]">
                {activeJobProgress.progressSource === "actual"
                  ? "백엔드가 현재 단계와 진행률을 직접 보고하고 있습니다."
                  : "현재 백엔드가 실제 단계별 퍼센트를 주지 않아, 기간 / 리밸런싱 / 종목 수 기준 추정 진행률을 표시합니다."}
              </p>
            </div>
            <span className="text-[color:var(--fg-muted)]">
              {activeJobProgress.progressSource === "actual" ? "실제 진행률" : "예상 진행률"} {activeJobProgress.progressPercent}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[color:var(--surface-muted)]">
            <div
              className="h-full rounded-full bg-[color:var(--kpi)] transition-[width] duration-500"
              style={{ width: `${Math.max(0, Math.min(100, activeJobProgress.progressPercent))}%` }}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              ["예상 소요", activeJobProgress.estimateRangeLabel],
              ["경과 시간", formatDuration(activeJobProgress.elapsedSeconds)],
              ["남은 예상", activeJobProgress.overEstimate ? "예상 시간 초과" : formatDuration(activeJobProgress.remainingSeconds)],
              ["진행 단계", activeJobProgress.totalCount ? `${activeJobProgress.processedCount ?? 0}/${activeJobProgress.totalCount}` : activeJobProgress.stage ?? "-"],
              ["리밸런싱 예상", `${activeJobProgress.rebalanceCount}회`],
              ["현재 대상 후보", `${activeJobProgress.selectedCount}개`],
              ["활성 패턴", `${activeJobProgress.patternCount}개`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-3">
                <p className="text-[11px] text-[color:var(--fg-muted)]">{label}</p>
                <p className="mt-2 text-[15px] font-semibold text-[color:var(--fg)]">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[color:var(--fg-muted)]">
            분석 기간 {activeJobProgress.periodDays.toLocaleString("ko-KR")}일 · 리밸런싱 {selectedStrategy?.rebalance ?? "monthly"} · 완료되면 결과를 자동으로 불러옵니다.
          </p>
          {activeJobProgress.staleProgress ? (
            <p className="text-[11px] font-medium text-[color:var(--sell)]">
              최근 {formatDuration(activeJobProgress.secondsSinceUpdate)} 동안 진행 업데이트가 없습니다. 현재 작업이 느리거나 중단되었을 수 있습니다.
            </p>
          ) : (
            <p className="text-[11px] text-[color:var(--fg-muted)]">
              마지막 진행 업데이트 {formatDuration(activeJobProgress.secondsSinceUpdate)} 전
            </p>
          )}
        </div>
      ) : null}

      <DashboardCard
        title="현재 백테스트 대상"
        subtitle={
          activeJobUniverseScope
            ? "현재 진행 중인 백테스트에 적용된 유니버스 범위입니다."
            : result && selectedBacktestId
              ? `불러온 백테스트 #${selectedBacktestId}에 적용된 유니버스 범위입니다.`
              : "현재 실행 예정 범위를 미리 확인합니다."
        }
      >
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            ["적용 유니버스 유형", displayedUniverseSummary.modeLabel],
            ["선택 종목 수 / 후보 수", `${displayedUniverseSummary.selectedStockCount ?? "-"} / ${displayedUniverseCandidateCount == null ? "-" : `${displayedUniverseCandidateCount.toLocaleString("ko-KR")}개`}`],
            ["선택 섹터 수", displayedUniverseSummary.selectedSectorCount == null ? "-" : `${displayedUniverseSummary.selectedSectorCount}개`],
            ["선택 테마 수", displayedUniverseSummary.selectedThemeCount == null ? "-" : `${displayedUniverseSummary.selectedThemeCount}개`],
            ["선택 포트폴리오명", displayedUniverseSummary.portfolioName ?? "-"],
            ["유니버스 제한 여부", displayedUniverseSummary.isRestricted ? "제한 적용" : "전략 기본"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-[color:var(--line)] px-3 py-3">
              <p className="text-[11px] text-[color:var(--fg-muted)]">{label}</p>
              <p className="mt-2 text-[15px] font-semibold text-[color:var(--fg)]">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-md border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-3">
          <p className="text-[13px] font-semibold text-[color:var(--fg)]">{displayedUniverseSummary.title}</p>
          <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{displayedUniverseSummary.description}</p>
        </div>
      </DashboardCard>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, accent]) => (
          <MetricCard
            key={label}
            label={label}
            value={value === null ? "-" : label === "거래 수" ? String(value) : label === "평균 보유일" ? `${Math.round(Number(value))}일` : label === "샤프지수" ? Number(value).toFixed(2) : formatPercent(Number(value))}
            change={label === "벤치마크 대비 초과수익" ? "벤치마크 곡선 저장 시 자동 계산" : selectedStrategy ? selectedStrategy.name : "전략 미선택"}
            accent={accent}
          />
        ))}
      </section>

      {result && workbench.stocks.length === 0 ? (
        <StatusNotice
          title="선택한 유니버스 안에서 유효 후보가 없습니다."
          description="전략 규칙은 유지된 상태로 유니버스만 제한되었습니다. 현재 범위에서는 편입 가능한 종목이 0개라서 선정 종목 분석 표와 Pattern Lab 전달 대상이 비어 있습니다."
          tone="warning"
        />
      ) : null}

      {(workbench.stocks.length > 0 || workbench.patterns.length > 0) ? (
        <>
          {workbench.mode === "derived" ? (
            <StatusNotice title="종목/패턴 상세 분석 모드" description="현재 선택한 결과는 상세 패턴 아티팩트가 없는 과거 백테스트입니다. 새로 백테스트를 실행하면 패턴별 매수/매도, 권장 가격, 보유 상태를 저장된 결과로 바로 확인할 수 있습니다." tone="warning" />
          ) : null}

          <DashboardCard title="패턴 리더 요약" subtitle="가장 강한 패턴과 종목, 시그널 분포를 바로 확인합니다.">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                <p className="text-[11px] text-[color:var(--fg-muted)]">최고 수익 종목</p>
                <p className="mt-2 text-[18px] font-semibold text-[color:var(--buy)]">{workbench.bestStock?.symbol ?? "-"}</p>
                <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{workbench.bestStock ? formatPercent(workbench.bestStock.returnPercent) : "데이터 없음"}</p>
              </div>
              <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                <p className="text-[11px] text-[color:var(--fg-muted)]">최고 패턴</p>
                <p className="mt-2 text-[18px] font-semibold text-[color:var(--fg)]">{workbench.bestPattern?.name ?? "-"}</p>
                <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{workbench.bestPattern ? formatPercent(workbench.bestPattern.avgReturnPercent) : "데이터 없음"}</p>
              </div>
              <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                <p className="text-[11px] text-[color:var(--fg-muted)]">활성 BUY / HOLD</p>
                <p className="mt-2 text-[18px] font-semibold text-[color:var(--fg)]">{workbench.buyCount} / {workbench.holdCount}</p>
                <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">리밸런싱 기준 시그널 분포</p>
              </div>
              <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                <p className="text-[11px] text-[color:var(--fg-muted)]">평균 보유 기간</p>
                <p className="mt-2 text-[18px] font-semibold text-[color:var(--kpi)]">{workbench.avgHoldingDays || 0}일</p>
                <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">현재 워크벤치 기준</p>
              </div>
            </div>
          </DashboardCard>

          <BacktestSelectionWorkbench
            strategyId={selectedStrategyId}
            backtestId={selectedBacktestId}
            snapshotId={loadedBacktestHistory?.snapshotId ?? null}
            backtestStartDate={loadedBacktestHistory?.startDate ?? null}
            backtestEndDate={loadedBacktestHistory?.endDate ?? null}
            universeScope={displayedUniverseScope}
            stocks={workbench.stocks}
            candidateScores={candidateScores}
            signalTimeline={result?.signalTimeline}
          />

          <DashboardCard title="패턴 성과 비교" subtitle="가장 수익률이 좋은 패턴과 표본 수, 손익 특성을 함께 비교합니다.">
            <DataTable
              columns={["패턴", "적용 종목 수", "분석 수익률", "샤프", "MDD", "승률", "평균 보유", "상태"]}
              rows={workbench.patterns.map((pattern) => [
                pattern.name,
                String(pattern.sampleSize),
                formatPercent(pattern.avgReturnPercent),
                pattern.sharpe.toFixed(2),
                formatPercent(pattern.maxDrawdownPercent),
                formatPercent(pattern.winRatePercent),
                `${pattern.avgHoldingDays}일`,
                pattern.status,
              ])}
              pageSize={6}
            />
          </DashboardCard>

          <section className="grid gap-4 xl:grid-cols-2">
            <DashboardCard title="시그널 타임라인" subtitle="매수, 매도, 홀드 타이밍이 어떤 패턴으로 발생했는지 정리합니다.">
              <DataTable
                columns={["일자", "종목", "시그널", "패턴", "상태", "노트"]}
                rows={workbench.signals.map((signal) => [
                  signal.date,
                  signal.symbol,
                  <SignalBadge key={`${signal.date}-${signal.symbol}`} label={signal.signal} tone={getSignalTone(signal.signal)} />,
                  signal.pattern,
                  signal.status,
                  signal.note,
                ])}
                pageSize={6}
              />
            </DashboardCard>

            <DashboardCard title="거래 로그" subtitle="진입, 보유, 청산 근거를 거래 단위로 확인합니다.">
              <DataTable
                columns={["일자", "종목", "액션", "패턴", "보유일수", "분석 수익률", "근거"]}
                rows={workbench.trades.map((trade) => [
                  trade.date,
                  trade.symbol,
                  <SignalBadge key={`${trade.date}-${trade.symbol}-trade`} label={trade.action} tone={getSignalTone(trade.action)} />,
                  trade.pattern,
                  trade.holdingDays == null ? "-" : `${trade.holdingDays}일`,
                  trade.returnPercent == null ? "-" : formatPercent(trade.returnPercent),
                  trade.note,
                ])}
                pageSize={6}
              />
            </DashboardCard>
          </section>

          <DashboardCard title="패턴 / 시그널 규칙" subtitle="전략 생성 화면에서 정의한 워크벤치 규칙을 그대로 확인합니다.">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                <p className="text-[11px] text-[color:var(--fg-muted)]">활성 패턴</p>
                <p className="mt-2 text-[15px] font-semibold text-[color:var(--fg)]">{effectivePatternNames.length}개</p>
                <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{effectivePatternNames.join(" / ") || "기본 패턴"}</p>
              </div>
              <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                <p className="text-[11px] text-[color:var(--fg-muted)]">매수 규칙</p>
                <p className="mt-2 text-[15px] font-semibold text-[color:var(--fg)]">{effectiveSignalPlan.buyMode}</p>
              </div>
              <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                <p className="text-[11px] text-[color:var(--fg-muted)]">매도 / 손절</p>
                <p className="mt-2 text-[15px] font-semibold text-[color:var(--fg)]">{effectiveSignalPlan.sellMode}</p>
                <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">손절 {effectiveSignalPlan.stopLossPercent}% / 목표 {effectiveSignalPlan.takeProfitPercent}%</p>
              </div>
              <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                <p className="text-[11px] text-[color:var(--fg-muted)]">보유 / 리밸런싱</p>
                <p className="mt-2 text-[15px] font-semibold text-[color:var(--fg)]">{effectiveSignalPlan.holdMode}</p>
                <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{effectiveSignalPlan.rebalanceGuard}</p>
              </div>
            </div>
          </DashboardCard>
        </>
      ) : null}

      {result ? (
        <>
          <SignalOverlayChart
            title="매수 / 매도 오버레이"
            subtitle={`수익 곡선 위에 저장된 시그널 타이밍을 겹쳐 봅니다. BUY ${signalState.buyCount} · SELL ${signalState.sellCount} · HOLD ${signalState.holdCount}`}
            points={result.equityCurve}
            markers={signalOverlayMarkers}
          />

          <section className="grid gap-4 xl:grid-cols-3">
            <DashboardCard title="수익 곡선"><ChartPanel title="수익 곡선" series={equitySeries.length > 0 ? equitySeries : [0]} ranges={["백테스트"]} /></DashboardCard>
            <DashboardCard title="드로우다운 차트"><ChartPanel title="드로우다운 차트" series={drawdownSeries.length > 0 ? drawdownSeries : [0]} variant="bars" ranges={["백테스트"]} /></DashboardCard>
            <DashboardCard title="월별 수익률 히트맵"><ChartPanel title="월별 수익률 히트맵" series={monthlySeries.length > 0 ? monthlySeries : [0.5]} variant="heatmap" ranges={["월별"]} /></DashboardCard>
          </section>

          <DashboardCard title="월별 수익률" subtitle="실행된 백테스트의 월간 수익률입니다.">
            <DataTable
              columns={["월", "수익률"]}
              rows={result.monthlyReturns.map((point) => [point.date.slice(0, 7), formatPercent(point.value)])}
              pageSize={8}
            />
          </DashboardCard>
        </>
      ) : (
        <StatusNotice title="백테스트 결과가 아직 없습니다." description="전략을 선택하고 실행하면 큐에 등록된 후 결과가 저장되고, 완료되면 자동으로 불러옵니다." />
      )}

      <DashboardCard title="최근 백테스트 이력" subtitle="선택한 전략 기준의 저장된 백테스트 결과입니다.">
        {history.length > 0 ? (
          <DataTable
            columns={["백테스트 ID", "스냅샷", "대상 범위", "기간", "CAGR", "샤프지수", "최대 낙폭", "승률", "작업"]}
            rows={history.map((item) => [
              String(item.backtestId),
              item.snapshotName ?? "현재 전략",
              summarizeBacktestUniverseScope(item.universeScope).shortLabel,
              `${item.startDate ?? "-"} ~ ${item.endDate ?? "-"}`,
              item.cagr == null ? "-" : formatPercent(item.cagr),
              item.sharpe == null ? "-" : item.sharpe.toFixed(2),
              item.maxDrawdown == null ? "-" : formatPercent(item.maxDrawdown),
              item.winRate == null ? "-" : formatPercent(item.winRate),
              <button
                key={`backtest-history-${item.backtestId}`}
                type="button"
                onClick={() => setSelectedBacktestId(item.backtestId)}
                className="text-[11px] font-semibold text-[color:var(--kpi)]"
              >
                결과 불러오기
              </button>,
            ])}
            pageSize={6}
          />
        ) : (
          <StatusNotice title="백테스트 이력이 없습니다." description="백테스트를 실행하면 완료된 결과가 이력으로 저장됩니다." />
        )}
      </DashboardCard>

      <DashboardCard title="스냅샷별 성과 비교" subtitle="현재 전략에서 저장된 스냅샷별 최근 백테스트 성과를 비교합니다.">
        {history.length > 0 ? (
          <DataTable
            columns={["스냅샷", "대상 범위", "CAGR", "샤프지수", "MDD", "승률"]}
            rows={history.map((item) => [
              item.snapshotName ?? "현재 전략",
              summarizeBacktestUniverseScope(item.universeScope).shortLabel,
              item.cagr == null ? "-" : formatPercent(item.cagr),
              item.sharpe == null ? "-" : item.sharpe.toFixed(2),
              item.maxDrawdown == null ? "-" : formatPercent(item.maxDrawdown),
              item.winRate == null ? "-" : formatPercent(item.winRate),
            ])}
            pageSize={8}
          />
        ) : (
          <StatusNotice title="비교할 스냅샷 성과가 없습니다." description="가중치 스냅샷으로 백테스트를 실행하면 여기서 성과를 비교할 수 있습니다." />
        )}
      </DashboardCard>
    </div>
  );
}
