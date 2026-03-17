"""
Orders Router - Advanced order management endpoints.

Provides:
- Advanced filtering with multiple criteria
- Bulk actions (reprocess, export, delete)
- Order timeline/history
- Order comparison
- Print queue management
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from sqlalchemy import func, and_, or_, desc
from sqlalchemy.orm import Session

from database.models import (
    Order, OrderItem, Store, ProcessingBatch, Brand
)
from core.database import get_db

router = APIRouter(prefix="/api/orders", tags=["Orders"])


# ============== Pydantic Models ==============

class OrderFilterParams(BaseModel):
    """Advanced filter parameters for orders."""
    brand_id: Optional[int] = None
    batch_ids: Optional[List[str]] = None
    store_codes: Optional[List[str]] = None
    kit_types: Optional[List[str]] = None
    alcohol_types: Optional[List[str]] = None
    box_categories: Optional[List[str]] = None
    has_banner: Optional[bool] = None
    has_pump_topper: Optional[bool] = None
    needs_manual_review: Optional[bool] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    search: Optional[str] = None


class OrderSummary(BaseModel):
    """Order summary for list views."""
    id: int
    brand_id: Optional[int]
    store_code: str
    store_name: Optional[str]
    kit_type: Optional[str]
    alcohol_type: Optional[str]
    box_category: Optional[str]
    has_banner: bool
    has_pump_topper: bool
    needs_manual_review: bool
    item_count: int
    processed_at: datetime
    batch_id: Optional[str]


class OrderDetail(BaseModel):
    """Detailed order view with items and timeline."""
    id: int
    brand_id: Optional[int]
    brand_name: Optional[str]
    store_code: str
    store_name: Optional[str]
    store_address: Optional[str]
    kit_type: Optional[str]
    alcohol_type: Optional[str]
    box_category: Optional[str]
    has_banner: bool
    has_pump_topper: bool
    needs_manual_review: bool
    manual_review_reason: Optional[str]
    source_pdf: Optional[str]
    source_pages: List[int]
    processed_at: datetime
    batch_id: Optional[str]
    items: List[Dict[str, Any]]
    timeline: List[Dict[str, Any]]


class BulkActionRequest(BaseModel):
    """Request for bulk actions."""
    order_ids: List[int]
    action: str  # "delete", "reprocess", "export", "mark_reviewed"


class BulkActionResponse(BaseModel):
    """Response from bulk actions."""
    success: bool
    processed: int
    failed: int
    errors: List[str]


class OrderComparisonRequest(BaseModel):
    """Request to compare orders."""
    order_ids: List[int]


class PrintQueueItem(BaseModel):
    """Print queue item."""
    id: int
    order_id: int
    store_code: str
    batch_id: str
    pages: List[int]
    status: str  # "pending", "printing", "printed"
    added_at: datetime


# ============== Advanced Filtering ==============

@router.post("/advanced-search")
async def advanced_order_search(
    filters: OrderFilterParams,
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("processed_at"),
    sort_dir: str = Query("desc"),
    db: Session = Depends(get_db)
):
    """
    Advanced search for orders with multiple filter criteria.
    Supports filtering by brand, batch, store, kit type, alcohol type, 
    box category, flags, date range, and text search.
    """
    query = db.query(Order)
    
    # Apply filters
    if filters.brand_id:
        query = query.filter(Order.brand_id == filters.brand_id)
    
    if filters.batch_ids:
        query = query.filter(Order.batch_id.in_(filters.batch_ids))
    
    if filters.store_codes:
        query = query.filter(Order.store_code.in_(filters.store_codes))
    
    if filters.kit_types:
        query = query.filter(Order.kit_type.in_(filters.kit_types))
    
    if filters.alcohol_types:
        query = query.filter(Order.alcohol_type.in_(filters.alcohol_types))
    
    if filters.box_categories:
        query = query.filter(Order.box_category.in_(filters.box_categories))
    
    if filters.has_banner is not None:
        query = query.filter(Order.has_banner == filters.has_banner)
    
    if filters.has_pump_topper is not None:
        query = query.filter(Order.has_pump_topper == filters.has_pump_topper)
    
    if filters.needs_manual_review is not None:
        query = query.filter(Order.needs_manual_review == filters.needs_manual_review)
    
    if filters.date_from:
        query = query.filter(Order.processed_at >= filters.date_from)
    
    if filters.date_to:
        query = query.filter(Order.processed_at <= filters.date_to)
    
    if filters.search:
        search_term = f"%{filters.search}%"
        query = query.filter(
            or_(
                Order.store_code.ilike(search_term),
                Order.raw_text.ilike(search_term)
            )
        )
    
    # Get total count before pagination
    total = query.count()
    
    # Apply sorting
    sort_column = getattr(Order, sort_by, Order.processed_at)
    if sort_dir.lower() == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(sort_column)
    
    # Apply pagination
    orders = query.offset(offset).limit(limit).all()
    
    # Build response
    results = []
    for order in orders:
        item_count = db.query(func.count(OrderItem.id)).filter(
            OrderItem.order_id == order.id
        ).scalar()
        
        store = db.query(Store).filter(Store.id == order.store_id).first() if order.store_id else None
        
        results.append({
            "id": order.id,
            "brand_id": order.brand_id,
            "store_code": order.store_code,
            "store_name": store.name if store else order.store_code,
            "kit_type": order.kit_type,
            "alcohol_type": order.alcohol_type,
            "box_category": order.box_category,
            "has_banner": order.has_banner,
            "has_pump_topper": order.has_pump_topper,
            "needs_manual_review": order.needs_manual_review,
            "item_count": item_count,
            "processed_at": order.processed_at.isoformat() if order.processed_at else None,
            "batch_id": order.batch_id
        })
    
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "orders": results
    }


@router.get("/filter-options")
async def get_filter_options(db: Session = Depends(get_db)):
    """
    Get available filter options based on existing data.
    Used to populate filter dropdowns in the UI.
    """
    # Get distinct kit types
    kit_types = db.query(Order.kit_type).distinct().filter(
        Order.kit_type.isnot(None)
    ).all()
    
    # Get distinct alcohol types
    alcohol_types = db.query(Order.alcohol_type).distinct().filter(
        Order.alcohol_type.isnot(None)
    ).all()
    
    # Get distinct box categories
    box_categories = db.query(Order.box_category).distinct().filter(
        Order.box_category.isnot(None)
    ).all()
    
    # Get brands
    brands = db.query(Brand.id, Brand.name).all()
    
    # Get recent batches
    batches = db.query(
        ProcessingBatch.batch_id,
        ProcessingBatch.source_filename,
        ProcessingBatch.started_at
    ).order_by(desc(ProcessingBatch.started_at)).limit(20).all()
    
    return {
        "kit_types": [kt[0] for kt in kit_types if kt[0]],
        "alcohol_types": [at[0] for at in alcohol_types if at[0]],
        "box_categories": [bc[0] for bc in box_categories if bc[0]],
        "brands": [{"id": b[0], "name": b[1]} for b in brands],
        "batches": [
            {
                "batch_id": b[0],
                "filename": b[1],
                "date": b[2].isoformat() if b[2] else None
            }
            for b in batches
        ]
    }


# ============== Order Details & Timeline ==============

@router.get("/{order_id}/detail")
async def get_order_detail(order_id: int, db: Session = Depends(get_db)):
    """
    Get detailed order information including items and timeline.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get items
    items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
    
    # Get store info
    store = db.query(Store).filter(Store.id == order.store_id).first() if order.store_id else None
    
    # Get brand info
    brand = db.query(Brand).filter(Brand.id == order.brand_id).first() if order.brand_id else None
    
    # Get batch info for timeline
    batch = db.query(ProcessingBatch).filter(
        ProcessingBatch.batch_id == order.batch_id
    ).first() if order.batch_id else None
    
    # Build timeline
    timeline = []
    
    if batch:
        timeline.append({
            "event": "PDF Uploaded",
            "timestamp": batch.started_at.isoformat() if batch.started_at else None,
            "details": f"Source: {batch.source_filename}"
        })
    
    timeline.append({
        "event": "Order Extracted",
        "timestamp": order.processed_at.isoformat() if order.processed_at else None,
        "details": f"Pages: {order.source_pages}"
    })
    
    if order.needs_manual_review:
        timeline.append({
            "event": "Flagged for Review",
            "timestamp": order.processed_at.isoformat() if order.processed_at else None,
            "details": order.manual_review_reason or "Unknown reason"
        })
    
    if batch and batch.completed_at:
        timeline.append({
            "event": "Batch Completed",
            "timestamp": batch.completed_at.isoformat(),
            "details": f"Total stores: {batch.total_stores}"
        })
    
    return {
        "order": {
            "id": order.id,
            "brand_id": order.brand_id,
            "brand_name": brand.name if brand else None,
            "store_code": order.store_code,
            "store_name": store.name if store else order.store_code,
            "store_address": f"{store.address}, {store.city}, {store.state}" if store and store.address else None,
            "kit_type": order.kit_type,
            "alcohol_type": order.alcohol_type,
            "box_category": order.box_category,
            "has_banner": order.has_banner,
            "has_pump_topper": order.has_pump_topper,
            "needs_manual_review": order.needs_manual_review,
            "manual_review_reason": order.manual_review_reason,
            "source_pdf": order.source_pdf,
            "source_pages": order.source_pages or [],
            "processed_at": order.processed_at.isoformat() if order.processed_at else None,
            "batch_id": order.batch_id
        },
        "items": [
            {
                "id": item.id,
                "sign_type": item.sign_type,
                "promotion_name": item.promotion_name,
                "quantity": item.quantity,
                "is_kit_marker": item.is_kit_marker,
                "kit_type": item.kit_type
            }
            for item in items
        ],
        "timeline": timeline
    }


