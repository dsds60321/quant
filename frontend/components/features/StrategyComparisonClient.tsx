"use client";

import { useMemo, useState } from "react";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { DataTable } from "@/components/ui/DataTable";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { compareStrategies, type StrategyComparisonHistoryItem, type StrategyComparisonResult, type StrategySummary } from "@/lib/api";
import { formatPercent } from "@/lib/format";

export function StrategyComparisonClient({
  strategies,
  history,
}: {
  strategies: StrategySummary[];
  history: StrategyComparisonHistoryItem[];
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>(strategies.slice(0, 2).map((strategy) => strategy.strategyId));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StrategyComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const strategyNameMap = useMemo(() => new Map(strategies.map((strategy) => [strategy.strategyId, strategy.name])), [strategies]);
  const strategyMap = useMemo(() => new Map(strategies.map((strategy) => [strategy.strategyId, strategy])), [strategies]);

  function toggleStrategy(strategyId: number) {
    setSelectedIds((current) => (current.includes(strategyId) ? current.filter((id) => id !== strategyId) : [...current, strategyId].slice(-4)));
  }

  async function handleCompare() {
    if (selectedIds.length < 2) {
      setError("비교하려면 최소 두 개 전략을 선택해야 합니다.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await compareStrategies({ strategyIds: selectedIds });
      if (!response.strategies || response.strategies.length === 0) {
        throw new Error("전략 비교 결과가 비어 있습니다. 가격 데이터와 전략 조건을 확인하세요.");
      }
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "전략 비교 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleLoadHistory(item: StrategyComparisonHistoryItem) {
    if (!item.resultJson) {
      setError("저장된 전략 비교 결과 JSON이 없습니다.");
      return;
    }
    try {
      const parsed = JSON.parse(item.resultJson) as StrategyComparisonResult;
      setResult(parsed);
      setError(null);
    } catch {
      setError("저장된 전략 비교 결과를 불러오지 못했습니다.");
    }
  }

  return (
    <div className="space-y-4">
      <DashboardCard title="전략 선택" subtitle="비교할 전략을 2개 이상 선택합니다.">
        <div className="flex flex-wrap gap-2">
          {strategies.map((strategy) => {
            const active = selectedIds.includes(strategy.strategyId);
            return (
              <button key={strategy.strategyId} type="button" onClick={() => toggleStrategy(strategy.strategyId)} className={`rounded-md border px-3 py-2 text-[12px] font-semibold ${active ? "border-black bg-black text-white" : "border-[color:var(--line)] bg-white text-[color:var(--fg)]"}`}>
                {strategy.name}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex gap-2">
          <PrimaryButton label={loading ? "그래프 비교 중" : "그래프 비교"} onClick={handleCompare} disabled={loading || strategies.length < 2} />
          <SecondaryButton label="선택 초기화" onClick={() => setSelectedIds([])} />
        </div>
      </DashboardCard>

      {strategies.length < 2 ? <StatusNotice title="비교 가능한 전략이 부족합니다." description="전략 생성 페이지에서 두 개 이상 전략을 등록해야 합니다." /> : null}
      {error ? <StatusNotice title="전략 비교 실패" description={error} /> : null}

      {result ? (
        <>
          <DashboardCard title="수익 곡선 비교" subtitle={`벤치마크 ${result.benchmarkSymbol} 기준 비교입니다.`}>
            <div className="grid gap-3 xl:grid-cols-2">
              {result.strategies.map((strategy) => (
                <div key={strategy.strategyId} className="rounded-md border border-[color:var(--line)] p-3">
                  <p className="text-[12px] font-semibold">{strategyNameMap.get(strategy.strategyId) ?? `전략 ${strategy.strategyId}`}</p>
                  <div className="mt-3 flex h-28 items-end gap-1 overflow-hidden rounded-md border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-2 py-3">
                    {strategy.equityCurve.slice(-24).map((point, index, points) => {
                      const values = points.map((item) => item.value);
                      const min = Math.min(...values);
                      const max = Math.max(...values);
                      const base = max === min ? 1 : max - min;
                      const height = ((point.value - min) / base) * 100;
                      return <div key={`${strategy.strategyId}-${index}`} className="flex-1 rounded-sm bg-slate-900/85" style={{ height: `${Math.max(height, 8)}%` }} />;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </DashboardCard>

          <DashboardCard title="전략 비교 테이블" subtitle="실제 비교 엔진 응답 기준입니다.">
            <DataTable
              columns={["전략", "가중치 모드", "가중치", "CAGR", "Sharpe", "MDD", "Win Rate", "Volatility"]}
              rows={result.strategies.map((strategy) => [
                strategyNameMap.get(strategy.strategyId) ?? `전략 ${strategy.strategyId}`,
                strategyMap.get(strategy.strategyId)?.factorWeightMode === "MANUAL" ? "직접 설정" : "추천",
                strategyMap.get(strategy.strategyId)
                  ? `모멘텀 ${strategyMap.get(strategy.strategyId)?.factorWeights.momentum ?? 35} / 가치 ${strategyMap.get(strategy.strategyId)?.factorWeights.value ?? 25} / 퀄리티 ${strategyMap.get(strategy.strategyId)?.factorWeights.quality ?? 20} / 뉴스 ${strategyMap.get(strategy.strategyId)?.factorWeights.news ?? 5} / 실적 ${strategyMap.get(strategy.strategyId)?.factorWeights.earnings_surprise ?? 10} / 내부자 ${strategyMap.get(strategy.strategyId)?.factorWeights.insider_activity ?? 5}`
                  : "-",
                strategy.metrics.cagr == null ? "-" : formatPercent(strategy.metrics.cagr),
                strategy.metrics.sharpe == null ? "-" : strategy.metrics.sharpe.toFixed(2),
                strategy.metrics.maxDrawdown == null ? "-" : formatPercent(strategy.metrics.maxDrawdown),
                strategy.metrics.winRate == null ? "-" : formatPercent(strategy.metrics.winRate),
                strategy.metrics.annualizedVolatility == null ? "-" : formatPercent(strategy.metrics.annualizedVolatility),
              ])}
              pageSize={8}
            />
          </DashboardCard>
        </>
      ) : null}

      <DashboardCard title="최근 전략 비교 이력" subtitle="저장된 전략 비교 실행 기록입니다.">
        {history.length > 0 ? (
          <DataTable
            columns={["실행 ID", "비교 전략", "벤치마크", "기간", "상태", "작업"]}
            rows={history.map((item) => [
              String(item.id),
              item.strategyIdsJson,
              item.benchmarkSymbol,
              `${item.startDate ?? "-"} ~ ${item.endDate ?? "-"}`,
              item.status,
              <button
                key={`comparison-history-${item.id}`}
                type="button"
                onClick={() => handleLoadHistory(item)}
                className="text-[11px] font-semibold text-[color:var(--kpi)]"
              >
                결과 불러오기
              </button>,
            ])}
            pageSize={6}
          />
        ) : (
          <StatusNotice title="전략 비교 이력이 없습니다." description="전략 비교를 실행하면 최근 이력이 여기에 저장됩니다." />
        )}
      </DashboardCard>
    </div>
  );
}
