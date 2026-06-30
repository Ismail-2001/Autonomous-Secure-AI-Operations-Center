"use client";

import { useState } from "react";
import {
  AlertTriangle, CheckCircle, Clock, Cpu, Globe, Terminal, Activity,
} from "lucide-react";

import { useThreatFeed } from "../hooks/useThreatFeed";
import { BlastRadiusGraph } from "../components/BlastRadiusGraph";
import { StatCard } from "../components/StatCard";
import { TerminalFeed } from "../components/TerminalFeed";
import { AgentGrid } from "../components/AgentGrid";
import { Shell } from "../components/Shell";
import { ApprovalModal } from "../components/ApprovalModal";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:9002";
const WS_TOKEN = process.env.NEXT_PUBLIC_WS_TOKEN || "dev-token";

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
  } = useThreatFeed({
    url: WS_URL,
    token: WS_TOKEN,
    maxReconnectAttempts: 10,
    baseReconnectDelayMs: 1000,
    maxReconnectDelayMs: 30000,
  });

  const [activeTab, setActiveTab] = useState<"incidents" | "telemetry">("incidents");

  const handleStartSimulation = () => {
    startSimulation();
    setActiveTab("incidents");
  };

  return (
    <Shell connectionState={connectionState} onSimulate={handleStartSimulation}>
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard icon={AlertTriangle} label="Active Threats" value={stats.activeThreats.toString()} subValue="+200%" color="red" />
          <StatCard icon={CheckCircle} label="Threats Neutralized" value={stats.resolved.toString()} subValue="Today" color="emerald" />
          <StatCard icon={Clock} label="Mean Time to Respond" value="1.2s" subValue="-0.4s" color="cyan" />
          <StatCard icon={Cpu} label="AI Agents Online" value={`${stats.agentsActive}/6`} subValue="Optimal" color="purple" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[450px]">
          <div className="lg:col-span-8 cyber-card">
            <div className="absolute top-4 left-4 z-10">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Activity className="w-4 h-4 text-orange-400" />
                BLAST RADIUS VISUALIZATION
              </h3>
              <p className="text-slate-500 text-xs font-mono uppercase mt-1">
                Real-time vector analysis &middot; D3.js force-directed
              </p>
            </div>
            {blastRadius ? (
              <div className="w-full h-full p-4">
                <BlastRadiusGraph data={blastRadius} width={560} height={400} />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center flex-col gap-4 opacity-30">
                <Globe className="w-24 h-24 text-cyan-500 animate-pulse" />
                <p className="font-mono text-cyan-500 tracking-widest">AWAITING TELEMETRY...</p>
              </div>
            )}
          </div>
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="flex-1 cyber-card p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-bold text-sm uppercase tracking-wider">Agent Health</h3>
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-cyan-500" />
                  <div className="w-2 h-2 rounded-full bg-slate-700" />
                </div>
              </div>
              <AgentGrid running={connectionState === "OPEN"} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
          <TerminalFeed title="INCIDENT LOG STREAM" logs={events} color="red" icon={AlertTriangle} />
          <TerminalFeed title="SYSTEM TELEMETRY (BACKGROUND)" logs={backgroundEvents} color="cyan" icon={Terminal} />
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