# ============== Bulk Actions ==============

@router.post("/bulk-action")
async def perform_bulk_action(
    request: BulkActionRequest,
    db: Session = Depends(get_db)
):
    """
    Perform bulk actions on multiple orders.
    
    Supported actions:
    - delete: Permanently delete orders
    - mark_reviewed: Clear needs_manual_review flag
    - export: Export orders to JSON (returns data)
    """
    processed = 0
    failed = 0
    errors = []
    export_data = []
    
    for order_id in request.order_ids:
        try:
            order = db.query(Order).filter(Order.id == order_id).first()
            if not order:
                failed += 1
                errors.append(f"Order {order_id} not found")
                continue
            
            if request.action == "delete":
                # Delete order items first
                db.query(OrderItem).filter(OrderItem.order_id == order_id).delete()
                db.delete(order)
                processed += 1
                
            elif request.action == "mark_reviewed":
                order.needs_manual_review = False
                order.manual_review_reason = None
                processed += 1
                
            elif request.action == "export":
                items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
                export_data.append({
                    "id": order.id,
                    "store_code": order.store_code,
                    "kit_type": order.kit_type,
                    "alcohol_type": order.alcohol_type,
                    "box_category": order.box_category,
                    "processed_at": order.processed_at.isoformat() if order.processed_at else None,
                    "items": [
                        {
                            "sign_type": item.sign_type,
                            "promotion_name": item.promotion_name,
                            "quantity": item.quantity
                        }
                        for item in items
                    ]
                })
                processed += 1
            else:
                failed += 1
                errors.append(f"Unknown action: {request.action}")
                
        except Exception as e:
            failed += 1
            errors.append(f"Error processing order {order_id}: {str(e)}")
    
    db.commit()
    
    response = {
        "success": failed == 0,
        "processed": processed,
        "failed": failed,
        "errors": errors
    }
    
    if request.action == "export":
        response["export_data"] = export_data
    
    return response


