import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { BacktestClient } from "@/components/features/BacktestClient";
import { getBacktestHistory, getStrategies } from "@/lib/api";

export default async function BacktestResultsPage({
  searchParams,
}: {
  searchParams?: Promise<{ strategyId?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const strategies = await getStrategies().catch(() => []);
  const initialStrategyId = params?.strategyId ? Number(params.strategyId) : undefined;
  const history = await getBacktestHistory(Number.isFinite(initialStrategyId) ? initialStrategyId : undefined).catch(() => []);

  return (
    <PageContainer>
      <SectionTitle
        eyebrow="성과 분석"
        title="선별 백테스트 결과"
        description="생성한 전략이 과거에 어떤 종목을 선별했는지와 종목군 성과를 검증합니다. 선택 종목은 패턴 실험실로 보내 매수/매도 패턴을 추가 검증할 수 있습니다."
      />
      <BacktestClient
        strategies={strategies}
        initialStrategyId={Number.isFinite(initialStrategyId) ? initialStrategyId : undefined}
        initialHistory={history}
      />
    </PageContainer>
  );
}
