import pytest

from core.mitre.mapper import MitreMapper, MitreTechnique, mitre_mapper


class TestMitreTechnique:
    def test_dataclass_fields(self):
        t = MitreTechnique(id="T1078", name="Valid Accounts", tactic="Initial Access", description="Test")
        assert t.id == "T1078"
        assert t.name == "Valid Accounts"
        assert t.tactic == "Initial Access"
        assert t.description == "Test"

    def test_dataclass_frozen(self):
        t = MitreTechnique(id="T1078", name="Valid Accounts", tactic="Initial Access")
        with pytest.raises(AttributeError):
            t.id = "T9999"

    def test_default_description_empty(self):
        t = MitreTechnique(id="T1078", name="Valid Accounts", tactic="Initial Access")
        assert t.description == ""


class TestMitreMapper:
    def setup_method(self):
        self.mapper = MitreMapper()

    def test_map_console_login(self):
        result = self.mapper.map_by_event_name("ConsoleLogin")
        assert result is not None
        assert result.id == "T1078"
        assert result.tactic == "Initial Access"

    def test_map_delete_trail(self):
        result = self.mapper.map_by_event_name("DeleteTrail")
        assert result is not None
        assert result.id == "T1562"
        assert result.tactic == "Defense Evasion"

    def test_map_get_object(self):
        result = self.mapper.map_by_event_name("GetObject")
        assert result is not None
        assert result.id == "T1530"
        assert result.tactic == "Exfiltration"

    def test_map_terminate_instances(self):
        result = self.mapper.map_by_event_name("TerminateInstances")
        assert result is not None
        assert result.id == "T1485"
        assert result.tactic == "Impact"

    def test_map_authorize_security_group(self):
        result = self.mapper.map_by_event_name("AuthorizeSecurityGroupIngress")
        assert result is not None
        assert result.id == "T1021"
        assert result.tactic == "Lateral Movement"

    def test_map_unknown_event_returns_none(self):
        result = self.mapper.map_by_event_name("NonExistentEvent12345")
        assert result is None

    def test_map_empty_event_name_returns_none(self):
        result = self.mapper.map_by_event_name("")
        assert result is None

    def test_map_event_using_event_data_dict(self):
        result = self.mapper.map_event({"eventName": "ConsoleLogin", "sourceIP": "1.2.3.4"})
        assert result is not None
        assert result.id == "T1078"

    def test_map_event_using_event_name_key(self):
        result = self.mapper.map_event({"event_name": "DeleteBucket"})
        assert result is not None
        assert result.id == "T1485"

    def test_map_event_with_capitalized_key(self):
        result = self.mapper.map_event({"EventName": "RunInstances"})
        assert result is not None
        assert result.id == "T1496"

    def test_map_event_with_generic_description(self):
        result = self.mapper.map_event({"message": "ransomware detected on host"})
        assert result is not None
        assert result.id == "T1486"

    def test_map_event_brute_force_description(self):
        result = self.mapper.map_event({"message": "brute force login attempt from 10.0.0.1"})
        assert result is not None
        assert result.id == "T1110"

    def test_map_event_empty_dict_returns_none(self):
        result = self.mapper.map_event({})
        assert result is None

    def test_map_event_non_dict_returns_none(self):
        result = self.mapper.map_event("just a string, not useful")
        assert result is None

    def test_get_all_techniques_deduplicated(self):
        techniques = self.mapper.get_all_techniques()
        pairs = [(t.id, t.tactic) for t in techniques]
        assert len(pairs) == len(set(pairs))

    def test_get_all_techniques_at_least_10(self):
        techniques = self.mapper.get_all_techniques()
        assert len(techniques) >= 10

    def test_group_by_tactic(self):
        grouped = self.mapper.group_by_tactic()
        assert "Initial Access" in grouped
        assert "Impact" in grouped
        assert "Privilege Escalation" in grouped

    def test_group_by_tactic_all_techniques_accounted(self):
        grouped = self.mapper.group_by_tactic()
        all_from_groups = sum(len(v) for v in grouped.values())
        all_unique = len(self.mapper.get_all_techniques())
        assert all_from_groups == all_unique

    def test_map_put_role_policy(self):
        result = self.mapper.map_by_event_name("PutRolePolicy")
        assert result is not None
        assert result.id == "T1098"

    def test_map_stop_logging(self):
        result = self.mapper.map_by_event_name("StopLogging")
        assert result is not None
        assert result.id == "T1562"

    def test_map_get_secret_value(self):
        result = self.mapper.map_by_event_name("GetSecretValue")
        assert result is not None
        assert result.id == "T1552"

    def test_map_describe_instances(self):
        result = self.mapper.map_by_event_name("DescribeInstances")
        assert result is not None
        assert result.id == "T1526"

    def test_singleton_instance(self):
        assert mitre_mapper is not None
        assert isinstance(mitre_mapper, MitreMapper)

    def test_singleton_has_all_techniques(self):
        assert len(mitre_mapper.get_all_techniques()) > 0
