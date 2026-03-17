"""
Reports Router - Reporting and analytics endpoints.

Provides:
- Daily/weekly/monthly summary reports
- Export to CSV/JSON
- Custom report builder
- Email scheduling stubs
"""

import csv
import io
import json
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Depends, Response
from pydantic import BaseModel
from sqlalchemy import func, and_, desc, extract
from sqlalchemy.orm import Session

from database.models import (
    Order, OrderItem, Store, ProcessingBatch, Brand
)
from core.database import get_db

router = APIRouter(prefix="/api/reports", tags=["Reports"])


# ============== Pydantic Models ==============

class ReportPeriod(BaseModel):
    """Report period configuration."""
    period_type: str  # "daily", "weekly", "monthly", "custom"
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ReportColumn(BaseModel):
    """Column configuration for custom reports."""
    field: str
    label: str
    aggregation: Optional[str] = None  # "count", "sum", "avg"


class CustomReportRequest(BaseModel):
    """Request for custom report generation."""
    name: str
    period: ReportPeriod
    group_by: List[str]  # ["store_code", "kit_type", etc.]
    columns: List[ReportColumn]
    filters: Optional[Dict[str, Any]] = None


class ScheduledReport(BaseModel):
    """Scheduled report configuration."""
    id: int
    name: str
    report_type: str
    schedule: str  # "daily", "weekly", "monthly"
    recipients: List[str]
    enabled: bool
    last_sent: Optional[datetime]
    next_send: Optional[datetime]


# ============== Summary Reports ==============

