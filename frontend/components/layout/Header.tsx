"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { getJobs, getStrategies, getStrategyRuns, searchStocks, type JobItem, type StockLookupItem, type StrategyRunItem, type StrategySummary } from "@/lib/api";
import { summarizeBacktestUniverseScope, type BacktestUniverseScopePayload } from "@/lib/backtest-universe";

type SearchItem = {
  id: string;
  label: string;
  type: "전략" | "종목";
  value: string;
  href: string;
};

const quickSearchItems: SearchItem[] = [
  { id: "quick-strategy-builder", label: "전략 생성", type: "전략", value: "새 전략을 만들거나 기존 전략을 편집합니다.", href: "/strategy-builder" },
  { id: "quick-strategy-comparison", label: "전략 비교", type: "전략", value: "저장된 전략 성과를 비교합니다.", href: "/strategy-comparison" },
];

type MarketState = {
  label: string;
  toneClass: string;
};

type NotificationItem = {
  id: string;
  title: string;
  description: string;
  toneClass: string;
  href: string;
  status: "PENDING" | "RUNNING" | "FAILED" | "COMPLETED";
};

const DISMISSED_NOTIFICATION_STORAGE_KEY = "quant-dismissed-notifications";
const ANNOUNCED_NOTIFICATION_STORAGE_KEY = "quant-announced-notifications";
const COMPLETION_NOTIFICATION_WINDOW_MS = 30 * 60 * 1000;

function loadAnnouncedNotificationIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const stored = window.sessionStorage.getItem(ANNOUNCED_NOTIFICATION_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function getZonedParts(timeZone: string, now: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return { weekday, hour, minute, totalMinutes: hour * 60 + minute };
}

function resolveMarketState(market: "KR" | "US", now: Date): MarketState {
  if (market === "KR") {
    const parts = getZonedParts("Asia/Seoul", now);
    if (["Sat", "Sun"].includes(parts.weekday)) {
      return { label: "한국 장마감", toneClass: "text-[color:var(--fg-muted)]" };
    }
    if (parts.totalMinutes >= 510 && parts.totalMinutes < 540) {
      return { label: "한국 프리장", toneClass: "text-[color:var(--kpi)]" };
    }
    if (parts.totalMinutes >= 540 && parts.totalMinutes < 930) {
      return { label: "한국 정규장", toneClass: "text-[color:var(--buy)]" };
    }
    return { label: "한국 장마감", toneClass: "text-[color:var(--fg-muted)]" };
  }

  const parts = getZonedParts("America/New_York", now);
  if (["Sat", "Sun"].includes(parts.weekday)) {
    return { label: "미국 장마감", toneClass: "text-[color:var(--fg-muted)]" };
  }
  if (parts.totalMinutes >= 240 && parts.totalMinutes < 570) {
    return { label: "미국 프리장", toneClass: "text-[color:var(--kpi)]" };
  }
  if (parts.totalMinutes >= 570 && parts.totalMinutes < 960) {
    return { label: "미국 정규장", toneClass: "text-[color:var(--buy)]" };
  }
  return { label: "미국 장마감", toneClass: "text-[color:var(--fg-muted)]" };
}

function formatRelativeTime(value: string | null) {
  if (!value) {
    return "시간 정보 없음";
  }
  const target = new Date(value);
  const diffMinutes = Math.round((Date.now() - target.getTime()) / 60000);
  if (diffMinutes <= 1) {
    return "방금 전";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }
  return target.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function resolveJobTitle(job: JobItem) {
  const map: Record<string, string> = {
    data_update_dispatch: "데이터 동기화",
    market_data_update: "시장 데이터 적재",
    fundamentals_refresh: "펀더멘털 적재",
    benchmark_sync: "벤치마크 적재",
    strategy_candidate_analysis: "전략 후보 분석",
    backtest_dispatch: "백테스트",
    strategy_optimization: "전략 최적화",
    strategy_comparison: "전략 비교",
  };
  if (job.jobType.includes("rebalance")) {
    return "리밸런싱";
  }
  return map[job.jobType] ?? job.jobType;
}

function resolveJobHref(job: JobItem) {
  if (job.jobType.includes("rebalance")) {
    return "/strategy-execution-center";
  }
  const map: Record<string, string> = {
    data_update_dispatch: "/data-center",
    market_data_update: "/data-center",
    fundamentals_refresh: "/data-center",
    benchmark_sync: "/data-center",
    strategy_candidate_analysis: "/strategy-builder",
    backtest_dispatch: "/backtest-results",
    strategy_optimization: "/strategy-optimization",
    strategy_comparison: "/strategy-comparison",
  };
  return map[job.jobType] ?? "/job-monitor";
}

function parseJobMetadata(job: JobItem) {
  if (!job.metadataJson) {
    return {};
  }
  try {
    const parsed = JSON.parse(job.metadataJson) as Record<string, unknown>;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function resolveJobUniverseScope(metadata: Record<string, unknown>) {
  const scope = metadata.universeScope;
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    return null;
  }
  return scope as BacktestUniverseScopePayload;
}

function buildJobNotificationDescription(job: JobItem, metadata: Record<string, unknown>) {
  const progressPercent = typeof metadata.progressPercent === "number" ? metadata.progressPercent : null;
  const stageLabel = typeof metadata.stageLabel === "string" ? metadata.stageLabel : null;
  const processedCount = typeof metadata.processedCount === "number" ? metadata.processedCount : null;
  const totalCount = typeof metadata.totalCount === "number" ? metadata.totalCount : null;
  const universeScope = resolveJobUniverseScope(metadata);
  const scopeLabel = universeScope ? summarizeBacktestUniverseScope(universeScope).shortLabel : null;
  const progressLabel = progressPercent != null ? `${Math.max(0, Math.min(100, Math.round(progressPercent)))}%` : null;
  const scheduleLabel = processedCount != null && totalCount != null && totalCount > 0 ? `리밸런싱 ${processedCount}/${totalCount}` : null;
  return [progressLabel, stageLabel, scopeLabel, scheduleLabel, job.message ?? null].filter(Boolean).join(" · ") || formatRelativeTime(job.startedAt ?? job.finishedAt);
}

function buildNotifications(jobs: JobItem[], strategyRuns: StrategyRunItem[]): NotificationItem[] {
  const activeJobs = jobs
    .filter((job) => ["PENDING", "RUNNING", "FAILED"].includes(job.status))
    .slice(0, 4)
    .map((job) => {
      const metadata = parseJobMetadata(job);
      return {
        id: `job-${job.id}-${job.status}`,
        title: `${resolveJobTitle(job)} ${job.status === "FAILED" ? "실패" : job.status === "RUNNING" ? "진행중" : "대기중"}`,
        description: buildJobNotificationDescription(job, metadata),
        toneClass: job.status === "FAILED" ? "text-[color:var(--sell)]" : job.status === "RUNNING" ? "text-[color:var(--buy)]" : "text-[color:var(--kpi)]",
        href: resolveJobHref(job),
        status: job.status as NotificationItem["status"],
      };
    });

  const recentCompletedJobs = jobs
    .filter((job) => ["data_update_dispatch", "fundamentals_refresh", "backtest_dispatch", "strategy_candidate_analysis"].includes(job.jobType))
    .filter((job) => job.status === "COMPLETED" && job.finishedAt)
    .filter((job) => {
      const finishedAt = new Date(job.finishedAt as string);
      return !Number.isNaN(finishedAt.getTime()) && Date.now() - finishedAt.getTime() <= COMPLETION_NOTIFICATION_WINDOW_MS;
    })
    .slice(0, 4)
    .map((job) => ({
      id: `job-${job.id}-${job.status}`,
      title: `${resolveJobTitle(job)} 완료`,
      description: job.message ?? formatRelativeTime(job.finishedAt),
      toneClass: "text-[color:var(--buy)]",
      href: resolveJobHref(job),
      status: "COMPLETED" as const,
    }));

  const activeRuns = strategyRuns
    .filter((run) => ["RUNNING", "PENDING"].includes(run.status))
    .slice(0, 4)
    .map((run) => ({
      id: `run-${run.id}-${run.status}`,
      title: `${run.strategyName} ${run.status === "RUNNING" ? "실행중" : "대기중"}`,
      description: `전략 실행 센터 · ${formatRelativeTime(run.startedAt)}`,
      toneClass: run.status === "RUNNING" ? "text-[color:var(--buy)]" : "text-[color:var(--kpi)]",
      href: "/strategy-execution-center",
      status: run.status as NotificationItem["status"],
    }));

  return [...recentCompletedJobs, ...activeJobs, ...activeRuns].slice(0, 8);
}

export function Header() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<NotificationItem[]>([]);
  const [strategyCatalog, setStrategyCatalog] = useState<StrategySummary[]>([]);
  const [stockSuggestions, setStockSuggestions] = useState<StockLookupItem[]>([]);
  const [stockSuggestionKeyword, setStockSuggestionKeyword] = useState("");
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    try {
      const stored = window.localStorage.getItem(DISMISSED_NOTIFICATION_STORAGE_KEY);
      if (!stored) {
        return [];
      }
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const announcedIdsRef = useRef<string[]>(loadAnnouncedNotificationIds());
  const deferredQuery = useDeferredValue(query.trim());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getStrategies()
      .then((items) => {
        if (!cancelled) {
          setStrategyCatalog(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStrategyCatalog([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!deferredQuery) {
      return;
    }

    let cancelled = false;
    searchStocks({ query: deferredQuery, limit: 5 })
      .then((items) => {
        if (!cancelled) {
          setStockSuggestionKeyword(deferredQuery);
          setStockSuggestions(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStockSuggestionKeyword(deferredQuery);
          setStockSuggestions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deferredQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      try {
        const [jobs, strategyRuns] = await Promise.all([getJobs(), getStrategyRuns()]);
        if (cancelled) {
          return;
        }
        setNotifications(buildNotifications(jobs, strategyRuns).filter((item) => !dismissedIds.includes(item.id)));
      } catch {
        if (!cancelled) {
          setNotifications([]);
        }
      }
    }

    void loadNotifications();
    const timer = window.setInterval(() => {
      void loadNotifications();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [dismissedIds]);

  const suggestions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return [];
    const quickMatches = quickSearchItems.filter((item) => item.label.toLowerCase().includes(keyword) || item.value.toLowerCase().includes(keyword));
    const strategyMatches = strategyCatalog
      .filter((strategy) => strategy.name.toLowerCase().includes(keyword))
      .slice(0, 4)
      .map<SearchItem>((strategy) => ({
        id: `strategy-${strategy.strategyId}`,
        label: strategy.name,
        type: "전략",
        value: `ROE ${strategy.roe ?? 0} / PBR ${strategy.pbr ?? 0} / 모멘텀 ${strategy.momentum ?? 0} · ${strategy.status}`,
        href: `/strategy-builder?strategyId=${strategy.strategyId}`,
      }));
    const stockMatches = (stockSuggestionKeyword === deferredQuery ? stockSuggestions : [])
      .filter((item) => item.symbol.toLowerCase().includes(keyword) || item.name.toLowerCase().includes(keyword))
      .map<SearchItem>((item) => ({
        id: `stock-${item.symbol}`,
        label: item.symbol,
        type: "종목",
        value: `${item.name} · ${item.exchange}`,
        href: `/stock-analysis?symbol=${encodeURIComponent(item.symbol)}`,
      }));

    return [...quickMatches, ...strategyMatches, ...stockMatches]
      .filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index)
      .slice(0, 8);
  }, [deferredQuery, query, stockSuggestionKeyword, stockSuggestions, strategyCatalog]);

  const koreanMarket = useMemo(() => resolveMarketState("KR", now), [now]);
  const usMarket = useMemo(() => resolveMarketState("US", now), [now]);

  function handleSelect(item: SearchItem) {
    setQuery(item.label);
    setFocused(false);
    router.push(item.href);
  }

  function persistDismissed(ids: string[]) {
    setDismissedIds(ids);
    window.localStorage.setItem(DISMISSED_NOTIFICATION_STORAGE_KEY, JSON.stringify(ids));
  }

  function persistAnnounced(ids: string[]) {
    announcedIdsRef.current = ids;
    window.sessionStorage.setItem(ANNOUNCED_NOTIFICATION_STORAGE_KEY, JSON.stringify(ids));
  }

  function dismissNotification(notificationId: string) {
    const next = Array.from(new Set([...dismissedIds, notificationId]));
    persistDismissed(next);
    setNotifications((current) => current.filter((item) => item.id !== notificationId));
    setToasts((current) => current.filter((item) => item.id !== notificationId));
  }

  function clearNotifications() {
    const next = Array.from(new Set([...dismissedIds, ...notifications.map((item) => item.id)]));
    persistDismissed(next);
    setNotifications([]);
  }

  function handleNotificationClick(item: NotificationItem) {
    dismissNotification(item.id);
    setNoticeOpen(false);
    router.push(item.href);
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const nextToasts = notifications.filter(
      (item) => (item.status === "COMPLETED" || item.status === "FAILED") && !announcedIdsRef.current.includes(item.id),
    );
    if (nextToasts.length === 0) {
      return;
    }
    const nextAnnounced = Array.from(new Set([...announcedIdsRef.current, ...nextToasts.map((item) => item.id)])).slice(-50);
    persistAnnounced(nextAnnounced);
    setToasts((current) => {
      const merged = [...nextToasts, ...current].filter(
        (item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index,
      );
      return merged.slice(0, 4);
    });
  }, [notifications]);

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setToasts((current) => current.slice(0, -1));
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  return (
    <header className="border-b border-[color:rgba(15,23,42,0.08)] bg-white">
      {toasts.length > 0 ? (
        <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[320px] flex-col gap-2">
          {toasts.map((item) => (
            <div key={item.id} className="pointer-events-auto rounded-md border border-[color:rgba(15,23,42,0.08)] bg-white p-3 shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => handleNotificationClick(item)} className="min-w-0 flex-1 text-left">
                  <p className={`text-[13px] font-semibold ${item.toneClass}`}>{item.title}</p>
                  <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{item.description}</p>
                </button>
                <button type="button" onClick={() => dismissNotification(item.id)} className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-sm text-[color:var(--fg-muted)] hover:bg-[#f5f7fb] hover:text-[color:var(--fg)]">
                  <Icon name="close" className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex h-14 items-center justify-between gap-3 px-3 lg:px-4">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--fg-muted)]">퀀트 파일럿</p>
            <p className="text-[13px] font-semibold text-[color:var(--fg)]">기관형 트레이딩 대시보드</p>
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 lg:flex lg:justify-center">
          <div className="relative w-full max-w-xl">
            <label className="flex w-full items-center gap-2 rounded-md border border-[color:rgba(15,23,42,0.08)] bg-[#f5f7fb] px-3 py-2">
              <Icon name="search" className="h-3.5 w-3.5 text-[color:var(--fg-muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && suggestions.length > 0) {
                    event.preventDefault();
                    handleSelect(suggestions[0]);
                  }
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 120)}
                placeholder="전략, 종목 검색"
                className="w-full bg-transparent text-[13px] text-[color:var(--fg)] placeholder:text-[color:var(--fg-muted)]"
              />
            </label>
            {focused && query.trim() ? (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 rounded-md border border-[color:rgba(15,23,42,0.08)] bg-white p-1.5 shadow-[0_20px_36px_rgba(15,23,42,0.12)]">
                {suggestions.length > 0 ? (
                  suggestions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item)}
                      className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left hover:bg-[#f5f7fb]"
                    >
                      <div>
                        <p className="text-[12px] font-semibold text-[color:var(--fg)]">{item.label}</p>
                        <p className="mt-0.5 text-[11px] text-[color:var(--fg-muted)]">{item.type}</p>
                      </div>
                      <span className="text-[11px] font-medium text-[color:var(--fg-muted)]">{item.value}</span>
                    </button>
                  ))
                ) : (
                  <div className="rounded-md px-2.5 py-3 text-[12px] text-[color:var(--fg-muted)]">
                    일치하는 전략 또는 종목이 없습니다.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-3">
          <div className="hidden items-center gap-2 lg:flex">
            {[koreanMarket, usMarket].map((market) => (
              <div key={market.label} className="rounded-md border border-[color:rgba(15,23,42,0.08)] bg-[#f7f9fc] px-2.5 py-1.5">
                <p className={`text-[12px] font-semibold ${market.toneClass}`}>{market.label}</p>
              </div>
            ))}
          </div>

          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md border border-[color:rgba(15,23,42,0.08)] bg-white text-[color:var(--fg-muted)]">
            <Icon name="message" className="h-3.5 w-3.5" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setNoticeOpen((value) => !value)}
              className="relative flex h-8 w-8 items-center justify-center rounded-md border border-[color:rgba(15,23,42,0.08)] bg-white text-[color:var(--fg-muted)]"
            >
              <Icon name="bell" className="h-3.5 w-3.5" />
              {notifications.length > 0 ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[color:var(--kpi)]" /> : null}
            </button>
            {noticeOpen ? (
              <div className="absolute right-0 top-10 w-72 rounded-md border border-[color:rgba(15,23,42,0.08)] bg-white p-2 shadow-[0_16px_30px_rgba(15,23,42,0.08)]">
                <div className="mb-1 flex items-center justify-between px-2.5 py-1">
                  <p className="text-[12px] font-semibold text-[color:var(--fg)]">실시간 알림</p>
                  {notifications.length > 0 ? (
                    <button type="button" onClick={clearNotifications} className="text-[11px] font-semibold text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]">
                      모두 지우기
                    </button>
                  ) : null}
                </div>
                {notifications.length > 0 ? (
                  notifications.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 rounded-md px-2.5 py-2 hover:bg-[#f5f7fb]">
                      <button type="button" onClick={() => handleNotificationClick(item)} className="min-w-0 flex-1 text-left">
                        <p className={`text-[13px] font-semibold ${item.toneClass}`}>{item.title}</p>
                        <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{item.description}</p>
                      </button>
                      <button type="button" onClick={() => dismissNotification(item.id)} className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-sm text-[color:var(--fg-muted)] hover:bg-white hover:text-[color:var(--fg)]">
                        <Icon name="close" className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md px-2.5 py-2 text-[12px] text-[color:var(--fg-muted)]">
                    현재 진행 중인 데이터 동기화, 백테스트, 리밸런싱 알림이 없습니다.
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex items-center gap-2 rounded-md border border-[color:rgba(15,23,42,0.08)] bg-white px-2 py-1.5"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[linear-gradient(180deg,#111827,#334155)] text-white">
                <Icon name="user" className="h-3.5 w-3.5" />
              </div>
              <span className="hidden text-xs font-semibold text-[color:var(--fg)] lg:inline">운용 관리자</span>
              <Icon name="chevron" className="h-3.5 w-3.5 text-[color:var(--fg-muted)]" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-10 w-44 rounded-md border border-[color:rgba(15,23,42,0.08)] bg-white p-1.5 shadow-[0_16px_30px_rgba(15,23,42,0.08)]">
                {["프로필 설정", "권한 관리", "로그아웃"].map((item) => (
                  <button key={item} type="button" className="w-full rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-[color:var(--fg)] hover:bg-[#f5f7fb]">
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
