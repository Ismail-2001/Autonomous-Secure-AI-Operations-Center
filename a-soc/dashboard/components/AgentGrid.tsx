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
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", padding: "0 4px", marginBottom: 4 }}>
        AI Agent Operations
      </div>
      {config.agents.map((agent, i) => {
        const load = loads[agent.name] || 0;
        return (
          <motion.div
            key={agent.name}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.03 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              borderRadius: 8,
              background: "#f9fafb",
              border: "1px solid #f3f4f6",
              transition: "all 0.15s ease",
            }}
          >
            <span style={{ fontSize: 14, width: 24, textAlign: "center" }}>{agent.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {agent.name.replace("Agent", "")}
                </span>
                <span style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: load > 70 ? "#c5221f" : load > 40 ? "#e37400" : "#137333",
                  fontWeight: 500,
                }}>
                  {Math.round(load)}%
                </span>
              </div>
              <div className="agent-load-bar">
                <div
                  className="agent-load-bar-fill"
                  style={{ width: `${load}%`, background: agent.color }}
                />
              </div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{agent.role}</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
