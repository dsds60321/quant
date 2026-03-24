"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { MarketCandle } from "@/lib/api";
import { useChartPointerInteraction, useNonPassiveWheel, useWheelZoomWindow } from "@/lib/chart-zoom";

function formatPrice(value: number) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(value);
}

function formatVolume(value: number) {
  return new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatDateLabel(value: string, range: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  if (range === "1년") {
    return `${date.getFullYear()}.${date.getMonth() + 1}`;
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function MarketCandlestickChart({
  candles,
  rangeCandles,
  ranges,
  activeRange,
  onRangeChange,
}: {
  candles?: MarketCandle[] | null;
  rangeCandles?: Record<string, MarketCandle[]>;
  ranges?: string[];
  activeRange?: string;
  onRangeChange?: (range: string) => void;
}) {
  const safeRanges = Array.isArray(ranges) && ranges.length > 0 ? ranges : ["5일"];
  const [internalRange, setInternalRange] = useState(activeRange ?? safeRanges[0] ?? "5일");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const selectedRange = activeRange ?? internalRange;

  const normalizedCandles = useMemo(
    () =>
      (Array.isArray(candles) ? candles : []).filter(
        (item): item is MarketCandle =>
          Boolean(item)
          && typeof item.date === "string"
          && [item.open, item.high, item.low, item.close, item.volume].every((value) => typeof value === "number" && Number.isFinite(value)),
      ),
    [candles],
  );

  const activeCandles = useMemo(() => {
    const ranged = selectedRange && rangeCandles && Array.isArray(rangeCandles[selectedRange]) ? rangeCandles[selectedRange] : undefined;
    const normalizedRanged = (ranged ?? []).filter(
      (item): item is MarketCandle =>
        Boolean(item)
        && typeof item.date === "string"
        && [item.open, item.high, item.low, item.close, item.volume].every((value) => typeof value === "number" && Number.isFinite(value)),
    );
    if (normalizedRanged.length > 0) {
      return normalizedRanged;
    }
    return normalizedCandles;
  }, [selectedRange, normalizedCandles, rangeCandles]);

  const zoomKey = useMemo(
    () => `${selectedRange}:${activeCandles[0]?.date ?? "empty"}:${activeCandles[activeCandles.length - 1]?.date ?? "empty"}:${activeCandles.length}`,
    [activeCandles, selectedRange],
  );

  const {
    visibleItems: visibleCandles,
    visibleStart,
    totalCount,
    visibleCount,
    isZoomed,
    handleWheel,
    setWindowStart,
  } = useWheelZoomWindow(activeCandles, hoveredIndex, 10, zoomKey);
  const wheelTargetRef = useNonPassiveWheel<HTMLDivElement>(handleWheel);

  const {
    crosshairY,
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handlePointerLeave,
  } = useChartPointerInteraction({
    setHoveredIndex,
    totalCount,
    visibleCount,
    visibleStart,
    setWindowStart,
  });

  function handleRangeChange(range: string) {
    if (onRangeChange) {
      onRangeChange(range);
      setHoveredIndex(null);
      return;
    }
    setInternalRange(range);
    setHoveredIndex(null);
  }

  if (activeCandles.length === 0) {
    return (
      <div className="rounded-md border border-[color:rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Icon name="spark" className="h-3.5 w-3.5 text-[color:var(--kpi)]" />
              <h3 className="text-[14px] font-semibold text-[color:var(--fg)]">캔들 차트</h3>
            </div>
            <p className="mt-1 text-[12px] text-[color:var(--fg-muted)]">차트 데이터가 아직 없습니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {safeRanges.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => handleRangeChange(range)}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
                  selectedRange === range
                    ? "border-[color:var(--kpi)] bg-blue-50 text-[color:var(--kpi)]"
                    : "border-[color:rgba(15,23,42,0.08)] bg-white text-[color:var(--fg-muted)]"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-[color:rgba(15,23,42,0.08)] bg-white/70 text-[12px] text-[color:var(--fg-muted)]">
          표시할 시계열이 없습니다.
        </div>
      </div>
    );
  }

  const activeLocalIndex = hoveredIndex !== null && hoveredIndex >= visibleStart && hoveredIndex < visibleStart + visibleCandles.length
    ? hoveredIndex - visibleStart
    : visibleCandles.length - 1;
  const activeCandle = visibleCandles[Math.min(activeLocalIndex, Math.max(visibleCandles.length - 1, 0))];
  const priceHigh = Math.max(...visibleCandles.map((item) => item.high));
  const priceLow = Math.min(...visibleCandles.map((item) => item.low));
  const volumeHigh = Math.max(...visibleCandles.map((item) => item.volume), 1);
  const pricePadding = (priceHigh - priceLow) * 0.08 || priceHigh * 0.04 || 1;
  const baseScaledHigh = priceHigh + pricePadding;
  const baseScaledLow = priceLow - pricePadding;
  const lastClose = visibleCandles[visibleCandles.length - 1]?.close ?? 0;
  const isLastUp = (visibleCandles[visibleCandles.length - 1]?.close ?? 0) >= (visibleCandles[visibleCandles.length - 1]?.open ?? 0);
  const priceTop = 6;
  const priceBottom = 70;
  const volumeTop = 76;
  const volumeBottom = 94;
  const scaledHigh = baseScaledHigh;
  const scaledLow = baseScaledLow;
  const priceTicks = Array.from({ length: 5 }, (_, index) => scaledHigh - ((scaledHigh - scaledLow) / 4) * index);
  const xLabelIndices = Array.from(new Set([
    0,
    Math.floor((visibleCandles.length - 1) * 0.25),
    Math.floor((visibleCandles.length - 1) * 0.5),
    Math.floor((visibleCandles.length - 1) * 0.75),
    Math.max(visibleCandles.length - 1, 0),
  ]));
  const priceRange = scaledHigh - scaledLow || 1;
  const mapPriceY = (price: number) => priceTop + ((scaledHigh - price) / priceRange) * (priceBottom - priceTop);
  const invertPriceY = (y: number) => scaledHigh - ((y - priceTop) / (priceBottom - priceTop || 1)) * priceRange;
  const mapVolumeY = (volume: number) => volumeBottom - (volume / volumeHigh) * (volumeBottom - volumeTop);
  const geometry = visibleCandles.map((item, index) => {
    const centerX = index + 0.5;
    const openY = mapPriceY(item.open);
    const closeY = mapPriceY(item.close);
    const highY = mapPriceY(item.high);
    const lowY = mapPriceY(item.low);
    const candleTop = Math.min(openY, closeY);
    const candleHeight = Math.max(Math.abs(closeY - openY), 0.9);
    const volumeY = mapVolumeY(item.volume);
    const up = item.close >= item.open;
    return {
      date: item.date,
      globalIndex: visibleStart + index,
      centerX,
      openY,
      closeY,
      highY,
      lowY,
      candleTop,
      candleHeight,
      volumeY,
      up,
    };
  });
  const crosshairGeometry = hoveredIndex !== null ? geometry[Math.min(activeLocalIndex, Math.max(geometry.length - 1, 0))] ?? null : null;
  const crosshairLineY = crosshairY == null ? null : Math.min(Math.max(crosshairY, priceTop), priceBottom);
  const crosshairValue = crosshairLineY == null ? null : invertPriceY(crosshairLineY);
  const crosshairLeft = crosshairGeometry == null
    ? 0
    : geometry.length <= 1
      ? 50
      : (activeLocalIndex / (geometry.length - 1)) * 100;

  return (
    <div className="rounded-md border border-[color:rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Icon name="spark" className="h-3.5 w-3.5 text-[color:var(--kpi)]" />
            <h3 className="text-[14px] font-semibold text-[color:var(--fg)]">캔들 차트</h3>
          </div>
          {activeCandle ? (
            <p className="mt-1 text-[12px] text-[color:var(--fg-muted)]">
              시 {formatPrice(activeCandle.open)} · 고 {formatPrice(activeCandle.high)} · 저 {formatPrice(activeCandle.low)} · 종 {formatPrice(activeCandle.close)} · 거래량 {formatVolume(activeCandle.volume)}
              {isZoomed ? ` · 확대 ${visibleCount}/${totalCount}` : " · 휠 확대"}
              {" · 좌우 드래그"}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {safeRanges.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => handleRangeChange(range)}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
                selectedRange === range
                  ? "border-[color:var(--kpi)] bg-blue-50 text-[color:var(--kpi)]"
                  : "border-[color:rgba(15,23,42,0.08)] bg-white text-[color:var(--fg-muted)]"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={wheelTargetRef}
        className="relative overflow-hidden rounded-md border border-[color:rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,#fbfcff,#ffffff)] pr-16 select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        style={{ cursor: isDragging ? "grabbing" : isZoomed ? "grab" : "crosshair", touchAction: "none" }}
      >
        <svg viewBox={`0 0 ${Math.max(visibleCandles.length, 1)} 100`} preserveAspectRatio="none" className="h-72 w-full">
          {priceTicks.map((tick) => {
            const y = 6 + ((scaledHigh - tick) / (scaledHigh - scaledLow || 1)) * (70 - 6);
            return (
              <line key={`price-grid-${tick}`} x1="0" x2={Math.max(visibleCandles.length, 1)} y1={y} y2={y} stroke="rgba(15,23,42,0.08)" strokeWidth="0.35" />
            );
          })}

          {xLabelIndices.map((index) => (
            <line
              key={`x-grid-${index}`}
              x1={index + 0.5}
              x2={index + 0.5}
              y1="4"
              y2="94"
              stroke="rgba(15,23,42,0.05)"
              strokeWidth="0.35"
            />
          ))}

          {geometry.map((item, index) => (
            <g key={`candle-${item.date ?? index}`}>
              <line
                x1={item.centerX}
                x2={item.centerX}
                y1={item.highY}
                y2={item.lowY}
                stroke={item.up ? "#d85f4b" : "#3f72e8"}
                strokeWidth="0.14"
              />
              <rect
                x={item.centerX - 0.32}
                y={item.candleTop}
                width={0.64}
                height={item.candleHeight}
                fill={item.up ? "#d85f4b" : "#3f72e8"}
                opacity={hoveredIndex === item.globalIndex ? 1 : 0.92}
                rx={0.04}
              />
              <rect
                x={item.centerX - 0.32}
                y={item.volumeY}
                width={0.64}
                height={94 - item.volumeY}
                fill={item.up ? "rgba(216,95,75,0.42)" : "rgba(63,114,232,0.42)"}
                rx={0.04}
              />
            </g>
          ))}

          {crosshairGeometry && crosshairLineY != null ? (
            <>
              <line
                x1={crosshairGeometry.centerX}
                x2={crosshairGeometry.centerX}
                y1="4"
                y2="94"
                stroke="rgba(15,23,42,0.42)"
                strokeWidth="0.32"
                strokeDasharray="1 0.8"
              />
              <line
                x1="0"
                x2={Math.max(visibleCandles.length, 1)}
                y1={crosshairLineY}
                y2={crosshairLineY}
                stroke="rgba(15,23,42,0.42)"
                strokeWidth="0.32"
                strokeDasharray="1 0.8"
              />
            </>
          ) : null}

          <line
            x1="0"
            x2={Math.max(visibleCandles.length, 1)}
            y1={6 + ((scaledHigh - lastClose) / (scaledHigh - scaledLow || 1)) * (70 - 6)}
            y2={6 + ((scaledHigh - lastClose) / (scaledHigh - scaledLow || 1)) * (70 - 6)}
            stroke={isLastUp ? "rgba(216,95,75,0.65)" : "rgba(63,114,232,0.65)"}
            strokeWidth="0.28"
            strokeDasharray="1.2 0.8"
          />
        </svg>

        <div className="pointer-events-none absolute inset-y-0 right-0 flex w-16 flex-col justify-between border-l border-[color:rgba(15,23,42,0.06)] bg-white/85 px-2 py-4 text-right text-[11px] font-semibold text-[color:var(--fg-muted)]">
          {priceTicks.map((tick) => (
            <span key={`tick-label-${tick}`}>{formatPrice(tick)}</span>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-7 items-end px-2 pb-1 pr-16 text-[10px] font-semibold text-[color:var(--fg-muted)]">
          {xLabelIndices.map((index) => {
            const candle = visibleCandles[index];
            const left = visibleCandles.length <= 1 ? 0 : (index / (visibleCandles.length - 1)) * 100;
            return (
              <span key={`date-label-${index}`} className="absolute -translate-x-1/2" style={{ left: `calc(${left}% + 8px)` }}>
                {candle ? formatDateLabel(candle.date, selectedRange) : ""}
              </span>
            );
          })}
        </div>

        {crosshairGeometry && crosshairLineY != null && crosshairValue != null ? (
          <>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-16">
              <span
                className="absolute right-1 inline-flex -translate-y-1/2 rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white shadow-[0_10px_18px_rgba(15,23,42,0.18)]"
                style={{ top: `${crosshairLineY}%` }}
              >
                {formatPrice(crosshairValue)}
              </span>
            </div>
            <div className="pointer-events-none absolute bottom-0 left-0 right-16 h-7">
              <span
                className="absolute bottom-1 inline-flex -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white shadow-[0_10px_18px_rgba(15,23,42,0.18)]"
                style={{ left: `${crosshairLeft}%` }}
              >
                {formatDateLabel(activeCandle.date, selectedRange)}
              </span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
