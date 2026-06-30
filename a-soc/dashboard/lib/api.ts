const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002";

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${this.baseUrl}${path}`, { ...options, headers });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new ApiError(res.status, error.detail || "Request failed");
    }

    return res.json();
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }

  async healthCheck() {
    return this.get<{ status: string; database: string; message_bus: string; vector_store: string }>("/api/v1/health");
  }

  async getAgents() {
    return this.get<{ agents: AgentStatus[] }>("/api/v1/agents");
  }

  async getIncidents(params?: { status?: string; severity?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.severity) query.set("severity", params.severity);
    if (params?.limit) query.set("limit", params.limit.toString());
    return this.get<{ incidents: Incident[] }>(`/api/v1/incidents?${query.toString()}`);
  }

  async getAssets(params?: { asset_type?: string; risk_level?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.asset_type) query.set("asset_type", params.asset_type);
    if (params?.risk_level) query.set("risk_level", params.risk_level);
    if (params?.limit) query.set("limit", params.limit.toString());
    return this.get<{ assets: Asset[] }>(`/api/v1/assets?${query.toString()}`);
  }

  async getForensicsJobs(params?: { status?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.limit) query.set("limit", params.limit.toString());
    return this.get<{ jobs: ForensicsJob[] }>(`/api/v1/forensics/jobs?${query.toString()}`);
  }

  async getThreatIntelligence(params?: { tlp?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.tlp) query.set("tlp", params.tlp);
    if (params?.limit) query.set("limit", params.limit.toString());
    return this.get<{ indicators: ThreatIndicator[] }>(`/api/v1/threat-intel?${query.toString()}`);
  }

  async getAuditEvents(params?: { limit?: number; actor?: string }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.actor) query.set("actor", params.actor);
    return this.get<{ events: AuditEvent[] }>(`/api/v1/audit?${query.toString()}`);
  }

  async getComplianceReport() {
    return this.get<ComplianceReport>("/api/v1/compliance/report");
  }

  async getDashboardStats() {
    return this.get<DashboardStats>("/api/v1/dashboard/stats");
  }

  async searchEvents(query: string, filters?: Record<string, string>) {
    const params = new URLSearchParams({ q: query });
    if (filters) Object.entries(filters).forEach(([k, v]) => params.set(k, v));
    return this.get<{ results: ThreatEvent[] }>(`/api/v1/events/search?${params.toString()}`);
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export interface AgentStatus {
  name: string;
  status: string;
  tools: string[];
  last_cycle: string;
  cycles_completed: number;
  errors: number;
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

export interface ThreatEvent {
  id: string;
  timestamp: string;
  source: string;
  event_type: string;
  severity: string;
  description: string;
  raw_data: Record<string, unknown>;
}

export const api = new ApiClient();
