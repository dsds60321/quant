"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { SignalOverlayMarker } from "@/lib/backtest-signal";
import { useChartPointerInteraction, useNonPassiveWheel, useWheelZoomWindow } from "@/lib/chart-zoom";
import { buildSyntheticCandles, buildValueTicks } from "@/lib/synthetic-candles";

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getMarkerColor(tone: SignalOverlayMarker["tone"]) {
  if (tone === "buy") {
    return "#16a34a";
  }
  if (tone === "sell") {
    return "#d85f4b";
  }
  return "#155eef";
}

function formatAxisValue(value: number) {
  const absolute = Math.abs(value);
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: absolute >= 1000 ? 0 : absolute >= 100 ? 1 : 2 }).format(value);
}

export function SignalOverlayChart({
  title,
  subtitle,
  points,
  markers,
  valueFormatter,
}: {
  title: string;
  subtitle?: string;
  points: Array<{ date: string; value: number }>;
  markers: SignalOverlayMarker[];
  valueFormatter?: (value: number) => string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const normalizedPoints = useMemo(
    () => points.filter((point) => typeof point.date === "string" && Number.isFinite(point.value)),
    [points],
  );

  const displayValue = valueFormatter ?? ((value: number) => new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(value));

  const fullCandles = useMemo(
    () =>
      buildSyntheticCandles(
        normalizedPoints.map((point) => ({
          label: point.date,
          value: point.value,
          meta: point,
        })),
      ),
    [normalizedPoints],
  );

  const zoomKey = useMemo(
    () => `${title}:${normalizedPoints[0]?.date ?? "empty"}:${normalizedPoints[normalizedPoints.length - 1]?.date ?? "empty"}:${normalizedPoints.length}`,
    [normalizedPoints, title],
  );

  const {
    visibleItems: visibleCandles,
    visibleStart,
    totalCount,
    visibleCount,
    isZoomed,
    handleWheel,
    setWindowStart,
  } = useWheelZoomWindow(fullCandles, hoveredIndex, 8, zoomKey);
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

  const chartData = useMemo(() => {
    if (visibleCandles.length === 0) {
      return {
        chartBottom: 86,
        chartTop: 8,
        geometry: [],
        invertY: (value: number) => value,
        markerMap: new Map<number, SignalOverlayMarker[]>(),
        labelIndices: [],
        priceTicks: [],
        lastClose: 0,
        mapY: (value: number) => value,
      };
    }

    const baseHigh = Math.max(...visibleCandles.map((item) => item.high));
    const baseLow = Math.min(...visibleCandles.map((item) => item.low));
    const padding = (baseHigh - baseLow) * 0.08 || Math.max(Math.abs(baseHigh) * 0.05, 1);
    const baseScaledHigh = baseHigh + padding;
    const baseScaledLow = baseLow - padding;
    const chartTop = 8;
    const chartBottom = 86;
    const scaledHigh = baseScaledHigh;
    const scaledLow = baseScaledLow;
    const range = scaledHigh - scaledLow || 1;
    const mapY = (price: number) => chartTop + ((scaledHigh - price) / range) * (chartBottom - chartTop);
    const invertY = (y: number) => scaledHigh - ((y - chartTop) / (chartBottom - chartTop || 1)) * range;
    const geometry = visibleCandles.map((item, index) => {
      const centerX = index + 0.5;
      const openY = mapY(item.open);
      const closeY = mapY(item.close);
      const highY = mapY(item.high);
      const lowY = mapY(item.low);
      return {
        ...item,
        index,
        globalIndex: visibleStart + index,
        centerX,
        openY,
        closeY,
        highY,
        lowY,
        candleTop: Math.min(openY, closeY),
        candleHeight: Math.max(Math.abs(closeY - openY), 0.9),
      };
    });

    const pointIndexByDate = new Map(geometry.map((point) => [point.label, point.index]));
    const indexedMarkers = markers
      .map((marker) => {
        const index = pointIndexByDate.get(marker.date);
        return index == null ? null : [index, marker] as const;
      })
      .filter((item): item is readonly [number, SignalOverlayMarker] => item != null);
    const limit = 18;
    const step = indexedMarkers.length > limit ? Math.ceil(indexedMarkers.length / limit) : 1;
    const markerMap = new Map<number, SignalOverlayMarker[]>();

    indexedMarkers.forEach(([index, marker], markerIndex) => {
      if (markerIndex % step !== 0 && markerIndex !== indexedMarkers.length - 1) {
        return;
      }
      const bucket = markerMap.get(index) ?? [];
      bucket.push(marker);
      markerMap.set(index, bucket);
    });

    return {
      chartBottom,
      chartTop,
      geometry,
      invertY,
      markerMap,
      labelIndices: Array.from(new Set([
        0,
        Math.floor((geometry.length - 1) * 0.25),
        Math.floor((geometry.length - 1) * 0.5),
        Math.floor((geometry.length - 1) * 0.75),
        Math.max(geometry.length - 1, 0),
      ])),
      priceTicks: buildValueTicks(scaledLow, scaledHigh),
      lastClose: geometry[geometry.length - 1]?.close ?? 0,
      mapY,
    };
  }, [markers, visibleCandles, visibleStart]);

  const activeIndex = hoveredIndex !== null && hoveredIndex >= visibleStart && hoveredIndex < visibleStart + chartData.geometry.length
    ? hoveredIndex - visibleStart
    : chartData.geometry.length - 1;
  const activePoint = chartData.geometry[activeIndex] ?? null;
  const activeMarkers = activeIndex >= 0 ? chartData.markerMap.get(activeIndex) ?? [] : [];
  const crosshairPoint = hoveredIndex !== null ? activePoint : null;
  const crosshairLineY = crosshairY == null
    ? null
    : Math.min(Math.max(crosshairY, chartData.chartTop), chartData.chartBottom);
  const crosshairValue = crosshairLineY == null ? null : chartData.invertY(crosshairLineY);
  const crosshairLeft = crosshairPoint == null
    ? 0
    : chartData.geometry.length <= 1
      ? 50
    : (activeIndex / (chartData.geometry.length - 1)) * 100;

  if (normalizedPoints.length === 0) {
    return (
      <div className="rounded-md border border-[color:rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <div className="flex items-center gap-2">
          <Icon name="spark" className="h-3.5 w-3.5 text-[color:var(--kpi)]" />
          <h3 className="text-[14px] font-semibold text-[color:var(--fg)]">{title}</h3>
        </div>
        <p className="mt-1 text-[12px] text-[color:var(--fg-muted)]">{subtitle ?? "오버레이할 시계열이 없습니다."}</p>
        <div className="mt-3 flex h-64 items-center justify-center rounded-md border border-dashed border-[color:rgba(15,23,42,0.08)] bg-white/70 text-[12px] text-[color:var(--fg-muted)]">
          표시할 백테스트 시계열이 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[color:rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Icon name="spark" className="h-3.5 w-3.5 text-[color:var(--kpi)]" />
            <h3 className="text-[14px] font-semibold text-[color:var(--fg)]">{title}</h3>
          </div>
          {subtitle ? <p className="mt-1 text-[12px] text-[color:var(--fg-muted)]">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
          {[
            ["BUY", "buy"],
            ["SELL", "sell"],
            ["HOLD", "hold"],
          ].map(([label, tone]) => (
            <span key={label} className="inline-flex items-center gap-1 rounded-full border border-[color:rgba(15,23,42,0.08)] bg-white px-2 py-1 text-[color:var(--fg-muted)]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getMarkerColor(tone as SignalOverlayMarker["tone"]) }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between rounded-md border border-[color:rgba(15,23,42,0.08)] bg-white px-3 py-2 text-[11px] text-[color:var(--fg-muted)]">
        <span className="inline-flex items-center gap-2 font-medium">
          <Icon name="status" className="h-3.5 w-3.5" />
          오버레이 포인트
        </span>
        <span className="font-semibold text-[color:var(--fg)]">
          {activePoint ? `${activePoint.label} · ${displayValue(activePoint.close)}` : "-"}
          {activeMarkers.length > 0 ? ` · ${activeMarkers.map((marker) => `${marker.label} ${marker.description}`).join(" / ")}` : ""}
          {isZoomed ? ` · 확대 ${visibleCount}/${totalCount}` : " · 휠 확대"}
          {" · 좌우 드래그"}
        </span>
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
        <svg viewBox={`0 0 ${Math.max(chartData.geometry.length, 1)} 100`} preserveAspectRatio="none" className="h-60 w-full">
          {chartData.priceTicks.map((tick) => (
            <line
              key={`grid-${tick}`}
              x1="0"
              x2={Math.max(chartData.geometry.length, 1)}
              y1={chartData.mapY(tick)}
              y2={chartData.mapY(tick)}
              stroke="rgba(15,23,42,0.08)"
              strokeWidth="0.35"
            />
          ))}

          {chartData.labelIndices.map((index) => (
            <line
              key={`x-grid-${index}`}
              x1={index + 0.5}
              x2={index + 0.5}
              y1="6"
              y2="88"
              stroke="rgba(15,23,42,0.05)"
              strokeWidth="0.35"
            />
          ))}

          {chartData.geometry.map((point) => {
            const pointMarkers = chartData.markerMap.get(point.index) ?? [];
            return (
              <g key={`${title}-point-${point.index}`}>
                {pointMarkers.length > 0 ? (
                  <line
                    x1={point.centerX}
                    x2={point.centerX}
                    y1="8"
                    y2="88"
                    stroke={getMarkerColor(pointMarkers[0]?.tone ?? "hold")}
                    strokeWidth="0.5"
                    strokeDasharray="1.2 1.2"
                    opacity="0.55"
                  />
                ) : null}
                <line
                  x1={point.centerX}
                  x2={point.centerX}
                  y1={point.highY}
                  y2={point.lowY}
                  stroke={point.up ? "#d85f4b" : "#3f72e8"}
                  strokeWidth="0.14"
                />
                <rect
                  x={point.centerX - 0.32}
                  y={point.candleTop}
                  width={0.64}
                  height={point.candleHeight}
                  fill={point.up ? "#d85f4b" : "#3f72e8"}
                  opacity={activePoint?.globalIndex === point.globalIndex ? 1 : 0.92}
                  rx={0.04}
                />
                {pointMarkers.slice(0, 2).map((marker, markerIndex) => (
                  <circle
                    key={marker.date + marker.label + markerIndex}
                    cx={point.centerX}
                    cy={Math.max(point.closeY - 3 - markerIndex * 3.5, 6)}
                    r={activeIndex === point.index ? 1.4 : 1.1}
                    fill={getMarkerColor(marker.tone)}
                    stroke="white"
                    strokeWidth="0.22"
                  />
                ))}
              </g>
            );
          })}

          {crosshairPoint && crosshairLineY != null ? (
            <>
              <line
                x1={crosshairPoint.centerX}
                x2={crosshairPoint.centerX}
                y1="4"
                y2="92"
                stroke="rgba(15,23,42,0.42)"
                strokeWidth="0.32"
                strokeDasharray="1 0.8"
              />
              <line
                x1="0"
                x2={Math.max(chartData.geometry.length, 1)}
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
            x2={Math.max(chartData.geometry.length, 1)}
            y1={chartData.mapY(chartData.lastClose)}
            y2={chartData.mapY(chartData.lastClose)}
            stroke="rgba(15,23,42,0.24)"
            strokeWidth="0.28"
            strokeDasharray="1.2 0.8"
          />
        </svg>

        <div className="pointer-events-none absolute inset-y-0 right-0 flex w-16 flex-col justify-between border-l border-[color:rgba(15,23,42,0.06)] bg-white/85 px-2 py-4 text-right text-[11px] font-semibold text-[color:var(--fg-muted)]">
          {chartData.priceTicks.map((tick) => (
            <span key={`tick-${tick}`}>{formatAxisValue(tick)}</span>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-7 items-end px-2 pb-1 pr-16 text-[10px] font-semibold text-[color:var(--fg-muted)]">
          {chartData.labelIndices.map((index) => {
            const point = chartData.geometry[index];
            const left = chartData.geometry.length <= 1 ? 0 : (index / (chartData.geometry.length - 1)) * 100;
            return (
              <span key={`${title}-label-${index}`} className="absolute -translate-x-1/2" style={{ left: `calc(${left}% + 8px)` }}>
                {point ? formatDateLabel(point.label) : ""}
              </span>
            );
          })}
        </div>

        {crosshairPoint && crosshairLineY != null && crosshairValue != null ? (
          <>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-16">
              <span
                className="absolute right-1 inline-flex -translate-y-1/2 rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white shadow-[0_10px_18px_rgba(15,23,42,0.18)]"
                style={{ top: `${crosshairLineY}%` }}
              >
                {displayValue(crosshairValue)}
              </span>
            </div>
            <div className="pointer-events-none absolute bottom-0 left-0 right-16 h-7">
              <span
                className="absolute bottom-1 inline-flex -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white shadow-[0_10px_18px_rgba(15,23,42,0.18)]"
                style={{ left: `${crosshairLeft}%` }}
              >
                {formatDateLabel(crosshairPoint.label)}
              </span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
