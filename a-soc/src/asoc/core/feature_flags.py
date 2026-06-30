"""Feature flags for gradual rollout of new capabilities.

Allows enabling/disabling features without code changes.
"""

import os
from dataclasses import dataclass, field
from typing import Dict


@dataclass(frozen=True)
class FeatureFlags:
    """Immutable feature flag configuration.

    All flags default to False for safe rollout.
    Set via environment variables: FEATURE_<NAME>=true
    """

    # Agent features
    enable_llm_analysis: bool = False
    enable_vector_search: bool = False
    enable_auto_response: bool = False
    enable_opa_enforcement: bool = False

    # Dashboard features
    enable_real_time_feed: bool = True
    enable_blast_radius_viz: bool = True
    enable_threat_hunting: bool = True
    enable_approval_workflow: bool = True

    # Infrastructure features
    enable_rate_limiting: bool = True
    enable_audit_trail: bool = True
    enable_prompt_injection_detection: bool = True
    enable_metrics_export: bool = False

    # Experimental
    enable_multi_model: bool = False
    enable_federated_learning: bool = False

    _flags: Dict[str, bool] = field(default_factory=dict)

    @classmethod
    def from_env(cls) -> "FeatureFlags":
        """Load feature flags from environment variables."""
        kwargs = {}
        for f in cls.__dataclass_fields__:
            if f.startswith("_"):
                continue
            env_key = f"FEATURE_{f.upper()}"
            val = os.getenv(env_key, "false").lower()
            kwargs[f] = val in ("true", "1", "yes", "on")
        return cls(**kwargs)

    def is_enabled(self, flag_name: str) -> bool:
        """Check if a feature flag is enabled."""
        return getattr(self, flag_name, False)

    def as_dict(self) -> Dict[str, bool]:
        """Export all flags as a dictionary."""
        return {
            f: getattr(self, f)
            for f in self.__dataclass_fields__
            if not f.startswith("_")
        }


# Singleton
_feature_flags = FeatureFlags.from_env()


def get_feature_flags() -> FeatureFlags:
    return _feature_flags
