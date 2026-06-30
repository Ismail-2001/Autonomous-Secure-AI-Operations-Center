"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield, Activity, Search, Database, Terminal,
  Globe, Lock, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { icon: Activity, label: "Live Monitoring", href: "/" },
  { icon: Search, label: "Threat Hunting", href: "/hunting" },
  { icon: Database, label: "Asset Inventory", href: "/assets" },
  { icon: Terminal, label: "Forensics Lab", href: "/forensics" },
  { icon: Globe, label: "Threat Intel", href: "/threat-intel" },
  { icon: Lock, label: "Governance", href: "/governance" },
];

interface SidebarProps {
  connectionState?: string;
}

export function Sidebar({ connectionState }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col z-20 transition-all duration-300 shrink-0 h-screen",
        "bg-[#0a0f1a]/80 backdrop-blur-xl border-r border-slate-800/50",
        collapsed ? "w-[68px]" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/50">
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
          <div className="p-1.5 bg-cyan-500/10 rounded-lg border border-cyan-500/20 shrink-0">
            <Shield className="w-5 h-5 text-cyan-400" />
          </div>
          {!collapsed && (
            <span className="font-bold text-lg tracking-tight text-white whitespace-nowrap">
              A-SOC <span className="text-cyan-400">PRO</span>
            </span>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1" role="navigation" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                  : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-300 border border-transparent"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {isActive && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Connection Status */}
      <div className="p-3 border-t border-slate-800/50">
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg",
          "bg-slate-900/50"
        )}>
          <div className={cn(
            "status-dot shrink-0",
            connectionState === "OPEN" ? "status-dot-online" :
            connectionState === "CONNECTING" || connectionState === "RECONNECTING"
              ? "status-dot-warning" : "status-dot-offline"
          )} />
          {!collapsed && (
            <span className="text-xs font-mono text-slate-500 truncate">
              WS: {connectionState || "CLOSED"}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
