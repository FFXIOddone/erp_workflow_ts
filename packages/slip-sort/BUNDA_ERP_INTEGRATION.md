# BUNDA ERP ↔ SLIP_SORT Integration Guide

## Overview

This document outlines the integration architecture between **BUNDA ERP** (the main enterprise application) and **SLIP_SORT** (the packing slip management tool). The goal is for SLIP_SORT to function as a **modular tool** within the BUNDA ERP ecosystem while maintaining independence for standalone usage.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BUNDA ERP (Main App)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Orders    │  │  Inventory  │  │   Clients   │  │  Reports Dashboard  │ │
│  │   Module    │  │   Module    │  │   Module    │  │                     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                │                     │            │
│         └────────────────┼────────────────┼─────────────────────┘            │
│                          │                │                                   │
│                    ┌─────┴────────────────┴─────┐                            │
│                    │     BUNDA API Gateway      │                            │
│                    │    (Central Message Bus)   │                            │
│                    └─────────────┬──────────────┘                            │
└──────────────────────────────────┼──────────────────────────────────────────┘
                                   │
                     ╔═════════════╧═════════════╗
                     ║    Integration Layer      ║
                     ║  • Webhooks               ║
                     ║  • REST API               ║
                     ║  • Shared Database (opt)  ║
                     ║  • File System Watchers   ║
                     ╚═════════════╤═════════════╝
                                   │