@router.get("/summary/daily")
async def get_daily_summary(
    date: Optional[str] = None,
    brand_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Get daily summary report.
    If no date provided, uses today.
    """
    if date:
        try:
            report_date = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        report_date = datetime.utcnow()
    
    start_of_day = report_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = start_of_day + timedelta(days=1)
    
    query = db.query(Order).filter(
        and_(
            Order.processed_at >= start_of_day,
            Order.processed_at < end_of_day
        )
    )
    
    if brand_id:
        query = query.filter(Order.brand_id == brand_id)
    
    orders = query.all()
    
    # Build summary
    summary = {
        "date": start_of_day.strftime("%Y-%m-%d"),
        "total_orders": len(orders),
        "unique_stores": len(set(o.store_code for o in orders)),
        "kit_types": {},
        "alcohol_types": {},
        "box_categories": {},
        "needs_review": sum(1 for o in orders if o.needs_manual_review),
        "batches_processed": len(set(o.batch_id for o in orders if o.batch_id))
    }
    
    for order in orders:
        # Kit types
        kt = order.kit_type or "unknown"
        summary["kit_types"][kt] = summary["kit_types"].get(kt, 0) + 1
        
        # Alcohol types
        at = order.alcohol_type or "unknown"
        summary["alcohol_types"][at] = summary["alcohol_types"].get(at, 0) + 1
        
        # Box categories
        bc = order.box_category or "unknown"
        summary["box_categories"][bc] = summary["box_categories"].get(bc, 0) + 1
    
    # Get total items
    order_ids = [o.id for o in orders]
    if order_ids:
        total_items = db.query(func.count(OrderItem.id)).filter(
            OrderItem.order_id.in_(order_ids)
        ).scalar() or 0
    else:
        total_items = 0
    
    summary["total_items"] = total_items
    
    return summary


@router.get("/summary/weekly")
async def get_weekly_summary(
    week_start: Optional[str] = None,
    brand_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Get weekly summary report.
    If no week_start provided, uses current week.
    """
    if week_start:
        try:
            start_date = datetime.strptime(week_start, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        today = datetime.utcnow()
        start_date = today - timedelta(days=today.weekday())  # Monday
    
    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_date = start_date + timedelta(days=7)
    
    query = db.query(Order).filter(
        and_(
            Order.processed_at >= start_date,
            Order.processed_at < end_date
        )
    )
    
    if brand_id:
        query = query.filter(Order.brand_id == brand_id)
    
    orders = query.all()
    
    # Daily breakdown
    daily_breakdown = {}
    for i in range(7):
        day = start_date + timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        daily_breakdown[day_str] = {
            "orders": 0,
            "items": 0
        }
    
    for order in orders:
        if order.processed_at:
            day_str = order.processed_at.strftime("%Y-%m-%d")
            if day_str in daily_breakdown:
                daily_breakdown[day_str]["orders"] += 1
    
    # Get items per day
    for day_str in daily_breakdown:
        day_orders = [o.id for o in orders if o.processed_at and o.processed_at.strftime("%Y-%m-%d") == day_str]
        if day_orders:
            items = db.query(func.count(OrderItem.id)).filter(
                OrderItem.order_id.in_(day_orders)
            ).scalar() or 0
            daily_breakdown[day_str]["items"] = items
    
    summary = {
        "week_start": start_date.strftime("%Y-%m-%d"),
        "week_end": (end_date - timedelta(days=1)).strftime("%Y-%m-%d"),
        "total_orders": len(orders),
        "unique_stores": len(set(o.store_code for o in orders)),
        "daily_breakdown": daily_breakdown,
        "averages": {
            "orders_per_day": round(len(orders) / 7, 1),
        },
        "kit_type_summary": {},
        "box_category_summary": {}
    }
    
    for order in orders:
        kt = order.kit_type or "unknown"
        summary["kit_type_summary"][kt] = summary["kit_type_summary"].get(kt, 0) + 1
        
        bc = order.box_category or "unknown"
        summary["box_category_summary"][bc] = summary["box_category_summary"].get(bc, 0) + 1
    
    return summary


@router.get("/summary/monthly")
async def get_monthly_summary(
    year: Optional[int] = None,
    month: Optional[int] = None,
    brand_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Get monthly summary report.
    If no year/month provided, uses current month.
    """
    now = datetime.utcnow()
    year = year or now.year
    month = month or now.month
    
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Month must be between 1 and 12")
    
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    
    query = db.query(Order).filter(
        and_(
            Order.processed_at >= start_date,
            Order.processed_at < end_date
        )
    )
    
    if brand_id:
        query = query.filter(Order.brand_id == brand_id)
    
    orders = query.all()
    
    # Weekly breakdown
    weekly_breakdown = {}
    week_num = 1
    current_week_start = start_date
    
    while current_week_start < end_date:
        week_end = min(current_week_start + timedelta(days=7), end_date)
        week_orders = [
            o for o in orders 
            if o.processed_at and current_week_start <= o.processed_at < week_end
        ]
        
        weekly_breakdown[f"Week {week_num}"] = {
            "start": current_week_start.strftime("%Y-%m-%d"),
            "orders": len(week_orders),
            "stores": len(set(o.store_code for o in week_orders))
        }
        
        current_week_start = week_end
        week_num += 1
    
    # Store rankings
    store_counts = {}
    for order in orders:
        store_counts[order.store_code] = store_counts.get(order.store_code, 0) + 1
    
    top_stores = sorted(store_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    
    summary = {
        "year": year,
        "month": month,
        "month_name": start_date.strftime("%B"),
        "total_orders": len(orders),
        "unique_stores": len(set(o.store_code for o in orders)),
        "weekly_breakdown": weekly_breakdown,
        "top_stores": [{"store": s[0], "orders": s[1]} for s in top_stores],
        "kit_type_summary": {},
        "alcohol_type_summary": {},
        "box_category_summary": {}
    }
    
    for order in orders:
        kt = order.kit_type or "unknown"
        summary["kit_type_summary"][kt] = summary["kit_type_summary"].get(kt, 0) + 1
        
        at = order.alcohol_type or "unknown"
        summary["alcohol_type_summary"][at] = summary["alcohol_type_summary"].get(at, 0) + 1
        
        bc = order.box_category or "unknown"
        summary["box_category_summary"][bc] = summary["box_category_summary"].get(bc, 0) + 1
    
    return summary


# ============== Export Endpoints ==============

@router.get("/export/csv")
async def export_orders_csv(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    brand_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Export orders to CSV format.
    """
    query = db.query(Order)
    
    if start_date:
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(Order.processed_at >= start)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format")
    
    if end_date:
        try:
            end = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(Order.processed_at < end)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format")
    
    if brand_id:
        query = query.filter(Order.brand_id == brand_id)
    
    orders = query.order_by(desc(Order.processed_at)).all()
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "ID", "Store Code", "Kit Type", "Alcohol Type", "Box Category",
        "Has Banner", "Has Pump Topper", "Needs Review", "Batch ID",
        "Processed At"
    ])
    
    # Data rows
    for order in orders:
        writer.writerow([
            order.id,
            order.store_code,
            order.kit_type or "",
            order.alcohol_type or "",
            order.box_category or "",
            "Yes" if order.has_banner else "No",
            "Yes" if order.has_pump_topper else "No",
            "Yes" if order.needs_manual_review else "No",
            order.batch_id or "",
            order.processed_at.isoformat() if order.processed_at else ""
        ])
    
    # Return as CSV download
    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=orders_export_{datetime.utcnow().strftime('%Y%m%d')}.csv"
        }
    )


