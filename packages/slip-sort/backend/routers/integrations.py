"""
Integration Router - External system integration and automation.

Provides:
- Webhook support for external systems
- API key management
- File watcher configuration for auto-processing
- System status and health
"""

import secrets
import hashlib
import hmac as hmac_mod
import json as json_mod
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query, Depends, Header, Request
from pydantic import BaseModel, HttpUrl
from sqlalchemy.orm import Session

from core.database import get_db

router = APIRouter(prefix="/api/integrations", tags=["Integrations"])


# ============== Pydantic Models ==============

class WebhookCreate(BaseModel):
    """Create a new webhook subscription."""
    name: str
    url: str
    events: List[str]  # "batch.completed", "order.created", "error.occurred"
    secret: Optional[str] = None  # For signature verification
    headers: Optional[Dict[str, str]] = None


class WebhookResponse(BaseModel):
    """Webhook subscription response."""
    id: int
    name: str
    url: str
    events: List[str]
    is_active: bool
    created_at: datetime
    last_triggered: Optional[datetime]
    failure_count: int


class APIKeyCreate(BaseModel):
    """Create a new API key."""
    name: str
    description: Optional[str] = None
    permissions: List[str]  # "read", "write", "admin"
    expires_in_days: Optional[int] = None


class APIKeyResponse(BaseModel):
    """API key response (key only shown once on creation)."""
    id: int
    name: str
    key_prefix: str  # First 8 chars for identification
    permissions: List[str]
    is_active: bool
    created_at: datetime
    expires_at: Optional[datetime]
    last_used: Optional[datetime]


class FileWatcherConfig(BaseModel):
    """File watcher configuration."""
    id: int
    watch_path: str
    pattern: str  # Glob pattern like "*.pdf"
    brand_id: Optional[int]
    auto_process: bool
    move_processed: bool
    processed_path: Optional[str]
    is_active: bool


class FileWatcherCreate(BaseModel):
    """Create file watcher configuration."""
    watch_path: str
    pattern: str = "*.pdf"
    brand_id: Optional[int] = None
    auto_process: bool = True
    move_processed: bool = True
    processed_path: Optional[str] = None


# ============== In-Memory Storage (Demo) ==============

# Webhooks
webhooks: List[Dict[str, Any]] = []
webhook_logs: List[Dict[str, Any]] = []

# API Keys
api_keys: List[Dict[str, Any]] = []

# File Watchers
file_watchers: List[Dict[str, Any]] = []
watcher_logs: List[Dict[str, Any]] = []


# ============== Webhook Management ==============

@router.get("/webhooks")
async def list_webhooks():
    """List all webhook subscriptions."""
    return {
        "webhooks": webhooks,
        "available_events": [
            "batch.started",
            "batch.completed",
            "batch.error",
            "order.created",
            "order.updated",
            "order.deleted",
            "config.changed",
            "error.occurred"
        ]
    }


@router.post("/webhooks")
async def create_webhook(webhook: WebhookCreate):
    """Create a new webhook subscription."""
    # Validate URL
    if not webhook.url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")
    
    # Generate secret if not provided
    secret = webhook.secret or secrets.token_urlsafe(32)
    
    new_webhook = {
        "id": len(webhooks) + 1,
        "name": webhook.name,
        "url": webhook.url,
        "events": webhook.events,
        "secret": secret,
        "headers": webhook.headers or {},
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_triggered": None,
        "failure_count": 0
    }
    
    webhooks.append(new_webhook)
    
    # Return with secret (only shown once)
    return {
        "webhook": new_webhook,
        "message": "Webhook created. Save the secret - it won't be shown again."
    }


@router.get("/webhooks/{webhook_id}")
async def get_webhook(webhook_id: int):
    """Get webhook details."""
    for webhook in webhooks:
        if webhook["id"] == webhook_id:
            # Don't return the secret
            result = {k: v for k, v in webhook.items() if k != "secret"}
            return result
    
    raise HTTPException(status_code=404, detail="Webhook not found")


@router.put("/webhooks/{webhook_id}/toggle")
async def toggle_webhook(webhook_id: int):
    """Enable/disable a webhook."""
    for webhook in webhooks:
        if webhook["id"] == webhook_id:
            webhook["is_active"] = not webhook["is_active"]
            return {"success": True, "is_active": webhook["is_active"]}
    
    raise HTTPException(status_code=404, detail="Webhook not found")


@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: int):
    """Delete a webhook subscription."""
    global webhooks
    original_length = len(webhooks)
    webhooks = [w for w in webhooks if w["id"] != webhook_id]
    
    if len(webhooks) == original_length:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    return {"success": True}


