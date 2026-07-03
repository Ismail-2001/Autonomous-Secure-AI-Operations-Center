"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Shell from "@/components/Shell";

interface AgentNode {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  risk: number;
  compromised: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
}

const DARK = {
  bg: "#0a0e1a",
  card: "#111827",
  cardBorder: "rgba(51,65,85,0.5)",
  cyan: "#22d3ee",
  cyanDim: "rgba(34,211,238,0.15)",
  red: "#ef4444",
  orange: "#f97316",
  green: "#34a853",
  textPrimary: "#e2e8f0",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  fontMono: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
};

const AGENTS = [
  { name: "TELEMETRY_CORE", pct: 99.8, status: "Scanning edge nodes...", color: "#22d3ee", icon: "📡" },
  { name: "DETECTION_ENGINE", pct: 82.1, status: "MITRE ATT&CK Mapping...", color: "#f97316", icon: "🔍" },
  { name: "SUPERVISOR_AI", pct: 94.5, status: "Orchestrating response...", color: "#a78bfa", icon: "🧠" },
  { name: "FORENSICS_NODE", pct: 0, status: "Idle - Waiting for dump", color: "#64748b", icon: "🔬" },
  { name: "RESPONSE_BOT_7", pct: 100, status: "Isolating subnet X-09", color: "#ef4444", icon: "⚔️" },
];

const THREATS = [
  {
    severity: "CRITICAL" as const,
    title: "Lateral Movement",
    detail: "SRC: 192.168.1.44 | DST: FINANCE_DB",
    tags: ["SMB_EXPLOIT", "INTERNAL"],
    time: "0.2s ago",
    color: DARK.red,
  },
  {
    severity: "HIGH" as const,
    title: "Unusual Traffic Pattern",
    detail: "Gateway-A reporting burst of 4GB/s",
    tags: ["ANOMALY", "BANDWIDTH"],
    time: "1.8s ago",
    color: DARK.orange,
  },
  {
    severity: "MED" as const,
    title: "Policy Violation",
    detail: "Unauthorized user accessed PROD_LOGS",
    tags: ["POLICY", "UNAUTH_ACCESS"],
    time: "4.5s ago",
    color: "#eab308",
  },
];

const TIMELINE = [
  { time: "2023.10.24 14:01:45", event: "DNS Query: edge-01.asoc.internal" },
  { time: "2023.10.24 14:01:42", event: "Auth success: OPERATOR_042" },
  { time: "2023.10.24 14:01:39", event: "Heartbeat: SENSOR_CLUSTER_6" },
];

const GRAPH_NODES: { id: string; label: string; risk: number; compromised: boolean }[] = [
  { id: "gateway", label: "GATEWAY", risk: 20, compromised: false },
  { id: "fw01", label: "FW-01", risk: 15, compromised: false },
  { id: "web01", label: "WEB-01", risk: 85, compromised: true },
  { id: "app01", label: "APP-01", risk: 60, compromised: true },
  { id: "db01", label: "FINANCE_DB", risk: 95, compromised: true },
  { id: "dns", label: "DNS-01", risk: 10, compromised: false },
  { id: "auth", label: "AUTH-SVC", risk: 30, compromised: false },
  { id: "redis", label: "REDIS-01", risk: 5, compromised: false },
  { id: "monitor", label: "SIEM", risk: 8, compromised: false },
  { id: "sensor", label: "SENSOR-6", risk: 12, compromised: false },
  { id: "edge01", label: "EDGE-01", risk: 25, compromised: false },
  { id: "backup", label: "BACKUP", risk: 10, compromised: false },
];

const GRAPH_EDGES: GraphEdge[] = [
  { source: "gateway", target: "fw01" },
  { source: "fw01", target: "web01" },
  { source: "fw01", target: "dns" },
  { source: "web01", target: "app01" },
  { source: "app01", target: "db01" },
  { source: "app01", target: "auth" },
  { source: "app01", target: "redis" },
  { source: "monitor", target: "web01" },
  { source: "monitor", target: "db01" },
  { source: "sensor", target: "edge01" },
  { source: "edge01", target: "web01" },
  { source: "backup", target: "db01" },
  { source: "dns", target: "gateway" },
];

