"use client";

import type { PatternExecutionModel, PatternLabViewMode } from "@/lib/pattern-lab";
import type { QuantPattern, SignalPlan } from "@/lib/quant-workbench";

export type PatternLabWindowMode = "main" | "popup" | "detached" | "multi";
export type PatternLabWindowSyncMode = "sync" | "independent";

export type PatternLabDisplayOptions = {
  showMovingAverage: boolean;
  showVolume: boolean;
  showSignalZones: boolean;
  showHoldingRanges: boolean;
  showPriceLevels: boolean;
  showPatternLegend: boolean;
};

export type PatternLabWindowState = {
  id: string;
  createdAt: string;
  selectedStrategyId: number | null;
  selectedBacktestId: number | null;
  selectedSnapshotId: number | null;
  selectedSymbols: string[];
  focusedSymbol: string | null;
  marketFilter: string;
  startDate: string;
  endDate: string;
  viewMode: PatternLabViewMode;
  activePatternId: string | null;
  draftExecutionModel: PatternExecutionModel;
  appliedExecutionModel: PatternExecutionModel;
  displayOptions: PatternLabDisplayOptions;
  draftPatterns: QuantPattern[];
  appliedPatterns: QuantPattern[];
  draftSignalPlan: SignalPlan;
  appliedSignalPlan: SignalPlan;
  syncMode: PatternLabWindowSyncMode;
};

export const PATTERN_LAB_WINDOW_STORAGE_KEY = "quant-pattern-lab-window-state-v1";
export const PATTERN_LAB_WINDOW_SYNC_CHANNEL = "quant-pattern-lab-window-sync-v1";

export const DEFAULT_PATTERN_LAB_DISPLAY_OPTIONS: PatternLabDisplayOptions = {
  showMovingAverage: true,
  showVolume: true,
  showSignalZones: true,
  showHoldingRanges: true,
  showPriceLevels: true,
  showPatternLegend: true,
};

const DISPLAY_OPTION_KEYS = Object.keys(DEFAULT_PATTERN_LAB_DISPLAY_OPTIONS) as Array<keyof PatternLabDisplayOptions>;

function normalizeDisplayOptions(value: unknown): PatternLabDisplayOptions {
  const source = (value && typeof value === "object" ? value : {}) as Partial<PatternLabDisplayOptions>;
  return {
    showMovingAverage: source.showMovingAverage ?? DEFAULT_PATTERN_LAB_DISPLAY_OPTIONS.showMovingAverage,
    showVolume: source.showVolume ?? DEFAULT_PATTERN_LAB_DISPLAY_OPTIONS.showVolume,
    showSignalZones: source.showSignalZones ?? DEFAULT_PATTERN_LAB_DISPLAY_OPTIONS.showSignalZones,
    showHoldingRanges: source.showHoldingRanges ?? DEFAULT_PATTERN_LAB_DISPLAY_OPTIONS.showHoldingRanges,
    showPriceLevels: source.showPriceLevels ?? DEFAULT_PATTERN_LAB_DISPLAY_OPTIONS.showPriceLevels,
    showPatternLegend: source.showPatternLegend ?? DEFAULT_PATTERN_LAB_DISPLAY_OPTIONS.showPatternLegend,
  };
}

export function parsePatternLabWindowMode(value: string | null | undefined): PatternLabWindowMode {
  if (value === "popup" || value === "detached" || value === "multi") {
    return value;
  }
  return "main";
}

export function parsePatternLabWindowSyncMode(value: string | null | undefined): PatternLabWindowSyncMode {
  return value === "independent" ? "independent" : "sync";
}

export function parsePatternLabDisplayOptions(value: string | null | undefined): PatternLabDisplayOptions {
  if (!value) {
    return { ...DEFAULT_PATTERN_LAB_DISPLAY_OPTIONS };
  }
  const tokens = new Set(value.split(",").map((token) => token.trim()).filter(Boolean));
  if (tokens.size === 0) {
    return { ...DEFAULT_PATTERN_LAB_DISPLAY_OPTIONS };
  }
  return {
    showMovingAverage: tokens.has("ma"),
    showVolume: tokens.has("volume"),
    showSignalZones: tokens.has("zones"),
    showHoldingRanges: tokens.has("hold"),
    showPriceLevels: tokens.has("levels"),
    showPatternLegend: tokens.has("legend"),
  };
}

export function serializePatternLabDisplayOptions(options: PatternLabDisplayOptions) {
  const tokens: string[] = [];
  if (options.showMovingAverage) {
    tokens.push("ma");
  }
  if (options.showVolume) {
    tokens.push("volume");
  }
  if (options.showSignalZones) {
    tokens.push("zones");
  }
  if (options.showHoldingRanges) {
    tokens.push("hold");
  }
  if (options.showPriceLevels) {
    tokens.push("levels");
  }
  if (options.showPatternLegend) {
    tokens.push("legend");
  }
  return tokens.join(",");
}

function loadWindowStateMap() {
  if (typeof window === "undefined") {
    return {} as Record<string, PatternLabWindowState>;
  }
  try {
    const raw = window.localStorage.getItem(PATTERN_LAB_WINDOW_STORAGE_KEY);
    if (!raw) {
      return {} as Record<string, PatternLabWindowState>;
    }
    const parsed = JSON.parse(raw) as Record<string, PatternLabWindowState>;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, item]) => [
        key,
        {
          ...item,
          activePatternId: item?.activePatternId ?? null,
          displayOptions: normalizeDisplayOptions(item?.displayOptions),
          selectedSymbols: Array.isArray(item?.selectedSymbols) ? item.selectedSymbols.filter(Boolean) : [],
        } satisfies PatternLabWindowState,
      ]),
    );
  } catch {
    return {} as Record<string, PatternLabWindowState>;
  }
}

export function loadPatternLabWindowState(id: string | null | undefined) {
  if (!id) {
    return null;
  }
  return loadWindowStateMap()[id] ?? null;
}

export function savePatternLabWindowState(state: PatternLabWindowState) {
  if (typeof window === "undefined") {
    return;
  }
  const current = loadWindowStateMap();
  current[state.id] = {
    ...state,
    displayOptions: normalizeDisplayOptions(state.displayOptions),
    selectedSymbols: state.selectedSymbols.filter(Boolean),
  };
  const trimmedEntries = Object.values(current)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 24)
    .map((item) => [item.id, item] as const);
  window.localStorage.setItem(PATTERN_LAB_WINDOW_STORAGE_KEY, JSON.stringify(Object.fromEntries(trimmedEntries)));
}

export function createPatternLabWindowStateId() {
  return `pattern-window-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildPatternLabWindowTitle({
  mode,
  stockName,
  symbol,
}: {
  mode: PatternLabWindowMode;
  stockName?: string | null;
  symbol?: string | null;
}) {
  if (mode === "multi") {
    return "패턴 실험실 멀티 차트";
  }
  if (stockName || symbol) {
    return `${stockName ?? symbol} 패턴 분석 창`;
  }
  if (mode === "detached") {
    return "패턴 실험실 분리 창";
  }
  return "패턴 실험실 팝업";
}

export function clonePatternLabDisplayOptions(options: PatternLabDisplayOptions) {
  return DISPLAY_OPTION_KEYS.reduce((accumulator, key) => {
    accumulator[key] = options[key];
    return accumulator;
  }, {} as PatternLabDisplayOptions);
}
