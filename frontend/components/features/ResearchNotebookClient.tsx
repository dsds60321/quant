"use client";

import { useMemo, useState } from "react";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { DataTable } from "@/components/ui/DataTable";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { type StrategySummary } from "@/lib/api";
import { formatPercent } from "@/lib/format";

function buildNotebookCode(strategy: StrategySummary | null) {
  if (!strategy) {
    return "# 등록된 전략이 없습니다.\n# 전략 생성 페이지에서 전략을 먼저 저장하세요.";
  }

  return `from quant_engine import StrategyBuilder

strategy = (
    StrategyBuilder()
    .set_filter("roe", ">", ${strategy.roe ?? 0})
    .set_filter("pbr", "<", ${strategy.pbr ?? 0})
    .set_filter("momentum", ">", ${strategy.momentum ?? 0})
    .set_stock_count(${strategy.stockCount ?? 0})
    .set_rebalance("${strategy.rebalance ?? "monthly"}")
)

result = strategy.run_backtest()
print(result.metrics)`;
}

export function ResearchNotebookClient({ strategies }: { strategies: StrategySummary[] }) {
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(strategies[0]?.strategyId ?? null);
  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.strategyId === selectedStrategyId) ?? null,
    [selectedStrategyId, strategies],
  );

  const latestBacktest = selectedStrategy?.latestBacktest ?? null;

  return (
    <div className="space-y-4">
      <DashboardCard title="전략 리서치 선택" subtitle="등록 전략 기반으로 노트 내용을 구성합니다.">
        <select value={selectedStrategyId ?? ""} onChange={(event) => setSelectedStrategyId(Number(event.target.value))} className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-[12px] font-medium lg:max-w-md">
          {strategies.map((strategy) => (
            <option key={strategy.strategyId} value={strategy.strategyId}>{strategy.name}</option>
          ))}
        </select>
      </DashboardCard>

      {strategies.length === 0 ? <StatusNotice title="등록 전략이 없습니다." description="연구 노트는 저장된 전략을 기준으로 코드와 성과 요약을 보여줍니다." /> : null}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <DashboardCard title="코드 에디터" subtitle="선택 전략 기준의 백테스트 스크립트 미리보기">
          <pre className="min-h-[420px] overflow-x-auto rounded-md bg-[#0f172a] p-5 font-mono text-sm leading-7 text-slate-100">{buildNotebookCode(selectedStrategy)}</pre>
        </DashboardCard>
        <div className="space-y-4">
          <DashboardCard title="최신 성과 요약">
            {latestBacktest ? (
              <section className="grid gap-3 md:grid-cols-2">
                <MetricCard label="CAGR" value={latestBacktest.cagr == null ? "-" : formatPercent(latestBacktest.cagr)} change="최신 백테스트" accent="buy" />
                <MetricCard label="샤프지수" value={latestBacktest.sharpe == null ? "-" : latestBacktest.sharpe.toFixed(2)} change="최신 백테스트" accent="kpi" />
                <MetricCard label="최대 낙폭" value={latestBacktest.maxDrawdown == null ? "-" : formatPercent(latestBacktest.maxDrawdown)} change="최신 백테스트" accent="sell" />
                <MetricCard label="승률" value={latestBacktest.winRate == null ? "-" : formatPercent(latestBacktest.winRate)} change="최신 백테스트" accent="buy" />
              </section>
            ) : (
              <StatusNotice title="백테스트 결과가 없습니다." description="선택한 전략으로 백테스트를 한 번 실행하면 최신 성과가 표시됩니다." />
            )}
          </DashboardCard>

          <DashboardCard title="전략 파라미터">
            {selectedStrategy ? (
              <DataTable
                columns={["항목", "값"]}
                rows={[
                  ["ROE", String(selectedStrategy.roe ?? "-")],
                  ["PBR", String(selectedStrategy.pbr ?? "-")],
                  ["모멘텀", String(selectedStrategy.momentum ?? "-")],
                  ["종목 수", String(selectedStrategy.stockCount ?? "-")],
                  ["리밸런싱", selectedStrategy.rebalance ?? "-"],
                ]}
                pageSize={5}
              />
            ) : null}
          </DashboardCard>
        </div>
      </section>
    </div>
  );
}
