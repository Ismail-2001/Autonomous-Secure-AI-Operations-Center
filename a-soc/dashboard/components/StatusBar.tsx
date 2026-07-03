"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface StatusBarProps {
  connectionState?: "CLOSED" | "CONNECTING" | "OPEN" | "RECONNECTING";
}

export default function StatusBar({ connectionState = "OPEN" }: StatusBarProps) {
  const [utcTime, setUtcTime] = useState("");
  const [latency, setLatency] = useState(() => Math.floor(8 + Math.random() * 10));

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, "0");
      const m = String(now.getUTCMinutes()).padStart(2, "0");
      const s = String(now.getUTCSeconds()).padStart(2, "0");
      setUtcTime(`${h}:${m}:${s} UTC`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setLatency((prev) => prev + Math.floor(Math.random() * 3) - 1);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const wsConnected = connectionState === "OPEN";

  return (
    <footer
      style={{
        position: "fixed",
        bottom: 0,
        left: 260,
        right: 0,
        height: 28,
        background: "#060a14",
        borderTop: "1px solid rgba(0, 255, 255, 0.08)",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 24,
        zIndex: 30,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.04em",
      }}
    >
      {/* System Clock */}
      <StatusItem label="SYSTEM CLOCK" value={utcTime} />

      {/* Separator */}
      <Divider />

      {/* WebSocket Status */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "#00bcd4", textTransform: "uppercase" }}>WEBSOCKET:</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <motion.span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: wsConnected ? "#22c55e" : connectionState === "CONNECTING" || connectionState === "RECONNECTING" ? "#f59e0b" : "#ef4444",
              flexShrink: 0,
            }}
            animate={{ opacity: wsConnected ? [1, 0.4, 1] : 1 }}
            transition={{ duration: 2, repeat: wsConnected ? Infinity : 0, ease: "easeInOut" }}
          />
          <span style={{ color: wsConnected ? "#22c55e" : connectionState === "CONNECTING" || connectionState === "RECONNECTING" ? "#f59e0b" : "#ef4444", textTransform: "uppercase", fontWeight: 600 }}>
            {connectionState}
          </span>
        </span>
      </div>

      <Divider />

      {/* Environment */}
      <StatusItem label="ENV" value="PRODUCTION" />

      <Divider />

      {/* Latency */}
      <StatusItem label="LATENCY" value={`${latency}ms`} />

      <Divider />

      {/* CLI Access */}
      <StatusItem label="CLI ACCESS" value="ENABLED" />
    </footer>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
      <span style={{ color: "#00bcd4", textTransform: "uppercase" }}>{label}:</span>
      <span style={{ color: "#8899bb", textTransform: "uppercase" }}>{value}</span>
    </div>
  );
}

function Divider() {
  return (
    <span
      style={{
        width: 1,
        height: 12,
        background: "rgba(0, 255, 255, 0.1)",
        flexShrink: 0,
      }}
    />
  );
}
