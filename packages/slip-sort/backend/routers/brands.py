"""
Brand management endpoints.
Handles CRUD operations for brands/clients.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from core.database import get_db
from database.models import Brand, Order, ParsePattern

router = APIRouter()


# ----- Pydantic Schemas -----

class BrandCreate(BaseModel):
    """Schema for creating a new brand."""
    name: str
    code: str | None = None
    description: str | None = None


class BrandResponse(BaseModel):
    """Schema for brand responses."""
    id: int
    name: str
    code: str | None = None
    description: str | None = None
    created_at: datetime | None = None
    pattern_count: int = 0
    store_count: int = 0
    order_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# ----- Endpoints -----

@router.get("", response_model=list[BrandResponse])
async def list_brands(db: Session = Depends(get_db)):
    """
    List all brands with aggregated statistics.

    Returns counts of patterns, stores, and orders for each brand.
    """
    brands = db.query(Brand).all()
    result = []

    for brand in brands:
        pattern_count = db.query(ParsePattern).filter(
            ParsePattern.brand_id == brand.id
        ).count()

        order_count = db.query(Order).filter(
            Order.brand_id == brand.id
        ).count()

        store_count = db.query(Order.store_code).filter(
            Order.brand_id == brand.id
        ).distinct().count()

        result.append(BrandResponse(
            id=brand.id,
            name=brand.name,
            code=getattr(brand, 'code', None),
            description=brand.description,
            created_at=brand.created_at,
            pattern_count=pattern_count,
            store_count=store_count,
            order_count=order_count
        ))

    return result


@router.post("", response_model=BrandResponse, status_code=201)
async def create_brand(brand: BrandCreate, db: Session = Depends(get_db)):
    """
    Create a new brand.

    Args:
        brand: Brand creation data

    Returns:
        Created brand with ID
    """
    # Check for duplicate name
    existing = db.query(Brand).filter(Brand.name == brand.name).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Brand with name '{brand.name}' already exists"
        )

    db_brand = Brand(
        name=brand.name,
        code=brand.code,
        description=brand.description
    )
    db.add(db_brand)
    db.commit()
    db.refresh(db_brand)

    return BrandResponse(
        id=db_brand.id,
        name=db_brand.name,
        code=db_brand.code,
        description=db_brand.description,
        created_at=db_brand.created_at,
        pattern_count=0,
        store_count=0,
        order_count=0
    )


@router.get("/{brand_id}", response_model=BrandResponse)
async def get_brand(brand_id: int, db: Session = Depends(get_db)):
    """
    Get a specific brand by ID.

    Args:
        brand_id: Brand ID to retrieve

    Returns:
        Brand details with statistics
    """
    brand = db.query(Brand).filter(Brand.id == brand_id).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    pattern_count = db.query(ParsePattern).filter(
        ParsePattern.brand_id == brand.id
    ).count()

    order_count = db.query(Order).filter(
        Order.brand_id == brand.id
    ).count()

    store_count = db.query(Order.store_code).filter(
        Order.brand_id == brand.id
    ).distinct().count()

    return BrandResponse(
        id=brand.id,
        name=brand.name,
        code=getattr(brand, 'code', None),
        description=brand.description,
        created_at=brand.created_at,
        pattern_count=pattern_count,
        store_count=store_count,
        order_count=order_count
    )


@router.put("/{brand_id}", response_model=BrandResponse)
async def update_brand(
    brand_id: int,
    brand: BrandCreate,
    db: Session = Depends(get_db)
):
    """
    Update a brand's information.

    Args:
        brand_id: Brand ID to update
        brand: Updated brand data

    Returns:
        Updated brand details
    """
    db_brand = db.query(Brand).filter(Brand.id == brand_id).first()
    if not db_brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    # Check for duplicate name (excluding current brand)
    existing = db.query(Brand).filter(
        Brand.name == brand.name,
        Brand.id != brand_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Brand with name '{brand.name}' already exists"
        )

    db_brand.name = brand.name
    db_brand.code = brand.code
    db_brand.description = brand.description

    db.commit()
    db.refresh(db_brand)

    return BrandResponse(
        id=db_brand.id,
        name=db_brand.name,
        code=db_brand.code,
        description=db_brand.description,
        created_at=db_brand.created_at,
        pattern_count=0,
        store_count=0,
        order_count=0
    )


@router.delete("/{brand_id}")
async def delete_brand(brand_id: int, db: Session = Depends(get_db)):
    """
    Delete a brand and all associated data.

    Warning: This will cascade delete all patterns, orders, and configs
    associated with this brand.

    Args:
        brand_id: Brand ID to delete

    Returns:
        Deletion confirmation message
    """
    db_brand = db.query(Brand).filter(Brand.id == brand_id).first()
    if not db_brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    # Get counts for response
    pattern_count = db.query(ParsePattern).filter(
        ParsePattern.brand_id == brand_id
    ).count()
    order_count = db.query(Order).filter(
        Order.brand_id == brand_id
    ).count()

    db.delete(db_brand)
    db.commit()

    return {
        "message": "Brand deleted successfully",
        "deleted": {
            "brand": db_brand.name,
            "patterns": pattern_count,
            "orders": order_count
        }
    }
