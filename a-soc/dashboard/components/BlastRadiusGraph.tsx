"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface TopologyNode {
  id: string;
  label: string;
  ip: string;
  zone: "DMZ" | "APP" | "DATA" | "CLOUD" | "MGMT";
  type: "gateway" | "firewall" | "server" | "database" | "storage" | "endpoint";
  risk: number; // 0 to 100
  status: "healthy" | "at_risk" | "compromised" | "quarantined";
  cveCount?: number;
  activeThreat?: string;
  isolationReason?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  protocol: "HTTPS" | "SMB" | "SSH" | "SQL" | "DNS" | "INTERNAL";
  status: "normal" | "active_attack" | "blocked" | "monitored";
  bytesPerSec?: string;
}

export interface ExternalThreatEvent {
  id?: string;
  source?: string;
  type?: string;
  severity?: string;
  description?: string;
  payload?: any;
}

interface BlastRadiusGraphProps {
  threatEvents?: ExternalThreatEvent[];
  externalNodes?: TopologyNode[];
  externalEdges?: TopologyEdge[];
  onNodeSelect?: (node: TopologyNode) => void;
  onQuarantineHost?: (nodeId: string, nodeName: string) => void;
  className?: string;
}

const DARK = {
  bg: "#0a0e1a",
  card: "#111827",
  cardBorder: "rgba(51,65,85,0.5)",
  cyan: "#22d3ee",
  cyanDim: "rgba(34,211,238,0.15)",
  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  green: "#10b981",
  purple: "#a78bfa",
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  fontMono: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
};

const ZONE_COLORS: Record<string, { color: string; label: string; bg: string }> = {
  DMZ: { color: DARK.orange, label: "DMZ / PERIMETER", bg: "rgba(249,115,22,0.08)" },
  APP: { color: DARK.cyan, label: "APPLICATION TIER", bg: "rgba(34,211,238,0.08)" },
  DATA: { color: DARK.purple, label: "DATA CORE / STORAGE", bg: "rgba(167,139,250,0.08)" },
  CLOUD: { color: DARK.amber, label: "CLOUD INFRASTRUCTURE", bg: "rgba(245,158,11,0.08)" },
  MGMT: { color: DARK.green, label: "SECURITY & MGMT", bg: "rgba(16,185,129,0.08)" },
};

const DEFAULT_NODES: TopologyNode[] = [
  { id: "gateway", label: "EDGE-GATEWAY-01", ip: "10.0.1.1", zone: "DMZ", type: "gateway", risk: 24, status: "healthy", cveCount: 0 },
  { id: "fw01", label: "CORP-FW-01", ip: "10.0.1.2", zone: "DMZ", type: "firewall", risk: 18, status: "healthy", cveCount: 1 },
  { id: "dns", label: "INTERNAL-DNS", ip: "10.0.1.53", zone: "DMZ", type: "server", risk: 12, status: "healthy", cveCount: 0 },
  { id: "web01", label: "WEB-PROD-01", ip: "10.0.2.10", zone: "DMZ", type: "server", risk: 68, status: "at_risk", cveCount: 3, activeThreat: "T1078 Valid Accounts Probe" },
  { id: "app01", label: "APP-SRV-CORE", ip: "10.0.3.25", zone: "APP", type: "server", risk: 55, status: "at_risk", cveCount: 2 },
  { id: "auth", label: "AUTH-IAM-SVC", ip: "10.0.3.50", zone: "APP", type: "server", risk: 32, status: "healthy", cveCount: 1 },
  { id: "redis", label: "CACHE-REDIS-01", ip: "10.0.3.70", zone: "APP", type: "server", risk: 8, status: "healthy", cveCount: 0 },
  { id: "fin01", label: "SRV-CORP-FIN01", ip: "10.0.4.15", zone: "DATA", type: "server", risk: 94, status: "compromised", cveCount: 5, activeThreat: "T1486 Mass SMB Encryption (.alphv_locked)" },
  { id: "db01", label: "FINANCE_DB", ip: "10.0.4.122", zone: "DATA", type: "database", risk: 86, status: "at_risk", cveCount: 4, activeThreat: "Potential Lateral Target" },
  { id: "backup", label: "BACKUP-VAULT", ip: "10.0.5.90", zone: "DATA", type: "storage", risk: 10, status: "healthy", cveCount: 0 },
  { id: "s3vault", label: "cloud-infra-production", ip: "10.0.12.80", zone: "CLOUD", type: "storage", risk: 42, status: "healthy", cveCount: 1 },
  { id: "siem", label: "SIEM-COLLECTOR", ip: "10.0.6.10", zone: "MGMT", type: "server", risk: 6, status: "healthy", cveCount: 0 },
  { id: "sensor", label: "EDGE-SENSOR-06", ip: "10.0.1.88", zone: "DMZ", type: "endpoint", risk: 14, status: "healthy", cveCount: 0 },
];

