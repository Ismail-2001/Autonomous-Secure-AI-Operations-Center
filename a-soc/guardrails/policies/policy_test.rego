package asoc.policy

import rego.v1

# ── TelemetryAgent Tests ──────────────────────────────────────────────────

test_telemetry_fetch_allowed if {
    allow with input as {
        "agent": "TelemetryAgent",
        "action": {"type": "fetch_cloud_events"},
        "user": {"role": "analyst", "id": "u1"},
        "context": {},
    }
}

test_telemetry_fetch_readonly_denied if {
    not allow with input as {
        "agent": "TelemetryAgent",
        "action": {"type": "fetch_cloud_events"},
        "user": {"role": "readonly", "id": "u1"},
        "context": {},
    }
}

test_telemetry_emit_alert_allowed if {
    allow with input as {
        "agent": "TelemetryAgent",
        "action": {"type": "emit_telemetry_alert"},
        "user": {"role": "analyst", "id": "u1"},
        "context": {},
    }
}

# ── DetectionAgent Tests ─────────────────────────────────────────────────

test_detection_analyze_allowed if {
    allow with input as {
        "agent": "DetectionAgent",
        "action": {"type": "analyze_threat_llm"},
        "user": {"role": "analyst", "id": "u1"},
        "context": {},
    }
}

test_detection_high_risk_requires_approval if {
    require_approval with input as {
        "agent": "DetectionAgent",
        "action": {"type": "analyze_threat_llm", "risk_score": 0.85},
        "user": {"role": "analyst", "id": "u1"},
        "context": {},
    }
}

test_detection_low_risk_no_approval if {
    not require_approval with input as {
        "agent": "DetectionAgent",
        "action": {"type": "analyze_threat_llm", "risk_score": 0.5},
        "user": {"role": "analyst", "id": "u1"},
        "context": {},
    }
}

# ── SupervisorAgent Tests ────────────────────────────────────────────────

test_supervisor_quality_gate_allowed if {
    allow with input as {
        "agent": "SupervisorAgent",
        "action": {"type": "quality_gate"},
        "user": {"role": "supervisor", "id": "u1"},
        "context": {},
    }
}

test_supervisor_quality_gate_denied_for_analyst if {
    not allow with input as {
        "agent": "SupervisorAgent",
        "action": {"type": "quality_gate"},
        "user": {"role": "analyst", "id": "u1"},
        "context": {},
    }
}

test_supervisor_approve_action_allowed if {
    allow with input as {
        "agent": "SupervisorAgent",
        "action": {"type": "approve_action"},
        "user": {"role": "supervisor", "id": "u1"},
        "context": {},
        "approval": {"granted": true, "approver": "sup-1"},
    }
}

# ── ForensicsAgent Tests ─────────────────────────────────────────────────

test_forensics_search_allowed if {
    allow with input as {
        "agent": "ForensicsAgent",
        "action": {"type": "search_similar_incidents"},
        "user": {"role": "analyst", "id": "u1"},
        "context": {},
    }
}

test_forensics_blast_radius_allowed if {
    allow with input as {
        "agent": "ForensicsAgent",
        "action": {"type": "build_blast_radius_graph"},
        "user": {"role": "analyst", "id": "u1"},
        "context": {},
    }
}

# ── ResponseAgent Tests ──────────────────────────────────────────────────

test_response_block_ip_allowed_with_auth if {
    allow with input as {
        "agent": "ResponseAgent",
        "action": {"type": "BLOCK_IP", "risk_score": 0.7},
        "user": {"role": "supervisor", "id": "u1"},
        "context": {"authorized": true, "incident_id": "inc-1"},
    }
}

test_response_block_ip_denied_without_auth if {
    not allow with input as {
        "agent": "ResponseAgent",
        "action": {"type": "BLOCK_IP", "risk_score": 0.7},
        "user": {"role": "supervisor", "id": "u1"},
        "context": {"authorized": false, "incident_id": "inc-1"},
    }
}

test_response_revoke_iam_requires_admin if {
    not allow with input as {
        "agent": "ResponseAgent",
        "action": {"type": "REVOKE_IAM", "risk_score": 0.8},
        "user": {"role": "supervisor", "id": "u1"},
        "context": {"authorized": true, "incident_id": "inc-1"},
    }
}

test_response_revoke_iam_allowed_by_admin if {
    allow with input as {
        "agent": "ResponseAgent",
        "action": {"type": "REVOKE_IAM", "risk_score": 0.8},
        "user": {"role": "admin", "id": "u1"},
        "context": {"authorized": true, "incident_id": "inc-1"},
    }
}

test_response_extreme_risk_always_denied if {
    deny with input as {
        "agent": "ResponseAgent",
        "action": {"type": "BLOCK_IP", "risk_score": 0.98},
        "user": {"role": "admin", "id": "u1"},
        "context": {"authorized": true, "incident_id": "inc-1"},
    }
}

test_response_destructive_requires_approval if {
    require_approval with input as {
        "agent": "ResponseAgent",
        "action": {"type": "ISOLATE_INSTANCE", "risk_score": 0.6},
        "user": {"role": "supervisor", "id": "u1"},
        "context": {"authorized": true, "incident_id": "inc-1"},
    }
}

test_response_destructive_without_auth_denied if {
    deny with input as {
        "agent": "ResponseAgent",
        "action": {"type": "QUARANTINE_S3", "risk_score": 0.6},
        "user": {"role": "supervisor", "id": "u1"},
        "context": {"authorized": false},
    }
}

# ── ComplianceAgent Tests ────────────────────────────────────────────────

test_compliance_map_frameworks_allowed if {
    allow with input as {
        "agent": "ComplianceAgent",
        "action": {"type": "map_to_frameworks"},
        "user": {"role": "analyst", "id": "u1"},
        "context": {},
    }
}

test_compliance_report_always_audited if {
    audit_required with input as {
        "agent": "ComplianceAgent",
        "action": {"type": "generate_compliance_report"},
        "user": {"role": "analyst", "id": "u1"},
        "context": {},
    }
}

# ── NotificationAgent Tests ──────────────────────────────────────────────

test_notification_slack_allowed if {
    allow with input as {
        "agent": "NotificationAgent",
        "action": {"type": "send_slack_alert"},
        "user": {"role": "analyst", "id": "u1"},
        "context": {},
    }
}

test_notification_jira_requires_supervisor if {
    not allow with input as {
        "agent": "NotificationAgent",
        "action": {"type": "create_jira_ticket"},
        "user": {"role": "analyst", "id": "u1"},
        "context": {},
    }
}

test_notification_jira_allowed_by_supervisor if {
    allow with input as {
        "agent": "NotificationAgent",
        "action": {"type": "create_jira_ticket"},
        "user": {"role": "supervisor", "id": "u1"},
        "context": {},
    }
}

# ── Cross-Agent Tests ────────────────────────────────────────────────────

test_readonly_user_denied if {
    not allow with input as {
        "agent": "TelemetryAgent",
        "action": {"type": "fetch_cloud_events"},
        "user": {"role": "readonly", "id": "u1"},
        "context": {},
    }
}

test_all_destructive_actions_audited if {
    audit_required with input as {
        "agent": "ResponseAgent",
        "action": {"type": "DELETE_USER", "risk_score": 0.5},
        "user": {"role": "admin", "id": "u1"},
        "context": {"authorized": true},
    }
}
