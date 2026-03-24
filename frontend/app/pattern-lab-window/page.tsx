import { PatternLabClient } from "@/components/features/PatternLabClient";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { getBacktestDetail, getBacktestHistory, getStrategies } from "@/lib/api";
import type { PatternExecutionModel } from "@/lib/pattern-lab";

export default async function PatternLabWindowPage({
  searchParams,
}: {
  searchParams?: Promise<{
    strategyId?: string;
    backtestId?: string;
    snapshotId?: string;
    symbols?: string;
    startDate?: string;
    endDate?: string;
    market?: string;
    executionModel?: string;
  }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const strategies = await getStrategies().catch(() => []);
  const initialStrategyId = params?.strategyId ? Number(params.strategyId) : undefined;
  const initialBacktestId = params?.backtestId ? Number(params.backtestId) : undefined;
  const initialSnapshotId = params?.snapshotId ? Number(params.snapshotId) : undefined;
  const initialSymbols = params?.symbols?.split(",").map((symbol) => symbol.trim().toUpperCase()).filter(Boolean) ?? [];
  const initialEndDate = params?.endDate ?? new Date().toISOString().slice(0, 10);
  const executionModel = (params?.executionModel as PatternExecutionModel | undefined) ?? "SIGNAL_CLOSE";
  const resolvedStrategyId = Number.isFinite(initialStrategyId) ? initialStrategyId : strategies[0]?.strategyId;
  const initialHistory = resolvedStrategyId ? await getBacktestHistory(resolvedStrategyId).catch(() => []) : [];
  const latestBacktestId = strategies.find((strategy) => strategy.strategyId === resolvedStrategyId)?.latestBacktest?.backtestId;
  const resolvedBacktestId = Number.isFinite(initialBacktestId) ? initialBacktestId : initialHistory[0]?.backtestId ?? latestBacktestId;
  const initialBacktest = resolvedBacktestId ? await getBacktestDetail(resolvedBacktestId).catch(() => null) : null;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6f8fc,#eef3fb)] px-4 py-4">
      {strategies.length > 0 ? (
        <PatternLabClient
          initialStrategies={strategies}
          initialStrategyId={resolvedStrategyId}
          initialBacktestId={resolvedBacktestId}
          initialSnapshotId={Number.isFinite(initialSnapshotId) ? initialSnapshotId : undefined}
          initialHistory={initialHistory}
          initialBacktest={initialBacktest}
          initialSymbols={initialSymbols}
          initialStartDate={params?.startDate}
          initialEndDate={initialEndDate}
          initialMarket={params?.market}
          initialExecutionModel={executionModel}
          standalone
        />
      ) : (
        <StatusNotice title="패턴 분석 창을 열 수 없습니다." description="전략 데이터를 불러오지 못했습니다." />
      )}
    </main>
  );
}
