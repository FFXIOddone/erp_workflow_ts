"""
Core module for Packing Slip Manager.
Contains shared utilities, database management, and configuration.
"""

from .config import settings
from .database import Session, get_db, init_database

__all__ = ["get_db", "init_database", "Session", "settings"]
