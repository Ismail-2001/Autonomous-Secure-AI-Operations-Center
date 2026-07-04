"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
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

const ROWS_PER_PAGE = 6;

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
  {
    name: "BACKUP-SRV-02",
    ip: "10.0.6.50",
    riskScore: 22,
    tags: [
      { label: "HEALTHY", color: DARK.green, bg: "#103b20", border: "#14532d" },
      { label: "ENCRYPTED", color: DARK.green, bg: "#103b20", border: "#14532d" },
    ],
    owner: "BACKUP_OPS",
    os: "RHEL_9",
    type: "SERVER",
    lastSeen: "10s ago",
    vulns: 0,
  },
  {
    name: "API-GATEWAY-01",
    ip: "10.0.3.100",
    riskScore: 34,
    tags: [
      { label: "WAF_ACTIVE", color: DARK.cyan, bg: "#102a3b", border: "#1e3a5f" },
      { label: "RATE_LIMITED", color: DARK.purple, bg: "#2e1065", border: "#4c1d95" },
    ],
    owner: "NETOPS",
    os: "ALPINE_3",
    type: "CONTAINER",
    lastSeen: "1s ago",
    vulns: 1,
  },
  {
    name: "WORKSTATION-310",
    ip: "192.168.1.310",
    riskScore: 67,
    tags: [
      { label: "MALWARE", color: DARK.red, bg: "#3b1010", border: "#7f1d1d" },
      { label: "C2_DETECTED", color: DARK.red, bg: "#3b1010", border: "#7f1d1d" },
    ],
    owner: "USER_ID_118",
    os: "WIN_11",
    type: "ENDPOINT",
    lastSeen: "0s ago",
    vulns: 4,
  },
  {
    name: "MONITORING-STACK",
    ip: "10.0.7.200",
    riskScore: 5,
    tags: [
      { label: "HEALTHY", color: DARK.green, bg: "#103b20", border: "#14532d" },
    ],
    owner: "SOC_TEAM",
    os: "UBUNTU_22",
    type: "SERVER",
    lastSeen: "0s ago",
    vulns: 0,
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
  { id: "gw", label: "GATEWAY", x: 60, y: 40, color: DARK.cyan },
  { id: "fw", label: "FW-01", x: 160, y: 40, color: DARK.cyan },
  { id: "srv", label: "SRV-01", x: 260, y: 40, color: DARK.red },
  { id: "db", label: "DB-01", x: 360, y: 40, color: DARK.orange },
  { id: "k8s", label: "K8S-04", x: 110, y: 100, color: DARK.green },
  { id: "siem", label: "SIEM", x: 210, y: 100, color: DARK.cyan },
  { id: "ws", label: "WS-205", x: 310, y: 100, color: DARK.red },
];

const topologyEdges = [
  { from: "gw", to: "fw" },
  { from: "fw", to: "srv" },
  { from: "srv", to: "db" },
  { from: "fw", to: "k8s" },
  { from: "srv", to: "siem" },
  { from: "srv", to: "ws" },
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

function KpiCard({ label, value, sub, subColor, badge, badgeColor, progress, delay }: {
  label: string; value: string; sub?: string; subColor?: string;
  badge?: string; badgeColor?: string; progress?: number; delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: delay || 0 }}
      style={{ background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden" }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${DARK.cyan}40, transparent)` }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: DARK.textMuted, letterSpacing: "0.08em", fontFamily: DARK.fontMono }}>{label}</span>
        {badge && <span style={{ fontSize: 9, fontWeight: 600, color: badgeColor, background: `${badgeColor}20`, padding: "2px 8px", borderRadius: 4, fontFamily: DARK.fontMono }}>{badge}</span>}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color: DARK.textPrimary, fontFamily: DARK.fontMono, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: subColor, fontFamily: DARK.fontMono }}>{sub}</div>}
      {progress !== undefined && (
        <div style={{ width: "100%", height: 4, background: `${DARK.textMuted}30`, borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1, delay: (delay || 0) + 0.3 }}
            style={{ height: "100%", background: `linear-gradient(90deg, ${DARK.cyan}, ${DARK.cyan}cc)`, borderRadius: 2 }}
          />
        </div>
      )}
    </motion.div>
  );
}

