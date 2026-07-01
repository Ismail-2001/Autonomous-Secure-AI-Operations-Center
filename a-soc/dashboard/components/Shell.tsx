"use client";

import React from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

interface ShellProps {
  children: React.ReactNode;
  onSimulate?: () => void;
  simulating?: boolean;
}

export default function Shell({ children, onSimulate, simulating }: ShellProps) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#020617" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar onSimulate={onSimulate} simulating={simulating} />
        <main style={{ flex: 1, padding: 24, overflow: "auto" }}>
          {children}
        </main>
      </div>
      <div className="cyber-grid" />
    </div>
  );
}
