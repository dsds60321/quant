"use client";

import { useMemo, useState } from "react";
import { ChartPanel } from "@/components/ui/ChartPanel";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { DataTable } from "@/components/ui/DataTable";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { optimizeStrategy, type OptimizationResult, type StrategySummary, type StrategyOptimizationHistoryItem } from "@/lib/api";
import { formatPercent } from "@/lib/format";

const parameterOptions = [
  { label: "ROE", value: "roe_filter" },
  { label: "PBR", value: "pbr_filter" },
  { label: "모멘텀", value: "momentum_filter" },
] as const;

export function StrategyOptimizationClient({
  strategies,
  history,
}: {
  strategies: StrategySummary[];
  history: StrategyOptimizationHistoryItem[];
}) {
  const [strategyId, setStrategyId] = useState<number | null>(strategies[0]?.strategyId ?? null);
  const [parameter, setParameter] = useState<(typeof parameterOptions)[number]["value"]>("roe_filter");
  const [start, setStart] = useState(5);
  const [end, setEnd] = useState(25);
  const [step, setStep] = useState(5);
  const [objective, setObjective] = useState("sharpe");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sharpeSeries = useMemo(() => result?.trials.map((trial) => trial.metrics.sharpe ?? 0) ?? [], [result]);
  const cagrSeries = useMemo(() => result?.trials.map((trial) => trial.metrics.cagr ?? 0) ?? [], [result]);

  function handleLoadHistory(item: StrategyOptimizationHistoryItem) {
    if (!item.resultJson) {
      setError("저장된 최적화 결과 JSON이 없습니다.");
      return;
    }
    try {
      const parsed = JSON.parse(item.resultJson) as OptimizationResult;
      setStrategyId(item.strategyId);
      setParameter(item.parameterName as (typeof parameterOptions)[number]["value"]);
      setResult(parsed);
      setError(null);
    } catch {
      setError("저장된 최적화 결과를 불러오지 못했습니다.");
    }
  }

  async function handleOptimize() {
    if (!strategyId) {
      setError("최적화할 전략을 먼저 선택해야 합니다.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await optimizeStrategy({ strategyId, parameter, start, end, step, objective });
      if (!response.trials || response.trials.length === 0) {
        throw new Error("최적화 결과가 비어 있습니다. 가격 데이터와 전략 조건을 확인하세요.");
      }
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "최적화 실행 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <DashboardCard title="최적화 제어" subtitle="저장된 전략과 탐색 범위를 지정합니다.">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-[12px] font-semibold">
              <span>전략</span>
              <select value={strategyId ?? ""} onChange={(event) => setStrategyId(Number(event.target.value))} className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium">
                {strategies.map((strategy) => (
                  <option key={strategy.strategyId} value={strategy.strategyId}>{strategy.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-[12px] font-semibold">
              <span>파라미터</span>
              <select value={parameter} onChange={(event) => setParameter(event.target.value as typeof parameter)} className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium">
                {parameterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-[12px] font-semibold">
              <span>시작값</span>
              <input type="number" value={start} onChange={(event) => setStart(Number(event.target.value))} className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium" />
            </label>
            <label className="space-y-2 text-[12px] font-semibold">
              <span>종료값</span>
              <input type="number" value={end} onChange={(event) => setEnd(Number(event.target.value))} className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium" />
            </label>
            <label className="space-y-2 text-[12px] font-semibold">
              <span>간격</span>
              <input type="number" value={step} onChange={(event) => setStep(Number(event.target.value))} className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium" />
            </label>
            <label className="space-y-2 text-[12px] font-semibold">
              <span>목표 지표</span>
              <select value={objective} onChange={(event) => setObjective(event.target.value)} className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium">
                <option value="sharpe">샤프지수</option>
                <option value="cagr">CAGR</option>
              </select>
            </label>
          </div>
          <div className="mt-4">
            <PrimaryButton label={loading ? "최적화 실행 중" : "최적화 실행"} onClick={handleOptimize} disabled={loading || strategies.length === 0} />
          </div>
        </DashboardCard>

        <div className="space-y-4">
          <DashboardCard title="샤프지수 대 파라미터">
            <ChartPanel title="샤프지수 대 파라미터" subtitle="실제 최적화 trial 기준" series={sharpeSeries.length > 0 ? sharpeSeries : [0]} ranges={["최적화"]} />
          </DashboardCard>
          <DashboardCard title="CAGR 대 파라미터">
            <ChartPanel title="CAGR 대 파라미터" subtitle="실제 최적화 trial 기준" series={cagrSeries.length > 0 ? cagrSeries : [0]} variant="bars" ranges={["최적화"]} />
          </DashboardCard>
        </div>
      </section>

      {strategies.length === 0 ? <StatusNotice title="선택 가능한 전략이 없습니다." description="전략 생성 페이지에서 먼저 전략을 저장해야 합니다." /> : null}
      {error ? <StatusNotice title="전략 최적화 실패" description={error} /> : null}

      {result ? (
        <DashboardCard title="최적화 결과" subtitle={`최적 기준: ${result.objective}`}>
          <div className="mb-4 rounded-md border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-2 text-[12px]">
            {Object.entries(result.bestParameters).map(([key, value]) => `${key}: ${value}`).join(" / ") || "최적 파라미터 정보 없음"}
          </div>
          <DataTable
            columns={["파라미터", "CAGR", "샤프지수", "최대 낙폭"]}
            rows={result.trials.map((trial) => [
              String(Object.values(trial.parameters)[0] ?? "-"),
              trial.metrics.cagr == null ? "-" : formatPercent(trial.metrics.cagr),
              trial.metrics.sharpe == null ? "-" : trial.metrics.sharpe.toFixed(2),
              trial.metrics.maxDrawdown == null ? "-" : formatPercent(trial.metrics.maxDrawdown),
            ])}
            pageSize={8}
          />
        </DashboardCard>
      ) : null}

      <DashboardCard title="최근 최적화 이력" subtitle="저장된 전략 최적화 실행 기록입니다.">
        {history.length > 0 ? (
          <DataTable
            columns={["실행 ID", "전략", "파라미터", "목표 지표", "기간", "상태", "작업"]}
            rows={history.map((item) => [
              String(item.id),
              item.strategyName,
              item.parameterName,
              item.objective,
              `${item.startDate ?? "-"} ~ ${item.endDate ?? "-"}`,
              item.status,
              <button
                key={`optimization-history-${item.id}`}
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
          <StatusNotice title="최적화 이력이 없습니다." description="최적화를 실행하면 최근 이력이 여기에 저장됩니다." />
        )}
      </DashboardCard>
    </div>
  );
}
