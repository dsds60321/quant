import type { SVGProps } from "react";

export type IconName =
  | "menu"
  | "search"
  | "dashboard"
  | "market"
  | "strategy"
  | "backtest"
  | "portfolio"
  | "screener"
  | "research"
  | "library"
  | "execution"
  | "trading"
  | "data"
  | "optimization"
  | "comparison"
  | "risk"
  | "settings"
  | "job"
  | "bell"
  | "message"
  | "user"
  | "chevron"
  | "play"
  | "pause"
  | "refresh"
  | "filter"
  | "arrowLeft"
  | "arrowRight"
  | "spark"
  | "status"
  | "close"
  | "link"
  | "plus"
  | "window";

const paths: Record<IconName, string> = {
  menu: "M4 7h16M4 12h16M4 17h16",
  search: "M11 5a6 6 0 1 0 0 12a6 6 0 0 0 0-12Zm8 14l-3.4-3.4",
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  market: "M4 18l4-6 3 2 5-8 4 4",
  strategy: "M5 5h14v4H5zM5 11h8v8H5zM15 11h4v8h-4z",
  backtest: "M5 17V7m5 10V4m5 13v-6m5 6V9",
  portfolio: "M4 7h16v10H4zM8 7V5h8v2",
  screener: "M4 6h16M7 12h10M10 18h4",
  research: "M5 4h10l4 4v12H5zM14 4v4h4",
  library: "M6 4h10v16H6zM16 6h3v14h-3",
  execution: "M8 6l8 6-8 6V6z",
  trading: "M4 16h4l3-9 3 13 2-7h4",
  data: "M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Zm0 5c0 1.7 3.6 3 8 3s8-1.3 8-3m-16 5c0 1.7 3.6 3 8 3s8-1.3 8-3",
  optimization: "M5 16l4-4 3 3 7-7",
  comparison: "M6 18V9m6 9V5m6 13v-8",
  risk: "M12 4l7 3v5c0 4.5-3 7-7 8-4-1-7-3.5-7-8V7l7-3Z",
  settings: "M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 0 0 12 8.5Zm0-5.5v3m0 12v3m9-9h-3M6 12H3m15.36-6.36-2.12 2.12M7.76 16.24l-2.12 2.12m0-12.72 2.12 2.12m8.48 8.48 2.12 2.12",
  job: "M5 6h14v12H5zM9 3v6M15 3v6",
  bell: "M12 4a4 4 0 0 0-4 4v2.5L6.5 13v1h11v-1L16 10.5V8a4 4 0 0 0-4-4Zm-2 12a2 2 0 1 0 4 0",
  message: "M5 6h14v9H8l-3 3V6z",
  user: "M12 12a4 4 0 1 0-4-4a4 4 0 0 0 4 4Zm-7 8a7 7 0 0 1 14 0",
  chevron: "M9 6l6 6-6 6",
  play: "M8 6l8 6-8 6V6z",
  pause: "M8 6h3v12H8zM13 6h3v12h-3z",
  refresh: "M18 8V4h-4M6 16v4h4M6.8 9A6 6 0 0 1 18 8M17.2 15A6 6 0 0 1 6 16",
  filter: "M4 6h16l-6 7v5l-4-2v-3L4 6z",
  arrowLeft: "M15 18l-6-6 6-6",
  arrowRight: "M9 18l6-6-6-6",
  spark: "M5 15l3-4 3 2 4-6 4 3",
  status: "M12 5v7l4 2",
  close: "M6 6l12 12M18 6L6 18",
  link: "M10 14 14 10M8.5 15.5l-2 2a3 3 0 0 1-4.2-4.2l3.5-3.5a3 3 0 0 1 4.2 0M15.5 8.5l2-2a3 3 0 1 1 4.2 4.2l-3.5 3.5a3 3 0 0 1-4.2 0",
  plus: "M12 5v14M5 12h14",
  window: "M14 5h5v5M10 14l9-9M19 13v6H5V5h6",
};

export function Icon({ name, className, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d={paths[name]} />
    </svg>
  );
}
