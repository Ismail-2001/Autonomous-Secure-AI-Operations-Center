# A-SOC Agent Policy — OPA Rego policies for all 7 agents.
#
# Each agent has explicit approval thresholds, role requirements, and
# action constraints. This is the single source of truth for what each
# agent is allowed to do.
#
# Package: asoc.policy
# Input shape:
# {
#     "agent": "DetectionAgent",
#     "action": {"type": "analyze_threat", "risk_score": 0.7},
#     "user": {"role": "analyst", "id": "user-123"},
#     "context": {"incident_id": "inc-456", "authorized": true}
# }

package asoc.policy

import rego.v1

# ── Default Deny ──────────────────────────────────────────────────────────

default allow = false
default require_approval = false
default deny = false
default audit_required = false

# ── Role Hierarchy ────────────────────────────────────────────────────────

role_level := {
    "readonly": 0,
    "analyst": 1,
    "supervisor": 2,
    "admin": 3,
}

user_role_level := role_level[input.user.role]

# ── Global Rules ──────────────────────────────────────────────────────────

# Audit trail required for all destructive actions
audit_required if {
    input.action.type in destructive_actions
}

audit_required if {
    input.action.risk_score >= 0.5
}

# Destructive action list
destructive_actions := {
    "BLOCK_IP",
    "REVOKE_IAM",
    "ISOLATE_INSTANCE",
    "QUARANTINE_S3",
    "DELETE_USER",
    "TERMINATE_INSTANCE",
    "REMOVE_POLICY",
}

# ──────────────────────────────────────────────────────────────────────────
# 1. TelemetryAgent — Ingestion
# ──────────────────────────────────────────────────────────────────────────

# TelemetryAgent can always read cloud events (read-only)
allow if {
    input.agent == "TelemetryAgent"
    input.action.type == "fetch_cloud_events"
    user_role_level >= 1
}

allow if {
    input.agent == "TelemetryAgent"
    input.action.type == "filter_events_by_risk"
    user_role_level >= 1
}

allow if {
    input.agent == "TelemetryAgent"
    input.action.type == "normalize_event_schema"
    user_role_level >= 1
}

# Emit alert requires analyst role
allow if {
    input.agent == "TelemetryAgent"
    input.action.type == "emit_telemetry_alert"
    user_role_level >= 1
}

# ──────────────────────────────────────────────────────────────────────────
# 2. DetectionAgent — Analysis
# ──────────────────────────────────────────────────────────────────────────

# LLM analysis: analyst+ can trigger
allow if {
    input.agent == "DetectionAgent"
    input.action.type == "analyze_threat_llm"
    user_role_level >= 1
}

# MITRE mapping: analyst+
allow if {
    input.agent == "DetectionAgent"
    input.action.type == "map_mitre_technique"
    user_role_level >= 1
}

# Risk rule query: analyst+
allow if {
    input.agent == "DetectionAgent"
    input.action.type == "query_risk_rules"
    user_role_level >= 1
}

# Risk score calculation: analyst+
allow if {
    input.agent == "DetectionAgent"
    input.action.type == "calculate_risk_score"
    user_role_level >= 1
}

# DetectionAgent output gating: risk >= 0.8 requires supervisor review
require_approval if {
    input.agent == "DetectionAgent"
    input.action.risk_score >= 0.8
}

# ──────────────────────────────────────────────────────────────────────────
# 3. SupervisorAgent — Orchestration
# ──────────────────────────────────────────────────────────────────────────

# Supervisor can route, quality-gate, and escalate
allow if {
    input.agent == "SupervisorAgent"
    input.action.type in {
        "query_opa_policy",
        "quality_gate",
        "retry_with_reflection",
        "escalation_policy",
        "route_by_risk",
        "track_run_context",
        "check_agent_health",
    }
    user_role_level >= 2
}

# Supervisor can approve actions: requires supervisor+ role
allow if {
    input.agent == "SupervisorAgent"
    input.action.type == "approve_action"
    input.approval.granted == true
    input.approval.approver != ""
    user_role_level >= 2
}

# ──────────────────────────────────────────────────────────────────────────
# 4. ForensicsAgent — Investigation
# ──────────────────────────────────────────────────────────────────────────

