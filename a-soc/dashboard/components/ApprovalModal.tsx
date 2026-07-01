"use client";

import React, { useEffect, useRef } from "react";

interface ApprovalModalProps {
  action: string;
  target: string;
  riskScore: number;
  reasoning?: string;
  agent?: string;
  onApprove: () => void;
  onDeny: () => void;
}

export default function ApprovalModal({ action, target, riskScore, reasoning, agent, onApprove, onDeny }: ApprovalModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const riskColor = riskScore >= 70 ? "#ef4444" : riskScore >= 40 ? "#f59e0b" : "#22c55e";

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onDeny(); }}>
      <div
        ref={dialogRef}
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-label="Approval Required"
        tabIndex={-1}
        style={{ borderLeft: `4px solid ${riskColor}` }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(51, 65, 85, 0.5)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(245, 158, 11, 0.15)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}>
              ⚠️
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>Approval Required</h2>
              <p style={{ fontSize: 12, color: "#64748b" }}>High-risk action requires human authorization</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Action & Target */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ padding: "10px 14px", background: "rgba(2, 6, 23, 0.5)", borderRadius: 8, border: "1px solid rgba(51, 65, 85, 0.3)" }}>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Action</div>
              <div style={{ fontSize: 13, color: "#f8fafc", fontWeight: 600, fontFamily: "JetBrains Mono, monospace" }}>{action}</div>
            </div>
            <div style={{ padding: "10px 14px", background: "rgba(2, 6, 23, 0.5)", borderRadius: 8, border: "1px solid rgba(51, 65, 85, 0.3)" }}>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Target</div>
              <div style={{ fontSize: 13, color: "#f8fafc", fontWeight: 600, fontFamily: "JetBrains Mono, monospace" }}>{target}</div>
            </div>
          </div>

          {/* Risk Score */}
          <div style={{ padding: "10px 14px", background: "rgba(2, 6, 23, 0.5)", borderRadius: 8, border: "1px solid rgba(51, 65, 85, 0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Risk Assessment</span>
              <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "JetBrains Mono, monospace", color: riskColor }}>{riskScore}/100</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${riskScore}%`, background: `linear-gradient(90deg, ${riskColor}, ${riskColor}88)` }} />
            </div>
          </div>

          {/* Agent */}
          {agent && (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              Requested by: <span style={{ color: "#06b6d4", fontWeight: 600 }}>{agent}</span>
            </div>
          )}

          {/* Reasoning */}
          {reasoning && (
            <div style={{ padding: "10px 14px", background: "rgba(6, 182, 212, 0.05)", borderRadius: 8, border: "1px solid rgba(6, 182, 212, 0.15)" }}>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>AI Reasoning</div>
              <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{reasoning}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px 20px", borderTop: "1px solid rgba(51, 65, 85, 0.5)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onDeny} className="btn-ghost">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            Deny
          </button>
          <button onClick={onApprove} className="btn-primary">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4" />
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Authorize
          </button>
        </div>
      </div>
    </div>
  );
}
