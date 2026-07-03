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
    nodesRef.current = data.nodes.map((n) => ({
      ...n,
      x: cx + (Math.random() - 0.5) * 200,
      y: cy + (Math.random() - 0.5) * 150,
      vx: 0,
      vy: 0,
    }));

    let iterations = 0;
    const tick = () => {
      if (iterations >= 200) return;
      iterations++;
      const nodes = nodesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        let fx = 0, fy = 0;
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const dx = nodes[i].x! - nodes[j].x!;
          const dy = nodes[i].y! - nodes[j].y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          fx += (dx / dist) * 3000 / dist;
          fy += (dy / dist) * 3000 / dist;
        }
        fx += (cx - nodes[i].x!) * 0.01;
        fy += (cy - nodes[i].y!) * 0.01;
        nodes[i].vx = ((nodes[i].vx || 0) + fx) * 0.85;
        nodes[i].vy = ((nodes[i].vy || 0) + fy) * 0.85;
      }
      for (const edge of data.edges) {
        const src = nodes.find((n) => n.id === edge.source);
        const tgt = nodes.find((n) => n.id === edge.target);
        if (!src || !tgt) continue;
        const dx = tgt.x! - src.x!;
        const dy = tgt.y! - src.y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 80) * 0.005;
        src.vx = (src.vx || 0) + (dx / dist) * force;
        src.vy = (src.vy || 0) + (dy / dist) * force;
        tgt.vx = (tgt.vx || 0) - (dx / dist) * force;
        tgt.vy = (tgt.vy || 0) - (dy / dist) * force;
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
    setPan({ x: dragRef.current.startPanX + (e.clientX - dragRef.current.startX), y: dragRef.current.startPanY + (e.clientY - dragRef.current.startY) });
  }, []);

  const handleMouseUp = useCallback(() => { dragRef.current.active = false; }, []);

  const riskColor = (risk: number) => {
    if (risk >= 80) return "#ea4335";
    if (risk >= 60) return "#f9ab00";
    if (risk >= 40) return "#fbbc04";
    if (risk >= 20) return "#4285f4";
    return "#34a853";
  };

  const nodes = nodesRef.current;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{ position: "relative", width, height, overflow: "hidden", borderRadius: 12, background: "#ffffff", border: "1px solid #e5e7eb" }}
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
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {data.edges.map((edge, i) => {
            const src = nodes.find((n) => n.id === edge.source);
            const tgt = nodes.find((n) => n.id === edge.target);
            if (!src || !tgt) return null;
            return (
              <line
                key={i}
                x1={src.x || 0} y1={src.y || 0}
                x2={tgt.x || 0} y2={tgt.y || 0}
                stroke={hovered === edge.source || hovered === edge.target ? "#1a73e8" : "#e5e7eb"}
                strokeWidth={hovered === edge.source || hovered === edge.target ? 2 : 1}
                strokeDasharray={hovered === edge.source || hovered === edge.target ? "none" : "4 4"}
              />
            );
          })}
          {nodes.map((node) => {
            const isHovered = hovered === node.id;
            const r = isHovered ? 20 : 16;
            return (
              <g
                key={node.id}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={node.x || 0} cy={node.y || 0} r={r}
                  fill={riskColor(node.risk)}
                  fillOpacity={isHovered ? 0.9 : 0.7}
                  stroke={isHovered ? "#111827" : riskColor(node.risk)}
                  strokeWidth={isHovered ? 2 : 1}
                />
                <text
                  x={node.x || 0} y={(node.y || 0) + r + 14}
                  textAnchor="middle"
                  fill={isHovered ? "#111827" : "#6b7280"}
                  fontSize={10}
                  fontWeight={isHovered ? 500 : 400}
                >
                  {node.label}
                </text>
                {isHovered && (
                  <text
                    x={node.x || 0} y={(node.y || 0) + 4}
                    textAnchor="middle" fill="#fff" fontSize={9} fontWeight={600}
                    fontFamily="var(--font-mono)"
                  >
                    {node.risk}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div style={{ position: "absolute", bottom: 12, left: 12, display: "flex", gap: 12, fontSize: 10, color: "#9ca3af" }}>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#34a853", marginRight: 4 }} />Low</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#fbbc04", marginRight: 4 }} />Med</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#f9ab00", marginRight: 4 }} />High</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#ea4335", marginRight: 4 }} />Critical</span>
      </div>

      <div style={{ position: "absolute", top: 12, right: 12, display: "flex", flexDirection: "column", gap: 4 }}>
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
          style={{ width: 28, height: 28, borderRadius: 6, background: "#fff", border: "1px solid #e5e7eb", color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}
        >+</motion.button>
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))}
          style={{ width: 28, height: 28, borderRadius: 6, background: "#fff", border: "1px solid #e5e7eb", color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}
        >−</motion.button>
      </div>

      <div style={{ position: "absolute", top: 12, left: 12, fontSize: 12, fontWeight: 500, color: "#6b7280" }}>
        Blast Radius Map
      </div>
    </motion.div>
  );
}
