"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useChartPointerInteraction, useNonPassiveWheel, useWheelZoomWindow } from "@/lib/chart-zoom";
import { buildSyntheticCandles, buildValueTicks } from "@/lib/synthetic-candles";

function formatChartValue(value: number) {
  const absolute = Math.abs(value);
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: absolute >= 1000 ? 0 : absolute >= 100 ? 1 : 2,
  }).format(value);
}

function formatSignedValue(value: number, suffix = "") {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatChartValue(value)}${suffix}`;
}

function formatHeatValue(value: number) {
  return formatSignedValue((value - 0.5) * 200, "%");
}

function formatHeatDelta(value: number) {
  return formatSignedValue(value * 200, "%");
}

function buildBreakdownLabels(title: string, variant: "line" | "bars" | "donut" | "heatmap", count: number) {
  if (variant === "donut") {
    const portfolioLabels = ["주식", "ETF", "현금", "채권"];
    return Array.from({ length: count }, (_, index) => portfolioLabels[index] ?? `구성 ${index + 1}`);
  }
  if (variant === "heatmap") {
    return Array.from({ length: count }, (_, index) => `${title.replace(/\s+/g, "")} ${index + 1}`);
  }
  return Array.from({ length: count }, (_, index) => `구간 ${index + 1}`);
}

function getBreakdownTone(value: number, average: number, variant: "line" | "bars" | "donut" | "heatmap") {
  if (variant === "heatmap") {
    if (value >= 0.6) {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (value <= 0.4) {
      return "border-rose-200 bg-rose-50 text-rose-700";
    }
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (value >= average) {
    return "border-[rgba(216,95,75,0.18)] bg-[rgba(216,95,75,0.06)] text-[color:var(--sell)]";
  }
  return "border-[rgba(63,114,232,0.18)] bg-[rgba(63,114,232,0.06)] text-[color:var(--kpi)]";
}

export function ChartPanel({
  title,
  subtitle,
  series,
  rangeSeries,
  variant = "line",
  ranges = ["1개월", "3개월", "1년"],
}: {
  title: string;
  subtitle?: string;
  series: number[];
  rangeSeries?: Record<string, number[]>;
  variant?: "line" | "bars" | "donut" | "heatmap";
  ranges?: string[];
}) {
  const [interval, setInterval] = useState(ranges[0] ?? "1년");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const activeSeries = useMemo(() => {
    const rangedSeries = interval && rangeSeries ? rangeSeries[interval] : undefined;
    const nextSeries = rangedSeries && rangedSeries.length > 0 ? rangedSeries : series;
    return nextSeries.length > 0 ? nextSeries : [0];
  }, [interval, rangeSeries, series]);

  const average = useMemo(
    () => activeSeries.reduce((accumulator, value) => accumulator + value, 0) / activeSeries.length,
    [activeSeries],
  );

  const labels = useMemo(
    () => buildBreakdownLabels(title, variant, activeSeries.length),
    [activeSeries.length, title, variant],
  );

  const candleSeries = useMemo(
    () =>
      buildSyntheticCandles(
        activeSeries.map((value, index) => ({
          label: labels[index] ?? `구간 ${index + 1}`,
          value,
          meta: { index },
        })),
      ),
    [activeSeries, labels],
  );

  const zoomKey = useMemo(
    () => `${title}:${interval}:${candleSeries[0]?.label ?? "empty"}:${candleSeries[candleSeries.length - 1]?.label ?? "empty"}:${candleSeries.length}`,
    [candleSeries, interval, title],
  );

  const {
    visibleItems: visibleCandles,
    visibleStart,
    totalCount,
    visibleCount,
    isZoomed,
    handleWheel,
    setWindowStart,
  } = useWheelZoomWindow(candleSeries, hoveredIndex, variant === "donut" ? 3 : variant === "heatmap" ? 4 : 8, zoomKey);
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
        geometry: [],
        priceTicks: [],
        xLabelIndices: [],
        chartBottom: 84,
        chartTop: 8,
        invertY: (value: number) => value,
        scaledHigh: 0,
        scaledLow: 0,
        lastClose: 0,
        mapY: (value: number) => value,
      };
    }

    const baseHigh = Math.max(...visibleCandles.map((item) => item.high));
    const baseLow = Math.min(...visibleCandles.map((item) => item.low));
    const padding = (baseHigh - baseLow) * 0.08 || Math.max(Math.abs(baseHigh) * 0.06, 1);
    const baseScaledHigh = baseHigh + padding;
    const baseScaledLow = baseLow - padding;
    const chartTop = 8;
    const chartBottom = 84;
    const scaledHigh = baseScaledHigh;
    const scaledLow = baseScaledLow;
    const range = scaledHigh - scaledLow || 1;
    const mapY = (price: number) => chartTop + ((scaledHigh - price) / range) * (chartBottom - chartTop);
    const invertY = (y: number) => scaledHigh - ((y - chartTop) / (chartBottom - chartTop || 1)) * range;

    return {
      geometry: visibleCandles.map((item, index) => {
        const centerX = index + 0.5;
        const openY = mapY(item.open);
        const closeY = mapY(item.close);
        const highY = mapY(item.high);
        const lowY = mapY(item.low);
        return {
          ...item,
          globalIndex: visibleStart + index,
          centerX,
          openY,
          closeY,
          highY,
          lowY,
          candleTop: Math.min(openY, closeY),
          candleHeight: Math.max(Math.abs(closeY - openY), 0.9),
        };
      }),
      priceTicks: buildValueTicks(scaledLow, scaledHigh),
      xLabelIndices: Array.from(new Set([
        0,
        Math.floor((visibleCandles.length - 1) * 0.25),
        Math.floor((visibleCandles.length - 1) * 0.5),
        Math.floor((visibleCandles.length - 1) * 0.75),
        Math.max(visibleCandles.length - 1, 0),
      ])),
      chartBottom,
      chartTop,
      invertY,
      scaledHigh,
      scaledLow,
      lastClose: visibleCandles[visibleCandles.length - 1]?.close ?? 0,
      mapY,
    };
  }, [visibleCandles, visibleStart]);

  const activeIndex = hoveredIndex !== null && hoveredIndex >= visibleStart && hoveredIndex < visibleStart + chartData.geometry.length
    ? hoveredIndex - visibleStart
    : chartData.geometry.length - 1;
  const activeCandle = chartData.geometry[activeIndex] ?? null;
  const crosshairCandle = hoveredIndex !== null ? activeCandle : null;
  const crosshairLineY = crosshairY == null
    ? null
    : Math.min(Math.max(crosshairY, chartData.chartTop), chartData.chartBottom);
  const crosshairValue = crosshairLineY == null ? null : chartData.invertY(crosshairLineY);
  const crosshairLeft = crosshairCandle == null
    ? 0
    : chartData.geometry.length <= 1
      ? 50
    : (activeIndex / (chartData.geometry.length - 1)) * 100;

  const summary = useMemo(() => {
    if (!activeCandle) {
      return "-";
    }

    if (variant === "heatmap") {
      return `${activeCandle.label} · 감성 ${formatHeatValue(activeCandle.close)} · 변화 ${formatHeatDelta(activeCandle.close - activeCandle.open)}`;
    }

    if (variant === "donut") {
      return `${activeCandle.label} · 비중 ${formatChartValue(activeCandle.close)}%`;
    }

    return `${activeCandle.label} · 시 ${formatChartValue(activeCandle.open)} · 종 ${formatChartValue(activeCandle.close)} · 변화 ${formatSignedValue(activeCandle.close - activeCandle.open)}`;
  }, [activeCandle, variant]);

  const breakdownItems = useMemo(
    () =>
      activeSeries.map((value, index) => ({
        label: labels[index] ?? `구간 ${index + 1}`,
        value,
      })),
    [activeSeries, labels],
  );

  return (
    <div className="rounded-md border border-[color:rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] lg:p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Icon name="spark" className="h-3.5 w-3.5 text-[color:var(--kpi)]" />
            <h3 className="text-[14px] font-semibold text-[color:var(--fg)]">{title}</h3>
          </div>
          {subtitle ? <p className="mt-1 text-[12px] text-[color:var(--fg-muted)]">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {ranges.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => {
                setInterval(range);
                setHoveredIndex(null);
              }}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
                interval === range
                  ? "border-[color:var(--kpi)] bg-blue-50 text-[color:var(--kpi)]"
                  : "border-[color:rgba(15,23,42,0.08)] bg-white text-[color:var(--fg-muted)]"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between rounded-md border border-[color:rgba(15,23,42,0.08)] bg-white px-3 py-2 text-[11px] text-[color:var(--fg-muted)]">
        <span className="inline-flex items-center gap-2 font-medium">
          <Icon name="status" className="h-3.5 w-3.5" />
          캔들형 요약
        </span>
        <span className="font-semibold text-[color:var(--fg)]">
          {interval} · {summary}
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
        <svg viewBox={`0 0 ${Math.max(chartData.geometry.length, 1)} 100`} preserveAspectRatio="none" className="h-56 w-full">
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

          {chartData.xLabelIndices.map((index) => (
            <line
              key={`x-grid-${index}`}
              x1={index + 0.5}
              x2={index + 0.5}
              y1="6"
              y2="86"
              stroke="rgba(15,23,42,0.05)"
              strokeWidth="0.35"
            />
          ))}

          {chartData.geometry.map((item) => (
            <g key={`${title}-candle-${item.index}`}>
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
                opacity={activeCandle?.globalIndex === item.globalIndex ? 1 : 0.92}
                rx={0.04}
              />
            </g>
          ))}

          {crosshairCandle && crosshairLineY != null ? (
            <>
              <line
                x1={crosshairCandle.centerX}
                x2={crosshairCandle.centerX}
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
            <span key={`tick-${tick}`}>{variant === "heatmap" ? formatHeatValue(tick) : formatChartValue(tick)}</span>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-7 items-end px-2 pb-1 pr-16 text-[10px] font-semibold text-[color:var(--fg-muted)]">
          {chartData.xLabelIndices.map((index) => {
            const item = chartData.geometry[index];
            const left = chartData.geometry.length <= 1 ? 0 : (index / (chartData.geometry.length - 1)) * 100;
            return (
              <span key={`${title}-label-${index}`} className="absolute -translate-x-1/2" style={{ left: `calc(${left}% + 8px)` }}>
                {item ? index + 1 : ""}
              </span>
            );
          })}
        </div>

        {crosshairCandle && crosshairLineY != null && crosshairValue != null ? (
          <>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-16">
              <span
                className="absolute right-1 inline-flex -translate-y-1/2 rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white shadow-[0_10px_18px_rgba(15,23,42,0.18)]"
                style={{ top: `${crosshairLineY}%` }}
              >
                {variant === "heatmap" ? formatHeatValue(crosshairValue) : formatChartValue(crosshairValue)}
              </span>
            </div>
            <div className="pointer-events-none absolute bottom-0 left-0 right-16 h-7">
              <span
                className="absolute bottom-1 inline-flex -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white shadow-[0_10px_18px_rgba(15,23,42,0.18)]"
                style={{ left: `${crosshairLeft}%` }}
              >
                {crosshairCandle.label}
              </span>
            </div>
          </>
        ) : null}
      </div>

      {(variant === "donut" || variant === "heatmap") && breakdownItems.length > 0 ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {breakdownItems.map((item, index) => (
            <div
              key={`${title}-breakdown-${item.label}`}
              className={`rounded-md border px-3 py-2 text-[11px] ${getBreakdownTone(item.value, average, variant)}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{item.label}</span>
                <span>{variant === "heatmap" ? formatHeatValue(item.value) : `${formatChartValue(item.value)}%`}</span>
              </div>
              <p className="mt-1 opacity-75">{index + 1}번 캔들 기준</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
