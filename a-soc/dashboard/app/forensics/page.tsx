"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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

const evidenceCards = [
  {
    type: "VOLATILE",
    name: "MEM_DUMP_001.raw",
    size: "16.0 GB",
    detail: "Physical RAM",
    progress: 100,
    status: "INDEXED",
    statusColor: DARK.cyan,
    sha256: "8F2A...D4C1",
    borderColor: DARK.cyan,
    icon: "⚡",
  },
  {
    type: "NETWORK",
    name: "TRAFFIC_SNIFF.pcap",
    size: "452 MB",
    detail: "Wireshark Capture",
    progress: 100,
    status: "DECRYPTED",
    statusColor: DARK.cyan,
    sha256: "4C1B...8E7F",
    borderColor: DARK.cyan,
    icon: "🌐",
  },
  {
    type: "NON-VOLATILE",
    name: "SYSTEM_ROOT.e01",
    size: "500 GB",
    detail: "EnCase Image",
    progress: 65,
    status: "SCANNING...",
    statusColor: DARK.red,
    sha256: "12E9...A3B7",
    borderColor: DARK.red,
    icon: "💾",
  },
];

const timelineEntries = [
  {
    time: "14:02:01.321",
    title: "KERNEL HOOK DETECTED",
    description: "System calls intercepted via LKM manipulation. Modification detected at memory address 0x7FFD4A2B.",
    hmacStatus: "VALID",
    hmacColor: DARK.green,
    dotColor: DARK.cyan,
  },
  {
    time: "14:02:05.881",
    title: "PROCESS EXECUTION",
    description: "Execution of powershell.exe -enc ... initiated by parent process explorer.exe.",
    hmacStatus: "VALID",
    hmacColor: DARK.green,
    dotColor: DARK.cyan,
  },
  {
    time: "14:03:12.110",
    title: "EXFILTRATION ATTEMPT",
    description: "Encrypted tunnel established to 192.168.10.42 (Target). Integrity seal verified.",
    hmacStatus: "MISSING",
    hmacColor: DARK.red,
    dotColor: DARK.red,
  },
  {
    time: "14:04:30.005",
    title: "REGISTRY MODIFICATION",
    description: "Persistence mechanism installed at HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
    hmacStatus: "VALID",
    hmacColor: DARK.green,
    dotColor: DARK.cyan,
  },
  {
    time: "14:05:11.220",
    title: "CREDENTIAL ACCESS",
    description: "LSASS process memory accessed. Potential credential harvesting via Mimikatz-like technique.",
    hmacStatus: "VALID",
    hmacColor: DARK.green,
    dotColor: DARK.orange,
  },
];

const agents = [
  { name: "TELEMETRY_STREAM", pct: 99.2, status: "Monitoring evidence feeds", color: "#22d3ee", icon: "📡" },
  { name: "THREAT_DETECTION", pct: 87.6, status: "MITRE ATT&CK mapping...", color: "#f97316", icon: "🛡️" },
  { name: "SUPERVISOR_MODE", pct: 94.1, status: "Coordinating analysis", color: "#a78bfa", icon: "👁️" },
  { name: "DEEP_FORENSICS", pct: 72.3, status: "Analyzing memory dump", color: "#ef4444", icon: "🔬" },
  { name: "RESPONSE_BOT", pct: 0, status: "Idle - Awaiting trigger", color: "#64748b", icon: "⚔️" },
];

const analysisItems = [
  { title: "ARTIFACT_ALPHA", desc: "Memory analysis reveals injected shellcode in svchost.exe process space", color: DARK.cyan },
  { title: "TIMELINE_DRIFT", desc: "Initial compromise at 13:45 UTC — 17 min dwell time before detection trigger", color: DARK.orange },
  { title: "PAYLOAD_ID", desc: "Base64 encoded PowerShell with AES-256 encryption layer identified in memory", color: DARK.purple },
  { title: "LATERAL_PATH", desc: "Pass-the-hash technique used to move from WORKSTATION-205 to SRV-PROD-DB-01", color: DARK.red },
];

const keyFindings = [
  { text: "Registry persistence mechanism active (HKLM...\\Run)", success: true },
  { text: "Encrypted files detected on C:\\Users\\ volume", success: true },
  { text: "Original C2 exfiltration endpoint unreachable (takedown)", success: false },
  { text: "Memory signature matches BlackCat ransomware v3 variant", success: true },
  { text: "LSASS memory access confirmed — credential theft likely", success: true },
];

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

