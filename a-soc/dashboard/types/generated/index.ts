/**
 * Auto-generated TypeScript types from A-SOC Pydantic schemas.
 *
 * These types mirror the backend models defined in:
 *   - src/asoc/agents/message.py      (ASOCMessage, MessageType, Priority)
 *   - src/asoc/agents/observation.py  (AgentObservation, ObservationNextState)
 *   - src/asoc/agents/state.py        (AgentState)
 *   - src/asoc/agents/supervisor.py   (EscalationLevel, QualityGateResult)
 *   - src/asoc/agents/agent_message.py (AgentType, AgentMessage, RunContext)
 *   - src/asoc/api/app.py             (API request/response models)
 *
 * Regenerate: python -m datamodel_code_generator --input src/asoc --output dashboard/types/generated
 */

// ── Agent Types ──────────────────────────────────────────────────────────

export type AgentType =
  | "telemetry"
  | "detection"
  | "supervisor"
  | "forensics"
  | "response"
  | "compliance"
  | "notification";

// ── Message Types ────────────────────────────────────────────────────────

export type MessageType =
  | "alert"
  | "command"
  | "report"
  | "response"
  | "log"
  | "acknowledgment";

export type MessagePriority = "low" | "medium" | "high" | "critical";

// ── ASOCMessage ──────────────────────────────────────────────────────────

export interface ASOCMessage {
  readonly message_id: string;
  readonly message_type: MessageType;
  readonly source_agent: string;
  readonly target_agent: string | null;
  readonly payload: Record<string, unknown>;
  readonly correlation_id: string | null;
  readonly priority: MessagePriority;
  readonly timestamp: string;
}

// ── Agent Message (Typed) ────────────────────────────────────────────────

export interface AgentMessage {
  readonly message_id: string;
  readonly message_type: string;
  readonly source: AgentType;
  readonly target: AgentType | null;
  readonly priority: MessagePriority;
  readonly payload: Record<string, unknown>;
  readonly correlation_id: string | null;
  readonly timestamp: string;
}

// ── Observation ──────────────────────────────────────────────────────────

export type ObservationNextState = "continue" | "escalate" | "halt";

export interface AgentObservation {
  readonly agent_id: string;
  readonly action_taken: string;
  readonly confidence_score: number;
  readonly tools_used: readonly string[];
  readonly next_state: ObservationNextState;
  readonly risk_score: number | null;
  readonly metadata: Record<string, unknown>;
  readonly error: string | null;
  readonly retry_count: number;
}

// ── Agent State ──────────────────────────────────────────────────────────

export interface AgentState {
  readonly incident_id: string;
  readonly messages: readonly ASOCMessage[];
  readonly risk_score: number;
  readonly confidence_score: number;
  readonly agent_observations: readonly AgentObservation[];
  readonly next_step: string;
  readonly is_authorized: boolean;
  readonly working_memory: Record<string, unknown>;
}

// ── Supervisor ───────────────────────────────────────────────────────────

export type EscalationLevel =
  | "auto_retry"
  | "supervisor_review"
  | "human_pager"
  | "incident_commander";

export type QualityGateResult =
  | "pass"
  | "fail_confidence"
  | "fail_schema"
  | "fail_safety"
  | "fail_timeout";

export interface EscalationDecision {
  readonly level: EscalationLevel;
  readonly should_page_human: boolean;
  readonly retry_count: number;
  readonly max_retries: number;
  readonly action: string;
}

export interface QualityGateValidation {
  readonly passed: boolean;
  readonly result: QualityGateResult;
  readonly reason: string;
}

// ── Run Context ──────────────────────────────────────────────────────────

export interface RunContext {
  readonly incident_id: string;
  readonly started_at: string;
  readonly steps: readonly RunStep[];
  readonly retry_counts: Record<string, number>;
  readonly max_retries: number;
  readonly duration_seconds: number;
  readonly success_rate: number;
}

export interface RunStep {
  readonly step_name: string;
  readonly success: boolean;
  readonly timestamp: string;
  readonly duration_ms: number;
}

