"use client";

import { useEffect, useState } from "react";
import { deletePortfolioAsset, getPortfolioDetail, type PortfolioDetail, type PortfolioListItem } from "@/lib/api";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { PositionTable } from "@/components/portfolio/PositionTable";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { formatCompactCurrency, formatPercent } from "@/lib/format";

export function PortfolioPositionsClient({
  portfolios,
  initialPortfolioId,
  initialDetail,
}: {
  portfolios: PortfolioListItem[];
  initialPortfolioId: number | null;
  initialDetail: PortfolioDetail | null;
}) {
  const [portfolioId, setPortfolioId] = useState(initialPortfolioId ?? portfolios[0]?.portfolioId ?? 0);
  const [detail, setDetail] = useState(initialDetail);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!portfolioId) {
      return;
    }

    let mounted = true;

    getPortfolioDetail(portfolioId)
      .then((payload) => {
        if (mounted) {
          setDetail(payload);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "포지션을 불러오지 못했습니다.");
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
  }, [portfolioId]);

  if (!portfolios.length) {
    return <StatusNotice title="포트폴리오 없음" description="먼저 포트폴리오를 생성한 뒤 자산을 등록하세요." />;
  }

  return (
    <DashboardCard title="포지션 테이블" subtitle="선택한 포트폴리오의 보유 자산과 손익을 조회합니다.">
      <div className="mb-4 grid gap-3 md:grid-cols-[220px_repeat(3,minmax(0,1fr))]">
        <label className="space-y-1.5">
          <span className="text-[12px] font-semibold text-[color:var(--fg)]">포트폴리오 선택</span>
          <select
            value={portfolioId}
            onChange={(event) => {
              setLoading(true);
              setError(null);
              setPortfolioId(Number(event.target.value));
            }}
            className="w-full rounded-md border border-[rgba(15,23,42,0.12)] bg-white px-3 py-2 text-[13px] text-[color:var(--fg)]"
          >
            {portfolios.map((portfolio) => (
              <option key={portfolio.portfolioId} value={portfolio.portfolioId}>
                {portfolio.name}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-md border border-[rgba(15,23,42,0.08)] bg-[#f8fbff] px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--fg-muted)]">포트폴리오 가치</p>
          <p className="mt-2 text-[18px] font-semibold text-[color:var(--fg)]">
            {detail ? formatCompactCurrency(detail.portfolioValue, detail.baseCurrency) : "-"}
          </p>
        </div>
        <div className="rounded-md border border-[rgba(15,23,42,0.08)] bg-white px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--fg-muted)]">총 손익</p>
          <p className={`mt-2 text-[18px] font-semibold ${detail && detail.pnl >= 0 ? "text-[color:var(--buy)]" : "text-[color:var(--sell)]"}`}>
            {detail ? formatCompactCurrency(detail.pnl, detail.baseCurrency) : "-"}
          </p>
        </div>
        <div className="rounded-md border border-[rgba(15,23,42,0.08)] bg-white px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--fg-muted)]">일간 수익률</p>
          <p className="mt-2 text-[18px] font-semibold text-[color:var(--fg)]">{detail ? formatPercent(detail.dailyReturn) : "-"}</p>
        </div>
      </div>

      {error ? (
        <StatusNotice title="포지션 조회 실패" description={error} />
      ) : loading && !detail ? (
        <div className="rounded-md border border-[rgba(15,23,42,0.08)] bg-[#f8fbff] px-3 py-6 text-center text-[13px] text-[color:var(--fg-muted)]">
          포지션 데이터를 불러오는 중입니다.
        </div>
      ) : detail ? (
        <PositionTable
          positions={detail.positions}
          currency={detail.baseCurrency}
          onDelete={async (assetId) => {
            await deletePortfolioAsset(assetId);
            const refreshed = await getPortfolioDetail(portfolioId);
            setDetail(refreshed);
          }}
        />
      ) : (
        <StatusNotice title="포지션 없음" description="선택한 포트폴리오에 등록된 자산이 없습니다." />
      )}
    </DashboardCard>
  );
}
