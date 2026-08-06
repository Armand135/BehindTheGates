"""Central application settings, sourced from environment variables.

Kept as a single Pydantic settings object so every module (simulation,
optimization, prediction, copilot, api) reads configuration the same way,
which matters once real integrations (AIS, TOS, ERP, IoT) start supplying
their own connection settings alongside these.
"""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "postgresql+psycopg://portcopilot:portcopilot@localhost:5432/portcopilot"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # CORS
    backend_cors_origins: str = "http://localhost:3000"

    # Simulation
    simulation_tick_seconds: float = 1.0
    simulation_default_acceleration: float = 60.0

    # Copilot / LLM
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-5"

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.backend_cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
