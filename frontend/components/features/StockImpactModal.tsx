"use client";

import { useEffect, useMemo, useState } from "react";
import { NewsImpactGraph } from "@/components/features/NewsImpactGraph";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { Icon } from "@/components/ui/Icon";
import { SignalBadge } from "@/components/ui/SignalBadge";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { getNewsImpactGraph, type NewsImpactGraph as NewsImpactGraphType } from "@/lib/api";

function getSentimentBadge(sentiment: "positive" | "negative" | "neutral") {
  if (sentiment === "positive") {
    return { label: "긍정", tone: "buy" as const };
  }
  if (sentiment === "negative") {
    return { label: "부정", tone: "sell" as const };
  }
  return { label: "중립", tone: "neutral" as const };
}

export function StockImpactModal({
  symbol,
  onClose,
}: {
  symbol: string;
  onClose: () => void;
}) {
  const [graph, setGraph] = useState<NewsImpactGraphType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(true);

  useEffect(() => {
    let mounted = true;
    getNewsImpactGraph(symbol)
      .then((payload) => {
        if (mounted) {
          setGraph(payload);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "뉴스 영향 데이터를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [symbol]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const timeline = useMemo(
    () =>
      (graph?.nodes ?? []).slice().sort((a, b) => {
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }),
    [graph],
  );

  const nodeTitle = (node: NewsImpactGraphType["nodes"][number]) => {
    if (showTranslation) {
      return node.translatedTitle?.trim() || node.title;
    }
    return node.title;
  };

  const nodeSummary = (node: NewsImpactGraphType["nodes"][number]) => {
    if (showTranslation) {
      return node.translatedSummary?.trim() || node.summary || "요약 정보가 없습니다.";
    }
    return node.summary || "요약 정보가 없습니다.";
  };

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.46)] p-3 backdrop-blur-[2px]" onClick={onClose} role="presentation">
      <div
        className="flex h-[96vh] w-[97vw] max-w-none flex-col overflow-hidden rounded-md border border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,#ffffff,#f5f8ff)] shadow-[0_30px_120px_rgba(15,23,42,0.18)]"
        onClick={(event) => event.stopPropagation()}
        role="presentation"
      >
        <div className="flex items-center justify-between border-b border-[rgba(15,23,42,0.08)] bg-white/90 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">뉴스 영향 그래프</p>
            <h2 className="mt-1 text-[18px] font-semibold text-[color:var(--fg)]">{symbol} 영향 분석</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-[rgba(15,23,42,0.08)] bg-[color:var(--surface-muted)] p-1">
              <button
                type="button"
                onClick={() => setShowTranslation(false)}
                className={`rounded-sm px-3 py-1.5 text-[12px] font-medium ${showTranslation ? "text-slate-400" : "bg-white text-slate-900 shadow-[0_6px_18px_rgba(15,23,42,0.08)]"}`}
              >
                원문
              </button>
              <button
                type="button"
                onClick={() => setShowTranslation(true)}
                className={`rounded-sm px-3 py-1.5 text-[12px] font-medium ${showTranslation ? "bg-white text-slate-900 shadow-[0_6px_18px_rgba(15,23,42,0.08)]" : "text-slate-400"}`}
              >
                번역
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[rgba(15,23,42,0.08)] bg-white text-slate-500"
              aria-label="닫기"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 p-3 xl:grid-cols-[1.6fr_0.8fr]">
          <div className="min-h-0 space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-[rgba(15,23,42,0.08)] bg-white px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">종목</p>
                <p className="mt-2 text-[22px] font-semibold text-[color:var(--fg)]">{symbol}</p>
              </div>
              <div className="rounded-md border border-[rgba(15,23,42,0.08)] bg-white px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">평균 감성</p>
                <p className="mt-2 text-[22px] font-semibold text-[color:var(--fg)]">{graph?.sentimentScore.toFixed(2) ?? "-"}</p>
              </div>
              <div className="rounded-md border border-[rgba(15,23,42,0.08)] bg-white px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">노드 수</p>
                <p className="mt-2 text-[22px] font-semibold text-[color:var(--fg)]">{graph?.nodes.length.toLocaleString("ko-KR") ?? "-"}개</p>
              </div>
            </div>

            <div className="min-h-0 flex-1 rounded-md border border-[rgba(15,23,42,0.08)] bg-white p-2">
              {loading ? (
                <div className="flex h-full min-h-[680px] items-center justify-center text-[13px] text-slate-400">뉴스 영향 데이터를 불러오는 중입니다.</div>
              ) : error || !graph ? (
                <div className="p-3">
                  <StatusNotice title="뉴스 영향 데이터 조회 실패" description={error ?? "데이터를 표시할 수 없습니다."} />
                </div>
              ) : (
                <NewsImpactGraph graph={graph} height={720} translated={showTranslation} />
              )}
            </div>
          </div>

          <div className="min-h-0 space-y-3">
            <DashboardCard title="감성 기준" subtitle="가로형 기준 요약">
              <div className="grid gap-2 md:grid-cols-3">
                <div className="rounded-md border border-[rgba(78,161,255,0.24)] bg-[rgba(78,161,255,0.08)] px-3 py-3">
                  <p className="text-[12px] font-semibold text-[#7ab8ff]">긍정</p>
                  <p className="mt-1 text-[11px] leading-5 text-[color:var(--fg)]">FinBERT가 긍정으로 분류하거나 감성 점수가 `0.1` 초과인 경우입니다.</p>
                </div>
                <div className="rounded-md border border-[rgba(184,193,209,0.22)] bg-[rgba(184,193,209,0.08)] px-3 py-3">
                  <p className="text-[12px] font-semibold text-slate-500">중립</p>
                  <p className="mt-1 text-[11px] leading-5 text-[color:var(--fg)]">뚜렷한 호재나 악재가 없고 감성 점수가 `-0.1`에서 `0.1` 사이인 경우입니다.</p>
                </div>
                <div className="rounded-md border border-[rgba(255,107,107,0.24)] bg-[rgba(255,107,107,0.08)] px-3 py-3">
                  <p className="text-[12px] font-semibold text-[#ff7e7e]">부정</p>
                  <p className="mt-1 text-[11px] leading-5 text-[color:var(--fg)]">FinBERT가 부정으로 분류하거나 감성 점수가 `-0.1` 미만인 경우입니다.</p>
                </div>
              </div>
            </DashboardCard>

            <DashboardCard title="뉴스 목록" subtitle="기사별 감성과 요약">
              <div className="ui-scrollbar max-h-[42vh] space-y-3 overflow-y-auto pr-1">
                {(graph?.nodes ?? []).map((node) => {
                  const badge = getSentimentBadge(node.sentiment);
                  return (
                    <a
                      key={node.id}
                      href={node.url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-md border border-[rgba(15,23,42,0.08)] bg-white px-3 py-3 transition hover:border-[rgba(59,130,246,0.28)] hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-[11px] text-[color:var(--fg-muted)]">
                          <span>{node.source}</span>
                          <span>•</span>
                          <span>{node.publishedAt.replace("T", " ").slice(0, 16)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <SignalBadge label={badge.label} tone={badge.tone} />
                          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-400">원문 이동</span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[color:var(--fg)]">{nodeTitle(node)}</p>
                          <p className="mt-1 text-[12px] leading-5 text-[color:var(--fg-muted)]">{nodeSummary(node)}</p>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </DashboardCard>

            <DashboardCard title="타임라인" subtitle="최근 뉴스부터 정렬">
              <div className="ui-scrollbar max-h-[36vh] space-y-3 overflow-y-auto pr-1">
                {timeline.map((node) => {
                  const badge = getSentimentBadge(node.sentiment);
                  return (
                    <div key={`timeline-${node.id}`} className="flex gap-3">
                      <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[color:var(--kpi)]" />
                      <a
                        href={node.url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 rounded-md border border-[rgba(15,23,42,0.08)] bg-white px-3 py-2.5 transition hover:border-[rgba(59,130,246,0.28)] hover:bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[12px] font-semibold text-[color:var(--fg)]">{node.publishedAt.replace("T", " ").slice(0, 16)}</p>
                          <div className="flex items-center gap-2">
                            <SignalBadge label={badge.label} tone={badge.tone} />
                            <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-400">원문 이동</span>
                          </div>
                        </div>
                        <p className="mt-1 text-[12px] font-semibold text-[color:var(--fg)]">{nodeTitle(node)}</p>
                        <p className="mt-1 text-[11px] leading-5 text-[color:var(--fg-muted)]">{nodeSummary(node)}</p>
                      </a>
                    </div>
                  );
                })}
              </div>
            </DashboardCard>
          </div>
        </div>
      </div>
    </div>
  );
}
