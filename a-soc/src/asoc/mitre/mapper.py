from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


@dataclass(frozen=True)
class MitreTechnique:
    id: str
    name: str
    tactic: str
    description: str = ""


class MitreMapper:
    CLOUD_EVENT_MAP: Dict[str, Tuple[str, str, str, str]] = {
        "ConsoleLogin": ("T1078", "Valid Accounts", "Initial Access", "Legitimate credentials used to access console"),
        "CreateUser": ("T1136", "Create Account", "Persistence", "Adversary may create an account to maintain access"),
        "CreateAccessKey": ("T1098", "Account Manipulation", "Persistence", "Adversary may manipulate accounts to maintain access"),
        "AssumeRole": ("T1524", "Cloud Infrastructure Discovery", "Discovery", "Adversary may assume a role to discover cloud resources"),
        "AttachRolePolicy": ("T1098", "Account Manipulation", "Privilege Escalation", "Adversary may attach policies to escalate privileges"),
        "PutRolePolicy": ("T1098", "Account Manipulation", "Privilege Escalation", "Adversary may modify role policies"),
        "CreatePolicy": ("T1098", "Account Manipulation", "Privilege Escalation", "Custom policy creation for privilege escalation"),
        "UpdateAssumeRolePolicy": ("T1524", "Cloud Infrastructure Discovery", "Privilege Escalation", "Modifying trust policies for cross-account access"),
        "DeleteTrail": ("T1562", "Impair Defenses", "Defense Evasion", "Disabling CloudTrail logging to evade detection"),
        "StopLogging": ("T1562", "Impair Defenses", "Defense Evasion", "Stopping CloudTrail logging to hide activity"),
        "UpdateTrail": ("T1562", "Impair Defenses", "Defense Evasion", "Modifying trail configuration to evade detection"),
        "DeleteFlowLogs": ("T1562", "Impair Defenses", "Defense Evasion", "Removing VPC flow logs to hide network activity"),
        "DisableAlarm": ("T1562", "Impair Defenses", "Defense Evasion", "Disabling CloudWatch alarms to avoid detection"),
        "PutBucketPolicy": ("T1525", "Cloud Service Discovery", "Defense Evasion", "Modifying bucket policies for data access"),
        "GetSecretValue": ("T1552", "Unsecured Credentials", "Credential Access", "Accessing secrets stored in Secrets Manager"),
        "ListSecrets": ("T1552", "Unsecured Credentials", "Credential Access", "Enumerating secrets for credential access"),
        "Decrypt": ("T1552", "Unsecured Credentials", "Credential Access", "Decrypting data with KMS keys"),
        "DescribeInstances": ("T1526", "Cloud Service Discovery", "Discovery", "Enumerating EC2 instances for targeting"),
        "DescribeSecurityGroups": ("T1526", "Cloud Service Discovery", "Discovery", "Mapping security group rules for network access"),
        "ListBuckets": ("T1526", "Cloud Service Discovery", "Discovery", "Enumerating S3 buckets for data targeting"),
        "ListRoles": ("T1526", "Cloud Service Discovery", "Discovery", "Enumerating IAM roles for privilege escalation"),
        "GetCallerIdentity": ("T1526", "Cloud Service Discovery", "Discovery", "Identifying current user/role context"),
        "GetObject": ("T1530", "Data from Cloud Storage", "Exfiltration", "Accessing data stored in cloud object storage"),
        "CopyObject": ("T1530", "Data from Cloud Storage", "Exfiltration", "Copying data between storage locations"),
        "UploadPart": ("T1530", "Data from Cloud Storage", "Exfiltration", "Multipart upload for data exfiltration"),
        "DeleteBucket": ("T1485", "Data Destruction", "Impact", "Deleting S3 buckets to destroy data"),
        "TerminateInstances": ("T1485", "Data Destruction", "Impact", "Terminating EC2 instances for service disruption"),
        "DeleteDBInstance": ("T1485", "Data Destruction", "Impact", "Deleting RDS instances to destroy data"),
        "ModifyInstanceAttribute": ("T1496", "Resource Hijacking", "Impact", "Modifying instance attributes for resource hijacking"),
        "RunInstances": ("T1496", "Resource Hijacking", "Impact", "Launching instances for cryptomining or resource abuse"),
        "CreateLoginProfile": ("T1098", "Account Manipulation", "Persistence", "Creating console password for IAM user"),
        "UpdateLoginProfile": ("T1098", "Account Manipulation", "Persistence", "Modifying IAM user console access"),
        "ModifyNetworkInterfaceAttribute": ("T1021", "Remote Services", "Lateral Movement", "Modifying ENI for network pivoting"),
        "AuthorizeSecurityGroupIngress": ("T1021", "Remote Services", "Lateral Movement", "Opening security groups for lateral movement"),
        "RevokeSecurityGroupIngress": ("T1021", "Remote Services", "Lateral Movement", "Removing ingress rules to hinder forensics"),
    }

    GENERIC_PATTERNS: List[Tuple[str, Tuple[str, str, str, str]]] = [
        ("brute force", ("T1110", "Brute Force", "Credential Access", "Repeated login attempts to compromise credentials")),
        ("ransomware", ("T1486", "Data Encrypted for Impact", "Impact", "Data encryption for extortion")),
        ("phishing", ("T1566", "Phishing", "Initial Access", "Social engineering to gain initial access")),
        ("malware", ("T1204", "User Execution", "Execution", "Malicious code execution on target")),
        ("privilege escalation", ("T1068", "Exploitation for Privilege Escalation", "Privilege Escalation", "Exploiting vulnerability to gain elevated privileges")),
        ("lateral movement", ("T1021", "Remote Services", "Lateral Movement", "Moving between systems in the network")),
        ("command and control", ("T1071", "Application Layer Protocol", "Command and Control", "C2 communication over application protocols")),
        ("data exfiltration", ("T1048", "Exfiltration Over Alternative Protocol", "Exfiltration", "Data exfiltration over non-standard channels")),
        ("cryptominer", ("T1496", "Resource Hijacking", "Impact", "Cryptocurrency mining via compromised resources")),
        ("backdoor", ("T1509", "Traffic Duplication", "Exfiltration", "Establishing persistence via backdoor access")),
    ]

    def map_event(self, event_data: dict) -> Optional[MitreTechnique]:
        event_name = ""
        if isinstance(event_data, dict):
            event_name = event_data.get("eventName", event_data.get("event_name", ""))
            event_name = event_data.get("EventName", event_name)

        if not event_name:
            description = str(event_data).lower()
            for pattern, technique in self.GENERIC_PATTERNS:
                if pattern in description:
                    return MitreTechnique(*technique)
            return None

        return self.map_by_event_name(event_name)

    def map_by_event_name(self, event_name: str) -> Optional[MitreTechnique]:
        mapping = self.CLOUD_EVENT_MAP.get(event_name)
        if mapping:
            return MitreTechnique(*mapping)

        for pattern, technique in self.GENERIC_PATTERNS:
            if pattern.replace(" ", "").lower() in event_name.lower().replace(" ", ""):
                return MitreTechnique(*technique)

        return None

    def get_all_techniques(self) -> List[MitreTechnique]:
        seen: Dict[str, MitreTechnique] = {}
        for tid, name, tactic, desc in self.CLOUD_EVENT_MAP.values():
            key = f"{tid}:{tactic}"
            if key not in seen:
                seen[key] = MitreTechnique(id=tid, name=name, tactic=tactic, description=desc)
        for _, technique in self.GENERIC_PATTERNS:
            tid, name, tactic, desc = technique
            key = f"{tid}:{tactic}"
            if key not in seen:
                seen[key] = MitreTechnique(id=tid, name=name, tactic=tactic, description=desc)
        return list(seen.values())

    def group_by_tactic(self) -> Dict[str, List[MitreTechnique]]:
        grouped: Dict[str, List[MitreTechnique]] = {}
        for technique in self.get_all_techniques():
            grouped.setdefault(technique.tactic, []).append(technique)
        return grouped


mitre_mapper = MitreMapper()
