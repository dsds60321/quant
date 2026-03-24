"use client";

import type { ManagedPosition } from "@/lib/api";
import { formatCompactCurrency } from "@/lib/format";
import { SecondaryButton } from "@/components/ui/SecondaryButton";

export function PositionTable({
  positions,
  currency,
  onDelete,
}: {
  positions: ManagedPosition[];
  currency: string;
  onDelete?: (assetId: number) => Promise<void>;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[rgba(15,23,42,0.08)] bg-white">
      <div className="ui-scrollbar overflow-x-auto">
        <table className="ui-table min-w-full bg-white">
          <thead>
            <tr>
              <th>종목</th>
              <th>수량</th>
              <th>평균 단가</th>
              <th>현재 가격</th>
              <th>평가 금액</th>
              <th>손익</th>
              {onDelete ? <th>작업</th> : null}
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => (
              <tr key={position.id} className="transition hover:bg-[#f8fbff]">
                <td className="font-semibold text-[color:var(--fg)]">{position.symbol}</td>
                <td>{position.quantity.toLocaleString("ko-KR")}</td>
                <td>{formatCompactCurrency(position.avgPrice, currency)}</td>
                <td>{formatCompactCurrency(position.currentPrice, currency)}</td>
                <td>{formatCompactCurrency(position.marketValue, currency)}</td>
                <td className={position.pnl >= 0 ? "text-[color:var(--buy)]" : "text-[color:var(--sell)]"}>
                  {formatCompactCurrency(position.pnl, currency)}
                </td>
                {onDelete ? (
                  <td>
                    <SecondaryButton label="삭제" icon="close" onClick={() => void onDelete(position.id)} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
