"use client";

import { useState } from "react";
import { SymbolSearchBar } from "@/components/features/SymbolSearchBar";
import { ChartPanel } from "@/components/ui/ChartPanel";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { DataTable } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { getEventAnalysis, type EventAnalysisSummary } from "@/lib/api";
import { formatPercent } from "@/lib/format";

export function EventAnalysisClient({
  initialSummary,
}: {
  initialSummary: EventAnalysisSummary;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (symbol: string | null) => {
    setBusy(true);
    setError(null);
    try {
      const next = await getEventAnalysis(symbol ?? undefined);
      setSummary(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "이벤트 분석 조회에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SymbolSearchBar
        key={summary.selectedSymbol ?? "event-market"}
        title="종목별 이벤트 분석"
        description="특정 티커나 회사명을 기준으로 실적, M&A, CEO 변경, 규제, 제품 출시 이벤트 반응을 필터링합니다."
        busy={busy}
        activeSymbol={summary.selectedSymbol}
        onSearch={runSearch}
        onReset={() => runSearch(null)}
      />

      {busy ? <StatusNotice title="이벤트 분석 로딩 중" description="선택한 종목의 이벤트 반응과 유형 분포를 다시 집계하고 있습니다." /> : null}
      {error ? <StatusNotice title="이벤트 분석 조회 실패" description={error} /> : null}

      <section className={`grid gap-3 md:grid-cols-4 ${busy ? "opacity-70 transition-opacity" : ""}`}>
        <MetricCard label="실적 상회 반응" value={formatPercent(summary.earningsBeat)} change={summary.scopeLabel} accent={summary.earningsBeat >= 0 ? "buy" : "sell"} />
        <MetricCard label="M&A 발표 반응" value={formatPercent(summary.maAnnouncement)} change={summary.scopeLabel} accent={summary.maAnnouncement >= 0 ? "buy" : "sell"} />
        <MetricCard label="CEO 변경 반응" value={formatPercent(summary.ceoChange)} change={summary.scopeLabel} accent={summary.ceoChange >= 0 ? "buy" : "sell"} />
        <MetricCard label="규제 뉴스 반응" value={formatPercent(summary.regulation)} change={summary.scopeLabel} accent={summary.regulation >= 0 ? "buy" : "sell"} />
      </section>

      <section className={`grid gap-4 xl:grid-cols-[1fr_1fr] ${busy ? "opacity-70 transition-opacity" : ""}`}>
        <DashboardCard title="이벤트 가격 반응" subtitle={`${summary.scopeLabel} 기준 최근 이벤트 반응 경로입니다.`}>
          {summary.priceReactionSeries.length > 0 ? (
            <ChartPanel title="이벤트 가격 반응" subtitle={`${summary.scopeLabel} 평균 반응`} series={summary.priceReactionSeries} ranges={["5건", "10건", "20건"]} />
          ) : (
            <StatusNotice title="이벤트 반응 데이터가 없습니다." description="선택한 범위에 집계된 이벤트 분석 데이터가 없습니다." />
          )}
        </DashboardCard>
        <DashboardCard title="이벤트 분포" subtitle={`${summary.scopeLabel} 관련 이벤트 타입별 요약입니다.`}>
          {summary.reactions.length > 0 ? (
            <DataTable
              title="이벤트 유형 테이블"
              columns={["이벤트", "평균 반응", "최근 감지 건수"]}
              rows={summary.reactions.map((reaction) => [
                reaction.eventType,
                formatPercent(reaction.averageReaction),
                reaction.recentCount.toLocaleString("ko-KR"),
              ])}
            />
          ) : (
            <StatusNotice title="이벤트 유형 데이터가 없습니다." description="선택한 종목에 매핑된 이벤트가 아직 없습니다." />
          )}
        </DashboardCard>
      </section>
    </>
  );
}
