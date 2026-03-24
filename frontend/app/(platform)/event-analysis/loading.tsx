import { PageLoadingState } from "@/components/ui/PageLoadingState";

export default function Loading() {
  return (
    <PageLoadingState
      eyebrow="이벤트 기반 분석"
      title="이벤트 분석"
      description="실적, M&A, CEO 변경, 규제 이벤트 반응 데이터를 불러오는 중입니다."
    />
  );
}
