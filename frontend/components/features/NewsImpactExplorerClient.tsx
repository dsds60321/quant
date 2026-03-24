"use client";

import { useState } from "react";
import { ChartPanel } from "@/components/ui/ChartPanel";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { DataTable } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/ui/MetricCard";
import { StockImpactModal } from "@/components/features/StockImpactModal";
import { SymbolSearchBar } from "@/components/features/SymbolSearchBar";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { getNewsIntelligence, type NewsIntelligenceSummary } from "@/lib/api";

export function NewsImpactExplorerClient({
  initialSummary,
}: {
  initialSummary: NewsIntelligenceSummary;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (symbol: string | null) => {
    setBusy(true);
    setError(null);
    try {
      const next = await getNewsIntelligence(symbol ?? undefined);
      setSummary(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "뉴스 인텔리전스 조회에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SymbolSearchBar
        key={`search-${summary.selectedSymbol ?? "news-market"}`}
        title="종목별 뉴스 분석"
        description="티커 또는 회사명을 검색하면 해당 종목 중심으로 뉴스 감성, 동시 언급 종목, 영향 그래프를 분석합니다."
        busy={busy}
        activeSymbol={summary.selectedSymbol}
        onSearch={runSearch}
        onReset={() => runSearch(null)}
      />

      {busy ? <StatusNotice title="뉴스 인텔리전스 로딩 중" description="선택한 범위의 뉴스 감성, 영향 종목, 감성 지수를 다시 계산하고 있습니다." /> : null}
      {error ? <StatusNotice title="뉴스 인텔리전스 조회 실패" description={error} /> : null}

      <section className={`grid gap-3 md:grid-cols-3 ${busy ? "opacity-70 transition-opacity" : ""}`}>
        <MetricCard label="뉴스 수집량" value={`${summary.totalNewsCount.toLocaleString("ko-KR")}건`} change="최근 집계 기준" accent="kpi" />
        <MetricCard label="평균 감성 점수" value={summary.averageSentiment.toFixed(2)} change="상위 뉴스 평균" accent={summary.averageSentiment >= 0.5 ? "buy" : "sell"} />
        <MetricCard label="이벤트 감지 수" value={`${summary.detectedEventCount.toLocaleString("ko-KR")}건`} change="이벤트 엔진 감지 기준" accent="default" />
      </section>

      <section className={`grid gap-4 xl:grid-cols-[0.95fr_1.05fr] ${busy ? "opacity-70 transition-opacity" : ""}`}>
        <DashboardCard title="뉴스 감성 히트맵" subtitle={`${summary.scopeLabel} 기준 감성 강도 열지도입니다.`}>
          {summary.heatmap.length > 0 ? (
            <ChartPanel title="뉴스 감성 히트맵" subtitle="초록은 긍정, 빨강은 부정" series={summary.heatmap} variant="heatmap" ranges={["당일", "1주", "1개월"]} />
          ) : (
            <StatusNotice title="감성 히트맵 데이터가 없습니다." description="선택한 종목 기준으로 집계된 뉴스 감성 데이터가 없습니다." />
          )}
        </DashboardCard>
        <DashboardCard title="상위 영향 종목" subtitle={`${summary.scopeLabel} 관련 상위 종목입니다. 종목을 클릭하면 뉴스 영향 그래프를 확인할 수 있습니다.`}>
          {summary.impactStocks.length > 0 ? (
            <DataTable
              title="상위 영향 종목 테이블"
              columns={["종목", "뉴스 점수", "감성 점수", "뉴스 수", "분석"]}
              rows={summary.impactStocks.map((stock) => [
                <button
                  key={`${stock.symbol}-open`}
                  type="button"
                  onClick={() => setSelectedSymbol(stock.symbol)}
                  className="font-semibold text-[color:var(--kpi)]"
                >
                  {stock.symbol}
                </button>,
                stock.newsScore.toLocaleString("ko-KR"),
                stock.sentimentScore.toFixed(2),
                stock.newsCount.toLocaleString("ko-KR"),
                <button
                  key={`${stock.symbol}-button`}
                  type="button"
                  onClick={() => setSelectedSymbol(stock.symbol)}
                  className="inline-flex h-7 items-center rounded-md border border-[color:rgba(15,23,42,0.12)] px-2.5 text-[11px] font-semibold text-[color:var(--fg)]"
                >
                  영향 그래프
                </button>,
              ])}
            />
          ) : (
            <StatusNotice title="영향 종목 데이터가 없습니다." description="선택한 범위에 매핑된 뉴스 심볼이 아직 없습니다." />
          )}
        </DashboardCard>
      </section>

      <div className={busy ? "opacity-70 transition-opacity" : ""}>
        <DashboardCard title="뉴스 감성 지수 추이" subtitle={`${summary.scopeLabel} 기준 순감성 흐름입니다.`}>
        {summary.sentimentSeries.length > 0 ? (
          <ChartPanel title="뉴스 감성 지수 추이" subtitle={`${summary.scopeLabel} 감성 지수 변화`} series={summary.sentimentSeries} ranges={["1주", "1개월", "3개월"]} />
        ) : (
          <StatusNotice title="감성 추이 데이터가 없습니다." description="선택한 종목에 대해 시계열로 집계할 뉴스 데이터가 없습니다." />
        )}
        </DashboardCard>
      </div>

      {selectedSymbol ? <StockImpactModal key={`modal-${selectedSymbol}`} symbol={selectedSymbol} onClose={() => setSelectedSymbol(null)} /> : null}
    </>
  );
}
