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
    <header
      style={{
        height: 60,
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0d1117",
        borderBottom: "1px solid #1e2a3a",
        zIndex: 50,
        flexShrink: 0,
      }}
    >
      {/* Left */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <motion.h1
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "#00e5ff",
            fontFamily: "'Courier New', monospace",
            letterSpacing: 2,
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          A-SOC COMMAND
        </motion.h1>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "#00e5ff",
            background: "rgba(0,229,255,0.1)",
            border: "1px solid rgba(0,229,255,0.2)",
            borderRadius: 4,
            padding: "2px 8px",
          }}
        >
          LIVE
        </span>
      </div>

      {/* Center - Query bar */}
      <div
        style={{
          flex: 1,
          maxWidth: 480,
          margin: "0 32px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "#161b22",
            border: "1px solid #1e2a3a",
            borderRadius: 8,
            padding: "6px 12px",
            gap: 8,
          }}
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#484f58"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="QUERY ASSETS (CMD+K)..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#c9d1d9",
              fontSize: 12,
              fontFamily: "'Courier New', monospace",
              letterSpacing: 0.5,
            }}
          />
          <kbd
            style={{
              fontSize: 10,
              color: "#484f58",
              background: "#0d1117",
              border: "1px solid #1e2a3a",
              borderRadius: 4,
              padding: "1px 5px",
              fontFamily: "'Courier New', monospace",
            }}
          >
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 11,
            color: "#484f58",
            fontFamily: "'Courier New', monospace",
            marginRight: 8,
          }}
        >
          {time.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })}
        </span>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: "1px solid #1e2a3a",
            background: "transparent",
            color: "#8b949e",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Screen Cast"
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8" />
            <path d="M12 17v4" />
            <path d="M6 10l4-3 4 3" />
          </svg>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: "1px solid #1e2a3a",
            background: "transparent",
            color: "#8b949e",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
          title="Notifications"
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          <span
            style={{
              position: "absolute",
              top: 5,
              right: 5,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#f85149",
              boxShadow: "0 0 6px rgba(248,81,73,0.6)",
            }}
          />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onSimulate}
          disabled={simulating}
          style={{
            height: 34,
            padding: "0 14px",
            borderRadius: 8,
            border: simulating ? "1px solid rgba(0,229,255,0.2)" : "1px solid #1e2a3a",
            background: simulating ? "rgba(0,229,255,0.08)" : "transparent",
            color: simulating ? "#00e5ff" : "#8b949e",
            cursor: simulating ? "wait" : "pointer",
            fontSize: 11,
            fontWeight: 500,
            fontFamily: "'Courier New', monospace",
            letterSpacing: 0.5,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {simulating ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              style={{ display: "inline-block", width: 12, height: 12 }}
            >
              ⟳
            </motion.span>
          ) : (
            <svg
              width={12}
              height={12}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
          {simulating ? "SIMULATING..." : "SIMULATE"}
        </motion.button>

        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #00e5ff, #0070ff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 600,
            color: "#0d1117",
            cursor: "pointer",
            border: "2px solid #0d1117",
            boxShadow: "0 0 0 2px rgba(0,229,255,0.3)",
            marginLeft: 4,
          }}
          title="Operator: admin@asoc"
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0d1117"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      </div>
    </header>
  );
}
