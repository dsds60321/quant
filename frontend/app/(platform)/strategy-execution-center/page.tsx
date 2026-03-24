import { StrategyExecutionCenterClient } from "@/components/features/StrategyExecutionCenterClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { getBacktestHistory, getStrategies, getStrategyRuns } from "@/lib/api";

export default async function StrategyExecutionCenterPage() {
  const [runs, strategies, history] = await Promise.all([
    getStrategyRuns().catch(() => null),
    getStrategies().catch(() => []),
    getBacktestHistory().catch(() => []),
  ]);

  return (
    <PageContainer>
      <SectionTitle
        eyebrow="실거래 운영"
        title="전략 실행 센터"
        description="라이브 전략 상태, 실행 이력, 실시간 성과를 한 화면에서 운영합니다."
      />
      {runs ? (
        <StrategyExecutionCenterClient initialRuns={runs} strategies={strategies} initialHistory={history} />
      ) : (
        <StatusNotice title="전략 실행 데이터 조회 실패" description="전략 실행 이력 API 응답을 받지 못했습니다." />
      )}
    </PageContainer>
  );
}
