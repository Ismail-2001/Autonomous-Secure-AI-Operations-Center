"""Configuration validator for production readiness.

Checks all required settings before deployment.
"""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class ValidationResult:
    """Result of a configuration validation check."""

    name: str
    passed: bool
    message: str
    severity: str = "error"  # error, warning, info


@dataclass
class ValidationReport:
    """Complete validation report with all checks."""

    results: List[ValidationResult] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return all(r.passed for r in self.results if r.severity == "error")

    @property
    def error_count(self) -> int:
        return sum(1 for r in self.results if not r.passed and r.severity == "error")

    @property
    def warning_count(self) -> int:
        return sum(1 for r in self.results if not r.passed and r.severity == "warning")

    def summary(self) -> str:
        lines = []
        for r in self.results:
            status = "PASS" if r.passed else "FAIL"
            lines.append(f"  [{status}] {r.name}: {r.message}")
        return "\n".join(lines)


class ConfigValidator:
    """Validates application configuration for production readiness."""

    def validate_database_url(self, url: str) -> ValidationResult:
        if not url:
            return ValidationResult("database_url", False, "DATABASE_URL is not set")
        if "changeme" in url:
            return ValidationResult("database_url", False, "DATABASE_URL contains default credentials", "warning")
        if "localhost" in url:
            return ValidationResult("database_url", False, "DATABASE_URL points to localhost", "warning")
        return ValidationResult("database_url", True, "Database URL configured")

    def validate_secrets(self, **secrets: Optional[str]) -> ValidationReport:
        report = ValidationReport()
        for name, value in secrets.items():
            if not value:
                report.results.append(
                    ValidationResult(name, False, f"{name} is not set", "warning")
                )
            else:
                report.results.append(
                    ValidationResult(name, True, f"{name} is configured")
                )
        return report

    def validate_opa(self, url: str) -> ValidationResult:
        if not url:
            return ValidationResult("opa_url", False, "OPA_URL is not set")
        return ValidationResult("opa_url", True, f"OPA configured at {url}")

    def validate_cors(self, origins: str) -> ValidationResult:
        if not origins:
            return ValidationResult("cors_origins", False, "CORS_ORIGINS is not set")
        if "*" in origins:
            return ValidationResult("cors_origins", False, "CORS allows all origins", "warning")
        return ValidationResult("cors_origins", True, "CORS configured")

    def run_all(
        self,
        database_url: str = "",
        opa_url: str = "",
        cors_origins: str = "",
        **secrets: Optional[str],
    ) -> ValidationReport:
        report = ValidationReport()
        report.results.append(self.validate_database_url(database_url))
        report.results.append(self.validate_opa(opa_url))
        report.results.append(self.validate_cors(cors_origins))
        secret_report = self.validate_secrets(**secrets)
        report.results.extend(secret_report.results)
        return report
