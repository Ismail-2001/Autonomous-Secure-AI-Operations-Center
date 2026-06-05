package asoc.actions

# --- allow (low-risk, non-destructive) ---

test_allow_low_risk_pass {
    allow with input as {"action": {"risk_score": 0.3, "type": "read_only"}}
}

test_allow_low_risk_fail_high_risk {
    not allow with input as {"action": {"risk_score": 0.6, "type": "read_only"}}
}

test_allow_low_risk_fail_destructive {
    not allow with input as {"action": {"risk_score": 0.3, "type": "destructive"}}
}

# --- allow (high-risk with approval) ---

test_allow_high_risk_with_approval_pass {
    allow with input as {"action": {"risk_score": 0.7}, "approval": {"granted": true, "approver": "admin"}}
}

test_allow_high_risk_fail_no_approval {
    not allow with input as {"action": {"risk_score": 0.7}, "approval": {"granted": false, "approver": "admin"}}
}

test_allow_high_risk_fail_empty_approver {
    not allow with input as {"action": {"risk_score": 0.7}, "approval": {"granted": true, "approver": ""}}
}

# --- require_approval (medium-risk) ---

test_require_approval_medium_risk_pass {
    require_approval with input as {"action": {"risk_score": 0.6, "type": "config_update"}}
}

test_require_approval_medium_risk_fail_low {
    not require_approval with input as {"action": {"risk_score": 0.3, "type": "config_update"}}
}

test_require_approval_destructive_pass {
    require_approval with input as {"action": {"risk_score": 0.1, "type": "destructive"}}
}

test_require_approval_high_risk_fail {
    not require_approval with input as {"action": {"risk_score": 0.9, "type": "config_update"}}
}

# --- deny (extremely high-risk destructive) ---

test_deny_extreme_risk_pass {
    deny with input as {"action": {"risk_score": 0.98, "type": "destructive"}}
}

test_deny_extreme_risk_with_override {
    not deny with input as {"action": {"risk_score": 0.98, "type": "destructive"}, "emergency_override": true}
}

test_deny_extreme_risk_non_destructive {
    not deny with input as {"action": {"risk_score": 0.98, "type": "read_only"}}
}

test_deny_moderate_risk_destructive {
    not deny with input as {"action": {"risk_score": 0.5, "type": "destructive"}}
}

# --- allow_iam_revoke ---

test_allow_iam_revoke_pass {
    allow_iam_revoke with input as {"action": {"type": "IAM_REVOKE", "risk_score": 0.8}, "approval": {"granted": true}}
}

test_allow_iam_revoke_fail_low_risk {
    not allow_iam_revoke with input as {"action": {"type": "IAM_REVOKE", "risk_score": 0.5}, "approval": {"granted": true}}
}

test_allow_iam_revoke_fail_no_approval {
    not allow_iam_revoke with input as {"action": {"type": "IAM_REVOKE", "risk_score": 0.8}, "approval": {"granted": false}}
}

# --- allow_pod_isolation ---

test_allow_pod_isolation_pass {
    allow_pod_isolation with input as {"action": {"type": "K8S_ISOLATE", "risk_score": 0.7}, "approval": {"granted": true}}
}

test_allow_pod_isolation_fail_low_risk {
    not allow_pod_isolation with input as {"action": {"type": "K8S_ISOLATE", "risk_score": 0.4}, "approval": {"granted": true}}
}

test_allow_pod_isolation_fail_no_approval {
    not allow_pod_isolation with input as {"action": {"type": "K8S_ISOLATE", "risk_score": 0.7}, "approval": {"granted": false}}
}

# --- audit_required ---

test_audit_required_destructive_pass {
    audit_required with input as {"action": {"type": "destructive", "risk_score": 0.1}}
}

test_audit_required_high_risk_pass {
    audit_required with input as {"action": {"type": "read_only", "risk_score": 0.6}}
}

test_audit_required_all_high_risk_pass {
    audit_required with input as {"action": {"type": "destructive", "risk_score": 0.9}}
}

test_audit_required_fail_low_risk_non_destructive {
    not audit_required with input as {"action": {"type": "read_only", "risk_score": 0.3}}
}
