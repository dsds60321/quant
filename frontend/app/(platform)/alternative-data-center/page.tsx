import { DashboardCard } from "@/components/ui/DashboardCard";
import { DataTable } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SignalBadge } from "@/components/ui/SignalBadge";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { getAlternativeDataSummary } from "@/lib/api";

export default async function AlternativeDataCenterPage() {
  const summary = await getAlternativeDataSummary().catch(() => null);

  return (
    <PageContainer>
      <SectionTitle
        eyebrow="대체 신호 관리"
        title="대체 데이터 센터"
        description="실제 저장된 뉴스·이벤트 데이터셋 상태를 기준으로 대체 데이터 수집 현황을 점검합니다."
      />

      {summary ? (
        <>
          <section className="grid gap-3 md:grid-cols-3">
            <MetricCard label="총 데이터셋 수" value={summary.totalDatasets.toLocaleString("ko-KR")} change="구성된 대체 데이터셋" accent="kpi" />
            <MetricCard label="활성 데이터셋 수" value={summary.activeDatasets.toLocaleString("ko-KR")} change="레코드가 존재하는 데이터셋" accent="default" />
            <MetricCard label="총 레코드 수" value={summary.totalRecords.toLocaleString("ko-KR")} change="DB 적재 기준" accent={summary.totalRecords > 0 ? "buy" : "default"} />
          </section>

          <DashboardCard title="대체 데이터셋 현황" subtitle="데이터베이스에 실제로 저장된 대체 데이터 상태입니다.">
            {summary.datasets.length > 0 ? (
              <DataTable
                title="대체 데이터 테이블"
                columns={["데이터셋", "데이터 소스", "마지막 수집 시간", "데이터 수", "상태"]}
                rows={summary.datasets.map((dataset) => [
                  dataset.dataset,
                  dataset.provider,
                  dataset.lastCollectedAt?.replace("T", " ").slice(0, 16) ?? "-",
                  dataset.recordCount.toLocaleString("ko-KR"),
                  <SignalBadge key={`${dataset.dataset}-${dataset.provider}`} label={dataset.status} tone={dataset.recordCount > 0 ? "buy" : "hold"} />,
                ])}
              />
            ) : (
              <StatusNotice title="대체 데이터가 없습니다." description="뉴스 또는 이벤트 데이터가 적재되면 이 화면에 실제 데이터셋이 표시됩니다." />
            )}
          </DashboardCard>
        </>
      ) : (
        <StatusNotice title="대체 데이터 센터 조회 실패" description="대체 데이터 센터 API 응답을 받지 못했습니다." />
      )}
    </PageContainer>
  );
}
