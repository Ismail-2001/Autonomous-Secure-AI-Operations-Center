"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import Shell from "@/components/Shell";

/* ── helpers ── */

const sevBadge = (s: string, num?: number) => {
  if (num !== undefined && num >= 9) return { bg: "#3b1010", fg: "#ef4444", border: "#7f1d1d" };
  if (num !== undefined && num >= 5) return { bg: "#3b2510", fg: "#f97316", border: "#78350f" };
  if (num !== undefined && num >= 2) return { bg: "#3b3510", fg: "#eab308", border: "#713f12" };
  if (num !== undefined && num >= 1) return { bg: "#103b20", fg: "#22c55e", border: "#14532d" };
  return { bg: "#102a3b", fg: "#3b82f6", border: "#1e3a5f" };
};

/* ── bar chart data ── */
const bars = [
  32, 28, 45, 22, 58, 14, 38, 52, 18, 42, 30, 55, 26, 48, 36, 20, 50, 44, 16, 40, 34, 60, 24, 56,
  38, 46, 28, 52, 32, 18, 44, 62, 30, 50, 22, 48, 36, 58, 26, 42, 40, 14, 54, 34, 46, 20, 60, 28,
  38, 52, 32, 44, 16, 56, 24, 48, 42, 30, 50, 22, 36, 58, 28, 18, 46, 54, 34, 40, 14, 62, 26, 52,
  38, 44, 20, 56, 30, 48, 22, 36, 50, 28, 58, 42, 16, 54, 34, 24, 60, 38, 46, 20, 52, 32, 14, 44,
];

/* ── event table data ── */
interface EventRow {
  ts: string;
  source: string;
  sev: string;
  sevNum: number;
  asset: string;
  threat: string;
  icon: string;
}

const events: EventRow[] = [
  { ts: "2023-10-24 14:02:01", source: "EVAL-02-DC", sev: "CRIT", sevNum: 9.8, asset: "ADM_SRV_WIN_01", threat: "Brute Force: NTLM Relay Attempt", icon: "⚠" },
  { ts: "2023-10-24 14:01:45", source: "CORTEX-XDR", sev: "HIGH", sevNum: 6.2, asset: "USER_STATION_442", threat: "Suspicious DNS Tunneling (Beaconing)", icon: "◼" },
  { ts: "2023-10-24 13:59:12", source: "AWS_CLOUD_TRAIL", sev: "LOW", sevNum: 3.1, asset: "S3_BUCKET_PII_PROD", threat: "IAM Role Modification Detected", icon: "ℹ" },
  { ts: "2023-10-24 13:55:00", source: "FORTIGATE_WAF", sev: "INFO", sevNum: 1.0, asset: "EXT_LOAD_BALANCER", threat: "Routine Health Check Passed", icon: "✓" },
];

/* ── IOC sidebar data ── */
interface IocItem { type: string; value: string; }
interface Incident { id: string; title: string; active: boolean; }

const iocs: IocItem[] = [
  { type: "SHA256", value: "0xf44...21a" },
  { type: "DOMAIN", value: "sync.bad.ru" },
];

const incidents: Incident[] = [
  { id: "INC-2023-882", title: "Unauthorized Login Attempt", active: true },
  { id: "INC-2023-841", title: "Scheduled Task Created", active: false },
];

