/* ===================================================================
   A-SOC API Client — Enterprise-grade HTTP layer with auth + retry
   =================================================================== */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002";

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.status = status;
    this.detail = detail || message;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("asoc_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail || res.statusText, body.detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/* ===== Types ===== */
export interface HealthResponse {
  status: string;
  database: string;
  message_bus: string;
  vector_store: string;
}

export interface DashboardStats {
  active_threats: number;
  resolved_threats: number;
  mean_response_time: string;
  agents_online: number;
  total_agents: number;
  uptime: string;
  events_today: number;
  threat_level: string;
}

export interface AgentStatus {
  name: string;
  status: string;
  tools: string[];
  last_cycle: string;
  cycles_completed: number;
  errors: number;
  confidence?: number;
  current_task?: string;
  latency_ms?: number;
}

export interface Incident {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  status: "open" | "investigating" | "contained" | "resolved" | "closed";
  created_at: string;
  updated_at: string;
  source: string;
  affected_agents: string[];
  description: string;
}

export interface Asset {
  id: string;
  name: string;
  asset_type: "server" | "workstation" | "network_device" | "cloud_resource" | "iot" | "application";
  ip_address?: string;
  os?: string;
  status: "online" | "offline" | "maintenance" | "compromised";
  risk_level: "critical" | "high" | "medium" | "low" | "none";
  last_scan: string;
  vulnerabilities: number;
  owner?: string;
  tags: string[];
}

export interface ForensicsJob {
  id: string;
  case_id: string;
  title: string;
  status: "queued" | "running" | "completed" | "failed";
  job_type: string;
  target_evidence: string;
  created_at: string;
  completed_at?: string;
  findings: string[];
  artifacts: string[];
}

export interface ThreatIndicator {
  id: string;
  type: "ip" | "domain" | "hash" | "url" | "email";
  value: string;
  confidence: number;
  severity: "critical" | "high" | "medium" | "low";
  tlp: "white" | "green" | "amber" | "red";
  source: string;
  first_seen: string;
  last_seen: string;
  tags: string[];
  description: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  outcome: "success" | "failure";
  details: Record<string, unknown>;
  hmac: string;
}

export interface ComplianceReport {
  generated_at: string;
  controls: { id: string; name: string; status: "pass" | "fail" | "partial"; details: string }[];
  score: number;
  total_controls: number;
  passed: number;
  failed: number;
  partial: number;
}

export interface ThreatEvent {
  id: string;
  timestamp: string;
  source: string;
  event_type: string;
  severity: string;
  description: string;
  raw_data: Record<string, unknown>;
}

/* ===== API endpoints ===== */
export const endpoints = {
  health: () => api.get<HealthResponse>("/api/v1/health"),
  stats: () => api.get<DashboardStats>("/api/v1/dashboard/stats"),
  agents: () => api.get<{ agents: AgentStatus[] }>("/api/v1/agents"),
  incidents: (params?: Record<string, string>) => {
    const filtered = params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")) : {};
    const q = Object.keys(filtered).length ? "?" + new URLSearchParams(filtered).toString() : "";
    return api.get<{ incidents: Incident[] }>(`/api/v1/incidents${q}`);
  },
  assets: (params?: Record<string, string>) => {
    const filtered = params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")) : {};
    const q = Object.keys(filtered).length ? "?" + new URLSearchParams(filtered).toString() : "";
    return api.get<{ assets: Asset[] }>(`/api/v1/assets${q}`);
  },
  forensics: (params?: Record<string, string>) => {
    const filtered = params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")) : {};
    const q = Object.keys(filtered).length ? "?" + new URLSearchParams(filtered).toString() : "";
    return api.get<{ jobs: ForensicsJob[] }>(`/api/v1/forensics/jobs${q}`);
  },
  threatIntel: (params?: Record<string, string>) => {
    const filtered = params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")) : {};
    const q = Object.keys(filtered).length ? "?" + new URLSearchParams(filtered).toString() : "";
    return api.get<{ indicators: ThreatIndicator[] }>(`/api/v1/threat-intel${q}`);
  },
  audit: (params?: Record<string, string>) => {
    const filtered = params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")) : {};
    const q = Object.keys(filtered).length ? "?" + new URLSearchParams(filtered).toString() : "";
    return api.get<{ events: AuditEvent[] }>(`/api/v1/audit${q}`);
  },
  compliance: () => api.get<ComplianceReport>("/api/v1/compliance/report"),
  searchEvents: (q: string, filters?: Record<string, string>) => {
    const params = new URLSearchParams({ q });
    if (filters) Object.entries(filters).forEach(([k, v]) => params.set(k, v));
    return api.get<{ results: ThreatEvent[] }>(`/api/v1/events/search?${params.toString()}`);
  },
  auth: {
    token: () => api.post<{ access_token: string }>("/api/v1/auth/token", { user_id: "dashboard-ui", role: "analyst", client_id: "web" }),
  },
};
