export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002";
const REQUEST_TIMEOUT_MS = 15000;
let cachedToken: string | null = null;

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  if (cachedToken === null && typeof window !== "undefined") {
    cachedToken = localStorage.getItem("asoc_token");
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (cachedToken) headers["Authorization"] = `Bearer ${cachedToken}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      throw new ApiError(`${res.status}: ${text}`, res.status);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
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
  incident_number?: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
  agent?: string;
  tags?: string[];
  risk_score?: number;
  triage_status?: string;
  assigned_to?: string;
  notes?: string;
  triaged_by?: string;
  triaged_at?: string;
  response_actions?: ResponseAction[];
}

export interface ResponseAction {
  id: string;
  type: string;
  description: string;
  target?: string;
  performed_by: string;
  timestamp: string;
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
  health: () => `${BASE_URL}/api/v1/health`,
  stats: () => `${BASE_URL}/api/v1/dashboard/stats`,
  agents: () => `${BASE_URL}/api/v1/agents/status`,
  incidents: () => `${BASE_URL}/api/v1/incidents`,
  assets: () => `${BASE_URL}/api/v1/assets`,
  forensics: () => `${BASE_URL}/api/v1/forensics/jobs`,
  threatIntel: () => `${BASE_URL}/api/v1/threat-intel/indicators`,
  audit: () => `${BASE_URL}/api/v1/audit/events`,
  compliance: () => `${BASE_URL}/api/v1/compliance/report`,
  huntingEvents: () => `${BASE_URL}/api/v1/hunting/events`,
  searchEvents: () => `${BASE_URL}/api/v1/events/search`,
  auth: {
    token: () => `${BASE_URL}/api/v1/auth/token`,
    me: () => `${BASE_URL}/api/v1/auth/me`,
  },
  triage: {
    update: (id: string) => `${BASE_URL}/api/v1/incidents/${id}/triage`,
    addAction: (id: string) => `${BASE_URL}/api/v1/incidents/${id}/actions`,
    getActions: (id: string) => `${BASE_URL}/api/v1/incidents/${id}/actions`,
  },
};
