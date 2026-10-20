"use client";

import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import StatusBar from "./StatusBar";
import AuthGuard from "./AuthGuard";

interface ShellProps {
  children: React.ReactNode;
  onSimulate?: () => void;
  simulating?: boolean;
  connectionState?: "CLOSED" | "CONNECTING" | "OPEN" | "RECONNECTING";
}

export default function Shell({ children, onSimulate, simulating, connectionState }: ShellProps) {
  return (
    <AuthGuard>
      <div style={{ display: "flex", minHeight: "100vh", background: "#0a0e1a" }}>
        <Sidebar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, marginLeft: 0 }}>
          <TopBar onSimulate={onSimulate} simulating={simulating} />
          <main style={{ flex: 1, padding: "20px 24px 48px", overflow: "auto" }}>
            {children}
          </main>
        </div>
        <StatusBar connectionState={connectionState} />
      </div>
    </AuthGuard>
  );
}
