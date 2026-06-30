"use client";

import { useState, useEffect } from "react";
import { Clock, Globe, Bell, Play, Activity } from "lucide-react";
import Link from "next/link";

interface TopBarProps {
  connectionState?: string;
  onSimulate?: () => void;
}

export function TopBar({ connectionState, onSimulate }: TopBarProps) {
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/30 backdrop-blur-sm flex items-center justify-between px-8 shrink-0">
      <div className="flex items-center gap-4 text-slate-400 text-sm">
        <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700">
          <Clock className="w-3 h-3 text-cyan-400" />
          <span className="font-mono text-cyan-100">{currentTime}</span>
        </span>
        <span className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700">
          <Globe className="w-3 h-3 text-emerald-400" />
          US-EAST-1
        </span>
      </div>

      <div className="flex items-center gap-4">
        {onSimulate && (
          <button
            onClick={onSimulate}
            disabled={connectionState !== "OPEN"}
            className={`cyber-button flex items-center gap-2 text-sm !py-2 !px-4 ${connectionState !== "OPEN" ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {connectionState !== "OPEN" ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {connectionState !== "OPEN" ? "CONNECTING..." : "INITIATE SIMULATION"}
          </button>
        )}
        <div className="w-px h-6 bg-slate-800" />
        <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        </button>
      </div>
    </header>
  );
}
