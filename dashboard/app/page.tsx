"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Shell from "@/components/Shell";
import { useThreatFeed } from "@/hooks/useThreatFeed";
import { SkeletonKPI, SkeletonAgent, SkeletonCard } from "@/components/Skeleton";
import InvestigationPanel from "@/components/InvestigationPanel";
import WarGameModal from "@/components/WarGameModal";
import BlastRadiusGraph from "@/components/BlastRadiusGraph";
import { useAuth } from "@/contexts/AuthContext";
import { type Incident } from "@/lib/api";

interface ThreatNode {
  id: string;
  x: number;
  y: number;
  label: string;
  severity: string;
  createdAt: number;
}

interface AgentProcessing {
  startedAt: number;
  phase: "processing" | "completed";
  confidence: number;
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

function AgentCard({ agent, index, processing }: { agent: (typeof AGENTS)[0]; index: number; processing?: AgentProcessing }) {
  const isProcessing = processing?.phase === "processing";
  const isCompleted = processing?.phase === "completed";
  const pct = isCompleted ? processing.confidence : agent.pct;
  const barColor = isProcessing ? "#eab308" : isCompleted ? "#22c55e" : pct >= 100 ? DARK.red : pct > 0 ? DARK.cyan : `${DARK.textMuted}40`;
  const statusText = isProcessing ? "Processing threat..." : isCompleted ? `Completed (${processing.confidence}% confidence)` : agent.status;
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.3 + index * 0.08 }}
      style={{
        background: isProcessing ? `${DARK.card}` : `${DARK.card}`,
        border: `1px solid ${isProcessing ? "#eab30860" : isCompleted ? "#22c55e50" : DARK.cardBorder}`,
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {isProcessing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, transparent, #eab30820, transparent)`, borderRadius: 8 }}
        />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
        <span style={{ fontSize: 14 }}>{agent.icon}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: isProcessing ? "#eab308" : isCompleted ? "#22c55e" : agent.color,
            fontFamily: DARK.fontMono,
            flex: 1,
          }}
        >
          {agent.name}
        </span>
        {isProcessing ? (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            style={{ fontSize: 12, display: "inline-block", color: "#eab308" }}
          >
            ⟳
          </motion.span>
        ) : (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: isCompleted ? "#22c55e" : pct >= 100 ? DARK.red : pct > 0 ? DARK.cyan : DARK.textMuted,
              fontFamily: DARK.fontMono,
            }}
          >
            {pct}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 10, color: isProcessing ? "#eab308" : isCompleted ? "#22c55e" : DARK.textMuted, position: "relative" }}>
        {statusText}
      </div>
      {(pct > 0 || isProcessing) && (
        <div
          style={{
            width: "100%",
            height: 3,
            background: `${DARK.textMuted}30`,
            borderRadius: 2,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: isProcessing ? "100%" : `${pct}%` }}
            transition={isProcessing ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : { duration: 1.2, delay: 0.5 + index * 0.1 }}
            style={{
              height: "100%",
              background: barColor,
              borderRadius: 2,
              boxShadow: isProcessing ? "0 0 8px #eab30860" : isCompleted ? "0 0 6px #22c55e40" : "none",
            }}
          />
        </div>
      )}
    </motion.div>
  );
}

