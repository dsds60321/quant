"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { MarketCandle } from "@/lib/api";
import { useChartPointerInteraction, useNonPassiveWheel, useWheelZoomWindow } from "@/lib/chart-zoom";
import type { PatternLabChartMarker, PatternLabHoldingRange, PatternLabPriceLevel, PatternLabSignalZone, PatternLabZoneType } from "@/lib/pattern-lab";

function formatPrice(value: number) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(value);
}

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function movingAverage(values: number[], period: number) {
  return values.map((_, index) => {
    const start = Math.max(0, index - period + 1);
    const window = values.slice(start, index + 1);
    const average = window.reduce((sum, value) => sum + value, 0) / window.length;
    return Number.isFinite(average) ? average : 0;
  });
}

function toneColor(type: PatternLabChartMarker["signalType"] | PatternLabPriceLevel["tone"]) {
  if (type === "BUY" || type === "buy") {
    return "#16a34a";
  }
  if (type === "SELL" || type === "sell") {
    return "#d85f4b";
  }
  if (type === "HOLD" || type === "hold") {
    return "#155eef";
  }
  return "#64748b";
}

type PatternStyle = {
  accent: string;
  softFill: string;
  detectionFill: string;
  holdFill: string;
  bandFill: string;
};

const PATTERN_STYLE_MAP: Record<string, PatternStyle> = {
  "liquidity-sweep-reversal": {
    accent: "#b42318",
    softFill: "rgba(180,35,24,0.16)",
    detectionFill: "rgba(180,35,24,0.12)",
    holdFill: "rgba(180,35,24,0.08)",
    bandFill: "rgba(180,35,24,0.05)",
  },
  "imbalance-pullback-continuation": {
    accent: "#155eef",
    softFill: "rgba(21,94,239,0.16)",
    detectionFill: "rgba(21,94,239,0.12)",
    holdFill: "rgba(21,94,239,0.08)",
    bandFill: "rgba(21,94,239,0.05)",
  },
  "fifty-two-week-high": {
    accent: "#0f9d58",
    softFill: "rgba(15,157,88,0.16)",
    detectionFill: "rgba(15,157,88,0.12)",
    holdFill: "rgba(15,157,88,0.08)",
    bandFill: "rgba(15,157,88,0.05)",
  },
  "trendline-breakout": {
    accent: "#d97706",
    softFill: "rgba(217,119,6,0.16)",
    detectionFill: "rgba(217,119,6,0.12)",
    holdFill: "rgba(217,119,6,0.08)",
    bandFill: "rgba(217,119,6,0.05)",
  },
  "momentum-continuation": {
    accent: "#155eef",
    softFill: "rgba(21,94,239,0.16)",
    detectionFill: "rgba(21,94,239,0.12)",
    holdFill: "rgba(21,94,239,0.08)",
    bandFill: "rgba(21,94,239,0.05)",
  },
  "slope-angle-breakout": {
    accent: "#d85f4b",
    softFill: "rgba(216,95,75,0.16)",
    detectionFill: "rgba(216,95,75,0.12)",
    holdFill: "rgba(216,95,75,0.08)",
    bandFill: "rgba(216,95,75,0.05)",
  },
  "volatility-squeeze": {
    accent: "#0f766e",
    softFill: "rgba(15,118,110,0.16)",
    detectionFill: "rgba(15,118,110,0.12)",
    holdFill: "rgba(15,118,110,0.08)",
    bandFill: "rgba(15,118,110,0.05)",
  },
};

const FALLBACK_PATTERN_STYLES: PatternStyle[] = [
  { accent: "#0f9d58", softFill: "rgba(15,157,88,0.16)", detectionFill: "rgba(15,157,88,0.12)", holdFill: "rgba(15,157,88,0.08)", bandFill: "rgba(15,157,88,0.05)" },
  { accent: "#155eef", softFill: "rgba(21,94,239,0.16)", detectionFill: "rgba(21,94,239,0.12)", holdFill: "rgba(21,94,239,0.08)", bandFill: "rgba(21,94,239,0.05)" },
  { accent: "#d97706", softFill: "rgba(217,119,6,0.16)", detectionFill: "rgba(217,119,6,0.12)", holdFill: "rgba(217,119,6,0.08)", bandFill: "rgba(217,119,6,0.05)" },
  { accent: "#d85f4b", softFill: "rgba(216,95,75,0.16)", detectionFill: "rgba(216,95,75,0.12)", holdFill: "rgba(216,95,75,0.08)", bandFill: "rgba(216,95,75,0.05)" },
  { accent: "#0f766e", softFill: "rgba(15,118,110,0.16)", detectionFill: "rgba(15,118,110,0.12)", holdFill: "rgba(15,118,110,0.08)", bandFill: "rgba(15,118,110,0.05)" },
];

function hashPatternId(value: string) {
  return value.split("").reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0);
}

function getPatternStyle(patternId: string) {
  const direct = PATTERN_STYLE_MAP[patternId];
  if (direct) {
    return direct;
  }
  return FALLBACK_PATTERN_STYLES[hashPatternId(patternId) % FALLBACK_PATTERN_STYLES.length];
}

function zoneBandGeometry(zoneType: PatternLabZoneType, priceTop: number, priceBottom: number) {
  const fullHeight = priceBottom - priceTop;
  if (zoneType === "DETECTION") {
    return { y: priceTop + 1.2, height: Math.max(fullHeight * 0.12, 6) };
  }
  if (zoneType === "BUY") {
    return { y: priceTop + fullHeight * 0.18, height: Math.max(fullHeight * 0.14, 8) };
  }
  if (zoneType === "SELL") {
    const height = Math.max(fullHeight * 0.14, 8);
    return { y: priceBottom - height - 1.2, height };
  }
  return { y: priceTop, height: fullHeight };
}

