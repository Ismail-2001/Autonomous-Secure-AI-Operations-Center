"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import Shell from "@/components/Shell";

const DARK = {
  bg: "#0a0e1a",
  card: "#111827",
  cardBorder: "rgba(51,65,85,0.5)",
  cyan: "#22d3ee",
  cyanDim: "rgba(34,211,238,0.15)",
  red: "#ef4444",
  orange: "#f97316",
  green: "#34a853",
  purple: "#a78bfa",
  textPrimary: "#e2e8f0",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  fontMono: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
};

interface Tag {
  label: string;
  color: string;
  bg: string;
  border: string;
}

interface Asset {
  name: string;
  ip: string;
  riskScore: number;
  tags: Tag[];
  owner: string;
  os: string;
  type: string;
  lastSeen: string;
  vulns: number;
}

const assets: Asset[] = [
  {
    name: "SRV-PROD-DB-01",
    ip: "10.0.4.122",
    riskScore: 72,
    tags: [
      { label: "LOG4SHELL", color: DARK.red, bg: "#3b1010", border: "#7f1d1d" },
      { label: "CVE-2023", color: DARK.orange, bg: "#3b2510", border: "#78350f" },
      { label: "+3", color: DARK.textMuted, bg: "#1e293b", border: "#334155" },
    ],
    owner: "SEC_OPS_A",
    os: "LINUX_DEBIAN",
    type: "SERVER",
    lastSeen: "2s ago",
    vulns: 5,
  },
  {
    name: "K8S-NODE-04",
    ip: "10.0.12.89",
    riskScore: 12,
    tags: [
      { label: "HEALTHY", color: DARK.green, bg: "#103b20", border: "#14532d" },
      { label: "ENCRYPTED", color: DARK.green, bg: "#103b20", border: "#14532d" },
    ],
    owner: "INFRA_TEAM",
    os: "UBUNTU_22",
    type: "CONTAINER",
    lastSeen: "5s ago",
    vulns: 0,
  },
  {
    name: "STATION-100",
    ip: "192.168.1.10",
    riskScore: 45,
    tags: [
      { label: "OUTDATED_OS", color: DARK.orange, bg: "#3b2510", border: "#78350f" },
    ],
    owner: "USER_ID_441",
    os: "MACOS_13",
    type: "ENDPOINT",
    lastSeen: "1m ago",
    vulns: 2,
  },
  {
    name: "STATION-101",
    ip: "192.168.1.11",
    riskScore: 46,
    tags: [
      { label: "OUTDATED_OS", color: DARK.orange, bg: "#3b2510", border: "#78350f" },
    ],
    owner: "USER_ID_442",
    os: "MACOS_13",
    type: "ENDPOINT",
    lastSeen: "3m ago",
    vulns: 2,
  },
  {
    name: "STATION-102",
    ip: "192.168.1.12",
    riskScore: 44,
    tags: [
      { label: "OUTDATED_OS", color: DARK.orange, bg: "#3b2510", border: "#78350f" },
    ],
    owner: "USER_ID_443",
    os: "MACOS_13",
    type: "ENDPOINT",
    lastSeen: "45s ago",
    vulns: 1,
  },
  {
    name: "FW-CORE-01",
    ip: "10.0.0.1",
    riskScore: 8,
    tags: [
      { label: "HARDENED", color: DARK.green, bg: "#103b20", border: "#14532d" },
      { label: "FIPS_140", color: DARK.cyan, bg: "#102a3b", border: "#1e3a5f" },
    ],
    owner: "NETOPS",
    os: "PANOS_11",
    type: "FIREWALL",
    lastSeen: "1s ago",
    vulns: 0,
  },
  {
    name: "SIEM-COLLECTOR",
    ip: "10.0.5.200",
    riskScore: 15,
    tags: [
      { label: "HEALTHY", color: DARK.green, bg: "#103b20", border: "#14532d" },
    ],
    owner: "SOC_TEAM",
    os: "RHEL_9",
    type: "SERVER",
    lastSeen: "0s ago",
    vulns: 0,
  },
  {
    name: "WORKSTATION-205",
    ip: "192.168.1.205",
    riskScore: 89,
    tags: [
      { label: "RANSOMWARE", color: DARK.red, bg: "#3b1010", border: "#7f1d1d" },
      { label: "ENCRYPTING", color: DARK.red, bg: "#3b1010", border: "#7f1d1d" },
    ],
    owner: "USER_ID_892",
    os: "WIN_11",
    type: "ENDPOINT",
    lastSeen: "0s ago",
    vulns: 8,
  },
];

