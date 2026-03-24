"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPortfolio, type PortfolioListItem } from "@/lib/api";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import { PortfolioModal } from "@/components/portfolio/PortfolioModal";

export function PortfolioManagementClient({
  initialPortfolios,
}: {
  initialPortfolios: PortfolioListItem[];
}) {
  const router = useRouter();
  const [portfolios, setPortfolios] = useState(initialPortfolios);
  const [open, setOpen] = useState(false);

  return (
    <>
      <DashboardCard
        title="포트폴리오 개요"
        subtitle="등록된 포트폴리오 목록과 총 손익을 관리합니다."
        action={<PrimaryButton label="새 포트폴리오" icon="play" onClick={() => setOpen(true)} />}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {portfolios.map((portfolio) => (
            <PortfolioCard
              key={portfolio.portfolioId}
              portfolio={portfolio}
              onViewPositions={(portfolioId) => router.push(`/portfolio/positions?portfolioId=${portfolioId}`)}
            />
          ))}
        </div>
      </DashboardCard>

      <PortfolioModal
        open={open}
        onClose={() => setOpen(false)}
        onCreate={async (payload) => {
          const created = await createPortfolio(payload);
          setPortfolios((current) => [
            {
              portfolioId: created.portfolioId,
              name: payload.name,
              baseCurrency: payload.baseCurrency,
              status: "ACTIVE",
              portfolioValue: 0,
              pnl: 0,
              dailyReturn: 0,
              positionCount: 0,
            },
            ...current,
          ]);
          router.refresh();
        }}
      />
    </>
  );
}
