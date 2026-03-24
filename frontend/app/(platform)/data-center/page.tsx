import { DataCenterClient } from "@/components/features/DataCenterClient";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { DataTable } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SignalBadge } from "@/components/ui/SignalBadge";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { getDataStatus, getJobs } from "@/lib/api";

export default async function DataCenterPage() {
  const [status, jobs] = await Promise.all([
    getDataStatus().catch(() => null),
    getJobs().catch(() => null),
  ]);

  return (
    <PageContainer>
      <SectionTitle
        eyebrow="데이터 운영"
        title="데이터 센터"
        description="시장 데이터, 뉴스 데이터, NLP 처리, 피처 생성 상태를 실제 저장 데이터 기준으로 관리합니다."
        action={<DataCenterClient initialStatus={status} />}
      />

      {status ? (
        <>
          <section className="grid gap-3 md:grid-cols-4">
            <MetricCard label="가격 데이터 행 수" value={status.priceRowCount.toLocaleString("ko-KR")} change={status.latestPriceDate ? `최신 ${status.latestPriceDate}` : "가격 데이터 미적재"} accent="kpi" />
            <MetricCard label="펀더멘털 행 수" value={status.fundamentalsRowCount.toLocaleString("ko-KR")} change={status.latestFundamentalsDate ? `최신 ${status.latestFundamentalsDate}` : "펀더멘털 미적재"} accent="default" />
            <MetricCard label="벤치마크 행 수" value={status.benchmarkRowCount.toLocaleString("ko-KR")} change={status.latestBenchmarkDate ? `최신 ${status.latestBenchmarkDate}` : "벤치마크 미적재"} accent="default" />
            <MetricCard label="큐 상태" value={status.queueStatus} change={status.activeJob?.message ?? "현재 활성 작업 없음"} accent={status.queueStatus === "실행중" ? "buy" : "default"} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <DashboardCard title="데이터셋 현황" subtitle="실제 저장된 소스와 마지막 동기화 시점입니다.">
              <DataTable
                title="데이터 자산 테이블"
                columns={["데이터셋", "데이터 소스", "마지막 수집 시간", "행 수", "상태"]}
                rows={status.sources.map((source) => [
                  source.name,
                  source.provider,
                  source.lastSyncTime?.replace("T", " ").slice(0, 16) ?? "-",
                  source.rowCount != null ? source.rowCount.toLocaleString("ko-KR") : "-",
                  <SignalBadge key={`${source.name}-${source.provider}`} label={source.status} tone={source.status.includes("정상") ? "buy" : source.status.includes("오류") ? "sell" : "hold"} />,
                ])}
              />
            </DashboardCard>

            <DashboardCard title="현재 활성 작업" subtitle="현재 큐에서 진행 중인 데이터 동기화 상태입니다.">
              {status.activeJob ? (
                <div className="space-y-3 rounded-md border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-3">
                  <div className="flex items-center gap-2">
                    <SignalBadge label={status.activeJob.status} tone={status.activeJob.status === "RUNNING" ? "buy" : status.activeJob.status === "PENDING" ? "hold" : "neutral"} />
                    <span className="text-[12px] font-semibold text-[color:var(--fg)]">{status.activeJob.jobType}</span>
                  </div>
                  <p className="text-[12px] text-[color:var(--fg-muted)]">작업 ID {status.activeJob.jobId}</p>
                  {status.activeJob.progressPercent != null ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[12px]">
                        <span className="font-medium text-[color:var(--fg)]">{status.activeJob.stageLabel ?? "동기화 진행 중"}</span>
                        <span className="text-[color:var(--fg-muted)]">
                          {status.activeJob.progressPercent}%
                          {status.activeJob.totalCount != null && status.activeJob.totalCount > 0
                            ? ` · ${status.activeJob.processedCount ?? 0}/${status.activeJob.totalCount}`
                            : ""}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/70">
                        <div
                          className="h-full rounded-full bg-[color:var(--kpi)] transition-[width] duration-300"
                          style={{ width: `${Math.max(0, Math.min(100, status.activeJob.progressPercent))}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                  <p className="text-[12px] text-[color:var(--fg-muted)]">{status.activeJob.message ?? "메시지 없음"}</p>
                </div>
              ) : (
                <StatusNotice title="현재 실행 중인 작업이 없습니다." description="동기화 작업을 실행하면 이 영역에 현재 작업 상태가 표시됩니다." />
              )}
            </DashboardCard>
          </section>

          <DashboardCard title="최근 작업 이력" subtitle="작업 모니터와 동일한 실제 실행 로그입니다.">
            {jobs && jobs.length > 0 ? (
              <DataTable
                title="작업 이력 테이블"
                columns={["작업", "상태", "시작 시각", "종료 시각", "메시지"]}
                rows={jobs.slice(0, 10).map((job) => [
                  job.jobType,
                  job.status,
                  job.startedAt?.replace("T", " ").slice(0, 16) ?? "-",
                  job.finishedAt?.replace("T", " ").slice(0, 16) ?? "-",
                  job.message ?? "-",
                ])}
              />
            ) : (
              <StatusNotice title="작업 이력이 없습니다." description="데이터 동기화나 분석 작업이 실행되면 이력이 표시됩니다." />
            )}
          </DashboardCard>
        </>
      ) : (
        <StatusNotice title="데이터 센터 조회 실패" description="데이터 상태 API 응답을 받지 못했습니다." />
      )}
    </PageContainer>
  );
}
