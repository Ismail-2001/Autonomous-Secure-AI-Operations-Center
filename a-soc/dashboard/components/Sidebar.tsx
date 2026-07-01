"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Live Monitoring", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { href: "/hunting", label: "Threat Hunting", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { href: "/assets", label: "Asset Inventory", icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" },
  { href: "/forensics", label: "Forensics Lab", icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { href: "/threat-intel", label: "Threat Intel", icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/governance", label: "Governance", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <aside
      style={{
        width: collapsed ? 68 : 240,
        minHeight: "100vh",
        background: "rgba(15, 23, 42, 0.95)",
        backdropFilter: "blur(12px)",
        borderRight: "1px solid rgba(51, 65, 85, 0.5)",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        zIndex: 40,
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{
        padding: collapsed ? "20px 0" : "20px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderBottom: "1px solid rgba(51, 65, 85, 0.5)",
        minHeight: 72,
        justifyContent: collapsed ? "center" : "flex-start",
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          flexShrink: 0,
          boxShadow: "0 0 20px rgba(6, 182, 212, 0.3)",
        }}>
          🛡️
        </div>
        {!collapsed && (
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
              A-SOC
            </div>
            <div style={{ fontSize: 10, color: "#64748b", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              Autonomous Security
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={() => setHovered(item.href)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: collapsed ? "10px 0" : "10px 14px",
                borderRadius: 8,
                textDecoration: "none",
                color: active ? "#06b6d4" : "#94a3b8",
                background: active
                  ? "rgba(6, 182, 212, 0.1)"
                  : hovered === item.href
                    ? "rgba(51, 65, 85, 0.3)"
                    : "transparent",
                borderLeft: active ? "3px solid #06b6d4" : "3px solid transparent",
                transition: "all 0.2s ease",
                justifyContent: collapsed ? "center" : "flex-start",
                position: "relative",
                fontWeight: active ? 600 : 500,
                fontSize: 13.5,
              }}
            >
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? 2.2 : 1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d={item.icon} />
              </svg>
              {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Connection Status */}
      <div style={{
        padding: collapsed ? "16px 0" : "16px 20px",
        borderTop: "1px solid rgba(51, 65, 85, 0.5)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        justifyContent: collapsed ? "center" : "flex-start",
      }}>
        <div className="status-dot status-dot-online" />
        {!collapsed && (
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>System Online</span>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: "absolute",
          top: 28,
          right: -12,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "#1e293b",
          border: "1px solid rgba(51, 65, 85, 0.5)",
          color: "#94a3b8",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          zIndex: 50,
          transition: "all 0.2s ease",
        }}
      >
        {collapsed ? "→" : "←"}
      </button>
    </aside>
  );
}
