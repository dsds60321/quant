import { NewsImpactExplorerClient } from "@/components/features/NewsImpactExplorerClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { getNewsIntelligence } from "@/lib/api";

export default async function NewsIntelligencePage() {
  const summary = await getNewsIntelligence().catch(() => null);

  return (
    <PageContainer>
      <SectionTitle
        eyebrow="뉴스 및 감성 분석"
        title="뉴스 인텔리전스"
        description="뉴스 감성, 영향 종목, 감성 지수 추이를 기반으로 이벤트 드리븐 신호를 분석합니다."
      />
      {summary ? (
        <NewsImpactExplorerClient initialSummary={summary} />
      ) : (
        <StatusNotice title="뉴스 인텔리전스 조회 실패" description="뉴스 인텔리전스 API 응답을 받지 못했습니다." />
      )}
    </PageContainer>
  );
}
