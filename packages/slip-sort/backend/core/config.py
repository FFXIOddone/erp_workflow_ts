"""
Application configuration settings.
Uses environment variables with sensible defaults.
"""

import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Settings:
    """Application settings with environment variable overrides."""

    # Application
    app_name: str = "Packing Slip Manager"
    app_version: str = "2.0.0"
    debug: bool = False

    # Database
    db_path: str = "packing_slip_manager.db"

    # File paths
    upload_dir: Path = field(default_factory=lambda: Path("uploads"))
    output_dir: Path = field(default_factory=lambda: Path("outputs"))

    # CORS - allow localhost and LAN subnet
    cors_origins: list[str] = field(default_factory=lambda: [
        "http://localhost:5185",
        "http://localhost:3000",
        "http://127.0.0.1:5185"
    ])
    cors_origin_regex: str = r"^https?://192\.168\.254\.\d{1,3}(:\d+)?$"

    # API
    api_prefix: str = "/api/v1"

    def __post_init__(self):
        """Load settings from environment variables."""
        self.db_path = os.environ.get("DB_PATH", self.db_path)
        self.debug = os.environ.get("DEBUG", "").lower() in ("1", "true", "yes")

        # Ensure directories exist
        self.upload_dir.mkdir(exist_ok=True)
        self.output_dir.mkdir(exist_ok=True)


# Singleton settings instance
settings = Settings()