export default function ForensicsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [evidenceData, setEvidenceData] = useState<any[]>([]);

  useEffect(() => {
    import("@/lib/api").then(({ api, endpoints }) => {
      api.get(endpoints.forensics()).then((data: any) => {
        if (data?.jobs?.length) {
          setEvidenceData(data.jobs.map((j: any) => ({
            type: j.type?.toUpperCase() || "VOLATILE",
            name: j.artifacts?.[0] || `${j.id}.raw`,
            size: "16.0 GB",
            progress: j.status === "completed" ? 100 : j.status === "in_progress" ? 65 : 0,
            status: j.status?.toUpperCase() || "PENDING",
          })));
        }
      }).catch(() => {});
    });
  }, []);

  const evidenceCount = evidenceCards.length + evidenceData.length;
  const indexedCount = evidenceCards.filter((e) => e.status === "INDEXED" || e.status === "DECRYPTED").length;

  return (
    <Shell>
      <div style={{ background: DARK.bg, minHeight: "100vh", margin: "-24px", padding: 20, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: DARK.textPrimary, overflow: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, flex: 1 }}>

          {/* ════════ LEFT: MAIN CONTENT ════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* ── KPI ROW ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
              <KpiCard label="EVIDENCE ITEMS" value={`${evidenceCount}`} sub="3 cataloged" subColor={DARK.cyan} progress={65} delay={0} />
              <KpiCard label="INDEXED" value={`${indexedCount}`} badge="VERIFIED" badgeColor={DARK.green} delay={0.05} />
              <KpiCard label="ACTIVE AGENTS" value="5" sub="Deep analysis running" subColor={DARK.orange} progress={87} delay={0.1} />
              <KpiCard label="KEY FINDINGS" value={`${keyFindings.length}`} badge="CASE DELTA-9" badgeColor={DARK.purple} delay={0.15} />
            </div>

            {/* ── HEADER + SEARCH ── */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, background: `${DARK.cyan}20`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${DARK.cyan}30` }}>
                  <svg style={{ width: 20, height: 20, color: DARK.cyan }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                  </svg>
                </div>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: DARK.textPrimary, margin: 0 }}>Forensics Lab</h1>
                  <span style={{ fontSize: 11, color: DARK.cyan, fontFamily: DARK.fontMono }}>CASE: 2023-DELTA-9</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: DARK.textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input type="text" placeholder="Search evidence logs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: "100%", paddingLeft: 36, paddingRight: 16, paddingTop: 10, paddingBottom: 10, background: "#0d1117", border: `1px solid ${DARK.cardBorder}`, borderRadius: 8, color: DARK.textPrimary, fontSize: 13, outline: "none", fontFamily: DARK.fontMono }}
                  />
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{ padding: "10px 20px", fontSize: 12, fontWeight: 600, color: DARK.cyan, background: "transparent", border: `1px solid ${DARK.cyan}60`, borderRadius: 8, cursor: "pointer", fontFamily: DARK.fontMono, whiteSpace: "nowrap" }}
                >
                  INGEST NEW IMAGE
                </motion.button>
              </div>
            </motion.div>

            {/* ── EVIDENCE CATALOG ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: DARK.textMuted, fontFamily: DARK.fontMono }}>EVIDENCE CATALOG</span>
                <span style={{ fontSize: 10, color: DARK.textMuted, fontFamily: DARK.fontMono }}>Verified acquisitions for Case Delta-9</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {evidenceCards.map((card, i) => (
                  <motion.div key={card.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.06 }}
                    style={{ background: DARK.card, border: `1px solid ${card.borderColor}30`, borderRadius: 10, padding: 18 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${card.borderColor}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                        {card.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: DARK.textMuted, letterSpacing: "0.06em" }}>{card.type}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: DARK.textPrimary, fontFamily: DARK.fontMono }}>{card.name}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: DARK.textMuted, marginBottom: 10 }}>{card.size} · {card.detail}</div>
                    <div style={{ width: "100%", height: 4, background: `${DARK.textMuted}30`, borderRadius: 2, overflow: "hidden", marginBottom: 12 }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${card.progress}%` }} transition={{ duration: 1.2, delay: 0.3 + i * 0.1 }}
                        style={{ height: "100%", background: `linear-gradient(90deg, ${card.borderColor}, ${card.borderColor}cc)`, borderRadius: 2 }}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: card.statusColor, fontFamily: DARK.fontMono }}>STATUS: {card.status}</span>
                      <span style={{ fontSize: 9, color: DARK.textMuted, fontFamily: DARK.fontMono }}>SHA: {card.sha256}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* ── EVIDENCE TIMELINE ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: DARK.textMuted, fontFamily: DARK.fontMono }}>EVIDENCE TIMELINE</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: DARK.green, background: `${DARK.green}15`, padding: "3px 8px", borderRadius: 4, fontFamily: DARK.fontMono }}>HMAC VERIFIED</span>
                  <button style={{ background: "transparent", border: `1px solid ${DARK.cardBorder}`, borderRadius: 4, padding: "4px 8px", color: DARK.textMuted, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: DARK.fontMono }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                    FILTER
                  </button>
                </div>
              </div>

              <div style={{ position: "relative", paddingLeft: 28 }}>
                <div style={{ position: "absolute", left: 8, top: 8, bottom: 8, width: 2, background: `${DARK.textMuted}30` }} />

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {timelineEntries.map((entry, i) => (
                    <motion.div key={entry.time} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.08 }}
                      style={{ position: "relative" }}
                    >
                      <div style={{ position: "absolute", left: -24, top: 10, width: 12, height: 12, borderRadius: "50%", background: entry.dotColor, border: `3px solid ${DARK.bg}`, boxShadow: `0 0 6px ${entry.dotColor}60` }} />

                      <div style={{ background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 10, padding: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                          <span style={{ fontSize: 11, color: DARK.textMuted, fontFamily: DARK.fontMono, flexShrink: 0 }}>{entry.time}</span>
                          <span style={{ fontSize: 9, fontWeight: 600, color: entry.hmacColor, fontFamily: DARK.fontMono, flexShrink: 0 }}>HMAC: {entry.hmacStatus}</span>
                        </div>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: DARK.textPrimary, margin: "0 0 6px 0", fontFamily: DARK.fontMono }}>{entry.title}</h4>
                        <p style={{ fontSize: 12, color: DARK.textSecondary, lineHeight: 1.6, margin: 0 }}>{entry.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* ════════ RIGHT SIDEBAR ════════ */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            {/* ── AI AGENT FLEET ── */}
            <div style={{ background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 12, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: DARK.textMuted, fontFamily: DARK.fontMono }}>AI AGENT FLEET</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: DARK.cyan, background: `${DARK.cyan}15`, padding: "3px 8px", borderRadius: 4, fontFamily: DARK.fontMono }}>5 ONLINE</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {agents.map((agent, i) => {
                  const barColor = agent.pct >= 100 ? DARK.red : agent.pct > 0 ? DARK.cyan : `${DARK.textMuted}40`;
                  return (
                    <motion.div key={agent.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.06 }}
                      style={{ background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 8, padding: "12px 14px" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14 }}>{agent.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: agent.color, fontFamily: DARK.fontMono, flex: 1 }}>{agent.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: agent.pct > 0 ? DARK.cyan : DARK.textMuted, fontFamily: DARK.fontMono }}>{agent.pct}%</span>
                      </div>
                      <div style={{ fontSize: 10, color: DARK.textMuted, marginBottom: 6 }}>{agent.status}</div>
                      {agent.pct > 0 && (
                        <div style={{ width: "100%", height: 3, background: `${DARK.textMuted}30`, borderRadius: 2, overflow: "hidden" }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${agent.pct}%` }} transition={{ duration: 1.2, delay: 0.5 + i * 0.1 }}
                            style={{ height: "100%", background: barColor, borderRadius: 2 }}
                          />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* ── CURRENT HYPOTHESIS ── */}
            <div style={{ background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: DARK.textMuted, marginBottom: 10, fontFamily: DARK.fontMono }}>CURRENT HYPOTHESIS</div>
              <div style={{ background: "#0d1117", border: `1px solid ${DARK.cardBorder}`, borderRadius: 8, padding: 14, borderLeft: `3px solid ${DARK.purple}` }}>
                <p style={{ fontSize: 12, color: DARK.textSecondary, lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>
                  &quot;Attacker leveraged Log4Shell vulnerability to establish persistence via scheduled task, then moved laterally to DB tier for data exfiltration.&quot;
                </p>
              </div>
            </div>

            {/* ── ANALYSIS ── */}
            <div style={{ background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: DARK.textMuted, marginBottom: 10, fontFamily: DARK.fontMono }}>ANALYSIS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {analysisItems.map((item, i) => (
                  <div key={i} style={{ background: "#0d1117", border: `1px solid ${DARK.cardBorder}`, borderRadius: 8, padding: 12, borderLeft: `3px solid ${item.color}` }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: item.color, marginBottom: 4, fontFamily: DARK.fontMono }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: DARK.textSecondary, lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── KEY FINDINGS ── */}
            <div style={{ background: DARK.card, border: `1px solid ${DARK.cardBorder}`, borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: DARK.textMuted, marginBottom: 10, fontFamily: DARK.fontMono }}>KEY FINDINGS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {keyFindings.map((finding, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: DARK.textSecondary }}>
                    <span style={{ color: finding.success ? DARK.green : DARK.red, marginTop: 2, flexShrink: 0, fontWeight: 700 }}>{finding.success ? "✓" : "✗"}</span>
                    <span style={{ lineHeight: 1.5 }}>{finding.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── GENERATE REPORT ── */}
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 20px", fontSize: 13, fontWeight: 700, color: DARK.bg, background: `linear-gradient(135deg, ${DARK.cyan}, #06b6d4)`, border: "none", borderRadius: 8, cursor: "pointer", fontFamily: DARK.fontMono, letterSpacing: "0.05em" }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
              GENERATE REPORT
            </motion.button>
          </motion.div>
        </div>
      </div>
    </Shell>
  );
}