// ── API Request Models ───────────────────────────────────────────────────

export interface SimulationStartRequest {
  readonly scenario: string | null;
}

export interface ApprovalActionRequest {
  readonly incident_id: string;
  readonly approved: boolean;
}

export interface HuntingQueryParams {
  readonly q: string;
  readonly agent: string;
  readonly event_type: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly limit: number;
  readonly offset: number;
}

// ── API Response Models ──────────────────────────────────────────────────

export interface HealthResponse {
  readonly status: "healthy" | "degraded";
  readonly service: string;
  readonly version: string;
  readonly active_connections: number;
  readonly database: string;
  readonly message_bus: string;
  readonly vector_store: string;
  readonly circuit_breakers: {
    readonly postgres: string;
    readonly redis: string;
  };
}

export interface HuntingEventsResponse {
  readonly status: string;
  readonly events: readonly HuntingEvent[];
  readonly total: number;
}

export interface HuntingEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly type: string;
  readonly agent: string;
  readonly payload: Record<string, unknown>;
  readonly signature: string;
}

export interface HuntingTimelineResponse {
  readonly status: string;
  readonly buckets: readonly TimelineBucket[];
  readonly bucket_size: string;
}

export interface TimelineBucket {
  readonly time: string;
  readonly count: number;
}

// ── WebSocket Events ─────────────────────────────────────────────────────

export type WSEventType = "APPROVAL_REQUIRED" | "BLAST_RADIUS_UPDATE" | "PING";

export interface WSBaseEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly type?: string;
}

export interface WSThreatEvent extends WSBaseEvent {
  readonly agent: string;
  readonly status: string;
  readonly message: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly is_background?: boolean;
}

export interface WSApprovalEvent {
  readonly type: "APPROVAL_REQUIRED";
  readonly action: string;
  readonly target: string;
  readonly risk_score: number;
}

export interface WSBlastRadiusEvent {
  readonly type: "BLAST_RADIUS_UPDATE";
  readonly graph: GraphData;
  readonly root_cause: string;
}

// ── Graph / Visualization ────────────────────────────────────────────────

export type RiskLevel = "critical" | "high" | "medium" | "low";
export type NodeType = "threat_actor" | "identity" | "resource" | "unknown";

export interface GraphNode {
  readonly id: string;
  readonly type: NodeType;
  readonly label: string;
  readonly risk: RiskLevel;
}

export interface GraphEdge {
  readonly source: string;
  readonly target: string;
  readonly label: string;
}

export interface GraphData {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

// ── Cloud Event (Normalized) ─────────────────────────────────────────────

export interface CloudEvent {
  readonly eventID: string;
  readonly eventName: string;
  readonly eventTime: string;
  readonly sourceIPAddress: string | null;
  readonly userIdentity: Record<string, unknown>;
  readonly resources: readonly Record<string, unknown>[];
}

// ── Tool Definitions ─────────────────────────────────────────────────────

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly input_schema: Record<string, unknown>;
  readonly output_schema?: Record<string, unknown>;
  readonly is_high_risk?: boolean;
  readonly requires_authorization?: boolean;
}

// ── Compliance ───────────────────────────────────────────────────────────

export type ComplianceFramework = "SOC2" | "ISO27001" | "HIPAA" | "NIST" | "GDPR";

export interface ComplianceControl {
  readonly control_id: string;
  readonly framework: ComplianceFramework;
  readonly description: string;
  readonly status: "compliant" | "non_compliant" | "requires_remediation";
}

export interface ComplianceReport {
  readonly event_type: string;
  readonly mapped_controls: readonly string[];
  readonly severity: "low" | "medium" | "high";
  readonly remediation_required: boolean;
  readonly details: Record<string, unknown>;
  readonly finding_status: "open" | "remediated" | "accepted";
}

// ── Notification ─────────────────────────────────────────────────────────

export type NotificationChannel = "slack" | "teams" | "jira" | "email";

export interface NotificationPayload {
  readonly title: string;
  readonly message: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly fields?: Record<string, string>;
}
