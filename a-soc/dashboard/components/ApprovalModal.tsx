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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-title"
    >
      <div className="relative w-full max-w-lg glass-card border-red-500/30 animate-slide-up">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-600 to-orange-600" />

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 shrink-0">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="min-w-0">
              <h2 id="approval-title" className="text-xl font-bold text-white">Authorization Required</h2>
              <p className="text-red-400 font-mono text-xs uppercase tracking-wider mt-1">Severity: CRITICAL</p>
              <p className="text-slate-400 mt-3 text-sm leading-relaxed">
                The Supervisor Agent has intercepted a high-risk action. Manual authorization is required.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-2.5 bg-red-950/20 p-4 rounded-lg border border-red-500/10 mono text-sm">
            <div className="flex justify-between border-b border-red-500/10 pb-2">
              <span className="text-slate-500">ACTION</span>
              <span className="text-white font-bold">{action}</span>
            </div>
            <div className="flex justify-between border-b border-red-500/10 pb-2">
              <span className="text-slate-500">TARGET</span>
              <span className="text-white">{target}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">RISK</span>
              <span className="text-red-400 font-bold">{(riskScore * 100).toFixed(1)}%</span>
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button onClick={onDeny} className="btn-ghost flex-1 justify-center text-xs">
              Deny
            </button>
            <button onClick={onApprove} className="btn-danger flex-1 justify-center text-xs">
              <span>Authorize</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