# ============== Order Comparison ==============

@router.post("/compare")
async def compare_orders(
    request: OrderComparisonRequest,
    db: Session = Depends(get_db)
):
    """
    Compare multiple orders side by side.
    Returns detailed information for each order for comparison.
    """
    if len(request.order_ids) < 2:
        raise HTTPException(
            status_code=400, 
            detail="At least 2 orders required for comparison"
        )
    
    if len(request.order_ids) > 5:
        raise HTTPException(
            status_code=400,
            detail="Maximum 5 orders can be compared at once"
        )
    
    comparison_data = []
    
    for order_id in request.order_ids:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            continue
        
        items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
        store = db.query(Store).filter(Store.id == order.store_id).first() if order.store_id else None
        
        comparison_data.append({
            "id": order.id,
            "store_code": order.store_code,
            "store_name": store.name if store else order.store_code,
            "kit_type": order.kit_type,
            "alcohol_type": order.alcohol_type,
            "box_category": order.box_category,
            "has_banner": order.has_banner,
            "has_pump_topper": order.has_pump_topper,
            "item_count": len(items),
            "items": [
                {
                    "sign_type": item.sign_type,
                    "promotion_name": item.promotion_name,
                    "quantity": item.quantity
                }
                for item in items
            ],
            "processed_at": order.processed_at.isoformat() if order.processed_at else None
        })
    
    # Find differences
    differences = {
        "kit_type": len(set(o["kit_type"] for o in comparison_data if o["kit_type"])) > 1,
        "alcohol_type": len(set(o["alcohol_type"] for o in comparison_data if o["alcohol_type"])) > 1,
        "box_category": len(set(o["box_category"] for o in comparison_data if o["box_category"])) > 1,
        "item_count": len(set(o["item_count"] for o in comparison_data)) > 1,
    }
    
    return {
        "orders": comparison_data,
        "differences": differences
    }


