from guardrails.risk_scoring.scorer import RiskLevel, RiskScorer


def test_score_action_default():
    score = RiskScorer.score_action("UNKNOWN", {})
    assert score == 0.5


def test_score_action_known():
    score = RiskScorer.score_action("IAM_REVOKE", {})
    assert score == 0.8


def test_score_action_context_bump():
    score = RiskScorer.score_action("LOG_QUERY", {"production_environment": True})
    assert score == 0.2


def test_score_action_capped():
    score = RiskScorer.score_action("K8S_TERMINATE", {"irreversible": True})
    assert score == 1.0


def test_get_risk_level():
    assert RiskScorer.get_risk_level(0.2) == RiskLevel.LOW
    assert RiskScorer.get_risk_level(0.5) == RiskLevel.MEDIUM
    assert RiskScorer.get_risk_level(0.7) == RiskLevel.HIGH
    assert RiskScorer.get_risk_level(0.9) == RiskLevel.CRITICAL


def test_requires_approval():
    assert RiskScorer.requires_approval(0.6) is True
    assert RiskScorer.requires_approval(0.3) is False
    assert RiskScorer.requires_approval(0.5) is True
