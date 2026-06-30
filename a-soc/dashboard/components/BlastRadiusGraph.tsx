/**
 * BlastRadiusGraph — D3.js-powered interactive attack graph visualization.
 *
 * Features:
 * - Force-directed layout with physics simulation
 * - Interactive: click a node to highlight downstream dependencies
 * - Animated threat propagation along edges
 * - Color-coded by risk level (critical/high/medium/low)
 * - Responsive SVG with zoom and pan
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

// ── Types ────────────────────────────────────────────────────────────────

interface GraphNodeDatum extends d3.SimulationNodeDatum {
  id: string;
  type: "threat_actor" | "identity" | "resource" | "unknown";
  label: string;
  risk: "critical" | "high" | "medium" | "low";
}

interface GraphEdgeDatum extends d3.SimulationLinkDatum<GraphNodeDatum> {
  source: string | GraphNodeDatum;
  target: string | GraphNodeDatum;
  label: string;
}

interface BlastRadiusGraphProps {
  readonly data: {
    readonly nodes: readonly { readonly id: string; readonly type: string; readonly label: string; readonly risk: string }[];
    readonly edges: readonly { readonly source: string; readonly target: string; readonly label: string }[];
  };
  readonly width?: number;
  readonly height?: number;
}

// ── Color Mapping ────────────────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
};

const RISK_GLOW: Record<string, string> = {
  critical: "rgba(239, 68, 68, 0.6)",
  high: "rgba(249, 115, 22, 0.5)",
  medium: "rgba(234, 179, 8, 0.4)",
  low: "rgba(59, 130, 246, 0.3)",
};

const NODE_RADIUS: Record<string, number> = {
  threat_actor: 28,
  identity: 22,
  resource: 18,
  unknown: 16,
};

// ── Component ────────────────────────────────────────────────────────────

export function BlastRadiusGraph({ data, width = 600, height = 400 }: BlastRadiusGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNodeDatum, GraphEdgeDatum> | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Compute downstream nodes for highlighting
  const downstreamMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const edge of data.edges) {
      const src = edge.source;
      const tgt = edge.target;
      if (!map.has(src)) map.set(src, new Set());
      map.get(src)!.add(tgt);
    }
    // Transitive closure
    for (const [, targets] of map) {
      const queue = [...targets];
      while (queue.length > 0) {
        const next = queue.shift()!;
        const nextTargets = map.get(next);
        if (nextTargets) {
          for (const t of nextTargets) {
            if (!targets.has(t)) {
              targets.add(t);
              queue.push(t);
            }
          }
        }
      }
    }
    return map;
  }, [data.edges]);

  const highlightedNodes = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const downstream = downstreamMap.get(selectedNode) ?? new Set<string>();
    return new Set([selectedNode, ...downstream]);
  }, [selectedNode, downstreamMap]);

  const highlightedEdges = useMemo(() => {
    if (!selectedNode) return new Set<number>();
    const result = new Set<number>();
    data.edges.forEach((edge, i) => {
      const src = edge.source;
      if (highlightedNodes.has(src)) result.add(i);
    });
    return result;
  }, [selectedNode, highlightedNodes, data.edges]);

  // D3 Force Simulation
  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 3]).on("zoom", (event) => {
      g.attr("transform", event.transform);
    });
    svg.call(zoom);

    // Nodes and edges data
    const nodes: GraphNodeDatum[] = data.nodes.map((n) => ({
      ...n,
      type: n.type as GraphNodeDatum["type"],
      risk: n.risk as GraphNodeDatum["risk"],
    }));

    const edges: GraphEdgeDatum[] = data.edges.map((e) => ({
      ...e,
      source: e.source,
      target: e.target,
    }));

    // Simulation
    const simulation = d3
      .forceSimulation<GraphNodeDatum>(nodes)
      .force(
        "link",
        d3.forceLink<GraphNodeDatum, GraphEdgeDatum>(edges)
          .id((d) => d.id)
          .distance(120)
      )
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d) => (NODE_RADIUS[(d as GraphNodeDatum).type] ?? 16) + 10));

    simulationRef.current = simulation;

    // Animated gradient for threat propagation
    const defs = svg.append("defs");

    // Glow filter
    const filter = defs.append("filter").attr("id", "glow");
    filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Animated dash for threat propagation
    const threatGradient = defs.append("linearGradient").attr("id", "threat-gradient");
    threatGradient.append("stop").attr("offset", "0%").attr("stop-color", "#ef4444");
    threatGradient.append("stop").attr("offset", "50%").attr("stop-color", "#f97316");
    threatGradient.append("stop").attr("offset", "100%").attr("stop-color", "#ef4444");

    // Edge rendering
    const edgeGroup = g.append("g").attr("class", "edges");

    const edgeElements = edgeGroup
      .selectAll("line")
      .data(edges)
      .enter()
      .append("line")
      .attr("stroke", "#475569")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrowhead)");

    // Animated threat propagation overlay
    const threatEdges = edgeGroup
      .selectAll(".threat-line")
      .data(edges.filter((_, i) => i < 3))
      .enter()
      .append("line")
      .attr("class", "threat-line")
      .attr("stroke", "url(#threat-gradient)")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "8,6")
      .attr("opacity", 0.7);

    // Arrow marker
    defs
      .append("marker")
      .attr("id", "arrowhead")
      .attr("markerWidth", 10)
      .attr("markerHeight", 7)
      .attr("refX", 28)
      .attr("refY", 3.5)
      .attr("orient", "auto")
      .append("polygon")
      .attr("points", "0 0, 10 3.5, 0 7")
      .attr("fill", "#64748b");

    // Edge labels
    const edgeLabels = edgeGroup
      .selectAll("text")
      .data(edges)
      .enter()
      .append("text")
      .attr("fill", "#94a3b8")
      .attr("font-size", 9)
      .attr("font-family", "monospace")
      .attr("text-anchor", "middle")
      .attr("dy", -8)
      .text((d) => d.label);

    // Node rendering
    const nodeGroup = g.append("g").attr("class", "nodes");

    const nodeElements = nodeGroup
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, GraphNodeDatum>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Outer glow circle
    nodeElements
      .append("circle")
      .attr("r", (d) => (NODE_RADIUS[d.type] ?? 16) + 8)
      .attr("fill", (d) => RISK_GLOW[d.risk] ?? RISK_GLOW.low)
      .attr("opacity", 0.3)
      .attr("filter", "url(#glow)");

    // Main circle
    nodeElements
      .append("circle")
      .attr("r", (d) => NODE_RADIUS[d.type] ?? 16)
      .attr("fill", (d) => RISK_COLORS[d.risk] ?? RISK_COLORS.low)
      .attr("fill-opacity", 0.2)
      .attr("stroke", (d) => RISK_COLORS[d.risk] ?? RISK_COLORS.low)
      .attr("stroke-width", 2.5);

    // Risk label inside node
    nodeElements
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 1)
      .attr("fill", (d) => RISK_COLORS[d.risk] ?? RISK_COLORS.low)
      .attr("font-size", 10)
      .attr("font-weight", "bold")
      .attr("font-family", "monospace")
      .text((d) => d.risk.toUpperCase().slice(0, 3));

    // Label below node
    nodeElements
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => (NODE_RADIUS[d.type] ?? 16) + 16)
      .attr("fill", "#e2e8f0")
      .attr("font-size", 10)
      .attr("font-family", "monospace")
      .text((d) => d.label.length > 20 ? d.label.slice(0, 18) + "..." : d.label);

    // Click handler for node selection
    nodeElements.on("click", (event, d) => {
      event.stopPropagation();
      setSelectedNode((prev) => (prev === d.id ? null : d.id));
    });

    // Hover handler
    nodeElements
      .on("mouseenter", (_, d) => setHoveredNode(d.id))
      .on("mouseleave", () => setHoveredNode(null));

    // Click on background to deselect
    svg.on("click", () => setSelectedNode(null));

    // Animate threat propagation along edges
    let frame = 0;
    const animateThreat = () => {
      frame += 1;
      threatEdges
        .attr("stroke-dashoffset", -frame * 0.5)
        .attr("opacity", 0.4 + 0.3 * Math.sin(frame * 0.05));
      requestAnimationFrame(animateThreat);
    };
    const animId = requestAnimationFrame(animateThreat);

    // Tick
    simulation.on("tick", () => {
      edgeElements
        .attr("x1", (d) => (d.source as GraphNodeDatum).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNodeDatum).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNodeDatum).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNodeDatum).y ?? 0);

      threatEdges
        .attr("x1", (d) => (d.source as GraphNodeDatum).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNodeDatum).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNodeDatum).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNodeDatum).y ?? 0);

      edgeLabels
        .attr("x", (d) => (((d.source as GraphNodeDatum).x ?? 0) + ((d.target as GraphNodeDatum).x ?? 0)) / 2)
        .attr("y", (d) => (((d.source as GraphNodeDatum).y ?? 0) + ((d.target as GraphNodeDatum).y ?? 0)) / 2 - 10);

      nodeElements.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      cancelAnimationFrame(animId);
      simulation.stop();
    };
  }, [data, width, height]);

  // Highlight effect when node selected
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    svg.selectAll(".nodes g").attr("opacity", (d) => {
      if (!selectedNode) return 1;
      return highlightedNodes.has((d as GraphNodeDatum).id) ? 1 : 0.15;
    });

    svg.selectAll(".edges line:not(.threat-line)").attr("opacity", (_, i) => {
      if (!selectedNode) return 1;
      return highlightedEdges.has(i) ? 1 : 0.08;
    });
  }, [selectedNode, highlightedNodes, highlightedEdges]);

  // Tooltip
  const tooltipNode = useMemo(() => {
    const id = hoveredNode;
    if (!id) return null;
    return data.nodes.find((n) => n.id === id) ?? null;
  }, [hoveredNode, data.nodes]);

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="bg-slate-950/50 rounded-xl"
      />

      {/* Tooltip */}
      {tooltipNode && (
        <div className="absolute top-4 right-4 bg-slate-900/95 border border-slate-700 rounded-lg p-3 shadow-xl z-20 pointer-events-none min-w-[180px]">
          <div className="text-xs font-mono text-slate-500 uppercase mb-1">Node Details</div>
          <div className="text-sm text-white font-bold">{tooltipNode.label}</div>
          <div className="text-xs text-slate-400 mt-1">
            Type: <span className="text-cyan-300">{tooltipNode.type}</span>
          </div>
          <div className="text-xs text-slate-400">
            Risk:{" "}
            <span style={{ color: RISK_COLORS[tooltipNode.risk] }}>
              {tooltipNode.risk.toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-800 rounded-lg p-3 z-20">
        <div className="text-[10px] font-mono text-slate-500 uppercase mb-2">Risk Level</div>
        <div className="flex gap-3">
          {(["critical", "high", "medium", "low"] as const).map((level) => (
            <div key={level} className="flex items-center gap-1">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: RISK_COLORS[level] }}
              />
              <span className="text-[10px] text-slate-400 font-mono uppercase">{level}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selection info */}
      {selectedNode && (
        <div className="absolute top-4 left-4 bg-slate-900/90 border border-cyan-500/30 rounded-lg p-3 z-20">
          <div className="text-[10px] font-mono text-cyan-400 uppercase mb-1">Selected Node</div>
          <div className="text-xs text-white font-bold">{selectedNode}</div>
          <div className="text-[10px] text-slate-400 mt-1">
            {highlightedNodes.size - 1} downstream system(s) affected
          </div>
        </div>
      )}
    </div>
  );
}
