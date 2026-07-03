"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Shell from "@/components/Shell";

const PANEL_BG = "#0a0e1a";
const PANEL_BORDER = "#1e2a3a";
const CARD_BG = "#0d1221";
const CYAN = "#00e5ff";
const ORANGE = "#ff9100";
const RED = "#ff3d3d";
const BLUE = "#1976d2";

const controls = [
  { id: "CC.1.1.01", desc: "Access Control: Role-Based Authorization Policy", time: "12:04:01 UTC", status: "PASS" as const },
  { id: "CC.6.1.02", desc: "Incident Response: 15min Notification SLA", time: "13:02:11 UTC", status: "FAIL" as const },
  { id: "ISO.27001.A.9", desc: "User Provisioning: Terminated Accounts Revocation", time: "13:45:00 UTC", status: "PASS" as const },
  { id: "PCI.DSS.3.1", desc: "Vulnerability Mgmt: Bi-weekly Internal Scans", time: "14:00:00 UTC", status: "PENDING" as const },
];

const riskItems = [
  { level: "CRITICAL RISK", text: "Exposed S3 Buckets in Prod Env", color: RED },
  { level: "HIGH RISK", text: "Unpatched Gateway (CVE-2023-410)", color: ORANGE },
  { level: "MODERATE RISK", text: "MFA Not Required for VPN-L3", color: BLUE },
];

const heatmapColors: string[][] = [
  ["#0d2240", "#0d3060", "#1976d2", "#1976d2", "#ff9100"],
  ["#0d2240", "#1976d2", "#1976d2", "#ff9100", "#ff9100"],
  ["#0d2240", "#0d3060", "#1976d2", "#ff9100", "#ff3d3d"],
  ["#0d3060", "#1976d2", "#ff9100", "#ff3d3d", "#ff3d3d"],
  ["#1976d2", "#ff9100", "#ff9100", "#ff3d3d", "#ff3d3d"],
];

const heatmapHasWarning = (r: number, c: number) => r === 4 && c === 4;

