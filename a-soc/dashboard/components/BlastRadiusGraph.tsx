"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface GraphNode {
  id: string;
  label: string;
  type: string;
  risk: string;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

interface BlastRadiusGraphProps {
  data: { nodes: GraphNode[]; edges: GraphEdge[] };
  width?: number;
  height?: number;
}

const riskColors: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
  info: "#3b82f6",
};

export function BlastRadiusGraph({ data, width = 600, height = 400 }: BlastRadiusGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;
    const svg = svgRef.current;
    svg.innerHTML = "";

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svg.appendChild(g);

    // Simple force layout simulation
    const nodes = data.nodes.map((n, i) => ({
      ...n,
      x: width / 2 + (Math.cos((2 * Math.PI * i) / data.nodes.length) * Math.min(width, height) * 0.3),
      y: height / 2 + (Math.sin((2 * Math.PI * i) / data.nodes.length) * Math.min(width, height) * 0.3),
      vx: 0,
      vy: 0,
    }));

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // Run simple simulation
    for (let iter = 0; iter < 100; iter++) {
      // Repulsion between nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          let dx = nodes[j].x - nodes[i].x;
          let dy = nodes[j].y - nodes[i].y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          let force = 2000 / (dist * dist);
          nodes[i].vx -= (dx / dist) * force;
          nodes[i].vy -= (dy / dist) * force;
          nodes[j].vx += (dx / dist) * force;
          nodes[j].vy += (dy / dist) * force;
        }
      }

      // Attraction along edges
      for (const edge of data.edges) {
        const s = nodeMap.get(edge.source);
        const t = nodeMap.get(edge.target);
        if (!s || !t) continue;
        let dx = t.x - s.x;
        let dy = t.y - s.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        let force = (dist - 100) * 0.01;
        s.vx += (dx / dist) * force;
        s.vy += (dy / dist) * force;
        t.vx -= (dx / dist) * force;
        t.vy -= (dy / dist) * force;
      }

      // Center gravity
      for (const node of nodes) {
        node.vx += (width / 2 - node.x) * 0.001;
        node.vy += (height / 2 - node.y) * 0.001;
        node.vx *= 0.9;
        node.vy *= 0.9;
        node.x += node.vx;
        node.y += node.vy;
        node.x = Math.max(40, Math.min(width - 40, node.x));
        node.y = Math.max(40, Math.min(height - 40, node.y));
      }
    }

    // Draw edges
    for (const edge of data.edges) {
      const s = nodeMap.get(edge.source);
      const t = nodeMap.get(edge.target);
      if (!s || !t) continue;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(s.x));
      line.setAttribute("y1", String(s.y));
      line.setAttribute("x2", String(t.x));
      line.setAttribute("y2", String(t.y));
      line.setAttribute("stroke", "rgba(100,116,139,0.3)");
      line.setAttribute("stroke-width", "1");
      g.appendChild(line);
    }

    // Draw nodes
    for (const node of nodes) {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.style.cursor = "pointer";

      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", String(node.x));
      circle.setAttribute("cy", String(node.y));
      circle.setAttribute("r", "20");
      circle.setAttribute("fill", riskColors[node.risk] || "#64748b");
      circle.setAttribute("fill-opacity", "0.2");
      circle.setAttribute("stroke", riskColors[node.risk] || "#64748b");
      circle.setAttribute("stroke-width", "2");

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String(node.x));
      text.setAttribute("y", String(node.y + 1));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");
      text.setAttribute("fill", "#e2e8f0");
      text.setAttribute("font-size", "8");
      text.setAttribute("font-family", "monospace");
      text.textContent = node.label.slice(0, 6).toUpperCase();

      group.appendChild(circle);
      group.appendChild(text);
      g.appendChild(group);
    }

    // Legend
    const legend = document.createElementNS("http://www.w3.org/2000/svg", "g");
    legend.setAttribute("transform", `translate(10, ${height - 80})`);
    ["critical", "high", "medium", "low"].forEach((risk, i) => {
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", "0");
      rect.setAttribute("y", String(i * 18));
      rect.setAttribute("width", "10");
      rect.setAttribute("height", "10");
      rect.setAttribute("rx", "2");
      rect.setAttribute("fill", riskColors[risk]);

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", "16");
      label.setAttribute("y", String(i * 18 + 9));
      label.setAttribute("fill", "#64748b");
      label.setAttribute("font-size", "10");
      label.setAttribute("font-family", "monospace");
      label.textContent = risk.toUpperCase();

      legend.appendChild(rect);
      legend.appendChild(label);
    });
    g.appendChild(legend);

  }, [data, width, height]);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      role="img"
      aria-label="Blast radius visualization graph"
    />
  );
}
