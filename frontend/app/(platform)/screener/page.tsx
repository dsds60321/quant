import { DashboardCard } from "@/components/ui/DashboardCard";
import { DataTable } from "@/components/ui/DataTable";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";

export default function ScreenerPage() {
  return (
    <PageContainer>
      <SectionTitle eyebrow="유니버스 탐색" title="종목 스크리너" description="밸류에이션과 수익성 필터로 후보군을 빠르게 압축합니다." />

      <DashboardCard title="필터">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {['PER', 'PBR', 'ROE', '시가총액', '배당률', '거래량'].map((item) => (
            <div key={item} className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-4">
              <p className="text-sm font-semibold">{item}</p>
              <input type="range" defaultValue={60} className="mt-4 w-full accent-black" />
            </div>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard title="결과 테이블">
        <DataTable
          columns={["종목", "PER", "ROE", "시가총액"]}
          rows={[
            ["HD현대일렉트릭", "8.4", "19.8%", "₩14.2조"],
            ["한화에어로스페이스", "11.7", "17.1%", "₩18.9조"],
            ["알테오젠", "27.2", "21.3%", "₩16.4조"],
            ["메리츠금융지주", "6.9", "15.6%", "₩12.7조"],
          ]}
        />
      </DashboardCard>
    </PageContainer>
  );
}