function KpiCard({
  label,
  value,
  sub,
  subColor,
  badge,
  badgeColor,
  dots,
  progress,
  delay = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  badge?: string;
  badgeColor?: string;
  dots?: number;
  progress?: number;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      style={{
        background: DARK.card,
        border: `1px solid ${DARK.cardBorder}`,
        borderRadius: 10,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${DARK.cyan}40, transparent)`,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: DARK.textMuted,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontFamily: DARK.fontMono,
          }}
        >
          {label}
        </span>
        {badge && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: badgeColor || DARK.red,
              background: `${badgeColor || DARK.red}20`,
              padding: "2px 8px",
              borderRadius: 4,
              fontFamily: DARK.fontMono,
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: DARK.textPrimary,
          fontFamily: DARK.fontMono,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: subColor || DARK.textMuted, fontFamily: DARK.fontMono }}>
          {sub}
        </div>
      )}
      {dots !== undefined && (
        <div style={{ display: "flex", gap: 5, marginTop: 2 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: i < dots ? DARK.red : `${DARK.textMuted}40`,
                boxShadow: i < dots ? `0 0 6px ${DARK.red}80` : "none",
              }}
            />
          ))}
        </div>
      )}
      {progress !== undefined && (
        <div
          style={{
            width: "100%",
            height: 4,
            background: `${DARK.textMuted}30`,
            borderRadius: 2,
            overflow: "hidden",
            marginTop: 4,
          }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, delay: delay + 0.3 }}
            style={{
              height: "100%",
              background: `linear-gradient(90deg, ${DARK.cyan}, ${DARK.cyan}cc)`,
              borderRadius: 2,
            }}
          />
        </div>
      )}
    </motion.div>
  );
}

function AgentCard({ agent, index }: { agent: (typeof AGENTS)[0]; index: number }) {
  const barColor = agent.pct >= 100 ? DARK.red : agent.pct > 0 ? DARK.cyan : `${DARK.textMuted}40`;
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.3 + index * 0.08 }}
      style={{
        background: `${DARK.card}`,
        border: `1px solid ${DARK.cardBorder}`,
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14 }}>{agent.icon}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: agent.color,
            fontFamily: DARK.fontMono,
            flex: 1,
          }}
        >
          {agent.name}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: agent.pct >= 100 ? DARK.red : agent.pct > 0 ? DARK.cyan : DARK.textMuted,
            fontFamily: DARK.fontMono,
          }}
        >
          {agent.pct}%
        </span>
      </div>
      <div style={{ fontSize: 10, color: DARK.textMuted }}>{agent.status}</div>
      {agent.pct > 0 && (
        <div
          style={{
            width: "100%",
            height: 3,
            background: `${DARK.textMuted}30`,
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${agent.pct}%` }}
            transition={{ duration: 1.2, delay: 0.5 + index * 0.1 }}
            style={{
              height: "100%",
              background: barColor,
              borderRadius: 2,
              boxShadow: agent.pct >= 100 ? `0 0 8px ${DARK.red}60` : "none",
            }}
          />
        </div>
      )}
    </motion.div>
  );
}

