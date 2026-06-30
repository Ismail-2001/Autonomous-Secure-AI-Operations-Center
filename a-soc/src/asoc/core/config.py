"""Centralized application configuration using Pydantic BaseSettings.

All settings are loaded from environment variables with sensible defaults.
Secrets use SecretStr to prevent accidental logging.
"""

from typing import Optional

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """A-SOC application settings.

    Loaded from environment variables or .env file.
    Use validate_production() to check for missing critical config.
    """

    LLM_PROVIDER: str = "openai"
    LLM_MODEL: str = "gpt-4"
    OPENAI_API_KEY: Optional[SecretStr] = None
    ANTHROPIC_API_KEY: Optional[SecretStr] = None
    DEEPSEEK_API_KEY: Optional[SecretStr] = None
    LOCAL_LLM_MODEL: str = "llama3"
    LOCAL_LLM_BASE_URL: str = "http://localhost:11434"

    @field_validator("LLM_PROVIDER")
    @classmethod
    def validate_llm_provider(cls, v: str) -> str:
        allowed = {"openai", "anthropic", "ollama", "deepseek"}
        if v.lower() not in allowed:
            raise ValueError(f"LLM_PROVIDER must be one of {allowed}, got '{v}'")
        return v.lower()

    AWS_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: Optional[SecretStr] = None
    AWS_SECRET_ACCESS_KEY: Optional[SecretStr] = None

    GCP_PROJECT_ID: Optional[str] = None
    GCP_CREDENTIALS_PATH: Optional[str] = None

    AZURE_TENANT_ID: Optional[str] = None
    AZURE_CLIENT_ID: Optional[str] = None
    AZURE_CLIENT_SECRET: Optional[SecretStr] = None
    AZURE_SUBSCRIPTION_ID: Optional[str] = None

    DATABASE_URL: str = "postgresql+asyncpg://asoc_user:changeme123@localhost:5432/asoc_db"
    REDIS_URL: str = "redis://localhost:6379/0"

    PINECONE_API_KEY: Optional[SecretStr] = None
    PINECONE_ENVIRONMENT: Optional[str] = None
    PINECONE_INDEX_NAME: str = "asoc-incidents"

    OPA_URL: str = "http://localhost:8181"
    VAULT_ADDR: str = "http://localhost:8200"
    WS_API_TOKEN: Optional[SecretStr] = None
    HMAC_SECRET: Optional[SecretStr] = None
    JWT_PRIVATE_KEY: Optional[SecretStr] = None
    JWT_PUBLIC_KEY: Optional[SecretStr] = None

    SLACK_WEBHOOK_URL: Optional[str] = None
    TEAMS_WEBHOOK_URL: Optional[str] = None
    JIRA_URL: Optional[str] = None
    JIRA_EMAIL: Optional[str] = None
    JIRA_API_TOKEN: Optional[SecretStr] = None
    JIRA_PROJECT_KEY: Optional[str] = None

    CORS_ORIGINS: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @classmethod
    def validate_production(cls) -> list[str]:
        warnings: list[str] = []
        s = cls()
        if not s.OPENAI_API_KEY and not s.ANTHROPIC_API_KEY and not s.DEEPSEEK_API_KEY:
            warnings.append(
                "No LLM API key configured (OPENAI_API_KEY, ANTHROPIC_API_KEY, or DEEPSEEK_API_KEY required)"
            )
        if not s.HMAC_SECRET:
            warnings.append("HMAC_SECRET is not set — API auth will use WS_API_TOKEN")
        if not s.WS_API_TOKEN:
            warnings.append("WS_API_TOKEN is not set — WebSocket connections will be rejected")
        if not s.DATABASE_URL or "changeme" in s.DATABASE_URL:
            warnings.append("DATABASE_URL is using default credentials — set a strong password in .env")
        return warnings


settings = Settings()