@router.get("/export/json")
async def export_orders_json(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    brand_id: Optional[int] = None,
    include_items: bool = False,
    db: Session = Depends(get_db)
):
    """
    Export orders to JSON format.
    """
    query = db.query(Order)
    
    if start_date:
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(Order.processed_at >= start)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format")
    
    if end_date:
        try:
            end = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(Order.processed_at < end)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format")
    
    if brand_id:
        query = query.filter(Order.brand_id == brand_id)
    
    orders = query.order_by(desc(Order.processed_at)).all()
    
    export_data = []
    for order in orders:
        order_data = {
            "id": order.id,
            "store_code": order.store_code,
            "kit_type": order.kit_type,
            "alcohol_type": order.alcohol_type,
            "box_category": order.box_category,
            "has_banner": order.has_banner,
            "has_pump_topper": order.has_pump_topper,
            "needs_manual_review": order.needs_manual_review,
            "batch_id": order.batch_id,
            "processed_at": order.processed_at.isoformat() if order.processed_at else None
        }
        
        if include_items:
            items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
            order_data["items"] = [
                {
                    "sign_type": item.sign_type,
                    "promotion_name": item.promotion_name,
                    "quantity": item.quantity
                }
                for item in items
            ]
        
        export_data.append(order_data)
    
    json_content = json.dumps({"orders": export_data, "exported_at": datetime.utcnow().isoformat()}, indent=2)
    
    return Response(
        content=json_content,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=orders_export_{datetime.utcnow().strftime('%Y%m%d')}.json"
        }
    )


# ============== Custom Report Builder ==============

