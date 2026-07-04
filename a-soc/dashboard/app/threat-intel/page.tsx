"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Shell from "@/components/Shell";
import { api, endpoints, ThreatIndicator } from "@/lib/api";

const IOC_CARDS = [
  {
    id: 1,
    tlp: "RED" as const,
    tlpColor: "#ef4444",
    value: "8f4c1e5509...289cc",
    type: "RANSOMWARE",
    typeColor: "#ef4444",
    typeBg: "rgba(239,68,68,0.15)",
    time: "2m ago",
  },
  {
    id: 2,
    tlp: "AMBER" as const,
    tlpColor: "#f59e0b",
    value: "192.168.44.102",
    type: "C2 BEACON",
    typeColor: "#f59e0b",
    typeBg: "rgba(245,158,11,0.15)",
    time: "15m ago",
  },
  {
    id: 3,
    tlp: "GREEN" as const,
    tlpColor: "#22c55e",
    value: "update.microsoft-sys.net",
    type: "PHISHING",
    typeColor: "#22c55e",
    typeBg: "rgba(34,197,94,0.15)",
    time: "1h ago",
  },
  {
    id: 4,
    tlp: "RED" as const,
    tlpColor: "#ef4444",
    value: "ae332fb401...7d81c",
    type: "EXFILTRATION",
    typeColor: "#ef4444",
    typeBg: "rgba(239,68,68,0.15)",
    time: "3h ago",
  },
];

const MITRE_CATEGORIES = [
  {
    name: "INITIAL ACCESS",
    techniques: [
      { name: "Drive-by Compromise", status: "detected" as const },
      { name: "Phishing", status: "covered" as const },
    ],
  },
  {
    name: "EXECUTION",
    techniques: [
      { name: "Command and Scripting Interp.", status: "covered" as const },
      { name: "Exploit Public-Facing App", status: "covered" as const },
      { name: "Native API", status: "unknown" as const },
    ],
  },
  {
    name: "PERSISTENCE",
    techniques: [
      { name: "Account Manipulation", status: "detected" as const },
      { name: "Boot or Logon Autostart", status: "unknown" as const },
      { name: "Scheduled Task/Job", status: "covered" as const },
      { name: "Create Account", status: "unknown" as const },
    ],
  },
  {
    name: "PRIV ESCALATION",
    techniques: [
      { name: "Abuse Elev. Control Mech.", status: "detected" as const },
      { name: "Access Token Manipulation", status: "unknown" as const },
    ],
  },
  {
    name: "DEFENSE EVASION",
    techniques: [
      { name: "Deobfuscate/Decode Files", status: "detected" as const },
      { name: "Impair Defenses", status: "unknown" as const },
      { name: "Hijack Execution Flow", status: "unknown" as const },
      { name: "Indicator Removal", status: "unknown" as const },
    ],
  },
  {
    name: "CREDENTIAL ACCESS",
    techniques: [
      { name: "Brute Force", status: "detected" as const },
      { name: "OS Credential Dumping", status: "unknown" as const },
      { name: "Steal Web Credentials", status: "unknown" as const },
    ],
  },
];

const TARGET_PROFILES = [
  {
    name: "LAZARUS GROUP",
    type: "State-Sponsored (DPRK)",
    tags: [
      { label: "FINANCIAL", color: "#f59e0b" },
      { label: "CRYPTO", color: "#06b6d4" },
    ],
    risk: 94,
  },
  {
    name: "Sandworm",
    type: "Intelligence (RUS)",
    tags: [
      { label: "GOVERNMENT", color: "#a855f7" },
      { label: "STEALTH", color: "#22c55e" },
    ],
    risk: 88,
  },
];

function ExternalLinkIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx={12} cy={5} rx={9} ry={3} />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx={9} cy={7} r={4} />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={12} r={10} />
      <line x1={2} y1={12} x2={22} y2={12} />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

const TLP_COLORS: Record<string, { tlp: string; color: string }> = {
  RED: { tlp: "RED", color: "#ef4444" },
  AMBER: { tlp: "AMBER", color: "#f59e0b" },
  GREEN: { tlp: "GREEN", color: "#22c55e" },
  WHITE: { tlp: "WHITE", color: "#94a3b8" },
};

