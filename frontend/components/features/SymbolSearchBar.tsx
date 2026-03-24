"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { searchStocks, type StockLookupItem } from "@/lib/api";

type AssetGroup = "KOSPI" | "KOSDAQ" | "ETF" | "STOCK";
type MarketType = "DOMESTIC" | "INTERNATIONAL";

function getScopeLabel(stock: StockLookupItem) {
  const marketLabel = stock.marketType === "DOMESTIC" ? "국내" : "해외";
  return `${marketLabel} · ${stock.exchange}`;
}

function isDirectSymbolCandidate(value: string) {
  return /^[A-Z0-9][A-Z0-9.-]{0,24}$/.test(value);
}

export function SymbolSearchBar({
  title,
  description,
  busy,
  activeSymbol,
  onSearch,
  onReset,
}: {
  title: string;
  description: string;
  busy?: boolean;
  activeSymbol?: string | null;
  onSearch: (symbol: string | null) => Promise<void> | void;
  onReset: () => Promise<void> | void;
}) {
  const [query, setQuery] = useState(activeSymbol ?? "");
  const [marketType, setMarketType] = useState<MarketType | "ALL">("ALL");
  const [assetGroup, setAssetGroup] = useState<AssetGroup | "ALL">("ALL");
  const [suggestions, setSuggestions] = useState<StockLookupItem[]>([]);
  const [selected, setSelected] = useState<StockLookupItem | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    if (selected && selected.symbol === deferredQuery.trim().toUpperCase()) {
      return;
    }
    if (!deferredQuery.trim()) {
      return;
    }

    let mounted = true;
    searchStocks({
      query: deferredQuery.trim(),
      marketType: marketType === "ALL" ? undefined : marketType,
      assetGroup: assetGroup === "ALL" ? undefined : assetGroup,
      limit: 10,
    })
      .then((items) => {
        if (mounted) {
          setSuggestions(items);
        }
      })
      .catch(() => {
        if (mounted) {
          setSuggestions([]);
        }
      });

    return () => {
      mounted = false;
    };
  }, [assetGroup, deferredQuery, marketType, selected]);

  const resolvedSymbol = useMemo(() => {
    const trimmed = query.trim();
    if (selected) {
      return selected.symbol;
    }
    if (!trimmed) {
      return null;
    }
    const normalized = trimmed.toUpperCase();
    const exactSuggestion = suggestions.find((item) => item.symbol.toUpperCase() === normalized);
    if (exactSuggestion) {
      return exactSuggestion.symbol;
    }
    if (/^\d{6}$/.test(normalized)) {
      const domesticMatch = suggestions.find((item) => item.symbol.toUpperCase().startsWith(`${normalized}.`));
      if (domesticMatch) {
        return domesticMatch.symbol;
      }
    }
    if (suggestions.length === 1) {
      return suggestions[0].symbol;
    }
    return isDirectSymbolCandidate(normalized) ? normalized : null;
  }, [query, selected, suggestions]);

  return (
    <div className="rounded-md border border-[rgba(15,23,42,0.08)] bg-white px-4 py-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[13px] font-semibold text-[color:var(--fg)]">{title}</p>
          <p className="mt-1 text-[12px] text-[color:var(--fg-muted)]">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeSymbol ? (
            <span className="inline-flex h-8 items-center rounded-md border border-[rgba(59,130,246,0.2)] bg-[rgba(59,130,246,0.08)] px-3 text-[12px] font-semibold text-[color:var(--kpi)]">
              현재 분석: {activeSymbol}
            </span>
          ) : (
            <span className="inline-flex h-8 items-center rounded-md border border-[rgba(15,23,42,0.08)] bg-[#f8fafc] px-3 text-[12px] text-[color:var(--fg-muted)]">
              현재 분석: 전체 시장
            </span>
          )}
          <PrimaryButton type="button" label={busy ? "분석 중" : "분석 실행"} icon="search" disabled={busy || !resolvedSymbol} onClick={() => onSearch(resolvedSymbol)} />
          <SecondaryButton type="button" label="전체 보기" icon="refresh" disabled={busy} onClick={() => {
            setSelected(null);
            setQuery("");
            setSuggestions([]);
            void onReset();
          }} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1.8fr_0.7fr_0.7fr]">
        <div className="relative">
          <input
            value={query}
            onChange={(event) => {
              const nextValue = event.target.value;
              setQuery(nextValue);
              setSelected(null);
              if (!nextValue.trim()) {
                setSuggestions([]);
              }
            }}
            placeholder="티커 또는 회사명을 입력하세요"
            className="w-full rounded-md border border-[rgba(15,23,42,0.12)] bg-white px-3 py-2 text-[13px] text-[color:var(--fg)]"
          />
          {suggestions.length > 0 && !selected ? (
            <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-md border border-[rgba(15,23,42,0.08)] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
              {suggestions.map((item) => (
                <button
                  key={`${item.symbol}-${item.exchange}`}
                  type="button"
                  onClick={() => {
                    setSelected(item);
                    setQuery(item.symbol);
                    setSuggestions([]);
                  }}
                  className="block w-full border-b border-[rgba(15,23,42,0.06)] px-3 py-3 text-left last:border-b-0 hover:bg-[#f8fbff]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[color:var(--fg)]">{item.symbol}</p>
                      <p className="mt-1 truncate text-[12px] text-[color:var(--fg-muted)]">{item.name}</p>
                    </div>
                    <p className="text-[11px] text-[color:var(--fg-muted)]">{getScopeLabel(item)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <select
          value={marketType}
          onChange={(event) => setMarketType(event.target.value as MarketType | "ALL")}
          className="w-full rounded-md border border-[rgba(15,23,42,0.12)] bg-white px-3 py-2 text-[13px] text-[color:var(--fg)]"
        >
          <option value="ALL">전체 시장</option>
          <option value="DOMESTIC">국내주식</option>
          <option value="INTERNATIONAL">해외주식</option>
        </select>

        <select
          value={assetGroup}
          onChange={(event) => setAssetGroup(event.target.value as AssetGroup | "ALL")}
          className="w-full rounded-md border border-[rgba(15,23,42,0.12)] bg-white px-3 py-2 text-[13px] text-[color:var(--fg)]"
        >
          <option value="ALL">전체 자산군</option>
          <option value="KOSPI">코스피</option>
          <option value="KOSDAQ">코스닥</option>
          <option value="ETF">ETF</option>
          <option value="STOCK">일반주식</option>
        </select>
      </div>

      <p className="mt-3 text-[11px] text-[color:var(--fg-muted)]">
        회사명 검색은 자동완성 목록에서 종목을 선택한 뒤 실행하세요. 티커를 직접 입력할 때만 바로 분석할 수 있습니다.
      </p>
    </div>
  );
}