const DEFAULT_EDGES: TopologyEdge[] = [
  { id: "e1", source: "gateway", target: "fw01", protocol: "HTTPS", status: "normal" },
  { id: "e2", source: "fw01", target: "dns", protocol: "DNS", status: "normal" },
  { id: "e3", source: "fw01", target: "web01", protocol: "HTTPS", status: "monitored" },
  { id: "e4", source: "web01", target: "app01", protocol: "INTERNAL", status: "monitored" },
  { id: "e5", source: "app01", target: "auth", protocol: "INTERNAL", status: "normal" },
  { id: "e6", source: "app01", target: "redis", protocol: "INTERNAL", status: "normal" },
  { id: "e7", source: "app01", target: "fin01", protocol: "SMB", status: "active_attack", bytesPerSec: "42 MB/s" },
  { id: "e8", source: "fin01", target: "db01", protocol: "SQL", status: "active_attack", bytesPerSec: "84 MB/s" },
  { id: "e9", source: "app01", target: "s3vault", protocol: "HTTPS", status: "normal" },
  { id: "e10", source: "backup", target: "db01", protocol: "INTERNAL", status: "normal" },
  { id: "e11", source: "siem", target: "web01", protocol: "INTERNAL", status: "monitored" },
  { id: "e12", source: "siem", target: "fin01", protocol: "INTERNAL", status: "active_attack" },
  { id: "e13", source: "sensor", target: "gateway", protocol: "INTERNAL", status: "normal" },
];

