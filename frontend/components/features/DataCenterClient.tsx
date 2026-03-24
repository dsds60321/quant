"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { triggerDataUpdate, type DataStatus } from "@/lib/api";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { SignalBadge } from "@/components/ui/SignalBadge";
import { StatusNotice } from "@/components/ui/StatusNotice";

export function DataCenterClient({ initialStatus }: { initialStatus: DataStatus | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const effectiveStatus = initialStatus;
  const activeQueue = effectiveStatus?.queueStatus === "실행중" || effectiveStatus?.queueStatus === "대기";

  useEffect(() => {
    if (!activeQueue) {
      return;
    }

    const timer = window.setInterval(() => {
      startTransition(() => router.refresh());
    }, 5000);

    return () => window.clearInterval(timer);
  }, [activeQueue, router, startTransition]);

  async function handleUpdate(mode: "strategy" | "etf" | "benchmark" | "full" | "missing" | "fundamentals") {
    setStatus("running");
    setMessage(null);

    try {
      const result = await triggerDataUpdate(
        {
          preset:
            mode === "strategy"
              ? "strategy_core_equities"
              : mode === "etf"
                ? "etf_universe"
                : mode === "benchmark"
                  ? "benchmark_only"
                  : mode === "fundamentals"
                    ? "fundamentals_only"
                  : mode === "missing"
                    ? "missing_only"
                  : "full",
          period: "5y",
          interval: "1d",
        },
      );

      setStatus("success");
      const summary = result.pricesUpdated != null || result.fundamentalsUpdated != null || result.benchmarksUpdated != null
        ? `가격 ${result.pricesUpdated ?? 0}건, 재무 ${result.fundamentalsUpdated ?? 0}건, 벤치마크 ${result.benchmarksUpdated ?? 0}건`
        : null;
      setMessage([result.message, result.jobId ? `작업 ID ${result.jobId}` : null, summary].filter(Boolean).join(" · "));
      startTransition(() => router.refresh());
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "데이터 동기화 실행 중 오류가 발생했습니다.");
    }
  }

  async function handleRefresh() {
    setMessage(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <PrimaryButton label={status === "running" ? "동기화 실행 중" : "전략 주식 동기화"} onClick={() => void handleUpdate("strategy")} disabled={status === "running" || isPending} />
        <SecondaryButton label={status === "running" ? "동기화 실행 중" : "ETF 동기화"} onClick={() => void handleUpdate("etf")} disabled={status === "running" || isPending} />
        <SecondaryButton label={status === "running" ? "동기화 실행 중" : "벤치마크 동기화"} onClick={() => void handleUpdate("benchmark")} disabled={status === "running" || isPending} />
        <SecondaryButton label={status === "running" ? "갱신 실행 중" : "전체 최신 갱신"} onClick={() => void handleUpdate("full")} disabled={status === "running" || isPending} />
        <SecondaryButton label={status === "running" ? "동기화 실행 중" : "펀더멘털 동기화"} onClick={() => void handleUpdate("fundamentals")} disabled={status === "running" || isPending} />
        <SecondaryButton label={status === "running" ? "백필 실행 중" : "누락 이력 백필"} onClick={() => void handleUpdate("missing")} disabled={status === "running" || isPending} />
        <SecondaryButton label={isPending ? "상태 갱신 중" : "데이터 상태 확인"} onClick={() => void handleRefresh()} disabled={isPending} />
        <Link href="/job-monitor" className="ui-button-secondary gap-2 rounded-md bg-white/90">
          작업 모니터 보기
        </Link>
      </div>

      <p className="text-[11px] text-[color:var(--fg-muted)]">
        전략 유니버스는 `stocks` 데이터에서 ETF를 제외한 심볼로, ETF 유니버스는 ETF 심볼로 자동 파생됩니다. `전체 최신 갱신`은 기존 가격 이력이 있는 심볼만 최근 구간을 증분 갱신한 뒤 펀더멘털 후속 동기화를 자동 실행합니다. `펀더멘털 동기화`는 기존 가격 이력이 있는 심볼의 재무 스냅샷만 다시 적재하고, `누락 이력 백필`은 가격 이력이 없는 심볼만 과거 전체를 채웁니다. 지수 기준 비교는 `benchmark_data`를 사용합니다.
      </p>

      {effectiveStatus ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[color:var(--line)] bg-[color:var(--surface-muted)] px-3 py-2 text-[11px]">
          <span className="font-semibold text-[color:var(--fg)]">큐 상태</span>
          <SignalBadge
            label={effectiveStatus.queueStatus}
            tone={effectiveStatus.queueStatus === "실행중" ? "buy" : effectiveStatus.queueStatus === "대기" ? "hold" : "neutral"}
          />
          {effectiveStatus.activeJob ? (
            <>
              <span className="text-[color:var(--fg-muted)]">작업 ID {effectiveStatus.activeJob.jobId}</span>
              {effectiveStatus.activeJob.progressPercent != null ? (
                <span className="text-[color:var(--fg-muted)]">진행률 {effectiveStatus.activeJob.progressPercent}%</span>
              ) : null}
              <span className="text-[color:var(--fg-muted)]">{effectiveStatus.activeJob.message ?? effectiveStatus.activeJob.jobType}</span>
            </>
          ) : (
            <span className="text-[color:var(--fg-muted)]">현재 실행 중인 데이터 동기화 작업이 없습니다.</span>
          )}
        </div>
      ) : null}

      {effectiveStatus?.activeJob?.progressPercent != null ? (
        <div className="space-y-1 rounded-md border border-[color:var(--line)] bg-white px-3 py-2">
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="font-semibold text-[color:var(--fg)]">
              {effectiveStatus.activeJob.stageLabel ?? "동기화 진행 중"}
            </span>
            <span className="text-[color:var(--fg-muted)]">
              {effectiveStatus.activeJob.progressPercent}%
              {effectiveStatus.activeJob.totalCount != null && effectiveStatus.activeJob.totalCount > 0
                ? ` · ${effectiveStatus.activeJob.processedCount ?? 0}/${effectiveStatus.activeJob.totalCount}`
                : ""}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[color:var(--surface-muted)]">
            <div
              className="h-full rounded-full bg-[color:var(--kpi)] transition-[width] duration-300"
              style={{ width: `${Math.max(0, Math.min(100, effectiveStatus.activeJob.progressPercent))}%` }}
            />
          </div>
        </div>
      ) : null}

      {status === "success" && message ? <StatusNotice title="동기화 요청 완료" description={message} /> : null}
      {status === "error" && message ? <StatusNotice title="동기화 요청 실패" description={message} /> : null}
      {isPending ? <StatusNotice title="데이터 센터 로딩 중" description="최신 데이터 상태와 작업 현황을 다시 불러오는 중입니다." /> : null}
      {effectiveStatus?.lastCrawlTime ? (
        <p className="text-[11px] text-[color:var(--fg-muted)]">최근 동기화 기준 시각: {effectiveStatus.lastCrawlTime.replace("T", " ").slice(0, 16)}</p>
      ) : null}
    </div>
  );
}
