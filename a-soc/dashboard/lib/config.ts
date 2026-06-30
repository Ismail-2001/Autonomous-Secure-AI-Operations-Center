export const dashboardConfig = {
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:9002",
  wsToken: process.env.NEXT_PUBLIC_WS_TOKEN || "dev-token",
  wsMaxReconnect: 10,
  wsBaseDelayMs: 1000,
  wsMaxDelayMs: 30000,

  maxEvents: 100,
  maxBackgroundEvents: 50,
  refreshIntervalMs: 5000,
  clockIntervalMs: 1000,

  enableThreatHunting: true,
  enableBlastRadius: true,
  enableTerminalFeed: true,
  enableAgentGrid: true,
  enableApprovalWorkflow: true,

  agentColors: {
    TelemetryAgent: "#3b82f6",
    DetectionAgent: "#f59e0b",
    SupervisorAgent: "#8b5cf6",
    ForensicsAgent: "#10b981",
    ResponseAgent: "#ef4444",
    ComplianceAgent: "#06b6d4",
    NotificationAgent: "#f97316",
  } as Record<string, string>,

  severityColors: {
    critical: "#dc2626",
    high: "#ea580c",
    medium: "#d97706",
    low: "#2563eb",
    info: "#6b7280",
  } as Record<string, string>,
} as const;