export default function GovernancePage() {
  const [controlFilter, setControlFilter] = useState<"all" | "fail">("all");
  const [activeTab, setActiveTab] = useState<"governance" | "monitoring" | "hunting">("governance");
  const [searchQuery, setSearchQuery] = useState("");
  const [complianceData, setComplianceData] = useState<any>(null);

  useEffect(() => {
    import("@/lib/api").then(({ api, endpoints }) => {
      api.get(endpoints.compliance()).then((data: any) => setComplianceData(data)).catch(() => {});
    });
  }, []);

  const filteredControls = controlFilter === "fail"
    ? controls.filter((c) => c.status === "FAIL")
    : controls;

  const statusColor = (s: string) => s === "PASS" ? "#22c55e" : s === "FAIL" ? "#ef4444" : ORANGE;
  const statusBg = (s: string) => s === "PASS" ? "rgba(34,197,94,0.12)" : s === "FAIL" ? "rgba(239,68,68,0.12)" : "rgba(255,145,0,0.12)";

  return (
    <Shell>
      <style>{`
        .gov-page { background: #060a14; min-height: 100vh; }
        .gov-page * { color-scheme: dark; }
        .tab-gov { background: transparent; border: 1px solid ${PANEL_BORDER}; color: #64748b; padding: 8px 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; cursor: pointer; text-transform: uppercase; transition: all 0.2s; }
        .tab-gov.active { background: ${PANEL_BG}; color: #f8fafc; border-color: ${CYAN}; }
        .tab-gov:hover:not(.active) { color: #94a3b8; }
        .btn-cyan { background: transparent; border: 1px solid ${CYAN}; color: ${CYAN}; padding: 8px 18px; font-size: 11px; font-weight: 600; border-radius: 6px; cursor: pointer; letter-spacing: 0.03em; transition: all 0.2s; }
        .btn-cyan:hover { background: rgba(0,229,255,0.1); }
        .btn-gray { background: transparent; border: 1px solid #334155; color: #94a3b8; padding: 8px 18px; font-size: 11px; font-weight: 600; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
        .btn-gray:hover { background: rgba(148,163,184,0.1); color: #f8fafc; }
        .ctrl-filter { background: transparent; border: 1px solid ${PANEL_BORDER}; color: #64748b; padding: 6px 14px; font-size: 11px; font-weight: 600; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
        .ctrl-filter.active { background: rgba(0,229,255,0.08); border-color: ${CYAN}; color: ${CYAN}; }
        .ctrl-filter:hover:not(.active) { color: #94a3b8; border-color: #334155; }
        .ctrl-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .ctrl-table th { text-align: left; padding: 10px 16px; font-size: 10px; font-weight: 700; color: #475569; letter-spacing: 0.08em; text-transform: uppercase; border-bottom: 1px solid ${PANEL_BORDER}; }
        .ctrl-table td { padding: 14px 16px; border-bottom: 1px solid rgba(30,42,58,0.5); }
        .ctrl-table tr:hover td { background: rgba(0,229,255,0.02); }
        .ctrl-id { font-family: "JetBrains Mono", monospace; font-size: 11px; color: #94a3b8; }
        .ctrl-desc { color: #e2e8f0; font-size: 12px; font-weight: 500; }
        .ctrl-time { font-family: "JetBrains Mono", monospace; font-size: 11px; color: #64748b; }
        .status-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
        .bottom-card { background: ${CARD_BG}; border: 1px solid ${PANEL_BORDER}; border-radius: 12px; padding: 24px; flex: 1; min-width: 0; }
        .bottom-card:hover { border-color: #334155; }
        .bottom-card h3 { font-size: 14px; font-weight: 700; color: #f8fafc; margin-bottom: 8px; }
        .bottom-card p { font-size: 12px; color: #64748b; margin-bottom: 16px; line-height: 1.5; }
        .bottom-card-btn { display: inline-block; padding: 7px 16px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 1px solid #334155; background: transparent; color: #94a3b8; letter-spacing: 0.03em; }
        .bottom-card-btn:hover { border-color: ${CYAN}; color: ${CYAN}; }
      `}</style>

      <div className="gov-page" style={{ display: "flex", flexDirection: "column", gap: 24, padding: 0 }}>

        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.02em", marginBottom: 6 }}>
            GOVERNANCE & COMPLIANCE
          </h1>
          <p style={{ fontSize: 13, color: "#64748b", maxWidth: 700, lineHeight: 1.6, marginBottom: 20 }}>
            Global executive oversight of regulatory frameworks and risk posture. Autonomous monitoring of SOC 2, HIPAA, and ISO 27001 controls in real-time.
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 0 }}>
              <button className={`tab-gov ${activeTab === "governance" ? "active" : ""}`} onClick={() => setActiveTab("governance")}>GOVERNANCE</button>
              <button className={`tab-gov ${activeTab === "monitoring" ? "active" : ""}`} onClick={() => setActiveTab("monitoring")}>MONITORING</button>
              <button className={`tab-gov ${activeTab === "hunting" ? "active" : ""}`} onClick={() => setActiveTab("hunting")}>THREAT HUNT</button>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ position: "relative", minWidth: 240 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                placeholder="QUERY COMPLIANCE DATA..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search compliance data"
                style={{
                  background: PANEL_BG, border: `1px solid ${PANEL_BORDER}`, borderRadius: 6,
                  padding: "8px 12px 8px 34px", fontSize: 11, color: "#94a3b8",
                  fontFamily: "'JetBrains Mono', monospace", width: "100%", outline: "none",
                  letterSpacing: "0.04em",
                }}
              />
            </div>
            <button className="btn-cyan">Export SOC 2 Audit</button>
            <button className="btn-gray">Executive Summary</button>
          </div>
        </motion.div>

        {/* TOP TWO PANELS */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 20 }}>

          {/* LEFT: Compliance Score */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}
            style={{ background: PANEL_BG, border: `1px solid ${PANEL_BORDER}`, borderRadius: 12, padding: 28, display: "flex", flexDirection: "column", alignItems: "center" }}
          >
            <div style={{ position: "relative", width: 180, height: 180 }}>
              <svg width={180} height={180} viewBox="0 0 180 180">
                <circle cx={90} cy={90} r={76} fill="none" stroke="rgba(30,42,58,0.6)" strokeWidth={12} />
                <motion.circle
                  cx={90} cy={90} r={76} fill="none" stroke={CYAN} strokeWidth={12}
                  strokeLinecap="round"
                  initial={{ strokeDasharray: "0 477.5" }}
                  animate={{ strokeDasharray: `${(88 / 100) * 477.5} 477.5` }}
                  transition={{ duration: 1.8, ease: "easeOut", delay: 0.5 }}
                  style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
                />
                <motion.circle
                  cx={90} cy={90} r={76} fill="none" stroke="rgba(0,229,255,0.15)" strokeWidth={14}
                  strokeLinecap="round"
                  initial={{ strokeDasharray: "0 477.5" }}
                  animate={{ strokeDasharray: `${(88 / 100) * 477.5} 477.5` }}
                  transition={{ duration: 1.8, ease: "easeOut", delay: 0.5 }}
                  style={{ transform: "rotate(-90deg)", transformOrigin: "center", filter: "blur(8px)" }}
                />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <motion.span
                  initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.8 }}
                  style={{ fontSize: 48, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: CYAN }}
                >
                  88
                </motion.span>
                <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>%</span>
              </div>
            </div>

            <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              SOC 2 COVERAGE
            </div>

            <div style={{ marginTop: 20, width: "100%", borderTop: `1px solid ${PANEL_BORDER}`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>CONTROLS PASS</span>
                <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: "#22c55e" }}>142/161</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>REMEDIATION</span>
                <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: ORANGE }}>19 ACTIVE</span>
              </div>
            </div>
          </motion.div>

          {/* RIGHT: Risk Summary Matrix */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}
            style={{ background: PANEL_BG, border: `1px solid ${PANEL_BORDER}`, borderRadius: 12, padding: 28, display: "flex", flexDirection: "column" }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Risk Summary Matrix
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingTop: 8 }}>
                <span style={{ fontSize: 9, color: "#475569", writingMode: "vertical-rl", transform: "rotate(180deg)", letterSpacing: "0.12em", fontWeight: 700 }}>SECURITY IMPACT</span>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
                  {heatmapColors.map((row, r) =>
                    row.map((color, c) => (
                      <motion.div
                        key={`${r}-${c}`}
                        initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + (r * 5 + c) * 0.02 }}
                        style={{
                          background: color, borderRadius: 4, aspectRatio: "1",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          position: "relative", minWidth: 36,
                        }}
                      >
                        {heatmapHasWarning(r, c) && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={RED} stroke="none">
                            <path d="M12 2L1 21h22L12 2zm0 4l7.5 13h-15L12 6zm-1 5v4h2v-4h-2zm0 6v2h2v-2h-2z" />
                          </svg>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
                <div style={{ fontSize: 9, color: "#475569", textAlign: "center", marginTop: 8, letterSpacing: "0.12em", fontWeight: 700 }}>BUSINESS RISK</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
              {[{ label: "Critical", color: RED }, { label: "High", color: ORANGE }, { label: "Moderate", color: BLUE }].map((l) => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                  <span style={{ fontSize: 10, color: "#64748b" }}>{l.label}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: `1px solid ${PANEL_BORDER}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {riskItems.map((r, i) => (
                <motion.div
                  key={r.level}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <div style={{
                    width: 4, height: 28, borderRadius: 2, background: r.color, flexShrink: 0,
                  }} />
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: r.color, letterSpacing: "0.06em" }}>{r.level}: </span>
                    <span style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 500 }}>{r.text}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* REAL-TIME CONTROL MONITORING */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 }}
          style={{ background: PANEL_BG, border: `1px solid ${PANEL_BORDER}`, borderRadius: 12, overflow: "hidden" }}
        >
          <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${PANEL_BORDER}` }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Real-Time Control Monitoring
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className={`ctrl-filter ${controlFilter === "all" ? "active" : ""}`} onClick={() => setControlFilter("all")}>ALL CONTROLS</button>
              <button className={`ctrl-filter ${controlFilter === "fail" ? "active" : ""}`} onClick={() => setControlFilter("fail")}>FAILING ONLY</button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="ctrl-table">
              <thead>
                <tr>
                  <th>Control ID</th>
                  <th>Description</th>
                  <th>Last Assessed</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center" }}>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {filteredControls.map((ctrl, i) => (
                  <motion.tr
                    key={ctrl.id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.08 }}
                  >
                    <td className="ctrl-id">{ctrl.id}</td>
                    <td className="ctrl-desc">{ctrl.desc}</td>
                    <td className="ctrl-time">{ctrl.time}</td>
                    <td>
                      <span className="status-pill" style={{ background: statusBg(ctrl.status), color: statusColor(ctrl.status) }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor(ctrl.status), display: "inline-block" }} />
                        {ctrl.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {ctrl.status === "PASS" && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" style={{ cursor: "pointer" }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                        </svg>
                      )}
                      {ctrl.status === "FAIL" && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={RED} stroke="none" style={{ cursor: "pointer" }}>
                          <path d="M12 2L1 21h22L12 2zm0 4l7.5 13h-15L12 6zm-1 5v4h2v-4h-2zm0 6v2h2v-2h-2z" />
                        </svg>
                      )}
                      {ctrl.status === "PENDING" && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2" style={{ cursor: "pointer" }}>
                          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                        </svg>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* BOTTOM 3 CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {[
            { title: "Incident History", desc: "Review historical breaches and remediation efficacy.", btn: "VIEW LOGS" },
            { title: "Trust Center", desc: "Customer-facing security compliance portal dashboard.", btn: "MANAGE PORTAL" },
            { title: "Audit Readiness", desc: "Pre-scan system for upcoming ISO audit gap analysis.", btn: "RUN GAP ANALYSIS" },
          ].map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
              className="bottom-card"
            >
              <h3>{card.title}</h3>
              <p>{card.desc}</p>
              <button className="bottom-card-btn">{card.btn}</button>
            </motion.div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
