import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { getOrders, getPortfolioSummary } from "@/lib/api";
import { TradingCenterClient } from "@/components/features/TradingCenterClient";

export default async function TradingCenterPage() {
  const [orders, portfolio] = await Promise.all([
    getOrders().catch(() => null),
    getPortfolioSummary().catch(() => null),
  ]);

  return (
    <PageContainer>
      <SectionTitle
        eyebrow="거래 운영"
        title="거래 센터"
        description="주문, 체결, 포지션을 분리해 실거래 흐름을 관리합니다."
      />
      {orders && portfolio ? (
        <TradingCenterClient initialOrders={orders} initialPortfolio={portfolio} />
      ) : (
        <StatusNotice title="거래 데이터 조회 실패" description="주문 또는 포트폴리오 API 응답을 받지 못했습니다." />
      )}
    </PageContainer>
  );
}
