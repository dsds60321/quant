import { PageLoadingState } from "@/components/ui/PageLoadingState";

export default function Loading() {
  return (
    <PageLoadingState
      eyebrow="데이터 플랫폼"
      title="종목별 분석"
      description="종목의 가격 이력, 뉴스, 이벤트, 펀더멘털 데이터를 불러오는 중입니다."
    />
  );
}
