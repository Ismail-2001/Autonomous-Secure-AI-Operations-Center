"use client";

import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface ShellProps {
  children: ReactNode;
  connectionState?: string;
  onSimulate?: () => void;
  title?: string;
  subtitle?: string;
}

export function Shell({ children, connectionState, onSimulate, title, subtitle }: ShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar connectionState={connectionState} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar connectionState={connectionState} onSimulate={onSimulate} title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto no-scrollbar" role="main">
          {children}
        </main>
      </div>
    </div>
  );
}
