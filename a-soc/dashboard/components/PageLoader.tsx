"use client";

import React from "react";

export default function PageLoader({ text = "Loading..." }: { text?: string }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      gap: 16,
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 14,
        background: "rgba(6, 182, 212, 0.1)",
        border: "1px solid rgba(6, 182, 212, 0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 24,
        animation: "pulse-slow 2s ease-in-out infinite",
      }}>
        🛡️
      </div>
      <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>{text}</span>
    </div>
  );
}
