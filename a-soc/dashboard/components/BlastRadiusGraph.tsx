"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";

interface Node {
  id: string;
  label: string;
  risk: number;
  type: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface Edge {
  source: string;
  target: string;
}

interface BlastRadiusGraphProps {
  data: { nodes: Node[]; edges: Edge[] };
  width?: number;
  height?: number;
}

export default function BlastRadiusGraph({ data, width = 700, height = 420 }: BlastRadiusGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const animRef = useRef<number>(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; startPanX: number; startPanY: number }>({ active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 });

  useEffect(() => {
    if (!data.nodes.length) return;
    const cx = width / 2;
    const cy = height / 2;
    nodesRef.current = data.nodes.map((n, i) => ({
      ...n,
      x: cx + (Math.random() - 0.5) * 200,
      y: cy + (Math.random() - 0.5) * 150,
      vx: 0,
      vy: 0,
    }));

    let iterations = 0;
    const maxIterations = 200;

    const tick = () => {
      if (iterations >= maxIterations) return;
      iterations++;
      const nodes = nodesRef.current;
      const k = 80;
      const repulsion = 3000;
      const attraction = 0.005;
      const damping = 0.85;
      const centerGravity = 0.01;

      for (let i = 0; i < nodes.length; i++) {
        let fx = 0, fy = 0;
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const dx = nodes[i].x! - nodes[j].x!;
          const dy = nodes[i].y! - nodes[j].y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          fx += (dx / dist) * repulsion / dist;
          fy += (dy / dist) * repulsion / dist;
        }
        fx += (cx - nodes[i].x!) * centerGravity;
        fy += (cy - nodes[i].y!) * centerGravity;
        nodes[i].vx = ((nodes[i].vx || 0) + fx) * damping;
        nodes[i].vy = ((nodes[i].vy || 0) + fy) * damping;
      }

      for (const edge of data.edges) {
        const src = nodes.find((n) => n.id === edge.source);
        const tgt = nodes.find((n) => n.id === edge.target);
        if (!src || !tgt) continue;
        const dx = tgt.x! - src.x!;
        const dy = tgt.y! - src.y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - k) * attraction;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        src.vx = (src.vx || 0) + fx;
        src.vy = (src.vy || 0) + fy;
        tgt.vx = (tgt.vx || 0) - fx;
        tgt.vy = (tgt.vy || 0) - fy;
      }

      for (const node of nodes) {
        node.x = Math.max(30, Math.min(width - 30, (node.x || cx) + (node.vx || 0)));
        node.y = Math.max(30, Math.min(height - 30, (node.y || cy) + (node.vy || 0)));
      }

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [data, width, height]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.active) return;
    setPan({
      x: dragRef.current.startPanX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.startPanY + (e.clientY - dragRef.current.startY),
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  const riskColor = (risk: number) => {
    if (risk >= 80) return "#ef4444";
    if (risk >= 60) return "#f97316";
    if (risk >= 40) return "#eab308";
    if (risk >= 20) return "#3b82f6";
    return "#22c55e";
  };

  const nodes = nodesRef.current;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      style={{ position: "relative", width, height, overflow: "hidden", borderRadius: 10, background: "rgba(2, 6, 23, 0.6)", border: "1px solid rgba(51, 65, 85, 0.3)" }}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: dragRef.current.active ? "grabbing" : "grab" }}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {data.edges.map((edge, i) => {
            const src = nodes.find((n) => n.id === edge.source);
            const tgt = nodes.find((n) => n.id === edge.target);
            if (!src || !tgt) return null;
            return (
              <line
                key={i}
                x1={src.x || 0}
                y1={src.y || 0}
                x2={tgt.x || 0}
                y2={tgt.y || 0}
                stroke={hovered === edge.source || hovered === edge.target ? "#06b6d4" : "rgba(51, 65, 85, 0.5)"}
                strokeWidth={hovered === edge.source || hovered === edge.target ? 2 : 1}
                strokeDasharray={hovered === edge.source || hovered === edge.target ? "none" : "4 4"}
              />
            );
          })}
          {nodes.map((node) => {
            const isHovered = hovered === node.id;
            const r = isHovered ? 22 : 18;
            return (
              <g
                key={node.id}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={node.x || 0}
                  cy={node.y || 0}
                  r={r}
                  fill={riskColor(node.risk)}
                  fillOpacity={isHovered ? 0.9 : 0.7}
                  stroke={isHovered ? "#fff" : riskColor(node.risk)}
                  strokeWidth={isHovered ? 2 : 1}
                  filter={isHovered ? "url(#glow)" : undefined}
                />
                <text
                  x={node.x || 0}
                  y={(node.y || 0) + r + 14}
                  textAnchor="middle"
                  fill={isHovered ? "#f8fafc" : "#94a3b8"}
                  fontSize={10}
                  fontWeight={isHovered ? 700 : 500}
                  fontFamily="Inter, sans-serif"
                >
                  {node.label}
                </text>
                {isHovered && (
                  <text
                    x={node.x || 0}
                    y={(node.y || 0) + 4}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={9}
                    fontWeight={700}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {node.risk}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legend */}
      <div style={{ position: "absolute", bottom: 12, left: 12, display: "flex", gap: 12, fontSize: 10, color: "#64748b" }}>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#22c55e", marginRight: 4 }} />Low</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#eab308", marginRight: 4 }} />Med</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#f97316", marginRight: 4 }} />High</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#ef4444", marginRight: 4 }} />Critical</span>
      </div>

      {/* Zoom controls */}
      <div style={{ position: "absolute", top: 12, right: 12, display: "flex", flexDirection: "column", gap: 4 }}>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
          style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(51, 65, 85, 0.5)", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}
        >
          +
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))}
          style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(51, 65, 85, 0.5)", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}
        >
          −
        </motion.button>
      </div>

      {/* Title */}
      <div style={{ position: "absolute", top: 12, left: 12, fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Blast Radius Map
      </div>
    </motion.div>
  );
}
