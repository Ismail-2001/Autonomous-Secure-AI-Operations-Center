"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color?: "cyan" | "purple" | "rose" | "emerald" | "amber" | "blue";
  className?: string;
  delay?: number;
}

const colorMap = {
  cyan: {
    bg: "rgba(6, 182, 212, 0.1)",
    border: "rgba(6, 182, 212, 0.25)",
    icon: "#06b6d4",
    glow: "0 0 20px rgba(6, 182, 212, 0.15)",
  },
  purple: {
    bg: "rgba(139, 92, 246, 0.1)",
    border: "rgba(139, 92, 246, 0.25)",
    icon: "#8b5cf6",
    glow: "0 0 20px rgba(139, 92, 246, 0.15)",
  },
  rose: {
    bg: "rgba(239, 68, 68, 0.1)",
    border: "rgba(239, 68, 68, 0.25)",
    icon: "#ef4444",
    glow: "0 0 20px rgba(239, 68, 68, 0.15)",
  },
  emerald: {
    bg: "rgba(34, 197, 94, 0.1)",
    border: "rgba(34, 197, 94, 0.25)",
    icon: "#22c55e",
    glow: "0 0 20px rgba(34, 197, 94, 0.15)",
  },
  amber: {
    bg: "rgba(245, 158, 11, 0.1)",
    border: "rgba(245, 158, 11, 0.25)",
    icon: "#f59e0b",
    glow: "0 0 20px rgba(245, 158, 11, 0.15)",
  },
  blue: {
    bg: "rgba(59, 130, 246, 0.1)",
    border: "rgba(59, 130, 246, 0.25)",
    icon: "#3b82f6",
    glow: "0 0 20px rgba(59, 130, 246, 0.15)",
  },
};

export default function StatCard({ icon, label, value, subValue, color = "cyan", className, delay = 0 }: StatCardProps) {
  const c = colorMap[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.34, 1.56, 0.64, 1] }}
      whileHover={{ y: -2, boxShadow: c.glow }}
      className={cn("glass-card", className)}
      style={{
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        borderColor: c.border,
        boxShadow: c.glow,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <motion.div
          whileHover={{ rotate: 5, scale: 1.1 }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: c.bg,
            border: `1px solid ${c.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: c.icon,
          }}
        >
          {icon}
        </motion.div>
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#f8fafc", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.1 }}>
          {value}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </div>
        {subValue && (
          <div style={{ fontSize: 11, color: c.icon, fontWeight: 600, marginTop: 4 }}>
            {subValue}
          </div>
        )}
      </div>
    </motion.div>
  );
}
