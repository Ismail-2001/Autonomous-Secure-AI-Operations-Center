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

async function request<T>(url: string, options: RequestInit & { _isRetry?: boolean } = {}): Promise<T> {
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
      if (res.status === 401 && !options._isRetry && typeof window !== "undefined") {
        const refreshToken = localStorage.getItem("asoc_refresh_token");
        if (refreshToken) {
          try {
            const refreshRes = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refresh_token: refreshToken }),
            });
            if (refreshRes.ok) {
              const data = await refreshRes.json();
              if (data.access_token) {
                cachedToken = data.access_token;
                localStorage.setItem("asoc_token", data.access_token);
                if (data.refresh_token) {
                  localStorage.setItem("asoc_refresh_token", data.refresh_token);
                }
                return request<T>(url, { ...options, _isRetry: true });
              }
            }
          } catch {
            // Refresh failed, continue to throw
          }
        }
      }
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

export interface WarGameStepResult {
  step_number: number;
  stage_name: string;
  technique_id: string;
  status: string;
  elapsed_ms: number;
  details?: Record<string, any>;
}

export interface WarGameReport {
  incident_id: string;
  scenario_name: string;
  threat_actor: string;
  execution_mode: "SHADOW" | "ACTIVE_ENFORCEMENT" | string;
  started_at: string;
  completed_at: string;
  total_duration_ms: number;
  mttd_ms: number;
  mttr_ms: number;
  mitre_tactics_identified: string[];
  threat_intel_matches: string[];
  containment_action_taken: string;
  containment_status: string;
  compliance_manifest_sha256: string;
  steps: WarGameStepResult[];
}

export const endpoints = {
  health: () => `${BASE_URL}/api/v1/health`,
  stats: () => `${BASE_URL}/api/v1/dashboard/stats`,
  agents: () => `${BASE_URL}/api/v1/agents/status`,
  incidents: () => `${BASE_URL}/api/v1/incidents`,
  createIncident: () => `${BASE_URL}/api/v1/incidents`,
  assets: () => `${BASE_URL}/api/v1/assets`,
  forensics: () => `${BASE_URL}/api/v1/forensics/jobs`,
  threatIntel: () => `${BASE_URL}/api/v1/threat-intel/indicators`,
  audit: () => `${BASE_URL}/api/v1/audit/entries`,
  compliance: () => `${BASE_URL}/api/v1/compliance/report`,
  huntingEvents: () => `${BASE_URL}/api/v1/hunting/events`,
  searchEvents: () => `${BASE_URL}/api/v1/hunting/events`,
  auth: {
    login: () => `${BASE_URL}/api/v1/auth/login`,
    token: () => `${BASE_URL}/api/v1/auth/token`,
    refresh: () => `${BASE_URL}/api/v1/auth/refresh`,
    logout: () => `${BASE_URL}/api/v1/auth/logout`,
    wsTicket: () => `${BASE_URL}/api/v1/auth/ws-ticket`,
    me: () => `${BASE_URL}/api/v1/auth/me`,
  },
  jobs: {
    list: () => `${BASE_URL}/api/v1/jobs`,
    get: (id: string) => `${BASE_URL}/api/v1/jobs/${id}`,
    enqueue: () => `${BASE_URL}/api/v1/jobs/enqueue`,
    cancel: (id: string) => `${BASE_URL}/api/v1/jobs/${id}/cancel`,
  },
  triage: {
    update: (id: string) => `${BASE_URL}/api/v1/incidents/${id}/triage`,
    addAction: (id: string) => `${BASE_URL}/api/v1/incidents/${id}/actions`,
    getActions: (id: string) => `${BASE_URL}/api/v1/incidents/${id}/actions`,
  },
  simulation: {
    warGame: () => `${BASE_URL}/api/v1/simulation/war-game`,
    scenarios: () => `${BASE_URL}/api/v1/simulation/scenarios`,
  },
  integrations: {
    splunkHec: () => `${BASE_URL}/api/v1/integrations/splunk/hec`,
    sentinelWebhook: () => `${BASE_URL}/api/v1/integrations/sentinel/webhook`,
    crowdstrikeWebhook: () => `${BASE_URL}/api/v1/integrations/crowdstrike/webhook`,
    genericWebhook: () => `${BASE_URL}/api/v1/integrations/generic/webhook`,
  },
};
