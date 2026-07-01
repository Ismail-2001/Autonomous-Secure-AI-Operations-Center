"use client";

import React, { useState, useEffect, useCallback } from "react";
import Shell from "@/components/Shell";
import StatCard from "@/components/StatCard";
import TerminalFeed from "@/components/TerminalFeed";
import AgentGrid from "@/components/AgentGrid";
import BlastRadiusGraph from "@/components/BlastRadiusGraph";
import ApprovalModal from "@/components/ApprovalModal";
import { useThreatFeed, type ThreatFeedEvent } from "@/hooks/useThreatFeed";

const DEFAULT_BLAST_RADIUS = {
  nodes: [
    { id: "internet", label: "Internet Gateway", risk: 85, type: "network" },
    { id: "fw01", label: "Firewall-01", risk: 72, type: "network" },
    { id: "web01", label: "Web-Server-01", risk: 65, type: "server" },
    { id: "web02", label: "Web-Server-02", risk: 30, type: "server" },
    { id: "db01", label: "Database-01", risk: 90, type: "database" },
    { id: "app01", label: "App-Server-01", risk: 45, type: "server" },
    { id: "dns", label: "DNS-Resolver", risk: 20, type: "network" },
    { id: "auth", label: "Auth-Service", risk: 55, type: "service" },
    { id: "cache", label: "Redis-Cache", risk: 15, type: "service" },
    { id: "monitor", label: "Monitor-Agent", risk: 10, type: "agent" },
  ],
  edges: [
    { source: "internet", target: "fw01" },
    { source: "fw01", target: "web01" },
    { source: "fw01", target: "web02" },
    { source: "web01", target: "app01" },
    { source: "web02", target: "app01" },
    { source: "app01", target: "db01" },
    { source: "app01", target: "auth" },
    { source: "app01", target: "cache" },
    { source: "dns", target: "fw01" },
    { source: "monitor", target: "db01" },
    { source: "monitor", target: "app01" },
    { source: "monitor", target: "web01" },
  ],
};

export default function LiveMonitoringPage() {
  const feed = useThreatFeed();
  const [simulating, setSimulating] = useState(false);

  const handleSimulate = useCallback(() => {
    setSimulating(true);
    feed.startSimulation();
    setTimeout(() => setSimulating(false), 5000);
  }, [feed]);

  const incidentEvents: ThreatFeedEvent[] = feed.events.filter((e) => e.severity !== "info");
  const telemetryEvents: ThreatFeedEvent[] = feed.backgroundEvents;

  return (
    <Shell onSimulate={handleSimulate} simulating={simulating}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "fade-in 0.4s ease" }}>
        {/* Page Header */}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc", marginBottom: 4 }}>
            Security Operations Dashboard
          </h1>
          <p style={{ fontSize: 13, color: "#64748b" }}>
            Real-time autonomous threat detection, investigation, and response
          </p>
        </div>

        {/* KPI Row */}
        <div className="grid-4">
          <StatCard
            icon={<svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
            label="Active Threats"
            value={feed.stats.threats}
            subValue="↑ 12% from yesterday"
            color="rose"
          />
          <StatCard
            icon={<svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
            label="Neutralized"
            value={feed.stats.neutralized}
            subValue="99.7% detection rate"
            color="emerald"
          />
          <StatCard
            icon={<svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx={12} cy={12} r={10} /><polyline points="12 6 12 12 16 14" /></svg>}
            label="MTTR"
            value={`${feed.stats.mttr || 4.2}m`}
            subValue="↓ 23% improvement"
            color="cyan"
          />
          <StatCard
            icon={<svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx={9} cy={7} r={4} /><path d="M23 21v-2a4 4 0 00-3-3.87m-4-12a4 4 0 010 7.75" /></svg>}
            label="AI Agents"
            value={feed.stats.agents || 7}
            subValue="All operational"
            color="purple"
          />
        </div>

        {/* Main Content Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
          {/* Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Blast Radius */}
            <div className="glass-panel" style={{ padding: 16, animation: "slide-up 0.5s 0.1s both" }}>
              <BlastRadiusGraph data={feed.blastRadius.nodes.length ? feed.blastRadius : DEFAULT_BLAST_RADIUS} width={700} height={380} />
            </div>

            {/* Terminal Feeds */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <TerminalFeed
                title="INCIDENT LOG"
                events={incidentEvents.slice(0, 20)}
                color="#ef4444"
                maxHeight={250}
                icon={<svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
              />
              <TerminalFeed
                title="SYSTEM TELEMETRY"
                events={telemetryEvents.slice(0, 20)}
                color="#06b6d4"
                maxHeight={250}
                icon={<svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}
              />
            </div>
          </div>

          {/* Right Column — Agent Grid */}
          <div className="glass-panel" style={{ padding: 16, animation: "slide-left 0.5s 0.2s both" }}>
            <AgentGrid running={true} />
          </div>
        </div>

        {/* Connection Status Bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          background: "rgba(15, 23, 42, 0.5)",
          borderRadius: 8,
          border: "1px solid rgba(51, 65, 85, 0.3)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className={`status-dot status-dot-${feed.connectionState === "OPEN" ? "online" : feed.connectionState === "RECONNECTING" ? "warning" : "offline"}`} />
            <span style={{ fontSize: 12, color: "#94a3b8" }}>
              WebSocket: <span style={{ color: feed.connectionState === "OPEN" ? "#22c55e" : "#f59e0b", fontWeight: 600 }}>{feed.connectionState}</span>
            </span>
            {feed.reconnectAttempts > 0 && (
              <span style={{ fontSize: 11, color: "#64748b" }}>
                Reconnect attempt {feed.reconnectAttempts}/10
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: "#475569", fontFamily: "JetBrains Mono, monospace" }}>
            {feed.events.length} threats · {feed.backgroundEvents.length} telemetry events
          </span>
        </div>
      </div>

      {/* Approval Modal */}
      {feed.approvalRequest && (
        <ApprovalModal
          action={feed.approvalRequest.action}
          target={feed.approvalRequest.target}
          riskScore={feed.approvalRequest.risk_score}
          reasoning={feed.approvalRequest.reasoning}
          agent={feed.approvalRequest.agent}
          onApprove={() => feed.approveAction(feed.approvalRequest!.id)}
          onDeny={() => feed.denyAction(feed.approvalRequest!.id)}
        />
      )}
    </Shell>
  );
}
