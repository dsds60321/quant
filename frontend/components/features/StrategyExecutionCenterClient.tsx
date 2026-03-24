"use client";

import { useEffect, useMemo, useState } from "react";
import { SignalOverlayChart } from "@/components/features/SignalOverlayChart";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { DataTable } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/ui/MetricCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { SignalBadge } from "@/components/ui/SignalBadge";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { buildSignalOverlayMarkers, getBestPatternName, summarizeSignalState } from "@/lib/backtest-signal";
import {
  getBacktestDetail,
  getBacktestHistory,
  getStrategyRuns,
  startStrategy,
  stopStrategy,
  type BacktestHistoryItem,
  type BacktestResult,
  type StrategyRunItem,
  type StrategySummary,
} from "@/lib/api";
import { formatPercent } from "@/lib/format";

function getRunStatusLabel(status: string) {
  switch (status) {
    case "RUNNING":
      return "실행중";
    case "STOPPED":
      return "중지됨";
    case "PENDING":
      return "대기";
    default:
      return status;
  }
}

function getRunStatusTone(status: string): "buy" | "sell" | "hold" | "neutral" {
  switch (status) {
    case "RUNNING":
      return "buy";
    case "STOPPED":
      return "sell";
    case "PENDING":
      return "hold";
    default:
      return "neutral";
  }
}

function getSignalTone(signal: string): "buy" | "sell" | "hold" {
  if (signal === "BUY") {
    return "buy";
  }
  if (signal === "SELL") {
    return "sell";
  }
  return "hold";
}

function formatDateTime(value: string | null | undefined) {
  return value ? value.replace("T", " ").slice(0, 16) : "-";
}

type StrategyBacktestSummary = {
  backtestId: number;
  label: string;
  cagr: number | null;
  sharpe: number | null;
  maxDrawdown: number | null;
  winRate: number | null;
  createdAt: string | null;
};

function buildLatestBacktestMap(strategies: StrategySummary[], history: BacktestHistoryItem[]) {
  const mapped = new Map<number, StrategyBacktestSummary>();

  for (const strategy of strategies) {
    if (!strategy.latestBacktest) {
      continue;
    }
    mapped.set(strategy.strategyId, {
      backtestId: strategy.latestBacktest.backtestId,
      label: strategy.latestBacktest.snapshotName ?? "현재 전략",
      cagr: strategy.latestBacktest.cagr,
      sharpe: strategy.latestBacktest.sharpe,
      maxDrawdown: strategy.latestBacktest.maxDrawdown,
      winRate: strategy.latestBacktest.winRate,
      createdAt: strategy.latestBacktest.createdAt,
    });
  }

  for (const item of history) {
    const current = mapped.get(item.strategyId);
    if (!current || (item.createdAt ?? "") > (current.createdAt ?? "")) {
      mapped.set(item.strategyId, {
        backtestId: item.backtestId,
        label: item.snapshotName ?? "현재 전략",
        cagr: item.cagr,
        sharpe: item.sharpe,
        maxDrawdown: item.maxDrawdown,
        winRate: item.winRate,
        createdAt: item.createdAt,
      });
    }
  }

  return mapped;
}