@router.post("/webhooks/{webhook_id}/test")
async def test_webhook(webhook_id: int):
    """Send a test event to a webhook."""
    webhook = None
    for w in webhooks:
        if w["id"] == webhook_id:
            webhook = w
            break
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    # In production, this would actually send an HTTP request
    test_payload = {
        "event": "test",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message": "This is a test webhook event",
        "data": {
            "test": True
        }
    }
    
    # Log the test
    webhook_logs.append({
        "webhook_id": webhook_id,
        "event": "test",
        "payload": test_payload,
        "response_status": 200,  # Simulated
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "message": "Test webhook sent (simulated in development mode)",
        "payload": test_payload
    }


@router.get("/webhooks/logs")
async def get_webhook_logs(
    webhook_id: Optional[int] = None,
    limit: int = Query(50, le=500)
):
    """Get webhook delivery logs."""
    logs = webhook_logs
    
    if webhook_id:
        logs = [l for l in logs if l["webhook_id"] == webhook_id]
    
    return {
        "logs": logs[-limit:][::-1]  # Most recent first
    }


# ============== Internal Webhook Trigger Function ==============

async def trigger_webhooks(event: str, data: Dict[str, Any]):
    """
    Trigger all webhooks subscribed to an event.
    Called internally when events occur.
    """
    for webhook in webhooks:
        if not webhook["is_active"]:
            continue
        
        if event not in webhook["events"] and "*" not in webhook["events"]:
            continue
        
        payload = {
            "event": event,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data
        }
        
        # Create HMAC signature using the webhook secret
        payload_bytes = json_mod.dumps(payload, sort_keys=True).encode('utf-8')
        signature = hmac_mod.new(
            webhook["secret"].encode('utf-8'),
            payload_bytes,
            hashlib.sha256
        ).hexdigest()
        
        # In production, this would make an HTTP request
        # For now, just log it
        webhook_logs.append({
            "webhook_id": webhook["id"],
            "event": event,
            "payload": payload,
            "signature": signature[:16] + "...",
            "status": "pending",  # Would be actual response status
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        webhook["last_triggered"] = datetime.now(timezone.utc).isoformat()


# ============== API Key Management ==============

def generate_api_key() -> str:
    """Generate a secure API key."""
    return f"psl_{secrets.token_urlsafe(32)}"


def hash_api_key(key: str) -> str:
    """Hash an API key for storage."""
    return hashlib.sha256(key.encode()).hexdigest()


@router.get("/api-keys")
async def list_api_keys():
    """List all API keys (without revealing the actual keys)."""
    return {
        "api_keys": [
            {
                "id": k["id"],
                "name": k["name"],
                "key_prefix": k["key_prefix"],
                "permissions": k["permissions"],
                "is_active": k["is_active"],
                "created_at": k["created_at"],
                "expires_at": k["expires_at"],
                "last_used": k["last_used"]
            }
            for k in api_keys
        ],
        "available_permissions": ["read", "write", "admin", "reports", "config"]
    }


@router.post("/api-keys")
async def create_api_key(key_data: APIKeyCreate):
    """
    Create a new API key.
    The full key is only returned once - save it securely!
    """
    # Generate key
    full_key = generate_api_key()
    key_hash = hash_api_key(full_key)
    
    # Calculate expiration
    expires_at = None
    if key_data.expires_in_days:
        expires_at = (datetime.now(timezone.utc) + timedelta(days=key_data.expires_in_days)).isoformat()
    
    new_key = {
        "id": len(api_keys) + 1,
        "name": key_data.name,
        "description": key_data.description,
        "key_hash": key_hash,
        "key_prefix": full_key[:12],
        "permissions": key_data.permissions,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at,
        "last_used": None
    }
    
    api_keys.append(new_key)
    
    return {
        "api_key": full_key,  # Only shown once!
        "id": new_key["id"],
        "name": new_key["name"],
        "permissions": new_key["permissions"],
        "expires_at": expires_at,
        "warning": "Save this API key now. It cannot be retrieved later."
    }


@router.put("/api-keys/{key_id}/toggle")
async def toggle_api_key(key_id: int):
    """Enable/disable an API key."""
    for key in api_keys:
        if key["id"] == key_id:
            key["is_active"] = not key["is_active"]
            return {"success": True, "is_active": key["is_active"]}
    
    raise HTTPException(status_code=404, detail="API key not found")


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(key_id: int):
    """Revoke (delete) an API key."""
    global api_keys
    original_length = len(api_keys)
    api_keys = [k for k in api_keys if k["id"] != key_id]
    
    if len(api_keys) == original_length:
        raise HTTPException(status_code=404, detail="API key not found")
    
    return {"success": True, "message": "API key revoked"}


# ============== API Key Validation ==============

async def validate_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key")
) -> Optional[Dict[str, Any]]:
    """
    Validate an API key from request header.
    Use as a dependency for protected endpoints.
    """
    if not x_api_key:
        return None
    
    key_hash = hash_api_key(x_api_key)
    
    for key in api_keys:
        if key["key_hash"] == key_hash:
            if not key["is_active"]:
                raise HTTPException(status_code=403, detail="API key is disabled")
            
            if key["expires_at"]:
                expiry = datetime.fromisoformat(key["expires_at"])
                if datetime.now(timezone.utc) > expiry:
                    raise HTTPException(status_code=403, detail="API key has expired")
            
            # Update last used
            key["last_used"] = datetime.now(timezone.utc).isoformat()
            
            return key
    
    raise HTTPException(status_code=401, detail="Invalid API key")


# ============== File Watcher Configuration ==============

@router.get("/file-watchers")
async def list_file_watchers():
    """List all file watcher configurations."""
    return {
        "watchers": file_watchers,
        "is_watcher_running": False,  # Would check actual watcher process
        "supported_patterns": ["*.pdf", "*.PDF", "packing_slip*.pdf"]
    }


@router.post("/file-watchers")
async def create_file_watcher(watcher: FileWatcherCreate):
    """Create a new file watcher configuration."""
    # Validate path exists
    watch_path = Path(watcher.watch_path)
    if not watch_path.exists():
        raise HTTPException(
            status_code=400,
            detail=f"Watch path does not exist: {watcher.watch_path}"
        )
    
    if not watch_path.is_dir():
        raise HTTPException(
            status_code=400,
            detail="Watch path must be a directory"
        )
    
    # Validate processed path if provided
    if watcher.move_processed and watcher.processed_path:
        processed_path = Path(watcher.processed_path)
        if not processed_path.exists():
            processed_path.mkdir(parents=True, exist_ok=True)
    
    new_watcher = {
        "id": len(file_watchers) + 1,
        "watch_path": watcher.watch_path,
        "pattern": watcher.pattern,
        "brand_id": watcher.brand_id,
        "auto_process": watcher.auto_process,
        "move_processed": watcher.move_processed,
        "processed_path": watcher.processed_path,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_check": None,
        "files_processed": 0
    }
    
    file_watchers.append(new_watcher)
    
    return {
        "success": True,
        "watcher": new_watcher
    }


@router.get("/file-watchers/{watcher_id}")
async def get_file_watcher(watcher_id: int):
    """Get file watcher details."""
    for watcher in file_watchers:
        if watcher["id"] == watcher_id:
            return watcher
    
    raise HTTPException(status_code=404, detail="File watcher not found")


@router.put("/file-watchers/{watcher_id}/toggle")
async def toggle_file_watcher(watcher_id: int):
    """Enable/disable a file watcher."""
    for watcher in file_watchers:
        if watcher["id"] == watcher_id:
            watcher["is_active"] = not watcher["is_active"]
            return {"success": True, "is_active": watcher["is_active"]}
    
    raise HTTPException(status_code=404, detail="File watcher not found")


@router.delete("/file-watchers/{watcher_id}")
async def delete_file_watcher(watcher_id: int):
    """Delete a file watcher configuration."""
    global file_watchers
    original_length = len(file_watchers)
    file_watchers = [w for w in file_watchers if w["id"] != watcher_id]
    
    if len(file_watchers) == original_length:
        raise HTTPException(status_code=404, detail="File watcher not found")
    
    return {"success": True}


@router.post("/file-watchers/{watcher_id}/scan")
async def scan_watch_directory(watcher_id: int):
    """
    Manually trigger a scan of the watch directory.
    Returns list of files that would be processed.
    """
    watcher = None
    for w in file_watchers:
        if w["id"] == watcher_id:
            watcher = w
            break
    
    if not watcher:
        raise HTTPException(status_code=404, detail="File watcher not found")
    
    watch_path = Path(watcher["watch_path"])
    pattern = watcher["pattern"]
    
    # Find matching files
    matching_files = list(watch_path.glob(pattern))
    
    watcher["last_check"] = datetime.now(timezone.utc).isoformat()
    
    return {
        "watcher_id": watcher_id,
        "watch_path": watcher["watch_path"],
        "pattern": pattern,
        "files_found": len(matching_files),
        "files": [
            {
                "name": f.name,
                "path": str(f),
                "size_kb": round(f.stat().st_size / 1024, 1),
                "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat()
            }
            for f in matching_files[:50]  # Limit to 50 files
        ]
    }


@router.get("/file-watchers/logs")
async def get_watcher_logs(
    watcher_id: Optional[int] = None,
    limit: int = Query(50, le=500)
):
    """Get file watcher activity logs."""
    logs = watcher_logs
    
    if watcher_id:
        logs = [l for l in logs if l["watcher_id"] == watcher_id]
    
    return {
        "logs": logs[-limit:][::-1]
    }


# ============== System Status ==============

@router.get("/status")
async def get_integration_status():
    """Get overall integration status."""
    active_webhooks = sum(1 for w in webhooks if w["is_active"])
    active_keys = sum(1 for k in api_keys if k["is_active"])
    active_watchers = sum(1 for w in file_watchers if w["is_active"])
    
    return {
        "status": "operational",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "webhooks": {
            "total": len(webhooks),
            "active": active_webhooks,
            "recent_events": len([l for l in webhook_logs[-100:]])
        },
        "api_keys": {
            "total": len(api_keys),
            "active": active_keys
        },
        "file_watchers": {
            "total": len(file_watchers),
            "active": active_watchers,
            "watcher_running": False  # Would check actual process
        }
    }
