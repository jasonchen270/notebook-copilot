from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    jwt_secret: str = Field(default="dev-only-secret-change-me", alias="JWT_SECRET")
    jwt_algorithm: str = "HS256"
    jwt_ttl_minutes: int = 60 * 24 * 7

    database_url: str = Field(
        default="postgresql+asyncpg://copilot:copilot@localhost:5432/copilot",
        alias="DATABASE_URL",
    )
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    upload_dir: str = Field(default="./uploads", alias="UPLOAD_DIR")
    cors_origins: List[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    llm_model: str = "claude-sonnet-4-6"
    llm_max_tokens: int = 4096

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_cors(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
