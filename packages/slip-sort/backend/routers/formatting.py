"""
Formatting rules router - handles selective formatting for PDF output.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy import func

from core.database import get_db
from database.models import FormattingRule, ProcessingBatch, Order, OrderItem, Store

router = APIRouter(prefix="/api/formatting-rules", tags=["formatting"])


# ============== Pydantic Schemas ==============

class FormattingStyles(BaseModel):
    """Styling options for formatting rules."""
    background_color: Optional[str] = None
    text_color: Optional[str] = "#000000"
    font_size: Optional[int] = 12
    font_weight: Optional[str] = "normal"  # normal, bold
    font_style: Optional[str] = "normal"  # normal, italic
    text_decoration: Optional[str] = "none"  # none, underline, line-through
    border_color: Optional[str] = None
    border_width: Optional[int] = 0
    opacity: Optional[int] = 100


class FormattingRuleCreate(BaseModel):
    """Schema for creating a formatting rule."""
    name: str
    target_type: str  # element, text_match, field
    target_value: str
    styles: FormattingStyles
    priority: int = 0
    enabled: bool = True
    brand_id: Optional[int] = None


class FormattingRuleResponse(BaseModel):
    """Schema for formatting rule responses."""
    id: int
    name: str
    target_type: str
    target_value: str
    styles: Dict[str, Any]
    priority: int
    enabled: bool
    brand_id: Optional[int] = None
    created_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


class FieldSuggestionsResponse(BaseModel):
    """Schema for field suggestions from processed batches."""
    elements: List[str]
    fields: List[str]
    sign_types: List[str]
    sign_versions: List[str]
    kit_types: List[str]
    states: List[str]
    box_categories: List[str]


# ============== Endpoints ==============

@router.get("", response_model=List[FormattingRuleResponse])
async def list_formatting_rules(
    brand_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """List all formatting rules, optionally filtered by brand."""
    query = db.query(FormattingRule)
    
    if brand_id:
        # Include global rules (brand_id=None) and brand-specific rules
        query = query.filter(
            (FormattingRule.brand_id == brand_id) | 
            (FormattingRule.brand_id.is_(None))
        )
    
    rules = query.order_by(FormattingRule.priority.desc()).all()
    
    return [
        FormattingRuleResponse(
            id=rule.id,
            name=rule.name,
            target_type=rule.target_type,
            target_value=rule.target_value,
            styles=rule.styles or {},
            priority=rule.priority or 0,
            enabled=rule.is_enabled,
            brand_id=rule.brand_id,
            created_at=rule.created_at
        )
        for rule in rules
    ]


@router.post("", response_model=FormattingRuleResponse, status_code=201)
async def create_formatting_rule(
    rule: FormattingRuleCreate,
    db: Session = Depends(get_db)
):
    """Create a new formatting rule."""
    db_rule = FormattingRule(
        name=rule.name,
        target_type=rule.target_type,
        target_value=rule.target_value,
        styles=rule.styles.model_dump(),
        priority=rule.priority,
        is_enabled=rule.enabled,
        brand_id=rule.brand_id
    )
    
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    
    return FormattingRuleResponse(
        id=db_rule.id,
        name=db_rule.name,
        target_type=db_rule.target_type,
        target_value=db_rule.target_value,
        styles=db_rule.styles or {},
        priority=db_rule.priority or 0,
        enabled=db_rule.is_enabled,
        brand_id=db_rule.brand_id,
        created_at=db_rule.created_at
    )


@router.get("/{rule_id}", response_model=FormattingRuleResponse)
async def get_formatting_rule(
    rule_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific formatting rule by ID."""
    rule = db.query(FormattingRule).filter(FormattingRule.id == rule_id).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Formatting rule not found")
    
    return FormattingRuleResponse(
        id=rule.id,
        name=rule.name,
        target_type=rule.target_type,
        target_value=rule.target_value,
        styles=rule.styles or {},
        priority=rule.priority or 0,
        enabled=rule.is_enabled,
        brand_id=rule.brand_id,
        created_at=rule.created_at
    )


