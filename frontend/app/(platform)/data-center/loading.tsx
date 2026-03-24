import { PageLoadingState } from "@/components/ui/PageLoadingState";

export default function Loading() {
  return (
    <PageLoadingState
      eyebrow="데이터 운영"
      title="데이터 센터"
      description="시장 데이터와 작업 상태를 조회하는 중입니다."
    />
  );
}
