"""
API Routers for Packing Slip Manager.
Each module handles a specific domain of the application.
"""

from fastapi import APIRouter

from .brands import router as brands_router
from .config import router as config_router
from .health import router as health_router
from .orders import router as orders_router
from .reports import router as reports_router
from .batches import router as batches_router

# Aggregate all routers
api_router = APIRouter()

# Include domain routers
api_router.include_router(health_router, tags=["Health"])
api_router.include_router(brands_router, prefix="/brands", tags=["Brands"])
api_router.include_router(config_router, tags=["Configuration"])
api_router.include_router(orders_router)  # Has its own prefix
api_router.include_router(reports_router)  # Has its own prefix
api_router.include_router(batches_router)  # Has its own prefix

__all__ = ["api_router"]