@router.post("/custom")
async def generate_custom_report(
    request: CustomReportRequest,
    db: Session = Depends(get_db)
):
    """
    Generate a custom report based on user-defined parameters.
    """
    # Determine date range
    if request.period.period_type == "daily":
        start_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + timedelta(days=1)
    elif request.period.period_type == "weekly":
        today = datetime.utcnow()
        start_date = (today - timedelta(days=today.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + timedelta(days=7)
    elif request.period.period_type == "monthly":
        today = datetime.utcnow()
        start_date = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if today.month == 12:
            end_date = datetime(today.year + 1, 1, 1)
        else:
            end_date = datetime(today.year, today.month + 1, 1)
    elif request.period.period_type == "custom":
        if not request.period.start_date or not request.period.end_date:
            raise HTTPException(status_code=400, detail="Custom period requires start_date and end_date")
        start_date = request.period.start_date
        end_date = request.period.end_date
    else:
        raise HTTPException(status_code=400, detail="Invalid period_type")
    
    # Base query
    query = db.query(Order).filter(
        and_(
            Order.processed_at >= start_date,
            Order.processed_at < end_date
        )
    )
    
    # Apply filters
    if request.filters:
        if "brand_id" in request.filters:
            query = query.filter(Order.brand_id == request.filters["brand_id"])
        if "kit_types" in request.filters:
            query = query.filter(Order.kit_type.in_(request.filters["kit_types"]))
        if "alcohol_types" in request.filters:
            query = query.filter(Order.alcohol_type.in_(request.filters["alcohol_types"]))
    
    orders = query.all()
    
    # Group and aggregate
    grouped_data = {}
    
    for order in orders:
        # Build group key
        group_values = []
        for group_field in request.group_by:
            value = getattr(order, group_field, None) or "unknown"
            group_values.append(str(value))
        
        group_key = " | ".join(group_values)
        
        if group_key not in grouped_data:
            grouped_data[group_key] = {
                "group": dict(zip(request.group_by, group_values)),
                "count": 0,
                "data": {}
            }
        
        grouped_data[group_key]["count"] += 1
    
    # Convert to list and sort
    results = sorted(
        grouped_data.values(),
        key=lambda x: x["count"],
        reverse=True
    )
    
    return {
        "name": request.name,
        "period": {
            "type": request.period.period_type,
            "start": start_date.isoformat(),
            "end": end_date.isoformat()
        },
        "group_by": request.group_by,
        "total_orders": len(orders),
        "groups": len(results),
        "data": results
    }


# ============== Scheduled Reports (Stubs) ==============

# In-memory storage for demo (would be database in production)
scheduled_reports: List[Dict[str, Any]] = []


@router.get("/scheduled")
async def list_scheduled_reports():
    """List all scheduled reports."""
    return {"reports": scheduled_reports}


@router.post("/scheduled")
async def create_scheduled_report(
    name: str,
    report_type: str,
    schedule: str,
    recipients: List[str]
):
    """
    Create a new scheduled report.
    Note: Email sending is stubbed - in production would integrate with email service.
    """
    report = {
        "id": len(scheduled_reports) + 1,
        "name": name,
        "report_type": report_type,
        "schedule": schedule,
        "recipients": recipients,
        "enabled": True,
        "last_sent": None,
        "next_send": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "created_at": datetime.utcnow().isoformat()
    }
    scheduled_reports.append(report)
    
    return {
        "success": True,
        "report": report,
        "message": "Report scheduled. Note: Email delivery is currently disabled in development mode."
    }


@router.put("/scheduled/{report_id}/toggle")
async def toggle_scheduled_report(report_id: int):
    """Toggle a scheduled report on/off."""
    for report in scheduled_reports:
        if report["id"] == report_id:
            report["enabled"] = not report["enabled"]
            return {"success": True, "enabled": report["enabled"]}
    
    raise HTTPException(status_code=404, detail="Scheduled report not found")


@router.delete("/scheduled/{report_id}")
async def delete_scheduled_report(report_id: int):
    """Delete a scheduled report."""
    global scheduled_reports
    original_length = len(scheduled_reports)
    scheduled_reports = [r for r in scheduled_reports if r["id"] != report_id]
    
    if len(scheduled_reports) == original_length:
        raise HTTPException(status_code=404, detail="Scheduled report not found")
    
    return {"success": True}


# ============== Batch Reports ==============

@router.get("/batches")
async def get_batch_report(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    """
    Get report on processing batches.
    """
    start_date = datetime.utcnow() - timedelta(days=days)
    
    batches = db.query(ProcessingBatch).filter(
        ProcessingBatch.started_at >= start_date
    ).order_by(desc(ProcessingBatch.started_at)).all()
    
    # Calculate stats
    total_batches = len(batches)
    total_pages = sum(b.total_pages or 0 for b in batches)
    total_stores = sum(b.total_stores or 0 for b in batches)
    
    # Status breakdown
    status_counts = {}
    for batch in batches:
        status = batch.status or "unknown"
        status_counts[status] = status_counts.get(status, 0) + 1
    
    # Box counts aggregate
    box_totals = {}
    for batch in batches:
        if batch.box_counts:
            for box_type, count in batch.box_counts.items():
                box_totals[box_type] = box_totals.get(box_type, 0) + count
    
    return {
        "period_days": days,
        "total_batches": total_batches,
        "total_pages_processed": total_pages,
        "total_stores_processed": total_stores,
        "status_breakdown": status_counts,
        "box_totals": box_totals,
        "averages": {
            "pages_per_batch": round(total_pages / total_batches, 1) if total_batches > 0 else 0,
            "stores_per_batch": round(total_stores / total_batches, 1) if total_batches > 0 else 0
        },
        "recent_batches": [
            {
                "batch_id": b.batch_id,
                "filename": b.source_filename,
                "status": b.status,
                "pages": b.total_pages,
                "stores": b.total_stores,
                "started_at": b.started_at.isoformat() if b.started_at else None
            }
            for b in batches[:10]
        ]
    }
