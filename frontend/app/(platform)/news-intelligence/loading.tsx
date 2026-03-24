import { PageLoadingState } from "@/components/ui/PageLoadingState";

export default function Loading() {
  return (
    <PageLoadingState
      eyebrow="뉴스 및 감성 분석"
      title="뉴스 인텔리전스"
      description="뉴스 감성, 영향 종목, 감성 지수 추이를 불러오는 중입니다."
    />
  );
}
