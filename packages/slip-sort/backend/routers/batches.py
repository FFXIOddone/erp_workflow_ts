"""
Batches Router - Batch processing and management endpoints.

Provides:
- Batch queue visualization
- Progress tracking
- Error handling & retry logic
- Batch comparison
"""

import asyncio
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query, Depends, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from database.models import (
    Order, OrderItem, ProcessingBatch, Brand
)
from core.database import get_db

router = APIRouter(prefix="/api/batches", tags=["Batches"])


# ============== Pydantic Models ==============

class BatchSummary(BaseModel):
    """Summary of a processing batch."""
    id: int
    batch_id: str
    source_filename: str
    status: str
    total_pages: int
    total_stores: int
    total_items: int
    box_counts: Dict[str, int]
    started_at: datetime
    completed_at: Optional[datetime]
    duration_seconds: Optional[int]


class BatchDetail(BaseModel):
    """Detailed batch information."""
    id: int
    batch_id: str
    source_filename: str
    source_path: Optional[str]
    output_filename: Optional[str]
    output_path: Optional[str]
    brand_id: Optional[int]
    brand_name: Optional[str]
    status: str
    error_message: Optional[str]
    total_pages: int
    total_stores: int
    total_items: int
    box_counts: Dict[str, int]
    started_at: datetime
    completed_at: Optional[datetime]
    orders: List[Dict[str, Any]]


class BatchComparisonRequest(BaseModel):
    """Request to compare batches."""
    batch_ids: List[str]


class RetryBatchRequest(BaseModel):
    """Request to retry a failed batch."""
    batch_id: str
    force: bool = False  # Force retry even if not in error state


class BatchQueueItem(BaseModel):
    """Item in the processing queue."""
    position: int
    batch_id: str
    filename: str
    status: str
    priority: int
    added_at: datetime


# ============== In-Memory State (Demo) ==============

# Processing queue and progress tracking
processing_queue: List[Dict[str, Any]] = []
batch_progress: Dict[str, Dict[str, Any]] = {}


# ============== List & Details ==============

