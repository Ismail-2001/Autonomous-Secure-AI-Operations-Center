import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(d: string | number | Date): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatTime(d: string | number | Date): string {
  return new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function timeAgo(d: string | number | Date): string {
  const seconds = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function severityBadge(sev: string): string {
  const map: Record<string, string> = {
    critical: "badge badge-critical",
    high: "badge badge-high",
    medium: "badge badge-medium",
    low: "badge badge-low",
    info: "badge badge-info",
  };
  return map[sev?.toLowerCase()] || "badge badge-neutral";
}

export function statusBadge(status: string): string {
  const map: Record<string, string> = {
    online: "badge badge-success",
    active: "badge badge-success",
    running: "badge badge-success",
    completed: "badge badge-success",
    healthy: "badge badge-success",
    degraded: "badge badge-warning",
    warning: "badge badge-warning",
    queued: "badge badge-info",
    pending: "badge badge-info",
    offline: "badge badge-neutral",
    failed: "badge badge-critical",
    error: "badge badge-critical",
    critical: "badge badge-critical",
  };
  return map[status?.toLowerCase()] || "badge badge-neutral";
}

export function severityColor(sev: string): string {
  const map: Record<string, string> = {
    critical: "#ef4444",
    high: "#f97316",
    medium: "#eab308",
    low: "#22c55e",
    info: "#3b82f6",
  };
  return map[sev?.toLowerCase()] || "#64748b";
}

export function agentColor(agent: string): string {
  const map: Record<string, string> = {
    TelemetryAgent: "#3b82f6",
    DetectionAgent: "#f59e0b",
    SupervisorAgent: "#8b5cf6",
    ForensicsAgent: "#22c55e",
    ResponseAgent: "#ef4444",
    ComplianceAgent: "#06b6d4",
    NotificationAgent: "#f97316",
  };
  return map[agent] || "#64748b";
}

export function truncate(str: string, len: number): string {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "…" : str;
}

export function riskColor(score: number): string {
  if (score >= 80) return "#ef4444";
  if (score >= 60) return "#f97316";
  if (score >= 40) return "#eab308";
  if (score >= 20) return "#3b82f6";
  return "#22c55e";
}

export function complianceColor(score: number): string {
  if (score >= 90) return "#22c55e";
  if (score >= 70) return "#eab308";
  if (score >= 50) return "#f97316";
  return "#ef4444";
}

export function generateId(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
