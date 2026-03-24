"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { ChartPanel } from "@/components/ui/ChartPanel";
import { SymbolSearchBar } from "@/components/features/SymbolSearchBar";
import { formatCompactCurrency, formatPercent } from "@/lib/format";
import type { StockDataDetail } from "@/lib/api";

function formatNumber(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: digits,
  }).format(value);
}

function formatCurrencyLike(value: number | null | undefined, currency = "USD") {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return formatCompactCurrency(value, currency);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  return value.replace("T", " ").slice(0, 16);
}

export function StockDataDetailClient({ detail }: { detail: StockDataDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const latestPriceText = detail.latestPrice != null ? formatCurrencyLike(detail.latestPrice, detail.currency) : "미적재";
  const priceChangeText = detail.changePercent != null ? formatPercent(detail.changePercent) : "전일 데이터 없음";
  const closeSeries = detail.priceSeries.map((point) => point.adjClose ?? point.close ?? 0).filter((value) => value > 0);
  const volumeSeries = detail.priceSeries.map((point) => point.volume || 0);

  return (
    <div className="space-y-4">
      <SymbolSearchBar
        title="종목별 분석"
        description="동기화로 저장된 종목의 가격 이력, 재무 스냅샷, 뉴스, 이벤트 데이터를 한 화면에서 확인합니다."
        busy={isPending}
        activeSymbol={detail.symbol}
        onSearch={(symbol) => {
          if (!symbol) {
            return;
          }
          startTransition(() => router.push(`/stock-analysis?symbol=${encodeURIComponent(symbol)}`));
        }}
        onReset={() => {
          startTransition(() => router.push("/stock-analysis"));
        }}
      />

      {isPending ? <StatusNotice title="종목 데이터 로딩 중" description="선택한 종목의 저장 데이터셋을 다시 불러오는 중입니다." /> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard label="최신 종가" value={latestPriceText} change={detail.latestPriceDate ? `최신 일자 ${detail.latestPriceDate}` : "가격 데이터 미적재"} accent="kpi" />
        <MetricCard label="전일 대비" value={priceChangeText} change={detail.previousClose != null ? `이전 종가 ${formatCurrencyLike(detail.previousClose, detail.currency)}` : "비교 기준 없음"} accent={detail.changePercent != null && detail.changePercent >= 0 ? "buy" : "sell"} />
        <MetricCard label="가격 이력 행 수" value={detail.priceRowCount.toLocaleString("ko-KR")} change="저장된 일봉 기준" accent="default" />
        <MetricCard label="뉴스/이벤트" value={`${detail.newsCount.toLocaleString("ko-KR")} / ${detail.eventCount.toLocaleString("ko-KR")}`} change="뉴스 영향 건수 / 이벤트 건수" accent="default" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
        <DashboardCard title="종목 메타" subtitle="stocks 테이블과 최신 재무 스냅샷 기준 기본 정보입니다.">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["심볼", detail.symbol],
              ["종목명", detail.name],
              ["거래소", detail.exchange],
              ["통화", detail.currency],
              ["섹터", detail.sector ?? "-"],
              ["산업", detail.industry ?? "-"],
              ["시가총액", formatCurrencyLike(detail.marketCap, detail.currency)],
              ["펀더멘털 행 수", `${detail.fundamentalsRowCount.toLocaleString("ko-KR")}건`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-[color:rgba(15,23,42,0.08)] bg-[color:var(--surface-muted)] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--fg-muted)]">{label}</p>
                <p className="mt-2 text-[14px] font-semibold text-[color:var(--fg)]">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/news-intelligence" className="ui-button-secondary">
              뉴스 인텔리전스 열기
            </Link>
            <Link href="/event-analysis" className="ui-button-secondary">
              이벤트 분석 열기
            </Link>
          </div>
        </DashboardCard>

        <DashboardCard title="가격 추이" subtitle={`${detail.symbol} 저장 가격 이력의 최근 구간입니다.`}>
          {closeSeries.length > 0 ? (
            <ChartPanel title="조정 종가 추이" subtitle="최근 저장된 조정종가 흐름" series={closeSeries} ranges={["최근 구간"]} />
          ) : (
            <StatusNotice title="가격 이력이 없습니다." description="해당 심볼은 아직 가격 데이터가 저장되지 않았습니다." />
          )}
        </DashboardCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <DashboardCard title="거래량 추이" subtitle="최근 저장된 일봉 거래량 흐름입니다.">
          {volumeSeries.some((value) => value > 0) ? (
            <ChartPanel title="거래량" subtitle="최근 저장된 거래량" series={volumeSeries} variant="bars" ranges={["최근 구간"]} />
          ) : (
            <StatusNotice title="거래량 데이터가 없습니다." description="해당 심볼의 거래량이 아직 저장되지 않았습니다." />
          )}
        </DashboardCard>

        <DashboardCard title="최근 펀더멘털" subtitle="fundamentals 테이블의 최신 스냅샷입니다.">
          {detail.fundamentals.length > 0 ? (
            <DataTable
              title="펀더멘털 스냅샷"
              columns={["일자", "PER", "PBR", "ROE", "EPS", "배당수익률", "시가총액", "매출", "순이익"]}
              rows={detail.fundamentals.map((item) => [
                item.date,
                formatNumber(item.per),
                formatNumber(item.pbr),
                item.roe != null ? formatPercent(item.roe) : "-",
                formatNumber(item.eps),
                item.dividendYield != null ? formatPercent(item.dividendYield) : "-",
                formatCurrencyLike(item.marketCap, detail.currency),
                formatCurrencyLike(item.revenue, detail.currency),
                formatCurrencyLike(item.netIncome, detail.currency),
              ])}
              pageSize={6}
            />
          ) : (
            <StatusNotice title="펀더멘털 데이터가 없습니다." description="현재 해당 심볼에는 저장된 재무 스냅샷이 없습니다. 데이터 동기화 상태를 확인하세요." />
          )}
        </DashboardCard>
      </section>

      <DashboardCard title="최근 가격 이력" subtitle="prices 테이블 기준 최근 저장 행입니다.">
        {detail.priceSeries.length > 0 ? (
          <DataTable
            title="가격 이력 테이블"
            columns={["일자", "시가", "고가", "저가", "종가", "조정종가", "거래량"]}
            rows={[...detail.priceSeries].reverse().map((item) => [
              item.date,
              formatNumber(item.open),
              formatNumber(item.high),
              formatNumber(item.low),
              formatNumber(item.close),
              formatNumber(item.adjClose),
              item.volume.toLocaleString("ko-KR"),
            ])}
            pageSize={12}
          />
        ) : (
          <StatusNotice title="가격 이력이 없습니다." description="저장된 가격 데이터가 없어 최근 가격 이력을 표시할 수 없습니다." />
        )}
      </DashboardCard>

      <section className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
        <DashboardCard title="최근 뉴스" subtitle="news/news_impact 테이블에 저장된 최근 연관 뉴스입니다.">
          {detail.news.length > 0 ? (
            <DataTable
              title="연관 뉴스 테이블"
              columns={["시각", "출처", "감성", "영향도", "제목"]}
              rows={detail.news.map((item) => [
                formatDateTime(item.publishedAt),
                item.source,
                item.sentimentScore != null ? formatNumber(item.sentimentScore, 3) : "-",
                item.impactScore != null ? formatNumber(item.impactScore, 3) : "-",
                <a key={`${item.url}-${item.publishedAt}`} href={item.url} target="_blank" rel="noreferrer" className="font-semibold text-[color:var(--kpi)]">
                  {item.title}
                </a>,
              ])}
              pageSize={8}
            />
          ) : (
            <StatusNotice title="뉴스 데이터가 없습니다." description="해당 심볼과 연결된 뉴스 영향 데이터가 아직 적재되지 않았습니다." />
          )}
        </DashboardCard>

        <DashboardCard title="최근 이벤트" subtitle="events / event_analysis 테이블에 저장된 최근 이벤트 반응입니다.">
          {detail.events.length > 0 ? (
            <DataTable
              title="이벤트 테이블"
              columns={["시각", "이벤트", "T+1", "T+5", "T+20", "설명"]}
              rows={detail.events.map((item) => [
                formatDateTime(item.eventDate),
                item.eventType,
                formatNumber(item.priceT1),
                formatNumber(item.priceT5),
                formatNumber(item.priceT20),
                item.description ?? "-",
              ])}
              pageSize={8}
            />
          ) : (
            <StatusNotice title="이벤트 데이터가 없습니다." description="해당 심볼의 이벤트 및 이벤트 반응 데이터가 아직 저장되지 않았습니다." />
          )}
        </DashboardCard>
      </section>
    </div>
  );
}