const telemetryLogs = [
  { time: "14:02:01", tag: "CONN", tagColor: DARK.cyan, msg: "INCOMING: 192.168.1.55:443 → LOCAL:60212" },
  { time: "14:01:58", tag: "AUTH", tagColor: DARK.red, msg: "FAILED_LOGIN: root FROM 182.1.2.91" },
  { time: "14:01:44", tag: "SYS", tagColor: DARK.green, msg: "KERNEL_UPDATE: COMPLETED_WITHOUT_REBOOT" },
  { time: "13:59:12", tag: "CONN", tagColor: DARK.cyan, msg: "ESTABLISHED: DB_REPL_SERVICE" },
  { time: "13:58:20", tag: "WARN", tagColor: DARK.orange, msg: "DISK_USAGE: 88% ON /var/lib/docker" },
  { time: "13:55:01", tag: "INFO", tagColor: DARK.textMuted, msg: "HEARTBEAT_ACK: LATENCY 12ms" },
  { time: "13:52:30", tag: "SEC", tagColor: DARK.purple, msg: "CERT_ROTATION: TLS_CERT_2024_RENEWED" },
  { time: "13:50:15", tag: "SCAN", tagColor: DARK.cyan, msg: "VULN_SCAN_COMPLETE: 0 NEW FINDINGS" },
];

const topologyNodes = [
  { id: "gw", label: "GATEWAY", x: 60, y: 30, color: DARK.cyan },
  { id: "fw", label: "FW-01", x: 160, y: 30, color: DARK.cyan },
  { id: "srv", label: "SRV-01", x: 260, y: 30, color: DARK.red },
  { id: "db", label: "DB-01", x: 360, y: 30, color: DARK.orange },
  { id: "k8s", label: "K8S-04", x: 160, y: 80, color: DARK.green },
  { id: "siem", label: "SIEM", x: 260, y: 80, color: DARK.cyan },
];

const topologyEdges = [
  { from: "gw", to: "fw" },
  { from: "fw", to: "srv" },
  { from: "srv", to: "db" },
  { from: "fw", to: "k8s" },
  { from: "srv", to: "siem" },
];

const riskColor = (score: number) => {
  if (score >= 60) return DARK.red;
  if (score >= 30) return DARK.orange;
  return DARK.green;
};

const typeIcon = (type: string) => {
  switch (type) {
    case "SERVER": return "🖥️";
    case "CONTAINER": return "📦";
    case "ENDPOINT": return "💻";
    case "FIREWALL": return "🛡️";
    default: return "📡";
  }
};

