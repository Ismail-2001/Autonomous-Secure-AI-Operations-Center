import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from src.asoc.agents.base import BaseAgent
from src.asoc.agents.message import ASOCMessage, MessageType, Priority
from src.asoc.vector.pinecone_provider import VectorRecord, vector_provider


class ForensicsAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="ForensicsAgent", description="Performs root cause analysis and blast radius assessment")

    async def analyze_incident(self, incident_data: Dict[str, Any]) -> Dict[str, Any]:
        self.logger.info("forensics_started", incident_id=incident_data.get("incident_id"))

        query_text = json.dumps(incident_data.get("data", incident_data))
        query_vector = vector_provider.embed_text(query_text)
        try:
            similar = await vector_provider.query(query_vector, top_k=3)
        except Exception as e:
            self.logger.error("vector_query_failed", error=str(e))
            similar = []

        related_incidents = [
            {"id": r.id, "similarity": round(r.score, 3), "root_cause": r.metadata.get("root_cause", "Unknown")}
            for r in similar
        ]

        reconstruction = {
            "root_cause": "Compromised IAM credentials for 'test-user'",
            "blast_radius": ["S3 bucket listing", "Failed EC2 termination"],
            "timeline": [
                {"time": "16:50:00", "action": "ConsoleLogin", "status": "Success"},
                {"time": "16:51:02", "action": "ListBuckets", "status": "Success"},
                {"time": "16:52:15", "action": "TerminateInstance", "status": "Failed (Permission Denied)"},
            ],
            "confidence_score": 0.92,
            "similar_past_incidents": related_incidents,
        }
        return reconstruction

    async def process_message(self, message: ASOCMessage) -> Optional[ASOCMessage]:
        self.logger.info("processing_forensics", payload=message.payload)
        await self.log_event("forensics_started", {"target": message.payload.get("target")})

        blast_radius_graph = {
            "nodes": [
                {"id": "attacker-ip", "type": "threat_actor", "label": "IP: 1.2.3.4", "risk": "critical"},
                {"id": "compromised-user", "type": "identity", "label": "User: admin", "risk": "high"},
                {"id": "s3-bucket", "type": "resource", "label": "S3: sensitive-data-prod", "risk": "medium"},
                {"id": "ec2-instance", "type": "resource", "label": "EC2: i-0abcdef1234567890", "risk": "medium"},
            ],
            "edges": [
                {"source": "attacker-ip", "target": "compromised-user", "label": "Brute Force"},
                {"source": "compromised-user", "target": "s3-bucket", "label": "Data Exfiltration"},
                {"source": "compromised-user", "target": "ec2-instance", "label": "Privilege Escalation"},
            ],
        }

        analysis_result = {
            "root_cause": "Credential Compromise via Phishing (Simulated)",
            "impact_level": "CRITICAL",
            "blast_radius": blast_radius_graph,
            "evidence": ["Login from unfamiliar IP", "Mass download from S3"],
        }

        await self._store_incident_vector(analysis_result, message.correlation_id)
        await self.log_event("forensics_complete", analysis_result)

        return ASOCMessage(
            message_type=MessageType.REPORT,
            source_agent=self.name,
            target_agent="SupervisorAgent",
            payload=analysis_result,
            correlation_id=message.correlation_id,
            priority=Priority.HIGH,
        )

    async def _store_incident_vector(self, analysis: Dict[str, Any], incident_id: Optional[str] = None) -> None:
        try:
            text_for_embedding = json.dumps(
                {"root_cause": analysis.get("root_cause", ""), "evidence": analysis.get("evidence", [])}
            )
            vector = vector_provider.embed_text(text_for_embedding)
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
        except Exception as e:
            self.logger.error("incident_vector_failed", error=str(e))