┌──────────────────────────────────┼──────────────────────────────────────────┐
│                                  │                                           │
│  ┌───────────────────────────────┴────────────────────────────────────────┐ │
│  │                        SLIP_SORT Integration API                        │ │
│  │                         /api/integrations/*                             │ │
│  └───────────────────────────────┬────────────────────────────────────────┘ │
│                                  │                                           │
│  ┌─────────────┐  ┌─────────────┐│  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Orders    │  │    PDF      ││  │   Config    │  │      Reports        │ │
│  │  /orders/*  │  │  Processing ││  │  /config/*  │  │     /reports/*      │ │
│  └─────────────┘  └─────────────┘│  └─────────────┘  └─────────────────────┘ │
│                                  │                                           │
│                           SLIP_SORT                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Integration Methods

### 1. REST API Integration (Recommended)

SLIP_SORT exposes a full REST API that BUNDA ERP can call directly.

#### Authentication

SLIP_SORT supports API key authentication for service-to-service communication:

```http
GET /api/orders
Authorization: Bearer slipsort_abc123...
X-ERP-Source: bunda
X-Correlation-ID: erp-req-12345
```

#### Generating an API Key for BUNDA

```bash
# Via SLIP_SORT API
curl -X POST http://localhost:8000/api/integrations/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "BUNDA ERP Integration",
    "scopes": ["read:orders", "write:orders", "read:reports"],
    "rate_limit": 5000
  }'
```

#### Key Endpoints for ERP Integration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/orders` | GET | List all orders |
| `/api/orders/advanced-search` | POST | Search with filters |
| `/api/orders/{id}` | GET | Get order details |
| `/api/orders/bulk-action` | POST | Bulk operations |
| `/api/reports/summary/{period}` | GET | Get summaries |
| `/api/reports/export/{format}` | GET | Export data |
| `/api/batches/queue` | GET | Processing queue status |
| `/api/config-management/export/{brand_id}` | GET | Export brand config |

---

### 2. Webhook Integration (Event-Driven)

SLIP_SORT can push events to BUNDA ERP via webhooks.

#### Register a Webhook

```bash
curl -X POST http://localhost:8000/api/integrations/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "BUNDA ERP Webhook",
    "url": "https://bunda-erp.local/api/webhooks/slipsort",
    "events": [
      "order.created",
      "order.updated",
      "batch.completed",
      "batch.error"
    ],
    "secret": "your-webhook-secret",
    "is_active": true
  }'
```

#### Webhook Payload Format

```json
{
  "event": "order.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "correlation_id": "batch-abc123",
  "data": {
    "order_id": 1234,
    "brand_id": 1,
    "store_code": "A1234",
    "kit_type": "counter",
    "items_count": 5
  },
  "signature": "sha256=..."
}
```

#### Webhook Events

| Event | Description |
|-------|-------------|
| `order.created` | New order processed from PDF |
| `order.updated` | Order modified |
| `order.deleted` | Order removed |
| `batch.started` | PDF processing started |
| `batch.completed` | PDF processing finished |
| `batch.error` | Processing encountered error |
| `config.updated` | Brand configuration changed |

---

### 3. File System Watcher (Automated Processing)

SLIP_SORT can monitor directories for incoming PDFs and automatically process them.

#### Configure File Watcher

```bash
curl -X POST http://localhost:8000/api/integrations/file-watchers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "BUNDA ERP Incoming PDFs",
    "watch_path": "\\\\server\\shared\\erp\\packing-slips\\incoming",
    "output_path": "\\\\server\\shared\\erp\\packing-slips\\processed",
    "file_pattern": "*.pdf",
    "brand_id": 1,
    "auto_process": true,
    "is_active": true
  }'
```

#### Workflow

1. BUNDA ERP saves PDF to watched directory
2. SLIP_SORT detects new file
3. PDF is processed according to brand configuration
4. Sorted PDF saved to output directory
5. Webhook sent to BUNDA with results
6. Original PDF moved to archive/processed folder

---

### 4. Database Sharing (Optional)

For tighter integration, both applications can share database access.

#### Option A: Shared SQLite Database

```python
# BUNDA ERP config
SLIPSORT_DB_PATH = "\\\\server\\shared\\databases\\slipsort.db"

# Read orders directly
from sqlalchemy import create_engine
engine = create_engine(f"sqlite:///{SLIPSORT_DB_PATH}")
```

#### Option B: PostgreSQL (Production)

For production environments, migrate both apps to PostgreSQL:

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: erp_shared
      POSTGRES_USER: erp_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  slipsort-backend:
    environment:
      DB_URL: postgresql://erp_user:${DB_PASSWORD}@postgres:5432/erp_shared
  
  bunda-backend:
    environment:
      DB_URL: postgresql://erp_user:${DB_PASSWORD}@postgres:5432/erp_shared
```

---

## Implementation Guide

### Step 1: Configure SLIP_SORT for ERP Mode

Create a configuration file for ERP integration:

```python
# backend/core/erp_config.py

ERP_SETTINGS = {
    "mode": "integrated",  # "standalone" or "integrated"
    "erp_name": "BUNDA",
    "erp_api_url": "http://bunda-erp:8080/api",
    "erp_api_key": "${BUNDA_API_KEY}",
    
    # Data sync settings
    "sync_orders": True,
    "sync_interval_seconds": 300,
    "push_to_erp": True,
    "pull_from_erp": True,
    
    # Shared paths
    "shared_uploads": "\\\\server\\shared\\uploads",
    "shared_outputs": "\\\\server\\shared\\outputs",
}
```

### Step 2: Add ERP Sync Router

```python
# backend/routers/erp_sync.py

from fastapi import APIRouter, BackgroundTasks
from typing import Dict, Any

router = APIRouter(prefix="/api/erp", tags=["ERP Integration"])

@router.post("/sync/orders")
async def sync_orders_to_erp(background_tasks: BackgroundTasks):
    """Push pending orders to BUNDA ERP."""
    background_tasks.add_task(push_orders_to_bunda)
    return {"status": "sync_started"}

@router.get("/status")
async def get_erp_status() -> Dict[str, Any]:
    """Check connection status to BUNDA ERP."""
    return {
        "connected": True,
        "last_sync": "2024-01-15T10:00:00Z",
        "pending_orders": 0,
        "erp_version": "2.1.0"
    }

@router.post("/receive")
async def receive_from_erp(payload: Dict[str, Any]):
    """Receive data pushed from BUNDA ERP."""
    event_type = payload.get("type")
    
    if event_type == "brand_update":
        # Update brand configuration
        pass
    elif event_type == "store_list":
        # Import store data
        pass
    
    return {"status": "received"}
```

### Step 3: BUNDA ERP Client Module

Create a client module in BUNDA ERP to communicate with SLIP_SORT:

```python
# In BUNDA ERP codebase: modules/slipsort_client.py

import httpx
from typing import Optional, Dict, Any, List

class SlipSortClient:
    """Client for communicating with SLIP_SORT service."""
    
    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        api_key: Optional[str] = None
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.client = httpx.Client(
            headers=self._get_headers(),
            timeout=30.0
        )
    
    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "X-ERP-Source": "bunda"
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers
    
    # Orders
    def get_orders(
        self,
        brand_id: Optional[int] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Dict[str, Any]:
        """Fetch orders from SLIP_SORT."""
        response = self.client.post(
            f"{self.base_url}/api/orders/advanced-search",
            json={
                "brand_id": brand_id,
                "date_from": date_from,
                "date_to": date_to,
                "page": page,
                "page_size": page_size
            }
        )
        response.raise_for_status()
        return response.json()
    
    def get_order(self, order_id: int) -> Dict[str, Any]:
        """Get single order details."""
        response = self.client.get(
            f"{self.base_url}/api/orders/{order_id}"
        )
        response.raise_for_status()
        return response.json()
    
    # Reports
    def get_daily_summary(self, date: Optional[str] = None) -> Dict[str, Any]:
        """Get daily processing summary."""
        params = {"date": date} if date else {}
        response = self.client.get(
            f"{self.base_url}/api/reports/summary/daily",
            params=params
        )
        response.raise_for_status()
        return response.json()
    
    def export_report(
        self,
        format: str = "csv",
        date_from: Optional[str] = None,
        date_to: Optional[str] = None
    ) -> bytes:
        """Export report data."""
        response = self.client.get(
            f"{self.base_url}/api/reports/export/{format}",
            params={"date_from": date_from, "date_to": date_to}
        )
        response.raise_for_status()
        return response.content
    
    # Batch Processing
    def get_queue_status(self) -> Dict[str, Any]:
        """Get current processing queue status."""
        response = self.client.get(
            f"{self.base_url}/api/batches/queue"
        )
        response.raise_for_status()
        return response.json()
    
    def submit_pdf(
        self,
        file_path: str,
        brand_id: int
    ) -> Dict[str, Any]:
        """Submit a PDF for processing."""
        with open(file_path, "rb") as f:
            files = {"file": f}
            data = {"brand_id": brand_id}
            response = self.client.post(
                f"{self.base_url}/api/upload",
                files=files,
                data=data
            )
        response.raise_for_status()
        return response.json()
    
    # Health
    def health_check(self) -> bool:
        """Check if SLIP_SORT is healthy."""
        try:
            response = self.client.get(f"{self.base_url}/api/health")
            return response.status_code == 200
        except Exception:
            return False


# Usage in BUNDA ERP
# slipsort = SlipSortClient(
#     base_url="http://localhost:8000",
#     api_key="slipsort_xxx..."
# )
# orders = slipsort.get_orders(brand_id=1)
```

---

## Embedding SLIP_SORT in BUNDA ERP UI

### Option 1: IFrame Embedding

```html
<!-- In BUNDA ERP frontend -->
<iframe 
  src="http://localhost:5173?embedded=true&brand_id=1"
  width="100%"
  height="800px"
  frameborder="0"
  title="SLIP_SORT Packing Slip Manager"
></iframe>
```

### Option 2: Component Library Sharing

Since both apps use similar stacks (Svelte), share components:

```javascript
// In BUNDA ERP package.json
{
  "dependencies": {
    "@wilde/slipsort-components": "file:../SLIP_SORT/frontend/dist"
  }
}

// Usage
import { ProcessPDF, OrderHistory } from '@wilde/slipsort-components';
```

### Option 3: Micro-Frontend Architecture

Deploy SLIP_SORT as a micro-frontend:

```javascript
// In BUNDA ERP main app
import { registerApplication, start } from 'single-spa';

registerApplication({
  name: 'slipsort',
  app: () => System.import('slipsort'),
  activeWhen: ['/tools/packing-slips'],
  customProps: {
    brandId: 1,
    authToken: getAuthToken()
  }
});

start();
```

---

## Security Considerations

### 1. API Key Scopes

Define granular scopes for ERP access:

| Scope | Description |
|-------|-------------|
| `read:orders` | View orders |
| `write:orders` | Create/update orders |
| `delete:orders` | Delete orders |
| `read:reports` | View reports |
| `export:reports` | Download report files |
| `admin:config` | Modify configurations |

### 2. Network Security

```yaml
# For production deployment
# Allow only BUNDA ERP to access SLIP_SORT API

# nginx.conf
location /api/ {
  # Allow BUNDA ERP server
  allow 192.168.1.100;
  allow 10.0.0.0/8;
  
  # Block all others
  deny all;
  
  proxy_pass http://slipsort-backend:8000;
}
```

### 3. Audit Logging

All ERP-originated requests are logged:

```python
# Automatic via middleware
# Logs include:
# - X-ERP-Source header
# - X-Correlation-ID for tracing
# - Full request/response audit
```

---

## Deployment Scenarios

### Scenario 1: Same Server

```
┌─────────────────────────────────────┐
│            Windows Server            │
│  ┌───────────────┐ ┌──────────────┐ │
│  │   BUNDA ERP   │ │  SLIP_SORT   │ │
│  │  Port: 8080   │ │  Port: 8000  │ │
│  └───────────────┘ └──────────────┘ │
│            Shared SQLite             │
└─────────────────────────────────────┘
```

### Scenario 2: Separate Servers

```
┌─────────────────┐     ┌─────────────────┐
│  BUNDA Server   │────▶│ SLIP_SORT Server│
│  192.168.1.100  │ API │  192.168.1.101  │
└─────────────────┘     └─────────────────┘
         │                      │
         └──────────┬───────────┘
                    │
            ┌───────┴────────┐
            │ Shared Storage │
            │  \\server\data │
            └────────────────┘
```

### Scenario 3: Docker Compose (Recommended)

```yaml
# docker-compose.erp.yml
version: '3.8'

services:
  bunda-erp:
    build: ./bunda-erp
    ports:
      - "8080:8080"
    environment:
      - SLIPSORT_API_URL=http://slipsort-backend:8000
      - SLIPSORT_API_KEY=${SLIPSORT_API_KEY}
    depends_on:
      - slipsort-backend
    networks:
      - erp-network
  
  slipsort-backend:
    build: 
      context: ./SLIP_SORT/backend
      dockerfile: Dockerfile.backend
    environment:
      - ERP_MODE=integrated
      - BUNDA_API_URL=http://bunda-erp:8080
    volumes:
      - shared-data:/app/data
    networks:
      - erp-network
  
  slipsort-frontend:
    build:
      context: ./SLIP_SORT/frontend
      dockerfile: Dockerfile.frontend
    ports:
      - "5173:80"
    networks:
      - erp-network

networks:
  erp-network:
    driver: bridge

volumes:
  shared-data:
```

---

## Quick Start Checklist

- [ ] Generate SLIP_SORT API key for BUNDA ERP
- [ ] Configure webhook URL in SLIP_SORT
- [ ] Set up file watcher for shared directories
- [ ] Test API connectivity
- [ ] Configure authentication/authorization
- [ ] Set up monitoring and alerts
- [ ] Document emergency procedures
- [ ] Train users on integrated workflow

---

## Support

For integration support:
- Review [backend/routers/integrations.py](backend/routers/integrations.py)
- Check API documentation at `/docs` (Swagger UI)
- Review audit logs at `backend/logs/audit.log`