/* ══════════════════════════════════════════════════════════════ */
export default function HuntingPage() {
  const [page, setPage] = useState(1);
  const [iocList, setIocList] = useState(iocs);

  const maxBar = useMemo(() => Math.max(...bars), []);

  const removeIoc = (idx: number) => setIocList((p) => p.filter((_, i) => i !== idx));

  return (
    <Shell>
      {/* ── outer dark container ── */}
      <div style={{ background: "#0d1117", borderRadius: 14, padding: 24, minHeight: "calc(100vh - 112px)", display: "flex", flexDirection: "column", gap: 0, color: "#c9d1d9", fontFamily: "var(--font-sans)" }}>

        {/* ── 3-col grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, flex: 1 }}>

          {/* ════════ LEFT COLUMN ════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* ── Event Density Chart ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
              style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: "18px 22px" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#8b949e" }}>EVENT DENSITY OVER TIME</span>
                <span style={{ fontSize: 10, color: "#484f58", fontFamily: "var(--font-mono)" }}>RANGE: 24H &nbsp;|&nbsp; INTERVAL: 5M</span>
              </div>

              {/* bar chart */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
                {bars.map((h, i) => (
                  <div key={i} style={{ flex: 1, height: `${(h / maxBar) * 100}%`, background: h > 50 ? "#58a6ff" : h > 30 ? "#1f6feb" : "#163a5c", borderRadius: 2, transition: "background 0.2s" }} title={`${h} events`} />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 9, color: "#484f58", fontFamily: "var(--font-mono)" }}>
                <span>14:00</span><span>16:00</span><span>18:00</span><span>20:00</span><span>22:00</span><span>00:00</span><span>02:00</span><span>04:00</span>
              </div>
            </motion.div>

            {/* ── Stats Row ── */}
            <div style={{ display: "flex", gap: 16 }}>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                style={{ flex: 1, background: "#161b22", border: "1px solid #30363d", borderRadius: 10, padding: "14px 18px" }}
              >
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "#8b949e", marginBottom: 6 }}>HITS</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", color: "#58a6ff" }}>1,402</div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                style={{ flex: 1, background: "#161b22", border: "1px solid #30363d", borderRadius: 10, padding: "14px 18px" }}
              >
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "#8b949e", marginBottom: 6 }}>CRITICAL</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", color: "#f85149" }}>03</div>
              </motion.div>
            </div>

            {/* ── Event Table ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, overflow: "hidden" }}
            >
              {/* table header */}
              <div style={{ display: "grid", gridTemplateColumns: "190px 150px 60px 170px 1fr", padding: "10px 16px", borderBottom: "1px solid #21262d", background: "#0d1117", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "#8b949e" }}>
                <span>TIMESTAMP</span><span>SOURCE</span><span>SEV</span><span>ASSET IDENTITY</span><span>THREAT TYPE / SIGNATURE</span>
              </div>

              {/* rows */}
              {events.map((ev, i) => {
                const sev = sevBadge(ev.sev, ev.sevNum);
                return (
                  <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 + i * 0.04 }}
                    style={{
                      display: "grid", gridTemplateColumns: "190px 150px 60px 170px 1fr",
                      padding: "11px 16px", borderBottom: "1px solid #21262d", fontSize: 12,
                      fontFamily: "var(--font-mono)", alignItems: "center",
                      background: i % 2 === 0 ? "#161b22" : "#0d1117",
                    }}
                  >
                    <span style={{ color: "#8b949e" }}>{ev.ts}</span>
                    <span style={{ color: "#c9d1d9" }}>{ev.source}</span>
                    <span style={{ background: sev.bg, color: sev.fg, border: `1px solid ${sev.border}`, borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 600, textAlign: "center", display: "inline-block" }}>{ev.sevNum.toFixed(1)}</span>
                    <span style={{ color: "#c9d1d9" }}>{ev.asset}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#c9d1d9" }}>
                      <span style={{ color: ev.sev === "CRIT" ? "#f85149" : ev.sev === "HIGH" ? "#f0883e" : ev.sev === "LOW" ? "#3fb950" : "#8b949e", fontSize: 14 }}>{ev.icon}</span>
                      {ev.threat}
                    </span>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* ── Pagination ── */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" }}
            >
              <div style={{ fontSize: 10, color: "#484f58", fontFamily: "var(--font-mono)" }}>
                INDEXED: <span style={{ color: "#8b949e" }}>15,221 EVENTS</span> &nbsp;|&nbsp; SYNC STATUS: <span style={{ color: "#3fb950" }}>LIVE</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { label: "PREV", disabled: page === 1 },
                  { label: "01", active: page === 1 },
                  { label: "02", active: page === 2 },
                  { label: "NEXT", disabled: page === 2 },
                ].map((btn) => (
                  <motion.button key={btn.label} whileHover={!btn.disabled ? { scale: 1.06 } : undefined} whileTap={!btn.disabled ? { scale: 0.95 } : undefined}
                    onClick={() => { if (btn.label === "PREV" && page > 1) setPage(1); if (btn.label === "NEXT" && page < 2) setPage(2); if (btn.label === "01") setPage(1); if (btn.label === "02") setPage(2); }}
                    style={{
                      padding: "5px 14px", fontSize: 11, fontWeight: 500, fontFamily: "var(--font-mono)",
                      borderRadius: 6, border: btn.active ? "1px solid #1f6feb" : "1px solid #30363d",
                      background: btn.active ? "#1f6feb" : "transparent", color: btn.active ? "#fff" : btn.disabled ? "#30363d" : "#c9d1d9",
                      cursor: btn.disabled ? "not-allowed" : "pointer", transition: "all 0.15s",
                    }}
                  >{btn.label}</motion.button>
                ))}
              </div>
            </motion.div>
          </div>

          {/* ════════ RIGHT SIDEBAR ════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* ── IOC Pivoting Card ── */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 20 }}
            >
              {/* header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#8b949e" }}>IOC PIVOTING</span>
              </div>

              {/* target asset */}
              <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: "#8b949e" }}>TARGET ASSET</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f0f6fc", fontFamily: "var(--font-mono)", marginBottom: 4 }}>USER_STATION_442</div>
                <div style={{ fontSize: 12, color: "#8b949e", fontFamily: "var(--font-mono)" }}>IP: 10.0.4.122</div>
              </div>

              {/* observed IOCs */}
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: "#8b949e", marginBottom: 8 }}>OBSERVED IOCs</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
                {iocList.map((ioc, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: "#58a6ff", background: "#1c3a5c", padding: "2px 6px", borderRadius: 3 }}>{ioc.type}</span>
                      <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "#c9d1d9" }}>{ioc.value}</span>
                    </div>
                    <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                      onClick={() => removeIoc(idx)}
                      style={{ width: 18, height: 18, borderRadius: 4, border: "1px solid #30363d", background: "transparent", color: "#8b949e", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, lineHeight: 1 }}
                    >×</motion.button>
                  </div>
                ))}
              </div>

              {/* related incidents */}
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: "#8b949e", marginBottom: 8 }}>RELATED INCIDENTS (6H)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
                {incidents.map((inc) => (
                  <div key={inc.id} style={{ borderLeft: inc.active ? "3px solid #58a6ff" : "3px solid #30363d", background: "#0d1117", borderRadius: "0 6px 6px 0", padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: inc.active ? "#58a6ff" : "#c9d1d9", fontFamily: "var(--font-mono)", marginBottom: 2 }}>{inc.id}</div>
                    <div style={{ fontSize: 11, color: "#8b949e" }}>{inc.title}</div>
                  </div>
                ))}
              </div>

              {/* action buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "10px 16px", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-sans)",
                    background: "linear-gradient(135deg, #1f6feb, #58a6ff)", color: "#fff",
                    border: "none", borderRadius: 8, cursor: "pointer", transition: "opacity 0.15s",
                  }}
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  QUARANTINE ASSET
                </motion.button>

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "10px 16px", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-sans)",
                    background: "transparent", color: "#c9d1d9",
                    border: "1px solid #30363d", borderRadius: 8, cursor: "pointer", transition: "border-color 0.15s",
                  }}
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                  </svg>
                  ALERT TEAM
                </motion.button>
              </div>
            </motion.div>

            {/* ── AI Agent Active Card ── */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}
              style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 20 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3fb950", boxShadow: "0 0 8px #3fb950" }} />
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: "#8b949e" }}>AI AGENT ACTIVE</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ animation: "pulse-ring 2s ease-in-out infinite" }}>
                  <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
                </svg>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#f0f6fc" }}>Hunting for lateral movement...</div>
                  <div style={{ fontSize: 10, color: "#484f58", marginTop: 2 }}>Autonomous scan in progress</div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </div>

      {/* keyframes */}
      <style>{`
        @keyframes pulse-ring {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>
    </Shell>
  );
}