# ============== Statistics ==============

@router.get("/statistics")
async def get_order_statistics(
    days: int = Query(30, ge=1, le=365),
    brand_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Get order statistics for reporting.
    """
    start_date = datetime.utcnow() - timedelta(days=days)
    
    query = db.query(Order).filter(Order.processed_at >= start_date)
    if brand_id:
        query = query.filter(Order.brand_id == brand_id)
    
    orders = query.all()
    
    # Calculate statistics
    total_orders = len(orders)
    
    # Kit type distribution
    kit_type_counts = {}
    for order in orders:
        kt = order.kit_type or "unknown"
        kit_type_counts[kt] = kit_type_counts.get(kt, 0) + 1
    
    # Alcohol type distribution
    alcohol_type_counts = {}
    for order in orders:
        at = order.alcohol_type or "unknown"
        alcohol_type_counts[at] = alcohol_type_counts.get(at, 0) + 1
    
    # Box category distribution
    box_category_counts = {}
    for order in orders:
        bc = order.box_category or "unknown"
        box_category_counts[bc] = box_category_counts.get(bc, 0) + 1
    
    # Daily order counts
    daily_counts = {}
    for order in orders:
        if order.processed_at:
            date_key = order.processed_at.strftime("%Y-%m-%d")
            daily_counts[date_key] = daily_counts.get(date_key, 0) + 1
    
    # Manual review stats
    needs_review = sum(1 for o in orders if o.needs_manual_review)
    
    # Get item counts
    total_items = db.query(func.count(OrderItem.id)).join(Order).filter(
        Order.processed_at >= start_date
    ).scalar() or 0
    
    return {
        "period_days": days,
        "total_orders": total_orders,
        "total_items": total_items,
        "needs_review": needs_review,
        "kit_type_distribution": kit_type_counts,
        "alcohol_type_distribution": alcohol_type_counts,
        "box_category_distribution": box_category_counts,
        "daily_counts": daily_counts,
        "averages": {
            "orders_per_day": round(total_orders / days, 1) if days > 0 else 0,
            "items_per_order": round(total_items / total_orders, 1) if total_orders > 0 else 0
        }
    }


# ============== Print Queue ==============

# In-memory print queue (would be database in production)
print_queue: List[Dict[str, Any]] = []


@router.get("/print-queue")
async def get_print_queue():
    """Get current print queue."""
    return {"queue": print_queue}


@router.post("/print-queue/add")
async def add_to_print_queue(
    order_ids: List[int],
    db: Session = Depends(get_db)
):
    """Add orders to print queue."""
    added = []
    
    for order_id in order_ids:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            continue
        
        queue_item = {
            "id": len(print_queue) + 1,
            "order_id": order.id,
            "store_code": order.store_code,
            "batch_id": order.batch_id,
            "pages": order.source_pages or [],
            "status": "pending",
            "added_at": datetime.utcnow().isoformat()
        }
        print_queue.append(queue_item)
        added.append(queue_item)
    
    return {"added": added, "queue_length": len(print_queue)}


@router.delete("/print-queue/{queue_id}")
async def remove_from_print_queue(queue_id: int):
    """Remove item from print queue."""
    global print_queue
    original_length = len(print_queue)
    print_queue = [item for item in print_queue if item["id"] != queue_id]
    
    if len(print_queue) == original_length:
        raise HTTPException(status_code=404, detail="Queue item not found")
    
    return {"success": True, "queue_length": len(print_queue)}


@router.post("/print-queue/clear")
async def clear_print_queue():
    """Clear entire print queue."""
    global print_queue
    count = len(print_queue)
    print_queue = []
    return {"cleared": count}
