"use client";

export type SyntheticCandleSeed<TMeta = undefined> = {
  label: string;
  value: number;
  meta?: TMeta;
};

export type SyntheticCandle<TMeta = undefined> = SyntheticCandleSeed<TMeta> & {
  index: number;
  open: number;
  high: number;
  low: number;
  close: number;
  up: boolean;
};

export function buildSyntheticCandles<TMeta = undefined>(
  items: SyntheticCandleSeed<TMeta>[],
): SyntheticCandle<TMeta>[] {
  if (items.length === 0) {
    return [];
  }

  const values = items.map((item) => item.value);
  const globalMin = Math.min(...values);
  const globalMax = Math.max(...values);
  const globalRange = globalMax - globalMin || Math.max(Math.abs(globalMax) * 0.18, 1);
  const clampToZero = globalMin >= 0;

  return items.map((item, index) => {
    const previous = items[index - 1]?.value ?? item.value;
    const next = items[index + 1]?.value ?? item.value;
    const bodyOpen = previous;
    const bodyClose = item.value;
    const localSwing = Math.max(
      Math.abs(bodyClose - bodyOpen),
      Math.abs(next - bodyClose),
      globalRange * 0.05,
      Math.max(Math.abs(bodyClose) * 0.018, 0.2),
    );
    const wickPadding = Math.max(localSwing * 0.4, globalRange * 0.018);
    const rawHigh = Math.max(bodyOpen, bodyClose) + wickPadding;
    const rawLow = Math.min(bodyOpen, bodyClose) - wickPadding;

    return {
      ...item,
      index,
      open: bodyOpen,
      high: rawHigh,
      low: clampToZero ? Math.max(rawLow, 0) : rawLow,
      close: bodyClose,
      up: bodyClose >= bodyOpen,
    };
  });
}

export function buildValueTicks(min: number, max: number, count = 5) {
  if (count <= 1) {
    return [max];
  }
  return Array.from({ length: count }, (_, index) => max - ((max - min) / (count - 1)) * index);
}
