import operator
from typing import Annotated, Sequence, TypedDict

from langgraph.graph import END, StateGraph

from src.asoc.agents.message import ASOCMessage
from src.asoc.agents.detection import DetectionAgent
from src.asoc.agents.forensics import ForensicsAgent
from src.asoc.agents.response import ResponseAgent
from src.asoc.agents.supervisor import SupervisorAgent
from src.asoc.agents.telemetry import TelemetryAgent


class AgentState(TypedDict):
    messages: Annotated[Sequence[ASOCMessage], operator.add]
    incident_id: str
    risk_score: float
    next_step: str
    is_authorized: bool


async def telemetry_node(state: AgentState):
    agent = TelemetryAgent()
    return {"next_step": "detection"}


async def detection_node(state: AgentState):
    agent = DetectionAgent()
    latest_msg = state["messages"][-1] if state["messages"] else None
    return {"risk_score": 0.85, "next_step": "supervisor"}


async def supervisor_node(state: AgentState):
    agent = SupervisorAgent()
    if state["risk_score"] > 0.8:
        return {"next_step": "forensics", "is_authorized": True}
    return {"next_step": "end"}


async def forensics_node(state: AgentState):
    agent = ForensicsAgent()
    return {"next_step": "response"}


async def response_node(state: AgentState):
    agent = ResponseAgent()
    return {"next_step": "end"}


def create_asoc_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("telemetry", telemetry_node)
    workflow.add_node("detection", detection_node)
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("forensics", forensics_node)
    workflow.add_node("response", response_node)

    workflow.set_entry_point("telemetry")
    workflow.add_edge("telemetry", "detection")
    workflow.add_edge("detection", "supervisor")

    workflow.add_conditional_edges("supervisor", lambda x: x["next_step"], {"forensics": "forensics", "end": END})

    workflow.add_edge("forensics", "response")
    workflow.add_edge("response", END)

    return workflow.compile()
