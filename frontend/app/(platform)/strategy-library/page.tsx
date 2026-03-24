import { DashboardCard } from "@/components/ui/DashboardCard";
import { PageContainer } from "@/components/ui/PageContainer";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { SectionTitle } from "@/components/ui/SectionTitle";

export default function StrategyLibraryPage() {
  return (
    <PageContainer>
      <SectionTitle eyebrow="전략 저장소" title="전략 라이브러리" description="검증된 전략을 카드 기반으로 탐색하고 재사용합니다." />

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[
          ["저PBR 모멘텀", "+18.4%", "1.72", "-9.1%"],
          ["퀄리티 성장", "+12.9%", "1.31", "-6.4%"],
          ["저변동성 배당", "+9.2%", "1.08", "-4.2%"],
        ].map(([name, cagr, sharpe, mdd]) => (
          <DashboardCard key={name} title={name} subtitle="기관형 검증 완료 전략">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl bg-[color:var(--surface-muted)] p-4">
                <p className="text-[color:var(--fg-muted)]">CAGR</p>
                <p className="mt-2 text-lg font-semibold">{cagr}</p>
              </div>
              <div className="rounded-2xl bg-[color:var(--surface-muted)] p-4">
                <p className="text-[color:var(--fg-muted)]">샤프지수</p>
                <p className="mt-2 text-lg font-semibold">{sharpe}</p>
              </div>
              <div className="rounded-2xl bg-[color:var(--surface-muted)] p-4">
                <p className="text-[color:var(--fg-muted)]">최대 낙폭</p>
                <p className="mt-2 text-lg font-semibold">{mdd}</p>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <PrimaryButton label="실행" />
              <SecondaryButton label="복제" />
              <SecondaryButton label="삭제" />
            </div>
          </DashboardCard>
        ))}
      </section>
    </PageContainer>
  );
}
