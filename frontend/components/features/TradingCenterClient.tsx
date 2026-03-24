"use client";

import { useState } from "react";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { DataTable } from "@/components/ui/DataTable";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { SegmentTabs } from "@/components/ui/SegmentTabs";
import { SignalBadge } from "@/components/ui/SignalBadge";
import { StatusNotice } from "@/components/ui/StatusNotice";
import { cancelOrder, createOrder, getOrders, getPortfolioSummary, type OrderItem, type PortfolioSummary } from "@/lib/api";
import { formatCompactCurrency } from "@/lib/format";

const tabItems = ["주문", "체결", "포지션"];

function getOrderStatusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "대기";
    case "FILLED":
      return "체결";
    case "CANCELED":
      return "취소";
    case "REJECTED":
      return "거절";
    default:
      return status;
  }
}

function getOrderStatusTone(status: string): "hold" | "buy" | "sell" | "neutral" {
  switch (status) {
    case "PENDING":
      return "hold";
    case "FILLED":
      return "buy";
    case "CANCELED":
    case "REJECTED":
      return "sell";
    default:
      return "neutral";
  }
}

export function TradingCenterClient({
  initialOrders,
  initialPortfolio,
}: {
  initialOrders: OrderItem[];
  initialPortfolio: PortfolioSummary;
}) {
  const [activeTab, setActiveTab] = useState(tabItems[0]);
  const [orders, setOrders] = useState<OrderItem[]>(initialOrders);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(initialPortfolio);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [ordersData, portfolioData] = await Promise.all([getOrders(), getPortfolioSummary()]);
    setOrders(ordersData);
    setPortfolio(portfolioData);
  }

  async function handleCreateOrder() {
    setLoading(true);
    setError(null);
    try {
      await createOrder({ portfolioId: 1, symbol: "005930", side: "BUY", orderType: "LIMIT", price: 64300, quantity: 10 });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "주문 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelOrder(orderId: number) {
    setLoading(true);
    setError(null);
    try {
      await cancelOrder(orderId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "주문 취소 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  let content: {
    title: string;
    columns: string[];
    rows: Array<Array<React.ReactNode>>;
  };

  if (activeTab === "주문") {
    content = {
      title: "주문 테이블",
      columns: ["주문 ID", "종목", "수량", "가격", "주문 상태", "주문 시간", "작업"],
      rows: orders.map((order) => [
        order.id,
        order.symbol,
        order.quantity.toLocaleString("ko-KR"),
        order.price ? formatCompactCurrency(order.price) : "시장가",
        <SignalBadge key={`${order.id}-status`} label={getOrderStatusLabel(order.status)} tone={getOrderStatusTone(order.status)} />,
        order.submittedAt?.replace("T", " ").slice(0, 16) ?? "-",
        <button
          key={`${order.id}-cancel`}
          type="button"
          onClick={() => handleCancelOrder(order.id)}
          disabled={loading || order.status !== "PENDING"}
          className="inline-flex h-7 items-center rounded-md border border-[color:rgba(15,23,42,0.12)] px-2.5 text-[11px] font-semibold text-[color:var(--fg)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          주문 취소
        </button>,
      ]),
    };
  } else if (activeTab === "체결") {
    content = {
      title: "체결 테이블",
      columns: ["체결 ID", "종목", "체결 가격", "수량", "체결 시간"],
      rows: orders.slice(0, 5).map((order) => [
        `EXE-${order.id}`,
        order.symbol,
        order.price ? formatCompactCurrency(order.price) : "시장가",
        order.quantity.toLocaleString("ko-KR"),
        order.submittedAt?.replace("T", " ").slice(0, 16) ?? "-",
      ]),
    };
  } else {
    content = {
      title: "포지션 테이블",
      columns: ["종목", "수량", "평균 단가", "현재가", "평가 손익"],
      rows: (portfolio?.positions ?? []).map((position) => [
        position.symbol,
        position.quantity.toLocaleString("ko-KR"),
        formatCompactCurrency(position.avgPrice),
        formatCompactCurrency(position.currentPrice),
        formatCompactCurrency(position.unrealizedPnl),
      ]),
    };
  }

  return (
    <DashboardCard title="거래 흐름" subtitle="탭을 전환해 주문·체결·포지션 데이터를 확인합니다.">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SegmentTabs items={tabItems} initialValue={tabItems[0]} onChange={setActiveTab} />
        <div className="flex gap-2">
          <button type="button" onClick={handleCreateOrder} className="ui-button-primary" disabled={loading}>
            {loading ? "주문 전송 중" : "주문 생성"}
          </button>
          <SecondaryButton label="주문 수정" />
        </div>
      </div>
      {error ? <div className="mb-4"><StatusNotice title="거래 요청 실패" description={error} /></div> : null}
      <DataTable title={content.title} columns={content.columns} rows={content.rows} />
    </DashboardCard>
  );
}