function ThreatCard({ threat, index }: { threat: (typeof THREATS)[0]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
      style={{
        background: DARK.card,
        border: `1px solid ${DARK.cardBorder}`,
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: threat.color,
            background: `${threat.color}20`,
            padding: "2px 8px",
            borderRadius: 3,
            fontFamily: DARK.fontMono,
          }}
        >
          {threat.severity}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: DARK.textPrimary,
            flex: 1,
          }}
        >
          {threat.title}
        </span>
        <span style={{ fontSize: 10, color: DARK.textMuted, fontFamily: DARK.fontMono }}>
          {threat.time}
        </span>
      </div>
      <div style={{ fontSize: 11, color: DARK.textSecondary, fontFamily: DARK.fontMono }}>
        {threat.detail}
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {threat.tags.map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: DARK.cyan,
              background: `${DARK.cyan}15`,
              padding: "2px 6px",
              borderRadius: 3,
              fontFamily: DARK.fontMono,
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

function BlastRadiusGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const nodesRef = useRef<AgentNode[]>([]);
  const animRef = useRef<number>(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [tick, setTick] = useState(0);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  }>({ active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 });
  const W = 600;
  const H = 380;

  useEffect(() => {
    const cx = W / 2;
    const cy = H / 2;
    nodesRef.current = GRAPH_NODES.map((n) => ({
      ...n,
      x: cx + (Math.random() - 0.5) * 280,
      y: cy + (Math.random() - 0.5) * 200,
      vx: 0,
      vy: 0,
    }));

    let iterations = 0;
    const runTick = () => {
      if (iterations >= 250) return;
      iterations++;
      const nodes = nodesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        let fx = 0,
          fy = 0;
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          fx += (dx / dist) * 2500 / dist;
          fy += (dy / dist) * 2500 / dist;
        }
        fx += (cx - nodes[i].x) * 0.008;
        fy += (cy - nodes[i].y) * 0.008;
        nodes[i].vx = (nodes[i].vx + fx) * 0.82;
        nodes[i].vy = (nodes[i].vy + fy) * 0.82;
      }
      for (const edge of GRAPH_EDGES) {
        const src = nodes.find((n) => n.id === edge.source);
        const tgt = nodes.find((n) => n.id === edge.target);
        if (!src || !tgt) continue;
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 75) * 0.004;
        src.vx += (dx / dist) * force;
        src.vy += (dy / dist) * force;
        tgt.vx -= (dx / dist) * force;
        tgt.vy -= (dy / dist) * force;
      }
      for (const node of nodes) {
        node.x = Math.max(35, Math.min(W - 35, node.x + node.vx));
        node.y = Math.max(35, Math.min(H - 35, node.y + node.vy));
      }
      setTick((t) => t + 1);
      animRef.current = requestAnimationFrame(runTick);
    };
    animRef.current = requestAnimationFrame(runTick);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.4, Math.min(2.5, z - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      };
    },
    [pan]
  );

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

  const nodes = nodesRef.current;

  return (
    <div style={{ position: "relative", width: "100%", height: H, overflow: "hidden", borderRadius: 10 }}>
      <svg
        ref={svgRef}
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: dragRef.current.active ? "grabbing" : "grab", display: "block" }}
      >
        <defs>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={DARK.cyan} stopOpacity={0.4} />
            <stop offset="100%" stopColor={DARK.cyan} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="redGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={DARK.red} stopOpacity={0.5} />
            <stop offset="100%" stopColor={DARK.red} stopOpacity={0} />
          </radialGradient>
          <filter id="edgeGlow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {GRAPH_EDGES.map((edge, i) => {
            const src = nodes.find((n) => n.id === edge.source);
            const tgt = nodes.find((n) => n.id === edge.target);
            if (!src || !tgt) return null;
            const isHighlighted = hovered === edge.source || hovered === edge.target;
            const isCompromisedPath = src.compromised || tgt.compromised;
            return (
              <line
                key={i}
                x1={src.x}
                y1={src.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke={isHighlighted ? DARK.cyan : isCompromisedPath ? `${DARK.red}60` : `${DARK.textMuted}30`}
                strokeWidth={isHighlighted ? 2 : 1}
                strokeDasharray={isCompromisedPath ? "none" : "4 4"}
                filter={isHighlighted ? "url(#edgeGlow)" : "none"}
              />
            );
          })}
          {nodes.map((node) => {
            const isHovered = hovered === node.id;
            const r = isHovered ? 18 : node.compromised ? 14 : 11;
            const color = node.compromised ? DARK.red : DARK.cyan;
            return (
              <g
                key={node.id}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                {node.compromised && (
                  <circle cx={node.x} cy={node.y} r={r + 10} fill="url(#redGlow)" />
                )}
                {isHovered && !node.compromised && (
                  <circle cx={node.x} cy={node.y} r={r + 8} fill="url(#nodeGlow)" />
                )}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r}
                  fill={node.compromised ? `${DARK.red}30` : `${DARK.cyan}20`}
                  stroke={color}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                />
                <circle cx={node.x} cy={node.y} r={r * 0.4} fill={color} opacity={0.8} />
                <text
                  x={node.x}
                  y={node.y + r + 12}
                  textAnchor="middle"
                  fill={isHovered ? DARK.textPrimary : DARK.textMuted}
                  fontSize={9}
                  fontFamily={DARK.fontMono}
                  fontWeight={isHovered ? 600 : 400}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
          {(() => {
            const threatNode = nodes.find((n) => n.id === "web01");
            if (!threatNode) return null;
            return (
              <g>
                <line
                  x1={threatNode.x - 60}
                  y1={threatNode.y - 30}
                  x2={threatNode.x - 15}
                  y2={threatNode.y - 5}
                  stroke={DARK.red}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.7}
                />
                <rect
                  x={threatNode.x - 145}
                  y={threatNode.y - 48}
                  width={130}
                  height={18}
                  rx={3}
                  fill={`${DARK.red}20`}
                  stroke={`${DARK.red}50`}
                  strokeWidth={0.5}
                />
                <text
                  x={threatNode.x - 80}
                  y={threatNode.y - 35}
                  textAnchor="middle"
                  fill={DARK.red}
                  fontSize={8}
                  fontFamily={DARK.fontMono}
                  fontWeight={600}
                >
                  THREAT_ORIGIN: EXFIL_V3
                </text>
              </g>
            );
          })()}
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: 10,
          display: "flex",
          gap: 14,
          fontSize: 9,
          color: DARK.textMuted,
          fontFamily: DARK.fontMono,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: DARK.cyan,
              display: "inline-block",
            }}
          />
          HEALTHY
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: DARK.red,
              display: "inline-block",
            }}
          />
          COMPROMISED
        </span>
      </div>
      <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
        <button
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            background: DARK.card,
            border: `1px solid ${DARK.cardBorder}`,
            color: DARK.textMuted,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontFamily: DARK.fontMono,
          }}
        >
          +
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            background: DARK.card,
            border: `1px solid ${DARK.cardBorder}`,
            color: DARK.textMuted,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontFamily: DARK.fontMono,
          }}
        >
          −
        </button>
      </div>
    </div>
  );
}

