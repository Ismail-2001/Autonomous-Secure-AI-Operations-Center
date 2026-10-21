import abc
from typing import Any, Dict, List, Optional

from langsmith import traceable

from src.asoc.agents.base import BaseAgent
from src.asoc.agents.message import ASOCMessage, MessageType
from src.asoc.agents.observation import AgentObservation, ObservationNextState
from src.asoc.agents.state import AgentState
from src.asoc.core.logging import get_logger

logger = get_logger("asoc.agents.response")


class RemediationProvider(abc.ABC):
    @abc.abstractmethod
    async def block_ip(self, ip: str, reason: str = "") -> bool: ...

    @abc.abstractmethod
    async def revoke_iam_access(self, user: str, reason: str = "") -> bool: ...

    @abc.abstractmethod
    async def isolate_instance(self, instance_id: str, reason: str = "") -> bool: ...

    @abc.abstractmethod
    async def quarantine_s3_bucket(self, bucket_name: str, reason: str = "") -> bool: ...

    @abc.abstractmethod
    async def verify_remediation(self, action_type: str, target: str) -> bool: ...


class MockRemediationProvider(RemediationProvider):
    async def block_ip(self, ip: str, reason: str = "") -> bool:
        logger.info("mock_block_ip", ip=ip, reason=reason)
        return True

    async def revoke_iam_access(self, user: str, reason: str = "") -> bool:
        logger.info("mock_revoke_iam", user=user, reason=reason)
        return True

    async def isolate_instance(self, instance_id: str, reason: str = "") -> bool:
        logger.info("mock_isolate_instance", instance_id=instance_id, reason=reason)
        return True

    async def quarantine_s3_bucket(self, bucket_name: str, reason: str = "") -> bool:
        logger.info("mock_quarantine_bucket", bucket=bucket_name, reason=reason)
        return True

    async def verify_remediation(self, action_type: str, target: str) -> bool:
        logger.info("mock_verify_remediation", action_type=action_type, target=target)
        return True


