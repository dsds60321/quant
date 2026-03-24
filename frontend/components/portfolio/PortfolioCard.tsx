"use client";

import { DashboardCard } from "@/components/ui/DashboardCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { PortfolioListItem } from "@/lib/api";
import { formatCompactCurrency, formatPercent } from "@/lib/format";

export function PortfolioCard({
  portfolio,
  onViewPositions,
}: {
  portfolio: PortfolioListItem;
  onViewPositions?: (portfolioId: number) => void;
}) {
  return (
    <DashboardCard
      title={portfolio.name}
      subtitle={`${portfolio.baseCurrency} · 보유 ${portfolio.positionCount}종목`}
      action={onViewPositions ? <PrimaryButton label="포지션 보기" icon="arrowRight" onClick={() => onViewPositions(portfolio.portfolioId)} /> : undefined}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-[rgba(15,23,42,0.08)] bg-[#f8fbff] px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--fg-muted)]">포트폴리오 가치</p>
          <p className="mt-2 text-[22px] font-semibold text-[color:var(--fg)]">
            {formatCompactCurrency(portfolio.portfolioValue, portfolio.baseCurrency)}
          </p>
        </div>
        <div className="rounded-md border border-[rgba(15,23,42,0.08)] bg-white px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--fg-muted)]">총 손익</p>
          <p className={`mt-2 text-[22px] font-semibold ${portfolio.pnl >= 0 ? "text-[color:var(--buy)]" : "text-[color:var(--sell)]"}`}>
            {formatCompactCurrency(portfolio.pnl, portfolio.baseCurrency)}
          </p>
          <p className="mt-1 text-[12px] text-[color:var(--fg-muted)]">일간 수익률 {formatPercent(portfolio.dailyReturn)}</p>
        </div>
      </div>
    </DashboardCard>
  );
}