function mapIndicatorToCard(indicator: ThreatIndicator, index: number) {
  const tlp = TLP_COLORS[indicator.tlp?.toUpperCase()] || TLP_COLORS.GREEN;
  const severityColor =
    indicator.severity === "critical"
      ? "#ef4444"
      : indicator.severity === "high"
        ? "#f59e0b"
        : indicator.severity === "medium"
          ? "#06b6d4"
          : "#22c55e";
  return {
    id: `api-${indicator.id ?? index}`,
    tlp: tlp.tlp as "RED" | "AMBER" | "GREEN",
    tlpColor: tlp.color,
    value: indicator.value,
    type: indicator.type?.toUpperCase() ?? "UNKNOWN",
    typeColor: severityColor,
    typeBg: `${severityColor}25`,
    time: indicator.last_seen
      ? new Date(indicator.last_seen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "recent",
  };
}

export default function ThreatIntelPage() {
  const [hoveredTechnique, setHoveredTechnique] = useState<string | null>(null);
  const [apiIndicators, setApiIndicators] = useState<ReturnType<typeof mapIndicatorToCard>[]>([]);
  const [apiError, setApiError] = useState<boolean>(false);

  useEffect(() => {
    api
      .get<{ indicators: ThreatIndicator[]; count: number }>(endpoints.threatIntel())
      .then((res) => {
        if (res?.indicators?.length) {
          setApiIndicators(res.indicators.map((ind, i) => mapIndicatorToCard(ind, i)));
        }
      })
      .catch(() => {
        setApiError(true);
      });
  }, []);

  const displayIocs = apiIndicators.length > 0 ? apiIndicators : IOC_CARDS;

  return (
    <Shell>
      <div style={{ background: "#0a0e1a", minHeight: "100vh", margin: "-24px", padding: 24, fontFamily: "'Inter', sans-serif" }}>
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#06b6d4" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#06b6d4", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                GLOBAL STRATEGIC INTEL CENTER
              </span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" }}>
              Threat Intelligence
            </h1>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: "8px 18px",
                fontSize: 12,
                fontWeight: 600,
                color: "#94a3b8",
                background: "transparent",
                border: "1px solid #334155",
                borderRadius: 6,
                cursor: "pointer",
                letterSpacing: "0.03em",
              }}
            >
              EXPORT REPORT
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: "8px 18px",
                fontSize: 12,
                fontWeight: 600,
                color: "#fff",
                background: "#06b6d4",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                letterSpacing: "0.03em",
              }}
            >
              + ADD IOC
            </motion.button>
          </div>
        </motion.div>

        {/* 2x2 GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          {/* IOC Database */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid #1e293b",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ color: "#06b6d4" }}>
                <DatabaseIcon />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>IOC Database</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#64748b" }}>{displayIocs.length} active</span>
            </div>
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto" }}>
              {displayIocs.map((ioc, i) => (
                <motion.div
                  key={ioc.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                  style={{
                    padding: "12px 14px",
                    background: "rgba(15, 23, 42, 0.6)",
                    border: `1px solid ${ioc.tlpColor}30`,
                    borderLeft: `3px solid ${ioc.tlpColor}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  whileHover={{ background: "rgba(30, 41, 59, 0.8)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: ioc.tlpColor,
                        background: `${ioc.tlpColor}20`,
                        padding: "2px 8px",
                        borderRadius: 4,
                        letterSpacing: "0.05em",
                      }}
                    >
                      TLP:{ioc.tlp}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: ioc.typeColor,
                        background: ioc.typeBg,
                        padding: "2px 8px",
                        borderRadius: 4,
                        letterSpacing: "0.05em",
                      }}
                    >
                      {ioc.type}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#cbd5e1" }}>
                      {ioc.value}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 10, color: "#64748b" }}>{ioc.time}</span>
                      <div style={{ color: "#475569" }}>
                        <ExternalLinkIcon />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <div style={{ padding: "0 12px 12px" }}>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#06b6d4",
                  background: "transparent",
                  border: "1px dashed #06b6d450",
                  borderRadius: 8,
                  cursor: "pointer",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                LOAD HISTORICAL DATA
              </motion.button>
            </div>
          </motion.div>

          {/* MITRE ATT&CK Matrix */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid #1e293b",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>MITRE ATT&CK Matrix</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: "#06b6d4" }} />
                    <span style={{ fontSize: 9, color: "#64748b", fontWeight: 600 }}>COVERED</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: "#f59e0b" }} />
                    <span style={{ fontSize: 9, color: "#64748b", fontWeight: 600 }}>DETECTED</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: "#475569" }} />
                    <span style={{ fontSize: 9, color: "#64748b", fontWeight: 600 }}>UNKNOWN</span>
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 11, color: "#475569" }}>Live coverage and observed techniques</p>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14, maxHeight: 340, overflowY: "auto" }}>
              {MITRE_CATEGORIES.map((cat, ci) => (
                <div key={cat.name}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                    {cat.name}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {cat.techniques.map((tech) => {
                      const statusColor =
                        tech.status === "covered" ? "#06b6d4" : tech.status === "detected" ? "#f59e0b" : "#475569";
                      const isHovered = hoveredTechnique === `${cat.name}-${tech.name}`;
                      return (
                        <motion.div
                          key={tech.name}
                          onMouseEnter={() => setHoveredTechnique(`${cat.name}-${tech.name}`)}
                          onMouseLeave={() => setHoveredTechnique(null)}
                          whileHover={{ scale: 1.03 }}
                          style={{
                            padding: "5px 10px",
                            fontSize: 10,
                            fontWeight: 500,
                            color: statusColor,
                            background: `${statusColor}15`,
                            border: `1px solid ${statusColor}40`,
                            borderRadius: 5,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            opacity: tech.status === "unknown" ? 0.5 : 1,
                          }}
                        >
                          {tech.name}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Target Profiles */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid #1e293b",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ color: "#a855f7" }}>
                <PeopleIcon />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>Target Profiles</span>
            </div>
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {TARGET_PROFILES.map((profile, i) => (
                <motion.div
                  key={profile.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.05 }}
                  style={{
                    padding: "14px 16px",
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid #1e293b",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                  whileHover={{ background: "rgba(30, 41, 59, 0.8)", borderColor: "#334155" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{profile.name}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: profile.risk > 90 ? "#ef4444" : "#f59e0b" }} />
                      <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#94a3b8" }}>{profile.risk}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{profile.type}</p>
                  <div style={{ display: "flex", gap: 6 }}>
                    {profile.tags.map((tag) => (
                      <span
                        key={tag.label}
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          color: tag.color,
                          background: `${tag.color}20`,
                          padding: "2px 8px",
                          borderRadius: 4,
                          letterSpacing: "0.03em",
                        }}
                      >
                        {tag.label}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Relationship Graph */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid #1e293b",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 10 }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx={18} cy={5} r={3} />
                <circle cx={6} cy={12} r={3} />
                <circle cx={18} cy={19} r={3} />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>Relationship Graph</span>
            </div>
            <div style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
              <div style={{ textAlign: "center" }}>
                <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
                  <circle cx={18} cy={5} r={3} />
                  <circle cx={6} cy={12} r={3} />
                  <circle cx={18} cy={19} r={3} />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                <p style={{ fontSize: 12, color: "#475569" }}>Loading graph data...</p>
                <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 16 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: "#06b6d4" }}>24</div>
                    <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase" }}>Nodes</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: "#f59e0b" }}>47</div>
                    <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase" }}>Edges</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: "#ef4444" }}>3</div>
                    <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase" }}>Clusters</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* BOTTOM - Attack Geolocation */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{
            background: "rgba(15, 23, 42, 0.8)",
            border: "1px solid #1e293b",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ color: "#06b6d4" }}>
              <GlobeIcon />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>Attack Geolocation</span>
          </div>
          <div style={{ position: "relative", padding: 24, minHeight: 220, overflow: "hidden" }}>
            {/* World map placeholder with grid */}
            <svg width="100%" height="180" viewBox="0 0 900 180" style={{ opacity: 0.3 }}>
              {/* Grid lines */}
              {Array.from({ length: 19 }).map((_, i) => (
                <line key={`h${i}`} x1={0} y1={i * 10} x2={900} y2={i * 10} stroke="#1e293b" strokeWidth={0.5} />
              ))}
              {Array.from({ length: 91 }).map((_, i) => (
                <line key={`v${i}`} x1={i * 10} y1={0} x2={i * 10} y2={180} stroke="#1e293b" strokeWidth={0.5} />
              ))}
              {/* Simplified world outline */}
              <path
                d="M120,80 Q140,70 160,75 T200,70 L220,72 Q240,68 260,72 T300,68 L320,72 Q340,65 360,70 T400,68 L420,72 Q440,65 460,70 T500,68 L520,72 Q540,65 560,70 T600,68 L620,72 Q640,68 660,72 T700,68 L720,72"
                fill="none"
                stroke="#334155"
                strokeWidth={1}
              />
              <path
                d="M100,90 Q120,85 140,88 T180,85 L200,88 Q220,82 240,88 T280,85 L300,88 Q320,82 340,88 T380,85 L400,88 Q420,82 440,88 T480,85 L500,88 Q520,82 540,88 T580,85 L600,88 Q620,82 640,88 T680,85 L700,88"
                fill="none"
                stroke="#334155"
                strokeWidth={1}
              />
              <path
                d="M140,100 Q160,95 180,98 T220,95 L240,98 Q260,92 280,98 T320,95 L340,98 Q360,92 380,98 T420,95 L440,98 Q460,92 480,98 T520,95 L540,98 Q560,92 580,98 T620,95 L640,98"
                fill="none"
                stroke="#334155"
                strokeWidth={1}
              />
            </svg>

            {/* Pyongyang pin */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, type: "spring" }}
              style={{ position: "absolute", left: "72%", top: "30%" }}
            >
              <div style={{ position: "relative" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 12px #ef444480" }} />
                <motion.div
                  animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ position: "absolute", inset: -4, borderRadius: "50%", border: "2px solid #ef4444", opacity: 0.4 }}
                />
              </div>
              <div style={{ position: "absolute", left: 16, top: -8, whiteSpace: "nowrap" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", letterSpacing: "0.05em" }}>PYONGYANG</div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: "#f1f5f9" }}>42</div>
                <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase" }}>ACTORS</div>
              </div>
            </motion.div>

            {/* Moscow pin */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7, type: "spring" }}
              style={{ position: "absolute", left: "52%", top: "20%" }}
            >
              <div style={{ position: "relative" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b", boxShadow: "0 0 12px #f59e0b80" }} />
                <motion.div
                  animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                  style={{ position: "absolute", inset: -4, borderRadius: "50%", border: "2px solid #f59e0b", opacity: 0.4 }}
                />
              </div>
              <div style={{ position: "absolute", left: 16, top: -8, whiteSpace: "nowrap" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.05em" }}>MOSCOW</div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: "#f1f5f9" }}>89</div>
                <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase" }}>ACTORS</div>
              </div>
            </motion.div>

            {/* Additional subtle pins */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              style={{ position: "absolute", left: "25%", top: "45%" }}
            >
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#06b6d4", boxShadow: "0 0 8px #06b6d460" }} />
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85 }}
              style={{ position: "absolute", left: "35%", top: "55%" }}
            >
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#a855f7", boxShadow: "0 0 8px #a855f760" }} />
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              style={{ position: "absolute", left: "82%", top: "50%" }}
            >
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e60" }} />
            </motion.div>

            {/* Legend */}
            <div style={{ position: "absolute", bottom: 16, right: 20, display: "flex", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />
                <span style={{ fontSize: 9, color: "#64748b" }}>Critical Origin</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
                <span style={{ fontSize: 9, color: "#64748b" }}>High Activity</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#06b6d4" }} />
                <span style={{ fontSize: 9, color: "#64748b" }}>Monitored</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </Shell>
  );
}
