export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("asoc_token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new ApiError(`${res.status}: ${text}`, res.status);
  }
  return res.json();
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};

export interface HealthResponse {
  status: string;
  version: string;
  uptime: number;
  agents: Record<string, string>;
}

export interface DashboardStats {
  active_threats: number;
  threats_neutralized: number;
  mttr_minutes: number;
  ai_agents_active: number;
  total_assets: number;
  compliance_score: number;
  events_today: number;
  critical_alerts: number;
}

export interface AgentStatus {
  name: string;
  status: string;
  role: string;
  confidence: number;
  last_active: string;
  task_count: number;
  error_count: number;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
  agent?: string;
  tags?: string[];
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  ip_address: string;
  os?: string;
  status: string;
  risk_score: number;
  vulnerabilities: number;
  owner?: string;
  last_scan?: string;
  location?: string;
}

export interface ForensicsJob {
  id: string;
  title: string;
  status: string;
  type: string;
  created_at: string;
  findings: string[];
  artifacts: string[];
  agent?: string;
}

export interface ThreatIndicator {
  id: string;
  type: string;
  value: string;
  severity: string;
  confidence: number;
  source: string;
  tlp: string;
  first_seen: string;
  last_seen: string;
  tags: string[];
  related_campaigns?: string[];
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  details: string;
  hmac: string;
  verified: boolean;
}

export interface ComplianceReport {
  score: number;
  controls: { name: string; status: string; description: string }[];
  last_audit: string;
  trend: string;
}

export interface ThreatEvent {
  id: string;
  timestamp: string;
  severity: string;
  source: string;
  type: string;
  description: string;
  agent?: string;
  confidence?: number;
  mitigated?: boolean;
}

export const endpoints = {
  health: () => `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002"}/api/v1/health`,
  stats: () => `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002"}/api/v1/dashboard/stats`,
  agents: () => `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002"}/api/v1/agents/status`,
  incidents: () => `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002"}/api/v1/incidents`,
  assets: () => `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002"}/api/v1/assets`,
  forensics: () => `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002"}/api/v1/forensics/jobs`,
  threatIntel: () => `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002"}/api/v1/threat-intel/indicators`,
  audit: () => `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002"}/api/v1/audit/events`,
  compliance: () => `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002"}/api/v1/compliance/report`,
  searchEvents: () => `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002"}/api/v1/events/search`,
  auth: {
    token: () => `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002"}/api/v1/auth/token`,
  },
};
