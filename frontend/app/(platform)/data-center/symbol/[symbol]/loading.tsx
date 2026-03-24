import { PageLoadingState } from "@/components/ui/PageLoadingState";

export default function Loading() {
  return (
    <PageLoadingState
      eyebrow="데이터 탐색"
      title="종목 데이터 상세"
      description="종목별 가격, 재무, 뉴스, 이벤트 데이터를 불러오는 중입니다."
    />
  );
}
