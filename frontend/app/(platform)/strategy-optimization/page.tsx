import { StrategyOptimizationClient } from "@/components/features/StrategyOptimizationClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getOptimizationHistory, getStrategies } from "@/lib/api";

export default async function StrategyOptimizationPage() {
  const [strategies, history] = await Promise.all([
    getStrategies().catch(() => []),
    getOptimizationHistory().catch(() => []),
  ]);

  return (
    <PageContainer>
      <SectionTitle
        eyebrow="파라미터 탐색"
        title="전략 최적화"
        description="저장된 전략을 기준으로 실제 최적화 엔진을 호출하고 결과를 비교합니다."
      />
      <StrategyOptimizationClient strategies={strategies} history={history} />
    </PageContainer>
  );
}
