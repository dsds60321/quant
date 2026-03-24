import { AssetManagementClient } from "@/components/features/AssetManagementClient";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { listPortfolios } from "@/lib/api";

export default async function PortfolioAssetsPage() {
  const portfolios = await listPortfolios().catch(() => null);

  return (
    <PageContainer>
      <SectionTitle
        eyebrow="투자 관리"
        title="자산 관리"
        description="포트폴리오에 신규 자산을 등록하고 포지션을 구축합니다."
      />
      {portfolios && portfolios.length > 0 ? (
        <DashboardCard title="자산 등록" subtitle="포트폴리오, 종목, 수량, 평균 단가를 입력합니다.">
          <AssetManagementClient portfolios={portfolios} />
        </DashboardCard>
      ) : (
        <StatusNotice title="포트폴리오가 없습니다" description="자산을 등록하려면 먼저 포트폴리오를 생성해야 합니다." />
      )}
    </PageContainer>
  );
}
