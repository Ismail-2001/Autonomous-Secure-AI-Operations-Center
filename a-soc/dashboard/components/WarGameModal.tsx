"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, endpoints, type WarGameReport } from "@/lib/api";

interface WarGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulationComplete?: (report: WarGameReport) => void;
}

interface ScenarioMeta {
  id: string;
  name: string;
  threatActor: string;
  targetHost: string;
  targetIp: string;
  c2Ip: string;
  tag: string;
  tagColor: string;
  description: string;
  stages: {
    step: number;
    tactic: string;
    technique: string;
    name: string;
  }[];
}

const SCENARIOS: ScenarioMeta[] = [
  {
    id: "ransomware",
    name: "BlackCat / ALPHV Ransomware Campaign",
    threatActor: "ALPHV (BlackCat) / FIN7",
    targetHost: "SRV-CORP-FIN01",
    targetIp: "10.0.4.15",
    c2Ip: "185.220.101.45",
    tag: "CRITICAL IMPACT",
    tagColor: "#ef4444",
    description: "Multi-stage financial datastore assault featuring Tor credential abuse, obfuscated PowerShell defense evasion, rapid SMB mass file encryption, and C2 exfiltration.",
    stages: [
      { step: 1, tactic: "Initial Access", technique: "T1078", name: "Valid Accounts Credential Abuse" },
      { step: 2, tactic: "Execution", technique: "T1059.001", name: "Obfuscated PowerShell Defense Evasion" },
      { step: 3, tactic: "Impact", technique: "T1486", name: "Mass SMB File Encryption (.alphv_locked)" },
      { step: 4, tactic: "Command & Control", technique: "T1071.001", name: "C2 Exfiltration Beaconing" },
    ],
  },
  {
    id: "exfiltration",
    name: "Cloud S3 Data Exfiltration & IAM Hijack",
    threatActor: "Scattered Spider (UNC3944)",
    targetHost: "cloud-infra-production",
    targetIp: "10.0.12.80",
    c2Ip: "103.42.18.77",
    tag: "CLOUD EXPOSURE",
    tagColor: "#f59e0b",
    description: "Targeted cloud infrastructure penetration via credential spraying against cloud management APIs, unauthorized IAM AdministratorAccess escalation, and bulk S3 customer vault extraction.",
    stages: [
      { step: 1, tactic: "Credential Access", technique: "T1110", name: "Cloud Admin API Password Spraying" },
      { step: 2, tactic: "Privilege Escalation", technique: "T1098", name: "IAM Role AdministratorAccess Hijack" },
      { step: 3, tactic: "Exfiltration", technique: "T1530", name: "S3 Customer PII Vault Draining" },
    ],
  },
];

const THEME = {
  bg: "#0a0e1a",
  card: "#111827",
  cardHover: "#162032",
  border: "rgba(30, 42, 58, 0.8)",
  borderActive: "#00e5ff",
  cyan: "#00e5ff",
  cyanGlow: "rgba(0, 229, 255, 0.15)",
  red: "#ef4444",
  redGlow: "rgba(239, 68, 68, 0.15)",
  amber: "#f59e0b",
  green: "#10b981",
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  fontMono: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
};

