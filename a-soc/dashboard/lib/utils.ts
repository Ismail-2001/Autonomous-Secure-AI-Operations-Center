export function cn(...inputs: (string | boolean | undefined | null)[]): string {
  return inputs.filter(Boolean).join(" ");
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function severityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case "critical": return "text-red-500 bg-red-500/10 border-red-500/20";
    case "high": return "text-orange-500 bg-orange-500/10 border-orange-500/20";
    case "medium": return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
    case "low": return "text-cyan-500 bg-cyan-500/10 border-cyan-500/20";
    default: return "text-slate-500 bg-slate-500/10 border-slate-500/20";
  }
}

export function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "online":
    case "resolved":
    case "completed":
    case "pass":
      return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    case "offline":
    case "failed":
    case "fail":
      return "text-red-500 bg-red-500/10 border-red-500/20";
    case "compromised":
    case "critical":
      return "text-red-500 bg-red-500/10 border-red-500/20 animate-pulse";
    case "maintenance":
    case "partial":
      return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
    case "running":
    case "investigating":
    case "open":
      return "text-cyan-500 bg-cyan-500/10 border-cyan-500/20";
    case "queued":
      return "text-slate-500 bg-slate-500/10 border-slate-500/20";
    default:
      return "text-slate-500 bg-slate-500/10 border-slate-500/20";
  }
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + "..." : str;
}
