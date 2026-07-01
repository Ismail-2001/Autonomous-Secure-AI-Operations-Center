"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface TopBarProps {
  onSimulate?: () => void;
  simulating?: boolean;
}

export default function TopBar({ onSimulate, simulating }: TopBarProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      style={{
        height: 56,
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(15, 23, 42, 0.8)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(51, 65, 85, 0.5)",
        zIndex: 50,
        flexShrink: 0,
      }}
    >
      {/* Left: Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc", letterSpacing: "0.01em" }}>
          Security Operations Center
        </h1>
        <motion.span
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "#06b6d4",
            background: "rgba(6, 182, 212, 0.1)",
            border: "1px solid rgba(6, 182, 212, 0.2)",
            borderRadius: 4,
            padding: "2px 8px",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          LIVE
        </motion.span>
      </div>

      {/* Right: Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Region */}
        <span style={{
          fontSize: 11,
          color: "#64748b",
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 500,
        }}>
          US-EAST-1
        </span>

        {/* Clock */}
        <span style={{
          fontSize: 12,
          color: "#94a3b8",
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 500,
          minWidth: 70,
        }}>
          {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
        </span>

        {/* Simulate Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onSimulate}
          disabled={simulating}
          style={{
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 600,
            color: simulating ? "#64748b" : "#06b6d4",
            background: simulating ? "rgba(6, 182, 212, 0.05)" : "rgba(6, 182, 212, 0.1)",
            border: "1px solid rgba(6, 182, 212, 0.2)",
            borderRadius: 6,
            cursor: simulating ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            letterSpacing: "0.03em",
          }}
        >
          {simulating ? "⟳ SIMULATING..." : "▶ SIMULATE"}
        </motion.button>

        {/* Notifications */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "transparent",
            border: "1px solid rgba(51, 65, 85, 0.5)",
            color: "#94a3b8",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
            position: "relative",
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#ef4444",
              border: "1.5px solid #0f172a",
            }}
          />
        </motion.button>
      </div>
    </motion.header>
  );
}
