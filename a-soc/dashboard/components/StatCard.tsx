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
  cyan: { bg: "#e0f7fa", icon: "#007b83" },
  purple: { bg: "#f3e8fd", icon: "#7627bb" },
  rose: { bg: "#fce8e6", icon: "#c5221f" },
  emerald: { bg: "#e6f4ea", icon: "#137333" },
  amber: { bg: "#fef7e0", icon: "#e37400" },
  blue: { bg: "#e8f0fe", icon: "#1a73e8" },
};

export default function StatCard({ icon, label, value, subValue, color = "cyan", className, delay = 0 }: StatCardProps) {
  const c = colorMap[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={cn("card", className)}
      style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: c.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: c.icon,
        }}>
          {icon}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 600, color: "#111827", fontFamily: "var(--font-mono)", lineHeight: 1.1 }}>
          {value}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 400, marginTop: 4 }}>
          {label}
        </div>
        {subValue && (
          <div style={{ fontSize: 11, color: c.icon, fontWeight: 500, marginTop: 4 }}>
            {subValue}
          </div>
        )}
      </div>
    </motion.div>
  );
}
