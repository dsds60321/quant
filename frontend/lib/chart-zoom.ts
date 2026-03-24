"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type WheelLikeEvent = {
  deltaY: number;
  preventDefault: () => void;
  stopPropagation: () => void;
};

export function useWheelZoomWindow<T>(
  items: T[],
  hoveredIndex: number | null,
  minVisibleCount = 8,
  zoomKey: string | number = items.length,
) {
  const [zoomWindow, setZoomWindow] = useState<{ start: number; size: number; key: string | number } | null>(null);

  const totalCount = items.length;
  const resolvedMinCount = Math.min(Math.max(minVisibleCount, 2), Math.max(totalCount, 2));
  const activeZoomWindow = zoomWindow?.key === zoomKey ? zoomWindow : null;
  const visibleCount = activeZoomWindow?.size ?? totalCount;
  const visibleStart = activeZoomWindow ? clamp(activeZoomWindow.start, 0, Math.max(totalCount - visibleCount, 0)) : 0;
  const visibleEnd = Math.max(visibleStart + visibleCount - 1, visibleStart);

  const visibleItems = useMemo(
    () => items.slice(visibleStart, visibleStart + visibleCount),
    [items, visibleCount, visibleStart],
  );

  function handleWheel(event: WheelLikeEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (totalCount <= resolvedMinCount) {
      return;
    }

    const direction = Math.sign(event.deltaY);
    if (direction === 0) {
      return;
    }

    setZoomWindow((current) => {
      const currentWindow = current?.key === zoomKey ? current : null;
      const currentSize = currentWindow?.size ?? totalCount;
      const currentStart = currentWindow?.start ?? 0;
      const currentEnd = currentStart + currentSize - 1;
      const anchor = hoveredIndex == null
        ? currentStart + Math.floor(currentSize / 2)
        : clamp(hoveredIndex, currentStart, currentEnd);
      const anchorRatio = currentSize <= 1 ? 0.5 : (anchor - currentStart) / (currentSize - 1);

      const step = Math.max(2, Math.round(currentSize * 0.18));
      const nextSize = direction < 0
        ? Math.max(resolvedMinCount, currentSize - step)
        : Math.min(totalCount, currentSize + step);

      if (nextSize === currentSize) {
        return current;
      }
      if (nextSize >= totalCount) {
        return null;
      }

      const nextStart = clamp(
        Math.round(anchor - anchorRatio * (nextSize - 1)),
        0,
        Math.max(totalCount - nextSize, 0),
      );

      return { start: nextStart, size: nextSize, key: zoomKey };
    });
  }

  const setWindowStart = useCallback((start: number) => {
    setZoomWindow((current) => {
      const currentWindow = current?.key === zoomKey ? current : null;
      const size = currentWindow?.size ?? totalCount;
      if (size >= totalCount) {
        return null;
      }
      return {
        start: clamp(Math.round(start), 0, Math.max(totalCount - size, 0)),
        size,
        key: zoomKey,
      };
    });
  }, [totalCount, zoomKey]);

  return {
    visibleItems,
    visibleStart,
    visibleEnd,
    totalCount,
    visibleCount,
    isZoomed: visibleCount < totalCount,
    handleWheel,
    setWindowStart,
  };
}

export function useNonPassiveWheel<T extends HTMLElement>(
  onWheel: (event: WheelEvent) => void,
) {
  const [node, setNode] = useState<T | null>(null);
  const ref = useCallback((nextNode: T | null) => {
    setNode(nextNode);
  }, []);

  useEffect(() => {
    if (!node) {
      return;
    }

    const listener = (event: WheelEvent) => {
      onWheel(event);
    };

    node.addEventListener("wheel", listener, { passive: false });
    return () => {
      node.removeEventListener("wheel", listener);
    };
  }, [node, onWheel]);

  return ref;
}

type ChartPointerInteractionOptions = {
  axisWidth?: number;
  setHoveredIndex: (index: number | null) => void;
  totalCount: number;
  visibleCount: number;
  visibleStart: number;
  setWindowStart: (start: number) => void;
};

type DragState = {
  pointerId: number;
  startClientX: number;
  startVisibleStart: number;
};

export function useChartPointerInteraction({
  axisWidth = 64,
  setHoveredIndex,
  totalCount,
  visibleCount,
  visibleStart,
  setWindowStart,
}: ChartPointerInteractionOptions) {
  const dragStateRef = useRef<DragState | null>(null);
  const [crosshairY, setCrosshairY] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const readPointerState = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const plotWidth = Math.max(rect.width - axisWidth, 1);
    const plotHeight = Math.max(rect.height, 1);
    const x = clamp(event.clientX - rect.left, 0, plotWidth);
    const y = clamp(event.clientY - rect.top, 0, plotHeight);
    const localIndex = clamp(
      Math.round((x / plotWidth) * Math.max(visibleCount - 1, 0)),
      0,
      Math.max(visibleCount - 1, 0),
    );
    return {
      localIndex,
      plotHeight,
      plotWidth,
      yPercent: (y / plotHeight) * 100,
    };
  }, [axisWidth, visibleCount]);

  const syncPointerState = useCallback((event: ReactPointerEvent<HTMLDivElement>, startIndex = visibleStart) => {
    const { localIndex, plotHeight, plotWidth, yPercent } = readPointerState(event);
    if (totalCount <= 0 || visibleCount <= 0) {
      setHoveredIndex(null);
      setCrosshairY(null);
      return { plotWidth, plotHeight };
    }

    setHoveredIndex(clamp(startIndex + localIndex, 0, totalCount - 1));
    setCrosshairY(yPercent);
    return { plotWidth, plotHeight };
  }, [readPointerState, setHoveredIndex, totalCount, visibleCount, visibleStart]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    syncPointerState(event);
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startVisibleStart: visibleStart,
    };
    setIsDragging(true);
  }, [syncPointerState, visibleStart]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      syncPointerState(event);
      return;
    }

    const { localIndex, plotWidth, yPercent } = readPointerState(event);
    const deltaX = event.clientX - dragState.startClientX;
    const itemDelta = Math.round((-deltaX / plotWidth) * visibleCount);
    const nextStart = clamp(dragState.startVisibleStart + itemDelta, 0, Math.max(totalCount - visibleCount, 0));

    if (visibleCount < totalCount) {
      setWindowStart(nextStart);
    }
    setHoveredIndex(clamp(nextStart + localIndex, 0, totalCount - 1));
    setCrosshairY(yPercent);
  }, [readPointerState, setHoveredIndex, setWindowStart, syncPointerState, totalCount, visibleCount]);

  const finishDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setIsDragging(false);
    }
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (dragStateRef.current) {
      return;
    }
    setHoveredIndex(null);
    setCrosshairY(null);
  }, [setHoveredIndex]);

  return {
    crosshairY,
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: finishDrag,
    handlePointerCancel: finishDrag,
    handlePointerLeave,
  };
}
