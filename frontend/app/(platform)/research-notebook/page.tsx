import { ResearchNotebookClient } from "@/components/features/ResearchNotebookClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getStrategies } from "@/lib/api";

export default async function ResearchNotebookPage() {
  const strategies = await getStrategies().catch(() => []);

  return (
    <PageContainer>
      <SectionTitle
        eyebrow="리서치 환경"
        title="연구 노트"
        description="등록 전략과 최신 백테스트를 기준으로 연구용 코드와 성과 요약을 확인합니다."
      />
      <ResearchNotebookClient strategies={strategies} />
    </PageContainer>
  );
}
