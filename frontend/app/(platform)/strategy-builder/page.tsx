import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StrategyBuilderClient } from "@/components/features/StrategyBuilderClient";
import { getStrategies } from "@/lib/api";

export default async function StrategyBuilderPage({
  searchParams,
}: {
  searchParams?: Promise<{ strategyId?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const strategies = await getStrategies().catch(() => []);
  const parsedStrategyId = params?.strategyId ? Number(params.strategyId) : undefined;
  const initialStrategyId = Number.isFinite(parsedStrategyId) ? parsedStrategyId : undefined;

  return (
    <PageContainer>
      <SectionTitle
        eyebrow="팩터 설계"
        title="전략 생성"
        description="팩터, 가중치, 유니버스, 리밸런싱 규칙을 정의하여 종목 선별 전략을 생성합니다. 실제 종목 성과 검증은 백테스트에서, 매수/매도 패턴 실험은 패턴 실험실에서 진행합니다."
      />
      <StrategyBuilderClient initialStrategies={strategies} initialRequestedStrategyId={initialStrategyId} />
    </PageContainer>
  );
}