@router.put("/{rule_id}", response_model=FormattingRuleResponse)
async def update_formatting_rule(
    rule_id: int,
    rule_update: FormattingRuleCreate,
    db: Session = Depends(get_db)
):
    """Update a formatting rule."""
    rule = db.query(FormattingRule).filter(FormattingRule.id == rule_id).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Formatting rule not found")
    
    rule.name = rule_update.name
    rule.target_type = rule_update.target_type
    rule.target_value = rule_update.target_value
    rule.styles = rule_update.styles.model_dump()
    rule.priority = rule_update.priority
    rule.is_enabled = rule_update.enabled
    rule.brand_id = rule_update.brand_id
    
    db.commit()
    db.refresh(rule)
    
    return FormattingRuleResponse(
        id=rule.id,
        name=rule.name,
        target_type=rule.target_type,
        target_value=rule.target_value,
        styles=rule.styles or {},
        priority=rule.priority or 0,
        enabled=rule.is_enabled,
        brand_id=rule.brand_id,
        created_at=rule.created_at
    )


@router.put("/{rule_id}/toggle")
async def toggle_formatting_rule(
    rule_id: int,
    db: Session = Depends(get_db)
):
    """Toggle a formatting rule's enabled status."""
    rule = db.query(FormattingRule).filter(FormattingRule.id == rule_id).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Formatting rule not found")
    
    rule.is_enabled = not rule.is_enabled
    db.commit()
    
    return {"id": rule.id, "enabled": rule.is_enabled}


@router.delete("/{rule_id}")
async def delete_formatting_rule(
    rule_id: int,
    db: Session = Depends(get_db)
):
    """Delete a formatting rule."""
    rule = db.query(FormattingRule).filter(FormattingRule.id == rule_id).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Formatting rule not found")
    
    db.delete(rule)
    db.commit()
    
    return {"success": True, "deleted_id": rule_id}


# ============== Field Suggestions ==============

@router.get("/suggestions/fields", response_model=FieldSuggestionsResponse)
async def get_field_suggestions(db: Session = Depends(get_db)):
    """
    Get available fields and values from processed batches.
    This helps users select valid targets for formatting rules.
    """
    # Default elements always available
    elements = [
        'store_header', 'item_row', 'page_footer', 'box_label',
        'kit_marker', 'wobbler_marker', 'page_header', 'summary_row'
    ]
    
    # Default data fields
    fields = [
        'store_code', 'store_name', 'sign_type', 'sign_version',
        'quantity', 'kit_type', 'alcohol_type', 'state', 'box_category',
        'promotion_name', 'order_date', 'batch_id'
    ]
    
    # Get unique sign types from order items
    sign_types_query = db.query(OrderItem.sign_type).filter(
        OrderItem.sign_type.isnot(None)
    ).distinct().limit(50)
    sign_types = [row[0] for row in sign_types_query.all() if row[0]]
    
    # Get unique sign versions/promotions
    sign_versions_query = db.query(OrderItem.promotion_name).filter(
        OrderItem.promotion_name.isnot(None)
    ).distinct().limit(50)
    sign_versions = [row[0] for row in sign_versions_query.all() if row[0]]
    
    # Get kit types
    kit_types_query = db.query(Order.kit_type).filter(
        Order.kit_type.isnot(None)
    ).distinct().limit(20)
    kit_types = [row[0] for row in kit_types_query.all() if row[0]]
    
    # Get states
    states_query = db.query(Store.state).filter(
        Store.state.isnot(None)
    ).distinct().limit(60)
    states = [row[0] for row in states_query.all() if row[0]]
    
    # Get box categories from batches
    box_categories = []
    batches = db.query(ProcessingBatch.box_counts).filter(
        ProcessingBatch.box_counts.isnot(None)
    ).limit(10).all()
    for batch in batches:
        if batch[0]:
            box_categories.extend(list(batch[0].keys()))
    box_categories = list(set(box_categories))[:20]
    
    return FieldSuggestionsResponse(
        elements=elements,
        fields=fields,
        sign_types=sign_types,
        sign_versions=sign_versions,
        kit_types=kit_types if kit_types else ['both', 'both_limited', 'counter', 'counter_limited', 'shipper', 'shipper_limited', 'neither'],
        states=states if states else ['NY', 'PA', 'OH', 'WV', 'MD'],
        box_categories=box_categories if box_categories else ['8x8x30', '28x2x44', '8x8x36']
    )
