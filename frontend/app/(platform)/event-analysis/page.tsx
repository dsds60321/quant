import { EventAnalysisClient } from "@/components/features/EventAnalysisClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { getEventAnalysis } from "@/lib/api";

export default async function EventAnalysisPage() {
  const summary = await getEventAnalysis().catch(() => null);

  return (
    <PageContainer>
      <SectionTitle
        eyebrow="이벤트 기반 분석"
        title="이벤트 분석"
        description="실적, 인수합병, CEO 변경, 규제, 제품 출시 이벤트를 특정 종목 기준으로 분석합니다."
      />

      {summary ? (
        <EventAnalysisClient initialSummary={summary} />
      ) : (
        <StatusNotice title="이벤트 분석 조회 실패" description="이벤트 분석 API 응답을 받지 못했습니다." />
      )}
    </PageContainer>
  );
}