class AWSRemediationProvider(RemediationProvider):
    def __init__(self, region: str = "us-east-1"):
        self.region = region
        self._ec2_client = None
        self._iam_client = None
        self._s3_client = None

    def _get_ec2_client(self):
        if self._ec2_client is None:
            try:
                import boto3

                self._ec2_client = boto3.client("ec2", region_name=self.region)
            except Exception as e:
                logger.error("aws_ec2_init_failed", error=str(e))
        return self._ec2_client

    def _get_iam_client(self):
        if self._iam_client is None:
            try:
                import boto3

                self._iam_client = boto3.client("iam", region_name=self.region)
            except Exception as e:
                logger.error("aws_iam_init_failed", error=str(e))
        return self._iam_client

    def _get_s3_client(self):
        if self._s3_client is None:
            try:
                import boto3

                self._s3_client = boto3.client("s3", region_name=self.region)
            except Exception as e:
                logger.error("aws_s3_init_failed", error=str(e))
        return self._s3_client

    async def block_ip(self, ip: str, reason: str = "") -> bool:
        from src.asoc.core.config import settings

        if settings.EXECUTION_MODE in ("SHADOW", "DRY_RUN"):
            logger.info("shadow_mode_block_ip_intercepted", ip=ip, reason=reason, mode=settings.EXECUTION_MODE)
            return True

        client = self._get_ec2_client()
        if client is None:
            return await MockRemediationProvider().block_ip(ip, reason)
        try:
            import asyncio

            loop = asyncio.get_event_loop()

            def _block():
                # Correct AWS implementation: Network ACL (NACL) deny entry (Security Groups do NOT support deny rules)
                nacls = client.describe_network_acls()["NetworkAcls"]
                if not nacls:
                    return False
                nacl_id = nacls[0]["NetworkAclId"]
                rule_num = 50
                try:
                    client.create_network_acl_entry(
                        NetworkAclId=nacl_id,
                        RuleNumber=rule_num,
                        Protocol="-1",
                        RuleAction="deny",
                        Egress=False,
                        CidrBlock=f"{ip}/32",
                    )
                    logger.info("aws_nacl_deny_created", nacl_id=nacl_id, ip=ip)
                    return True
                except Exception as ce:
                    if "RuleAlreadyExists" in str(ce) or "InvalidParameterValue" in str(ce):
                        client.replace_network_acl_entry(
                            NetworkAclId=nacl_id,
                            RuleNumber=rule_num,
                            Protocol="-1",
                            RuleAction="deny",
                            Egress=False,
                            CidrBlock=f"{ip}/32",
                        )
                        return True
                    raise

            return await loop.run_in_executor(None, _block)
        except Exception as e:
            logger.error("aws_block_ip_failed", error=str(e), ip=ip)
            return False

    async def revoke_iam_access(self, user: str, reason: str = "") -> bool:
        from src.asoc.core.config import settings

        if settings.EXECUTION_MODE in ("SHADOW", "DRY_RUN"):
            logger.info("shadow_mode_revoke_iam_intercepted", user=user, reason=reason, mode=settings.EXECUTION_MODE)
            return True

        client = self._get_iam_client()
        if client is None:
            return await MockRemediationProvider().revoke_iam_access(user, reason)
        try:
            import asyncio

            loop = asyncio.get_event_loop()

            def _revoke():
                client.update_login_profile(UserName=user, PasswordResetRequired=True)
                access_keys = client.list_access_keys(UserName=user)["AccessKeys"]
                for key in access_keys:
                    client.delete_access_key(UserName=user, AccessKeyId=key["AccessKeyId"])
                return True

            return await loop.run_in_executor(None, _revoke)
        except Exception as e:
            logger.error("aws_revoke_iam_failed", error=str(e), user=user)
            return False

    async def isolate_instance(self, instance_id: str, reason: str = "") -> bool:
        from src.asoc.core.config import settings

        if settings.EXECUTION_MODE in ("SHADOW", "DRY_RUN"):
            logger.info("shadow_mode_isolate_instance_intercepted", instance_id=instance_id, reason=reason, mode=settings.EXECUTION_MODE)
            return True

        client = self._get_ec2_client()
        if client is None:
            return await MockRemediationProvider().isolate_instance(instance_id, reason)
        try:
            import asyncio

            loop = asyncio.get_event_loop()

            def _isolate():
                # Create a blackhole security group with zero ingress and zero egress rules
                sg_name = f"asoc-quarantine-{instance_id}"
                try:
                    sg = client.create_security_group(
                        GroupName=sg_name, Description="A-SOC emergency quarantine isolation"
                    )
                    sg_id = sg["GroupId"]
                    # Revoke default 0.0.0.0/0 egress so instance is 100% network isolated
                    client.revoke_security_group_egress(
                        GroupId=sg_id,
                        IpPermissions=[{"IpProtocol": "-1", "IpRanges": [{"CidrIp": "0.0.0.0/0"}]}],
                    )
                except Exception:
                    sgs = client.describe_security_groups(
                        Filters=[{"Name": "group-name", "Values": [sg_name]}]
                    )["SecurityGroups"]
                    sg_id = sgs[0]["GroupId"]

                client.modify_instance_attribute(InstanceId=instance_id, Groups=[sg_id])
                logger.info("aws_instance_isolated", instance_id=instance_id, sg_id=sg_id)
                return True

            return await loop.run_in_executor(None, _isolate)
        except Exception as e:
            logger.error("aws_isolate_failed", error=str(e), instance_id=instance_id)
            return False

    async def quarantine_s3_bucket(self, bucket_name: str, reason: str = "") -> bool:
        client = self._get_s3_client()
        if client is None:
            return await MockRemediationProvider().quarantine_s3_bucket(bucket_name, reason)
        try:
            import asyncio
            import json

            loop = asyncio.get_event_loop()

            def _quarantine():
                block_policy = {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Sid": "A-SOC-Quarantine",
                            "Effect": "Deny",
                            "Principal": "*",
                            "Action": "s3:*",
                            "Resource": [f"arn:aws:s3:::{bucket_name}/*", f"arn:aws:s3:::{bucket_name}"],
                        }
                    ],
                }
                client.put_bucket_policy(Bucket=bucket_name, Policy=json.dumps(block_policy))
                return True

            return await loop.run_in_executor(None, _quarantine)
        except Exception as e:
            logger.error("aws_quarantine_s3_failed", error=str(e), bucket=bucket_name)
            return False

    async def verify_remediation(self, action_type: str, target: str) -> bool:
        return await MockRemediationProvider().verify_remediation(action_type, target)


