import { ChartPanel } from "@/components/ui/ChartPanel";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { DataTable } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/ui/MetricCard";
import { PageContainer } from "@/components/ui/PageContainer";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { SignalBadge } from "@/components/ui/SignalBadge";
import { getDashboardSummary } from "@/lib/api";
import { formatCompactCurrency, formatPercent } from "@/lib/format";

export default async function DashboardPage() {
  const summary = await getDashboardSummary().catch(() => null);

  const metrics = summary
    ? ([
        ["포트폴리오 가치", formatCompactCurrency(summary.portfolioValue), formatPercent(summary.dailyReturn), "kpi"],
        ["일간 수익률", formatPercent(summary.dailyReturn), "벤치마크 대비 +0.63%", "buy"],
        ["샤프지수", summary.sharpe.toFixed(2), "최근 백테스트 기준", "kpi"],
        ["알파 점수", `+${summary.alpha.toFixed(2)}`, "위험조정 초과수익", "buy"],
        ["활성 전략 수", String(summary.activeStrategies), "실행중 전략 기준", "default"],
        ["최대 낙폭", formatPercent(summary.maxDrawdown), "최신 백테스트 기준", "sell"],
      ] as const)
    : [];

  return (
    <PageContainer>
      <SectionTitle
        eyebrow="기관형 대시보드"
        title="대시보드"
        description="포트폴리오 성과, 전략 실행 현황, 최신 백테스트를 한 화면에서 확인합니다."
        action={
          <>
            <PrimaryButton label="전략 실행" />
            <SecondaryButton label="보고서 내보내기" />
          </>
        }
      />

      {summary ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {metrics.map(([label, value, change, accent]) => (
            <MetricCard key={label} label={label} value={value} change={change} accent={accent} />
          ))}
        </section>
      ) : (
        <StatusNotice title="대시보드 데이터 조회 실패" description="Spring Boot API 응답이 없어 핵심 지표를 불러오지 못했습니다." />
      )}

      <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <DashboardCard title="수익 곡선" subtitle="전략 묶음 대비 누적 성과 추이">
          <ChartPanel title="수익 곡선" series={[18, 22, 27, 26, 31, 35, 39, 44, 48, 51, 58, 64]} />
        </DashboardCard>
        <DashboardCard title="포트폴리오 배분" subtitle="자산군 및 전략별 비중">
          <ChartPanel title="포트폴리오 배분" series={[42, 28, 18, 12]} variant="donut" />
        </DashboardCard>
      </section>

      <DashboardCard title="최근 백테스트" subtitle="최신 실행 전략과 성과 비교">
        <DataTable
          columns={["전략", "CAGR", "샤프지수", "최대 낙폭", "상태", "작업"]}
          rows={[
            ["저PBR 모멘텀", "+18.4%", "1.72", "-9.1%", <SignalBadge key="a" label="매수" tone="buy" />, <div key="b" className="flex gap-2"><SecondaryButton label="상세보기" /><SecondaryButton label="삭제" /><PrimaryButton label="포트폴리오 적용" /></div>],
            ["퀄리티 성장", "+12.9%", "1.31", "-6.4%", <SignalBadge key="c" label="홀드" tone="hold" />, <div key="d" className="flex gap-2"><SecondaryButton label="상세보기" /><SecondaryButton label="삭제" /><PrimaryButton label="포트폴리오 적용" /></div>],
            ["변동성 축소", "+9.7%", "1.08", "-4.8%", <SignalBadge key="e" label="매도" tone="sell" />, <div key="f" className="flex gap-2"><SecondaryButton label="상세보기" /><SecondaryButton label="삭제" /><PrimaryButton label="포트폴리오 적용" /></div>],
          ]}
        />
      </DashboardCard>
    </PageContainer>
  );
}
