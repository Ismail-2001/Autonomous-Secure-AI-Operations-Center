"use client";

import { useState, useEffect, useMemo } from "react";
import { cn, agentColor } from "@/lib/utils";
import { config } from "@/lib/config";

interface AgentGridProps {
  running?: boolean;
}

interface AgentLoad {
  name: string;
  role: string;
  load: number;
  pid: number;
  color: string;
}

export function AgentGrid({ running = false }: AgentGridProps) {
  const [agents, setAgents] = useState<AgentLoad[]>(() =>
    config.agents.map((a) => ({
      ...a,
      load: Math.floor(Math.random() * 40 + 10),
      pid: Math.floor(Math.random() * 9000 + 1000),
    }))
  );

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setAgents((prev) =>
        prev.map((a) => ({
          ...a,
          load: Math.max(0, Math.min(100, a.load + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 8))),
        }))
      );
    }, 2000);
    return () => clearInterval(interval);
  }, [running]);

  return (
    <div className="grid grid-cols-1 gap-2">
      {agents.map((agent) => (
        <div
          key={agent.name}
          className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900/50 border border-slate-800/50 hover:border-slate-700/50 transition-colors"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
            style={{ backgroundColor: `${agent.color}15`, color: agent.color }}
          >
            {agent.name.replace("Agent", "").slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300 truncate">{agent.name}</span>
              <span className="text-[10px] font-mono text-slate-600">PID {agent.pid}</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${agent.load}%`,
                    backgroundColor: agent.load > 80 ? "#ef4444" : agent.load > 50 ? "#f59e0b" : agent.color,
                  }}
                />
              </div>
              <span className="text-[10px] font-mono text-slate-500 w-8 text-right">{agent.load}%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