export default function LiveMonitoringPage() {
  const [simulating, setSimulating] = useState(false);
  const [stats, setStats] = useState({ active_threats: 3, threats_neutralized: 142, mttr_minutes: 12, ai_agents_active: 7, events_today: 1402, critical_alerts: 3 });
  const [agents, setAgents] = useState<{ name: string; status: string; confidence: number }[]>([]);
  const [incidents, setIncidents] = useState<{ id: string; title: string; severity: string; status: string }[]>([]);

  useEffect(() => {
    import("@/lib/api").then(({ api, endpoints }) => {
      api.get(endpoints.stats()).then((data: any) => setStats(data)).catch(() => {});
      api.get(endpoints.agents()).then((data: any) => setAgents(data.agents || [])).catch(() => {});
      api.get(endpoints.incidents()).then((data: any) => setIncidents(data.incidents || [])).catch(() => {});
    });
  }, []);

  const handleSimulate = useCallback(() => {
    setSimulating(true);
    setTimeout(() => setSimulating(false), 5000);
  }, []);

  return (
    <Shell onSimulate={handleSimulate} simulating={simulating}>
      <div
        style={{
          background: DARK.bg,
          minHeight: "100vh",
          margin: "-24px",
          padding: 20,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          color: DARK.textPrimary,
          overflow: "auto",
        }}
      >
        {/* KPI ROW */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 18 }}>
          <KpiCard
            label="SECURITY SCORE"
            value="94%"
            sub="+1.2% YTD"
            subColor="#34a853"
            progress={94}
            delay={0}
          />
          <KpiCard
            label="ACTIVE THREATS"
            value="03"
            badge="URGENT ACTION"
            badgeColor={DARK.red}
            dots={3}
            delay={0.05}
          />
          <KpiCard
            label="NEUTRALIZED"
            value="142"
            badge="LAST 24H"
            badgeColor={DARK.cyan}
            sub="SYSTEM SELF-HEALING ACTIVE"
            subColor={DARK.cyan}
            delay={0.1}
          />
          <KpiCard
            label="MTTR"
            value="12m"
            sub="-4m AVG"
            subColor="#34a853"
            badge="OPTIMIZED RESPONSE ENGINE"
            badgeColor="#a78bfa"
            delay={0.15}
          />
        </div>

        {/* 3-COLUMN LAYOUT */}
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 320px", gap: 16 }}>
          {/* LEFT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: DARK.textMuted,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontFamily: DARK.fontMono,
                }}
              >
                AI AGENT FLEET
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: DARK.cyan,
                  background: `${DARK.cyan}15`,
                  padding: "3px 8px",
                  borderRadius: 4,
                  fontFamily: DARK.fontMono,
                }}
              >
                7 ONLINE
              </span>
            </motion.div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: 420,
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {AGENTS.map((agent, i) => (
                <AgentCard key={agent.name} agent={agent} index={i} />
              ))}
            </div>
          </div>

          {/* CENTER COLUMN */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            style={{
              background: DARK.card,
              border: `1px solid ${DARK.cardBorder}`,
              borderRadius: 10,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: DARK.textMuted,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    fontFamily: DARK.fontMono,
                  }}
                >
                  NETWORK BLAST RADIUS
                </div>
                <div style={{ fontSize: 10, color: `${DARK.textMuted}80`, marginTop: 2 }}>
                  REAL-TIME PROPAGATION GRAPH
                </div>
              </div>
            </div>
            <BlastRadiusGraph />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: DARK.cyan,
                  background: `${DARK.cyan}12`,
                  border: `1px solid ${DARK.cyan}40`,
                  borderRadius: 6,
                  padding: "6px 14px",
                  cursor: "pointer",
                  fontFamily: DARK.fontMono,
                  letterSpacing: "0.05em",
                }}
              >
                RE-SCAN TOPOLOGY
              </motion.button>
            </div>
          </motion.div>

          {/* RIGHT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* THREAT STREAM */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: DARK.textMuted,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontFamily: DARK.fontMono,
                }}
              >
                THREAT STREAM
              </span>
              <button
                style={{
                  background: "transparent",
                  border: `1px solid ${DARK.cardBorder}`,
                  borderRadius: 4,
                  padding: "4px 8px",
                  color: DARK.textMuted,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10,
                  fontFamily: DARK.fontMono,
                }}
              >
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                FILTER
              </button>
            </motion.div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: 260,
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {THREATS.map((t, i) => (
                <ThreatCard key={i} threat={t} index={i} />
              ))}
            </div>

            {/* TIMELINE */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              style={{
                background: DARK.card,
                border: `1px solid ${DARK.cardBorder}`,
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: DARK.textMuted,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                  fontFamily: DARK.fontMono,
                }}
              >
                TIMELINE
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {TIMELINE.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: DARK.cyan,
                        marginTop: 5,
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div style={{ fontSize: 9, color: DARK.textMuted, fontFamily: DARK.fontMono }}>
                        {item.time}
                      </div>
                      <div style={{ fontSize: 10, color: DARK.textSecondary, fontFamily: DARK.fontMono }}>
                        {item.event}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* APPROVAL REQUIRED */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              style={{
                background: DARK.card,
                border: `1px solid ${DARK.cardBorder}`,
                borderRadius: 10,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: DARK.orange,
                    boxShadow: `0 0 8px ${DARK.orange}80`,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: DARK.orange,
                    letterSpacing: "0.08em",
                    fontFamily: DARK.fontMono,
                  }}
                >
                  APPROVAL REQUIRED
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, color: DARK.textMuted, fontFamily: DARK.fontMono }}>
                    ACTION:
                  </span>
                  <span style={{ fontSize: 10, color: DARK.textPrimary, fontWeight: 600, fontFamily: DARK.fontMono }}>
                    ISOLATE_HOST_302
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, color: DARK.textMuted, fontFamily: DARK.fontMono }}>
                    CONFIDENCE:
                  </span>
                  <span style={{ fontSize: 10, color: DARK.cyan, fontWeight: 600, fontFamily: DARK.fontMono }}>
                    98.4%
                  </span>
                </div>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: DARK.textSecondary,
                  fontStyle: "italic",
                  lineHeight: 1.5,
                  borderLeft: `2px solid ${DARK.cyan}40`,
                  paddingLeft: 8,
                }}
              >
                &quot;Host exhibiting behavior consistent with BlackCat ransomware encryption
                phase.&quot;
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    flex: 1,
                    fontSize: 10,
                    fontWeight: 700,
                    color: DARK.bg,
                    background: DARK.cyan,
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 0",
                    cursor: "pointer",
                    fontFamily: DARK.fontMono,
                    letterSpacing: "0.05em",
                  }}
                >
                  APPROVE
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    flex: 1,
                    fontSize: 10,
                    fontWeight: 700,
                    color: DARK.textMuted,
                    background: `${DARK.textMuted}20`,
                    border: `1px solid ${DARK.cardBorder}`,
                    borderRadius: 6,
                    padding: "8px 0",
                    cursor: "pointer",
                    fontFamily: DARK.fontMono,
                    letterSpacing: "0.05em",
                  }}
                >
                  REJECT
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
