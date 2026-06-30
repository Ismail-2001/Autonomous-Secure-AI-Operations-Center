"use client";

import { useEffect, useRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface LogEntry {
  id?: string;
  timestamp: string;
  source: string;
  severity: string;
  description: string;
}

interface TerminalFeedProps {
  title: string;
  logs: LogEntry[];
  color?: "red" | "cyan" | "green" | "amber";
  icon: LucideIcon;
}

const colorMap = {
  red: { border: "border-red-500/20", dot: "bg-red-500", text: "text-red-400" },
  cyan: { border: "border-cyan-500/20", dot: "bg-cyan-500", text: "text-cyan-400" },
  green: { border: "border-green-500/20", dot: "bg-green-500", text: "text-green-400" },
  amber: { border: "border-amber-500/20", dot: "bg-amber-500", text: "text-amber-400" },
};

const severityClass: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-green-400",
  info: "text-blue-400",
};

export function TerminalFeed({ title, logs, color = "cyan", icon: Icon }: TerminalFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const c = colorMap[color];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs.length]);

  return (
    <div className={cn("glass-card flex flex-col h-full", c.border)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-3.5 h-3.5", c.text)} />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn("w-1.5 h-1.5 rounded-full", c.dot, "animate-pulse")} />
          <span className="text-[10px] text-slate-500 font-mono">LIVE</span>
        </div>
      </div>

      {/* Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1.5 no-scrollbar" aria-live="polite">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full opacity-30">
            <p className="text-xs font-mono text-slate-500">Waiting for events...</p>
          </div>
        ) : (
          logs.map((log, i) => (
            <div
              key={log.id || i}
              className="flex items-start gap-2 text-xs font-mono leading-relaxed group"
            >
              <span className="text-slate-600 shrink-0 w-14">{new Date(log.timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              <span className={cn("shrink-0", severityClass[log.severity] || "text-slate-500")}>[{log.severity.toUpperCase().padEnd(8)}]</span>
              <span className="text-slate-400 shrink-0">{log.source}:</span>
              <span className="text-slate-300 break-all">{log.description}</span>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-slate-800/50 text-[10px] text-slate-600 font-mono">
        <span>{logs.length} events</span>
        <span>{title}</span>
      </div>
    </div>
  );
}
