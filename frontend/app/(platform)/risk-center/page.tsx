import { DashboardCard } from "@/components/ui/DashboardCard";
import { DataTable } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { getRiskSummary } from "@/lib/api";
import { formatCompactCurrency, formatPercent } from "@/lib/format";

export default async function RiskCenterPage() {
  const risk = await getRiskSummary().catch(() => null);

  return (
    <PageContainer>
      <SectionTitle eyebrow="리스크 감시" title="리스크 센터" description="전략 수준의 위험 지표와 경보 이벤트를 추적합니다." />

      {risk ? (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="VaR" value={formatCompactCurrency(risk.var)} change="99% 신뢰수준" accent="sell" />
            <MetricCard label="베타" value={risk.beta.toFixed(2)} change="시장 대비 방어적" accent="kpi" />
            <MetricCard label="변동성" value={formatPercent(risk.volatility)} change="연환산 기준" accent="default" />
            <MetricCard label="최대 낙폭" value={formatPercent(risk.maxDrawdown)} change="포트폴리오 기준" accent="sell" />
          </section>

          <DashboardCard title="알림 테이블">
            <DataTable
              columns={["시간", "이벤트", "전략"]}
              rows={[
                ["09:12", "변동성 한도 접근", "저PBR 모멘텀"],
                ["10:05", "기술 섹터 노출 증가", "퀄리티 성장"],
                ["13:41", "VaR 재계산 완료", "멀티 팩터 코어"],
                ["15:18", "손절 규칙 트리거", "변동성 축소"],
              ]}
            />
          </DashboardCard>
        </>
      ) : (
        <StatusNotice title="리스크 데이터 조회 실패" description="리스크 엔진 응답을 받지 못했습니다." />
      )}
    </PageContainer>
  );
}
