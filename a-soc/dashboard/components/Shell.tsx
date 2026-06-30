"use client";

import { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

export function Shell({
  children,
  connectionState,
  onSimulate,
}: {
  children: ReactNode;
  connectionState?: string;
  onSimulate?: () => void;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar connectionState={connectionState} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar connectionState={connectionState} onSimulate={onSimulate} />
        <main className="flex-1 overflow-y-auto no-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
