from typing import Optional

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # LLM Settings
    LLM_PROVIDER: str = "openai"
    LLM_MODEL: str = "gpt-4"
    OPENAI_API_KEY: Optional[SecretStr] = None
    ANTHROPIC_API_KEY: Optional[SecretStr] = None
    DEEPSEEK_API_KEY: Optional[SecretStr] = None
    LOCAL_LLM_MODEL: str = "llama3"
    LOCAL_LLM_BASE_URL: str = "http://localhost:11434"

    # AWS Settings
    AWS_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: Optional[SecretStr] = None
    AWS_SECRET_ACCESS_KEY: Optional[SecretStr] = None

    # GCP Settings
    GCP_PROJECT_ID: Optional[str] = None
    GCP_CREDENTIALS_PATH: Optional[str] = None

    # Azure Settings
    AZURE_TENANT_ID: Optional[str] = None
    AZURE_CLIENT_ID: Optional[str] = None
    AZURE_CLIENT_SECRET: Optional[SecretStr] = None
    AZURE_SUBSCRIPTION_ID: Optional[str] = None

    # Database Settings
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/asoc"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Vector DB
    PINECONE_API_KEY: Optional[SecretStr] = None
    PINECONE_ENVIRONMENT: Optional[str] = None
    PINECONE_INDEX_NAME: str = "asoc-incidents"

    # Security
    OPA_URL: str = "http://localhost:8181"
    VAULT_ADDR: str = "http://localhost:8200"
    WS_API_TOKEN: Optional[SecretStr] = None

    # Notifications
    SLACK_WEBHOOK_URL: Optional[str] = None
    TEAMS_WEBHOOK_URL: Optional[str] = None
    JIRA_URL: Optional[str] = None
    JIRA_EMAIL: Optional[str] = None
    JIRA_API_TOKEN: Optional[SecretStr] = None
    JIRA_PROJECT_KEY: Optional[str] = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
