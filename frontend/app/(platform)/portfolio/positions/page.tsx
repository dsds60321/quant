import { PortfolioPositionsClient } from "@/components/features/PortfolioPositionsClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { getPortfolioDetail, listPortfolios } from "@/lib/api";

export default async function PortfolioPositionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ portfolioId?: string }>;
}) {
  const portfolios = await listPortfolios().catch(() => null);
  const params = await searchParams;
  const requestedPortfolioId = Number(params?.portfolioId ?? portfolios?.[0]?.portfolioId ?? 0);
  const initialPortfolioId = Number.isFinite(requestedPortfolioId) && requestedPortfolioId > 0 ? requestedPortfolioId : null;
  const initialDetail = initialPortfolioId ? await getPortfolioDetail(initialPortfolioId).catch(() => null) : null;

  return (
    <PageContainer>
      <SectionTitle
        eyebrow="투자 관리"
        title="포지션"
        description="선택한 포트폴리오의 보유 자산, 평가 금액, 손익을 상세하게 확인합니다."
      />
      {portfolios ? (
        <PortfolioPositionsClient portfolios={portfolios} initialPortfolioId={initialPortfolioId} initialDetail={initialDetail} />
      ) : (
        <StatusNotice title="포지션 데이터 조회 실패" description="포트폴리오 API 응답을 받지 못했습니다." />
      )}
    </PageContainer>
  );
}
