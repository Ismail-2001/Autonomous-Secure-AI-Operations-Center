"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { config } from "@/lib/config";

interface AgentGridProps {
  running?: boolean;
}

export default function AgentGrid({ running = true }: AgentGridProps) {
  const [loads, setLoads] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!running) return;
    const initial: Record<string, number> = {};
    config.agents.forEach((a) => { initial[a.name] = Math.random() * 40 + 20; });
    setLoads(initial);

    const interval = setInterval(() => {
      setLoads((prev) => {
        const next = { ...prev };
        config.agents.forEach((a) => {
          const delta = (Math.random() - 0.5) * 15;
          next[a.name] = Math.max(5, Math.min(95, (prev[a.name] || 30) + delta));
        });
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [running]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 4px" }}>
        AI Agent Operations
      </div>
      {config.agents.map((agent, i) => {
        const load = loads[agent.name] || 0;
        return (
          <motion.div
            key={agent.name}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
            whileHover={{ x: 4, background: "rgba(30, 41, 59, 0.8)" }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(15, 23, 42, 0.5)",
              border: "1px solid rgba(51, 65, 85, 0.3)",
              transition: "all 0.2s ease",
            }}
          >
            <span style={{ fontSize: 16, width: 28, textAlign: "center" }}>{agent.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#f8fafc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {agent.name.replace("Agent", "")}
                </span>
                <span style={{
                  fontSize: 10,
                  fontFamily: "JetBrains Mono, monospace",
                  color: load > 70 ? "#ef4444" : load > 40 ? "#f59e0b" : "#22c55e",
                  fontWeight: 600,
                }}>
                  {Math.round(load)}%
                </span>
              </div>
              <div className="agent-load-bar">
                <motion.div
                  className="agent-load-bar-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${load}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{
                    background: `linear-gradient(90deg, ${agent.color}, ${agent.color}88)`,
                  }}
                />
              </div>
              <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>{agent.role}</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
