import type { IconName } from "@/components/ui/Icon";

export type SidebarItemEntry = {
  href: string;
  label: string;
  icon: IconName;
};

export type SidebarGroupEntry = {
  title: string;
  icon: IconName;
  items: SidebarItemEntry[];
};

export const sidebarGroups: SidebarGroupEntry[] = [
  {
    title: "홈",
    icon: "dashboard",
    items: [
      { href: "/dashboard", label: "대시보드", icon: "dashboard" },
      { href: "/market-overview", label: "시장 개요", icon: "market" },
    ],
  },
  {
    title: "전략 연구",
    icon: "strategy",
    items: [
      { href: "/strategy-builder", label: "전략 생성", icon: "strategy" },
      { href: "/backtest-results", label: "백테스트", icon: "backtest" },
      { href: "/pattern-lab", label: "패턴 실험실", icon: "research" },
      { href: "/strategy-optimization", label: "전략 최적화", icon: "optimization" },
      { href: "/strategy-comparison", label: "전략 비교", icon: "comparison" },
      { href: "/research-notebook", label: "연구 노트", icon: "research" },
    ],
  },
  {
    title: "투자 관리",
    icon: "portfolio",
    items: [
      { href: "/portfolio", label: "포트폴리오", icon: "portfolio" },
      { href: "/portfolio/assets", label: "자산 관리", icon: "data" },
      { href: "/portfolio/positions", label: "포지션", icon: "trading" },
      { href: "/strategy-library", label: "전략 라이브러리", icon: "library" },
      { href: "/screener", label: "종목 스크리너", icon: "screener" },
    ],
  },
  {
    title: "트레이딩",
    icon: "trading",
    items: [
      { href: "/strategy-execution-center", label: "전략 실행 센터", icon: "execution" },
      { href: "/trading-center", label: "거래 센터", icon: "trading" },
    ],
  },
  {
    title: "데이터 플랫폼",
    icon: "data",
    items: [
      { href: "/stock-analysis", label: "종목별 분석", icon: "search" },
      { href: "/data-center", label: "데이터 센터", icon: "data" },
      { href: "/news-intelligence", label: "뉴스 인텔리전스", icon: "message" },
      { href: "/event-analysis", label: "이벤트 분석", icon: "spark" },
      { href: "/alternative-data-center", label: "대체 데이터 센터", icon: "data" },
    ],
  },
  {
    title: "리스크 관리",
    icon: "risk",
    items: [{ href: "/risk-center", label: "리스크 센터", icon: "risk" }],
  },
  {
    title: "시스템",
    icon: "settings",
    items: [
      { href: "/job-monitor", label: "작업 모니터", icon: "job" },
      { href: "/settings", label: "설정", icon: "settings" },
    ],
  },
];
