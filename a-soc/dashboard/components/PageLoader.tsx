"use client";

import { Shield } from "lucide-react";

export function PageLoader({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center flex-col gap-4">
      <Shield className="w-12 h-12 text-cyan-500 animate-pulse" />
      <p className="font-mono text-cyan-500 tracking-widest text-sm animate-pulse">{text}</p>
    </div>
  );
}
