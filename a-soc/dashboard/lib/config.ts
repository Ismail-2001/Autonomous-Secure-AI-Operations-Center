export const config = {
  ws: {
    url: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:9002/ws/threat-feed",
    token: process.env.NEXT_PUBLIC_WS_TOKEN || "my-SOC-agent-2001",
    maxReconnect: 10,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
  },
  api: {
    url: process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002",
  },
  display: {
    maxEvents: 100,
    maxBackgroundEvents: 50,
    refreshIntervalMs: 5000,
  },
  agents: [
    { name: "TelemetryAgent", role: "Data Collection", icon: "📡", color: "#3b82f6" },
    { name: "DetectionAgent", role: "Threat Detection", icon: "🔍", color: "#f59e0b" },
    { name: "SupervisorAgent", role: "Quality Gate", icon: "👁️", color: "#8b5cf6" },
    { name: "ForensicsAgent", role: "Investigation", icon: "🔬", color: "#22c55e" },
    { name: "ResponseAgent", role: "Containment", icon: "🛡️", color: "#ef4444" },
    { name: "ComplianceAgent", role: "Audit & Compliance", icon: "📋", color: "#06b6d4" },
    { name: "NotificationAgent", role: "Alerting", icon: "🔔", color: "#f97316" },
  ] as const,
};
