"""SIEM & EDR Telemetry Normalizer.

Parses heterogeneous vendor payloads (Splunk HEC, Microsoft Sentinel,
CrowdStrike Falcon, Elastic, and generic syslogs) into canonical, normalized
A-SOC security alert entities for autonomous triage and investigation.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from src.asoc.core.logging import get_logger

logger = get_logger("asoc.siem_normalizer")


class NormalizedSecurityAlert(BaseModel):
    event_id: str = Field(default_factory=lambda: f"SIEM-{uuid.uuid4().hex[:12].upper()}")
    source_system: str  # splunk, sentinel, crowdstrike, generic
    event_type: str
    severity: str = "medium"  # info, low, medium, high, critical
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    target_host: Optional[str] = None
    user: Optional[str] = None
    process: Optional[str] = None
    command_line: Optional[str] = None
    title: str = "Security Event"
    description: str = ""
    mitre_tactics: List[str] = Field(default_factory=list)
    mitre_techniques: List[str] = Field(default_factory=list)
    raw_payload: Dict[str, Any] = Field(default_factory=dict)

    def is_actionable(self) -> bool:
        """Determines if the alert warrants autonomous investigation."""
        return self.severity.lower() in ("high", "critical") or bool(
            self.mitre_techniques or "ransomware" in self.event_type.lower()
        )


class SiemNormalizer:
    """Enterprise normalizer translating vendor payloads to canonical A-SOC alerts."""

    @staticmethod
    def normalize_splunk_hec(payload: Dict[str, Any]) -> NormalizedSecurityAlert:
        """Parse Splunk HTTP Event Collector (HEC) JSON payload."""
        event = payload.get("event", payload)
        if isinstance(event, str):
            event = {"message": event}

        host = payload.get("host") or event.get("host") or event.get("dest_host") or "unknown-host"
        source = payload.get("source", "splunk-hec")
        sourcetype = payload.get("sourcetype", "")

        src_ip = event.get("src_ip") or event.get("source_ip") or event.get("src")
        dest_ip = event.get("dest_ip") or event.get("destination_ip") or event.get("dest")
        user = event.get("user") or event.get("username") or event.get("src_user")
        process = event.get("process") or event.get("process_name") or event.get("app")
        cmdline = event.get("command_line") or event.get("cmdline") or event.get("cmd")

        raw_severity = str(event.get("severity") or event.get("priority") or "medium").lower()
        severity = "medium"
        if raw_severity in ("critical", "fatal", "5", "crit"):
            severity = "critical"
        elif raw_severity in ("high", "4"):
            severity = "high"
        elif raw_severity in ("low", "info", "1", "2"):
            severity = "low"

        action = event.get("action") or event.get("signature") or event.get("alert_name") or "Splunk Alert"
        event_type = event.get("event_type") or f"splunk_{sourcetype or 'event'}"

        techniques = []
        if event.get("mitre_technique"):
            techniques.append(str(event.get("mitre_technique")))
        elif event.get("technique_id"):
            techniques.append(str(event.get("technique_id")))

        return NormalizedSecurityAlert(
            source_system="splunk",
            event_type=event_type,
            severity=severity,
            source_ip=src_ip,
            destination_ip=dest_ip,
            target_host=host,
            user=user,
            process=process,
            command_line=cmdline,
            title=f"Splunk: {action}",
            description=str(event.get("message") or event.get("description") or f"Alert from {source}"),
            mitre_techniques=techniques,
            raw_payload=payload,
        )

    @staticmethod
    def normalize_sentinel_alert(payload: Dict[str, Any]) -> NormalizedSecurityAlert:
        """Parse Microsoft Sentinel / Azure Monitor incident or alert webhook."""
        title = payload.get("IncidentTitle") or payload.get("AlertDisplayName") or payload.get("Title") or "Sentinel Incident"
        desc = payload.get("Description") or payload.get("IncidentUrl") or ""
        raw_sev = str(payload.get("Severity") or payload.get("AlertSeverity") or "Medium").lower()

        severity = "medium"
        if "crit" in raw_sev:
            severity = "critical"
        elif "high" in raw_sev:
            severity = "high"
        elif "low" in raw_sev or "informational" in raw_sev:
            severity = "low"

        src_ip = None
        user = None
        host = None

        # Extract structured Sentinel entities
        entities = payload.get("Entities") or []
        for ent in entities:
            ent_type = str(ent.get("Type") or ent.get("$id", "")).lower()
            if "ip" in ent_type and not src_ip:
                src_ip = ent.get("Address")
            elif "account" in ent_type and not user:
                user = ent.get("Name") or ent.get("UPNSuffix")
            elif ("host" in ent_type or "machine" in ent_type) and not host:
                host = ent.get("HostName") or ent.get("NetBiosName")

        tactics = payload.get("Tactics") or []
        techniques = payload.get("Techniques") or []

        return NormalizedSecurityAlert(
            source_system="sentinel",
            event_type=f"sentinel_{title.lower().replace(' ', '_')[:32]}",
            severity=severity,
            source_ip=src_ip,
            target_host=host or "azure-tenant-workload",
            user=user,
            title=title,
            description=desc,
            mitre_tactics=tactics if isinstance(tactics, list) else [str(tactics)],
            mitre_techniques=techniques if isinstance(techniques, list) else [str(techniques)],
            raw_payload=payload,
        )

    @staticmethod
    def normalize_crowdstrike_detection(payload: Dict[str, Any]) -> NormalizedSecurityAlert:
        """Parse CrowdStrike Falcon webhook detection event."""
        event = payload.get("event", payload)
        computer_name = event.get("ComputerName") or event.get("DeviceName") or "falcon-endpoint"
        user_name = event.get("UserName")
        cmdline = event.get("CommandLine")
        filename = event.get("FileName") or event.get("ParentCommandLine")
        tactic = event.get("Tactic")
        technique = event.get("Technique")

        raw_sev = str(event.get("SeverityName") or event.get("Severity") or "Medium").lower()
        severity = "medium"
        if "crit" in raw_sev:
            severity = "critical"
        elif "high" in raw_sev:
            severity = "high"
        elif "low" in raw_sev or "informational" in raw_sev:
            severity = "low"

        detect_name = event.get("DetectName") or event.get("DetectDescription") or "Falcon Endpoint Detection"

        return NormalizedSecurityAlert(
            source_system="crowdstrike",
            event_type="crowdstrike_edr_detection",
            severity=severity,
            target_host=computer_name,
            user=user_name,
            process=filename,
            command_line=cmdline,
            title=f"CrowdStrike: {detect_name}",
            description=str(event.get("DetectDescription") or f"Host {computer_name} triggered {tactic}/{technique}"),
            mitre_tactics=[tactic] if tactic else [],
            mitre_techniques=[technique] if technique else [],
            raw_payload=payload,
        )

    @staticmethod
    def normalize_generic_webhook(payload: Dict[str, Any]) -> NormalizedSecurityAlert:
        """Parse generic SIEM / Datadog / Elastic webhook."""
        title = payload.get("title") or payload.get("name") or payload.get("alert") or "Generic SIEM Alert"
        severity = str(payload.get("severity") or payload.get("level") or "medium").lower()
        if severity not in ("info", "low", "medium", "high", "critical"):
            severity = "medium"

        return NormalizedSecurityAlert(
            source_system="generic_siem",
            event_type=payload.get("event_type") or "siem_external_alert",
            severity=severity,
            source_ip=payload.get("source_ip") or payload.get("src_ip"),
            destination_ip=payload.get("destination_ip") or payload.get("dest_ip"),
            target_host=payload.get("target_host") or payload.get("host"),
            user=payload.get("user") or payload.get("username"),
            process=payload.get("process"),
            command_line=payload.get("command_line"),
            title=title,
            description=str(payload.get("description") or payload.get("message") or ""),
            mitre_techniques=payload.get("techniques", []),
            raw_payload=payload,
        )
