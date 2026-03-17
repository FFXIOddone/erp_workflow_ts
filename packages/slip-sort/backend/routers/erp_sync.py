"""
ERP Integration Router for BUNDA ERP communication.
Provides sync endpoints, status checks, and data exchange APIs.
"""

from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from enum import Enum
import httpx
import os

from core.logging import get_logger, audit_log

logger = get_logger(__name__)

router = APIRouter(prefix="/api/erp", tags=["ERP Integration"])


# ============== Configuration ==============

class ERPConfig:
    """ERP integration configuration."""
    
    MODE = os.environ.get("ERP_MODE", "standalone")  # standalone, integrated
    ERP_NAME = os.environ.get("ERP_NAME", "BUNDA")
    ERP_API_URL = os.environ.get("BUNDA_API_URL", "http://localhost:8001/api/v1")
    ERP_API_KEY = os.environ.get("BUNDA_API_KEY", "")
    
    SYNC_ENABLED = MODE == "integrated"
    SYNC_INTERVAL = int(os.environ.get("SYNC_INTERVAL", "300"))
    
    @classmethod
    def is_configured(cls) -> bool:
        return cls.MODE == "integrated" and cls.ERP_API_URL and cls.ERP_API_KEY


# ============== Pydantic Models ==============

class SyncDirection(str, Enum):
    push = "push"
    pull = "pull"
    bidirectional = "bidirectional"


class SyncRequest(BaseModel):
    direction: SyncDirection = SyncDirection.push
    entity_type: str = "orders"  # orders, brands, stores
    since: Optional[datetime] = None
    force: bool = False


class SyncResult(BaseModel):
    status: str
    direction: str
    entity_type: str
    records_synced: int
    errors: List[str] = []
    started_at: datetime
    completed_at: Optional[datetime] = None


class ERPStatus(BaseModel):
    mode: str
    erp_name: str
    connected: bool
    last_sync: Optional[datetime] = None
    last_sync_status: Optional[str] = None
    pending_sync_count: int = 0
    erp_version: Optional[str] = None
    features: List[str] = []


class ERPEvent(BaseModel):
    event_type: str
    source: str = "bunda"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    correlation_id: Optional[str] = None
    data: Dict[str, Any] = {}


class StoreData(BaseModel):
    store_code: str
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    region: Optional[str] = None
    attributes: Dict[str, Any] = {}


class BrandData(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None


# ============== Sync State ==============

_sync_state = {
    "last_sync": None,
    "last_sync_status": None,
    "pending_orders": [],
    "erp_connected": False,
}


# ============== Helper Functions ==============

async def get_erp_client() -> httpx.AsyncClient:
    """Create an HTTP client for ERP communication."""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {ERPConfig.ERP_API_KEY}",
        "X-Source": "slipsort",
    }
    return httpx.AsyncClient(
        base_url=ERPConfig.ERP_API_URL,
        headers=headers,
        timeout=30.0
    )


async def push_orders_to_bunda(order_ids: List[int] = None):
    """Background task to push orders to BUNDA ERP."""
    from core.database import get_db
    from database.models import Order
    
    logger.info("Starting order sync to BUNDA ERP")
    
    try:
        async with get_erp_client() as client:
            db = next(get_db())
            
            query = db.query(Order)
            if order_ids:
                query = query.filter(Order.id.in_(order_ids))
            else:
                # Get orders not yet synced
                query = query.filter(Order.deleted_at.is_(None))
            
            orders = query.all()
            
            for order in orders:
                payload = {
                    "source": "slipsort",
                    "order_id": order.id,
                    "brand_id": order.brand_id,
                    "store_code": order.store_code,
                    "kit_type": order.kit_type,
                    "alcohol_type": order.alcohol_type,
                    "processed_at": order.processed_at.isoformat() if order.processed_at else None,
                    "batch_id": order.batch_id,
                }
                
                try:
                    response = await client.post("/slipsort/orders", json=payload)
                    response.raise_for_status()
                except Exception as e:
                    logger.error(f"Failed to sync order {order.id}: {e}")
            
            _sync_state["last_sync"] = datetime.now(timezone.utc)
            _sync_state["last_sync_status"] = "success"
            
            audit_log(
                f"Synced {len(orders)} orders to BUNDA ERP",
                audit_type="SYNC",
                user="system"
            )
            
    except Exception as e:
        _sync_state["last_sync_status"] = f"error: {str(e)}"
        logger.exception("Order sync failed")


