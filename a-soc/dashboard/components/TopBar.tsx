"use client";

import { useState, useEffect } from "react";
import { Clock, Globe, Bell, Play, Activity } from "lucide-react";

interface TopBarProps {
  connectionState?: string;
  onSimulate?: () => void;
  title?: string;
  subtitle?: string;
}

export function TopBar({ connectionState, onSimulate, title, subtitle }: TopBarProps) {
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString());
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-14 border-b border-slate-800/50 bg-[#0a0f1a]/60 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4 min-w-0">
        {title ? (
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white truncate">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
          </div>
        ) : (
          <div className="flex items-center gap-3 text-slate-500 text-xs">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/50 border border-slate-700/50">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span className="font-mono text-slate-300">{currentTime}</span>
            </span>
            <span className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/50 border border-slate-700/50">
              <Globe className="w-3 h-3 text-emerald-400" />
              US-EAST-1
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {onSimulate && (
          <button
            onClick={onSimulate}
            disabled={connectionState !== "OPEN"}
            className="btn-primary text-xs !py-1.5 !px-3"
          >
            {connectionState !== "OPEN" ? (
              <Activity className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            {connectionState !== "OPEN" ? "CONNECTING" : "SIMULATE"}
          </button>
        )}
        <button
          className="relative p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 rounded-lg transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>
      </div>
    </header>
  );
}
