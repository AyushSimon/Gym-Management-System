"""Application configuration, read from environment variables with safe defaults."""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

try:  # python-dotenv is optional at runtime
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except ImportError:  # pragma: no cover
    pass

BASE_DIR = Path(__file__).resolve().parent


def _csv(value: str) -> tuple[str, ...]:
    return tuple(item.strip() for item in value.split(",") if item.strip())


def _bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_name: str
    version: str
    data_dir: Path
    cors_origins: tuple[str, ...]
    expiry_warning_days: int
    seed_demo_data: bool


@lru_cache
def get_settings() -> Settings:
    data_dir = Path(os.environ.get("GYM_DATA_DIR") or BASE_DIR / "data").expanduser()
    return Settings(
        app_name="Gym Management System API",
        version="1.0.0",
        data_dir=data_dir,
        cors_origins=_csv(
            os.environ.get(
                "GYM_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
            )
        ),
        expiry_warning_days=int(os.environ.get("GYM_EXPIRY_WARNING_DAYS", "7")),
        seed_demo_data=_bool(os.environ.get("GYM_SEED_DEMO_DATA"), True),
    )
