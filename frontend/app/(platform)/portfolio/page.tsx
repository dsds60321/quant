import { PortfolioManagementClient } from "@/components/features/PortfolioManagementClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { listPortfolios } from "@/lib/api";

export default async function PortfolioPage() {
  const portfolios = await listPortfolios().catch(() => null);

  return (
    <PageContainer>
      <SectionTitle
        eyebrow="투자 관리"
        title="포트폴리오"
        description="포트폴리오 목록, 총 평가금액, 손익을 한 화면에서 관리합니다."
      />
      {portfolios ? (
        <PortfolioManagementClient initialPortfolios={portfolios} />
      ) : (
        <StatusNotice title="포트폴리오 목록 조회 실패" description="포트폴리오 API 응답을 받지 못했습니다." />
      )}
    </PageContainer>
  );
}