export default function WarGameModal({ isOpen, onClose, onSimulationComplete }: WarGameModalProps) {
  const [selectedScenario, setSelectedScenario] = useState<string>("ransomware");
  const [executionMode, setExecutionMode] = useState<"SHADOW" | "ACTIVE_ENFORCEMENT">("SHADOW");
  const [delaySec, setDelaySec] = useState<number>(0.25);
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "error">("idle");
  const [report, setReport] = useState<WarGameReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [copiedSha, setCopiedSha] = useState<boolean>(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const modalRef = useRef<HTMLDivElement>(null);

  const currentScenario = SCENARIOS.find((s) => s.id === selectedScenario) || SCENARIOS[0];

  // Handle keyboard events (Esc to close, Enter to run when idle)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && status !== "running") {
        onClose();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && status === "idle") {
        handleExecute();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, status]);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleExecute = useCallback(async () => {
    setStatus("running");
    setErrorMessage("");
    setReport(null);
    setActiveStepIndex(0);
    setElapsedMs(0);

    startTimeRef.current = performance.now();
    timerRef.current = setInterval(() => {
      setElapsedMs(Math.round(performance.now() - startTimeRef.current));
    }, 25);

    // Simulated step animation pacing
    const totalSteps = currentScenario.stages.length;
    const stepInterval = Math.max(delaySec * 1000, 150);
    const stepTicker = setInterval(() => {
      setActiveStepIndex((prev) => (prev < totalSteps - 1 ? prev + 1 : prev));
    }, stepInterval);

    try {
      const data = await api.post<WarGameReport>(endpoints.simulation.warGame(), {
        scenario: selectedScenario,
        mode: executionMode,
        delay_between_steps: delaySec,
      });

      clearInterval(stepTicker);
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedMs(Math.round(data.total_duration_ms || (performance.now() - startTimeRef.current)));
      setActiveStepIndex(totalSteps);
      setReport(data);
      setStatus("completed");
      if (onSimulationComplete) {
        onSimulationComplete(data);
      }
    } catch (err: any) {
      clearInterval(stepTicker);
      if (timerRef.current) clearInterval(timerRef.current);
      console.error("War Game execution failed:", err);
      setErrorMessage(
        err?.response?.data?.detail ||
        err?.message ||
        "Adversarial simulation failed: Unable to connect to backend engine."
      );
      setStatus("error");
    }
  }, [selectedScenario, executionMode, delaySec, currentScenario, onSimulationComplete]);

  const handleCopyHash = (hash: string) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(hash);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2000);
  };

  const handleReset = () => {
    setStatus("idle");
    setReport(null);
    setErrorMessage("");
    setActiveStepIndex(0);
    setElapsedMs(0);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(3, 7, 18, 0.82)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && status !== "running") onClose();
        }}
      >
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          style={{
            width: "100%",
            maxWidth: 820,
            maxHeight: "90vh",
            background: THEME.bg,
            border: `1px solid ${status === "running" ? THEME.cyan : THEME.border}`,
            boxShadow: `0 0 50px ${status === "running" ? THEME.cyanGlow : "rgba(0,0,0,0.8)"}`,
            borderRadius: 14,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            fontFamily: THEME.fontMono,
            color: THEME.textPrimary,
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="wargame-modal-title"
        >
          {/* HEADER BAR */}
          <div
            style={{
              padding: "16px 24px",
              background: "#0d1322",
              borderBottom: `1px solid ${THEME.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(0,229,255,0.2))",
                  border: `1px solid ${THEME.cyan}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                }}
              >
                ⚔️
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h2
                    id="wargame-modal-title"
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      margin: 0,
                      color: THEME.textPrimary,
                      textTransform: "uppercase",
                    }}
                  >
                    WAR GAME // ADVERSARIAL ATTACK SIMULATION
                  </h2>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: executionMode === "SHADOW" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.2)",
                      color: executionMode === "SHADOW" ? THEME.green : THEME.red,
                      border: `1px solid ${executionMode === "SHADOW" ? THEME.green : THEME.red}40`,
                    }}
                  >
                    {executionMode} MODE
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 11,
                    color: THEME.textMuted,
                    margin: "2px 0 0",
                    fontWeight: 400,
                  }}
                >
                  Autonomous Red-Teaming, Kill-Chain Injection & Response Benchmarking
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={status === "running"}
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: "transparent",
                border: `1px solid ${THEME.border}`,
                color: THEME.textMuted,
                cursor: status === "running" ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                transition: "all 0.15s ease",
              }}
              aria-label="Close modal"
              title="Close modal (Esc)"
            >
              ✕
            </button>
          </div>

          {/* MODAL BODY */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
            {/* IDLE VIEW (SETUP & CONFIGURATION) */}
            {status === "idle" && (
              <>
                {/* 1. SCENARIO SELECTOR */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: THEME.textSecondary, letterSpacing: "0.08em" }}>
                      1. SELECT ADVERSARIAL SCENARIO
                    </span>
                    <span style={{ fontSize: 10, color: THEME.cyan }}>2 ENTERPRISE PROFILES LOADED</span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {SCENARIOS.map((sc) => {
                      const isSelected = selectedScenario === sc.id;
                      return (
                        <div
                          key={sc.id}
                          onClick={() => setSelectedScenario(sc.id)}
                          style={{
                            padding: 14,
                            borderRadius: 10,
                            background: isSelected ? "#0f172a" : THEME.card,
                            border: `1px solid ${isSelected ? THEME.cyan : THEME.border}`,
                            boxShadow: isSelected ? `0 0 16px ${THEME.cyanGlow}` : "none",
                            cursor: "pointer",
                            transition: "all 0.18s ease",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: `${sc.tagColor}20`,
                                  color: sc.tagColor,
                                  border: `1px solid ${sc.tagColor}40`,
                                }}
                              >
                                {sc.tag}
                              </span>
                              <span style={{ fontSize: 11, color: isSelected ? THEME.cyan : THEME.textMuted }}>
                                {isSelected ? "● ACTIVE" : "○ SELECT"}
                              </span>
                            </div>

                            <div style={{ fontSize: 13, fontWeight: 700, color: THEME.textPrimary, marginBottom: 4 }}>
                              {sc.name}
                            </div>
                            <div style={{ fontSize: 10, color: THEME.textMuted, marginBottom: 8, lineHeight: 1.4 }}>
                              {sc.description}
                            </div>
                          </div>

                          <div
                            style={{
                              marginTop: 10,
                              paddingTop: 8,
                              borderTop: `1px solid ${THEME.border}`,
                              fontSize: 10,
                              color: THEME.textSecondary,
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <span>Actor: <strong style={{ color: THEME.textPrimary }}>{sc.threatActor}</strong></span>
                            <span>Target: <strong style={{ color: THEME.cyan }}>{sc.targetHost}</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* SCENARIO STAGES PREVIEW */}
                <div style={{ background: "#0b1120", border: `1px solid ${THEME.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: THEME.textMuted, marginBottom: 10, letterSpacing: "0.08em" }}>
                    CAMPAIGN INJECTION STAGES ({currentScenario.stages.length} STEPS)
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${currentScenario.stages.length}, 1fr)`, gap: 8 }}>
                    {currentScenario.stages.map((st) => (
                      <div
                        key={st.step}
                        style={{
                          background: THEME.card,
                          border: `1px solid ${THEME.border}`,
                          borderRadius: 6,
                          padding: "8px 10px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: THEME.cyan, marginBottom: 4 }}>
                          <span>STEP 0{st.step}</span>
                          <span style={{ fontWeight: 700 }}>{st.technique}</span>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: THEME.textPrimary, lineHeight: 1.3 }}>
                          {st.name}
                        </div>
                        <div style={{ fontSize: 9, color: THEME.textMuted, marginTop: 4 }}>
                          {st.tactic}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. EXECUTION MODE & PACING */}
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>
                  {/* Mode Toggle */}
                  <div style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textSecondary, marginBottom: 8, letterSpacing: "0.08em" }}>
                      2. EXECUTION GOVERNANCE
                    </div>

                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                      <button
                        onClick={() => setExecutionMode("SHADOW")}
                        style={{
                          flex: 1,
                          padding: "10px 8px",
                          borderRadius: 6,
                          border: `1px solid ${executionMode === "SHADOW" ? THEME.green : THEME.border}`,
                          background: executionMode === "SHADOW" ? "rgba(16,185,129,0.12)" : "transparent",
                          color: executionMode === "SHADOW" ? THEME.green : THEME.textMuted,
                          cursor: "pointer",
                          fontFamily: THEME.fontMono,
                          fontSize: 10,
                          fontWeight: 700,
                          textAlign: "center",
                          transition: "all 0.15s ease",
                        }}
                      >
                        🛡️ SHADOW (SAFE)
                      </button>

                      <button
                        onClick={() => setExecutionMode("ACTIVE_ENFORCEMENT")}
                        style={{
                          flex: 1,
                          padding: "10px 8px",
                          borderRadius: 6,
                          border: `1px solid ${executionMode === "ACTIVE_ENFORCEMENT" ? THEME.red : THEME.border}`,
                          background: executionMode === "ACTIVE_ENFORCEMENT" ? "rgba(239,68,68,0.15)" : "transparent",
                          color: executionMode === "ACTIVE_ENFORCEMENT" ? THEME.red : THEME.textMuted,
                          cursor: "pointer",
                          fontFamily: THEME.fontMono,
                          fontSize: 10,
                          fontWeight: 700,
                          textAlign: "center",
                          transition: "all 0.15s ease",
                        }}
                      >
                        ⚡ ACTIVE ENFORCE
                      </button>
                    </div>

                    <p style={{ fontSize: 10, color: THEME.textMuted, margin: 0, lineHeight: 1.4 }}>
                      {executionMode === "SHADOW"
                        ? "Zero-risk mode: Ingests real telemetry, triggers full AI detection & OPA policies, but simulates host isolation."
                        : "Enforcement mode: Executes live AWS VPC NACL isolation and host interface quarantine via automated response action."}
                    </p>
                  </div>

                  {/* Delay / Pacing */}
                  <div style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textSecondary, marginBottom: 8, letterSpacing: "0.08em" }}>
                      3. STEP PACING / DELAY
                    </div>

                    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                      {[
                        { label: "FAST (50ms)", value: 0.05 },
                        { label: "OBSERVE (250ms)", value: 0.25 },
                        { label: "DEMO (1.0s)", value: 1.0 },
                      ].map((item) => (
                        <button
                          key={item.label}
                          onClick={() => setDelaySec(item.value)}
                          style={{
                            flex: 1,
                            padding: "8px 4px",
                            borderRadius: 6,
                            border: `1px solid ${delaySec === item.value ? THEME.cyan : THEME.border}`,
                            background: delaySec === item.value ? "rgba(0,229,255,0.1)" : "transparent",
                            color: delaySec === item.value ? THEME.cyan : THEME.textMuted,
                            cursor: "pointer",
                            fontSize: 9,
                            fontWeight: 700,
                            fontFamily: THEME.fontMono,
                            transition: "all 0.15s ease",
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <p style={{ fontSize: 10, color: THEME.textMuted, margin: 0, lineHeight: 1.4 }}>
                      Controls artificial delay between kill-chain stages to observe real-time WebSocket threat propagation.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* RUNNING VIEW (LIVE SIMULATION) */}
            {status === "running" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "10px 0" }}>
                <div
                  style={{
                    padding: 16,
                    background: "rgba(0,229,255,0.06)",
                    border: `1px solid ${THEME.cyan}`,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        border: `2px dashed ${THEME.cyan}`,
                      }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: THEME.cyan }}>
                        CAMPAIGN INJECTION ACTIVE: {currentScenario.name}
                      </div>
                      <div style={{ fontSize: 10, color: THEME.textMuted, marginTop: 2 }}>
                        Target: {currentScenario.targetHost} ({currentScenario.targetIp}) | C2: {currentScenario.c2Ip}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 9, color: THEME.textMuted }}>ELAPSED TIME</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: THEME.cyan }}>
                      {elapsedMs} ms
                    </div>
                  </div>
                </div>

                {/* STEPS PIPELINE */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: THEME.textSecondary, letterSpacing: "0.08em" }}>
                    AUTONOMOUS ORCHESTRATION PIPELINE
                  </span>

                  {currentScenario.stages.map((st, idx) => {
                    const isDone = activeStepIndex > idx;
                    const isCurrent = activeStepIndex === idx;

                    return (
                      <motion.div
                        key={st.step}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          background: isCurrent ? "rgba(0,229,255,0.08)" : isDone ? "#0b1220" : THEME.card,
                          border: `1px solid ${isCurrent ? THEME.cyan : isDone ? "rgba(16,185,129,0.3)" : THEME.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              fontWeight: 700,
                              background: isDone ? THEME.green : isCurrent ? THEME.cyan : THEME.border,
                              color: isDone || isCurrent ? THEME.bg : THEME.textMuted,
                            }}
                          >
                            {isDone ? "✓" : st.step}
                          </span>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: isCurrent ? THEME.cyan : THEME.textPrimary }}>
                              {st.name}
                            </div>
                            <div style={{ fontSize: 9, color: THEME.textMuted }}>
                              {st.tactic} // MITRE {st.technique}
                            </div>
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 4,
                            background: isDone
                              ? "rgba(16,185,129,0.15)"
                              : isCurrent
                              ? "rgba(0,229,255,0.15)"
                              : "rgba(255,255,255,0.05)",
                            color: isDone ? THEME.green : isCurrent ? THEME.cyan : THEME.textMuted,
                          }}
                        >
                          {isDone ? "INGESTED & CLASSIFIED" : isCurrent ? "INJECTING TELEMETRY..." : "WAITING"}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* COMPLETED VIEW (BENCHMARKS & AUDIT REPORT) */}
            {status === "completed" && report && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {/* SUCCESS BANNER */}
                <div
                  style={{
                    padding: 16,
                    background: "rgba(16,185,129,0.08)",
                    border: `1px solid ${THEME.green}`,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: THEME.green,
                        color: THEME.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        fontWeight: 900,
                      }}
                    >
                      ✓
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: THEME.green }}>
                        CAMPAIGN CONTAINED & NEUTRALIZED
                      </div>
                      <div style={{ fontSize: 10, color: THEME.textSecondary, marginTop: 2 }}>
                        Incident Track: <strong style={{ color: THEME.cyan }}>{report.incident_id}</strong> | Action:{" "}
                        <strong style={{ color: THEME.textPrimary }}>{report.containment_action_taken}</strong>
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "4px 8px",
                      borderRadius: 4,
                      background: "rgba(16,185,129,0.15)",
                      color: THEME.green,
                      border: `1px solid ${THEME.green}40`,
                    }}
                  >
                    {report.containment_status}
                  </span>
                </div>

                {/* BENCHMARK KPIS */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  <div style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 9, color: THEME.textMuted, letterSpacing: "0.08em" }}>MTTD (DETECTION)</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: THEME.cyan, margin: "4px 0" }}>
                      {Math.round(report.mttd_ms)} <span style={{ fontSize: 11 }}>ms</span>
                    </div>
                    <div style={{ fontSize: 9, color: THEME.green }}>Target &lt; 15 min (SLA)</div>
                  </div>

                  <div style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 9, color: THEME.textMuted, letterSpacing: "0.08em" }}>MTTR (RESPONSE)</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: THEME.green, margin: "4px 0" }}>
                      {Math.round(report.mttr_ms)} <span style={{ fontSize: 11 }}>ms</span>
                    </div>
                    <div style={{ fontSize: 9, color: THEME.green }}>Autonomous Quarantine</div>
                  </div>

                  <div style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 9, color: THEME.textMuted, letterSpacing: "0.08em" }}>TOTAL DURATION</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: THEME.textPrimary, margin: "4px 0" }}>
                      {Math.round(report.total_duration_ms)} <span style={{ fontSize: 11 }}>ms</span>
                    </div>
                    <div style={{ fontSize: 9, color: THEME.cyan }}>All Stages Executed</div>
                  </div>

                  <div style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 9, color: THEME.textMuted, letterSpacing: "0.08em" }}>GOVERNANCE</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: THEME.amber, margin: "4px 0" }}>
                      OPA PASS
                    </div>
                    <div style={{ fontSize: 9, color: THEME.textSecondary }}>Zero Policy Drift</div>
                  </div>
                </div>

                {/* MITRE & THREAT INTEL MAPPINGS */}
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
                  <div style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: THEME.textSecondary, marginBottom: 8 }}>
                      MITRE ATT&CK TECHNIQUES IDENTIFIED ({report.mitre_tactics_identified.length})
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {report.mitre_tactics_identified.map((tac, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: 4,
                            background: "rgba(0,229,255,0.08)",
                            color: THEME.cyan,
                            border: `1px solid ${THEME.cyan}30`,
                          }}
                        >
                          {tac}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: THEME.textSecondary, marginBottom: 8 }}>
                      THREAT INTEL (IOC) CORRELATION
                    </div>
                    {report.threat_intel_matches.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {report.threat_intel_matches.map((ti, i) => (
                          <div
                            key={i}
                            style={{
                              fontSize: 10,
                              color: THEME.red,
                              background: "rgba(239,68,68,0.08)",
                              padding: "4px 8px",
                              borderRadius: 4,
                              border: `1px solid ${THEME.red}30`,
                            }}
                          >
                            ⚠️ {ti}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: THEME.textMuted }}>No malicious IOC matches flagged.</div>
                    )}
                  </div>
                </div>

                {/* CRYPTOGRAPHIC AUDIT EVIDENCE */}
                <div
                  style={{
                    background: "#0d1322",
                    border: `1px solid ${THEME.border}`,
                    borderRadius: 8,
                    padding: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                    <div style={{ fontSize: 9, color: THEME.textMuted, letterSpacing: "0.08em", marginBottom: 2 }}>
                      SOC 2 TYPE II / ISO 27001 AUDIT EVIDENCE (SHA-256 MANIFEST)
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: THEME.cyan,
                        fontFamily: THEME.fontMono,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {report.compliance_manifest_sha256}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => handleCopyHash(report.compliance_manifest_sha256)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        background: copiedSha ? THEME.green : "transparent",
                        border: `1px solid ${copiedSha ? THEME.green : THEME.cyan}`,
                        color: copiedSha ? THEME.bg : THEME.cyan,
                        fontSize: 9.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: THEME.fontMono,
                        transition: "all 0.15s ease",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {copiedSha ? "COPIED ✓" : "COPY HASH"}
                    </button>

                    <button
                      onClick={() => {
                        const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
                        const a = document.createElement("a");
                        a.href = jsonStr;
                        a.download = `asoc-wargame-evidence-${report.incident_id}.json`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                      }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        background: "rgba(0,229,255,0.15)",
                        border: `1px solid ${THEME.cyan}`,
                        color: THEME.cyan,
                        fontSize: 9.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: THEME.fontMono,
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                      title="Download complete JSON evidence bundle with cryptographic hash"
                    >
                      <span>📥</span>
                      <span>EXPORT EVIDENCE</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ERROR VIEW */}
            {status === "error" && (
              <div
                style={{
                  padding: 16,
                  borderRadius: 10,
                  background: "rgba(239,68,68,0.1)",
                  border: `1px solid ${THEME.red}`,
                  color: THEME.textPrimary,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>⚠️</span>
                  <strong style={{ color: THEME.red, fontSize: 13 }}>SIMULATION ENGINE ERROR</strong>
                </div>
                <p style={{ fontSize: 11, color: THEME.textSecondary, margin: "0 0 12px", lineHeight: 1.4 }}>
                  {errorMessage}
                </p>
                <button
                  onClick={handleReset}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    background: THEME.red,
                    color: "#fff",
                    border: "none",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: THEME.fontMono,
                  }}
                >
                  RETRY CONFIGURATION
                </button>
              </div>
            )}
          </div>

          {/* FOOTER ACTIONS */}
          <div
            style={{
              padding: "14px 24px",
              background: "#0d1322",
              borderTop: `1px solid ${THEME.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontSize: 10, color: THEME.textMuted }}>
              {status === "idle" ? (
                <>Press <kbd style={{ padding: "1px 4px", background: THEME.card, borderRadius: 3, border: `1px solid ${THEME.border}` }}>Esc</kbd> to cancel or <kbd style={{ padding: "1px 4px", background: THEME.card, borderRadius: 3, border: `1px solid ${THEME.border}` }}>Ctrl+Enter</kbd> to launch.</>
              ) : status === "completed" ? (
                <>Evidence cryptographically verified and signed in audit trail.</>
              ) : (
                <>Autonomous operations center active.</>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              {status === "idle" && (
                <>
                  <button
                    onClick={onClose}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 6,
                      background: "transparent",
                      border: `1px solid ${THEME.border}`,
                      color: THEME.textSecondary,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: THEME.fontMono,
                    }}
                  >
                    CANCEL
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleExecute}
                    style={{
                      padding: "8px 20px",
                      borderRadius: 6,
                      background: executionMode === "ACTIVE_ENFORCEMENT" ? THEME.red : THEME.cyan,
                      color: THEME.bg,
                      border: "none",
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: "pointer",
                      fontFamily: THEME.fontMono,
                      letterSpacing: "0.04em",
                      boxShadow: `0 0 16px ${executionMode === "ACTIVE_ENFORCEMENT" ? THEME.redGlow : THEME.cyanGlow}`,
                    }}
                  >
                    ⚔️ EXECUTE WAR GAME
                  </motion.button>
                </>
              )}

              {status === "completed" && (
                <>
                  <button
                    onClick={handleReset}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 6,
                      background: "transparent",
                      border: `1px solid ${THEME.border}`,
                      color: THEME.textSecondary,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: THEME.fontMono,
                    }}
                  >
                    CONFIGURE ANOTHER RUN
                  </button>
                  <button
                    onClick={onClose}
                    style={{
                      padding: "8px 20px",
                      borderRadius: 6,
                      background: THEME.cyan,
                      color: THEME.bg,
                      border: "none",
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: "pointer",
                      fontFamily: THEME.fontMono,
                      letterSpacing: "0.04em",
                    }}
                  >
                    VIEW IN LIVE THREAT FEED →
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