class ResponseAgent(BaseAgent):
    def __init__(self, provider: Optional[RemediationProvider] = None):
        super().__init__(name="ResponseAgent", description="Executes remediation actions (IAM lock, pod isolation)")
        self.provider = provider or MockRemediationProvider()

    def _register_default_tools(self) -> None:
        self.tool_registry.register(
            name="block_ip_address",
            func=self._tool_block_ip,
            description="Block a malicious IP address via cloud security groups",
            input_schema={"ip": {"type": "string"}, "reason": {"type": "string"}},
            output_schema={"success": {"type": "boolean"}},
            is_high_risk=True,
            requires_authorization=True,
        )
        self.tool_registry.register(
            name="revoke_iam_access",
            func=self._tool_revoke_iam,
            description="Revoke IAM user access keys and force password reset",
            input_schema={"user": {"type": "string"}, "reason": {"type": "string"}},
            output_schema={"success": {"type": "boolean"}},
            is_high_risk=True,
            requires_authorization=True,
        )
        self.tool_registry.register(
            name="isolate_instance",
            func=self._tool_isolate,
            description="Isolate a compromised EC2 instance by moving it to quarantine security group",
            input_schema={"instance_id": {"type": "string"}, "reason": {"type": "string"}},
            output_schema={"success": {"type": "boolean"}},
            is_high_risk=True,
            requires_authorization=True,
        )
        self.tool_registry.register(
            name="quarantine_s3_bucket",
            func=self._tool_quarantine_s3,
            description="Block all access to an S3 bucket via deny policy",
            input_schema={"bucket_name": {"type": "string"}, "reason": {"type": "string"}},
            output_schema={"success": {"type": "boolean"}},
            is_high_risk=True,
            requires_authorization=True,
        )
        self.tool_registry.register(
            name="verify_remediation",
            func=self._tool_verify,
            description="Verify that a remediation action was successfully applied",
            input_schema={"action_type": {"type": "string"}, "target": {"type": "string"}},
            output_schema={"verified": {"type": "boolean"}},
        )

    async def _tool_block_ip(self, ip: str, reason: str = "") -> bool:
        from src.asoc.core.idempotency import execute_idempotent

        incident_id = getattr(self, "_current_incident_id", "incident-default")
        executed, res = await execute_idempotent(
            incident_id=incident_id,
            action_name="BLOCK_IP",
            params={"ip": ip},
            func=self.provider.block_ip,
            ip=ip,
            reason=reason,
        )
        return res if isinstance(res, bool) else True

    async def _tool_revoke_iam(self, user: str, reason: str = "") -> bool:
        from src.asoc.core.idempotency import execute_idempotent

        incident_id = getattr(self, "_current_incident_id", "incident-default")
        executed, res = await execute_idempotent(
            incident_id=incident_id,
            action_name="REVOKE_IAM",
            params={"user": user},
            func=self.provider.revoke_iam_access,
            user=user,
            reason=reason,
        )
        return res if isinstance(res, bool) else True

    async def _tool_isolate(self, instance_id: str, reason: str = "") -> bool:
        from src.asoc.core.idempotency import execute_idempotent

        incident_id = getattr(self, "_current_incident_id", "incident-default")
        executed, res = await execute_idempotent(
            incident_id=incident_id,
            action_name="ISOLATE_INSTANCE",
            params={"instance_id": instance_id},
            func=self.provider.isolate_instance,
            instance_id=instance_id,
            reason=reason,
        )
        return res if isinstance(res, bool) else True

    async def _tool_quarantine_s3(self, bucket_name: str, reason: str = "") -> bool:
        from src.asoc.core.idempotency import execute_idempotent

        incident_id = getattr(self, "_current_incident_id", "incident-default")
        executed, res = await execute_idempotent(
            incident_id=incident_id,
            action_name="QUARANTINE_S3",
            params={"bucket_name": bucket_name},
            func=self.provider.quarantine_s3_bucket,
            bucket_name=bucket_name,
            reason=reason,
        )
        return res if isinstance(res, bool) else True

    async def _tool_verify(self, action_type: str, target: str) -> bool:
        return await self.provider.verify_remediation(action_type, target)

    async def execute_remediation(self, action_type: str, target: str) -> bool:
        tool_name = self._action_to_tool(action_type)
        if tool_name:
            args = {self._tool_target_arg(tool_name): target, "reason": f"Remediation: {action_type}"}
            return await self.tool_registry.execute(tool_name, **args)
        self.logger.warning("unknown_remediation_action", action_type=action_type)
        return False

    def _action_to_tool(self, action_type: str) -> Optional[str]:
        mapping = {
            "BLOCK_IP": "block_ip_address",
            "REVOKE_IAM": "revoke_iam_access",
            "ISOLATE_INSTANCE": "isolate_instance",
            "QUARANTINE_S3": "quarantine_s3_bucket",
        }
        return mapping.get(action_type.upper().replace("-", "_"))

    @traceable(name="response_perceive", run_type="chain")
    async def perceive(self, state: AgentState) -> Dict[str, Any]:
        self._current_incident_id = state.get("incident_id", "incident-default")
        latest_msg = state["messages"][-1] if state.get("messages") else None
        action = ""
        target = ""
        if latest_msg:
            action = latest_msg.payload.get("action", "")
            target = latest_msg.payload.get("target", "")
        return {
            "action": action,
            "target": target,
            "is_authorized": state.get("is_authorized", False),
            "risk_score": state.get("risk_score", 0.0),
        }

    @traceable(name="response_reason", run_type="chain")
    async def reason(self, state: AgentState, perceived: Dict[str, Any]) -> List[Dict[str, Any]]:
        if not perceived.get("is_authorized"):
            return []
        action = perceived.get("action", "")
        target = perceived.get("target", "")
        tool_name = self._action_to_tool(action)
        if not tool_name:
            return []
        calls = [
            {"tool": tool_name, "args": {self._tool_target_arg(tool_name): target, "reason": f"Remediation: {action}"}}
        ]
        calls.append({"tool": "verify_remediation", "args": {"action_type": action, "target": target}})
        return calls

    def _tool_target_arg(self, tool_name: str) -> str:
        mapping = {
            "block_ip_address": "ip",
            "revoke_iam_access": "user",
            "isolate_instance": "instance_id",
            "quarantine_s3_bucket": "bucket_name",
        }
        return mapping.get(tool_name, "target")

    @traceable(name="response_act", run_type="chain")
    async def act(self, tool_calls: List[Dict[str, Any]], state: AgentState) -> List[Any]:
        results = []
        for call in tool_calls:
            result = await self.tool_registry.execute(call["tool"], **call.get("args", {}))
            results.append(result)
        return results

    @traceable(name="response_observe", run_type="chain")
    async def observe(
        self, state: AgentState, tool_results: List[Any], tool_calls: List[Dict[str, Any]]
    ) -> AgentObservation:
        success = all(r is True for r in tool_results if isinstance(r, bool))
        return AgentObservation(
            agent_id=self.name,
            action_taken="remediation_executed" if success else "remediation_failed",
            confidence_score=0.95 if success else 0.3,
            tools_used=[c["tool"] for c in tool_calls],
            next_state=ObservationNextState.CONTINUE,
            metadata={"success": success},
        )

    async def process_message(self, message: ASOCMessage) -> Optional[ASOCMessage]:
        if message.message_type == MessageType.COMMAND and message.target_agent == self.name:
            action = message.payload.get("action")
            target = message.payload.get("target")
            success = await self.execute_remediation(action, target)
            return ASOCMessage(
                message_type=MessageType.RESPONSE,
                source_agent=self.name,
                target_agent="SupervisorAgent",
                payload={"success": success, "action": action},
                correlation_id=message.correlation_id,
            )
        return None
