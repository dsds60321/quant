"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { NewsImpactGraph as NewsImpactGraphData, NewsImpactNode } from "@/lib/api";

type GraphNode = {
  id: string;
  title: string;
  summary: string;
  translatedTitle?: string | null;
  translatedSummary?: string | null;
  color: string;
  radius: number;
  url?: string | null;
  isCenter?: boolean;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
};

type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
  distance: number;
};

type TooltipState = {
  node: GraphNode;
  x: number;
  y: number;
} | null;

const nodeFill: Record<string, string> = {
  blue: "#60a5fa",
  red: "#fb7185",
  gray: "#94a3b8",
  center: "#155eef",
};

function fallbackSummary(node: NewsImpactNode) {
  return node.summary?.trim() || "요약 정보가 아직 생성되지 않았습니다.";
}

function fallbackTranslatedSummary(node: NewsImpactNode) {
  return node.translatedSummary?.trim() || node.summary?.trim() || "요약 정보가 아직 생성되지 않았습니다.";
}

export function NewsImpactGraph({
  graph,
  height = 640,
  translated = false,
}: {
  graph: NewsImpactGraphData;
  height?: number;
  translated?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [width, setWidth] = useState(960);
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width;
      if (nextWidth) {
        setWidth(nextWidth);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const simulationData = useMemo(() => {
    const centerNode: GraphNode = {
      id: graph.center,
      title: graph.center,
      summary: `${graph.center} 중심 종목 영향 그래프`,
      color: nodeFill.center,
      radius: 18,
      isCenter: true,
    };

    const nodes: GraphNode[] = [
      centerNode,
      ...graph.nodes.map((node) => ({
        id: String(node.id),
        title: node.title,
        summary: fallbackSummary(node),
        translatedTitle: node.translatedTitle?.trim() || node.title,
        translatedSummary: fallbackTranslatedSummary(node),
        color: nodeFill[node.color] ?? nodeFill.gray,
        radius: Math.max(3, Math.min(11, node.impact * 14)),
        url: node.url,
      })),
    ];

    const links: GraphLink[] = graph.links.map((link) => ({
      source: link.source,
      target: link.target,
      distance: Math.max(45, Math.min(280, link.distance)),
    }));

    return { nodes, links };
  }, [graph]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const centerX = width / 2;
    const centerY = height / 2;
    const nodes = simulationData.nodes.map((node) =>
      node.isCenter ? { ...node, fx: centerX, fy: centerY } : { ...node },
    );
    const links = simulationData.links.map((link) => ({ ...link }));

    svg
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "#f8fbff");

    const contentLayer = svg.append("g");

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((node) => node.id)
          .distance((link) => link.distance)
          .strength(0.38),
      )
      .force("charge", d3.forceManyBody().strength(-42))
      .force("collision", d3.forceCollide<GraphNode>().radius((node) => node.radius + 6))
      .force("center", d3.forceCenter(centerX, centerY))
      .force("x", d3.forceX(centerX).strength(0.02))
      .force("y", d3.forceY(centerY).strength(0.02));

    const link = contentLayer
      .append("g")
      .attr("stroke", "rgba(71,85,105,0.22)")
      .attr("stroke-linecap", "round")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (item) => Math.max(0.5, 2.2 - item.distance / 180));

    const nodeGroup = contentLayer
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", (node) => (node.isCenter ? "default" : "pointer"))
      .on("mouseenter", (event, node) => {
        if (node.isCenter) return;
        setTooltip({ node, x: event.offsetX, y: event.offsetY });
      })
      .on("mousemove", (event, node) => {
        if (node.isCenter) return;
        setTooltip({ node, x: event.offsetX, y: event.offsetY });
      })
      .on("mouseleave", () => setTooltip(null));

    nodeGroup.on("click", (_, node) => {
      if (node.isCenter || !node.url) return;
      window.open(node.url, "_blank", "noopener,noreferrer");
    });

    nodeGroup
      .append("circle")
      .attr("r", (node) => node.radius)
      .attr("fill", (node) => node.color)
      .attr("fill-opacity", (node) => (node.isCenter ? 0.96 : 0.9))
      .attr("stroke", (node) => (node.isCenter ? "rgba(21,94,239,0.16)" : "rgba(15,23,42,0.1)"))
      .attr("stroke-width", (node) => (node.isCenter ? 2.4 : 0.9));

    nodeGroup
      .filter((node) => Boolean(node.isCenter))
      .append("text")
      .text((node) => node.title)
      .attr("text-anchor", "middle")
      .attr("dy", 34)
      .attr("fill", "#0f172a")
      .attr("font-size", 13)
      .attr("font-weight", 700)
      .attr("letter-spacing", "0.08em");

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.75, 3.5])
      .translateExtent([[-width, -height], [width * 2, height * 2]])
      .on("zoom", (event) => {
        contentLayer.attr("transform", event.transform.toString());
      });

    svg.call(zoomBehavior).on("dblclick.zoom", null);

    simulation.on("tick", () => {
      link
        .attr("x1", (item) => (item.source as GraphNode).x ?? centerX)
        .attr("y1", (item) => (item.source as GraphNode).y ?? centerY)
        .attr("x2", (item) => (item.target as GraphNode).x ?? centerX)
        .attr("y2", (item) => (item.target as GraphNode).y ?? centerY);

      nodeGroup.attr("transform", (node) => `translate(${node.x ?? centerX},${node.y ?? centerY})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graph, height, simulationData, width]);

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-md border border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,#fcfdff,#f3f7ff)]">
      <svg ref={svgRef} width={width} height={height} className="w-full" aria-label="뉴스 영향 그래프" />
      {tooltip ? (
        <div
          className="pointer-events-none absolute z-10 max-w-sm rounded-md border border-[rgba(15,23,42,0.08)] bg-white/96 px-3 py-2.5 text-[color:var(--fg)] shadow-[0_16px_40px_rgba(15,23,42,0.16)]"
          style={{
            left: Math.min(Math.max(tooltip.x + 14, 12), Math.max(width - 340, 12)),
            top: Math.min(Math.max(tooltip.y + 14, 12), Math.max(height - 120, 12)),
          }}
        >
          <p className="text-[12px] font-semibold leading-5 text-[color:var(--fg)]">
            {translated ? (tooltip.node.translatedTitle ?? tooltip.node.title) : tooltip.node.title}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[color:var(--fg-muted)]">
            {translated ? (tooltip.node.translatedSummary ?? tooltip.node.summary) : tooltip.node.summary}
          </p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-slate-400">클릭하면 원문 기사로 이동</p>
        </div>
      ) : null}
    </div>
  );
}
