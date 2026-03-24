"use client";

import { useRouter } from "next/navigation";
import type { PortfolioListItem } from "@/lib/api";
import { registerPortfolioAsset } from "@/lib/api";
import { AssetForm } from "@/components/portfolio/AssetForm";

export function AssetManagementClient({
  portfolios,
}: {
  portfolios: PortfolioListItem[];
}) {
  const router = useRouter();

  return (
    <AssetForm
      portfolios={portfolios}
      onSubmit={async (payload) => {
        await registerPortfolioAsset(payload);
        router.refresh();
      }}
    />
  );
}
