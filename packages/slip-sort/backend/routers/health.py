"""
Health check endpoints for monitoring and diagnostics.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db

router = APIRouter()


@router.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.app_version,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/health/detailed")
async def detailed_health_check(db: Session = Depends(get_db)):
    """
    Detailed health check with database connectivity and disk space.
    """
    health_status = {
        "status": "healthy",
        "version": settings.app_version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": {}
    }

    # Database check
    try:
        db.execute(text("SELECT 1"))
        health_status["checks"]["database"] = {
            "status": "healthy",
            "type": "sqlite"
        }
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["checks"]["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }

    # Upload directory check
    try:
        upload_exists = settings.upload_dir.exists()
        upload_writable = settings.upload_dir.is_dir()
        health_status["checks"]["upload_dir"] = {
            "status": "healthy" if upload_exists and upload_writable else "warning",
            "path": str(settings.upload_dir),
            "exists": upload_exists
        }
    except Exception as e:
        health_status["checks"]["upload_dir"] = {
            "status": "error",
            "error": str(e)
        }

    # Output directory check
    try:
        output_exists = settings.output_dir.exists()
        health_status["checks"]["output_dir"] = {
            "status": "healthy" if output_exists else "warning",
            "path": str(settings.output_dir),
            "exists": output_exists
        }
    except Exception as e:
        health_status["checks"]["output_dir"] = {
            "status": "error",
            "error": str(e)
        }

    return health_status
