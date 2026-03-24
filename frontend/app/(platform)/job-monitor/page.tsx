import { DashboardCard } from "@/components/ui/DashboardCard";
import { DataTable } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SignalBadge } from "@/components/ui/SignalBadge";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { getJobs, type JobItem } from "@/lib/api";

const DATA_JOB_TYPES = new Set(["data_update_dispatch", "market_data_update", "fundamentals_refresh", "benchmark_sync"]);

function toneOf(status: string) {
  if (status === "RUNNING") return "buy" as const;
  if (status === "COMPLETED") return "neutral" as const;
  return "hold" as const;
}

function formatAt(value: string | null) {
  return value?.replace("T", " ").slice(0, 16) ?? "-";
}

function parseMetadata(metadataJson: string | null) {
  if (!metadataJson) {
    return null;
  }

  try {
    return JSON.parse(metadataJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function historyLabel(job: JobItem) {
  const metadata = parseMetadata(job.metadataJson);
  if (job.jobType === "backtest_dispatch" && metadata?.backtestId) {
    return `백테스트 이력 #${String(metadata.backtestId)}`;
  }
  if (job.jobType === "strategy_optimization" && metadata?.optimizationRunId) {
    return `최적화 이력 #${String(metadata.optimizationRunId)}`;
  }
  if (job.jobType === "strategy_comparison" && metadata?.comparisonRunId) {
    return `비교 이력 #${String(metadata.comparisonRunId)}`;
  }
  return null;
}

function buildDataJobGroups(jobs: JobItem[]) {
  const dataJobs = jobs.filter((job) => DATA_JOB_TYPES.has(job.jobType));
  const dispatchJobs = dataJobs.filter((job) => job.jobType === "data_update_dispatch");
  const childrenByParent = new Map<number, JobItem[]>();

  dataJobs
    .filter((job) => job.parentJobId != null)
    .forEach((job) => {
      const key = job.parentJobId as number;
      childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), job]);
    });

  return dispatchJobs.map((job) => ({
    root: job,
    children: (childrenByParent.get(job.id) ?? []).sort((a, b) => (b.id - a.id)),
  }));
}

export default async function JobMonitorPage() {
  const jobs = await getJobs().catch(() => null);
  const runningCount = jobs?.filter((job) => job.status === "RUNNING").length ?? 0;
  const pendingCount = jobs?.filter((job) => job.status === "PENDING").length ?? 0;
  const failedCount = jobs?.filter((job) => job.status === "FAILED").length ?? 0;
  const dataJobGroups = jobs ? buildDataJobGroups(jobs) : [];
  const standaloneDataJobs = jobs?.filter((job) => DATA_JOB_TYPES.has(job.jobType) && job.jobType !== "data_update_dispatch" && job.parentJobId == null) ?? [];
  const analysisJobs = jobs?.filter((job) => !DATA_JOB_TYPES.has(job.jobType)) ?? [];

  return (
    <PageContainer>
      <SectionTitle eyebrow="운영 상태" title="작업 모니터" description="데이터 동기화 묶음과 분석 작업 상태를 함께 추적합니다." />
      {jobs ? (
        <div className="space-y-4">
          <section className="grid gap-3 md:grid-cols-3">
            <MetricCard label="실행중 작업" value={String(runningCount)} change="현재 워커 상태" accent="buy" />
            <MetricCard label="대기 작업" value={String(pendingCount)} change="큐 등록 상태" accent="kpi" />
            <MetricCard label="실패 작업" value={String(failedCount)} change="최근 50건 기준" accent="sell" />
          </section>

          {dataJobGroups.length > 0 ? (
            <section className="space-y-4">
              {dataJobGroups.map(({ root, children }) => {
                const metadata = parseMetadata(root.metadataJson);
                const childIds = Array.isArray(metadata?.childJobIds) ? (metadata?.childJobIds as number[]) : [];
                return (
                  <DashboardCard
                    key={root.id}
                    title={`데이터 동기화 작업 #${root.id}`}
                    subtitle={`${formatAt(root.startedAt)} 시작 · 하위 작업 ${children.length}건`}
                    action={<SignalBadge label={root.status} tone={toneOf(root.status)} />}
                  >
                    <div className="mb-4 flex flex-wrap gap-2 text-[11px] text-[color:var(--fg-muted)]">
                      <span>메시지: {root.message ?? "-"}</span>
                      {childIds.length > 0 ? <span>하위 작업 ID: {childIds.join(", ")}</span> : null}
                    </div>
                    <DataTable
                      columns={["작업", "상태", "시작 시각", "완료 시각", "메시지"]}
                      rows={children.map((job) => [
                        job.jobType,
                        <SignalBadge key={`${job.id}-status`} label={job.status} tone={toneOf(job.status)} />,
                        formatAt(job.startedAt),
                        formatAt(job.finishedAt),
                        job.message ?? "-",
                      ])}
                      pageSize={6}
                    />
                  </DashboardCard>
                );
              })}
            </section>
          ) : null}

          {standaloneDataJobs.length > 0 ? (
            <DashboardCard title="단독 데이터 작업" subtitle="부모 작업 정보가 없는 과거 데이터 적재 작업입니다.">
              <DataTable
                columns={["작업", "상태", "시작 시각", "완료 시각", "메시지"]}
                rows={standaloneDataJobs.map((job) => [
                  job.jobType,
                  <SignalBadge key={`${job.id}-status`} label={job.status} tone={toneOf(job.status)} />,
                  formatAt(job.startedAt),
                  formatAt(job.finishedAt),
                  job.message ?? "-",
                ])}
                pageSize={8}
              />
            </DashboardCard>
          ) : null}

          <DashboardCard title="기타 작업" subtitle="백테스트, 리스크 계산, 전략 실행 등 나머지 작업입니다.">
            <DataTable
              columns={["작업", "상태", "시작 시각", "완료 시각", "메시지", "연결 이력"]}
              rows={analysisJobs.map((job) => [
                job.jobType,
                <SignalBadge key={`${job.id}-status`} label={job.status} tone={toneOf(job.status)} />,
                formatAt(job.startedAt),
                formatAt(job.finishedAt),
                job.message ?? "-",
                historyLabel(job) ?? "-",
              ])}
              pageSize={8}
            />
          </DashboardCard>
        </div>
      ) : (
        <StatusNotice title="작업 모니터 조회 실패" description="작업 모니터 API 응답을 받지 못했습니다." />
      )}
    </PageContainer>
  );
}
