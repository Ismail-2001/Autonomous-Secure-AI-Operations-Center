from typing import Optional

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # LLM Settings
    LLM_PROVIDER: str = "openai"
    OPENAI_API_KEY: Optional[SecretStr] = None
    ANTHROPIC_API_KEY: Optional[SecretStr] = None
    DEEPSEEK_API_KEY: Optional[SecretStr] = None

    # AWS Settings
    AWS_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: Optional[SecretStr] = None
    AWS_SECRET_ACCESS_KEY: Optional[SecretStr] = None

    # Database Settings
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/asoc"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Vector DB
    PINECONE_API_KEY: Optional[SecretStr] = None
    PINECONE_ENVIRONMENT: Optional[str] = None

    # Security
    OPA_URL: str = "http://localhost:8181"
    VAULT_ADDR: str = "http://localhost:8200"
    WS_API_TOKEN: Optional[SecretStr] = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
