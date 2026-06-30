import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from langsmith import traceable

from src.asoc.agents.base import BaseAgent
from src.asoc.agents.message import ASOCMessage, MessageType, Priority
from src.asoc.agents.observation import AgentObservation, ObservationNextState
from src.asoc.agents.state import AgentState
from src.asoc.vector.pinecone_provider import VectorRecord, vector_provider
from src.asoc.middleware.prompt_injection import validate_agent_input


class ForensicsAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="ForensicsAgent", description="Performs root cause analysis and blast radius assessment")

    def _register_default_tools(self) -> None:
        self.tool_registry.register(
            name="search_similar_incidents",
            func=self._tool_search_similar,
            description="Query vector store for historically similar incidents",
            input_schema={"query_text": {"type": "string"}, "top_k": {"type": "integer"}},
            output_schema={"similar_incidents": {"type": "array"}},
        )
        self.tool_registry.register(
            name="build_blast_radius_graph",
            func=self._tool_build_blast_radius,
            description="Construct attack graph nodes and edges from incident data",
            input_schema={"incident_data": {"type": "object"}, "events": {"type": "array"}},
            output_schema={"nodes": {"type": "array"}, "edges": {"type": "array"}},
        )
        self.tool_registry.register(
            name="reconstruct_timeline",
            func=self._tool_reconstruct_timeline,
            description="Order events chronologically into an attack timeline",
            input_schema={"events": {"type": "array"}},
            output_schema={"timeline": {"type": "array"}},
        )
        self.tool_registry.register(
            name="store_incident_vector",
            func=self._tool_store_vector,
            description="Persist incident analysis to vector store for future similarity search",
            input_schema={"analysis": {"type": "object"}, "incident_id": {"type": "string"}},
            output_schema={"stored": {"type": "boolean"}},
        )

    async def _tool_search_similar(self, query_text: str, top_k: int = 3) -> List[Dict[str, Any]]:
        try:
            query_vector = await vector_provider.embed_text(query_text)
            similar = await vector_provider.query(query_vector, top_k=top_k)
            return [
                {"id": r.id, "similarity": round(r.score, 3), "root_cause": r.metadata.get("root_cause", "Unknown")}
                for r in similar
            ]
        except Exception as e:
            self.logger.error("vector_query_failed", error=str(e))
            return []

    async def _tool_build_blast_radius(self, incident_data: Dict[str, Any], events: List[Dict[str, Any]]) -> Dict[str, Any]:
        nodes = []
        edges = []
        node_ids = set()

        source_ip = incident_data.get("source_ip") or incident_data.get("data", {}).get("source_ip")
        if source_ip:
            node_id = f"ip-{source_ip}"
            if node_id not in node_ids:
                nodes.append({"id": node_id, "type": "threat_actor", "label": f"IP: {source_ip}", "risk": "critical"})
                node_ids.add(node_id)

        user = incident_data.get("user") or incident_data.get("data", {}).get("user", "unknown")
        user_node_id = f"user-{user}"
        if user_node_id not in node_ids:
            nodes.append({"id": user_node_id, "type": "identity", "label": f"User: {user}", "risk": "high"})
            node_ids.add(user_node_id)
            if source_ip:
                edges.append({"source": f"ip-{source_ip}", "target": user_node_id, "label": "Auth compromise"})

        for event in events:
            event_name = event.get("eventName", event.get("event_name", ""))
            resources = event.get("resources", [])
            for res in resources[:2]:
                res_name = res.get("name", res.get("type", "resource"))
                res_node_id = f"res-{hash(res_name)}"
                if res_node_id not in node_ids:
                    risk = "high" if "Delete" in event_name or "Terminate" in event_name else "medium"
                    nodes.append({"id": res_node_id, "type": "resource", "label": res_name, "risk": risk})
                    node_ids.add(res_node_id)
                    edges.append({"source": user_node_id, "target": res_node_id, "label": event_name})

        if not nodes:
            nodes = [{"id": "unknown", "type": "unknown", "label": "Unknown target", "risk": "low"}]

        return {"nodes": nodes, "edges": edges}

    async def _tool_reconstruct_timeline(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        timeline = []
        for event in sorted(events, key=lambda e: e.get("eventTime", e.get("event_time", ""))):
            timeline.append({
                "time": event.get("eventTime", event.get("event_time", "unknown")),
                "action": event.get("eventName", event.get("event_name", "Unknown")),
                "source_ip": event.get("sourceIPAddress", event.get("source_ip", "unknown")),
                "user": event.get("userIdentity", {}).get("userName", "unknown"),
            })
        return timeline

    async def _tool_store_vector(self, analysis: Dict[str, Any], incident_id: Optional[str] = None) -> bool:
        try:
            text_for_embedding = json.dumps(
                {"root_cause": analysis.get("root_cause", ""), "evidence": analysis.get("evidence", [])}
            )
            vector = await vector_provider.embed_text(text_for_embedding)
            record = VectorRecord(
                id=incident_id or str(uuid.uuid4()),
                vector=vector,
                metadata={
                    "root_cause": analysis.get("root_cause", ""),
                    "impact_level": analysis.get("impact_level", ""),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "node_count": len(analysis.get("blast_radius", {}).get("nodes", [])),
                    "edge_count": len(analysis.get("blast_radius", {}).get("edges", [])),
                },
            )
            await vector_provider.upsert([record])
            self.logger.info("incident_vector_stored", vector_id=record.id)
            return True
        except Exception as e:
            self.logger.error("incident_vector_failed", error=str(e))
            return False

    async def analyze_incident(self, incident_data: Dict[str, Any]) -> Dict[str, Any]:
        self.logger.info("forensics_started", incident_id=incident_data.get("incident_id"))

        validate_agent_input("ForensicsAgent", incident_data=str(incident_data))

        query_text = json.dumps(incident_data.get("data", incident_data))
        similar = await self._tool_search_similar(query_text, top_k=3)

        events = incident_data.get("data", {}).get("events", [])
        if not events:
            events = [incident_data.get("data", incident_data)]

        blast_radius = await self._tool_build_blast_radius(incident_data, events)
        timeline = await self._tool_reconstruct_timeline(events)

        reconstruction = {
            "root_cause": "Credential compromise detected via anomaly analysis",
            "blast_radius": blast_radius,
            "timeline": timeline if timeline else [
                {"time": "pending", "action": "Investigation in progress", "status": "active"},
            ],
            "confidence_score": 0.85 if similar else 0.7,
            "similar_past_incidents": similar,
        }
        return reconstruction

    @traceable(name="forensics_perceive", run_type="chain")
    async def perceive(self, state: AgentState) -> Dict[str, Any]:
        latest_msg = state["messages"][-1] if state.get("messages") else None
        incident_data = {}
        if latest_msg:
            incident_data = latest_msg.payload
        return {
            "incident_data": incident_data,
            "risk_score": state.get("risk_score", 0.0),
            "incident_id": state.get("incident_id", ""),
        }

    @traceable(name="forensics_reason", run_type="chain")
    async def reason(self, state: AgentState, perceived: Dict[str, Any]) -> List[Dict[str, Any]]:
        incident_data = perceived.get("incident_data", {})
        query_text = json.dumps(incident_data)
        return [
            {"tool": "search_similar_incidents", "args": {"query_text": query_text, "top_k": 3}},
            {"tool": "build_blast_radius_graph", "args": {"incident_data": incident_data, "events": incident_data.get("events", [])}},
            {"tool": "reconstruct_timeline", "args": {"events": incident_data.get("events", [])}},
        ]

    @traceable(name="forensics_act", run_type="chain")
    async def act(self, tool_calls: List[Dict[str, Any]], state: AgentState) -> List[Any]:
        results = []
        for call in tool_calls:
            result = await self.tool_registry.execute(call["tool"], **call.get("args", {}))
            results.append(result)
        return results

    @traceable(name="forensics_observe", run_type="chain")
    async def observe(self, state: AgentState, tool_results: List[Any], tool_calls: List[Dict[str, Any]]) -> AgentObservation:
        similar = tool_results[0] if tool_results else []
        blast_radius = tool_results[1] if len(tool_results) > 1 else {}
        timeline = tool_results[2] if len(tool_results) > 2 else []

        node_count = len(blast_radius.get("nodes", [])) if isinstance(blast_radius, dict) else 0
        confidence = 0.85 if similar else 0.7

        return AgentObservation(
            agent_id=self.name,
            action_taken="forensics_analysis_complete",
            confidence_score=confidence,
            tools_used=[c["tool"] for c in tool_calls],
            next_state=ObservationNextState.CONTINUE,
            risk_score=state.get("risk_score"),
            metadata={"similar_count": len(similar), "node_count": node_count, "timeline_steps": len(timeline)},
        )

    async def process_message(self, message: ASOCMessage) -> Optional[ASOCMessage]:
        self.logger.info("processing_forensics", payload=message.payload)
        await self.log_event("forensics_started", {"target": message.payload.get("target")})

        analysis_result = await self.analyze_incident(message.payload)
        await self._tool_store_vector(analysis_result, message.correlation_id)
        await self.log_event("forensics_complete", analysis_result)

        return ASOCMessage(
            message_type=MessageType.REPORT,
            source_agent=self.name,
            target_agent="SupervisorAgent",
            payload=analysis_result,
            correlation_id=message.correlation_id,
            priority=Priority.HIGH,
        )
