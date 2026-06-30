"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield, Activity, Search, Database, Terminal,
  Globe, Lock, User, Bell, LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Activity, label: "Live Monitoring", href: "/" },
  { icon: Search, label: "Threat Hunting", href: "/hunting" },
  { icon: Database, label: "Asset Inventory", href: "/assets" },
  { icon: Terminal, label: "Forensics Lab", href: "/forensics" },
  { icon: Globe, label: "Threat Intel", href: "/threat-intel" },
  { icon: Lock, label: "Governance", href: "/governance" },
];

export function Sidebar({ connectionState }: { connectionState?: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-20 lg:w-64 bg-slate-900/50 backdrop-blur-xl border-r border-slate-800 flex flex-col z-20 transition-all duration-300 shrink-0">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800/50">
        <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
          <Shield className="w-6 h-6 text-cyan-400 animate-pulse-slow" />
        </div>
        <span className="font-bold text-xl tracking-tighter text-white hidden lg:block">
          A-SOC <span className="text-cyan-500">PRO</span>
        </span>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-lg transition-all group",
                isActive
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_-5px_rgba(6,182,212,0.3)]"
                  : "text-slate-500 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="hidden lg:block font-medium text-sm">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_cyan] hidden lg:block" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800/50">
        <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600" />
            <div className="hidden lg:block">
              <p className="text-sm font-bold text-white">Chief Operator</p>
              <p className="text-xs text-slate-500">SEC-OPS LEVEL 5</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              connectionState === "OPEN" ? "bg-green-500 animate-pulse" :
              connectionState === "CONNECTING" || connectionState === "RECONNECTING"
                ? "bg-yellow-500 animate-pulse" : "bg-red-500"
            )} />
            <span className="text-[10px] text-slate-500 font-mono hidden lg:block">
              WS: {connectionState || "CLOSED"}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