export function StrategyExecutionCenterClient({
  initialRuns,
  strategies,
  initialHistory,
}: {
  initialRuns: StrategyRunItem[];
  strategies: StrategySummary[];
  initialHistory: BacktestHistoryItem[];
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [history, setHistory] = useState(initialHistory);
  const [detailCache, setDetailCache] = useState<Record<number, BacktestResult>>({});
  const [failedDetailIds, setFailedDetailIds] = useState<number[]>([]);
  const [focusedStrategyId, setFocusedStrategyId] = useState<number | null>(
    initialRuns.find((run) => run.status === "RUNNING")?.strategyId ?? strategies[0]?.strategyId ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const latestBacktestByStrategy = useMemo(
    () => buildLatestBacktestMap(strategies, history),
    [history, strategies],
  );

  useEffect(() => {
    if (focusedStrategyId && strategies.some((strategy) => strategy.strategyId === focusedStrategyId)) {
      return;
    }
    setFocusedStrategyId(runs.find((run) => run.status === "RUNNING")?.strategyId ?? strategies[0]?.strategyId ?? null);
  }, [focusedStrategyId, runs, strategies]);

  const preloadBacktestIds = useMemo(() => {
    const ids = new Set<number>();
    for (const run of runs) {
      const summary = latestBacktestByStrategy.get(run.strategyId);
      if (summary?.backtestId) {
        ids.add(summary.backtestId);
      }
    }
    if (focusedStrategyId != null) {
      const focusedSummary = latestBacktestByStrategy.get(focusedStrategyId);
      if (focusedSummary?.backtestId) {
        ids.add(focusedSummary.backtestId);
      }
    }
    return Array.from(ids);
  }, [focusedStrategyId, latestBacktestByStrategy, runs]);

  const missingBacktestIds = useMemo(
    () => preloadBacktestIds.filter((backtestId) => detailCache[backtestId] == null && !failedDetailIds.includes(backtestId)),
    [detailCache, failedDetailIds, preloadBacktestIds],
  );

  useEffect(() => {
    if (missingBacktestIds.length === 0) {
      return;
    }

    let cancelled = false;
    setDetailLoading(true);

    void Promise.all(
      missingBacktestIds.map(async (backtestId) => {
        try {
          const detail = await getBacktestDetail(backtestId);
          return { backtestId, detail, error: null as string | null };
        } catch (err) {
          return {
            backtestId,
            detail: null,
            error: err instanceof Error ? err.message : "상세 백테스트 결과를 불러오지 못했습니다.",
          };
        }
      }),
    ).then((responses) => {
      if (cancelled) {
        return;
      }

      const successEntries = responses
        .filter((item): item is { backtestId: number; detail: BacktestResult; error: null } => item.detail != null)
        .map((item) => [item.backtestId, item.detail] as const);
      if (successEntries.length > 0) {
        setDetailCache((current) => ({ ...current, ...Object.fromEntries(successEntries) }));
      }

      const failures = responses.filter((item) => item.error != null).map((item) => item.backtestId);
      if (failures.length > 0) {
        setFailedDetailIds((current) => Array.from(new Set([...current, ...failures])));
        setDetailError("일부 백테스트 상세 결과를 불러오지 못했습니다.");
      } else {
        setDetailError(null);
      }
      setDetailLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [missingBacktestIds]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [nextRuns, nextHistory] = await Promise.all([getStrategyRuns(), getBacktestHistory()]);
      setRuns(nextRuns);
      setHistory(nextHistory);
      setFailedDetailIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "전략 실행 데이터를 새로고침하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStart() {
    if (!focusedStrategyId) {
      setError("시작할 전략을 먼저 선택해야 합니다.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await startStrategy({ strategyId: focusedStrategyId, portfolioId: 1 });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "전략 시작 중 오류가 발생했습니다.");
      setLoading(false);
    }
  }

  async function handleStop() {
    const target = runs.find((run) => run.strategyId === focusedStrategyId && run.status === "RUNNING")
      ?? runs.find((run) => run.status === "RUNNING");
    if (!target) {
      setError("중지할 실행중 전략이 없습니다.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await stopStrategy(target.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "전략 중지 중 오류가 발생했습니다.");
      setLoading(false);
    }
  }

  const runningCount = runs.filter((run) => run.status === "RUNNING").length;
  const focusedStrategy = strategies.find((strategy) => strategy.strategyId === focusedStrategyId) ?? null;
  const focusedBacktestSummary = focusedStrategyId == null ? null : latestBacktestByStrategy.get(focusedStrategyId) ?? null;
  const focusedDetail = focusedBacktestSummary ? detailCache[focusedBacktestSummary.backtestId] ?? null : null;
  const focusedSignalSummary = useMemo(() => summarizeSignalState(focusedDetail), [focusedDetail]);
  const focusedMarkers = useMemo(() => buildSignalOverlayMarkers(focusedDetail?.signalTimeline), [focusedDetail?.signalTimeline]);
  const focusedBestPattern = useMemo(() => getBestPatternName(focusedDetail), [focusedDetail]);
  const focusedRunning = runs.some((run) => run.strategyId === focusedStrategyId && run.status === "RUNNING");
  const latestSignalRows = (focusedDetail?.signalTimeline ?? []).slice(-8).reverse();
  const latestTradeRows = (focusedDetail?.tradeLog ?? []).slice(-8).reverse();
  const focusedStocks = (focusedDetail?.stockBreakdown ?? []).slice(0, 8);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="활성 전략 수" value={runningCount.toString()} change={`전체 ${runs.length}개 실행 이력`} accent="kpi" />
        <MetricCard
          label="포커스 전략 최신 CAGR"
          value={focusedBacktestSummary?.cagr == null ? "-" : formatPercent(focusedBacktestSummary.cagr)}
          change={focusedStrategy?.name ?? "전략 미선택"}
          accent="buy"
        />
        <MetricCard
          label="현재 BUY 후보"
          value={String(focusedSignalSummary.buyCount)}
          change={`SELL ${focusedSignalSummary.sellCount} / HOLD ${focusedSignalSummary.holdCount}`}
          accent="buy"
        />
        <MetricCard
          label="대표 패턴"
          value={focusedBestPattern ?? "-"}
          change={focusedBacktestSummary ? `백테스트 ${focusedBacktestSummary.backtestId}` : "백테스트 없음"}
          accent="kpi"
        />
      </section>

      <DashboardCard title="실행 컨트롤" subtitle="운영할 전략을 고르고 최신 백테스트 신호를 기준으로 실행 상태를 관리합니다.">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_auto_auto_auto] lg:items-end">
          <label className="space-y-2 text-[12px] font-semibold text-[color:var(--fg)]">
            <span>포커스 전략</span>
            <select
              value={focusedStrategyId ?? ""}
              onChange={(event) => setFocusedStrategyId(event.target.value ? Number(event.target.value) : null)}
              className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium"
            >
              {strategies.map((strategy) => (
                <option key={strategy.strategyId} value={strategy.strategyId}>{strategy.name}</option>
              ))}
            </select>
          </label>
          <PrimaryButton label={focusedRunning ? "이미 실행중" : "전략 시작"} onClick={handleStart} disabled={loading || !focusedStrategyId || focusedRunning} />
          <SecondaryButton label="전략 중지" onClick={handleStop} disabled={loading || runningCount === 0} />
          <SecondaryButton label={loading ? "새로고침 중" : "실행 현황 새로고침"} onClick={refresh} disabled={loading} />
        </div>
      </DashboardCard>

      {error ? <StatusNotice title="전략 실행 센터 요청 실패" description={error} /> : null}
      {detailError ? <StatusNotice title="백테스트 상세 일부 누락" description={detailError} /> : null}

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <DashboardCard title="운영 전략 목록" subtitle="실행 상태와 최신 백테스트 시그널을 함께 모니터링합니다.">
          {runs.length > 0 ? (
            <DataTable
              columns={["전략 이름", "실행 상태", "최신 백테스트", "현재 시그널", "대표 패턴", "작업"]}
              rows={runs.map((run) => {
                const summary = latestBacktestByStrategy.get(run.strategyId);
                const detail = summary ? detailCache[summary.backtestId] ?? null : null;
                const signalSummary = summarizeSignalState(detail);
                const bestPattern = getBestPatternName(detail);
                return [
                  run.strategyName,
                  <SignalBadge key={`${run.id}-status`} label={getRunStatusLabel(run.status)} tone={getRunStatusTone(run.status)} />,
                  summary ? (
                    <div key={`${run.id}-backtest`} className="space-y-1">
                      <p className="font-semibold text-[color:var(--fg)]">#{summary.backtestId} · {summary.label}</p>
                      <p className="text-[11px] text-[color:var(--fg-muted)]">
                        CAGR {summary.cagr == null ? "-" : formatPercent(summary.cagr)} · 샤프 {summary.sharpe == null ? "-" : summary.sharpe.toFixed(2)}
                      </p>
                    </div>
                  ) : "백테스트 없음",
                  detail ? (
                    <div key={`${run.id}-signal`} className="space-y-1">
                      <SignalBadge label={signalSummary.dominantSignal} tone={getSignalTone(signalSummary.dominantSignal)} />
                      <p className="text-[11px] text-[color:var(--fg-muted)]">
                        BUY {signalSummary.buyCount} / SELL {signalSummary.sellCount} / HOLD {signalSummary.holdCount}
                      </p>
                    </div>
                  ) : summary ? "상세 로딩 중" : "신호 없음",
                  bestPattern ?? (summary ? "계산 중" : "-"),
                  <button
                    key={`${run.id}-focus`}
                    type="button"
                    onClick={() => setFocusedStrategyId(run.strategyId)}
                    className="text-[11px] font-semibold text-[color:var(--kpi)]"
                  >
                    모니터링
                  </button>,
                ];
              })}
              pageSize={6}
            />
          ) : (
            <StatusNotice title="실행중 전략이 없습니다." description="전략을 선택해 시작하면 운영 목록과 최신 신호가 여기 표시됩니다." />
          )}
        </DashboardCard>

        <DashboardCard
          title="포커스 전략 모니터"
          subtitle={focusedStrategy ? `${focusedStrategy.name}의 최신 백테스트 신호를 기준으로 운영 포인트를 확인합니다.` : "포커스 전략을 선택하세요."}
        >
          {focusedBacktestSummary && focusedDetail ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                  <p className="text-[11px] text-[color:var(--fg-muted)]">백테스트</p>
                  <p className="mt-2 text-[18px] font-semibold text-[color:var(--fg)]">#{focusedBacktestSummary.backtestId}</p>
                  <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{focusedBacktestSummary.label}</p>
                </div>
                <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                  <p className="text-[11px] text-[color:var(--fg-muted)]">우세 시그널</p>
                  <div className="mt-2">
                    <SignalBadge label={focusedSignalSummary.dominantSignal} tone={getSignalTone(focusedSignalSummary.dominantSignal)} />
                  </div>
                  <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">
                    BUY {focusedSignalSummary.buyCount} / SELL {focusedSignalSummary.sellCount} / HOLD {focusedSignalSummary.holdCount}
                  </p>
                </div>
                <div className="rounded-md border border-[color:var(--line)] px-3 py-3">
                  <p className="text-[11px] text-[color:var(--fg-muted)]">대표 패턴</p>
                  <p className="mt-2 text-[18px] font-semibold text-[color:var(--kpi)]">{focusedBestPattern ?? "-"}</p>
                  <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">최근 생성 {formatDateTime(focusedBacktestSummary.createdAt)}</p>
                </div>
              </div>

              <SignalOverlayChart
                title="실행 시그널 오버레이"
                subtitle="최신 백테스트 수익 곡선 위에 매수, 매도, 홀드 포인트를 겹쳐 운영 기준을 점검합니다."
                points={focusedDetail.equityCurve}
                markers={focusedMarkers}
              />
            </div>
          ) : focusedBacktestSummary && detailLoading ? (
            <StatusNotice title="백테스트 상세 로딩 중" description="포커스 전략의 종목별 신호와 거래 로그를 불러오고 있습니다." />
          ) : (
            <StatusNotice title="연동된 백테스트가 없습니다." description="포커스 전략으로 백테스트를 먼저 실행하면 실행 센터에서 신호와 패턴을 모니터링할 수 있습니다." />
          )}
        </DashboardCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <DashboardCard title="현재 후보 종목" subtitle="포커스 전략의 최신 백테스트에서 살아남은 종목과 현재 시그널입니다.">
          {focusedStocks.length > 0 ? (
            <DataTable
              columns={["종목", "현재 시그널", "수익률", "기여도", "패턴"]}
              rows={focusedStocks.map((stock) => [
                stock.symbol,
                <SignalBadge key={`${stock.symbol}-current-signal`} label={stock.signal ?? "HOLD"} tone={getSignalTone(stock.signal ?? "HOLD")} />,
                formatPercent(stock.returnPercent),
                formatPercent(stock.contributionPercent),
                stock.activePatterns?.join(", ") || "-",
              ])}
              pageSize={5}
            />
          ) : (
            <StatusNotice title="후보 종목 데이터가 없습니다." description="백테스트 상세에 종목별 결과가 저장되면 여기서 바로 확인할 수 있습니다." />
          )}
        </DashboardCard>

        <DashboardCard title="최신 시그널 타임라인" subtitle="실행 직전 기준으로 어떤 날짜에 어떤 시그널이 발생했는지 봅니다.">
          {latestSignalRows.length > 0 ? (
            <DataTable
              columns={["일자", "종목", "시그널", "패턴", "상태"]}
              rows={latestSignalRows.map((signal) => [
                signal.date,
                signal.symbol,
                <SignalBadge key={`${signal.date}-${signal.symbol}-timeline`} label={signal.signal} tone={getSignalTone(signal.signal)} />,
                signal.pattern ?? "-",
                signal.status ?? "-",
              ])}
              pageSize={5}
            />
          ) : (
            <StatusNotice title="시그널 타임라인이 없습니다." description="백테스트 상세 결과가 로드되면 최신 BUY, SELL, HOLD 타이밍이 표시됩니다." />
          )}
        </DashboardCard>

        <DashboardCard title="최신 거래 로그" subtitle="진입과 청산 근거를 거래 단위로 빠르게 점검합니다.">
          {latestTradeRows.length > 0 ? (
            <DataTable
              columns={["일자", "종목", "액션", "패턴", "분석 수익률"]}
              rows={latestTradeRows.map((trade) => [
                trade.date,
                trade.symbol,
                <SignalBadge key={`${trade.date}-${trade.symbol}-trade`} label={trade.action} tone={getSignalTone(trade.action)} />,
                trade.pattern ?? "-",
                trade.returnPercent == null ? "-" : formatPercent(trade.returnPercent),
              ])}
              pageSize={5}
            />
          ) : (
            <StatusNotice title="거래 로그가 없습니다." description="백테스트 상세의 거래 로그가 저장되면 실행 센터에서도 바로 확인할 수 있습니다." />
          )}
        </DashboardCard>
      </section>
    </div>
  );
}