function ThreatCard({ threat, index, onClick }: { threat: (typeof THREATS)[0]; index: number; onClick?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
      onClick={onClick}
      style={{
        background: DARK.card,
        border: `1px solid ${DARK.cardBorder}`,
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        cursor: onClick ? "pointer" : "default",
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

export default function LiveMonitoringPage() {
  const [simulating, setSimulating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ active_threats: 0, threats_neutralized: 0, mttr_minutes: 0, ai_agents_active: 7, events_today: 0, critical_alerts: 0 });
  const [agents, setAgents] = useState<{ name: string; status: string; confidence: number }[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showWarGameModal, setShowWarGameModal] = useState(false);
  const [newIncident, setNewIncident] = useState({ title: "", description: "", severity: "medium" as string, source: "Dashboard", tags: "" });
  const [creating, setCreating] = useState(false);
  const feed = useThreatFeed();
  const { role } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [sevFilter, setSevFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  // Agent execution visualization state
  const [processingAgents, setProcessingAgents] = useState<Record<string, AgentProcessing>>({});
  const prevEventCountRef = useRef(0);
  const processingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Blast radius threat nodes (appear when threats arrive)
  const [threatNodes, setThreatNodes] = useState<ThreatNode[]>([]);

  useEffect(() => {
    import("@/lib/api").then(({ api, endpoints }) => {
      Promise.all([
        api.get(endpoints.stats()).then((data: any) => setStats(data)).catch(() => {}),
        api.get(endpoints.agents()).then((data: any) => setAgents(data.agents || [])).catch(() => {}),
        api.get(endpoints.incidents()).then((data: any) => setIncidents(data.incidents || [])).catch(() => {}),
      ]).finally(() => setLoading(false));
    });
  }, []);

  useEffect(() => {
    if (loading) return;
    const interval = setInterval(() => {
      import("@/lib/api").then(({ api, endpoints }) => {
        api.get(endpoints.stats()).then((data: any) => setStats(data)).catch(() => {});
        api.get(endpoints.incidents()).then((data: any) => setIncidents(data.incidents || [])).catch(() => {});
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [loading]);

  // Agent execution visualization: when new threats arrive, activate agents
  useEffect(() => {
    if (feed.events.length <= prevEventCountRef.current) return;
    prevEventCountRef.current = feed.events.length;

    const agentPool = ["TELEMETRY_CORE", "DETECTION_ENGINE", "SUPERVISOR_AI", "FORENSICS_NODE", "RESPONSE_BOT_7"];
    const count = 2 + Math.floor(Math.random() * 2);
    const shuffled = [...agentPool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    const newProcessing: Record<string, AgentProcessing> = {};
    selected.forEach(name => {
      newProcessing[name] = { startedAt: Date.now(), phase: "processing", confidence: 0 };
    });
    setProcessingAgents(prev => ({ ...prev, ...newProcessing }));

    const timers: ReturnType<typeof setTimeout>[] = [];
    const delay = 2000 + Math.floor(Math.random() * 1000);
    timers.push(setTimeout(() => {
      setProcessingAgents(prev => {
        const next = { ...prev };
        selected.forEach(name => {
          if (next[name]) next[name] = { ...next[name], phase: "completed", confidence: 70 + Math.floor(Math.random() * 30) };
        });
        return next;
      });
      timers.push(setTimeout(() => {
        setProcessingAgents(prev => {
          const next = { ...prev };
          selected.forEach(name => { delete next[name]; });
          return next;
        });
      }, 800));
    }, delay));

    processingTimersRef.current = timers;
    return () => timers.forEach(t => clearTimeout(t));
  }, [feed.events.length]);

  // Blast radius: add pulsing threat nodes when new events arrive
  useEffect(() => {
    if (feed.events.length === 0) return;
    const latest = feed.events[0];
    if (!latest) return;
    const W = 600, H = 380;
    const id = `threat-${Date.now()}`;
    const newNode: ThreatNode = {
      id,
      x: 100 + Math.random() * (W - 200),
      y: 60 + Math.random() * (H - 120),
      label: latest.source || "THREAT",
      severity: (latest.severity || "low").toUpperCase(),
      createdAt: Date.now(),
    };
    setThreatNodes(prev => [...prev.slice(-4), newNode]);
    const timer = setTimeout(() => {
      setThreatNodes(prev => prev.filter(n => n.id !== id));
    }, 8000);
    return () => clearTimeout(timer);
  }, [feed.events.length]);

  const displayAgents: any[] = agents.length > 0
    ? agents.map((a: any) => ({
        name: a.name,
        pct: a.confidence != null ? Math.round(a.confidence * 100) : 0,
        status: a.status || "active",
        color: a.role === "response" ? "#ef4444" : a.role === "supervisor" ? "#a78bfa" : a.role === "forensics" ? "#64748b" : a.role === "compliance" ? "#22c55e" : "#22d3ee",
        icon: a.role === "response" ? "⚔️" : a.role === "supervisor" ? "🧠" : a.role === "forensics" ? "🔬" : a.role === "detection" ? "🔍" : "📡",
      }))
    : AGENTS;
  const wsThreats = feed.events.map((e: any) => ({
    severity: (e.severity || "low").toUpperCase(),
    title: e.source || e.agent || "Unknown",
    detail: e.description || e.type || "",
    tags: [e.type || "EVENT"],
    time: e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : "now",
    color: e.severity === "critical" ? DARK.red : e.severity === "high" ? DARK.orange : e.severity === "medium" ? "#eab308" : DARK.textMuted,
  }));
  const displayIncidents: any[] = [...wsThreats, ...(incidents.length > 0
    ? incidents.map((inc: any) => ({
        severity: (inc.severity || "low").toUpperCase(),
        title: inc.title || inc.incident_number,
        detail: inc.description || inc.source || "",
        tags: Array.isArray(inc.tags) ? inc.tags : typeof inc.tags === "string" ? JSON.parse(inc.tags || "[]") : [],
        time: inc.created_at ? new Date(inc.created_at).toLocaleTimeString() : "now",
        color: inc.severity === "critical" ? DARK.red : inc.severity === "high" ? DARK.orange : inc.severity === "medium" ? "#eab308" : DARK.textMuted,
        _original: inc,
      }))
    : THREATS)];

  const filteredIncidents = displayIncidents.filter((t) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = (t.title || "").toLowerCase().includes(q) || (t.detail || "").toLowerCase().includes(q) || (t.tags || []).some((tag: string) => tag.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (sevFilter.length > 0 && !sevFilter.includes(t.severity)) return false;
    if (statusFilter.length > 0) {
      const incStatus = t._original?.status || t._original?.triage_status || "";
      if (!statusFilter.includes(incStatus)) return false;
    }
    return true;
  });

  const handleOpenWarGame = useCallback(() => {
    setShowWarGameModal(true);
  }, []);

  const handleWarGameComplete = useCallback(async (_report: any) => {
    try {
      const { api, endpoints } = await import("@/lib/api");
      const [statsData, incidentsData] = await Promise.all([
        api.get(endpoints.stats()).catch(() => null),
        api.get<{ incidents: Incident[] }>(endpoints.incidents()).catch(() => null),
      ]);
      if (statsData) setStats(statsData as any);
      if (incidentsData?.incidents) setIncidents(incidentsData.incidents);
    } catch (e) {
      console.warn("Failed to refresh telemetry after War Game:", e);
    }
  }, []);

  // Global keyboard shortcut: Ctrl+Shift+W to open War Game
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        setShowWarGameModal(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSimulate = useCallback(async () => {
    // Open the comprehensive War Game simulation modal
    setShowWarGameModal(true);
  }, []);

  const handleCreateIncident = async () => {
    if (!newIncident.title.trim() || !newIncident.description.trim()) return;
    setCreating(true);
    try {
      const tags = newIncident.tags.split(",").map((t) => t.trim()).filter(Boolean);
      await import("@/lib/api").then(async ({ api, endpoints }) => {
        await api.post(endpoints.createIncident(), {
          title: newIncident.title,
          description: newIncident.description,
          severity: newIncident.severity,
          source: newIncident.source,
          tags,
        });
        const data = await api.get<{ incidents: Incident[] }>(endpoints.incidents());
        setIncidents(data.incidents || []);
      });
      setShowCreateModal(false);
      setNewIncident({ title: "", description: "", severity: "medium", source: "Dashboard", tags: "" });
    } catch (e) {
      console.error("Create incident failed:", e);
    }
    setCreating(false);
  };

  return (
    <Shell
      onSimulate={handleSimulate}
      onWarGame={handleOpenWarGame}
      simulating={simulating}
      connectionState={feed.connectionState}
    >
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
          {loading ? (
            <>
              <SkeletonKPI />
              <SkeletonKPI />
              <SkeletonKPI />
              <SkeletonKPI />
            </>
          ) : (
            <>
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
                value={String(stats.active_threats || 0).padStart(2, "0")}
                badge="URGENT ACTION"
                badgeColor={DARK.red}
                dots={stats.active_threats || 0}
                delay={0.05}
              />
              <KpiCard
                label="NEUTRALIZED"
                value={String(stats.threats_neutralized || 0)}
                badge="LAST 24H"
                badgeColor={DARK.cyan}
                sub="SYSTEM SELF-HEALING ACTIVE"
                subColor={DARK.cyan}
                delay={0.1}
              />
              <KpiCard
                label="MTTR"
                value={`${stats.mttr_minutes || 0}m`}
                sub="-4m AVG"
                subColor="#34a853"
                badge="OPTIMIZED RESPONSE ENGINE"
                badgeColor="#a78bfa"
                delay={0.15}
              />
            </>
          )}
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
                  color: Object.keys(processingAgents).length > 0 ? "#eab308" : DARK.cyan,
                  background: Object.keys(processingAgents).length > 0 ? "#eab30815" : `${DARK.cyan}15`,
                  padding: "3px 8px",
                  borderRadius: 4,
                  fontFamily: DARK.fontMono,
                }}
              >
                {Object.keys(processingAgents).length > 0 ? `${Object.keys(processingAgents).length} PROCESSING` : `${displayAgents.length} ONLINE`}
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
              {loading ? (
                <>
                  <SkeletonAgent />
                  <SkeletonAgent />
                  <SkeletonAgent />
                  <SkeletonAgent />
                  <SkeletonAgent />
                </>
              ) : displayAgents.map((agent, i) => (
                <AgentCard key={agent.name} agent={agent} index={i} processing={processingAgents[agent.name]} />
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
                  INTERACTIVE TOPOLOGY & CONTAGION ENGINE
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {threatNodes.length > 0 && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      color: DARK.red,
                      background: `${DARK.red}15`,
                      padding: "3px 8px",
                      borderRadius: 4,
                      fontFamily: DARK.fontMono,
                    }}
                  >
                    {threatNodes.length} ACTIVE THREAT{threatNodes.length !== 1 ? "S" : ""}
                  </motion.span>
                )}
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
                  LIVE TOPOLOGY
                </span>
              </div>
            </div>
            <BlastRadiusGraph
              threatEvents={feed.events}
              onQuarantineHost={async (nodeId, nodeName) => {
                try {
                  const { api, endpoints } = await import("@/lib/api");
                  if (selectedIncident) {
                    await api.post(endpoints.triage.addAction(selectedIncident.id), {
                      type: "QUARANTINE_HOST",
                      description: `Network quarantine executed for ${nodeName} (${nodeId}) via Blast Radius graph`,
                      target: nodeName,
                    });
                  }
                } catch (err) {
                  console.warn("Quarantine action execution:", err);
                }
              }}
            />
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
              <span style={{ fontSize: 10, color: DARK.textMuted, fontFamily: DARK.fontMono }}>
                {filteredIncidents.length}/{displayIncidents.length}
              </span>
            </motion.div>

            {/* SEARCH + FILTERS */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              <div style={{ position: "relative" }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={DARK.textMuted} strokeWidth={2} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>
                  <circle cx={11} cy={11} r={8} /><line x1={21} y1={21} x2="16.65" y2="16.65" />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search threats..."
                  style={{
                    width: "100%",
                    padding: "7px 10px 7px 28px",
                    background: DARK.card,
                    border: `1px solid ${DARK.cardBorder}`,
                    borderRadius: 6,
                    color: DARK.textPrimary,
                    fontSize: 11,
                    fontFamily: DARK.fontMono,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = DARK.cyan)}
                  onBlur={(e) => (e.target.style.borderColor = DARK.cardBorder)}
                />
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => {
                  const active = sevFilter.includes(sev);
                  const color = sev === "CRITICAL" ? DARK.red : sev === "HIGH" ? DARK.orange : sev === "MEDIUM" ? "#eab308" : DARK.textMuted;
                  return (
                    <button
                      key={sev}
                      onClick={() => setSevFilter(active ? sevFilter.filter((s) => s !== sev) : [...sevFilter, sev])}
                      style={{
                        padding: "3px 8px",
                        fontSize: 9,
                        fontWeight: 700,
                        fontFamily: DARK.fontMono,
                        letterSpacing: "0.05em",
                        borderRadius: 3,
                        border: `1px solid ${active ? color : DARK.cardBorder}`,
                        background: active ? `${color}25` : "transparent",
                        color: active ? color : DARK.textMuted,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {sev}
                    </button>
                  );
                })}
                <span style={{ width: 1, background: DARK.cardBorder, margin: "0 2px" }} />
                {["active", "investigating", "resolved", "contained"].map((st) => {
                  const active = statusFilter.includes(st);
                  return (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(active ? statusFilter.filter((s) => s !== st) : [...statusFilter, st])}
                      style={{
                        padding: "3px 8px",
                        fontSize: 9,
                        fontWeight: 700,
                        fontFamily: DARK.fontMono,
                        letterSpacing: "0.05em",
                        borderRadius: 3,
                        border: `1px solid ${active ? DARK.cyan : DARK.cardBorder}`,
                        background: active ? `${DARK.cyan}25` : "transparent",
                        color: active ? DARK.cyan : DARK.textMuted,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        textTransform: "uppercase",
                      }}
                    >
                      {st}
                    </button>
                  );
                })}
                {(sevFilter.length > 0 || statusFilter.length > 0 || searchQuery) && (
                  <button
                    onClick={() => { setSevFilter([]); setStatusFilter([]); setSearchQuery(""); }}
                    style={{
                      padding: "3px 8px",
                      fontSize: 9,
                      fontWeight: 700,
                      fontFamily: DARK.fontMono,
                      borderRadius: 3,
                      border: `1px solid ${DARK.cardBorder}`,
                      background: "transparent",
                      color: DARK.textMuted,
                      cursor: "pointer",
                    }}
                  >
                    CLEAR
                  </button>
                )}
              </div>
            </div>
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
              {filteredIncidents.length === 0 ? (
                <div style={{ textAlign: "center", padding: 20, fontSize: 11, color: DARK.textMuted, fontFamily: DARK.fontMono }}>
                  No threats match filters
                </div>
              ) : (
                filteredIncidents.map((t, i) => (
                  <ThreatCard
                    key={i}
                    threat={t}
                    index={i}
                    onClick={t._original ? () => setSelectedIncident(t._original) : undefined}
                  />
                ))
              )}
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
                    {feed.approvalRequest?.action || "ISOLATE_HOST_302"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, color: DARK.textMuted, fontFamily: DARK.fontMono }}>
                    TARGET:
                  </span>
                  <span style={{ fontSize: 10, color: DARK.orange, fontWeight: 600, fontFamily: DARK.fontMono }}>
                    {feed.approvalRequest?.target || "AST-002"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, color: DARK.textMuted, fontFamily: DARK.fontMono }}>
                    CONFIDENCE:
                  </span>
                  <span style={{ fontSize: 10, color: DARK.cyan, fontWeight: 600, fontFamily: DARK.fontMono }}>
                    {feed.approvalRequest ? `${Math.round((feed.approvalRequest.risk_score || 0.95) * 100)}%` : "98.4%"}
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
                &quot;{feed.approvalRequest?.reasoning || "Host exhibiting behavior consistent with BlackCat ransomware encryption phase."}&quot;
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => feed.approveAction(feed.approvalRequest?.id || "apr-default")}
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
                  onClick={() => feed.denyAction(feed.approvalRequest?.id || "apr-default")}
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
      <InvestigationPanel
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onUpdated={() => {
          import("@/lib/api").then(({ api, endpoints }) => {
            api.get(endpoints.incidents()).then((data: any) => setIncidents(data.incidents || [])).catch(() => {});
          });
        }}
        role={role}
      />

      {/* CREATE INCIDENT MODAL */}
      {showCreateModal && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setShowCreateModal(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 90 }} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              width: 480, background: DARK.bg, border: `1px solid ${DARK.cardBorder}`, borderRadius: 12,
              padding: 24, zIndex: 100, fontFamily: DARK.fontMono,
            }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: DARK.textPrimary, letterSpacing: "0.08em" }}>NEW INCIDENT</span>
              <button onClick={() => setShowCreateModal(false)} style={{ background: "none", border: `1px solid ${DARK.cardBorder}`, borderRadius: 4, padding: "4px 8px", color: DARK.textMuted, cursor: "pointer", fontSize: 11 }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 600, color: DARK.textMuted, marginBottom: 4, letterSpacing: "0.08em" }}>TITLE</div>
                <input value={newIncident.title} onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
                  placeholder="e.g. Ransomware Detection on FS-PROD-03"
                  style={{ width: "100%", padding: "8px 10px", background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 6, color: DARK.textPrimary, fontSize: 11, fontFamily: DARK.fontMono, outline: "none", boxSizing: "border-box" }}
                  onFocus={(e) => (e.target.style.borderColor = DARK.cyan)} onBlur={(e) => (e.target.style.borderColor = DARK.cardBorder)} />
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 600, color: DARK.textMuted, marginBottom: 4, letterSpacing: "0.08em" }}>DESCRIPTION</div>
                <textarea value={newIncident.description} onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
                  placeholder="Detailed description of the incident..."
                  rows={3}
                  style={{ width: "100%", padding: "8px 10px", background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 6, color: DARK.textPrimary, fontSize: 11, fontFamily: DARK.fontMono, outline: "none", resize: "vertical", boxSizing: "border-box" }}
                  onFocus={(e) => (e.target.style.borderColor = DARK.cyan)} onBlur={(e) => (e.target.style.borderColor = DARK.cardBorder)} />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: DARK.textMuted, marginBottom: 4, letterSpacing: "0.08em" }}>SEVERITY</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {["critical", "high", "medium", "low"].map((sev) => {
                      const color = sev === "critical" ? DARK.red : sev === "high" ? DARK.orange : sev === "medium" ? "#eab308" : DARK.textMuted;
                      const active = newIncident.severity === sev;
                      return (
                        <button key={sev} onClick={() => setNewIncident({ ...newIncident, severity: sev })}
                          style={{
                            flex: 1, padding: "6px 0", fontSize: 9, fontWeight: 700, fontFamily: DARK.fontMono,
                            borderRadius: 4, border: `1px solid ${active ? color : DARK.cardBorder}`,
                            background: active ? `${color}25` : "transparent", color: active ? color : DARK.textMuted,
                            cursor: "pointer", textTransform: "uppercase",
                          }}>{sev}</button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: DARK.textMuted, marginBottom: 4, letterSpacing: "0.08em" }}>SOURCE</div>
                  <input value={newIncident.source} onChange={(e) => setNewIncident({ ...newIncident, source: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 6, color: DARK.textPrimary, fontSize: 11, fontFamily: DARK.fontMono, outline: "none", boxSizing: "border-box" }}
                    onFocus={(e) => (e.target.style.borderColor = DARK.cyan)} onBlur={(e) => (e.target.style.borderColor = DARK.cardBorder)} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 600, color: DARK.textMuted, marginBottom: 4, letterSpacing: "0.08em" }}>TAGS (comma-separated)</div>
                <input value={newIncident.tags} onChange={(e) => setNewIncident({ ...newIncident, tags: e.target.value })}
                  placeholder="e.g. ransomware, lateral-movement"
                  style={{ width: "100%", padding: "8px 10px", background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 6, color: DARK.textPrimary, fontSize: 11, fontFamily: DARK.fontMono, outline: "none", boxSizing: "border-box" }}
                  onFocus={(e) => (e.target.style.borderColor = DARK.cyan)} onBlur={(e) => (e.target.style.borderColor = DARK.cardBorder)} />
              </div>
              <button onClick={handleCreateIncident} disabled={creating || !newIncident.title.trim() || !newIncident.description.trim()}
                style={{
                  width: "100%", padding: "10px", fontSize: 11, fontWeight: 700, fontFamily: DARK.fontMono,
                  background: newIncident.title.trim() && newIncident.description.trim() ? DARK.cyan : `${DARK.cyan}30`,
                  color: newIncident.title.trim() && newIncident.description.trim() ? DARK.bg : DARK.textMuted,
                  border: "none", borderRadius: 6, cursor: creating || !newIncident.title.trim() ? "not-allowed" : "pointer",
                  letterSpacing: "0.05em",
                }}>
                {creating ? "CREATING..." : "CREATE INCIDENT"}
              </button>
            </div>
          </motion.div>
        </>
      )}

      {/* FLOATING ACTION BUTTONS */}
      {role !== "readonly" && (
        <>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowWarGameModal(true)}
            style={{
              position: "fixed", bottom: 24, right: 84, zIndex: 50,
              height: 48, padding: "0 18px", borderRadius: 24,
              background: "linear-gradient(135deg, rgba(239,68,68,0.95), rgba(185,28,28,0.95))",
              color: "#ffffff",
              border: "1px solid rgba(254, 202, 202, 0.4)",
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 0 24px rgba(239,68,68,0.5)",
              fontSize: 12, fontWeight: 800,
              fontFamily: DARK.fontMono,
              letterSpacing: "0.06em",
            }}
            title="Launch Adversarial War Game Attack Simulation (Ctrl+Shift+W)"
          >
            <span style={{ fontSize: 16 }}>⚔️</span>
            <span>WAR GAME</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreateModal(true)}
            style={{
              position: "fixed", bottom: 24, right: 24, zIndex: 50,
              width: 48, height: 48, borderRadius: "50%",
              background: DARK.cyan, color: DARK.bg,
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 20px ${DARK.cyan}60`,
              fontSize: 20, fontWeight: 700,
            }}
            title="Create Custom Incident"
          >
            +
          </motion.button>
        </>
      )}

      {/* WAR GAME ADVERSARIAL SIMULATION MODAL */}
      <WarGameModal
        isOpen={showWarGameModal}
        onClose={() => setShowWarGameModal(false)}
        onSimulationComplete={handleWarGameComplete}
      />
    </Shell>
  );
}
