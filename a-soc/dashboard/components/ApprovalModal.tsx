"use client";

import { AlertTriangle, ChevronRight } from "lucide-react";

interface ApprovalModalProps {
  action: string;
  target: string;
  riskScore: number;
  onApprove: () => void;
  onDeny: () => void;
}

export function ApprovalModal({ action, target, riskScore, onApprove, onDeny }: ApprovalModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg cyber-card border-red-500/50 shadow-[0_0_50px_-10px_rgba(239,68,68,0.5)]">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 to-orange-600 animate-scan" />
        <div className="p-8">
          <div className="flex items-start gap-6">
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 animate-pulse">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Authorization Required</h2>
              <p className="text-red-400 font-mono text-xs uppercase tracking-wider mt-1">Severity Level: CRITICAL</p>
              <p className="text-slate-400 mt-4 text-sm leading-relaxed">
                The autonomous supervisor has intercepted a high-risk action proposed by the Response Agent.
                Manual authorization is required to proceed.
              </p>
            </div>
          </div>
          <div className="mt-8 space-y-3 bg-red-950/20 p-4 rounded-lg border border-red-500/20 font-mono text-sm">
            <div className="flex justify-between border-b border-red-500/10 pb-2">
              <span className="text-slate-500">PROPOSED ACTION</span>
              <span className="text-white font-bold">{action}</span>
            </div>
            <div className="flex justify-between border-b border-red-500/10 pb-2">
              <span className="text-slate-500">TARGET RESOURCE</span>
              <span className="text-white">{target}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">RISK SCORE</span>
              <span className="text-red-400 font-bold">{(riskScore * 100).toFixed(1)}%</span>
            </div>
          </div>
          <div className="mt-8 flex gap-4">
            <button onClick={onDeny} className="flex-1 py-3 px-4 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-all font-bold uppercase tracking-wider text-sm">
              Deny Action
            </button>
            <button onClick={onApprove} className="flex-1 py-3 px-4 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-wider text-sm shadow-lg shadow-red-500/20 flex justify-center items-center gap-2 group">
              <span>Authorize</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