export default function AssetsPage() {
  const [selectedAsset, setSelectedAsset] = useState<Asset>(assets[0]);
  const [filterOs, setFilterOs] = useState("ALL_SYS");
  const [filterRisk, setFilterRisk] = useState("ALL");
  const [page, setPage] = useState(1);
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

  const filteredAssets = useMemo(() => liveAssets.filter((asset) => {
    if (filterOs !== "ALL_SYS" && asset.os !== filterOs) return false;
    if (filterRisk === "CRITICAL" && asset.riskScore < 60) return false;
    if (filterRisk === "HIGH" && (asset.riskScore < 30 || asset.riskScore >= 60)) return false;
    return true;
  }), [liveAssets, filterOs, filterRisk]);

  const totalPages = Math.ceil(filteredAssets.length / ROWS_PER_PAGE);
  const pagedAssets = filteredAssets.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

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
              <KpiCard label="TOTAL ASSETS" value={`${totalAssets}`} sub="+2.4% vs last scan" subColor={DARK.cyan} progress={78} delay={0} />
              <KpiCard label="CRITICAL RISK" value={`${criticalCount}`} badge="ACTION REQ" badgeColor={DARK.red} delay={0.05} />
              <KpiCard label="UNMANAGED" value={`${unmanagedCount}`} sub="Discovery needed" subColor={DARK.orange} progress={34} delay={0.1} />
              <KpiCard label="HEALTHY" value={`${healthyCount}`} badge="COMPLIANT" badgeColor={DARK.green} sub="All checks passed" subColor={DARK.green} delay={0.15} />
            </div>

            {/* ── FILTER BAR ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              style={{ background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 10, padding: "12px 18px", display: "flex", alignItems: "center", gap: 16 }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: DARK.cyan, letterSpacing: "0.1em", fontFamily: DARK.fontMono }}>INVENTORY MATRIX</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: DARK.textMuted }}>OS:</span>
                <select value={filterOs} onChange={(e) => { setFilterOs(e.target.value); setPage(1); }}
                  style={{ background: "#1e293b", border: `1px solid ${DARK.cardBorder}`, color: DARK.textPrimary, fontSize: 11, padding: "4px 8px", borderRadius: 4, fontFamily: DARK.fontMono }}
                >
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
                <select value={filterRisk} onChange={(e) => { setFilterRisk(e.target.value); setPage(1); }}
                  style={{ background: "#1e293b", border: `1px solid ${DARK.cardBorder}`, color: DARK.textPrimary, fontSize: 11, padding: "4px 8px", borderRadius: 4, fontFamily: DARK.fontMono }}
                >
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

            {/* ── ASSET TABLE ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              style={{ background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 10, overflow: "hidden" }}
            >
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: DARK.fontMono }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${DARK.cardBorder}` }}>
                      {["ASSET", "IP", "TYPE", "RISK", "VULNS", "OWNER", "LAST SEEN"].map((h) => (
                        <th key={h} style={{ padding: "10px 14px", fontSize: 9, fontWeight: 600, color: DARK.textMuted, letterSpacing: "0.08em", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedAssets.map((asset) => {
                      const rc = riskColor(asset.riskScore);
                      const isSelected = selectedAsset.name === asset.name;
                      return (
                        <tr key={asset.name} onClick={() => setSelectedAsset(asset)}
                          style={{ borderBottom: `1px solid ${DARK.cardBorder}`, cursor: "pointer", background: isSelected ? `${DARK.cyan}08` : "transparent", transition: "background 0.15s" }}
                          onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = `${DARK.cardBorder}`; }}
                          onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                        >
                          <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: DARK.textPrimary, whiteSpace: "nowrap" }}>
                            <span style={{ marginRight: 8 }}>{typeIcon(asset.type)}</span>
                            {asset.name}
                          </td>
                          <td style={{ padding: "10px 14px", fontSize: 11, color: DARK.textSecondary }}>{asset.ip}</td>
                          <td style={{ padding: "10px 14px", fontSize: 10, color: DARK.textMuted }}>{asset.type}</td>
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: rc }}>{asset.riskScore}</span>
                          </td>
                          <td style={{ padding: "10px 14px", fontSize: 11, color: asset.vulns > 0 ? DARK.red : DARK.green, fontWeight: 600 }}>{asset.vulns}</td>
                          <td style={{ padding: "10px 14px", fontSize: 10, color: DARK.textMuted }}>{asset.owner}</td>
                          <td style={{ padding: "10px 14px", fontSize: 10, color: `${DARK.cyan}90` }}>{asset.lastSeen}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── PAGINATION ── */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderTop: `1px solid ${DARK.cardBorder}` }}>
                <span style={{ fontSize: 10, color: DARK.textMuted, fontFamily: DARK.fontMono }}>
                  PAGE {page} of {totalPages} — {filteredAssets.length} TOTAL
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    style={{ padding: "4px 12px", fontSize: 10, fontWeight: 600, color: page === 1 ? `${DARK.textMuted}60` : DARK.textPrimary, background: "#1e293b", border: `1px solid ${DARK.cardBorder}`, borderRadius: 4, cursor: page === 1 ? "default" : "pointer", fontFamily: DARK.fontMono }}
                  >
                    PREV
                  </button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    style={{ padding: "4px 12px", fontSize: 10, fontWeight: 600, color: page === totalPages ? `${DARK.textMuted}60` : DARK.textPrimary, background: "#1e293b", border: `1px solid ${DARK.cardBorder}`, borderRadius: 4, cursor: page === totalPages ? "default" : "pointer", fontFamily: DARK.fontMono }}
                  >
                    NEXT
                  </button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* ════════ RIGHT SIDEBAR ════════ */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            {/* ── SELECTED TARGET ── */}
            <div style={{ background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 12, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={DARK.cyan} strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                </svg>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: DARK.textMuted, fontFamily: DARK.fontMono }}>SELECTED TARGET</span>
              </div>
              <div style={{ background: "#0d1117", border: `1px solid ${DARK.cardBorder}`, borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: DARK.textPrimary, fontFamily: DARK.fontMono, marginBottom: 4 }}>{selectedAsset.name}</div>
                <div style={{ fontSize: 12, color: DARK.textMuted, fontFamily: DARK.fontMono, marginBottom: 8 }}>IP: {selectedAsset.ip}</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: riskColor(selectedAsset.riskScore), background: `${riskColor(selectedAsset.riskScore)}20`, padding: "3px 8px", borderRadius: 4, fontFamily: DARK.fontMono }}>
                    RISK: {selectedAsset.riskScore >= 60 ? "CRITICAL" : selectedAsset.riskScore >= 30 ? "HIGH" : "LOW"}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: DARK.cyan, background: `${DARK.cyan}15`, padding: "3px 8px", borderRadius: 4, fontFamily: DARK.fontMono }}>
                    {selectedAsset.vulns} VULNS
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                  {selectedAsset.tags.map((tag) => (
                    <span key={tag.label} style={{ fontSize: 9, fontWeight: 600, color: tag.color, background: tag.bg, border: `1px solid ${tag.border}`, padding: "2px 6px", borderRadius: 3, fontFamily: DARK.fontMono }}>{tag.label}</span>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: DARK.textMuted, fontFamily: DARK.fontMono }}>
                  Owner: <span style={{ color: DARK.textSecondary }}>{selectedAsset.owner}</span> · OS: <span style={{ color: DARK.textSecondary }}>{selectedAsset.os}</span>
                </div>
              </div>
            </div>

            {/* ── QUICK ACTIONS ── */}
            <div style={{ background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: DARK.textMuted, marginBottom: 10, fontFamily: DARK.fontMono }}>QUICK ACTIONS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", fontSize: 11, fontWeight: 600, background: `linear-gradient(135deg, ${DARK.red}, #dc2626)`, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: DARK.fontMono }}
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  ISOLATE ASSET
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", fontSize: 11, fontWeight: 600, background: "transparent", color: DARK.textPrimary, border: `1px solid ${DARK.cardBorder}`, borderRadius: 8, cursor: "pointer", fontFamily: DARK.fontMono }}
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" /></svg>
                  ALERT TEAM
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", fontSize: 11, fontWeight: 600, background: "transparent", color: DARK.textPrimary, border: `1px solid ${DARK.cardBorder}`, borderRadius: 8, cursor: "pointer", fontFamily: DARK.fontMono }}
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>
                  PATCH ASSET
                </motion.button>
              </div>
            </div>

            {/* ── COMMUNICATION TOPOLOGY ── */}
            <div style={{ background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 12, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: DARK.textMuted, fontFamily: DARK.fontMono }}>COMMUNICATION TOPOLOGY</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: DARK.cyan, background: `${DARK.cyan}15`, padding: "2px 6px", borderRadius: 3, fontFamily: DARK.fontMono }}>7 NODES</span>
              </div>
              <div style={{ background: "#0d1117", border: `1px solid ${DARK.cardBorder}`, borderRadius: 8, padding: 12, height: 160, position: "relative", overflow: "hidden" }}>
                <svg width="100%" height="100%" viewBox="0 0 420 140">
                  {topologyEdges.map((edge, i) => {
                    const from = topologyNodes.find((n) => n.id === edge.from)!;
                    const to = topologyNodes.find((n) => n.id === edge.to)!;
                    return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={`${DARK.textMuted}40`} strokeWidth={1} strokeDasharray="4 4" />;
                  })}
                  {topologyNodes.map((node) => (
                    <g key={node.id}>
                      <circle cx={node.x} cy={node.y} r={12} fill={`${node.color}20`} stroke={node.color} strokeWidth={1.5} />
                      <circle cx={node.x} cy={node.y} r={4} fill={node.color} opacity={0.8} />
                      <text x={node.x} y={node.y + 24} textAnchor="middle" fill={DARK.textMuted} fontSize={9} fontFamily={DARK.fontMono}>{node.label}</text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* ── TELEMETRY LOGS ── */}
            <div style={{ background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 12, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: DARK.textMuted, fontFamily: DARK.fontMono }}>TELEMETRY_LOGS</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: DARK.green, background: `${DARK.green}15`, padding: "2px 6px", borderRadius: 3, fontFamily: DARK.fontMono }}>LIVE</span>
              </div>
              <div style={{ background: "#0d1117", border: `1px solid ${DARK.cardBorder}`, borderRadius: 8, padding: 12, maxHeight: 200, overflowY: "auto" }}>
                {telemetryLogs.map((log, i) => (
                  <div key={i} style={{ fontSize: 10, fontFamily: DARK.fontMono, lineHeight: 1.8, display: "flex", gap: 6 }}>
                    <span style={{ color: DARK.textMuted, flexShrink: 0 }}>{log.time}</span>
                    <span style={{ color: log.tagColor, fontWeight: 600, flexShrink: 0 }}>[{log.tag}]</span>
                    <span style={{ color: DARK.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.msg}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── AI AGENT LOG ── */}
            <div style={{ background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 12, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: DARK.green, boxShadow: `0 0 8px ${DARK.green}` }} />
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: DARK.textMuted, fontFamily: DARK.fontMono }}>AI AGENT LOG</span>
              </div>
              <div style={{ background: "#0d1117", border: `1px solid ${DARK.cardBorder}`, borderRadius: 8, padding: 12, maxHeight: 160, overflowY: "auto" }}>
                {[
                  { time: "14:02:01", agent: "SCAN_ENGINE", msg: "Vulnerability scan completed on SRV-PROD-DB-01", color: DARK.cyan },
                  { time: "14:01:58", agent: "DETECT_AI", msg: "Anomalous SSH pattern detected from 182.1.2.91", color: DARK.orange },
                  { time: "14:01:44", agent: "RESPONSE_BOT", msg: "Auto-patch applied to K8S-NODE-04 successfully", color: DARK.green },
                  { time: "14:01:30", agent: "FORENSICS", msg: "Memory dump initiated on WORKSTATION-205", color: DARK.purple },
                ].map((log, i) => (
                  <div key={i} style={{ fontSize: 10, fontFamily: DARK.fontMono, lineHeight: 1.8, display: "flex", gap: 6, marginBottom: 4 }}>
                    <span style={{ color: DARK.textMuted, flexShrink: 0 }}>{log.time}</span>
                    <span style={{ color: log.color, fontWeight: 600, flexShrink: 0 }}>[{log.agent}]</span>
                    <span style={{ color: DARK.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.msg}</span>
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
