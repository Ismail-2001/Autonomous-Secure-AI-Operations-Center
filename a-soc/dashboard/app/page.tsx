"use client";

import { AlertTriangle, CheckCircle, Clock, Cpu, Globe, Terminal, Activity } from "lucide-react";
import { useThreatFeed } from "../hooks/useThreatFeed";
import { BlastRadiusGraph } from "../components/BlastRadiusGraph";
import { StatCard } from "../components/StatCard";
import { TerminalFeed } from "../components/TerminalFeed";
import { AgentGrid } from "../components/AgentGrid";
import { Shell } from "../components/Shell";
import { ApprovalModal } from "../components/ApprovalModal";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:9002";
const WS_TOKEN = process.env.NEXT_PUBLIC_WS_TOKEN || "my-SOC-agent-2001";

export default function LiveMonitoringPage() {
  const {
    connectionState,
    events,
    backgroundEvents,
    approvalRequest,
    blastRadius,
    stats,
    startSimulation,
    approveAction,
    denyAction,
  } = useThreatFeed({ url: WS_URL, token: WS_TOKEN });

  return (
    <Shell
      connectionState={connectionState}
      onSimulate={startSimulation}
      title="Security Operations Center"
      subtitle="Real-time autonomous threat detection and response"
    >
      <div className="p-6 space-y-5">
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={AlertTriangle} label="Active Threats" value={String(stats.activeThreats)} subValue="+200%" color="rose" />
          <StatCard icon={CheckCircle} label="Neutralized" value={String(stats.resolved)} subValue="Today" color="emerald" />
          <StatCard icon={Clock} label="MTTR" value="1.2s" subValue="-0.4s" color="cyan" />
          <StatCard icon={Cpu} label="AI Agents" value={`${stats.agentsActive}/7`} subValue="Online" color="purple" />
        </div>

        {/* Central Visuals */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" style={{ height: "420px" }}>
          <div className="lg:col-span-8 glass-card relative overflow-hidden">
            <div className="absolute top-4 left-4 z-10">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-orange-400" />
                BLAST RADIUS
              </h3>
              <p className="text-slate-500 text-[10px] font-mono uppercase mt-0.5">D3.js force-directed analysis</p>
            </div>
            {blastRadius ? (
              <div className="w-full h-full p-4 pt-12">
                <BlastRadiusGraph data={blastRadius} width={700} height={380} />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center flex-col gap-3 opacity-30">
                <Globe className="w-20 h-20 text-cyan-500 animate-pulse" />
                <p className="font-mono text-cyan-500 text-xs tracking-widest">AWAITING TELEMETRY</p>
              </div>
            )}
          </div>

          <div className="lg:col-span-4 glass-card p-4 flex flex-col">
            <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-3">Agent Health</h3>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <AgentGrid running={connectionState === "OPEN"} />
            </div>
          </div>
        </div>

        {/* Terminal Feeds */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" style={{ height: "350px" }}>
          <TerminalFeed title="INCIDENT LOG" logs={events} color="red" icon={AlertTriangle} />
          <TerminalFeed title="SYSTEM TELEMETRY" logs={backgroundEvents} color="cyan" icon={Terminal} />
        </div>
      </div>

      {approvalRequest && (
        <ApprovalModal
          action={approvalRequest.action}
          target={approvalRequest.target}
          riskScore={approvalRequest.risk_score}
          onApprove={approveAction}
          onDeny={denyAction}
        />
      )}
    </Shell>
  );
}
