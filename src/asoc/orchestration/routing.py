from src.asoc.agents.state import AgentState


def route_after_telemetry(state: AgentState) -> str:
    if state.get("confidence_score", 1.0) < 0.5:
        return "supervisor"
    return "detection"


def route_after_detection(state: AgentState) -> str:
    confidence = state.get("confidence_score", 1.0)
    risk = state.get("risk_score", 0.0)
    if confidence < 0.7:
        return "supervisor"
    if risk >= 0.8:
        return "hitl"
    return "supervisor"


def route_after_supervisor(state: AgentState) -> str:
    risk = state.get("risk_score", 0.0)
    is_authorized = state.get("is_authorized", False)
    next_step = state.get("next_step", "")

    if next_step == "end":
        return "end"
    if next_step == "hitl":
        return "hitl"
    if next_step == "response":
        return "response"

    if risk >= 0.8 and not is_authorized:
        return "hitl"
    if risk >= 0.95:
        return "hitl"
    if risk < 0.5:
        return "response"
    return "forensics"


def route_after_hitl(state: AgentState) -> str:
    if state.get("is_authorized", False):
        return "response"
    return "end"


def route_after_response(state: AgentState) -> str:
    return "compliance"
