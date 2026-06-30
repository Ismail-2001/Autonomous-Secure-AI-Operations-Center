"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  subValue?: string;
  color?: "cyan" | "purple" | "rose" | "emerald" | "orange";
  className?: string;
}

const colorMap = {
  cyan: { border: "border-cyan-500/20", icon: "text-cyan-400 bg-cyan-500/10", glow: "shadow-[0_0_15px_-5px_rgba(6,182,212,0.2)]" },
  purple: { border: "border-purple-500/20", icon: "text-purple-400 bg-purple-500/10", glow: "shadow-[0_0_15px_-5px_rgba(139,92,246,0.2)]" },
  rose: { border: "border-rose-500/20", icon: "text-rose-400 bg-rose-500/10", glow: "shadow-[0_0_15px_-5px_rgba(244,63,94,0.2)]" },
  emerald: { border: "border-emerald-500/20", icon: "text-emerald-400 bg-emerald-500/10", glow: "shadow-[0_0_15px_-5px_rgba(16,185,129,0.2)]" },
  orange: { border: "border-orange-500/20", icon: "text-orange-400 bg-orange-500/10", glow: "shadow-[0_0_15px_-5px_rgba(249,115,22,0.2)]" },
};

export function StatCard({ icon: Icon, label, value, subValue, color = "cyan", className }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div
      className={cn("glass-card p-4 group", c.border, c.glow, className)}
      role="article"
      aria-label={`${label}: ${value}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={cn("p-2 rounded-lg", c.icon)}>
          <Icon className="w-4 h-4" />
        </div>
        {subValue && (
          <span className="text-xs font-mono text-slate-500">{subValue}</span>
        )}
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
