import { MarketIndexCard } from "@/components/features/MarketIndexCard";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { getMarketIndices, getMarketSectors } from "@/lib/api";
import { formatPercent } from "@/lib/format";

const MARKET_INDEX_RANGES = ["5일", "1개월", "3개월", "1년"] as const;

export default async function MarketOverviewPage() {
  const indices = await getMarketIndices().catch(() => null);
  const sectors = await getMarketSectors().catch(() => null);

  return (
    <PageContainer>
      <SectionTitle eyebrow="시장 모니터링" title="시장 개요" description="핵심 지수와 섹터 흐름을 빠르게 점검합니다." />

      {indices ? (
        <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          {indices.map((index) => (
            <MarketIndexCard key={index.symbol} index={index} ranges={[...MARKET_INDEX_RANGES]} />
          ))}
        </section>
      ) : (
        <StatusNotice title="시장 지수 조회 실패" description="Spring Boot 또는 Python 시장 지수 API 응답을 받지 못했습니다." />
      )}

      <DashboardCard title="섹터 히트맵" subtitle="초록은 상승, 빨강은 하락을 의미합니다.">
        {sectors && sectors.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
            {sectors.map((sector) => {
              const color = sector.changePercent > 0
                ? "bg-emerald-100 text-emerald-700"
                : sector.changePercent < 0
                  ? "bg-rose-100 text-rose-700"
                  : "bg-slate-100 text-slate-700";

              return (
                <div key={sector.sector} className={`rounded-md p-4 ${color}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">섹터</p>
                  <p className="mt-3 text-[18px] font-semibold">{sector.sector}</p>
                  <p className="mt-1 text-[14px] font-medium">{formatPercent(sector.changePercent)}</p>
                  <p className="mt-2 text-[11px] opacity-80">편입 종목 {sector.stockCount.toLocaleString("ko-KR")}개</p>
                </div>
              );
            })}
          </div>
        ) : (
          <StatusNotice title="섹터 히트맵 조회 실패" description="가격 또는 종목 마스터 데이터가 아직 적재되지 않았습니다." />
        )}
      </DashboardCard>
    </PageContainer>
  );
}