export default function AssetsPage() {
  const [selectedAsset, setSelectedAsset] = useState<Asset>(assets[0]);
  const [filterOs, setFilterOs] = useState("ALL_SYS");
  const [filterRisk, setFilterRisk] = useState("ALL");
  const [liveAssets, setLiveAssets] = useState<Asset[]>(assets);

  useEffect(() => {
    import("@/lib/api").then(({ api, endpoints }) => {
      api.get(endpoints.assets()).then((data: any) => {
        if (data?.assets?.length) {
          const apiAssets = data.assets.map((a: any) => ({
            name: a.name,
            ip: a.ip_address,
            riskScore: a.risk_score,
            tags: a.vulnerabilities > 0
              ? [{ label: `${a.vulnerabilities} CVE`, color: DARK.red, bg: "#3b1010", border: "#7f1d1d" }]
              : [{ label: "HEALTHY", color: DARK.green, bg: "#103b20", border: "#14532d" }],
            owner: a.owner || "UNKNOWN",
            os: a.os || "UNKNOWN",
            type: "SERVER",
            lastSeen: "0s ago",
            vulns: a.vulnerabilities || 0,
          }));
          const existingNames = new Set(apiAssets.map((a: Asset) => a.name));
          const merged = [...apiAssets, ...assets.filter((a) => !existingNames.has(a.name))];
          setLiveAssets(merged);
        }
      }).catch(() => {});
    });
  }, []);

  const filteredAssets = liveAssets.filter((asset) => {
    if (filterOs !== "ALL_SYS" && asset.os !== filterOs) return false;
    if (filterRisk === "CRITICAL" && asset.riskScore < 60) return false;
    if (filterRisk === "HIGH" && (asset.riskScore < 30 || asset.riskScore >= 60)) return false;
    return true;
  });

  const totalAssets = liveAssets.length;
  const criticalCount = liveAssets.filter((a) => a.riskScore >= 60).length;
  const unmanagedCount = liveAssets.filter((a) => a.owner === "UNKNOWN").length;
  const healthyCount = liveAssets.filter((a) => a.riskScore < 30).length;

  return (
    <Shell>
      <div style={{ background: DARK.bg, minHeight: "100vh", margin: "-24px", padding: 20, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: DARK.textPrimary, overflow: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, flex: 1 }}>

          {/* ════════ LEFT: MAIN CONTENT ════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* ── KPI ROW ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
              {[
                { label: "TOTAL ASSETS", value: `${totalAssets}`, sub: "+2.4% vs last scan", subColor: DARK.cyan, progress: 78, delay: 0 },
                { label: "CRITICAL RISK", value: `${criticalCount}`, badge: "ACTION REQ", badgeColor: DARK.red, dots: criticalCount, delay: 0.05 },
                { label: "UNMANAGED", value: `${unmanagedCount}`, sub: "Discovery needed", subColor: DARK.orange, progress: 34, delay: 0.1 },
                { label: "HEALTHY", value: `${healthyCount}`, badge: "COMPLIANT", badgeColor: DARK.green, sub: "All checks passed", subColor: DARK.green, delay: 0.15 },
              ].map((kpi, i) => (
                <motion.div
                  key={kpi.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: kpi.delay }}
                  style={{ background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden" }}
                >
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${DARK.cyan}40, transparent)` }} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: DARK.textMuted, letterSpacing: "0.08em", fontFamily: DARK.fontMono }}>{kpi.label}</span>
                    {kpi.badge && (
                      <span style={{ fontSize: 9, fontWeight: 600, color: kpi.badgeColor, background: `${kpi.badgeColor}20`, padding: "2px 8px", borderRadius: 4, fontFamily: DARK.fontMono }}>{kpi.badge}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: DARK.textPrimary, fontFamily: DARK.fontMono, lineHeight: 1 }}>{kpi.value}</div>
                  {kpi.sub && <div style={{ fontSize: 11, color: kpi.subColor, fontFamily: DARK.fontMono }}>{kpi.sub}</div>}
                  {kpi.dots !== undefined && (
                    <div style={{ display: "flex", gap: 5, marginTop: 2 }}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <div key={j} style={{ width: 8, height: 8, borderRadius: "50%", background: j < kpi.dots! ? DARK.red : `${DARK.textMuted}40`, boxShadow: j < kpi.dots! ? `0 0 6px ${DARK.red}80` : "none" }} />
                      ))}
                    </div>
                  )}
                  {kpi.progress !== undefined && (
                    <div style={{ width: "100%", height: 4, background: `${DARK.textMuted}30`, borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${kpi.progress}%` }} transition={{ duration: 1, delay: kpi.delay + 0.3 }} style={{ height: "100%", background: `linear-gradient(90deg, ${DARK.cyan}, ${DARK.cyan}cc)`, borderRadius: 2 }} />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* ── FILTER BAR ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              style={{ background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 10, padding: "12px 18px", display: "flex", alignItems: "center", gap: 16 }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: DARK.cyan, letterSpacing: "0.1em", fontFamily: DARK.fontMono }}>INVENTORY MATRIX</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: DARK.textMuted }}>OS:</span>
                <select value={filterOs} onChange={(e) => setFilterOs(e.target.value)} style={{ background: "#1e293b", border: `1px solid ${DARK.cardBorder}`, color: DARK.textPrimary, fontSize: 11, padding: "4px 8px", borderRadius: 4, fontFamily: DARK.fontMono }}>
                  <option value="ALL_SYS">ALL</option>
                  <option value="LINUX_DEBIAN">LINUX</option>
                  <option value="UBUNTU_22">UBUNTU</option>
                  <option value="MACOS_13">MACOS</option>
                  <option value="WIN_11">WINDOWS</option>
                  <option value="RHEL_9">RHEL</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: DARK.textMuted }}>RISK:</span>
                <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)} style={{ background: "#1e293b", border: `1px solid ${DARK.cardBorder}`, color: DARK.textPrimary, fontSize: 11, padding: "4px 8px", borderRadius: 4, fontFamily: DARK.fontMono }}>
                  <option value="ALL">ALL</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
              <div style={{ marginLeft: "auto", fontSize: 10, color: DARK.textMuted, fontFamily: DARK.fontMono }}>
                DISPLAYING: <span style={{ color: DARK.cyan }}>{filteredAssets.length}</span> ASSETS
              </div>
            </motion.div>

            {/* ── ASSET GRID ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              {filteredAssets.map((asset, i) => {
                const rc = riskColor(asset.riskScore);
                const isSelected = selectedAsset.name === asset.name;
                return (
                  <motion.div
                    key={asset.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.25 + i * 0.04 }}
                    onClick={() => setSelectedAsset(asset)}
                    style={{
                      background: isSelected ? `${DARK.cyan}08` : DARK.card,
                      border: `1px solid ${isSelected ? `${DARK.cyan}60` : DARK.cardBorder}`,
                      borderRadius: 10,
                      padding: 16,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      position: "relative",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: `${rc}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                        {typeIcon(asset.type)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: DARK.textPrimary, fontFamily: DARK.fontMono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.name}</span>
                          <span style={{ fontSize: 18, fontWeight: 700, color: rc, fontFamily: DARK.fontMono }}>{asset.riskScore}</span>
                        </div>
                        <div style={{ fontSize: 11, color: DARK.textMuted, fontFamily: DARK.fontMono, marginBottom: 8 }}>{asset.ip} · {asset.type}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                          {asset.tags.map((tag) => (
                            <span key={tag.label} style={{ fontSize: 9, fontWeight: 600, color: tag.color, background: tag.bg, border: `1px solid ${tag.border}`, padding: "2px 6px", borderRadius: 3, fontFamily: DARK.fontMono }}>{tag.label}</span>
                          ))}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 10, color: DARK.textMuted }}>
                          <span>Owner: <span style={{ color: DARK.textSecondary }}>{asset.owner}</span></span>
                          <span>OS: <span style={{ color: DARK.textSecondary }}>{asset.os}</span></span>
                          <span style={{ marginLeft: "auto", color: `${DARK.cyan}90` }}>{asset.lastSeen}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* ════════ RIGHT SIDEBAR ════════ */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            {/* ── ASSET INTELLIGENCE UNIT ── */}
            <div style={{ background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={DARK.cyan} strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                </svg>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: DARK.textMuted }}>ASSET INTELLIGENCE UNIT</span>
              </div>

              {/* Selected Target */}
              <div style={{ background: "#0d1117", border: `1px solid ${DARK.cardBorder}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: DARK.textMuted, marginBottom: 6 }}>SELECTED TARGET</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: DARK.textPrimary, fontFamily: DARK.fontMono, marginBottom: 4 }}>{selectedAsset.name}</div>
                <div style={{ fontSize: 12, color: DARK.textMuted, fontFamily: DARK.fontMono, marginBottom: 8 }}>IP: {selectedAsset.ip}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: riskColor(selectedAsset.riskScore), background: `${riskColor(selectedAsset.riskScore)}20`, padding: "3px 8px", borderRadius: 4, fontFamily: DARK.fontMono }}>
                    RISK: {selectedAsset.riskScore >= 60 ? "CRITICAL" : selectedAsset.riskScore >= 30 ? "HIGH" : "LOW"}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: DARK.cyan, background: `${DARK.cyan}15`, padding: "3px 8px", borderRadius: 4, fontFamily: DARK.fontMono }}>
                    {selectedAsset.vulns} VULNS
                  </span>
                </div>
              </div>

              {/* Communication Topology */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: DARK.textMuted, marginBottom: 8 }}>COMMUNICATION TOPOLOGY</div>
                <div style={{ background: "#0d1117", border: `1px solid ${DARK.cardBorder}`, borderRadius: 8, padding: 12, height: 120, position: "relative", overflow: "hidden" }}>
                  <svg width="100%" height="100%" viewBox="0 0 420 100">
                    {topologyEdges.map((edge, i) => {
                      const from = topologyNodes.find((n) => n.id === edge.from)!;
                      const to = topologyNodes.find((n) => n.id === edge.to)!;
                      return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={`${DARK.textMuted}40`} strokeWidth={1} strokeDasharray="4 4" />;
                    })}
                    {topologyNodes.map((node) => (
                      <g key={node.id}>
                        <circle cx={node.x} cy={node.y} r={8} fill={`${node.color}20`} stroke={node.color} strokeWidth={1.5} />
                        <circle cx={node.x} cy={node.y} r={3} fill={node.color} opacity={0.8} />
                        <text x={node.x} y={node.y + 20} textAnchor="middle" fill={DARK.textMuted} fontSize={8} fontFamily={DARK.fontMono}>{node.label}</text>
                      </g>
                    ))}
                  </svg>
                </div>
              </div>

              {/* Telemetry Logs */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: DARK.textMuted }}>TELEMETRY_LOGS</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: DARK.green, background: `${DARK.green}15`, padding: "2px 6px", borderRadius: 3, fontFamily: DARK.fontMono }}>LIVE</span>
                </div>
                <div style={{ background: "#0d1117", border: `1px solid ${DARK.cardBorder}`, borderRadius: 8, padding: 12, maxHeight: 220, overflowY: "auto" }}>
                  {telemetryLogs.map((log, i) => (
                    <div key={i} style={{ fontSize: 10, fontFamily: DARK.fontMono, lineHeight: 1.8, display: "flex", gap: 6 }}>
                      <span style={{ color: DARK.textMuted, flexShrink: 0 }}>{log.time}</span>
                      <span style={{ color: log.tagColor, fontWeight: 600, flexShrink: 0 }}>[{log.tag}]</span>
                      <span style={{ color: DARK.textSecondary }}>{log.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── QUICK ACTIONS ── */}
            <div style={{ background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: DARK.textMuted, marginBottom: 12 }}>QUICK ACTIONS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", fontSize: 12, fontWeight: 600, background: `linear-gradient(135deg, ${DARK.red}, #dc2626)`, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: DARK.fontMono }}
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  ISOLATE_ASSET
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", fontSize: 12, fontWeight: 600, background: "transparent", color: DARK.textPrimary, border: `1px solid ${DARK.cardBorder}`, borderRadius: 8, cursor: "pointer", fontFamily: DARK.fontMono }}
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" /></svg>
                  ALERT_TEAM
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", fontSize: 12, fontWeight: 600, background: "transparent", color: DARK.textPrimary, border: `1px solid ${DARK.cardBorder}`, borderRadius: 8, cursor: "pointer", fontFamily: DARK.fontMono }}
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>
                  PATCH_ASSET
                </motion.button>
              </div>
            </div>

            {/* ── AI AGENT LOG ── */}
            <div style={{ background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: DARK.green, boxShadow: `0 0 8px ${DARK.green}` }} />
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: DARK.textMuted }}>AI AGENT LOG</span>
              </div>
              <div style={{ background: "#0d1117", border: `1px solid ${DARK.cardBorder}`, borderRadius: 8, padding: 12, maxHeight: 180, overflowY: "auto" }}>
                {[
                  { time: "14:02:01", agent: "SCAN_ENGINE", msg: "Vulnerability scan completed on SRV-PROD-DB-01", color: DARK.cyan },
                  { time: "14:01:58", agent: "DETECT_AI", msg: "Anomalous SSH pattern detected from 182.1.2.91", color: DARK.orange },
                  { time: "14:01:44", agent: "RESPONSE_BOT", msg: "Auto-patch applied to K8S-NODE-04 successfully", color: DARK.green },
                  { time: "14:01:30", agent: "FORENSICS", msg: "Memory dump initiated on WORKSTATION-205", color: DARK.purple },
                ].map((log, i) => (
                  <div key={i} style={{ fontSize: 10, fontFamily: DARK.fontMono, lineHeight: 1.8, display: "flex", gap: 6, marginBottom: 4 }}>
                    <span style={{ color: DARK.textMuted, flexShrink: 0 }}>{log.time}</span>
                    <span style={{ color: log.color, fontWeight: 600, flexShrink: 0 }}>[{log.agent}]</span>
                    <span style={{ color: DARK.textSecondary }}>{log.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </Shell>
  );
}