function zoneFill(patternId: string, zoneType: PatternLabZoneType) {
  const style = getPatternStyle(patternId);
  if (zoneType === "DETECTION") {
    return style.detectionFill;
  }
  if (zoneType === "HOLD") {
    return style.holdFill;
  }
  return style.softFill;
}

function zoneDash(zoneType: PatternLabZoneType) {
  if (zoneType === "DETECTION") {
    return "0.8 0.6";
  }
  if (zoneType === "SELL") {
    return "1.4 0.8";
  }
  if (zoneType === "BUY") {
    return "1.2 0.7";
  }
  return "2.2 1.1";
}

type TooltipRow = {
  label: string;
  value: string;
};

export function PatternLabChart({
  title,
  subtitle,
  candles,
  markers,
  holdingRanges,
  zones,
  priceLevels,
  compact = false,
  showMovingAverage = true,
  showVolume = true,
  showSignalZones = true,
  showHoldingRanges = true,
  showPriceLevels = true,
  showPatternLegend = true,
}: {
  title: string;
  subtitle?: string;
  candles: MarketCandle[];
  markers: PatternLabChartMarker[];
  holdingRanges: PatternLabHoldingRange[];
  zones: PatternLabSignalZone[];
  priceLevels: PatternLabPriceLevel[];
  compact?: boolean;
  showMovingAverage?: boolean;
  showVolume?: boolean;
  showSignalZones?: boolean;
  showHoldingRanges?: boolean;
  showPriceLevels?: boolean;
  showPatternLegend?: boolean;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const [hoveredRangeId, setHoveredRangeId] = useState<string | null>(null);
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [hoveredLevelId, setHoveredLevelId] = useState<string | null>(null);

  const normalizedCandles = useMemo(
    () =>
      candles.filter(
        (item): item is MarketCandle =>
          Boolean(item)
          && typeof item.date === "string"
          && [item.open, item.high, item.low, item.close, item.volume].every((value) => typeof value === "number" && Number.isFinite(value)),
      ),
    [candles],
  );

  const zoomKey = useMemo(
    () => `${title}:${normalizedCandles[0]?.date ?? "empty"}:${normalizedCandles[normalizedCandles.length - 1]?.date ?? "empty"}:${normalizedCandles.length}:${compact ? "compact" : "full"}`,
    [compact, normalizedCandles, title],
  );

  const {
    visibleItems: visibleCandles,
    visibleStart,
    visibleEnd,
    totalCount,
    visibleCount,
    isZoomed,
    handleWheel,
    setWindowStart,
  } = useWheelZoomWindow(normalizedCandles, hoveredIndex, compact ? 18 : 30, zoomKey);
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
        chartBottom: showVolume ? 72 : 90,
        chartTop: 8,
        geometry: [],
        invertPriceY: (value: number) => value,
        ma20: [],
        ma60: [],
        markerMap: new Map<number, PatternLabChartMarker[]>(),
        holdRects: [] as Array<{ id: string; startX: number; width: number; openPosition: boolean; patternName: string }>,
        zoneRects: [] as Array<{
          id: string;
          startX: number;
          width: number;
          y: number;
          height: number;
          zoneType: PatternLabZoneType;
          patternId: string;
          patternName: string;
          label: string;
        }>,
        buyRangeBands: [] as Array<{
          id: string;
          patternId: string;
          patternName: string;
          y: number;
          height: number;
        }>,
        xLabelIndices: [],
        priceTicks: [],
        scaledHigh: 0,
        scaledLow: 0,
        lastClose: 0,
        volumeHigh: 1,
        mapPriceY: (value: number) => value,
      };
    }

    const resolveStartIndex = (date: string) => normalizedCandles.findIndex((item) => item.date >= date);
    const resolveEndIndex = (date: string) => {
      const found = normalizedCandles.findIndex((item) => item.date >= date);
      return found < 0 ? normalizedCandles.length - 1 : found;
    };

    const priceValues = [
      ...visibleCandles.flatMap((item) => [item.high, item.low]),
      ...priceLevels.map((item) => item.value),
    ].filter((value) => Number.isFinite(value));
    const priceHigh = Math.max(...priceValues);
    const priceLow = Math.min(...priceValues);
    const pricePadding = (priceHigh - priceLow) * 0.08 || priceHigh * 0.05 || 1;
    const baseScaledHigh = priceHigh + pricePadding;
    const baseScaledLow = Math.max(0, priceLow - pricePadding);
    const volumeHigh = Math.max(...visibleCandles.map((item) => item.volume), 1);
    const priceTop = 8;
    const priceBottom = showVolume ? 72 : 90;
    const volumeTop = 76;
    const volumeBottom = 94;
    const scaledHigh = baseScaledHigh;
    const scaledLow = baseScaledLow;
    const priceRange = scaledHigh - scaledLow || 1;
    const mapPriceY = (price: number) => priceTop + ((scaledHigh - price) / priceRange) * (priceBottom - priceTop);
    const invertPriceY = (y: number) => scaledHigh - ((y - priceTop) / (priceBottom - priceTop || 1)) * priceRange;
    const mapVolumeY = (volume: number) => volumeBottom - (volume / volumeHigh) * (volumeBottom - volumeTop);

    const geometry = visibleCandles.map((item, localIndex) => {
      const centerX = localIndex + 0.5;
      const openY = mapPriceY(item.open);
      const closeY = mapPriceY(item.close);
      const highY = mapPriceY(item.high);
      const lowY = mapPriceY(item.low);
      const candleTop = Math.min(openY, closeY);
      const candleHeight = Math.max(Math.abs(closeY - openY), 0.9);
      return {
        ...item,
        index: localIndex,
        globalIndex: visibleStart + localIndex,
        centerX,
        openY,
        closeY,
        highY,
        lowY,
        candleTop,
        candleHeight,
        volumeY: mapVolumeY(item.volume),
        up: item.close >= item.open,
      };
    });

    const closeSeries = normalizedCandles.map((item) => item.close);
    const ma20Series = movingAverage(closeSeries, 20);
    const ma60Series = movingAverage(closeSeries, 60);
    const ma20 = visibleCandles.map((_, localIndex) => ({
      x: geometry[localIndex]?.centerX ?? localIndex,
      y: mapPriceY(ma20Series[visibleStart + localIndex] ?? 0),
    }));
    const ma60 = visibleCandles.map((_, localIndex) => ({
      x: geometry[localIndex]?.centerX ?? localIndex,
      y: mapPriceY(ma60Series[visibleStart + localIndex] ?? 0),
    }));

    const markerMap = new Map<number, PatternLabChartMarker[]>();
    const markerLimit = compact ? 10 : 18;
    const markerSource = markers.slice(-markerLimit);
    for (const marker of markerSource) {
      const fullIndex = normalizedCandles.findIndex((item) => item.date === marker.date);
      if (fullIndex < visibleStart || fullIndex > visibleEnd) {
        continue;
      }
      const localIndex = fullIndex - visibleStart;
      const bucket = markerMap.get(localIndex) ?? [];
      bucket.push(marker);
      markerMap.set(localIndex, bucket);
    }

    const holdRects = showHoldingRanges
      ? holdingRanges
          .map((range) => {
            const startIndex = resolveStartIndex(range.startDate);
            if (startIndex < 0) {
              return null;
            }
            const resolvedEndIndex = Math.max(resolveEndIndex(range.endDate), startIndex);
            if (resolvedEndIndex < visibleStart || startIndex > visibleEnd) {
              return null;
            }
            const clippedStart = Math.max(startIndex, visibleStart);
            const clippedEnd = Math.min(resolvedEndIndex, visibleEnd);
            return {
              id: range.id,
              startX: clippedStart - visibleStart,
              width: Math.max(clippedEnd - clippedStart + 1, 1),
              openPosition: range.openPosition,
              patternName: range.patternName,
            };
          })
          .filter((item): item is { id: string; startX: number; width: number; openPosition: boolean; patternName: string } => item != null)
      : [];

    const zoneSource = showSignalZones
      ? zones
          .filter((zone) => showHoldingRanges || zone.zoneType !== "HOLD")
          .slice(-(compact ? 16 : 48))
      : [];
    const zoneRects = zoneSource
      .map((zone) => {
        const startIndex = resolveStartIndex(zone.startDate);
        if (startIndex < 0) {
          return null;
        }
        const resolvedEndIndex = Math.max(resolveEndIndex(zone.endDate), startIndex);
        if (resolvedEndIndex < visibleStart || startIndex > visibleEnd) {
          return null;
        }
        const clippedStart = Math.max(startIndex, visibleStart);
        const clippedEnd = Math.min(resolvedEndIndex, visibleEnd);
        const band = zoneBandGeometry(zone.zoneType, priceTop, priceBottom);
        return {
          id: zone.id,
          startX: clippedStart - visibleStart,
          width: Math.max(clippedEnd - clippedStart + 1, 1),
          y: band.y,
          height: band.height,
          zoneType: zone.zoneType,
          patternId: zone.patternId,
          patternName: zone.patternName,
          label: zone.label,
        };
      })
      .filter((item): item is {
        id: string;
        startX: number;
        width: number;
        y: number;
        height: number;
        zoneType: PatternLabZoneType;
        patternId: string;
        patternName: string;
        label: string;
      } => item != null);

    const buyRangeBands = showPriceLevels
      ? Array.from(new Set(priceLevels.map((level) => level.patternId)))
          .map((patternId) => {
            const low = priceLevels.find((level) => level.patternId === patternId && level.type === "buyRangeLow");
            const high = priceLevels.find((level) => level.patternId === patternId && level.type === "buyRangeHigh");
            if (!low || !high) {
              return null;
            }
            return {
              id: `${patternId}-buy-band`,
              patternId,
              patternName: low.patternName,
              y: mapPriceY(high.value),
              height: Math.max(mapPriceY(low.value) - mapPriceY(high.value), 0.8),
            };
          })
          .filter((item): item is { id: string; patternId: string; patternName: string; y: number; height: number } => item != null)
      : [];

    const priceTicks = Array.from({ length: 5 }, (_, index) => scaledHigh - ((scaledHigh - scaledLow) / 4) * index);
    const xLabelIndices = Array.from(new Set([
      0,
      Math.floor((visibleCandles.length - 1) * 0.25),
      Math.floor((visibleCandles.length - 1) * 0.5),
      Math.floor((visibleCandles.length - 1) * 0.75),
      Math.max(visibleCandles.length - 1, 0),
    ]));

    return {
      chartBottom: priceBottom,
      chartTop: priceTop,
      geometry,
      invertPriceY,
      ma20,
      ma60,
      markerMap,
      holdRects,
      zoneRects,
      buyRangeBands,
      xLabelIndices,
      priceTicks,
      scaledHigh,
      scaledLow,
      lastClose: visibleCandles[visibleCandles.length - 1]?.close ?? 0,
      volumeHigh,
      mapPriceY,
    };
  }, [compact, holdingRanges, markers, normalizedCandles, priceLevels, showHoldingRanges, showPriceLevels, showSignalZones, showVolume, visibleCandles, visibleEnd, visibleStart, zones]);

  const activeIndex = hoveredIndex !== null && hoveredIndex >= visibleStart && hoveredIndex < visibleStart + chartData.geometry.length
    ? hoveredIndex - visibleStart
    : chartData.geometry.length - 1;
  const activeCandle = chartData.geometry[activeIndex] ?? null;
  const crosshairCandle = hoveredIndex !== null ? activeCandle : null;
  const crosshairLineY = crosshairY == null
    ? null
    : Math.min(Math.max(crosshairY, chartData.chartTop), chartData.chartBottom);
  const crosshairValue = crosshairLineY == null ? null : chartData.invertPriceY(crosshairLineY);
  const crosshairLeft = crosshairCandle == null
    ? 0
    : chartData.geometry.length <= 1
      ? 50
    : (activeIndex / (chartData.geometry.length - 1)) * 100;
  const activeMarkers = useMemo(
    () => (activeIndex >= 0 ? chartData.markerMap.get(activeIndex) ?? [] : []),
    [activeIndex, chartData.markerMap],
  );
  const hoveredMarker = hoveredMarkerId ? markers.find((marker) => marker.id === hoveredMarkerId) ?? null : null;
  const hoveredRange = hoveredRangeId ? holdingRanges.find((range) => range.id === hoveredRangeId) ?? null : null;
  const hoveredZone = hoveredZoneId ? zones.find((zone) => zone.id === hoveredZoneId) ?? null : null;
  const hoveredLevel = hoveredLevelId ? priceLevels.find((level) => level.id === hoveredLevelId) ?? null : null;
  const referenceRecommendation = useMemo(() => {
    const openMarker = [...markers].reverse().find((marker) => marker.openPosition);
    return openMarker?.recommendation ?? markers[markers.length - 1]?.recommendation ?? null;
  }, [markers]);
  const heightClass = compact ? "h-56" : "h-[30rem]";
  const priceTop = 8;
  const priceBottom = showVolume ? 72 : 90;
  const visiblePatterns = useMemo(() => {
    const bucket = new Map<string, { patternId: string; patternName: string }>();
    for (const marker of markers) {
      bucket.set(marker.patternId, { patternId: marker.patternId, patternName: marker.patternName });
    }
    for (const zone of zones) {
      bucket.set(zone.patternId, { patternId: zone.patternId, patternName: zone.patternName });
    }
    for (const level of priceLevels) {
      bucket.set(level.patternId, { patternId: level.patternId, patternName: level.patternName });
    }
    return Array.from(bucket.values()).slice(0, compact ? 3 : 6);
  }, [compact, markers, priceLevels, zones]);

  const activeTooltip = useMemo(() => {
    if (hoveredMarker) {
      const recommendation = hoveredMarker.recommendation;
      const rows: TooltipRow[] = hoveredMarker.signalType === "BUY"
        ? [
            { label: "종목", value: title },
            { label: "패턴", value: hoveredMarker.patternName },
            { label: "신호 유형", value: "BUY" },
            { label: "신호 발생일", value: hoveredMarker.date },
            { label: "신호 가격", value: formatPrice(hoveredMarker.signalPrice) },
            { label: "실제 매수가", value: hoveredMarker.entryPrice == null ? formatPrice(recommendation.recommendedBuyPrice) : formatPrice(hoveredMarker.entryPrice) },
            { label: "권장 매수가", value: `${formatPrice(recommendation.entryRangeLow)} ~ ${formatPrice(recommendation.entryRangeHigh)}` },
            { label: "손절가", value: formatPrice(recommendation.stopPrice) },
            { label: "1차 목표가", value: formatPrice(recommendation.targetPrice1) },
            { label: "2차 목표가", value: formatPrice(recommendation.targetPrice2) },
            { label: "예상 권장 매도가", value: formatPrice(recommendation.recommendedSellPrice) },
            { label: "기대 수익률", value: `${formatPercent(recommendation.expectedReturnPercent)} / ${formatPercent(recommendation.expectedReturnPercent2)}` },
            { label: "기대 손익비", value: recommendation.riskReward.toFixed(2) },
            { label: "신호 발생 근거", value: hoveredMarker.signalReason },
          ]
        : hoveredMarker.signalType === "SELL"
          ? [
              { label: "종목", value: title },
              { label: "패턴", value: hoveredMarker.patternName },
              { label: "신호 유형", value: "SELL" },
              { label: "진입일", value: hoveredMarker.entryDate ?? "-" },
              { label: "청산일", value: hoveredMarker.exitDate ?? hoveredMarker.date },
              { label: "매수가", value: hoveredMarker.entryPrice == null ? "-" : formatPrice(hoveredMarker.entryPrice) },
              { label: "매도가", value: hoveredMarker.exitPrice == null ? formatPrice(hoveredMarker.signalPrice) : formatPrice(hoveredMarker.exitPrice) },
              { label: "실현 수익률", value: formatPercent(hoveredMarker.returnPercent) },
              { label: "청산 사유", value: hoveredMarker.exitReason ?? hoveredMarker.signalReason },
              { label: "보유일", value: hoveredMarker.holdingDays == null ? "-" : `${hoveredMarker.holdingDays}일` },
              { label: "MFE", value: formatPercent(hoveredMarker.mfePercent) },
              { label: "MAE", value: formatPercent(hoveredMarker.maePercent) },
            ]
          : [
              { label: "종목", value: title },
              { label: "패턴", value: hoveredMarker.patternName },
              { label: "현재 상태", value: "HOLD" },
              { label: "평균 매수가", value: hoveredMarker.entryPrice == null ? "-" : formatPrice(hoveredMarker.entryPrice) },
              { label: "현재가", value: activeCandle ? formatPrice(activeCandle.close) : "-" },
              { label: "현재 손익률", value: formatPercent(hoveredMarker.returnPercent ?? recommendation.expectedReturnPercent) },
              { label: "현재 손절가", value: formatPrice(recommendation.stopPrice) },
              { label: "현재 목표가", value: `${formatPrice(recommendation.targetPrice1)} / ${formatPrice(recommendation.targetPrice2)}` },
              { label: "예상 청산가", value: formatPrice(recommendation.expectedExitPrice) },
              { label: "보유 일수", value: hoveredMarker.holdingDays == null ? "-" : `${hoveredMarker.holdingDays}일` },
            ];
      return { title: hoveredMarker.label, rows, tone: toneColor(hoveredMarker.signalType) };
    }
    if (hoveredZone) {
      const recommendation = hoveredZone.recommendation;
      if (hoveredZone.zoneType === "BUY") {
        return {
          title: `${hoveredZone.patternName} BUY 구간`,
          tone: toneColor("BUY"),
          rows: [
            { label: "패턴명", value: hoveredZone.patternName },
            { label: "신호 유형", value: "BUY" },
            { label: "신호 발생일", value: hoveredZone.signalDate ?? hoveredZone.startDate },
            { label: "신호 가격", value: hoveredZone.signalPrice == null ? "-" : formatPrice(hoveredZone.signalPrice) },
            { label: "실제 매수가", value: hoveredZone.entryPrice == null ? "-" : formatPrice(hoveredZone.entryPrice) },
            { label: "권장 매수가 범위", value: recommendation ? `${formatPrice(recommendation.entryRangeLow)} ~ ${formatPrice(recommendation.entryRangeHigh)}` : "-" },
            { label: "손절가", value: recommendation ? formatPrice(recommendation.stopPrice) : "-" },
            { label: "1차 목표가", value: recommendation ? formatPrice(recommendation.targetPrice1) : "-" },
            { label: "2차 목표가", value: recommendation ? formatPrice(recommendation.targetPrice2) : "-" },
            { label: "예상 권장 매도가", value: recommendation ? formatPrice(recommendation.recommendedSellPrice) : "-" },
            { label: "기대 수익률", value: recommendation ? formatPercent(recommendation.expectedReturnPercent) : "-" },
            { label: "기대 손익비", value: recommendation ? recommendation.riskReward.toFixed(2) : "-" },
            { label: "신호 발생 근거", value: hoveredZone.reason },
          ],
        };
      }
      if (hoveredZone.zoneType === "SELL") {
        return {
          title: `${hoveredZone.patternName} SELL 구간`,
          tone: toneColor("SELL"),
          rows: [
            { label: "패턴명", value: hoveredZone.patternName },
            { label: "신호 유형", value: "SELL" },
            { label: "진입일", value: hoveredZone.entryDate ?? "-" },
            { label: "청산일", value: hoveredZone.exitDate ?? hoveredZone.signalDate ?? hoveredZone.endDate },
            { label: "매수가", value: hoveredZone.entryPrice == null ? "-" : formatPrice(hoveredZone.entryPrice) },
            { label: "매도가", value: hoveredZone.exitPrice == null ? "-" : formatPrice(hoveredZone.exitPrice) },
            { label: "실현 수익률", value: formatPercent(hoveredZone.returnPercent) },
            { label: "청산 사유", value: hoveredZone.reason },
            { label: "보유일", value: hoveredZone.holdingDays == null ? "-" : `${hoveredZone.holdingDays}일` },
            { label: "MFE", value: formatPercent(hoveredZone.mfePercent) },
            { label: "MAE", value: formatPercent(hoveredZone.maePercent) },
          ],
        };
      }
      if (hoveredZone.zoneType === "HOLD") {
        return {
          title: `${hoveredZone.patternName} HOLD 구간`,
          tone: toneColor("HOLD"),
          rows: [
            { label: "패턴명", value: hoveredZone.patternName },
            { label: "현재 상태", value: "HOLD" },
            { label: "평균 매수가", value: hoveredZone.entryPrice == null ? "-" : formatPrice(hoveredZone.entryPrice) },
            { label: "현재가", value: hoveredZone.currentPrice == null ? "-" : formatPrice(hoveredZone.currentPrice) },
            { label: "현재 손익률", value: formatPercent(hoveredZone.returnPercent) },
            { label: "현재 손절가", value: recommendation ? formatPrice(recommendation.stopPrice) : "-" },
            { label: "현재 목표가", value: recommendation ? `${formatPrice(recommendation.targetPrice1)} / ${formatPrice(recommendation.targetPrice2)}` : "-" },
            { label: "예상 청산가", value: recommendation ? formatPrice(recommendation.expectedExitPrice) : "-" },
            { label: "보유일", value: hoveredZone.holdingDays == null ? "-" : `${hoveredZone.holdingDays}일` },
          ],
        };
      }
      return {
        title: `${hoveredZone.patternName} 감지 구간`,
        tone: getPatternStyle(hoveredZone.patternId).accent,
        rows: [
          { label: "패턴명", value: hoveredZone.patternName },
          { label: "구간 유형", value: "패턴 감지" },
          { label: "감지 구간", value: `${hoveredZone.startDate} ~ ${hoveredZone.endDate}` },
          { label: "신호 발생일", value: hoveredZone.signalDate ?? hoveredZone.endDate },
          { label: "트리거 가격", value: recommendation ? formatPrice(recommendation.triggerPrice) : "-" },
          { label: "권장 매수가 범위", value: recommendation ? `${formatPrice(recommendation.entryRangeLow)} ~ ${formatPrice(recommendation.entryRangeHigh)}` : "-" },
          { label: "손절가", value: recommendation ? formatPrice(recommendation.stopPrice) : "-" },
          { label: "1차 목표가", value: recommendation ? formatPrice(recommendation.targetPrice1) : "-" },
          { label: "감지 근거", value: hoveredZone.reason },
        ],
      };
    }
    if (hoveredRange) {
      return {
        title: `${hoveredRange.patternName} HOLD 구간`,
        tone: toneColor("HOLD"),
        rows: [
          { label: "종목", value: title },
          { label: "현재 상태", value: hoveredRange.openPosition ? "HOLD" : "완료" },
          { label: "평균 매수가", value: formatPrice(hoveredRange.entryPrice) },
          { label: "현재가", value: formatPrice(hoveredRange.currentPrice) },
          { label: "현재 손익률", value: formatPercent(hoveredRange.currentReturnPercent) },
          { label: "현재 손절가", value: formatPrice(hoveredRange.stopPrice) },
          { label: "현재 목표가", value: `${formatPrice(hoveredRange.targetPrice1)} / ${formatPrice(hoveredRange.targetPrice2)}` },
          { label: "예상 청산가", value: formatPrice(hoveredRange.expectedExitPrice) },
          { label: "트레일링 스탑", value: formatPrice(hoveredRange.trailingStopPrice) },
          { label: "보유 일수", value: `${hoveredRange.holdingDays}일` },
        ],
      };
    }
    if (hoveredLevel) {
      const levelRecommendation = hoveredLevel.recommendation ?? referenceRecommendation;
      if (!levelRecommendation) {
        return null;
      }
      const rows: TooltipRow[] = hoveredLevel.type === "buy" || hoveredLevel.type === "buyRangeLow" || hoveredLevel.type === "buyRangeHigh"
        ? [
            { label: "패턴", value: hoveredLevel.patternName },
            { label: "권장 매수가 범위", value: `${formatPrice(levelRecommendation.entryRangeLow)} ~ ${formatPrice(levelRecommendation.entryRangeHigh)}` },
            { label: "진입 허용 상단", value: formatPrice(levelRecommendation.entryRangeHigh) },
            { label: "진입 허용 하단", value: formatPrice(levelRecommendation.entryRangeLow) },
            { label: "현재가와의 거리", value: formatPercent(levelRecommendation.entryDistancePercent) },
            { label: "진입 상태", value: levelRecommendation.entryAllowed ? "진입 가능" : "진입 대기" },
          ]
        : hoveredLevel.type === "sell"
          ? [
              { label: "패턴", value: hoveredLevel.patternName },
              { label: "예상 청산가", value: formatPrice(levelRecommendation.expectedExitPrice) },
              { label: "현재가와 차이", value: activeCandle ? formatPercent(((levelRecommendation.expectedExitPrice / activeCandle.close) - 1) * 100) : "-" },
              { label: "목표가 도달 여부", value: activeCandle && activeCandle.close >= levelRecommendation.targetPrice1 ? "도달" : "미도달" },
              { label: "매도 우선순위", value: "권장 매도가 우선" },
              { label: "분할 청산 비율", value: levelRecommendation.splitExitRatio },
            ]
          : [
              { label: "패턴", value: hoveredLevel.patternName },
              { label: "레벨", value: hoveredLevel.label },
              { label: "가격", value: formatPrice(hoveredLevel.value) },
              { label: "현재가와 차이", value: activeCandle ? formatPercent(((hoveredLevel.value / activeCandle.close) - 1) * 100) : "-" },
              { label: "기준 신호일", value: hoveredLevel.signalDate },
            ];
      return {
        title: `${hoveredLevel.patternName} · ${hoveredLevel.label}`,
        tone: getPatternStyle(hoveredLevel.patternId).accent,
        rows,
      };
    }
    if (activeCandle) {
      return {
        title: `${activeCandle.date} 캔들`,
        tone: "#155eef",
        rows: [
          { label: "시가 / 종가", value: `${formatPrice(activeCandle.open)} / ${formatPrice(activeCandle.close)}` },
          { label: "고가 / 저가", value: `${formatPrice(activeCandle.high)} / ${formatPrice(activeCandle.low)}` },
          { label: "거래량", value: new Intl.NumberFormat("ko-KR").format(activeCandle.volume) },
          { label: "활성 신호", value: activeMarkers.length > 0 ? activeMarkers.map((marker) => `${marker.patternName} ${marker.signalType}`).join(", ") : "없음" },
        ],
      };
    }
    return null;
  }, [activeCandle, activeMarkers, hoveredLevel, hoveredMarker, hoveredRange, hoveredZone, referenceRecommendation, title]);

  if (normalizedCandles.length === 0) {
    return (
      <div className="rounded-md border border-[color:rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <div className="flex items-center gap-2">
          <Icon name="spark" className="h-3.5 w-3.5 text-[color:var(--kpi)]" />
          <h3 className="text-[14px] font-semibold text-[color:var(--fg)]">{title}</h3>
        </div>
        <p className="mt-1 text-[12px] text-[color:var(--fg-muted)]">{subtitle ?? "표시할 가격 데이터가 없습니다."}</p>
        <div className="mt-3 flex h-52 items-center justify-center rounded-md border border-dashed border-[color:rgba(15,23,42,0.08)] bg-white/70 text-[12px] text-[color:var(--fg-muted)]">
          가격 이력이 없어 패턴 오버레이를 표시할 수 없습니다.
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
        <div className="flex max-w-[55%] flex-wrap justify-end gap-2 text-[10px] font-semibold">
          {showPatternLegend ? visiblePatterns.map((pattern) => (
            <span key={pattern.patternId} className="inline-flex items-center gap-1 rounded-full border border-[color:rgba(15,23,42,0.08)] bg-white px-2 py-1 text-[color:var(--fg-muted)]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getPatternStyle(pattern.patternId).accent }} />
              {pattern.patternName}
            </span>
          )) : null}
          {[
            ["BUY", "BUY"],
            ["SELL", "SELL"],
            ["HOLD", "HOLD"],
            ["DETECTION", "NONE"],
          ].map(([label, tone]) => (
            <span key={label} className="inline-flex items-center gap-1 rounded-full border border-[color:rgba(15,23,42,0.08)] bg-white px-2 py-1 text-[color:var(--fg-muted)]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: label === "DETECTION" ? "#64748b" : toneColor(tone as PatternLabChartMarker["signalType"]) }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-2 rounded-md border border-[color:rgba(15,23,42,0.08)] bg-white px-3 py-2 text-[11px] text-[color:var(--fg-muted)] md:flex-row md:items-center md:justify-between">
        <span className="inline-flex items-center gap-2 font-medium">
          <Icon name="status" className="h-3.5 w-3.5" />
          {activeCandle ? `${activeCandle.date} · 종가 ${formatPrice(activeCandle.close)} · 거래량 ${new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 }).format(activeCandle.volume)}` : "캔들 정보 없음"}
        </span>
        <span className="font-semibold text-[color:var(--fg)]">
          {activeMarkers.length > 0
            ? `${activeMarkers[0]?.patternName ?? ""} · ${activeMarkers[0]?.signalType ?? ""} · ${formatPrice(activeMarkers[0]?.signalPrice ?? 0)}`
            : "해당 날짜 신호 없음"}
          {isZoomed ? ` · 확대 ${visibleCount}/${totalCount}` : " · 휠 확대"}
          {" · 좌우 드래그"}
        </span>
      </div>

      {activeMarkers.length > 0 && !compact ? (
        <div className="mb-3 rounded-md border border-[color:var(--line)] bg-white px-3 py-3 text-[11px]">
          {activeMarkers.slice(0, 2).map((marker) => (
            <div key={marker.id} className="flex flex-col gap-1 text-[color:var(--fg-muted)] md:flex-row md:items-center md:justify-between">
              <span className="font-semibold text-[color:var(--fg)]">{marker.patternName} · {marker.signalType}</span>
              <span>
                신호가 {formatPrice(marker.signalPrice)} · 권장 매수가 {formatPrice(marker.recommendation.recommendedBuyPrice)} · 손절가 {formatPrice(marker.recommendation.stopPrice)} · 목표가 {formatPrice(marker.recommendation.targetPrice1)}
              </span>
            </div>
          ))}
        </div>
      ) : null}

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
        <svg viewBox={`0 0 ${Math.max(chartData.geometry.length, 1)} 100`} preserveAspectRatio="none" className={`w-full ${heightClass}`}>
          {chartData.priceTicks.map((tick) => {
            const y = priceTop + ((chartData.scaledHigh - tick) / (chartData.scaledHigh - chartData.scaledLow || 1)) * (priceBottom - priceTop);
            return (
              <line key={`grid-${tick}`} x1="0" x2={Math.max(chartData.geometry.length, 1)} y1={y} y2={y} stroke="rgba(15,23,42,0.08)" strokeWidth="0.35" />
            );
          })}

          {showSignalZones ? chartData.zoneRects.map((rect) => (
            <g key={rect.id}>
              <rect
                x={rect.startX}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                fill={zoneFill(rect.patternId, rect.zoneType)}
                stroke={getPatternStyle(rect.patternId).accent}
                strokeWidth={rect.zoneType === "HOLD" ? "0.18" : "0.22"}
                strokeDasharray={zoneDash(rect.zoneType)}
                className="pointer-events-auto"
                onMouseEnter={() => setHoveredZoneId(rect.id)}
                onMouseLeave={() => setHoveredZoneId(null)}
              />
              {!compact ? (
                <text x={rect.startX + 0.25} y={rect.y + Math.min(rect.height * 0.65, 6)} fontSize="1.65" fill={getPatternStyle(rect.patternId).accent}>
                  {rect.label}
                </text>
              ) : null}
            </g>
          )) : null}

          {showHoldingRanges && !showSignalZones ? chartData.holdRects.map((rect) => (
            <rect
              key={rect.id}
              x={rect.startX}
              y={priceTop}
              width={rect.width}
              height={priceBottom - priceTop}
              fill={rect.openPosition ? "rgba(21,94,239,0.08)" : "rgba(22,163,74,0.06)"}
              className="pointer-events-auto"
              onMouseEnter={() => setHoveredRangeId(rect.id)}
              onMouseLeave={() => setHoveredRangeId(null)}
            />
          )) : null}

          {showPriceLevels ? (
            <>
              {chartData.buyRangeBands.map((band) => (
                <rect
                  key={band.id}
                  x="0"
                  y={band.y}
                  width={Math.max(chartData.geometry.length, 1)}
                  height={band.height}
                  fill={getPatternStyle(band.patternId).bandFill}
                />
              ))}
              {priceLevels.map((level) => (
                <g key={level.id}>
                  <line
                    x1="0"
                    x2={Math.max(chartData.geometry.length, 1)}
                    y1={chartData.mapPriceY(level.value)}
                    y2={chartData.mapPriceY(level.value)}
                    stroke={getPatternStyle(level.patternId).accent}
                    strokeWidth={level.type === "buy" || level.type === "sell" ? "0.62" : "0.36"}
                    strokeDasharray={level.type === "buyRangeLow" || level.type === "buyRangeHigh" ? "1.1 1.1" : level.type === "stop" ? "1.2 0.8" : level.type === "target1" || level.type === "target2" ? "2 1" : "1.8 1.2"}
                    opacity={level.type === "buyRangeLow" || level.type === "buyRangeHigh" ? "0.52" : "0.82"}
                    className="pointer-events-auto"
                    onMouseEnter={() => setHoveredLevelId(level.id)}
                    onMouseLeave={() => setHoveredLevelId(null)}
                  />
                  {!compact && (level.type === "buy" || level.type === "sell" || level.type === "stop" || level.type === "target1") ? (
                    <text x={Math.max(chartData.geometry.length - 5.5, 0.8)} y={chartData.mapPriceY(level.value) - 0.5} fontSize="1.5" fill={getPatternStyle(level.patternId).accent}>
                      {level.patternName.slice(0, 4)} {level.label}
                    </text>
                  ) : null}
                </g>
              ))}
            </>
          ) : null}

          {showMovingAverage && chartData.ma20.length > 0 ? (
            <path
              d={chartData.ma20.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")}
              fill="none"
              stroke="rgba(21,94,239,0.7)"
              strokeWidth="0.45"
            />
          ) : null}
          {showMovingAverage && chartData.ma60.length > 0 ? (
            <path
              d={chartData.ma60.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")}
              fill="none"
              stroke="rgba(245,158,11,0.8)"
              strokeWidth="0.45"
            />
          ) : null}

          {chartData.geometry.map((item) => (
            <g key={`candle-${item.date}`}>
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
              {showVolume ? (
                <rect
                  x={item.centerX - 0.32}
                  y={item.volumeY}
                  width={0.64}
                  height={94 - item.volumeY}
                  fill={item.up ? "rgba(216,95,75,0.38)" : "rgba(63,114,232,0.38)"}
                  rx={0.04}
                />
              ) : null}
            </g>
          ))}

          {Array.from(chartData.markerMap.entries()).map(([index, bucket]) => {
            const candle = chartData.geometry[index];
            if (!candle) {
              return null;
            }
            return bucket.slice(0, compact ? 1 : 2).map((marker, markerIndex) => {
              const y = chartData.mapPriceY(marker.signalPrice) - markerIndex * 4;
              return (
                <g key={marker.id}>
                  <circle
                    cx={candle.centerX}
                    cy={y}
                    r={compact ? 0.9 : 1.2}
                    fill={toneColor(marker.signalType)}
                    stroke={getPatternStyle(marker.patternId).accent}
                    strokeWidth={compact ? "0.16" : "0.24"}
                    className="pointer-events-auto"
                    onMouseEnter={() => setHoveredMarkerId(marker.id)}
                    onMouseLeave={() => setHoveredMarkerId(null)}
                  />
                  {!compact ? (
                    <text x={candle.centerX + 0.4} y={y - 0.2} fontSize="1.9" fill={getPatternStyle(marker.patternId).accent}>
                      {marker.label}
                    </text>
                  ) : null}
                </g>
              );
            });
          })}

          {crosshairCandle && crosshairLineY != null ? (
            <>
              <line
                x1={crosshairCandle.centerX}
                x2={crosshairCandle.centerX}
                y1="4"
                y2="94"
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
            y1={chartData.mapPriceY(chartData.lastClose)}
            y2={chartData.mapPriceY(chartData.lastClose)}
            stroke="rgba(15,23,42,0.28)"
            strokeWidth="0.28"
            strokeDasharray="1.2 0.8"
          />
        </svg>

        <div className="pointer-events-none absolute inset-y-0 right-0 flex w-16 flex-col justify-between border-l border-[color:rgba(15,23,42,0.06)] bg-white/85 px-2 py-4 text-right text-[11px] font-semibold text-[color:var(--fg-muted)]">
          {chartData.priceTicks.map((tick) => (
            <span key={`tick-${tick}`}>{formatPrice(tick)}</span>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-7 items-end px-2 pb-1 pr-16 text-[10px] font-semibold text-[color:var(--fg-muted)]">
          {chartData.xLabelIndices.map((index) => {
            const candle = chartData.geometry[index];
            const left = chartData.geometry.length <= 1 ? 0 : (index / (chartData.geometry.length - 1)) * 100;
            return (
              <span key={`label-${index}`} className="absolute -translate-x-1/2" style={{ left: `calc(${left}% + 8px)` }}>
                {candle ? formatDateLabel(candle.date) : ""}
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
                {formatPrice(crosshairValue)}
              </span>
            </div>
            <div className="pointer-events-none absolute bottom-0 left-0 right-16 h-7">
              <span
                className="absolute bottom-1 inline-flex -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white shadow-[0_10px_18px_rgba(15,23,42,0.18)]"
                style={{ left: `${crosshairLeft}%` }}
              >
                {formatDateLabel(crosshairCandle.date)}
              </span>
            </div>
          </>
        ) : null}
        {activeTooltip ? (
          <div className="absolute left-3 top-3 z-10 max-w-[260px] rounded-md border border-[color:var(--line)] bg-white/95 px-3 py-3 text-[11px] shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activeTooltip.tone }} />
              <p className="font-semibold text-[color:var(--fg)]">{activeTooltip.title}</p>
            </div>
            <div className="mt-2 space-y-1 text-[color:var(--fg-muted)]">
              {activeTooltip.rows.map((row) => (
                <p key={`${activeTooltip.title}-${row.label}`}>
                  <span className="font-semibold text-[color:var(--fg)]">{row.label}</span> {row.value}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