export default function BlastRadiusGraph({
  threatEvents = [],
  externalNodes,
  externalEdges,
  onNodeSelect,
  onQuarantineHost,
}: BlastRadiusGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const animFrameRef = useRef<number>(0);
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; panX: number; panY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    panX: 0,
    panY: 0,
  });

  const [nodes, setNodes] = useState<TopologyNode[]>([]);
  const [edges, setEdges] = useState<TopologyEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [focusedBlastNodeId, setFocusedBlastNodeId] = useState<string | null>(null);
  const [filterZone, setFilterZone] = useState<string>("ALL");
  const [showCompromisedOnly, setShowCompromisedOnly] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSimulatingContagion, setIsSimulatingContagion] = useState<boolean>(false);
  const [attackWavePhase, setAttackWavePhase] = useState<number>(0);

  const W = 680;
  const H = 400;

  // Initialize and run force-directed placement
  const initTopology = useCallback(() => {
    const rawNodes = externalNodes || DEFAULT_NODES;
    const rawEdges = externalEdges || DEFAULT_EDGES;

    const cx = W / 2;
    const cy = H / 2;

    // Structured initial zone placement
    const zoneOffsets: Record<string, { x: number; y: number }> = {
      DMZ: { x: cx - 210, y: cy - 40 },
      APP: { x: cx - 50, y: cy - 80 },
      DATA: { x: cx + 160, y: cy + 40 },
      CLOUD: { x: cx + 180, y: cy - 120 },
      MGMT: { x: cx - 80, y: cy + 120 },
    };

    const placedNodes: TopologyNode[] = rawNodes.map((n) => {
      const offset = zoneOffsets[n.zone] || { x: cx, y: cy };
      return {
        ...n,
        x: offset.x + (Math.random() - 0.5) * 110,
        y: offset.y + (Math.random() - 0.5) * 90,
        vx: 0,
        vy: 0,
      };
    });

    // Run physics relaxation
    let iters = 0;
    const maxIters = 260;

    const tickPhysics = () => {
      if (iters >= maxIters) {
        setNodes([...placedNodes]);
        return;
      }
      iters++;

      // Repulsion between nodes
      for (let i = 0; i < placedNodes.length; i++) {
        let fx = 0;
        let fy = 0;
        const nA = placedNodes[i];

        for (let j = 0; j < placedNodes.length; j++) {
          if (i === j) continue;
          const nB = placedNodes[j];
          const dx = nA.x! - nB.x!;
          const dy = nA.y! - nB.y!;
          const distSq = dx * dx + dy * dy + 1;
          const dist = Math.sqrt(distSq);
          const force = 3400 / distSq;
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        }

        // Zone attraction anchor
        const anchor = zoneOffsets[nA.zone] || { x: cx, y: cy };
        fx += (anchor.x - nA.x!) * 0.035;
        fy += (anchor.y - nA.y!) * 0.035;

        // Gravity to center
        fx += (cx - nA.x!) * 0.005;
        fy += (cy - nA.y!) * 0.005;

        nA.vx = (nA.vx! + fx) * 0.78;
        nA.vy = (nA.vy! + fy) * 0.78;
      }

      // Spring attraction along edges
      for (const e of rawEdges) {
        const src = placedNodes.find((n) => n.id === e.source);
        const tgt = placedNodes.find((n) => n.id === e.target);
        if (!src || !tgt) continue;
        const dx = tgt.x! - src.x!;
        const dy = tgt.y! - src.y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ideal = e.status === "active_attack" ? 85 : 95;
        const spring = (dist - ideal) * 0.032;
        src.vx! += (dx / dist) * spring;
        src.vy! += (dy / dist) * spring;
        tgt.vx! -= (dx / dist) * spring;
        tgt.vy! -= (dy / dist) * spring;
      }

      // Constrain inside bounds
      for (const n of placedNodes) {
        n.x = Math.max(45, Math.min(W - 45, n.x! + n.vx!));
        n.y = Math.max(45, Math.min(H - 45, n.y! + n.vy!));
      }

      if (iters % 12 === 0 || iters === maxIters) {
        setNodes([...placedNodes]);
      }
      animFrameRef.current = requestAnimationFrame(tickPhysics);
    };

    animFrameRef.current = requestAnimationFrame(tickPhysics);
    setEdges(rawEdges);
  }, [externalNodes, externalEdges]);

  useEffect(() => {
    initTopology();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [initTopology]);

  // React dynamically to incoming real-time threat events / War Game stages
  useEffect(() => {
    if (!threatEvents || threatEvents.length === 0) return;
    const latest = threatEvents[0];
    if (!latest) return;

    const desc = (latest.description || "").toLowerCase();
    const type = (latest.type || "").toLowerCase();
    const payload = latest.payload || {};
    const host = (payload.host || payload.target_path || "").toLowerCase();

    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        // Check if event targets this node
        const isMatch =
          node.label.toLowerCase().includes(host) ||
          node.ip === payload.target_ip ||
          (node.id === "fin01" && (desc.includes("alphv") || desc.includes("fin01") || type.includes("ransomware"))) ||
          (node.id === "s3vault" && (desc.includes("exfiltration") || desc.includes("s3") || host.includes("cloud")));

        if (isMatch) {
          return {
            ...node,
            status: "compromised",
            risk: Math.max(node.risk, 95),
            activeThreat: latest.description || "Active Adversarial Intrusion",
          };
        }
        return node;
      })
    );

    // If active attack detected, highlight connected edges
    setEdges((prevEdges) =>
      prevEdges.map((edge) => {
        if (edge.target === "fin01" || edge.source === "fin01") {
          return { ...edge, status: "active_attack" };
        }
        return edge;
      })
    );
  }, [threatEvents]);

  // Compute blast radius: 1-hop and 2-hop connected nodes from a target
  const blastRadiusInfo = useMemo(() => {
    if (!focusedBlastNodeId) return null;

    const oneHop = new Set<string>();
    const twoHop = new Set<string>();
    const attackEdges = new Set<string>();

    edges.forEach((e) => {
      if (e.source === focusedBlastNodeId) {
        oneHop.add(e.target);
        attackEdges.add(e.id);
      } else if (e.target === focusedBlastNodeId) {
        oneHop.add(e.source);
        attackEdges.add(e.id);
      }
    });

    edges.forEach((e) => {
      if (oneHop.has(e.source) && e.target !== focusedBlastNodeId) {
        twoHop.add(e.target);
      } else if (oneHop.has(e.target) && e.source !== focusedBlastNodeId) {
        twoHop.add(e.source);
      }
    });

    return {
      centerId: focusedBlastNodeId,
      oneHopIds: Array.from(oneHop),
      twoHopIds: Array.from(twoHop),
      attackEdgeIds: Array.from(attackEdges),
    };
  }, [focusedBlastNodeId, edges]);

  // Handle Pan & Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.5, Math.min(2.5, z - e.deltaY * 0.0012)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current.active) return;
    setPan({
      x: dragRef.current.panX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.panY + (e.clientY - dragRef.current.startY),
    });
  };

  const handleMouseUp = () => {
    dragRef.current.active = false;
  };

  // Trigger Client-Side Contagion Demonstration
  const triggerContagionSimulation = () => {
    if (isSimulatingContagion) return;
    setIsSimulatingContagion(true);
    setAttackWavePhase(1);

    // Wave 1: web01 initial access
    setTimeout(() => {
      setAttackWavePhase(2);
      setNodes((prev) =>
        prev.map((n) => (n.id === "web01" ? { ...n, status: "compromised", risk: 85 } : n))
      );
    }, 600);

    // Wave 2: Lateral jump to app01
    setTimeout(() => {
      setAttackWavePhase(3);
      setNodes((prev) =>
        prev.map((n) => (n.id === "app01" ? { ...n, status: "compromised", risk: 90 } : n))
      );
    }, 1400);

    // Wave 3: Critical jump to fin01 & db01
    setTimeout(() => {
      setAttackWavePhase(4);
      setNodes((prev) =>
        prev.map((n) =>
          n.id === "fin01"
            ? { ...n, status: "compromised", risk: 99 }
            : n.id === "db01"
            ? { ...n, status: "at_risk", risk: 82 }
            : n
        )
      );
      setFocusedBlastNodeId("fin01");
    }, 2200);

    // Autonomous containment wave
    setTimeout(() => {
      setAttackWavePhase(5);
      setNodes((prev) =>
        prev.map((n) =>
          n.id === "fin01"
            ? { ...n, status: "quarantined", isolationReason: "OPA Network Quarantine Enforced" }
            : n
        )
      );
      setIsSimulatingContagion(false);
    }, 3800);
  };

  // Node Quarantine Action
  const handleQuarantine = (node: TopologyNode) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === node.id
          ? { ...n, status: "quarantined", isolationReason: "Manual Quarantine Triggered via Blast Radius" }
          : n
      )
    );
    if (onQuarantineHost) {
      onQuarantineHost(node.id, node.label);
    }
  };

  // Filtered nodes
  const displayNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (filterZone !== "ALL" && n.zone !== filterZone) return false;
      if (showCompromisedOnly && n.status === "healthy") return false;
      return true;
    });
  }, [nodes, filterZone, showCompromisedOnly]);

  const displayedIds = useMemo(() => new Set(displayNodes.map((n) => n.id)), [displayNodes]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: H,
        borderRadius: 12,
        background: "#080c16",
        border: `1px solid ${DARK.cardBorder}`,
        overflow: "hidden",
        fontFamily: DARK.fontMono,
        userSelect: "none",
      }}
    >
      {/* SVG CANVAS */}
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
          {/* Cyberpunk Glow Filters */}
          <filter id="nodeGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="redPulse" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <radialGradient id="blastShockwave" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={DARK.red} stopOpacity={0.4} />
            <stop offset="70%" stopColor={DARK.red} stopOpacity={0.12} />
            <stop offset="100%" stopColor={DARK.red} stopOpacity={0} />
          </radialGradient>

          <radialGradient id="quarantineAura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={DARK.green} stopOpacity={0.3} />
            <stop offset="100%" stopColor={DARK.green} stopOpacity={0} />
          </radialGradient>
        </defs>

        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* ZONE BACKGROUND HULLS */}
          <g opacity={0.65}>
            <rect x={15} y={15} width={220} height={360} rx={16} fill="rgba(249,115,22,0.03)" stroke="rgba(249,115,22,0.15)" strokeDasharray="4 4" />
            <text x={30} y={38} fill={DARK.orange} fontSize={8} fontWeight={700} letterSpacing="0.1em">DMZ / PERIMETER</text>

            <rect x={245} y={15} width={180} height={230} rx={16} fill="rgba(34,211,238,0.03)" stroke="rgba(34,211,238,0.15)" strokeDasharray="4 4" />
            <text x={260} y={38} fill={DARK.cyan} fontSize={8} fontWeight={700} letterSpacing="0.1em">APP CLUSTER</text>

            <rect x={435} y={75} width={230} height={300} rx={16} fill="rgba(167,139,250,0.03)" stroke="rgba(167,139,250,0.15)" strokeDasharray="4 4" />
            <text x={450} y={98} fill={DARK.purple} fontSize={8} fontWeight={700} letterSpacing="0.1em">DATA CORE</text>
          </g>

          {/* ACTIVE BLAST RADIUS SHOCKWAVE AURA */}
          {blastRadiusInfo && (
            (() => {
              const cNode = nodes.find((n) => n.id === blastRadiusInfo.centerId);
              if (!cNode || cNode.x == null || cNode.y == null) return null;
              return (
                <g>
                  {/* Concentric expanding ripples */}
                  <circle cx={cNode.x} cy={cNode.y} r={90} fill="url(#blastShockwave)" />
                  <circle cx={cNode.x} cy={cNode.y} r={140} fill="none" stroke={DARK.red} strokeWidth={1} strokeDasharray="5 5" opacity={0.5}>
                    <animate attributeName="r" from="40" to="170" dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.7" to="0" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={cNode.x} cy={cNode.y} r={80} fill="none" stroke={DARK.orange} strokeWidth={1.2} opacity={0.6}>
                    <animate attributeName="r" from="20" to="110" dur="2.4s" begin="0.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.8" to="0" dur="2.4s" begin="0.8s" repeatCount="indefinite" />
                  </circle>
                </g>
              );
            })()
          )}

          {/* NETWORK EDGES */}
          {edges.map((e) => {
            const src = nodes.find((n) => n.id === e.source);
            const tgt = nodes.find((n) => n.id === e.target);
            if (!src || !tgt || src.x == null || src.y == null || tgt.x == null || tgt.y == null) return null;

            // Visibility filter
            if (!displayedIds.has(src.id) && !displayedIds.has(tgt.id)) return null;

            const isAttack = e.status === "active_attack" || src.status === "compromised" || tgt.status === "compromised";
            const isQuarantined = src.status === "quarantined" || tgt.status === "quarantined";
            const isHighlighted = hoveredNodeId === e.source || hoveredNodeId === e.target || (blastRadiusInfo && blastRadiusInfo.attackEdgeIds.includes(e.id));

            const strokeColor = isQuarantined
              ? "rgba(16,185,129,0.4)"
              : isAttack
              ? DARK.red
              : isHighlighted
              ? DARK.cyan
              : "rgba(100, 116, 139, 0.25)";

            const strokeWidth = isAttack || isHighlighted ? 2.2 : 1.2;

            return (
              <g key={e.id}>
                <line
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={isAttack ? "none" : isQuarantined ? "3 3" : "4 4"}
                  filter={isAttack ? "url(#redPulse)" : isHighlighted ? "url(#nodeGlow)" : undefined}
                />

                {/* Animated Packet Propagation Particle on Attack Paths */}
                {isAttack && !isQuarantined && (
                  <circle r={3.5} fill={DARK.red}>
                    <animate
                      attributeName="cx"
                      from={src.x}
                      to={tgt.x}
                      dur="1.2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="cy"
                      from={src.y}
                      to={tgt.y}
                      dur="1.2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Protocol Badge on Hover or Active Attack */}
                {(isAttack || isHighlighted) && (
                  <g transform={`translate(${(src.x + tgt.x) / 2}, ${(src.y + tgt.y) / 2})`}>
                    <rect x={-20} y={-8} width={40} height={16} rx={4} fill="#0d1424" stroke={strokeColor} strokeWidth={0.8} />
                    <text x={0} y={3} textAnchor="middle" fill={strokeColor} fontSize={7.5} fontWeight={700}>
                      {e.protocol}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* TOPOLOGY NODES */}
          {displayNodes.map((node) => {
            if (node.x == null || node.y == null) return null;

            const isHovered = hoveredNodeId === node.id;
            const isSelected = selectedNode?.id === node.id;
            const isCompromised = node.status === "compromised";
            const isQuarantined = node.status === "quarantined";
            const isAtRisk = node.status === "at_risk";

            // Dim nodes outside blast radius if focused
            const isDimmed =
              blastRadiusInfo &&
              node.id !== blastRadiusInfo.centerId &&
              !blastRadiusInfo.oneHopIds.includes(node.id) &&
              !blastRadiusInfo.twoHopIds.includes(node.id);

            const r = isCompromised ? 16 : isHovered || isSelected ? 15 : 12;

            const nodeColor = isQuarantined
              ? DARK.green
              : isCompromised
              ? DARK.red
              : isAtRisk
              ? DARK.orange
              : DARK.cyan;

            return (
              <g
                key={node.id}
                opacity={isDimmed ? 0.25 : 1}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={() => {
                  setSelectedNode(node);
                  setFocusedBlastNodeId(node.id);
                  if (onNodeSelect) onNodeSelect(node);
                }}
                style={{ cursor: "pointer", transition: "opacity 0.2s ease" }}
              >
                {/* Quarantine Perimeter Shield */}
                {isQuarantined && (
                  <circle r={r + 10} fill="url(#quarantineAura)" stroke={DARK.green} strokeWidth={1.5} strokeDasharray="3 3" />
                )}

                {/* Compromised Warning Glow */}
                {isCompromised && (
                  <circle r={r + 8} fill="url(#blastShockwave)" filter="url(#redPulse)" />
                )}

                {/* Base Node Circle */}
                <circle
                  r={r}
                  fill={isCompromised ? "rgba(239,68,68,0.25)" : isQuarantined ? "rgba(16,185,129,0.25)" : "#0f172a"}
                  stroke={nodeColor}
                  strokeWidth={isSelected || isHovered ? 2.5 : 1.8}
                  filter={isHovered ? "url(#nodeGlow)" : undefined}
                />

                {/* Core Indicator Dot */}
                <circle r={r * 0.35} fill={nodeColor} />

                {/* Type Icon Glyph */}
                <text y={3} textAnchor="middle" fill="#ffffff" fontSize={8} fontWeight={700}>
                  {node.type === "database" ? "DB" : node.type === "firewall" ? "FW" : node.type === "gateway" ? "GW" : "●"}
                </text>

                {/* Node Label & IP */}
                <text
                  y={r + 12}
                  textAnchor="middle"
                  fill={isHovered || isSelected ? DARK.textPrimary : DARK.textSecondary}
                  fontSize={8.5}
                  fontWeight={isSelected ? 800 : 600}
                >
                  {node.label}
                </text>

                <text y={r + 21} textAnchor="middle" fill={DARK.textMuted} fontSize={7}>
                  {node.ip}
                </text>

                {/* Risk Badge Pill */}
                {node.risk >= 50 && (
                  <g transform={`translate(${r - 2}, ${-r + 2})`}>
                    <circle r={6} fill={node.risk >= 80 ? DARK.red : DARK.orange} />
                    <text y={2.5} textAnchor="middle" fill="#ffffff" fontSize={6} fontWeight={800}>
                      {node.risk}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* TOP HEADER CONTROLS BAR */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 12,
          right: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", gap: 6, pointerEvents: "auto" }}>
          {/* Zone Filter */}
          {["ALL", "DMZ", "APP", "DATA"].map((z) => (
            <button
              key={z}
              onClick={() => setFilterZone(z)}
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 4,
                border: `1px solid ${filterZone === z ? DARK.cyan : DARK.cardBorder}`,
                background: filterZone === z ? `${DARK.cyan}20` : "rgba(10,14,26,0.85)",
                color: filterZone === z ? DARK.cyan : DARK.textMuted,
                cursor: "pointer",
                backdropFilter: "blur(4px)",
              }}
            >
              {z}
            </button>
          ))}

          <button
            onClick={() => setShowCompromisedOnly(!showCompromisedOnly)}
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 4,
              border: `1px solid ${showCompromisedOnly ? DARK.red : DARK.cardBorder}`,
              background: showCompromisedOnly ? `${DARK.red}25` : "rgba(10,14,26,0.85)",
              color: showCompromisedOnly ? DARK.red : DARK.textMuted,
              cursor: "pointer",
              backdropFilter: "blur(4px)",
            }}
          >
            ⚠️ COMPROMISED ONLY
          </button>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", gap: 6, pointerEvents: "auto" }}>
          {/* Interactive Simulation Contagion Trigger */}
          <button
            onClick={triggerContagionSimulation}
            disabled={isSimulatingContagion}
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 5,
              border: `1px solid ${isSimulatingContagion ? DARK.amber : "rgba(239,68,68,0.5)"}`,
              background: isSimulatingContagion ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.15)",
              color: isSimulatingContagion ? DARK.amber : "#fca5a5",
              cursor: isSimulatingContagion ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              backdropFilter: "blur(4px)",
            }}
            title="Demonstrate dynamic lateral movement propagation"
          >
            <span>{isSimulatingContagion ? "⚡ CONTAGION WAVE..." : "⚡ SIMULATE SPREAD"}</span>
          </button>

          {/* Reset / Re-scan */}
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
              setFocusedBlastNodeId(null);
              setSelectedNode(null);
              initTopology();
            }}
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "4px 8px",
              borderRadius: 5,
              border: `1px solid ${DARK.cardBorder}`,
              background: "rgba(10,14,26,0.85)",
              color: DARK.textMuted,
              cursor: "pointer",
              backdropFilter: "blur(4px)",
            }}
            title="Reset Pan/Zoom & Re-calculate Forces"
          >
            ⟳ FIT
          </button>

          {/* Zoom In/Out */}
          <div style={{ display: "flex", background: "rgba(10,14,26,0.85)", borderRadius: 5, border: `1px solid ${DARK.cardBorder}` }}>
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
              style={{ background: "transparent", border: "none", color: DARK.textSecondary, padding: "2px 7px", cursor: "pointer", fontSize: 11 }}
            >
              +
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
              style={{ background: "transparent", border: "none", color: DARK.textSecondary, padding: "2px 7px", cursor: "pointer", fontSize: 11 }}
            >
              -
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM LEGEND */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: 12,
          display: "flex",
          gap: 12,
          fontSize: 8.5,
          color: DARK.textMuted,
          background: "rgba(10,14,26,0.8)",
          padding: "4px 8px",
          borderRadius: 4,
          border: `1px solid ${DARK.cardBorder}`,
          backdropFilter: "blur(4px)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: DARK.cyan }} /> HEALTHY
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: DARK.orange }} /> AT RISK
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: DARK.red }} /> COMPROMISED
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: DARK.green }} /> QUARANTINED
        </span>
      </div>

      {/* DOCKED NODE INSPECTOR POPOVER */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ duration: 0.16 }}
            style={{
              position: "absolute",
              top: 10,
              right: 12,
              bottom: 10,
              width: 250,
              background: "rgba(13, 19, 34, 0.94)",
              border: `1px solid ${selectedNode.status === "compromised" ? DARK.red : DARK.cyan}`,
              boxShadow: `0 0 20px ${selectedNode.status === "compromised" ? "rgba(239,68,68,0.25)" : "rgba(34,211,238,0.15)"}`,
              borderRadius: 8,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              zIndex: 30,
              backdropFilter: "blur(12px)",
            }}
          >
            <div>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: 8.5,
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: 3,
                    background:
                      selectedNode.status === "compromised"
                        ? "rgba(239,68,68,0.2)"
                        : selectedNode.status === "quarantined"
                        ? "rgba(16,185,129,0.2)"
                        : "rgba(34,211,238,0.15)",
                    color:
                      selectedNode.status === "compromised"
                        ? DARK.red
                        : selectedNode.status === "quarantined"
                        ? DARK.green
                        : DARK.cyan,
                  }}
                >
                  {selectedNode.status.toUpperCase()}
                </span>
                <button
                  onClick={() => {
                    setSelectedNode(null);
                    setFocusedBlastNodeId(null);
                  }}
                  style={{ background: "none", border: "none", color: DARK.textMuted, cursor: "pointer", fontSize: 12 }}
                >
                  ✕
                </button>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: DARK.textPrimary, marginBottom: 2 }}>
                {selectedNode.label}
              </div>
              <div style={{ fontSize: 9.5, color: DARK.cyan, marginBottom: 8 }}>
                {selectedNode.ip} · {selectedNode.zone}
              </div>

              {/* Risk Meter */}
              <div style={{ background: DARK.card, padding: 8, borderRadius: 6, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: DARK.textMuted, marginBottom: 4 }}>
                  <span>EXPOSURE SCORE</span>
                  <strong style={{ color: selectedNode.risk >= 70 ? DARK.red : DARK.cyan }}>{selectedNode.risk}/100</strong>
                </div>
                <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${selectedNode.risk}%`,
                      height: "100%",
                      background: selectedNode.risk >= 70 ? DARK.red : selectedNode.risk >= 40 ? DARK.orange : DARK.cyan,
                    }}
                  />
                </div>
              </div>

              {/* Active Threat / Context */}
              {selectedNode.activeThreat && (
                <div style={{ fontSize: 9, color: DARK.red, background: "rgba(239,68,68,0.1)", padding: "6px 8px", borderRadius: 4, marginBottom: 8 }}>
                  <strong>THREAT:</strong> {selectedNode.activeThreat}
                </div>
              )}

              {/* Blast Radius Contagion Summary */}
              {blastRadiusInfo && (
                <div style={{ fontSize: 9, color: DARK.textMuted, lineHeight: 1.4, marginBottom: 8 }}>
                  <div><strong>1-Hop Adjacent:</strong> {blastRadiusInfo.oneHopIds.length} Assets</div>
                  <div><strong>2-Hop Perimeter:</strong> {blastRadiusInfo.twoHopIds.length} Assets</div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {selectedNode.status !== "quarantined" ? (
                <button
                  onClick={() => handleQuarantine(selectedNode)}
                  style={{
                    width: "100%",
                    padding: "7px",
                    background: DARK.red,
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 9.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    letterSpacing: "0.04em",
                  }}
                >
                  ⚡ ISOLATE HOST (QUARANTINE)
                </button>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: "6px",
                    background: "rgba(16,185,129,0.15)",
                    color: DARK.green,
                    borderRadius: 4,
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                >
                  ✓ HOST QUARANTINED
                </div>
              )}

              <button
                onClick={() => setFocusedBlastNodeId(focusedBlastNodeId === selectedNode.id ? null : selectedNode.id)}
                style={{
                  width: "100%",
                  padding: "6px",
                  background: "transparent",
                  color: DARK.cyan,
                  border: `1px solid ${DARK.cyan}50`,
                  borderRadius: 4,
                  fontSize: 9,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {focusedBlastNodeId === selectedNode.id ? "CLEAR BLAST HIGHLIGHT" : "FOCUS BLAST RADIUS"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
