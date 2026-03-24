import { DashboardCard } from "@/components/ui/DashboardCard";
import { PageContainer } from "@/components/ui/PageContainer";
import { SectionTitle } from "@/components/ui/SectionTitle";

export default function SettingsPage() {
  return (
    <PageContainer>
      <SectionTitle eyebrow="환경 설정" title="설정" description="사용자, 알림, 데이터 정책을 관리하는 공용 설정 영역입니다." />
      <section className="grid gap-6 xl:grid-cols-3">
        {[
          ["알림 정책", "백테스트 완료, 리스크 경보, 주문 이벤트 수신 설정"],
          ["데이터 연결", "시장 데이터 공급자와 내부 팩터 저장소 상태 확인"],
          ["권한 관리", "리서치, 운용, 리스크 사용자별 접근 제어"],
        ].map(([title, description]) => (
          <DashboardCard key={title} title={title} subtitle={description}>
            <div className="rounded-2xl bg-[color:var(--surface-muted)] p-5 text-sm text-[color:var(--fg-muted)]">
              설정 폼 연결 전 단계의 구조화된 자리표시자입니다.
            </div>
          </DashboardCard>
        ))}
      </section>
    </PageContainer>
  );
}