# Forensics is read-heavy: analyst+ can investigate
allow if {
    input.agent == "ForensicsAgent"
    input.action.type in {
        "search_similar_incidents",
        "build_blast_radius_graph",
        "reconstruct_timeline",
    }
    user_role_level >= 1
}

# Store vector: analyst+ (writes to vector store)
allow if {
    input.agent == "ForensicsAgent"
    input.action.type == "store_incident_vector"
    user_role_level >= 1
}

# ──────────────────────────────────────────────────────────────────────────
# 5. ResponseAgent — Remediation (HIGHEST RESTRICTION)
# ──────────────────────────────────────────────────────────────────────────

# ALL response actions require authorization context
allow if {
    input.agent == "ResponseAgent"
    input.action.type in destructive_actions
    input.context.authorized == true
    user_role_level >= 2  # supervisor+ to authorize
    input.action.risk_score < 0.95
}

# BLOCK_IP: requires supervisor+ and explicit authorization
allow if {
    input.agent == "ResponseAgent"
    input.action.type == "BLOCK_IP"
    input.context.authorized == true
    user_role_level >= 2
    input.action.risk_score < 0.95
}

# REVOKE_IAM: requires admin and explicit authorization
allow if {
    input.agent == "ResponseAgent"
    input.action.type == "REVOKE_IAM"
    input.context.authorized == true
    user_role_level >= 3  # admin only
    input.action.risk_score < 0.95
}

# ISOLATE_INSTANCE: requires supervisor+ and explicit authorization
allow if {
    input.agent == "ResponseAgent"
    input.action.type == "ISOLATE_INSTANCE"
    input.context.authorized == true
    user_role_level >= 2
    input.action.risk_score < 0.95
}

# QUARANTINE_S3: requires supervisor+ and explicit authorization
allow if {
    input.agent == "ResponseAgent"
    input.action.type == "QUARANTINE_S3"
    input.context.authorized == true
    user_role_level >= 2
    input.action.risk_score < 0.95
}

# Verify remediation: analyst+ (read-only check)
allow if {
    input.agent == "ResponseAgent"
    input.action.type == "verify_remediation"
    user_role_level >= 1
}

# ResponseAgent: NEVER auto-execute destructive actions
deny if {
    input.agent == "ResponseAgent"
    input.action.type in destructive_actions
    not input.context.authorized
}

# Block extreme risk entirely (even with approval)
deny if {
    input.agent == "ResponseAgent"
    input.action.type in destructive_actions
    input.action.risk_score >= 0.95
}

# ResponseAgent always requires human approval for destructive actions
require_approval if {
    input.agent == "ResponseAgent"
    input.action.type in destructive_actions
}

# ──────────────────────────────────────────────────────────────────────────
# 6. ComplianceAgent — Audit
# ──────────────────────────────────────────────────────────────────────────

# Compliance is mostly read + write audit records
allow if {
    input.agent == "ComplianceAgent"
    input.action.type in {
        "map_to_frameworks",
        "check_control_status",
        "generate_compliance_report",
    }
    user_role_level >= 1
}

# ComplianceAgent can always log (append-only, non-destructive)
audit_required if {
    input.agent == "ComplianceAgent"
    input.action.type == "generate_compliance_report"
}

# ──────────────────────────────────────────────────────────────────────────
# 7. NotificationAgent — External Communication
# ──────────────────────────────────────────────────────────────────────────

# Notification sending: analyst+ (non-destructive but external)
allow if {
    input.agent == "NotificationAgent"
    input.action.type in {
        "send_slack_alert",
        "send_teams_alert",
        "format_alert_message",
    }
    user_role_level >= 1
}

# JIRA ticket creation: supervisor+ (creates external tracking)
allow if {
    input.agent == "NotificationAgent"
    input.action.type == "create_jira_ticket"
    user_role_level >= 2
}

# ──────────────────────────────────────────────────────────────────────────
# Cross-Agent Rules
# ──────────────────────────────────────────────────────────────────────────

# Read-only users cannot trigger any agent actions
deny if {
    user_role_level < 1
    not startswith(input.action.type, "read_")
}

# All agents require valid incident context for destructive actions
require_approval if {
    input.action.type in destructive_actions
    not input.context.incident_id
}