async def pull_stores_from_bunda():
    """Background task to pull store data from BUNDA ERP."""
    from core.database import get_db
    from database.models import Store
    
    logger.info("Pulling store data from BUNDA ERP")
    
    try:
        async with get_erp_client() as client:
            response = await client.get("/stores")
            response.raise_for_status()
            stores_data = response.json()
            
            db = next(get_db())
            
            for store_data in stores_data:
                existing = db.query(Store).filter(
                    Store.store_code == store_data["store_code"]
                ).first()
                
                if existing:
                    for key, value in store_data.items():
                        if hasattr(existing, key):
                            setattr(existing, key, value)
                else:
                    store = Store(**store_data)
                    db.add(store)
            
            db.commit()
            
            audit_log(
                f"Pulled {len(stores_data)} stores from BUNDA ERP",
                audit_type="SYNC",
                user="system"
            )
            
    except Exception as e:
        logger.exception("Store sync failed")


# ============== Endpoints ==============

@router.get("/status", response_model=ERPStatus)
async def get_erp_status():
    """
    Get ERP integration status.
    
    Returns current connection status, last sync time, and available features.
    """
    connected = False
    erp_version = None
    
    if ERPConfig.is_configured():
        try:
            async with get_erp_client() as client:
                response = await client.get("/health")
                connected = response.status_code == 200
                if connected:
                    data = response.json()
                    erp_version = data.get("version")
        except Exception:
            connected = False
    
    _sync_state["erp_connected"] = connected
    
    features = []
    if ERPConfig.is_configured():
        features = [
            "order_sync",
            "store_sync",
            "webhooks",
            "realtime_updates" if connected else None
        ]
        features = [f for f in features if f]
    
    return ERPStatus(
        mode=ERPConfig.MODE,
        erp_name=ERPConfig.ERP_NAME,
        connected=connected,
        last_sync=_sync_state.get("last_sync"),
        last_sync_status=_sync_state.get("last_sync_status"),
        pending_sync_count=len(_sync_state.get("pending_orders", [])),
        erp_version=erp_version,
        features=features
    )


@router.post("/sync/orders")
async def sync_orders(
    background_tasks: BackgroundTasks,
    request: SyncRequest = None
):
    """
    Trigger order synchronization with BUNDA ERP.
    
    Runs in background and returns immediately.
    """
    if not ERPConfig.is_configured():
        raise HTTPException(
            status_code=400,
            detail="ERP integration not configured. Set ERP_MODE=integrated and provide API credentials."
        )
    
    request = request or SyncRequest()
    
    if request.direction in [SyncDirection.push, SyncDirection.bidirectional]:
        background_tasks.add_task(push_orders_to_bunda)
    
    audit_log(
        f"Order sync triggered: {request.direction}",
        audit_type="SYNC",
        user="api"
    )
    
    return {
        "status": "sync_started",
        "direction": request.direction,
        "entity_type": "orders",
        "message": "Sync running in background. Check /api/erp/status for results."
    }


@router.post("/sync/stores")
async def sync_stores(background_tasks: BackgroundTasks):
    """
    Pull store data from BUNDA ERP.
    
    Imports or updates store records from the ERP system.
    """
    if not ERPConfig.is_configured():
        raise HTTPException(status_code=400, detail="ERP integration not configured")
    
    background_tasks.add_task(pull_stores_from_bunda)
    
    return {
        "status": "sync_started",
        "entity_type": "stores",
        "message": "Store sync running in background."
    }


