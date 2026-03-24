"use client";

import { useDeferredValue, useEffect, useState } from "react";
import type { PortfolioListItem, StockLookupItem } from "@/lib/api";
import { registerStockSymbol, searchStocks } from "@/lib/api";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

const domesticGroups = [
  { value: "KOSPI", label: "코스피" },
  { value: "KOSDAQ", label: "코스닥" },
  { value: "ETF", label: "ETF" },
] as const;

const internationalGroups = [
  { value: "STOCK", label: "일반주식" },
  { value: "ETF", label: "ETF" },
] as const;

function getMarketTypeLabel(value: "DOMESTIC" | "INTERNATIONAL") {
  return value === "DOMESTIC" ? "국내주식" : "해외주식";
}

function getAssetGroupLabel(value: StockLookupItem["assetGroup"]) {
  switch (value) {
    case "KOSPI":
      return "코스피";
    case "KOSDAQ":
      return "코스닥";
    case "ETF":
      return "ETF";
    default:
      return "일반주식";
  }
}

export function AssetForm({
  portfolios,
  onSubmit,
}: {
  portfolios: PortfolioListItem[];
  onSubmit: (payload: { portfolioId: number; symbol: string; quantity: number; avgPrice: number }) => Promise<void>;
}) {
  const [portfolioId, setPortfolioId] = useState(portfolios[0]?.portfolioId ?? 0);
  const [marketType, setMarketType] = useState<"DOMESTIC" | "INTERNATIONAL">("DOMESTIC");
  const [assetGroup, setAssetGroup] = useState<"KOSPI" | "KOSDAQ" | "ETF" | "STOCK">("KOSPI");
  const [query, setQuery] = useState("");
  const [selectedStock, setSelectedStock] = useState<StockLookupItem | null>(null);
  const [suggestions, setSuggestions] = useState<StockLookupItem[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [registeringSymbol, setRegisteringSymbol] = useState(false);
  const [quantity, setQuantity] = useState("10");
  const [avgPrice, setAvgPrice] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    if (selectedStock && deferredQuery.trim() === selectedStock.symbol) {
      return;
    }

    const trimmed = deferredQuery.trim();
    if (trimmed.length < 1) {
      return;
    }

    let mounted = true;

    searchStocks({
      query: trimmed,
      marketType,
      assetGroup,
      limit: 20,
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
      })
      .finally(() => {
        if (mounted) {
          setLoadingSuggestions(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [assetGroup, deferredQuery, marketType, selectedStock]);

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!selectedStock) {
          setError("심볼을 검색 목록에서 선택하세요.");
          return;
        }

        setSubmitting(true);
        setMessage(null);
        setError(null);
        try {
          await onSubmit({
            portfolioId,
            symbol: selectedStock.symbol,
            quantity: Number(quantity),
            avgPrice: Number(avgPrice),
          });
          setSelectedStock(null);
          setSuggestions([]);
          setQuery("");
          setQuantity("10");
          setAvgPrice("0");
          setMessage("자산이 포트폴리오에 등록되었습니다.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "자산 등록에 실패했습니다.");
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <label className="space-y-1.5">
        <span className="text-[12px] font-semibold text-[color:var(--fg)]">포트폴리오</span>
        <select
          value={portfolioId}
          onChange={(event) => setPortfolioId(Number(event.target.value))}
          className="w-full rounded-md border border-[rgba(15,23,42,0.12)] bg-white px-3 py-2 text-[13px] text-[color:var(--fg)]"
        >
          {portfolios.map((portfolio) => (
            <option key={portfolio.portfolioId} value={portfolio.portfolioId}>
              {portfolio.name}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1.5">
        <span className="text-[12px] font-semibold text-[color:var(--fg)]">시장 구분</span>
        <select
          value={marketType}
          onChange={(event) => {
            const nextMarketType = event.target.value as "DOMESTIC" | "INTERNATIONAL";
            setMarketType(nextMarketType);
            setAssetGroup(nextMarketType === "DOMESTIC" ? "KOSPI" : "STOCK");
            setSelectedStock(null);
            setSuggestions([]);
            setQuery("");
            setLoadingSuggestions(false);
            setRegisteringSymbol(false);
          }}
          className="w-full rounded-md border border-[rgba(15,23,42,0.12)] bg-white px-3 py-2 text-[13px] text-[color:var(--fg)]"
        >
          <option value="DOMESTIC">국내주식</option>
          <option value="INTERNATIONAL">해외주식</option>
        </select>
      </label>

      <label className="space-y-1.5">
        <span className="text-[12px] font-semibold text-[color:var(--fg)]">세부 구분</span>
        <select
          value={assetGroup}
          onChange={(event) => {
            setAssetGroup(event.target.value as "KOSPI" | "KOSDAQ" | "ETF" | "STOCK");
            setSelectedStock(null);
            setSuggestions([]);
            setQuery("");
            setLoadingSuggestions(false);
            setRegisteringSymbol(false);
          }}
          className="w-full rounded-md border border-[rgba(15,23,42,0.12)] bg-white px-3 py-2 text-[13px] text-[color:var(--fg)]"
        >
          {(marketType === "DOMESTIC" ? domesticGroups : internationalGroups).map((group) => (
            <option key={group.value} value={group.value}>
              {group.label}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-1.5">
        <span className="text-[12px] font-semibold text-[color:var(--fg)]">심볼 검색</span>
        <div className="relative">
          <input
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              setSelectedStock(null);
              setError(null);
              setSuggestions(nextQuery.trim() ? suggestions : []);
              setLoadingSuggestions(Boolean(nextQuery.trim()));
            }}
            className="w-full rounded-md border border-[rgba(15,23,42,0.12)] bg-white px-3 py-2 text-[13px] text-[color:var(--fg)]"
            placeholder="심볼 또는 종목명을 입력하세요"
            required
          />

          {!selectedStock && (deferredQuery.trim().length > 0 || loadingSuggestions) ? (
            <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-md border border-[rgba(15,23,42,0.08)] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
              {loadingSuggestions ? (
                <div className="px-3 py-3 text-[12px] text-[color:var(--fg-muted)]">종목을 검색하고 있습니다.</div>
              ) : suggestions.length > 0 ? (
                suggestions.map((item) => (
                  <button
                    key={`${item.symbol}-${item.exchange}`}
                    type="button"
                    onClick={() => {
                      setSelectedStock(item);
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
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--fg-muted)]">
                          {getMarketTypeLabel(item.marketType)}
                        </p>
                        <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{getAssetGroupLabel(item.assetGroup)}</p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="space-y-3 px-3 py-3">
                  <p className="text-[12px] text-[color:var(--fg-muted)]">
                    일치하는 종목이 없습니다. 전체 심볼을 미리 적재하지 않고 필요 심볼만 등록하는 방식으로 운영합니다.
                  </p>
                  <PrimaryButton
                    type="button"
                    label={registeringSymbol ? "심볼 등록 중" : `심볼 직접 등록: ${query.trim().toUpperCase()}`}
                    icon="plus"
                    disabled={registeringSymbol || !query.trim()}
                    onClick={async () => {
                      const symbol = query.trim().toUpperCase();
                      if (!symbol) {
                        return;
                      }
                      setRegisteringSymbol(true);
                      setError(null);
                      setMessage(null);
                      try {
                        const created = await registerStockSymbol({
                          symbol,
                          marketType,
                          assetGroup,
                          period: "5y",
                          interval: "1d",
                        });
                        setSelectedStock(created);
                        setQuery(created.symbol);
                        setSuggestions([]);
                        setMessage(`${created.symbol} 종목 마스터를 등록했습니다. 이제 자산으로 추가할 수 있습니다.`);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "심볼 등록에 실패했습니다.");
                      } finally {
                        setRegisteringSymbol(false);
                      }
                    }}
                  />
                </div>
              )}
            </div>
          ) : null}
        </div>
        {selectedStock ? (
          <div className="rounded-md border border-[rgba(15,23,42,0.08)] bg-[#f8fbff] px-3 py-2">
            <p className="text-[12px] font-semibold text-[color:var(--fg)]">{selectedStock.symbol} · {selectedStock.name}</p>
            <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">
              {getMarketTypeLabel(selectedStock.marketType)} / {getAssetGroupLabel(selectedStock.assetGroup)} / {selectedStock.exchange}
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-[color:var(--fg-muted)]">한 글자 이상 입력하면 종목 마스터에서 최대 20개를 추천하고, 없으면 바로 심볼을 등록할 수 있습니다.</p>
        )}
      </div>

      <label className="space-y-1.5">
        <span className="text-[12px] font-semibold text-[color:var(--fg)]">수량</span>
        <input
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          type="number"
          min="0.0001"
          step="0.0001"
          className="w-full rounded-md border border-[rgba(15,23,42,0.12)] bg-white px-3 py-2 text-[13px] text-[color:var(--fg)]"
          required
        />
      </label>

      <label className="space-y-1.5">
        <span className="text-[12px] font-semibold text-[color:var(--fg)]">평균 단가</span>
        <input
          value={avgPrice}
          onChange={(event) => setAvgPrice(event.target.value)}
          type="number"
          min="0"
          step="0.0001"
          className="w-full rounded-md border border-[rgba(15,23,42,0.12)] bg-white px-3 py-2 text-[13px] text-[color:var(--fg)]"
          required
        />
      </label>

      <div className="md:col-span-2 flex items-center justify-between gap-3 rounded-md border border-[rgba(15,23,42,0.08)] bg-[#f8fbff] px-3 py-3">
        <div>
          {message ? <p className="text-[12px] text-[color:var(--buy)]">{message}</p> : null}
          {error ? <p className="text-[12px] text-[color:var(--sell)]">{error}</p> : null}
          {!message && !error ? <p className="text-[12px] text-[color:var(--fg-muted)]">검색 결과에서 선택하는 것이 기본이며, 미등록 심볼은 이 화면에서 온디맨드로 등록합니다.</p> : null}
        </div>
        <PrimaryButton type="submit" label={submitting ? "등록 중" : "자산 등록"} icon="play" disabled={submitting || registeringSymbol || !portfolioId || !selectedStock} />
      </div>
    </form>
  );
}
