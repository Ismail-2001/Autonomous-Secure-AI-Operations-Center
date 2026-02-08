"use client";

import { useState, useEffect, useRef } from "react";
import { Shield, Activity, AlertTriangle, CheckCircle, Clock, Eye, Zap, Play } from "lucide-react";
import { AttackGraph } from "../components/AttackGraph";

interface ThreatEvent {
  id: string;
  timestamp: string;
  severity: "low" | "medium" | "high" | "critical";
  type: string;
  source: string;
  status: "detected" | "analyzing" | "remediating" | "resolved";
  riskScore: number;
}

interface AgentUpdate {
  id?: string;
  timestamp: string;
  agent: string;
  status: string;
  message: string;
  severity: string;
  is_background?: boolean;
}

interface ApprovalRequest {
  type: string;
  action: string;
  target: string;
  risk_score: number;
}

interface GraphData {
  nodes: any[];
  edges: any[];
}

export default function Dashboard() {
  const [logs, setLogs] = useState<AgentUpdate[]>([]);
  const [backgroundLogs, setBackgroundLogs] = useState<AgentUpdate[]>([]);
  const [running, setRunning] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);
  const [blastRadius, setBlastRadius] = useState<GraphData | null>(null);
  const [activeTab, setActiveTab] = useState<'incidents' | 'telemetry'>('incidents');

  // Stats
  const [stats, setStats] = useState({
    activeThreats: 0,
    resolved: 0,
    avgResponseTime: "0.0s",
    agentsActive: 0,
  });

  useEffect(() => {
    // Connect to Python backend via WebSocket on 9003
    const socket = new WebSocket("ws://localhost:9003/ws/threat-feed");

    socket.onopen = () => {
      console.log("Connected to A-SOC Python Backend");
      setStats(prev => ({ ...prev, agentsActive: 6 })); // Assume all 6 agents active
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Handle Approval Request
      if (data.type === "APPROVAL_REQUIRED") {
        setApprovalRequest(data);
        return;
      }

      if (data.type === "BLAST_RADIUS_UPDATE") {
        setBlastRadius(data.graph);
        return;
      }

      if (data.agent) {
        if (data.is_background) {
          setBackgroundLogs(prev => [data, ...prev].slice(0, 50));
        } else {
          setLogs((prev) => [data, ...prev]);
          setActiveTab('incidents'); // Switch to incidents tab when real action happens
        }

        // Update stats based on incoming agent activity (only for non-background)
        if (!data.is_background) {
          if (data.severity === "high" || data.severity === "critical") {
            setStats(prev => ({ ...prev, activeThreats: prev.activeThreats + 1 }));
          }
          if (data.status === "success" || data.status === "logged") {
            setStats(prev => ({ ...prev, resolved: prev.resolved + 1, activeThreats: Math.max(0, prev.activeThreats - 1) }));
          }
        }
      }
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, []);

  const runSimulation = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      setRunning(true);
      setLogs([]); // Clear previous incident logs
      setBlastRadius(null);
      ws.send("START_SIMULATION"); // Trigger Python backend
    }
  };

  const approveAction = () => {
    if (ws) {
      ws.send("APPROVE_ACTION");
      setApprovalRequest(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/20 text-red-400 border-red-500/50 glow-red animate-pulse";
      case "high":
        return "bg-orange-500/20 text-orange-400 border-orange-500/50";
      case "medium":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50 glow-yellow";
      case "low":
        return "bg-blue-500/20 text-blue-400 border-blue-500/50";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/50";
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 font-mono text-slate-200">
      {/* Header */}
      <header className="mb-8 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/30 glow">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              A-SOC Dashboard
            </h1>
            <p className="text-slate-400 text-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Connected: Python Ecosystem v0.1.0
            </p>
          </div>
        </div>

        <button
          onClick={runSimulation}
          disabled={running}
          className={`px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-all ${running
            ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
            : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 border border-blue-400"
            }`}
        >
          {running ? <Activity className="animate-spin" /> : <Play />}
          {running ? "Monitoring Active..." : "Start Simulation"}
        </button>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={<AlertTriangle className="w-6 h-6" />}
          label="Active Threats"
          value={stats.activeThreats.toString()}
          color="red"
        />
        <StatCard
          icon={<CheckCircle className="w-6 h-6" />}
          label="Resolved Today"
          value={stats.resolved.toString()}
          color="green"
        />
        <StatCard
          icon={<Clock className="w-6 h-6" />}
          label="Avg Response Time"
          value="1.2s" // Hardcoded for demo speed
          color="blue"
        />
        <StatCard
          icon={<Zap className="w-6 h-6" />}
          label="Agents Active"
          value={`${stats.agentsActive}/6`}
          color="cyan"
        />
      </div>

      {/* Incident Visualization (Premium Feature) */}
      {blastRadius && (
        <div className="mb-8 animate-fade-in-up">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              <Activity className="w-5 h-5 text-orange-500" />
              Incident Blast Radius
            </h2>
            <span className="text-xs text-orange-400 font-mono border border-orange-500/30 px-2 py-1 rounded bg-orange-500/10">
              CRITICAL ANALYSIS
            </span>
          </div>
          <div className="h-[350px] w-full bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden relative shadow-2xl shadow-orange-500/5">
            <AttackGraph data={blastRadius} />
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Live Threat Feed & Tabs */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('incidents')}
                className={`text-xl font-semibold flex items-center gap-2 transition-all pb-2 border-b-2 ${activeTab === 'incidents' ? 'text-blue-400 border-blue-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
              >
                <AlertTriangle className="w-5 h-5" />
                Incident Insights
              </button>
              <button
                onClick={() => setActiveTab('telemetry')}
                className={`text-xl font-semibold flex items-center gap-2 transition-all pb-2 border-b-2 ${activeTab === 'telemetry' ? 'text-cyan-400 border-cyan-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
              >
                <Activity className="w-5 h-5" />
                System Telemetry
              </button>
            </div>
            <span className="text-xs text-slate-500 animate-pulse">
              {activeTab === 'incidents' ? 'Monitoring Critical Assets...' : 'Analyzing Benign Activity...'}
            </span>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 min-h-[500px] max-h-[600px] overflow-y-auto custom-scrollbar">
            {activeTab === 'incidents' ? (
              logs.length === 0 ? (
                <div className="text-center text-slate-500 mt-20">
                  <Shield className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p>Cyber-fortress Secure. Waiting for threat events...</p>
                </div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={`mb-4 p-4 rounded-lg border-l-4 bg-slate-800/40 animate-fade-in ${log.severity === 'critical' ? 'border-red-500' :
                    log.severity === 'high' ? 'border-orange-500' :
                      log.severity === 'medium' ? 'border-yellow-500' :
                        'border-blue-500'
                    }`}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm bg-slate-900 px-2 py-1 rounded text-slate-300">
                          {log.agent} Agent
                        </span>
                        <span className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <span className={`text-xs uppercase font-bold ${log.severity === 'critical' ? 'text-red-400' :
                        log.severity === 'high' ? 'text-orange-400' :
                          log.severity === 'medium' ? 'text-yellow-400' :
                            'text-blue-400'
                        }`}>{log.status}</span>
                    </div>
                    <p className="mt-2 text-slate-200 text-lg">{log.message}</p>
                  </div>
                ))
              )
            ) : (
              backgroundLogs.map((log, i) => (
                <div key={i} className="mb-2 p-3 bg-slate-900/30 rounded border border-slate-800 flex items-center gap-3 animate-fade-in-right">
                  <span className="text-[10px] text-cyan-600 font-mono w-20 shrink-0">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>
                  <span className="text-slate-400 text-sm font-mono truncate">{log.message}</span>
                  <div className="ml-auto flex gap-1">
                    <div className="w-1 h-1 bg-cyan-900/50 rounded-full"></div>
                    <div className="w-1 h-1 bg-cyan-900/50 rounded-full"></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Status & Intel Side panel */}
        <div className="space-y-6">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Agent Core Status
            </h2>

            <div className="space-y-4">
              <AgentStatus name="Telemetry" status={running ? "ingesting" : "standby"} load={running ? 85 : 12} />
              <AgentStatus name="Detection" status={running ? "analyzing" : "standby"} load={running ? 92 : 5} />
              <AgentStatus name="Supervisor" status={running ? "governing" : "standby"} load={running ? 45 : 2} />
              <AgentStatus name="Forensics" status={running ? "investigating" : "standby"} load={running ? 78 : 0} />
              <AgentStatus name="Response" status={running ? "executing" : "standby"} load={running ? 65 : 0} />
              <AgentStatus name="Compliance" status={running ? "auditing" : "standby"} load={running ? 98 : 0} />
            </div>
          </div>

          {/* Strategic Intelligence Card */}
          <div className="bg-gradient-to-br from-slate-900/80 to-blue-900/20 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-300">
              <Zap className="w-4 h-4" />
              Strategic Intel
            </h3>
            <div className="space-y-3">
              <div className="text-xs p-3 rounded bg-slate-950/50 border border-slate-800">
                <p className="text-blue-400 font-bold mb-1">CVE-2024-GLOBAL</p>
                <p className="text-slate-400">Emerging Zero-Day reported in IAM policy evaluation loops. Monitor closely.</p>
              </div>
              <div className="text-xs p-3 rounded bg-slate-950/50 border border-slate-800">
                <p className="text-orange-400 font-bold mb-1">THREAT ACTOR: AP-9</p>
                <p className="text-slate-400">Increase in brute-force patterns from IP range 192.168.1.0/24.</p>
              </div>
            </div>
            <button className="w-full mt-4 py-2 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30 transition-all">
              FETCH LATEST INTEL
            </button>
          </div>
        </div>
      </div>

      {/* Approval Modal */}
      {approvalRequest && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-slate-900 border border-red-500/50 rounded-2xl p-8 max-w-md w-full shadow-2xl shadow-red-500/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-600 animate-pulse"></div>

            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 bg-red-500/10 rounded-full border border-red-500/30 animate-pulse-glow">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Action Approval Required</h3>
                <p className="text-red-400 text-sm font-semibold">High Risk Activity Detected</p>
              </div>
            </div>

            <div className="space-y-4 mb-8 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">Action Type</span>
                <span className="text-white font-mono font-bold">{approvalRequest.action}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Target Resource</span>
                <span className="text-white font-mono">{approvalRequest.target}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Risk Score</span>
                <span className="text-red-400 font-bold">{(approvalRequest.risk_score * 100).toFixed(0)}/100</span>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setApprovalRequest(null)}
                className="flex-1 py-3 px-4 rounded-lg bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 transition-all font-mono"
              >
                DENY
              </button>
              <button
                onClick={approveAction}
                className="flex-1 py-3 px-4 rounded-lg bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold hover:from-red-500 hover:to-orange-500 transition-all shadow-lg shadow-red-500/25 flex items-center justify-center gap-2 font-mono"
              >
                <CheckCircle className="w-5 h-5" />
                AUTHORIZE
              </button>
            </div>

            <p className="text-center text-xs text-slate-500 mt-6 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" />
              Logged to Immutable Audit Trail
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  const colorClasses = {
    red: "bg-red-500/10 border-red-500/30 text-red-400",
    green: "bg-green-500/10 border-green-500/30 text-green-400",
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    cyan: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400",
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 transition-all hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/10">
      <div className={`inline-flex p-3 rounded-xl border mb-4 ${colorClasses[color as keyof typeof colorClasses]}`}>
        {icon}
      </div>
      <div className="text-3xl font-bold mb-1 tracking-tight">{value}</div>
      <div className="text-sm text-slate-400 uppercase tracking-wider font-semibold">{label}</div>
    </div>
  );
}

function AgentStatus({ name, status, load }: { name: string; status: string; load: number }) {
  return (
    <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${load > 50 ? 'bg-green-400 animate-pulse-glow' : 'bg-slate-500'}`}></div>
          <span className="font-medium text-slate-200">{name}</span>
        </div>
        <span className="text-xs text-cyan-400 uppercase font-mono">{status}</span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-500 font-mono">
          <span>LOAD</span>
          <span>{load}%</span>
        </div>
        <div className="w-full bg-slate-700/30 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${load > 80 ? 'bg-gradient-to-r from-orange-500 to-red-500' :
              load > 40 ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
                'bg-slate-600'
              }`}
            style={{ width: `${load}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
