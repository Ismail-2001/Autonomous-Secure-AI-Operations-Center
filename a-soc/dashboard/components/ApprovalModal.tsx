"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDeny();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDeny]);

  const riskColor = riskScore >= 70 ? "#ea4335" : riskScore >= 40 ? "#f9ab00" : "#34a853";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="modal-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) onDeny(); }}
      >
        <motion.div
          ref={dialogRef}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="modal-content"
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: "#fef7e0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              }}>
                ⚠️
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>Approval Required</h2>
                <p style={{ fontSize: 12, color: "#6b7280" }}>High-risk action requires human authorization</p>
              </div>
            </div>
          </div>

          <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ padding: "10px 14px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>Action</div>
                <div style={{ fontSize: 13, color: "#111827", fontWeight: 500, fontFamily: "var(--font-mono)" }}>{action}</div>
              </div>
              <div style={{ padding: "10px 14px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>Target</div>
                <div style={{ fontSize: 13, color: "#111827", fontWeight: 500, fontFamily: "var(--font-mono)" }}>{target}</div>
              </div>
            </div>

            <div style={{ padding: "10px 14px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>Risk Assessment</span>
                <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)", color: riskColor }}>{riskScore}/100</span>
              </div>
              <div className="progress-bar">
                <motion.div
                  className="progress-bar-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${riskScore}%` }}
                  transition={{ duration: 0.8 }}
                  style={{ background: riskColor }}
                />
              </div>
            </div>

            {agent && (
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Requested by: <span style={{ color: "#1a73e8", fontWeight: 500 }}>{agent}</span>
              </div>
            )}

            {reasoning && (
              <div style={{ padding: "10px 14px", background: "#e8f0fe", borderRadius: 8, border: "1px solid #d2e3fc" }}>
                <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", marginBottom: 6 }}>AI Reasoning</div>
                <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>{reasoning}</p>
              </div>
            )}
          </div>

          <div style={{ padding: "16px 24px 20px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onDeny} className="btn-secondary">
              Deny
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onApprove} className="btn-primary">
              Authorize
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
