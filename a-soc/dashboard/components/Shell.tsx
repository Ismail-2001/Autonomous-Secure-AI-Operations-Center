"use client";

import React from "react";
import { motion } from "framer-motion";
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
        <main style={{ flex: 1, padding: 24, overflow: "auto", position: "relative" }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>
      <div className="cyber-grid" />
    </div>
  );
}