@router.get("/")
async def list_batches(
    status: Optional[str] = None,
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    List processing batches with optional filtering.
    """
    start_date = datetime.utcnow() - timedelta(days=days)
    
    query = db.query(ProcessingBatch).filter(
        ProcessingBatch.started_at >= start_date
    )
    
    if status:
        query = query.filter(ProcessingBatch.status == status)
    
    total = query.count()
    batches = query.order_by(desc(ProcessingBatch.started_at)).offset(offset).limit(limit).all()
    
    results = []
    for batch in batches:
        # Calculate duration
        duration = None
        if batch.started_at and batch.completed_at:
            duration = int((batch.completed_at - batch.started_at).total_seconds())
        
        results.append({
            "id": batch.id,
            "batch_id": batch.batch_id,
            "source_filename": batch.source_filename,
            "status": batch.status,
            "total_pages": batch.total_pages or 0,
            "total_stores": batch.total_stores or 0,
            "total_items": batch.total_items or 0,
            "box_counts": batch.box_counts or {},
            "started_at": batch.started_at.isoformat() if batch.started_at else None,
            "completed_at": batch.completed_at.isoformat() if batch.completed_at else None,
            "duration_seconds": duration
        })
    
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "batches": results
    }


@router.get("/suggestions/fields")
async def get_field_suggestions(
    brand_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Get field value suggestions based on processed batch data.
    Returns unique values for fields like states, kit_types, etc.
    Useful for populating dropdowns in sort configuration.
    """
    from database.models import Store
    
    # Base query for orders
    query = db.query(Order)
    
    if brand_id:
        query = query.filter(Order.brand_id == brand_id)
    
    orders = query.all()
    
    # Collect unique values
    kit_types = set()
    alcohol_types = set()
    box_categories = set()
    store_codes = set()
    store_types = set()
    sign_types = set()
    
    for order in orders:
        if order.kit_type:
            kit_types.add(order.kit_type)
        if order.alcohol_type:
            alcohol_types.add(order.alcohol_type)
        if order.box_category:
            box_categories.add(order.box_category)
        if order.store_code:
            store_codes.add(order.store_code)
        if order.store_type:
            store_types.add(order.store_type)
    
    # Get unique states from the Store table
    states_query = db.query(Store.state).distinct().filter(Store.state != None)
    states = {state for (state,) in states_query.all() if state}
    
    # Get unique sign types from order items
    items_query = db.query(OrderItem.sign_type).distinct()
    if brand_id:
        items_query = items_query.join(Order).filter(Order.brand_id == brand_id)
    
    for (sign_type,) in items_query.all():
        if sign_type:
            sign_types.add(sign_type)
    
    return {
        "fields": [
            {"name": "state", "label": "State/Location", "values": sorted(states)},
            {"name": "kit_type", "label": "Kit Type", "values": sorted(kit_types)},
            {"name": "alcohol_type", "label": "Alcohol Type", "values": sorted(alcohol_types)},
            {"name": "box_category", "label": "Box Category", "values": sorted(box_categories)},
            {"name": "store_type", "label": "Store Type", "values": sorted(store_types)},
            {"name": "store_code", "label": "Store Code", "values": sorted(store_codes)[:50]},  # Limit store codes
            {"name": "sign_type", "label": "Sign Type", "values": sorted(sign_types)},
            {"name": "total_quantity", "label": "Total Quantity", "values": []},  # Numeric field - no preset values
        ],
        "total_orders": len(orders)
    }


@router.get("/{batch_id}")
async def get_batch_detail(
    batch_id: str,
    db: Session = Depends(get_db)
):
    """
    Get detailed information about a specific batch.
    """
    batch = db.query(ProcessingBatch).filter(
        ProcessingBatch.batch_id == batch_id
    ).first()
    
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    # Get brand info
    brand = None
    if batch.brand_id:
        brand = db.query(Brand).filter(Brand.id == batch.brand_id).first()
    
    # Get orders for this batch
    orders = db.query(Order).filter(Order.batch_id == batch_id).all()
    
    order_list = []
    for order in orders:
        item_count = db.query(func.count(OrderItem.id)).filter(
            OrderItem.order_id == order.id
        ).scalar() or 0
        
        order_list.append({
            "id": order.id,
            "store_code": order.store_code,
            "kit_type": order.kit_type,
            "alcohol_type": order.alcohol_type,
            "box_category": order.box_category,
            "item_count": item_count,
            "needs_review": order.needs_manual_review
        })
    
    # Calculate duration
    duration = None
    if batch.started_at and batch.completed_at:
        duration = int((batch.completed_at - batch.started_at).total_seconds())
    
    return {
        "id": batch.id,
        "batch_id": batch.batch_id,
        "source_filename": batch.source_filename,
        "source_path": batch.source_path,
        "output_filename": batch.output_filename,
        "output_path": batch.output_path,
        "brand_id": batch.brand_id,
        "brand_name": brand.name if brand else None,
        "status": batch.status,
        "error_message": batch.error_message,
        "total_pages": batch.total_pages or 0,
        "total_stores": batch.total_stores or 0,
        "total_items": batch.total_items or 0,
        "box_counts": batch.box_counts or {},
        "started_at": batch.started_at.isoformat() if batch.started_at else None,
        "completed_at": batch.completed_at.isoformat() if batch.completed_at else None,
        "duration_seconds": duration,
        "orders": order_list
    }


# ============== Queue Management ==============

@router.get("/queue/status")
async def get_queue_status():
    """
    Get the current processing queue status.
    """
    return {
        "queue_length": len(processing_queue),
        "queue": processing_queue,
        "active_processing": [
            bid for bid, progress in batch_progress.items()
            if progress.get("status") == "processing"
        ]
    }


@router.post("/queue/add")
async def add_to_queue(
    batch_id: str,
    priority: int = 5,
    db: Session = Depends(get_db)
):
    """
    Add a batch to the processing queue.
    Priority: 1 = highest, 10 = lowest
    """
    batch = db.query(ProcessingBatch).filter(
        ProcessingBatch.batch_id == batch_id
    ).first()
    
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    # Check if already in queue
    if any(item["batch_id"] == batch_id for item in processing_queue):
        raise HTTPException(status_code=400, detail="Batch already in queue")
    
    queue_item = {
        "position": len(processing_queue) + 1,
        "batch_id": batch_id,
        "filename": batch.source_filename,
        "status": "queued",
        "priority": priority,
        "added_at": datetime.utcnow().isoformat()
    }
    
    # Insert based on priority
    insert_index = len(processing_queue)
    for i, item in enumerate(processing_queue):
        if item["priority"] > priority:
            insert_index = i
            break
    
    processing_queue.insert(insert_index, queue_item)
    
    # Update positions
    for i, item in enumerate(processing_queue):
        item["position"] = i + 1
    
    return {"success": True, "queue_item": queue_item}


@router.delete("/queue/{batch_id}")
async def remove_from_queue(batch_id: str):
    """
    Remove a batch from the processing queue.
    """
    global processing_queue
    original_length = len(processing_queue)
    processing_queue = [item for item in processing_queue if item["batch_id"] != batch_id]
    
    if len(processing_queue) == original_length:
        raise HTTPException(status_code=404, detail="Batch not in queue")
    
    # Update positions
    for i, item in enumerate(processing_queue):
        item["position"] = i + 1
    
    return {"success": True, "queue_length": len(processing_queue)}


@router.post("/queue/reorder")
async def reorder_queue(batch_ids: List[str]):
    """
    Reorder the processing queue.
    """
    global processing_queue
    
    # Create lookup of current queue items
    queue_lookup = {item["batch_id"]: item for item in processing_queue}
    
    new_queue = []
    for i, batch_id in enumerate(batch_ids):
        if batch_id in queue_lookup:
            item = queue_lookup[batch_id]
            item["position"] = i + 1
            new_queue.append(item)
    
    processing_queue = new_queue
    
    return {"success": True, "queue": processing_queue}


# ============== Progress Tracking ==============

@router.get("/{batch_id}/progress")
async def get_batch_progress(batch_id: str):
    """
    Get the current processing progress for a batch.
    For use with polling (SSE/WebSocket would be better for real-time).
    """
    if batch_id in batch_progress:
        return batch_progress[batch_id]
    
    return {
        "batch_id": batch_id,
        "status": "unknown",
        "progress": 0,
        "message": "No progress information available"
    }


def update_batch_progress(
    batch_id: str,
    status: str,
    progress: int,
    message: str,
    details: Optional[Dict[str, Any]] = None
):
    """
    Update progress for a batch (used internally by processing code).
    """
    batch_progress[batch_id] = {
        "batch_id": batch_id,
        "status": status,
        "progress": progress,
        "message": message,
        "details": details or {},
        "updated_at": datetime.utcnow().isoformat()
    }


# ============== Retry & Error Handling ==============

@router.post("/{batch_id}/retry")
async def retry_batch(
    batch_id: str,
    force: bool = False,
    db: Session = Depends(get_db)
):
    """
    Retry processing a failed batch.
    """
    batch = db.query(ProcessingBatch).filter(
        ProcessingBatch.batch_id == batch_id
    ).first()
    
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    if batch.status != "error" and not force:
        raise HTTPException(
            status_code=400,
            detail=f"Batch is in '{batch.status}' state. Use force=true to retry anyway."
        )
    
    # Check if source file still exists
    if batch.source_path and not Path(batch.source_path).exists():
        raise HTTPException(
            status_code=400,
            detail="Source PDF file no longer exists. Cannot retry."
        )
    
    # Reset batch status
    batch.status = "pending"
    batch.error_message = None
    batch.completed_at = None
    db.commit()
    
    # Add to queue
    queue_item = {
        "position": 1,  # High priority for retries
        "batch_id": batch_id,
        "filename": batch.source_filename,
        "status": "queued",
        "priority": 1,
        "added_at": datetime.utcnow().isoformat(),
        "is_retry": True
    }
    processing_queue.insert(0, queue_item)
    
    # Update positions
    for i, item in enumerate(processing_queue):
        item["position"] = i + 1
    
    return {
        "success": True,
        "message": "Batch queued for retry",
        "queue_position": 1
    }


@router.get("/errors")
async def list_failed_batches(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    """
    List all batches that failed processing.
    """
    start_date = datetime.utcnow() - timedelta(days=days)
    
    batches = db.query(ProcessingBatch).filter(
        ProcessingBatch.status == "error",
        ProcessingBatch.started_at >= start_date
    ).order_by(desc(ProcessingBatch.started_at)).all()
    
    return {
        "count": len(batches),
        "batches": [
            {
                "batch_id": b.batch_id,
                "filename": b.source_filename,
                "error_message": b.error_message,
                "started_at": b.started_at.isoformat() if b.started_at else None,
                "can_retry": b.source_path and Path(b.source_path).exists() if b.source_path else False
            }
            for b in batches
        ]
    }


# ============== Batch Comparison ==============

@router.post("/compare")
async def compare_batches(
    request: BatchComparisonRequest,
    db: Session = Depends(get_db)
):
    """
    Compare multiple batches side by side.
    Useful for analyzing differences between processing runs.
    """
    if len(request.batch_ids) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 batches required for comparison"
        )
    
    if len(request.batch_ids) > 5:
        raise HTTPException(
            status_code=400,
            detail="Maximum 5 batches can be compared at once"
        )
    
    comparison_data = []
    
    for batch_id in request.batch_ids:
        batch = db.query(ProcessingBatch).filter(
            ProcessingBatch.batch_id == batch_id
        ).first()
        
        if not batch:
            continue
        
        # Get order stats
        orders = db.query(Order).filter(Order.batch_id == batch_id).all()
        
        kit_type_counts = {}
        alcohol_type_counts = {}
        
        for order in orders:
            kt = order.kit_type or "unknown"
            kit_type_counts[kt] = kit_type_counts.get(kt, 0) + 1
            
            at = order.alcohol_type or "unknown"
            alcohol_type_counts[at] = alcohol_type_counts.get(at, 0) + 1
        
        comparison_data.append({
            "batch_id": batch.batch_id,
            "filename": batch.source_filename,
            "status": batch.status,
            "total_pages": batch.total_pages or 0,
            "total_stores": batch.total_stores or 0,
            "total_items": batch.total_items or 0,
            "box_counts": batch.box_counts or {},
            "kit_type_distribution": kit_type_counts,
            "alcohol_type_distribution": alcohol_type_counts,
            "started_at": batch.started_at.isoformat() if batch.started_at else None
        })
    
    # Calculate differences
    differences = {}
    
    if len(comparison_data) >= 2:
        # Compare totals
        pages = [b["total_pages"] for b in comparison_data]
        stores = [b["total_stores"] for b in comparison_data]
        
        differences = {
            "pages_differ": len(set(pages)) > 1,
            "stores_differ": len(set(stores)) > 1,
            "page_variance": max(pages) - min(pages) if pages else 0,
            "store_variance": max(stores) - min(stores) if stores else 0
        }
    
    return {
        "batches": comparison_data,
        "differences": differences
    }


# ============== Batch Statistics ==============

@router.get("/stats/summary")
async def get_batch_statistics(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    """
    Get aggregate statistics about batch processing.
    """
    start_date = datetime.utcnow() - timedelta(days=days)
    
    batches = db.query(ProcessingBatch).filter(
        ProcessingBatch.started_at >= start_date
    ).all()
    
    total = len(batches)
    completed = sum(1 for b in batches if b.status == "completed")
    failed = sum(1 for b in batches if b.status == "error")
    pending = sum(1 for b in batches if b.status in ("pending", "processing"))
    
    # Calculate average processing time
    processing_times = []
    for batch in batches:
        if batch.started_at and batch.completed_at:
            duration = (batch.completed_at - batch.started_at).total_seconds()
            processing_times.append(duration)
    
    avg_time = sum(processing_times) / len(processing_times) if processing_times else 0
    
    # Aggregate box counts
    total_box_counts = {}
    for batch in batches:
        if batch.box_counts:
            for box_type, count in batch.box_counts.items():
                total_box_counts[box_type] = total_box_counts.get(box_type, 0) + count
    
    return {
        "period_days": days,
        "total_batches": total,
        "completed": completed,
        "failed": failed,
        "pending": pending,
        "success_rate": round((completed / total * 100), 1) if total > 0 else 0,
        "average_processing_time_seconds": round(avg_time, 1),
        "total_pages_processed": sum(b.total_pages or 0 for b in batches),
        "total_stores_processed": sum(b.total_stores or 0 for b in batches),
        "box_counts": total_box_counts
    }


# ============== Cleanup ==============

@router.delete("/{batch_id}")
async def delete_batch(
    batch_id: str,
    delete_files: bool = False,
    db: Session = Depends(get_db)
):
    """
    Delete a batch and optionally its associated files.
    """
    batch = db.query(ProcessingBatch).filter(
        ProcessingBatch.batch_id == batch_id
    ).first()
    
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    # Delete associated orders and items
    orders = db.query(Order).filter(Order.batch_id == batch_id).all()
    for order in orders:
        db.query(OrderItem).filter(OrderItem.order_id == order.id).delete()
        db.delete(order)
    
    # Delete files if requested
    deleted_files = []
    if delete_files:
        if batch.source_path and Path(batch.source_path).exists():
            Path(batch.source_path).unlink()
            deleted_files.append(batch.source_path)
        
        if batch.output_path and Path(batch.output_path).exists():
            Path(batch.output_path).unlink()
            deleted_files.append(batch.output_path)
    
    # Delete batch record
    db.delete(batch)
    db.commit()
    
    # Remove from progress tracking
    if batch_id in batch_progress:
        del batch_progress[batch_id]
    
    return {
        "success": True,
        "deleted_orders": len(orders),
        "deleted_files": deleted_files
    }
