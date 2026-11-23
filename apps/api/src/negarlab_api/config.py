from functools import lru_cache
from pathlib import Path
from tempfile import gettempdir

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, overridable with NEGARLAB_* environment variables."""

    model_config = SettingsConfigDict(env_prefix="NEGARLAB_", env_file=".env", extra="ignore")

    upload_max_bytes: int = 25 * 1024 * 1024
    image_max_pixels: int = 64_000_000
    working_cap_px: int = 2048
    ttl_minutes: int = 60
    storage_dir: Path = Path(gettempdir()) / "negarlab"
    cors_origins: list[str] = ["http://localhost:5173"]
    job_max_concurrency: int = 2
    job_step_delay_ms: int = 50


@lru_cache
def get_settings() -> Settings:
    return Settings()
