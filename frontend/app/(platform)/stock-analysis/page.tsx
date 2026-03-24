import { StockAnalysisLandingClient } from "@/components/features/StockAnalysisLandingClient";
import { StockDataDetailClient } from "@/components/features/StockDataDetailClient";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { getStockDataDetail } from "@/lib/api";

export default async function StockAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string }>;
}) {
  const { symbol } = await searchParams;
  const resolvedSymbol = symbol?.trim().toUpperCase() ?? "";
  const detail = resolvedSymbol ? await getStockDataDetail(resolvedSymbol).catch(() => null) : null;

  return (
    <PageContainer>
      <SectionTitle
        eyebrow="데이터 플랫폼"
        title={detail ? `${detail.symbol} 종목별 분석` : "종목별 분석"}
        description="동기화로 저장된 가격 이력, 펀더멘털, 뉴스, 이벤트 데이터를 종목 단위로 조회합니다."
      />

      {detail ? <StockDataDetailClient detail={detail} /> : <StockAnalysisLandingClient />}

      {resolvedSymbol && !detail ? (
        <StatusNotice
          title="종목 데이터 조회 실패"
          description={`${resolvedSymbol} 심볼의 저장 데이터를 불러오지 못했습니다. 심볼이 적재되어 있는지 확인한 뒤 다시 검색하세요.`}
        />
      ) : null}
    </PageContainer>
  );
}
