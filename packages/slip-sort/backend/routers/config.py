"""
Configuration management endpoints.
Handles parse patterns, sort configs, and blackout rules.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from core.database import get_db
from database.models import BlackoutRule, ParsePattern, SortConfig

router = APIRouter()


# ----- Pydantic Schemas -----

class RegionDefinition(BaseModel):
    """A field region for the pattern builder."""
    field: str
    x0: float  # 0-1 percentage
    y0: float
    x1: float
    y1: float
    type: str = "text"  # text, number, date


class ParsePatternCreate(BaseModel):
    """Schema for creating a parse pattern."""
    brand_id: int
    name: str
    pattern_type: str
    detection_text: str | None = None
    detection_regex: str | None = None
    regions: list[dict[str, Any]] = []


class ParsePatternResponse(BaseModel):
    """Schema for parse pattern responses."""
    id: int
    brand_id: int
    name: str
    pattern_type: str
    detection_text: str | None = None
    detection_regex: str | None = None
    regions: list[dict[str, Any]] = []
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class SortTierCategory(BaseModel):
    """A category within a sort tier."""
    id: str
    label: str
    order: int


class SortTier(BaseModel):
    """A sorting tier configuration."""
    name: str
    field: str
    enabled: bool = True
    categories: list[SortTierCategory] = []


class SortConfigCreate(BaseModel):
    """Schema for creating a sort configuration."""
    brand_id: int
    name: str
    is_default: bool = False
    tiers: list[SortTier] = []


class SortConfigResponse(BaseModel):
    """Schema for sort configuration responses."""
    id: int
    brand_id: int
    name: str
    is_default: bool
    tiers: list[dict[str, Any]] = []

    model_config = ConfigDict(from_attributes=True)


class BlackoutRuleCreate(BaseModel):
    """Schema for creating a blackout rule."""
    brand_id: int
    rule_type: str  # "hide", "redact", "replace"
    name: str
    sign_type: str | None = None
    sign_version: str | None = None
    condition_logic: dict[str, Any] | None = None
    is_enabled: bool = True


class BlackoutRuleResponse(BaseModel):
    """Schema for blackout rule responses."""
    id: int
    brand_id: int
    rule_type: str
    name: str
    sign_type: str | None = None
    sign_version: str | None = None
    condition_logic: dict[str, Any] | None = None
    is_enabled: bool

    model_config = ConfigDict(from_attributes=True)


# ----- Parse Pattern Endpoints -----

@router.get("/patterns", response_model=list[ParsePatternResponse])
async def list_patterns(
    brand_id: int | None = None,
    db: Session = Depends(get_db)
):
    """List all parse patterns, optionally filtered by brand."""
    query = db.query(ParsePattern)
    if brand_id:
        query = query.filter(ParsePattern.brand_id == brand_id)
    return query.all()


@router.post("/patterns", response_model=ParsePatternResponse, status_code=201)
async def create_pattern(
    pattern: ParsePatternCreate,
    db: Session = Depends(get_db)
):
    """Create a new parse pattern."""
    db_pattern = ParsePattern(
        brand_id=pattern.brand_id,
        name=pattern.name,
        pattern_type=pattern.pattern_type,
        detection_text=pattern.detection_text,
        detection_regex=pattern.detection_regex,
        regions=pattern.regions
    )
    db.add(db_pattern)
    db.commit()
    db.refresh(db_pattern)
    return db_pattern


@router.put("/patterns/{pattern_id}/regions")
async def update_pattern_regions(
    pattern_id: int,
    regions: list[RegionDefinition],
    db: Session = Depends(get_db)
):
    """Update the regions of a parse pattern."""
    pattern = db.query(ParsePattern).filter(ParsePattern.id == pattern_id).first()
    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found")

    pattern.regions = [r.model_dump() for r in regions]
    db.commit()

    return {"status": "success", "regions_count": len(regions)}


@router.delete("/patterns/{pattern_id}")
async def delete_pattern(pattern_id: int, db: Session = Depends(get_db)):
    """Delete a parse pattern."""
    pattern = db.query(ParsePattern).filter(ParsePattern.id == pattern_id).first()
    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found")

    db.delete(pattern)
    db.commit()

    return {"status": "deleted"}


# ----- Sort Configuration Endpoints -----

@router.get("/sort-configs", response_model=list[SortConfigResponse])
async def list_sort_configs(
    brand_id: int | None = None,
    db: Session = Depends(get_db)
):
    """List all sort configurations, optionally filtered by brand."""
    query = db.query(SortConfig)
    if brand_id:
        query = query.filter(SortConfig.brand_id == brand_id)
    return query.all()


@router.post("/sort-configs", response_model=SortConfigResponse, status_code=201)
async def create_sort_config(
    config: SortConfigCreate,
    db: Session = Depends(get_db)
):
    """Create a new sort configuration."""
    # If setting as default, unset other defaults for this brand
    if config.is_default:
        db.query(SortConfig).filter(
            SortConfig.brand_id == config.brand_id,
            SortConfig.is_default
        ).update({"is_default": False})

    db_config = SortConfig(
        brand_id=config.brand_id,
        name=config.name,
        is_default=config.is_default,
        tiers=[t.model_dump() for t in config.tiers]
    )
    db.add(db_config)
    db.commit()
    db.refresh(db_config)

    return db_config


@router.put("/sort-configs/{config_id}")
async def update_sort_config(
    config_id: int,
    config: SortConfigCreate,
    db: Session = Depends(get_db)
):
    """Update a sort configuration."""
    db_config = db.query(SortConfig).filter(SortConfig.id == config_id).first()
    if not db_config:
        raise HTTPException(status_code=404, detail="Sort config not found")

    # If setting as default, unset other defaults for this brand
    if config.is_default and not db_config.is_default:
        db.query(SortConfig).filter(
            SortConfig.brand_id == config.brand_id,
            SortConfig.is_default,
            SortConfig.id != config_id
        ).update({"is_default": False})

    db_config.name = config.name
    db_config.is_default = config.is_default
    db_config.tiers = [t.model_dump() for t in config.tiers]

    db.commit()

    return {"status": "updated"}


@router.delete("/sort-configs/{config_id}")
async def delete_sort_config(config_id: int, db: Session = Depends(get_db)):
    """Delete a sort configuration."""
    config = db.query(SortConfig).filter(SortConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Sort config not found")

    db.delete(config)
    db.commit()

    return {"status": "deleted"}


# ----- Blackout Rule Endpoints -----

@router.get("/blackout-rules", response_model=list[BlackoutRuleResponse])
async def list_blackout_rules(
    brand_id: int | None = None,
    db: Session = Depends(get_db)
):
    """List all blackout rules, optionally filtered by brand."""
    query = db.query(BlackoutRule)
    if brand_id:
        query = query.filter(BlackoutRule.brand_id == brand_id)
    return query.all()


@router.post("/blackout-rules", response_model=BlackoutRuleResponse, status_code=201)
async def create_blackout_rule(
    rule: BlackoutRuleCreate,
    db: Session = Depends(get_db)
):
    """Create a new blackout rule."""
    db_rule = BlackoutRule(
        brand_id=rule.brand_id,
        rule_type=rule.rule_type,
        name=rule.name,
        sign_type=rule.sign_type,
        sign_version=rule.sign_version,
        condition_logic=rule.condition_logic,
        is_enabled=rule.is_enabled
    )
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)

    return db_rule


@router.put("/blackout-rules/{rule_id}", response_model=BlackoutRuleResponse)
async def update_blackout_rule(
    rule_id: int,
    rule: BlackoutRuleCreate,
    db: Session = Depends(get_db)
):
    """Update a blackout rule."""
    db_rule = db.query(BlackoutRule).filter(BlackoutRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    db_rule.rule_type = rule.rule_type
    db_rule.name = rule.name
    db_rule.sign_type = rule.sign_type
    db_rule.sign_version = rule.sign_version
    db_rule.condition_logic = rule.condition_logic
    db_rule.is_enabled = rule.is_enabled

    db.commit()
    db.refresh(db_rule)

    return db_rule


@router.put("/blackout-rules/{rule_id}/toggle")
async def toggle_blackout_rule(rule_id: int, db: Session = Depends(get_db)):
    """Toggle a blackout rule's enabled status."""
    rule = db.query(BlackoutRule).filter(BlackoutRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    rule.is_enabled = not rule.is_enabled
    db.commit()

    return {"status": "toggled", "is_enabled": rule.is_enabled}


@router.delete("/blackout-rules/{rule_id}")
async def delete_blackout_rule(rule_id: int, db: Session = Depends(get_db)):
    """Delete a blackout rule."""
    rule = db.query(BlackoutRule).filter(BlackoutRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    db.delete(rule)
    db.commit()

    return {"status": "deleted"}
