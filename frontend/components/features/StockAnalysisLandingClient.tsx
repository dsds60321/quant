"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { SymbolSearchBar } from "@/components/features/SymbolSearchBar";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { StatusNotice } from "@/components/ui/StatusNotice";

export function StockAnalysisLandingClient() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <DashboardCard
      title="종목 데이터 탐색"
      subtitle="동기화로 저장된 거래 이력, 뉴스, 이벤트, 펀더멘털을 심볼 단위로 조회합니다."
    >
      <div className="space-y-3">
        <SymbolSearchBar
          title="종목별 분석 시작"
          description="종목 코드나 회사명을 검색해 종목별 분석 페이지를 바로 엽니다."
          busy={isPending}
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

        {isPending ? (
          <StatusNotice
            title="종목별 분석 로딩 중"
            description="선택한 심볼의 저장 데이터셋을 불러오는 중입니다."
          />
        ) : (
          <StatusNotice
            title="종목을 선택하세요"
            description="상단 검색으로 심볼을 선택하면 가격 이력, 최근 뉴스, 이벤트 반응, 재무 스냅샷을 한 화면에서 확인할 수 있습니다."
          />
        )}

        <div className="flex flex-wrap gap-2">
          <Link href="/news-intelligence" className="ui-button-secondary">
            뉴스 인텔리전스
          </Link>
          <Link href="/event-analysis" className="ui-button-secondary">
            이벤트 분석
          </Link>
        </div>
      </div>
    </DashboardCard>
  );
}
