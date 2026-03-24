import { PatternLabClient } from "@/components/features/PatternLabClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { getBacktestDetail, getBacktestHistory, getStrategies } from "@/lib/api";
import type { PatternExecutionModel } from "@/lib/pattern-lab";

export default async function PatternLabPage({
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
    universeLabel?: string;
    universeMode?: string;
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
    <PageContainer>
      <SectionTitle
        eyebrow="분석 / 실험"
        title="패턴 실험실"
        description="백테스트로 선별된 종목에 여러 패턴을 적용하여 차트 기반 BUY/SELL/HOLD 신호와 권장 매수가·매도가, 종목별·패턴별 성과를 검증합니다."
      />
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
          initialUniverseLabel={params?.universeLabel}
          initialExecutionModel={executionModel}
        />
      ) : (
        <StatusNotice title="패턴 실험실을 열 수 없습니다." description="저장된 전략이 없습니다. 먼저 전략 생성 화면에서 전략을 저장한 뒤 다시 시도하세요." />
      )}
    </PageContainer>
  );
}
