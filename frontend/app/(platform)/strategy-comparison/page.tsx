import { StrategyComparisonClient } from "@/components/features/StrategyComparisonClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getComparisonHistory, getStrategies } from "@/lib/api";

export default async function StrategyComparisonPage() {
  const [strategies, history] = await Promise.all([
    getStrategies().catch(() => []),
    getComparisonHistory().catch(() => []),
  ]);

  return (
    <PageContainer>
      <SectionTitle
        eyebrow="상대 성과 분석"
        title="전략 비교"
        description="등록된 전략을 선택해 동일 기간 기준으로 실제 비교 엔진을 실행합니다."
      />
      <StrategyComparisonClient strategies={strategies} history={history} />
    </PageContainer>
  );
}