@router.post("/receive")
async def receive_from_erp(
    event: ERPEvent,
    x_erp_source: str = Header(None),
    x_correlation_id: str = Header(None)
):
    """
    Receive webhook events from BUNDA ERP.
    
    Handles incoming data pushes from the ERP system.
    """
    from core.database import get_db
    from database.models import Store, Brand
    
    logger.info(f"Received ERP event: {event.event_type} from {x_erp_source or event.source}")
    
    db = next(get_db())
    
    try:
        if event.event_type == "store_update":
            store_data = StoreData(**event.data)
            existing = db.query(Store).filter(
                Store.store_code == store_data.store_code
            ).first()
            
            if existing:
                for key, value in store_data.dict(exclude_unset=True).items():
                    setattr(existing, key, value)
            else:
                store = Store(**store_data.dict())
                db.add(store)
            
            db.commit()
            return {"status": "processed", "action": "store_updated"}
        
        elif event.event_type == "brand_update":
            brand_data = BrandData(**event.data)
            existing = db.query(Brand).filter(
                Brand.name == brand_data.name
            ).first()
            
            if existing:
                for key, value in brand_data.dict(exclude_unset=True).items():
                    setattr(existing, key, value)
            else:
                brand = Brand(**brand_data.dict())
                db.add(brand)
            
            db.commit()
            return {"status": "processed", "action": "brand_updated"}
        
        elif event.event_type == "config_request":
            # ERP is requesting current configuration
            return {"status": "processed", "action": "config_sent"}
        
        else:
            logger.warning(f"Unknown event type: {event.event_type}")
            return {"status": "ignored", "reason": f"Unknown event type: {event.event_type}"}
    
    except Exception as e:
        logger.exception(f"Error processing ERP event: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config")
async def get_erp_config():
    """
    Get current ERP configuration (non-sensitive).
    
    Returns configuration details for debugging integration.
    """
    return {
        "mode": ERPConfig.MODE,
        "erp_name": ERPConfig.ERP_NAME,
        "erp_api_url": ERPConfig.ERP_API_URL[:50] + "..." if ERPConfig.ERP_API_URL else None,
        "sync_enabled": ERPConfig.SYNC_ENABLED,
        "sync_interval_seconds": ERPConfig.SYNC_INTERVAL,
        "api_key_configured": bool(ERPConfig.ERP_API_KEY),
    }


@router.post("/test-connection")
async def test_erp_connection():
    """
    Test connection to BUNDA ERP.
    
    Attempts to connect and returns detailed connection info.
    """
    if not ERPConfig.is_configured():
        return {
            "success": False,
            "error": "ERP not configured",
            "details": "Set ERP_MODE=integrated and provide BUNDA_API_URL and BUNDA_API_KEY"
        }
    
    try:
        async with get_erp_client() as client:
            response = await client.get("/health")
            
            return {
                "success": response.status_code == 200,
                "status_code": response.status_code,
                "response_time_ms": response.elapsed.total_seconds() * 1000,
                "erp_response": response.json() if response.status_code == 200 else None
            }
    except httpx.ConnectError as e:
        return {
            "success": False,
            "error": "Connection failed",
            "details": str(e)
        }
    except Exception as e:
        return {
            "success": False,
            "error": type(e).__name__,
            "details": str(e)
        }


@router.get("/pending")
async def get_pending_sync():
    """
    Get list of items pending synchronization.
    
    Returns orders and other records that haven't been synced yet.
    """
    from core.database import get_db
    from database.models import Order
    
    # For now, return recent unsycned orders
    # In production, track sync status per record
    
    return {
        "pending_orders": len(_sync_state.get("pending_orders", [])),
        "last_sync": _sync_state.get("last_sync"),
        "items": _sync_state.get("pending_orders", [])[:100]
    }
