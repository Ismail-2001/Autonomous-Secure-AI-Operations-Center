/* ===================================================================
   A-SOC Utility Functions — Formatting, colors, helpers
   =================================================================== */

export function cn(...inputs: (string | boolean | undefined | null)[]): string {
  return inputs.filter(Boolean).join(" ");
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function severityBadge(severity: string): string {
  const s = severity.toLowerCase();
  if (s === "critical") return "badge badge-critical";
  if (s === "high") return "badge badge-high";
  if (s === "medium") return "badge badge-medium";
  if (s === "low") return "badge badge-low";
  return "badge badge-info";
}

export function statusBadge(status: string): string {
  const s = status.toLowerCase();
  if (["online", "resolved", "completed", "pass", "success"].includes(s)) return "badge badge-success";
  if (["offline", "failed", "fail", "compromised"].includes(s)) return "badge badge-critical";
  if (["maintenance", "partial"].includes(s)) return "badge badge-warning";
  if (["running", "investigating", "open", "queued"].includes(s)) return "badge badge-info";
  return "badge badge-neutral";
}

export function severityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case "critical": return "#ef4444";
    case "high": return "#f97316";
    case "medium": return "#eab308";
    case "low": return "#22c55e";
    default: return "#3b82f6";
  }
}

export function statusDotClass(status: string): string {
  switch (status.toLowerCase()) {
    case "online": case "resolved": case "completed": case "pass": return "status-dot status-dot-online";
    case "offline": case "failed": case "fail": case "compromised": return "status-dot status-dot-offline";
    case "running": case "investigating": case "open": return "status-dot status-dot-warning";
    default: return "status-dot status-dot-info";
  }
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + "..." : str;
}

export function agentColor(name: string): string {
  const colors: Record<string, string> = {
    TelemetryAgent: "#3b82f6",
    DetectionAgent: "#f59e0b",
    SupervisorAgent: "#8b5cf6",
    ForensicsAgent: "#22c55e",
    ResponseAgent: "#ef4444",
    ComplianceAgent: "#06b6d4",
    NotificationAgent: "#f97316",
  };
  return colors[name] || "#64748b";
}

export function agentIcon(name: string): string {
  const icons: Record<string, string> = {
    TelemetryAgent: "📡",
    DetectionAgent: "🔍",
    SupervisorAgent: "🛡️",
    ForensicsAgent: "🔬",
    ResponseAgent: "⚡",
    ComplianceAgent: "📋",
    NotificationAgent: "🔔",
  };
  return icons[name] || "🤖";
}
