"""
Packing Slip Manager - FastAPI Backend
Main application entry point.
"""

import os
import uuid
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, Query, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session as DBSession

from database.models import (
    init_database, get_session, seed_default_data,
    Brand, ParsePattern, Store, Order, OrderItem, 
    SortConfig, BlackoutRule, ProcessingBatch,
    User, APIKey, AuditLog, UserSession, FormattingRule, BrandSettings
)
from services.pdf_parser import PDFParser, ExtractedStore
from core.logging import configure_logging, get_logger, audit_log
from core.database import get_db

# Configuration
DB_PATH = os.environ.get("DB_PATH", "packing_slip_manager.db")
UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")

# Ensure directories exist
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# Configure logging at module load
configure_logging()
logger = get_logger(__name__)

# Database engine
engine = None
Session = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    global engine, Session
    from sqlalchemy.orm import sessionmaker
    from core.database import init_database as init_core_db
    
    logger.info("Starting Packing Slip Manager...")
    
    # Initialize database on startup
    engine = init_database(DB_PATH)
    Session = sessionmaker(bind=engine)
    
    # Also initialize core.database for router dependency injection
    init_core_db(DB_PATH)
    
    # Seed default data
    session = Session()
    seed_default_data(session)
    session.close()
    
    logger.info("Database initialized, application ready")
    audit_log("Application started", audit_type="SYSTEM")
    
    yield
    
    # Cleanup on shutdown
    logger.info("Shutting down Packing Slip Manager...")
    audit_log("Application stopped", audit_type="SYSTEM")
    if engine:
        engine.dispose()


app = FastAPI(
    title="Packing Slip Manager",
    description="PDF packing slip parsing, sorting, and management system",
    version="2.0.0",
    lifespan=lifespan
)

# CORS for frontend
from core.config import settings as app_settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=app_settings.cors_origins,
    allow_origin_regex=app_settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add request timing and audit middleware
from core.middleware import RequestTimingMiddleware, AuditMiddleware
app.add_middleware(AuditMiddleware)
app.add_middleware(RequestTimingMiddleware)

# Include modular routers (Day 3 additions)
from routers.orders import router as orders_router
from routers.reports import router as reports_router
from routers.batches import router as batches_router
from routers.config_management import router as config_mgmt_router
from routers.integrations import router as integrations_router
from routers.erp_sync import router as erp_sync_router
from routers.formatting import router as formatting_router
from routers.brands import router as brands_router
from routers.config import router as config_router
from routers.health import router as health_router

app.include_router(orders_router)
app.include_router(reports_router)
app.include_router(batches_router)
app.include_router(config_mgmt_router)
app.include_router(integrations_router)
app.include_router(erp_sync_router)
app.include_router(formatting_router)
app.include_router(brands_router, prefix="/api/brands", tags=["Brands"])
app.include_router(config_router, prefix="/api", tags=["Configuration"])
app.include_router(health_router, tags=["Health"])


# ============== Pydantic Models (only those used by main.py endpoints) ==============

class BrandSettingsUpdate(BaseModel):
    """Schema for updating brand settings."""
    box_categories: Optional[Dict[str, Any]] = None
    default_standard_box: Optional[str] = None
    large_box_capacity_limit: Optional[int] = None
    predetermined_wobblers: Optional[List[str]] = None
    sign_type_keywords: Optional[Dict[str, List[str]]] = None
    size_order: Optional[List[str]] = None
    large_item_types: Optional[List[str]] = None
    pdf_margin_left: Optional[int] = None
    pdf_margin_right: Optional[int] = None
    pdf_margin_top: Optional[int] = None
    pdf_margin_bottom: Optional[int] = None
    pdf_line_leading: Optional[float] = None
    kit_marker_patterns: Optional[Dict[str, Any]] = None
    wobbler_kit_threshold: Optional[int] = None
    output_filename_pattern: Optional[str] = None


class BrandSettingsResponse(BaseModel):
    """Schema for brand settings response."""
    id: int
    brand_id: int
    box_categories: Dict[str, Any]
    default_standard_box: str
    large_box_capacity_limit: int
    predetermined_wobblers: List[str]
    sign_type_keywords: Dict[str, List[str]]
    size_order: List[str]
    large_item_types: List[str]
    pdf_margin_left: int
    pdf_margin_right: int
    pdf_margin_top: int
    pdf_margin_bottom: int
    pdf_line_leading: float
    kit_marker_patterns: Dict[str, Any]
    wobbler_kit_threshold: int
    output_filename_pattern: str
    
    model_config = ConfigDict(from_attributes=True)


class ProcessingResult(BaseModel):
    batch_id: str
    total_stores: int
    total_items: int
    box_counts: Dict[str, int]
    stores: List[Dict[str, Any]]


# ============== API Routes ==============

# ----- Brand Settings (not duplicated in routers) -----

@app.get("/api/brand-settings", response_model=BrandSettingsResponse)
async def get_brand_settings(brand_id: int = 1, db: DBSession = Depends(get_db)):
    """Get all configurable settings for a brand."""
    settings = db.query(BrandSettings).filter(BrandSettings.brand_id == brand_id).first()
    if not settings:
        settings = BrandSettings(brand_id=brand_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@app.put("/api/brand-settings", response_model=BrandSettingsResponse)
async def update_brand_settings(updates: BrandSettingsUpdate, brand_id: int = 1, db: DBSession = Depends(get_db)):
    """Update configurable settings for a brand."""
    settings = db.query(BrandSettings).filter(BrandSettings.brand_id == brand_id).first()
    if not settings:
        settings = BrandSettings(brand_id=brand_id)
        db.add(settings)
    
    # Apply updates - only allow fields defined in BrandSettingsUpdate schema
    update_data = updates.model_dump(exclude_unset=True)
    allowed_fields = set(BrandSettingsUpdate.model_fields.keys())
    for field, value in update_data.items():
        if value is not None and field in allowed_fields:
            setattr(settings, field, value)
    
    db.commit()
    db.refresh(settings)
    return settings


@app.patch("/api/brand-settings/{setting_name}")
async def update_single_setting(setting_name: str, value: Any = Body(...), brand_id: int = 1, db: DBSession = Depends(get_db)):
    """Update a single setting by name."""
    # Only allow fields defined in the BrandSettingsUpdate schema
    allowed_fields = set(BrandSettingsUpdate.model_fields.keys())
    if setting_name not in allowed_fields:
        raise HTTPException(status_code=400, detail=f"Unknown or disallowed setting: {setting_name}")
    
    settings = db.query(BrandSettings).filter(BrandSettings.brand_id == brand_id).first()
    if not settings:
        settings = BrandSettings(brand_id=brand_id)
        db.add(settings)
    
    setattr(settings, setting_name, value)
    db.commit()
    return {"status": "updated", "setting": setting_name, "value": value}


@app.post("/api/brand-settings/reset")
async def reset_brand_settings(brand_id: int = 1, db: DBSession = Depends(get_db)):
    """Reset all settings to defaults."""
    settings = db.query(BrandSettings).filter(BrandSettings.brand_id == brand_id).first()
    if settings:
        db.delete(settings)
    
    new_settings = BrandSettings(brand_id=brand_id)
    db.add(new_settings)
    db.commit()
    db.refresh(new_settings)
    return {"status": "reset", "message": "All settings restored to defaults"}


# ----- PDF Processing -----

# Maximum upload size: 100MB
MAX_UPLOAD_SIZE = 100 * 1024 * 1024


def _validate_uuid(file_id: str) -> str:
    """Validate that file_id is a proper UUID to prevent path traversal."""
    try:
        validated = str(uuid.UUID(file_id))
        return validated
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid file ID format")


@app.post("/api/pdf/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """Upload a PDF for processing."""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Generate unique filename
    file_id = str(uuid.uuid4())
    filename = f"{file_id}_{file.filename}"
    filepath = UPLOAD_DIR / filename
    
    # Read with size limit
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024*1024)}MB")
    with open(filepath, 'wb') as f:
        f.write(content)
    
    # Get PDF info
    parser = PDFParser()
    info = parser.get_pdf_info(str(filepath))
    
    return {
        "file_id": file_id,
        "filename": file.filename,
        "filepath": str(filepath),
        "page_count": info['page_count']
    }


@app.get("/api/pdf/{file_id}/page/{page_num}")
async def get_pdf_page_image(file_id: str, page_num: int):
    """Get a rendered image of a PDF page for the pattern builder."""
    file_id = _validate_uuid(file_id)
    # Find the file
    files = list(UPLOAD_DIR.glob(f"{file_id}_*"))
    if not files:
        raise HTTPException(status_code=404, detail="PDF not found")
    
    filepath = files[0]
    parser = PDFParser()
    
    with parser.open_pdf(str(filepath)) as doc:
        if page_num < 0 or page_num >= len(doc):
            raise HTTPException(status_code=400, detail="Invalid page number")
        
        image_b64 = parser.get_page_image(doc, page_num)
        return {"image": image_b64, "page_num": page_num}


@app.post("/api/pdf/{file_id}/process")
async def process_pdf(file_id: str, brand_id: int = Query(...)):
    """Process a PDF and extract all store orders."""
    file_id = _validate_uuid(file_id)
    session = Session()
    try:
        # Find the file
        files = list(UPLOAD_DIR.glob(f"{file_id}_*"))
        if not files:
            raise HTTPException(status_code=404, detail="PDF not found")
        
        filepath = files[0]
        
        # Create batch record
        batch_id = str(uuid.uuid4())
        batch = ProcessingBatch(
            batch_id=batch_id,
            source_filename=filepath.name,
            source_path=str(filepath),
            brand_id=brand_id,
            status="processing"
        )
        session.add(batch)
        session.commit()
        
        # Parse PDF
        parser = PDFParser()
        extracted_stores = parser.parse_pdf(str(filepath))
        
        # Store results in database
        box_counts = {}
        store_results = []
        
        for es in extracted_stores:
            # Find or create store
            store = session.query(Store).filter(Store.store_code == es.store_code).first()
            if not store:
                store = Store(
                    store_code=es.store_code,
                    name=es.store_name,
                    state=es.location,
                    store_class=es.store_class
                )
                session.add(store)
                session.flush()
            
            # Create order
            order = Order(
                brand_id=brand_id,
                store_id=store.id,
                store_code=es.store_code,
                kit_type=es.kit_type,
                alcohol_type=es.alcohol_type,
                has_banner=es.has_banner,
                has_pump_topper=es.has_pump_topper,
                source_pdf=str(filepath),
                source_pages=es.pages,
                raw_text=es.raw_text,
                batch_id=batch_id
            )
            
            # Determine box category (simplified)
            box_cat = determine_box_category(es)
            order.box_category = box_cat
            box_counts[box_cat] = box_counts.get(box_cat, 0) + 1
            
            session.add(order)
            session.flush()
            
            # Add items
            for item in es.items:
                order_item = OrderItem(
                    order_id=order.id,
                    sign_type=item.sign_type,
                    promotion_name=item.promotion_name,
                    quantity=item.quantity,
                    raw_text=item.raw_text
                )
                session.add(order_item)
            
            store_results.append({
                "store_code": es.store_code,
                "store_name": es.store_name,
                "kit_type": es.kit_type,
                "alcohol_type": es.alcohol_type,
                "box_category": box_cat,
                "item_count": len(es.items),
                "pages": es.pages
            })
        
        # Update batch
        batch.status = "completed"
        batch.total_stores = len(extracted_stores)
        batch.total_items = sum(len(s.items) for s in extracted_stores)
        batch.total_pages = sum(len(s.pages) for s in extracted_stores)
        batch.box_counts = box_counts
        batch.completed_at = datetime.now(timezone.utc)
        
        session.commit()
        
        return ProcessingResult(
            batch_id=batch_id,
            total_stores=len(extracted_stores),
            total_items=batch.total_items,
            box_counts=box_counts,
            stores=store_results
        )
    
    except Exception as e:
        session.rollback()
        logger.error(f"PDF processing failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="PDF processing failed")
    finally:
        session.close()


def determine_box_category(store: ExtractedStore) -> str:
    """Determine box category for a store based on its items using full boxing logic."""
    # Convert ExtractedStore items to the format expected by analyze_order_boxing
    items = [{
        'type': item.sign_type or '',
        'promo': item.promotion_name or '',
        'qty': item.quantity or 1
    } for item in store.items]
    
    # Use the full analyze_order_boxing function
    result = analyze_order_boxing(items, standard_box_label="8x8x30")
    
    if result.get("manual_flag"):
        return "28x2x44"  # Default to large box for manual review
    
    return result.get("category") or "8x8x30"


# ----- PDF Modification Helpers -----

def apply_blackout_rules(page, blackout_rules, order_items):
    """
    Apply blackout rules to a PDF page.
    
    Rules can be:
    - "cancelled": Always blackout matching items
    - "conditional": Blackout target when conditions are met
    """
    import fitz
    
    blacked_out = 0
    
    # Normalize order items for condition checking
    order_item_texts = [
        canonicalize(f"{item.get('sign_type', '')} {item.get('promo', '')}")
        for item in order_items
    ]
    
    for rule in blackout_rules:
        if not rule.is_enabled:
            continue
        
        items_to_blackout = []
        
        if rule.rule_type == 'cancelled':
            # Simple always-blackout rule
            sign_type = canonicalize(rule.sign_type or '')
            sign_version = canonicalize(rule.sign_version or '')
            items_to_blackout.append((sign_type, sign_version))
            
        elif rule.rule_type == 'conditional' and rule.condition_logic:
            # Check if conditions are met
            logic = rule.condition_logic
            conditions = logic.get('conditions', [])
            operator = logic.get('operator', 'AND')
            target = logic.get('target', {})
            
            # Check conditions
            condition_results = []
            for cond in conditions:
                field = cond.get('field', 'item_contains')
                value = canonicalize(cond.get('value', ''))
                
                if field == 'item_contains':
                    # Check if any order item contains this value as a proper segment
                    # (prevents 'alcohol version' from matching 'non-alcohol version')
                    matched = any(_segment_match(value, item_text) for item_text in order_item_texts)
                    condition_results.append(matched)
            
            # Apply operator
            if operator == 'AND':
                conditions_met = all(condition_results) if condition_results else False
            else:  # OR
                conditions_met = any(condition_results) if condition_results else False
            
            if conditions_met:
                # Blackout target items
                target_field = target.get('field', 'item_contains')
                target_value = canonicalize(target.get('value', ''))
                
                if target_field == 'item_contains' and target_value:
                    items_to_blackout.append(('', target_value))
        
        # Apply blackouts
        for sign_type, sign_version in items_to_blackout:
            # Search for the text on the page
            search_text = sign_version if sign_version else sign_type
            if not search_text or len(search_text) < 3:
                continue
            
            # Search for partial matches
            search_terms = [search_text[:min(40, len(search_text))]]
            
            for term in search_terms:
                try:
                    instances = page.search_for(term, quads=False)
                    for rect in instances:
                        # Expand rect to cover the full row
                        expanded_rect = fitz.Rect(
                            page.rect.x0 + 10,
                            rect.y0 - 2,
                            page.rect.x1 - 10,
                            rect.y1 + 2
                        )
                        page.draw_rect(expanded_rect, color=(0, 0, 0), fill=(0, 0, 0))
                        blacked_out += 1
                except Exception:
                    pass
    
    return blacked_out


# Note: Kit highlighting is now handled by apply_formatting_rules() using database-driven rules
# The old hardcoded apply_kit_highlights() function has been removed


def hex_to_rgb(hex_color: str) -> tuple:
    """Convert hex color (#RRGGBB) to RGB tuple (0-1 range)."""
    hex_color = hex_color.lstrip('#')
    if len(hex_color) != 6:
        return (1.0, 1.0, 0.0)  # Default yellow on error
    try:
        r = int(hex_color[0:2], 16) / 255
        g = int(hex_color[2:4], 16) / 255
        b = int(hex_color[4:6], 16) / 255
        return (r, g, b)
    except ValueError:
        return (1.0, 1.0, 0.0)  # Default yellow on error


def apply_formatting_rules(page, formatting_rules: list) -> int:
    """
    Apply user-defined formatting rules from the database to a PDF page.
    
    Supports:
    - text_match: Highlight text that contains the target value
    - element: (future) Style specific PDF elements
    - field: (future) Style specific data fields
    
    Args:
        page: PyMuPDF page object
        formatting_rules: List of FormattingRule database objects
        
    Returns:
        Number of formatting operations applied
    """
    import fitz
    
    formatted = 0
    already_highlighted = set()  # Track what we've already highlighted to avoid duplicates
    
    for rule in formatting_rules:
        if not rule.is_enabled:
            continue
            
        target_type = rule.target_type
        target_value = rule.target_value
        styles = rule.styles or {}
        
        if not target_value:
            continue
        
        # Currently support text_match for highlighting
        if target_type == 'text_match':
            bg_color = styles.get('background_color')
            text_color = styles.get('text_color', '#000000')
            opacity = (styles.get('opacity', 100) or 100) / 100
            
            if not bg_color:
                continue
            
            color_rgb = hex_to_rgb(bg_color)
            
            try:
                # Clean the pattern - remove asterisks for exact matching
                clean_pattern = target_value.strip('*').strip()
                
                if len(clean_pattern) < 5:  # Require minimum length to avoid false matches
                    continue
                
                # Search for exact text match only
                instances = page.search_for(clean_pattern, quads=True)
                
                for quad in instances:
                    # Create a unique key for this match location
                    key = (round(quad.rect.x0, 2), round(quad.rect.y0, 2), clean_pattern)
                    if key in already_highlighted:
                        continue
                    already_highlighted.add(key)
                    
                    # Apply highlight with background color
                    page.draw_quad(
                        quad, 
                        color=None, 
                        width=0, 
                        fill=color_rgb, 
                        fill_opacity=opacity * 0.7,  # Semi-transparent
                        overlay=True
                    )
                    
                    # If white text is requested, add a text overlay
                    # Note: PyMuPDF can't change existing text color, so we add
                    # a stronger background to make dark text appear lighter
                    if text_color and text_color.upper() == '#FFFFFF':
                        # Add a second pass with higher opacity for white text effect
                        page.draw_quad(
                            quad,
                            color=None,
                            width=0,
                            fill=color_rgb,
                            fill_opacity=0.85,  # Higher opacity for white text effect
                            overlay=True
                        )
                    
                    formatted += 1
                    
            except Exception as e:
                logger.warning(f"Failed to apply formatting rule '{rule.name}': {e}")
                pass
    
    return formatted


# ----- Sorted PDF Generation -----

@app.post("/api/batches/{batch_id}/generate-sorted-pdf")
async def generate_sorted_pdf(batch_id: str):
    """
    Generate a sorted PDF from a processed batch.
    
    This sorts orders by box category and configurable tiers,
    then creates a new PDF with pages in sorted order.
    Also applies blackout rules and kit highlighting.
    """
    import fitz
    
    session = Session()
    try:
        # Get the batch
        batch = session.query(ProcessingBatch).filter(
            ProcessingBatch.batch_id == batch_id
        ).first()
        
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        
        source_path = batch.source_path
        if not source_path or not Path(source_path).exists():
            raise HTTPException(status_code=404, detail="Source PDF not found")
        
        # Get blackout rules for this brand
        brand_id = batch.brand_id or 1
        blackout_rules = session.query(BlackoutRule).filter(
            BlackoutRule.brand_id == brand_id,
            BlackoutRule.is_enabled == True
        ).all()
        
        # Get formatting rules for this brand (replaces hardcoded kit highlights)
        formatting_rules = session.query(FormattingRule).filter(
            FormattingRule.is_enabled == True,
            (FormattingRule.brand_id == brand_id) | (FormattingRule.brand_id.is_(None))
        ).order_by(FormattingRule.priority.desc()).all()
        
        # Get all orders from this batch with their pages
        orders = session.query(Order).filter(Order.batch_id == batch_id).all()
        
        if not orders:
            raise HTTPException(status_code=400, detail="No orders found in batch")
        
        # Build store data with page info
        stores_data = []
        for order in orders:
            store = session.query(Store).filter(Store.id == order.store_id).first() if order.store_id else None
            items = session.query(OrderItem).filter(OrderItem.order_id == order.id).all()
            
            # Handle source_pages - may be stored as JSON string
            pages = order.source_pages or []
            if isinstance(pages, str):
                try:
                    pages = json.loads(pages)
                except:
                    pages = []
            
            stores_data.append({
                'order_id': order.id,
                'store_code': order.store_code,
                'store_name': store.name if store else order.store_code,
                'store_class': store.store_class if store else '',
                'location': store.state if store else '',
                'kit_type': order.kit_type or 'neither',
                'alcohol_type': order.alcohol_type or 'none',
                'box_category': order.box_category or '8x8x30',
                'has_banner': order.has_banner,
                'has_pump_topper': order.has_pump_topper,
                'pages': pages,
                'items': [{'sign_type': i.sign_type, 'promo': i.promotion_name, 'qty': i.quantity} for i in items]
            })
        
        # Group by box category
        buckets = {
            '28x2x44': [],
            '8x8x36': [],
            '8x8x30': [],
            'Stay Flat Envelope': [],
            'Padded Envelope': [],
            'Padded Pack': [],
        }
        
        for s in stores_data:
            cat = s['box_category']
            if cat not in buckets:
                buckets[cat] = []
            buckets[cat].append(s)
        
        # Sort each bucket by store type rank, location, store name
        type_rank = {
            'M': 0,  # Minit Mart
            'S': 1,  # Red Apple
            'A': 2,  # Kwik Fill
        }
        
        def store_sort_key(s):
            code = s['store_code'] or ''
            prefix = code[0].upper() if code else 'Z'
            rank = type_rank.get(prefix, 999)
            location = s.get('location', '') or ''
            name = s.get('store_name', '') or ''
            return (rank, location, name)
        
        for cat in buckets:
            buckets[cat].sort(key=store_sort_key)
        
        # Track stats
        total_blackouts = 0
        total_highlights = 0
        
        # Open source PDF and create output
        with fitz.open(source_path) as src_doc:
            out_doc = fitz.open()
            
            # Helper to copy pages for a store and apply modifications
            def copy_store_pages(store_data):
                nonlocal total_blackouts, total_highlights
                pages = store_data.get('pages', [])
                items = store_data.get('items', [])
                
                for page_num in pages:
                    if 0 <= page_num < len(src_doc):
                        out_doc.insert_pdf(src_doc, from_page=page_num, to_page=page_num)
                        
                        # Get the page we just inserted
                        page = out_doc[-1]
                        
                        # Apply blackout rules
                        total_blackouts += apply_blackout_rules(page, blackout_rules, items)
                        
                        # Apply database-driven formatting rules (replaces hardcoded kit highlights)
                        if formatting_rules:
                            total_highlights += apply_formatting_rules(page, formatting_rules)
            
            # Helper to add a section header page using TextWriter
            def add_section_header(title):
                page = out_doc.new_page()
                tw = fitz.TextWriter(page.rect)
                tw.append((page.rect.width / 2 - 150, 100), title, fontsize=24)
                tw.write_text(page)
                return page
            
            # Build the sorted PDF
            page_counts = {}
            
            # Order of sections
            section_order = [
                ('28x2x44', 'BOX STORES — 28×2×44'),
                ('8x8x36', 'BOX STORES — 8×8×36 (Banner present)'),
                ('8x8x30', 'BOX STORES — Standard (8×8×30)'),
                ('Stay Flat Envelope', 'ENVELOPE — Stay Flat'),
                ('Padded Envelope', 'ENVELOPE — Padded Envelope'),
                ('Padded Pack', 'ENVELOPE — Padded Pack'),
            ]
            
            for cat, section_title in section_order:
                stores_in_cat = buckets.get(cat, [])
                if not stores_in_cat:
                    continue
                
                # Add section header
                add_section_header(f"{section_title} ({len(stores_in_cat)} stores)")
                page_counts[cat] = len(stores_in_cat)
                
                # Copy all store pages
                for store_data in stores_in_cat:
                    copy_store_pages(store_data)
            
            # Add summary page at the beginning
            summary_page = out_doc.new_page(pno=0)
            tw = fitz.TextWriter(summary_page.rect)
            
            y = 50
            font_size = 14
            line_height = 20
            
            # Title
            tw.append((50, y + 24), "Order Packaging Summary", fontsize=24)
            y += 50
            
            # Stats
            for cat, title in section_order:
                count = page_counts.get(cat, 0)
                if count > 0:
                    tw.append((50, y + font_size), f"{title}: {count}", fontsize=font_size)
                    y += line_height
            
            # Total
            y += 10
            tw.append((50, y + font_size + 2), f"Total Stores: {len(stores_data)}", fontsize=font_size + 2)
            
            tw.write_text(summary_page)
            
            # Save output
            output_filename = f"sorted_{batch_id[:8]}_{Path(source_path).stem}.pdf"
            output_path = OUTPUT_DIR / output_filename
            out_doc.save(str(output_path))
            out_doc.close()
        
        # Update batch with output path
        batch.output_path = str(output_path)
        session.commit()
        
        return {
            "success": True,
            "batch_id": batch_id,
            "output_filename": output_filename,
            "output_path": str(output_path),
            "total_stores": len(stores_data),
            "section_counts": page_counts,
            "download_url": f"/api/batches/{batch_id}/download-sorted-pdf"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        logger.error(f"Sorted PDF generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Sorted PDF generation failed")
    finally:
        session.close()


@app.get("/api/batches/{batch_id}/download-sorted-pdf")
async def download_sorted_pdf(batch_id: str):
    """Download the sorted PDF for a batch."""
    session = Session()
    try:
        batch = session.query(ProcessingBatch).filter(
            ProcessingBatch.batch_id == batch_id
        ).first()
        
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        
        output_path = batch.output_path
        if not output_path or not Path(output_path).exists():
            raise HTTPException(status_code=404, detail="Sorted PDF not found. Generate it first.")
        
        return FileResponse(
            path=output_path,
            filename=Path(output_path).name,
            media_type="application/pdf"
        )
    finally:
        session.close()


# ----- Orders & History -----

@app.get("/api/stores")
async def list_stores(db: DBSession = Depends(get_db)):
    """List all unique stores from orders."""
    stores = db.query(Store).all()
    return [
        {
            "id": s.id,
            "store_code": s.store_code,
            "name": s.name or s.store_code,
            "city": s.city,
            "state": s.state
        }
        for s in stores
    ]


@app.get("/api/orders/history")
async def get_orders_history():
    """Get orders history with batches for the OrderHistory component."""
    session = Session()
    try:
        # Get batches
        batches = session.query(ProcessingBatch).order_by(
            ProcessingBatch.started_at.desc()
        ).limit(50).all()
        
        batch_list = [
            {
                "id": b.id,
                "batch_id": b.batch_id,
                "source_filename": b.source_filename,
                "total_pages": b.total_pages,
                "total_stores": b.total_stores,
                "store_count": b.total_stores,
                "total_items": b.total_items,
                "box_counts": b.box_counts,
                "status": b.status,
                "processed_at": b.started_at.isoformat() if b.started_at else None
            }
            for b in batches
        ]
        
        # Get recent orders
        orders = session.query(Order).order_by(
            Order.processed_at.desc()
        ).limit(100).all()
        
        order_list = []
        for o in orders:
            item_count = session.query(OrderItem).filter(OrderItem.order_id == o.id).count()
            # Get store name
            store = session.query(Store).filter(Store.id == o.store_id).first() if o.store_id else None
            order_list.append({
                "id": o.id,
                "store_code": o.store_code,
                "store_name": store.name if store else o.store_code,
                "store_number": o.store_code,
                "store_id": o.store_id,
                "kit_type": o.kit_type,
                "alcohol_type": o.alcohol_type,
                "box_category": o.box_category,
                "item_count": item_count,
                "processed_at": o.processed_at.isoformat() if o.processed_at else None,
                "batch_id": o.batch_id
            })
        
        return {"batches": batch_list, "orders": order_list}
    finally:
        session.close()


@app.get("/api/orders")
async def list_orders(
    brand_id: Optional[int] = None,
    batch_id: Optional[str] = None,
    store_code: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0)
):
    session = Session()
    try:
        query = session.query(Order)
        
        if brand_id:
            query = query.filter(Order.brand_id == brand_id)
        if batch_id:
            query = query.filter(Order.batch_id == batch_id)
        if store_code:
            query = query.filter(Order.store_code.ilike(f"%{store_code}%"))
        
        total = query.count()
        orders = query.order_by(Order.processed_at.desc()).offset(offset).limit(limit).all()
        
        results = []
        for o in orders:
            item_count = session.query(OrderItem).filter(OrderItem.order_id == o.id).count()
            # Get store info if available
            store = session.query(Store).filter(Store.id == o.store_id).first() if o.store_id else None
            results.append({
                "id": o.id,
                "brand_id": o.brand_id,
                "store_code": o.store_code,
                "store_name": store.name if store else o.store_code,
                "store_number": o.store_code,
                "store_type": o.store_type,
                "kit_type": o.kit_type,
                "alcohol_type": o.alcohol_type,
                "box_category": o.box_category,
                "has_banner": o.has_banner,
                "has_pump_topper": o.has_pump_topper,
                "needs_manual_review": o.needs_manual_review,
                "processed_at": o.processed_at.isoformat(),
                "item_count": item_count,
                "batch_id": o.batch_id
            })
        
        return {"total": total, "orders": results}
    finally:
        session.close()


@app.get("/api/orders/{order_id}")
async def get_order_details(order_id: int):
    session = Session()
    try:
        order = session.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        items = session.query(OrderItem).filter(OrderItem.order_id == order_id).all()
        
        return {
            "order": {
                "id": order.id,
                "store_code": order.store_code,
                "kit_type": order.kit_type,
                "alcohol_type": order.alcohol_type,
                "box_category": order.box_category,
                "has_banner": order.has_banner,
                "has_pump_topper": order.has_pump_topper,
                "source_pages": order.source_pages,
                "processed_at": order.processed_at.isoformat()
            },
            "items": [
                {
                    "id": item.id,
                    "sign_type": item.sign_type,
                    "promotion_name": item.promotion_name,
                    "quantity": item.quantity
                }
                for item in items
            ]
        }
    finally:
        session.close()


@app.get("/api/batches")
async def list_batches(limit: int = Query(default=50, ge=1, le=500)):
    session = Session()
    try:
        batches = session.query(ProcessingBatch).order_by(
            ProcessingBatch.started_at.desc()
        ).limit(limit).all()
        
        return [
            {
                "batch_id": b.batch_id,
                "source_filename": b.source_filename,
                "total_stores": b.total_stores,
                "total_items": b.total_items,
                "box_counts": b.box_counts,
                "status": b.status,
                "started_at": b.started_at.isoformat() if b.started_at else None,
                "completed_at": b.completed_at.isoformat() if b.completed_at else None
            }
            for b in batches
        ]
    finally:
        session.close()


# ----- Wobbler Kits -----

class WobblerKitItem(BaseModel):
    promo: str
    qty: int


class WobblerKit(BaseModel):
    kit_name: str
    items: List[WobblerKitItem]
    stores: List[str]
    store_ids: List[int]
    store_count: int


class KitRenumbering(BaseModel):
    original_name: str
    new_number: int


class ApplyWobblerKitsRequest(BaseModel):
    kit_names: List[str]
    kit_renumbering: Optional[List[KitRenumbering]] = None  # Sequential renumbering


class GenerateFinalOutputRequest(BaseModel):
    apply_sort_config: bool = True
    apply_blackout_rules: bool = True
    wobbler_kit_names: Optional[List[str]] = None
    wobbler_kit_renumbering: Optional[List[KitRenumbering]] = None


def canonicalize(text: str) -> str:
    """Normalize text for comparison."""
    import re
    return re.sub(r'\s+', ' ', text.lower().strip())


def _segment_match(value: str, text: str) -> bool:
    """
    Check if 'value' appears as a proper segment in 'text', NOT as a
    substring inside a hyphenated compound word.

    Examples:
        _segment_match('alcohol version', 'shelf wobbler alcohol version')  -> True
        _segment_match('alcohol version', 'non-alcohol version')            -> False
        _segment_match('non-alcohol version', 'non-alcohol version')        -> True
    """
    import re
    if not value or not text:
        return False
    if text == value:
        return True
    # Negative lookbehind: value must NOT be preceded by a letter or hyphen
    # (prevents matching inside hyphenated compounds like 'non-alcohol')
    # Negative lookahead: value must NOT be followed by a letter or hyphen
    pattern = r'(?<![a-z\-])' + re.escape(value) + r'(?![a-z\-])'
    return bool(re.search(pattern, text))


# Page / layout constants for PDF generation
MARGIN_L = 72
MARGIN_R = 72
MARGIN_T = 72
MARGIN_B = 72
LEADING = 1.2

# ===== KFSORT-style Boxing Classification =====

# Sign type keywords for classification
KW = {
    "banner": ("banner sign",),
    "yard": ("yard sign",),
    "aframe": ("a frame", "a-frame"),
    "bollard": ("bollard cover",),
    "polekit": ("pole sign kit", "pole sign"),
    "windmaster": ("windmaster",),
    "door_24x36": ("door decal 24x36", "door sign 24x36"),
    "door_6x30": ("door decal 24x6", "Door Decal; 24\"W X 6\"H"),
    "window_sign": ("window sign",),
    "pump_topper": ("pump topper",),
    "corner_cooler": ("corner cooler cling", "corner cooler"),
    "starburst": ("starbursts",),
    "wobbler": ("shelf wobbler", "wobbler"),
    "nozzle": ("nozzle talker", "nozzle"),
}

# Size ordering from smallest to largest
SIZE_ORDER = [
    "nozzle", "wobbler", "corner_cooler", "starburst", "pump_topper",
    "banner", "door_6x30", "yard", "window_sign", "door_24x36",
    "aframe", "polekit", "windmaster", "bollard",
]
SIZE_INDEX = {key: i for i, key in enumerate(SIZE_ORDER)}


def _type_key(canon_type: str):
    """Map canonicalized sign type to a key."""
    s = canon_type
    for key, needles in KW.items():
        for n in needles:
            nn = canonicalize(n)
            if nn and nn in s:
                return key
    return None


def _max_size_key(items):
    """Get the largest item size key from items."""
    max_key = None
    max_idx = -1
    for it in items or []:
        key = _type_key(canonicalize(it.get("type", "")))
        if key is None:
            return None
        idx = SIZE_INDEX.get(key, -1)
        if idx > max_idx:
            max_idx = idx
            max_key = key
    return max_key


def _count_by_key(items, key) -> int:
    """Count items matching a specific type key."""
    total = 0
    for it in items or []:
        if _type_key(canonicalize(it.get("type", ""))) == key:
            total += int(it.get("qty", 0) or 0)
    return total


def _has_banner(items) -> bool:
    """Check if order has banner items."""
    for it in items or []:
        if "banner" in canonicalize(it.get("type", "")) or "banner" in canonicalize(it.get("promo", "")):
            return True
    return False


def _banner_qty(items) -> int:
    """Count banner quantity."""
    total = 0
    for it in items or []:
        qty = int(it.get("qty", 0) or 0)
        t = canonicalize(it.get("type", ""))
        p = canonicalize(it.get("promo", ""))
        if "banner" in t or "banner" in p:
            total += qty
    return total


def _has_pump_topper_type(items) -> bool:
    """Check if order has pump topper items."""
    for it in items or []:
        if "pump topper" in canonicalize(it.get("type", "")):
            return True
    return False


def analyze_order_boxing(items, standard_box_label="8x8x30"):
    """
    Classify order into box/envelope category.
    Returns dict with category, manual_flag, etc.
    """
    q = {k: _count_by_key(items, k) for k in KW.keys()}
    
    has_big_types = any(q[k] > 0 for k in ("yard", "aframe", "bollard", "polekit"))
    banner_qty = _banner_qty(items)
    cap_sum = (q["aframe"] * 1.0) + (q["bollard"] * 1.0) + (q["polekit"] * 1.0) + (q["yard"] * 0.5) + (banner_qty * 2.0)
    
    hasBanner = banner_qty > 0
    hasPT = _has_pump_topper_type(items)
    max_key = _max_size_key(items)
    
    # Big-box logic first
    if has_big_types:
        if cap_sum > 4.0:
            return {"category": None, "manual_flag": True, "manual_reason": "Over capacity for 28x2x44 box", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}
        return {"category": "28x2x44", "manual_flag": False, "manual_reason": "", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}
    
    # Banner present -> 8x8x36
    if hasBanner:
        return {"category": "8x8x36", "manual_flag": False, "manual_reason": "", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}
    
    # PT rule: if PT present and no types larger than PT -> Stay Flat Envelope
    if hasPT and (max_key is not None) and SIZE_INDEX.get(max_key, -1) <= SIZE_INDEX["pump_topper"]:
        return {"category": "Stay Flat Envelope", "manual_flag": False, "manual_reason": "", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}
    
    # STANDARD via specific large-but-not-big types
    if q["door_24x36"] > 0 or q["windmaster"] > 0:
        return {"category": standard_box_label, "manual_flag": False, "manual_reason": "", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}
    
    # Largest item logic
    if max_key is None:
        return {"category": standard_box_label, "manual_flag": False, "manual_reason": "", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}
    if SIZE_INDEX.get(max_key, -1) > SIZE_INDEX["pump_topper"]:
        return {"category": standard_box_label, "manual_flag": False, "manual_reason": "", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}
    
    # Envelope categories
    present_keys = {_type_key(canonicalize(it.get("type", ""))) for it in (items or []) if _type_key(canonicalize(it.get("type", "")))}
    allowed_wobbler_env = {"nozzle", "wobbler"}
    if present_keys and present_keys.issubset(allowed_wobbler_env) and q["wobbler"] > 0:
        return {"category": "Padded Envelope", "manual_flag": False, "manual_reason": "", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}
    
    allowed_pack = {"nozzle", "wobbler", "starburst", "corner_cooler"}
    if present_keys and present_keys.issubset(allowed_pack) and (q["wobbler"] > 0 or q["starburst"] > 0):
        return {"category": "Padded Pack", "manual_flag": False, "manual_reason": "", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}
    
    # Stay Flat Envelope: largest <= pump topper
    if SIZE_INDEX.get(max_key, -1) <= SIZE_INDEX["pump_topper"]:
        return {"category": "Stay Flat Envelope", "manual_flag": False, "manual_reason": "", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}
    
    return {"category": standard_box_label, "manual_flag": False, "manual_reason": "", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}


def _get_tiered_sort_key(store: dict, tiered_cfg: dict) -> tuple:
    """Generate a sort key tuple based on tiered configuration."""
    tiers = tiered_cfg.get("tiers", [])
    key_parts = []
    
    for tier in tiers:
        if not tier.get("enabled", True):
            continue
        
        field = tier.get("field", "")
        categories = tier.get("categories", [])
        
        # Get the value for this field
        if field == "kit_type":
            value = store.get("kit_type", "")
        elif field == "alc_type":
            value = store.get("alc_type", "")
        elif field == "location" or field == "state":
            value = store.get("location", "") or store.get("state", "")
        elif field == "store_name" or field == "store_code":
            value = store.get("store_name", "") or store.get("store_code", "")
        elif field == "total_quantity":
            # For quantity-based sorting, return the numeric value directly
            value = store.get("total_quantity", 0)
        else:
            value = store.get(field, "") or ""
        
        # Find the order for this value
        if categories:
            order_map = {cat["id"]: cat.get("order", 99) for cat in categories}
            if value in order_map:
                order = order_map[value]
            elif "_other" in order_map:
                order = order_map["_other"]
            else:
                order = 999
            key_parts.append((order, value))
        else:
            key_parts.append((0, value))
    
    return tuple(key_parts)


def _get_tier_path_label(store: dict, tiered_cfg: dict) -> str:
    """
    Generate a human-readable tier path label for a store.
    Example: "Alcohol > Counter + Shipper > NY"
    
    Note: Excludes box_category since it's already used as the section label.
    """
    tiers = tiered_cfg.get("tiers", [])
    path_parts = []
    
    for tier in tiers:
        if not tier.get("enabled", True):
            continue
        
        field = tier.get("field", "")
        
        # Skip box_category - it's already in the separator title
        if field == "box_category":
            continue
        
        categories = tier.get("categories", [])
        tier_name = tier.get("name", field)
        
        # Get the value for this field
        if field == "kit_type":
            value = store.get("kit_type", "")
        elif field == "alc_type" or field == "alcohol_type":
            value = store.get("alc_type", "") or store.get("alcohol_type", "")
        elif field == "location" or field == "state":
            value = store.get("location", "") or store.get("state", "")
        elif field == "store_name" or field == "store_code":
            value = store.get("store_name", "") or store.get("store_code", "")
        elif field == "total_quantity":
            value = str(store.get("total_quantity", 0))
        else:
            value = store.get(field, "") or ""
        
        # Find the label for this value
        if categories:
            label = value  # default to the raw value
            for cat in categories:
                if cat.get("id") == value:
                    label = cat.get("label", value)
                    break
            # Check for _other category
            if label == value:
                for cat in categories:
                    if cat.get("id") == "_other":
                        label = cat.get("label", value) if value else cat.get("label", "Other")
                        break
            path_parts.append(label)
        elif value:
            # For fields without explicit categories, use the value directly
            path_parts.append(str(value))
    
    return " > ".join(path_parts) if path_parts else "Unsorted"


def _get_tier_sort_tuple(store: dict, tiered_cfg: dict) -> tuple:
    """
    Generate a tuple key for grouping stores by tier values.
    This creates a unique key for each tier combination.
    """
    tiers = tiered_cfg.get("tiers", [])
    key_parts = []
    
    for tier in tiers:
        if not tier.get("enabled", True):
            continue
        
        field = tier.get("field", "")
        
        # Get the value for this field
        if field == "kit_type":
            value = store.get("kit_type", "")
        elif field == "alc_type" or field == "alcohol_type":
            value = store.get("alc_type", "") or store.get("alcohol_type", "")
        elif field == "location" or field == "state":
            value = store.get("location", "") or store.get("state", "")
        elif field == "store_name" or field == "store_code":
            value = store.get("store_name", "") or store.get("store_code", "")
        elif field == "total_quantity":
            value = store.get("total_quantity", 0)
        else:
            value = store.get(field, "") or ""
        
        key_parts.append(value)
    
    return tuple(key_parts)


# ===== PDF Page Drawing Helpers (ported from KFSORT) =====

def _line_height(fontsize: float, leading: float = LEADING) -> float:
    return fontsize * leading


def draw_wrapped_text(out_doc, page, x, y, text, max_width, fontsize=12, leading=LEADING, color=(0, 0, 0)):
    """Draw wrapped text on a page, creating new pages as needed."""
    import fitz
    x_start = x
    paragraphs = str(text).splitlines() if text else [""]
    for para in paragraphs:
        words = para.split(" ")
        line = ""
        while words:
            peek = (line + (" " if line else "") + words[0]).strip()
            w = fitz.get_text_length(peek, fontname="helv", fontsize=fontsize)
            if w <= max_width:
                line = peek
                words.pop(0)
                if words:
                    continue
            else:
                if not line:
                    line = words.pop(0)
                # Draw line
            if y > page.rect.y1 - MARGIN_B - _line_height(fontsize, leading):
                page = out_doc.new_page()
                x = x_start
                y = MARGIN_T
            page.insert_text((x, y), line, fontsize=fontsize, color=color)
            y += _line_height(fontsize, leading)
            line = ""
        if line:
            if y > page.rect.y1 - MARGIN_B - _line_height(fontsize, leading):
                page = out_doc.new_page()
                x = x_start
                y = MARGIN_T
            page.insert_text((x, y), line, fontsize=fontsize, color=color)
            y += _line_height(fontsize, leading)
    return page, y


def draw_heading(out_doc, page, text, y, fontsize=18):
    """Draw a heading on the page."""
    max_width = page.rect.x1 - MARGIN_R - MARGIN_L
    page, y = draw_wrapped_text(out_doc, page, MARGIN_L, y, text, max_width, fontsize=fontsize, leading=1.15)
    return page, y


def draw_label_value(out_doc, page, label, value, y, fontsize=12):
    """Draw a label: value pair."""
    max_width = page.rect.x1 - MARGIN_R - MARGIN_L
    page, y = draw_wrapped_text(out_doc, page, MARGIN_L, y, f"{label}: {value}", max_width, fontsize=fontsize)
    return page, y


def draw_bullets(out_doc, page, items, y, indent=16, fontsize=11):
    """Draw a bulleted list."""
    max_width = page.rect.x1 - MARGIN_R - MARGIN_L - indent
    for it in items:
        page, y = draw_wrapped_text(out_doc, page, MARGIN_L + indent, y, f"• {it}", max_width, fontsize=fontsize)
    return page, y


def draw_multicolumn_list(out_doc, page, items, y, columns=4, fontsize=10, col_gap=20, leading=1.1, header_on_new_pages="", bullet="- "):
    """Draw items in multiple columns."""
    import fitz
    if not items:
        return page, y
    
    usable = page.rect.x1 - MARGIN_L - MARGIN_R - (col_gap * (columns - 1))
    col_w = usable / columns
    lh = _line_height(fontsize, leading)
    
    col = 0
    for it in items:
        x = MARGIN_L + col * (col_w + col_gap)
        if y > page.rect.y1 - MARGIN_B - lh:
            page = out_doc.new_page()
            y = MARGIN_T
            if header_on_new_pages:
                page, y = draw_heading(out_doc, page, header_on_new_pages, y, fontsize=12)
            col = 0
            x = MARGIN_L
        page.insert_text((x, y), f"{bullet}{it}", fontsize=fontsize, color=(0, 0, 0))
        col += 1
        if col >= columns:
            col = 0
            y += lh
    if col > 0:
        y += lh
    return page, y


# Default values (fallbacks if settings not loaded)
PREDETERMINED_WOBBLERS = {
    "shelf wobbler kit; alcohol version",
    "shelf wobbler kit; non-alcohol version",
}


def get_brand_settings_sync(session, brand_id: int = 1) -> BrandSettings:
    """Get brand settings from database (creates defaults if not exist)."""
    settings = session.query(BrandSettings).filter(BrandSettings.brand_id == brand_id).first()
    if not settings:
        settings = BrandSettings(brand_id=brand_id)
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings


def is_predetermined_wobbler(promo: str, settings: Optional[BrandSettings] = None) -> bool:
    """Check if a wobbler is predetermined (explicitly marked in order)."""
    if settings and settings.predetermined_wobblers:
        predetermined = {canonicalize(w) for w in settings.predetermined_wobblers}
        return canonicalize(promo) in predetermined
    return canonicalize(promo) in PREDETERMINED_WOBBLERS


# ===== KFSORT-style PDF manipulation helpers =====

def detect_columns(page):
    """Detect column positions from header row."""
    import fitz
    try:
        rs = page.search_for('Sign Type')
        rp = page.search_for('Promotion Name')
        rq = page.search_for('Qty Ordered')
        rect_sign = rs[0] if rs else None
        rect_promo = rp[0] if rp else None
        rect_qty = rq[0] if rq else None
        w = page.rect.width
        if not rect_promo:
            rect_promo = fitz.Rect(w * 0.25, 0, w * 0.55, 20)
        if not rect_qty:
            rect_qty = fitz.Rect(w * 0.80, 0, w * 0.95, 20)
        header_bottom = max([r.y1 for r in [rect_sign, rect_promo, rect_qty] if r] or [0])
        return {
            'x_promo_left': rect_promo.x0,
            'x_qty_left': rect_qty.x0,
            'header_bottom': header_bottom
        }
    except Exception:
        return {'x_promo_left': page.rect.width * 0.25, 'x_qty_left': page.rect.width * 0.80, 'header_bottom': 0}


def iter_rows(page, y_min, y_max):
    """Iterate through row data on a page using word geometry."""
    import fitz
    from collections import defaultdict
    
    try:
        words = page.get_text('words')  # x0, y0, x1, y1, txt, block, line, wordno
    except Exception:
        words = []
    
    rows = defaultdict(list)
    for x0, y0, x1, y1, txt, blk, ln, wn in words:
        if y0 < y_min or y1 > y_max:
            continue
        rows[(blk, ln, round(y0, 1))].append((x0, y0, x1, y1, txt, wn))
    
    cols = detect_columns(page)
    x_prom = cols['x_promo_left']
    x_qty = cols['x_qty_left']
    
    for key in sorted(rows.keys(), key=lambda k: k[2]):
        parts = sorted(rows[key], key=lambda t: t[-1])
        left, mid, right = [], [], []
        x0s, y0s, x1s, y1s = [], [], [], []
        for x0, y0, x1, y1, txt, wn in parts:
            xc = 0.5 * (x0 + x1)
            if xc < x_prom:
                left.append(txt)
            elif xc < x_qty:
                mid.append(txt)
            else:
                right.append(txt)
            x0s.append(x0)
            y0s.append(y0)
            x1s.append(x1)
            y1s.append(y1)
        
        if not x0s:
            continue
            
        rect = fitz.Rect(min(x0s), min(y0s), max(x1s), max(y1s))
        yield {
            'type_text': ' '.join(left).strip(),
            'promo_text': ' '.join(mid).strip(),
            'qty_text': ' '.join(right).strip(),
            'rect': rect
        }


def blackout_rows_on_page(page, blackout_config):
    """Apply blackout to matching rows using KFSORT approach.
    
    blackout_config format: {sign_type: {version1, version2, ...}}
    
    Special case: If sign_type is empty string '', it's a "wildcard" that matches
    any sign_type. This is used for conditional rules that blackout based on
    promo text regardless of sign type.
    """
    import fitz
    if not blackout_config:
        return 0
    
    cols = detect_columns(page)
    y_min = cols['header_bottom'] + 2
    y_max = page.rect.y1 - 36
    
    # blackout_config: {sign_type: {version1, version2, ...}}
    # Empty string key means "match any sign type"
    canon_map = {canonicalize(st): {canonicalize(v) for v in vs} for st, vs in blackout_config.items()}
    
    # Get wildcard versions (empty string key matches any sign type)
    wildcard_versions = canon_map.get('', set())
    
    last_type = None
    count = 0
    
    for row in iter_rows(page, y_min, y_max):
        st_this = canonicalize(row['type_text'])
        st = st_this or last_type
        pv = canonicalize(row['promo_text'])
        
        if st_this:
            last_type = st_this
        
        if not pv:
            continue
        
        # Check for specific sign_type match
        if st and st in canon_map and pv in canon_map[st]:
            page.draw_rect(row['rect'], color=(0, 0, 0), fill=(0, 0, 0), width=0)
            count += 1
        # Check wildcard (conditional rules that match promo text regardless of sign type)
        elif wildcard_versions and pv in wildcard_versions:
            page.draw_rect(row['rect'], color=(0, 0, 0), fill=(0, 0, 0), width=0)
            count += 1
        # Also check if promo text CONTAINS the wildcard value (for partial matches like "Alcohol Version")
        # Use _segment_match to prevent 'alcohol version' from matching 'non-alcohol version'
        elif wildcard_versions:
            for wv in wildcard_versions:
                if _segment_match(wv, pv):
                    page.draw_rect(row['rect'], color=(0, 0, 0), fill=(0, 0, 0), width=0)
                    count += 1
                    break
    
    return count


def annotate_wobbler_kit(page, kit_name: str):
    """Add kit annotation under Shelf Wobbler rows using KFSORT approach."""
    import fitz
    if not kit_name:
        return 0
    
    cols = detect_columns(page)
    y_min = cols['header_bottom'] + 2
    y_max = page.rect.y1 - 36
    x_left_type = 12
    added = 0
    
    for row in iter_rows(page, y_min, y_max):
        if canonicalize(row['type_text']) == 'shelf wobbler':
            x = max(x_left_type, row['rect'].x0 + 4)
            y = row['rect'].y1 + 7
            if y < (page.rect.y1 - 8):
                page.insert_text((x, y), f"Kit: {kit_name}", fontsize=8, color=(0.2, 0.2, 0.2))
                added += 1
    
    return added


def blackout_wobbler_items_on_page(page, items_to_blackout):
    """Blackout specific wobbler promo items on a page."""
    import fitz
    if not items_to_blackout:
        return 0
    
    cols = detect_columns(page)
    y_min = cols['header_bottom'] + 2
    y_max = page.rect.y1 - 36
    
    items_canon = {canonicalize(p) for p in items_to_blackout}
    count = 0
    last_type = None
    
    for row in iter_rows(page, y_min, y_max):
        st_this = canonicalize(row['type_text'])
        if st_this:
            last_type = st_this
        st = st_this or last_type
        pv = canonicalize(row['promo_text'])
        
        if not st or not pv:
            continue
        
        # Only blackout if it's a shelf wobbler and matches our items
        if st == 'shelf wobbler' and pv in items_canon:
            page.draw_rect(row['rect'], color=(0, 0, 0), fill=(0, 0, 0), width=0)
            count += 1
    
    return count


@app.get("/api/batches/{batch_id}/wobbler-kits")
async def get_wobbler_kits(batch_id: str, min_stores: int = 10):
    """
    Calculate post-determined wobbler kits for a batch.
    
    A wobbler kit is formed when 10+ stores share the same combination
    of Shelf Wobbler items (excluding predetermined alcohol/non-alcohol versions).
    """
    session = Session()
    try:
        # Get all orders from this batch
        orders = session.query(Order).filter(Order.batch_id == batch_id).all()
        
        if not orders:
            raise HTTPException(status_code=404, detail="Batch not found or no orders")
        
        # Build store data with items
        stores = []
        for order in orders:
            items = session.query(OrderItem).filter(OrderItem.order_id == order.id).all()
            store = session.query(Store).filter(Store.id == order.store_id).first() if order.store_id else None
            stores.append({
                'store_id': order.id,
                'store_name': store.name if store else order.store_code,
                'store_code': order.store_code,
                'items': [
                    {
                        'type': item.sign_type or '',
                        'promo': item.promotion_name or '',
                        'qty': item.quantity or 1
                    }
                    for item in items
                ]
            })
        
        # Group wobbler kits using the same logic as KFSORT1.0.py
        rep_text = {}
        combos = {}
        
        for s in stores:
            items = s.get('items', [])
            wob = []
            for it in items:
                # Only include Shelf Wobbler sign types
                if canonicalize(it['type']) != 'shelf wobbler':
                    continue
                # Skip predetermined wobblers
                if is_predetermined_wobbler(it['promo']):
                    continue
                cp = canonicalize(it['promo'])
                rep_text[cp] = it['promo']  # Keep original text
                wob.append((cp, it['qty']))
            
            # Only consider stores with 2+ wobbler items
            if len(wob) <= 1:
                continue
            
            key = tuple(sorted(wob))
            if key not in combos:
                combos[key] = []
            combos[key].append((s['store_id'], s['store_name'], s['store_code']))
        
        # Build kits from combos meeting threshold
        kits = []
        idx = 1
        for key, store_list in combos.items():
            if len(store_list) < min_stores:
                continue
            
            items_disp = [{'promo': rep_text[p], 'qty': q} for (p, q) in key]
            store_ids = [sid for sid, _, _ in store_list]
            store_names = sorted([nm for _, nm, _ in store_list])
            store_codes = [code for _, _, code in store_list]
            
            kits.append({
                'kit_name': str(idx),
                'items': items_disp,
                'stores': store_names,
                'store_codes': store_codes,
                'store_ids': store_ids,
                'store_count': len(store_list),
            })
            idx += 1
        
        # Sort by store count descending
        kits.sort(key=lambda k: k['store_count'], reverse=True)
        
        return {
            "batch_id": batch_id,
            "kits": kits,
            "total_kits": len(kits),
            "min_stores_threshold": min_stores
        }
    finally:
        session.close()


@app.post("/api/batches/{batch_id}/apply-wobbler-kits")
async def apply_wobbler_kits(batch_id: str, request: ApplyWobblerKitsRequest):
    """
    Apply selected wobbler kits to the output PDF.
    
    This will:
    1. Black out individual wobbler items on store orders that are part of a kit
    2. Add kit number annotation under the Shelf Wobblers designation
    """
    import fitz
    
    session = Session()
    try:
        # Get the batch to find the output PDF
        batch = session.query(ProcessingBatch).filter(
            ProcessingBatch.batch_id == batch_id
        ).first()
        
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        
        output_path = batch.output_path
        if not output_path or not Path(output_path).exists():
            raise HTTPException(status_code=404, detail="Sorted PDF not found. Generate sorted PDF first.")
        
        # Get the kits
        kits_response = await get_wobbler_kits(batch_id)
        
        if not kits_response.get("kits"):
            raise HTTPException(status_code=404, detail="No wobbler kits found for this batch")
        
        # Filter to selected kits
        selected_kits = [
            kit for kit in kits_response["kits"] 
            if kit["kit_name"] in request.kit_names
        ]
        
        if not selected_kits:
            raise HTTPException(status_code=400, detail="No valid kits selected")
        
        # Build renumbering map: original_name -> new_number
        # If renumbering provided, use it; otherwise default to 1, 2, 3...
        renumber_map = {}
        if request.kit_renumbering:
            for item in request.kit_renumbering:
                renumber_map[item.original_name] = item.new_number
        else:
            # Default: assign sequential numbers based on order
            for idx, kit in enumerate(selected_kits):
                renumber_map[kit["kit_name"]] = idx + 1
        
        # Build mapping of store_code -> kit info for annotation
        kit_by_store = {}
        wobbler_items_to_blackout = {}
        for kit in selected_kits:
            # Use the new sequential number instead of original kit_name
            new_kit_number = renumber_map.get(kit["kit_name"], kit["kit_name"])
            for store_code in kit.get("store_codes", []):
                kit_by_store[store_code] = str(new_kit_number)
                # Store the items that should be blacked out for this kit
                wobbler_items_to_blackout[store_code] = [
                    canonicalize(item["promo"]) for item in kit["items"]
                ]
        
        # Now modify the PDF
        stores_updated = 0
        wobblers_blacked_out = 0
        kit_labels_added = 0
        
        try:
            doc = fitz.open(output_path)
            
            current_store_code = None
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                text = page.get_text("text") or ""
                
                # Check if this is a store page (contains Store: XXXXX)
                import re
                store_match = re.search(r'Store:\s*([A-Z]\d{4})', text)
                if store_match:
                    current_store_code = store_match.group(1)
                
                if current_store_code and current_store_code in kit_by_store:
                    kit_name = kit_by_store[current_store_code]
                    items_to_blackout = wobbler_items_to_blackout.get(current_store_code, [])
                    
                    # Find and blackout wobbler items
                    for item_promo in items_to_blackout:
                        # Search for text containing this promo
                        text_instances = page.search_for(item_promo[:30])  # Search partial text
                        for rect in text_instances:
                            # Expand rect to cover the full row
                            expanded_rect = fitz.Rect(
                                page.rect.x0 + 10,  # Left margin
                                rect.y0 - 2,
                                page.rect.x1 - 10,  # Right margin  
                                rect.y1 + 2
                            )
                            page.draw_rect(expanded_rect, color=(0, 0, 0), fill=(0, 0, 0))
                            wobblers_blacked_out += 1
                    
                    # Add kit annotation under "Shelf Wobbler" text
                    wobbler_instances = page.search_for("Shelf Wobbler")
                    for rect in wobbler_instances:
                        # Add kit label below the Shelf Wobbler text
                        kit_text = f"Kit: {kit_name}"
                        insert_point = fitz.Point(rect.x0, rect.y1 + 10)
                        page.insert_text(insert_point, kit_text, fontsize=8, color=(0.2, 0.2, 0.2))
                        kit_labels_added += 1
                    
                    stores_updated += 1
            
            # Save the modified PDF
            doc.save(output_path, incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
            doc.close()
            
        except Exception as e:
            logger.error(f"Failed to modify PDF: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to modify PDF")
        
        return {
            "success": True,
            "batch_id": batch_id,
            "applied_kits": len(selected_kits),
            "stores_updated": stores_updated,
            "wobblers_blacked_out": wobblers_blacked_out,
            "kit_labels_added": kit_labels_added,
            "message": f"Applied {len(selected_kits)} wobbler kit(s) to {stores_updated} stores"
        }
    finally:
        session.close()


@app.post("/api/batches/{batch_id}/generate-final-output")
async def generate_final_output(batch_id: str, request: GenerateFinalOutputRequest):
    """
    Generate a final output PDF matching KFSORT1.0.py output structure exactly.
    
    Output structure:
    1. Summary page (Order Packaging Summary)
    2. Manual Review page (if any stores over capacity)
    3. Envelope sections (PE, PP, SFE) with section headers
    4. Box sections (28x2x44, 8x8x36, Standard) with section headers
    5. Wobbler Kits appendix
    """
    import fitz
    import re
    
    session = Session()
    try:
        # Get the batch
        batch = session.query(ProcessingBatch).filter(
            ProcessingBatch.batch_id == batch_id
        ).first()
        
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        
        source_path = batch.source_path
        if not source_path or not Path(source_path).exists():
            raise HTTPException(status_code=404, detail="Source PDF not found")
        
        # Get all orders for sorting
        orders = session.query(Order).filter(Order.batch_id == batch_id).all()
        if not orders:
            raise HTTPException(status_code=404, detail="No orders found in batch")
        
        # Load brand settings for configurable values
        brand_settings = get_brand_settings_sync(session, brand_id=1)
        std_box = brand_settings.default_standard_box or "8x8x30"
        
        # Build store data with items (matching KFSORT structure)
        stores = []
        no_order_stores = []
        
        for order in orders:
            db_items = session.query(OrderItem).filter(OrderItem.order_id == order.id).all()
            store_obj = session.query(Store).filter(Store.id == order.store_id).first() if order.store_id else None
            
            source_pages = order.source_pages if order.source_pages else []
            if isinstance(source_pages, str):
                source_pages = json.loads(source_pages)
            
            # Convert DB items to KFSORT-style items
            items = [{
                'type': item.sign_type or '',
                'promo': item.promotion_name or '',
                'qty': item.quantity or 1
            } for item in db_items]
            
            # Calculate total quantity as sum of all item quantities
            total_quantity = sum(item.quantity or 1 for item in db_items)
            
            store_data = {
                'store_id': order.id,
                'store_code': order.store_code,
                'store_name': store_obj.name if store_obj else order.store_code,
                'store_type': order.store_type or '',
                'location': store_obj.region if store_obj else (store_obj.state if store_obj else ''),
                'state': store_obj.state if store_obj else '',
                'pages': source_pages,
                'items': items,
                'total_quantity': total_quantity,  # Sum of all item quantities
                'db_items': db_items,  # Keep original for blackout rule processing
                # Tier sorting fields from Order classification
                'kit_type': order.kit_type or 'neither',
                'alc_type': order.alcohol_type or 'none',
                'alcohol_type': order.alcohol_type or 'none',
                'box_category': order.box_category or std_box,
            }
            
            if not items:
                no_order_stores.append(store_data)
            else:
                stores.append(store_data)
        
        # Get wobbler kits
        kits = []
        kit_by_store_id = {}
        if request.wobbler_kit_names and len(request.wobbler_kit_names) > 0:
            kits_response = await get_wobbler_kits(batch_id)
            all_kits = kits_response.get("kits", [])
            selected_kits = [k for k in all_kits if k["kit_name"] in request.wobbler_kit_names]
            
            # Build renumbering map
            renumber_map = {}
            if request.wobbler_kit_renumbering:
                for item in request.wobbler_kit_renumbering:
                    renumber_map[item.original_name] = item.new_number
            else:
                for idx, kit in enumerate(selected_kits):
                    renumber_map[kit["kit_name"]] = idx + 1
            
            for kit in selected_kits:
                kit['kit_number'] = str(renumber_map.get(kit["kit_name"], kit["kit_name"]))
                for store_id in kit.get("store_ids", []):
                    kit_by_store_id[store_id] = kit['kit_number']
            
            kits = selected_kits
        
        # Get blackout rules and build blackout config
        blackout_config = {}
        conditional_rules = []  # Store conditional rules for per-store evaluation
        if request.apply_blackout_rules:
            blackout_rules = session.query(BlackoutRule).filter(
                BlackoutRule.brand_id == 1,
                BlackoutRule.is_enabled == True
            ).all()
            
            for rule in blackout_rules:
                if rule.rule_type == 'cancelled' and rule.sign_type:
                    st = canonicalize(rule.sign_type)
                    if st not in blackout_config:
                        blackout_config[st] = set()
                    if rule.sign_version:
                        blackout_config[st].add(canonicalize(rule.sign_version))
                elif rule.rule_type == 'conditional' and rule.condition_logic:
                    # Store conditional rules for per-store evaluation
                    conditional_rules.append(rule)
        
        def text_contains_with_word_boundary(text, search_value):
            """
            Check if text contains search_value with word boundary awareness.
            Prevents 'alcohol version' from matching 'non-alcohol version'.
            """
            return _segment_match(search_value, text)
        
        def evaluate_conditional_rules_for_store(store_items, conditional_rules_list):
            """
            Evaluate conditional blackout rules for a specific store's items.
            Returns a dict of {sign_type: set(versions)} to blackout.
            """
            extra_blackouts = {}
            if not conditional_rules_list or not store_items:
                return extra_blackouts
            
            # Build searchable item text from store items
            item_texts = []
            for item in store_items:
                sign_type = canonicalize(item.get('sign_type', '') or '')
                promo = canonicalize(item.get('promo', '') or '')
                combined = f"{sign_type} {promo}"
                item_texts.append(combined)
            
            for rule in conditional_rules_list:
                logic = rule.condition_logic
                if not logic:
                    continue
                
                conditions = logic.get('conditions', [])
                operator = logic.get('operator', 'AND')
                target = logic.get('target', {})
                
                # Check each condition
                condition_results = []
                for cond in conditions:
                    field = cond.get('field', 'item_contains')
                    value = canonicalize(cond.get('value', ''))
                    
                    if field == 'item_contains' and value:
                        # Check if any item contains this value with word boundary awareness
                        # This prevents 'alcohol version' from matching 'non-alcohol version'
                        matched = any(text_contains_with_word_boundary(item_text, value) for item_text in item_texts)
                        condition_results.append(matched)
                    else:
                        # Unknown field type, skip
                        condition_results.append(False)
                
                # Apply operator logic
                if not condition_results:
                    continue
                
                if operator == 'AND':
                    conditions_met = all(condition_results)
                else:  # OR
                    conditions_met = any(condition_results)
                
                if conditions_met:
                    # Add target to blackout list
                    target_field = target.get('field', 'item_contains')
                    target_value = canonicalize(target.get('value', ''))
                    
                    if target_field == 'item_contains' and target_value:
                        # Use empty string as sign_type key for text-based targets
                        if '' not in extra_blackouts:
                            extra_blackouts[''] = set()
                        extra_blackouts[''].add(target_value)
            
            return extra_blackouts
        
        # Get formatting rules (selective highlighting/styling)
        formatting_rules = session.query(FormattingRule).filter(
            FormattingRule.is_enabled == True,
            (FormattingRule.brand_id == 1) | (FormattingRule.brand_id.is_(None))
        ).order_by(FormattingRule.priority.desc()).all()
        
        # Box/Envelope classification per store (authoritative)
        counts = {
            "28x2x44": 0,
            "8x8x36": 0,
            std_box: 0,
            "Padded Envelope": 0,
            "Padded Pack": 0,
            "Stay Flat Envelope": 0,
        }
        manual_flags = []
        bucket_manual = []
        bucket_boxes_28 = []
        bucket_boxes_8836 = []
        bucket_boxes_std = []
        bucket_env_pe = []
        bucket_env_pp = []
        bucket_env_sfe = []
        
        for s in stores:
            result = analyze_order_boxing(s['items'], standard_box_label=std_box)
            s['hasBanner'] = result.get("hasBanner", False)
            s['hasPT'] = result.get("hasPT", False)
            
            cat = result["category"]
            if result["manual_flag"]:
                reason = f"{s['store_code']} — {result['manual_reason']} (sum={result['capacity_sum']:.1f})"
                manual_flags.append(reason)
                s['manual_reason'] = result['manual_reason']
                s['capacity_sum'] = result['capacity_sum']
                bucket_manual.append(s)
                continue
            if not cat:
                continue
            counts[cat] = counts.get(cat, 0) + 1
            if cat == "28x2x44":
                bucket_boxes_28.append(s)
            elif cat == "8x8x36":
                bucket_boxes_8836.append(s)
            elif cat == std_box:
                bucket_boxes_std.append(s)
            elif cat == "Padded Envelope":
                bucket_env_pe.append(s)
            elif cat == "Padded Pack":
                bucket_env_pp.append(s)
            elif cat == "Stay Flat Envelope":
                bucket_env_sfe.append(s)
        
        # Get sort configuration and create sort key function
        sort_config = None
        tiered_cfg = {"tiers": []}
        if request.apply_sort_config:
            sort_config = session.query(SortConfig).filter(SortConfig.brand_id == 1).first()
            if sort_config and sort_config.tiers:
                tiered_cfg = {"tiers": sort_config.tiers if isinstance(sort_config.tiers, list) else json.loads(sort_config.tiers)}
        
        def store_sort_key(s):
            return _get_tiered_sort_key(s, tiered_cfg)
        
        # Sort all buckets
        bucket_boxes_28.sort(key=store_sort_key)
        bucket_boxes_8836.sort(key=store_sort_key)
        bucket_boxes_std.sort(key=store_sort_key)
        bucket_env_pe.sort(key=store_sort_key)
        bucket_env_pp.sort(key=store_sort_key)
        bucket_env_sfe.sort(key=store_sort_key)
        bucket_manual.sort(key=store_sort_key)
        
        # Open source and create output
        source_doc = fitz.open(source_path)
        output_doc = fitz.open()
        
        stats = {
            'total_pages': 0,
            'stores_processed': 0,
            'blackouts_applied': 0,
            'wobbler_kits_applied': 0,
            'kit_labels_added': 0,
            'formatting_applied': 0
        }
        
        # No-order list for summary
        no_order_display = []
        seen_no_order = set()
        for store in no_order_stores:
            candidate = store.get('store_code', '').strip()
            if not candidate:
                candidate = store.get('store_name', '').strip()
            if candidate and candidate not in seen_no_order:
                seen_no_order.add(candidate)
                no_order_display.append(candidate)
        no_order_line = ", ".join(no_order_display) if no_order_display else "None"
        
        # ===== 1. SUMMARY PAGE =====
        cover = output_doc.new_page()
        y = MARGIN_T
        cover, y = draw_heading(output_doc, cover, "Order Packaging Summary", y, fontsize=18)
        cover, y = draw_wrapped_text(output_doc, cover, MARGIN_L, y, f"No Order Stores: {no_order_line}", cover.rect.x1 - MARGIN_R - MARGIN_L, fontsize=12)
        y += 10
        cover, y = draw_label_value(output_doc, cover, "28x2x44 Boxes", counts["28x2x44"], y, fontsize=12)
        cover, y = draw_label_value(output_doc, cover, "8x8x36 Boxes (Banner-only or Banner present)", counts["8x8x36"], y, fontsize=12)
        cover, y = draw_label_value(output_doc, cover, f"Standard Boxes ({std_box})", counts[std_box], y, fontsize=12)
        cover, y = draw_label_value(output_doc, cover, "Padded Envelope Stores", counts["Padded Envelope"], y, fontsize=12)
        cover, y = draw_label_value(output_doc, cover, "Padded Pack Stores", counts["Padded Pack"], y, fontsize=12)
        cover, y = draw_label_value(output_doc, cover, "Stay Flat Envelope Stores", counts["Stay Flat Envelope"], y, fontsize=12)
        cover, y = draw_label_value(output_doc, cover, "Wobbler Kits (10+ stores)", len(kits), y, fontsize=12)
        cover, y = draw_label_value(output_doc, cover, "Manual Review Needed", len(bucket_manual), y, fontsize=12)
        
        # ===== 2. MANUAL REVIEW PAGE (if any) =====
        if manual_flags:
            mr = output_doc.new_page()
            yy = MARGIN_T
            mr, yy = draw_heading(output_doc, mr, "Manual Review Needed: Over capacity for 28x2x44 box", yy, fontsize=16)
            mr, yy = draw_bullets(output_doc, mr, manual_flags, yy, indent=16, fontsize=11)
        
        # Helper function to render stores with tier-based separator pages
        def render_stores_with_tier_separators(stores_bucket, box_category_label, tiered_cfg):
            """
            Render stores grouped by their tier values, with a separator page
            for each unique tier combination.
            
            Example separator: "Envelopes > Alcohol > Counter + Shipper > NY"
            """
            nonlocal stats
            if not stores_bucket:
                return
            
            # Group stores by their tier tuple
            from collections import OrderedDict
            tier_groups = OrderedDict()
            
            for store in stores_bucket:
                tier_key = _get_tier_sort_tuple(store, tiered_cfg)
                if tier_key not in tier_groups:
                    tier_groups[tier_key] = []
                tier_groups[tier_key].append(store)
            
            # Render each tier group with its separator
            for tier_key, group_stores in tier_groups.items():
                # Generate the tier path label for this group
                # Use the first store to get the tier path (all stores in group have same tier values)
                tier_path = _get_tier_path_label(group_stores[0], tiered_cfg)
                
                # Build full separator title: Box Category > Tier Path
                if tier_path and tier_path != "Unsorted":
                    separator_title = f"{box_category_label} > {tier_path}"
                else:
                    separator_title = box_category_label
                
                # Create separator page
                header_page = output_doc.new_page()
                draw_heading(output_doc, header_page, separator_title, MARGIN_T, fontsize=18)
                
                # Add store count on separator
                store_count_text = f"{len(group_stores)} store{'s' if len(group_stores) != 1 else ''}"
                draw_wrapped_text(output_doc, header_page, MARGIN_L, MARGIN_T + 30, 
                                  store_count_text, header_page.rect.x1 - MARGIN_R - MARGIN_L, fontsize=14)
                
                # Render all stores in this tier group
                for store in group_stores:
                    kit_name = kit_by_store_id.get(store['store_id'])
                    
                    # Evaluate conditional blackout rules for THIS store's items
                    store_items = store.get('items', [])
                    conditional_blackouts = evaluate_conditional_rules_for_store(store_items, conditional_rules)
                    
                    # Build store-specific blackout config (cancelled + conditional)
                    store_blackout = {k: set(v) for k, v in blackout_config.items()}  # Deep copy sets
                    for st, versions in conditional_blackouts.items():
                        if st not in store_blackout:
                            store_blackout[st] = set()
                        store_blackout[st].update(versions)
                    
                    # Copy and process pages for this store
                    for page_num in store['pages']:
                        if page_num < 0 or page_num >= len(source_doc):
                            continue
                        
                        output_doc.insert_pdf(source_doc, from_page=page_num, to_page=page_num)
                        new_page = output_doc[-1]
                        stats['total_pages'] += 1
                        
                        # Apply blackouts (both cancelled and conditional)
                        if store_blackout:
                            count = blackout_rows_on_page(new_page, store_blackout)
                            stats['blackouts_applied'] += count
                        
                        # Apply wobbler kit annotations
                        if kit_name:
                            # NOTE: Removed blackout of individual wobbler items in post-determined kits
                            # Kit annotation is still applied below
                            
                            # Add kit annotation
                            labels_added = annotate_wobbler_kit(new_page, kit_name)
                            stats['kit_labels_added'] += labels_added
                            if labels_added > 0:
                                stats['wobbler_kits_applied'] += 1
                        
                        # Apply database-driven formatting rules (kit highlights, etc.)
                        # All highlighting is now configurable via the Formatting Rules settings
                        if formatting_rules:
                            format_count = apply_formatting_rules(new_page, formatting_rules)
                            stats['formatting_applied'] += format_count
                    
                    stats['stores_processed'] += 1
        
        # ===== 3. MANUAL REVIEW STORES (actual pages) =====
        if bucket_manual:
            render_stores_with_tier_separators(bucket_manual, "MANUAL REVIEW", tiered_cfg)
        
        # ===== 4. ENVELOPE SECTIONS =====
        render_stores_with_tier_separators(bucket_env_pe, "Padded Envelope", tiered_cfg)
        render_stores_with_tier_separators(bucket_env_pp, "Padded Pack", tiered_cfg)
        render_stores_with_tier_separators(bucket_env_sfe, "Stay Flat Envelope", tiered_cfg)
        
        # ===== 5. BOX SECTIONS =====
        render_stores_with_tier_separators(bucket_boxes_28, "28x2x44", tiered_cfg)
        render_stores_with_tier_separators(bucket_boxes_8836, "8x8x36", tiered_cfg)
        render_stores_with_tier_separators(bucket_boxes_std, std_box, tiered_cfg)
        
        # ===== 6. WOBBLER KITS APPENDIX =====
        if kits or True:  # Always show this page
            cover2 = output_doc.new_page()
            y = MARGIN_T
            cover2, y = draw_heading(output_doc, cover2, "Wobbler Kits (Post-Determined, 10+ stores)", y, fontsize=18)
            excluded_list = ", ".join(sorted(PREDETERMINED_WOBBLERS))
            cover2, y = draw_wrapped_text(output_doc, cover2, MARGIN_L, y, f"Excluded (predetermined): {excluded_list}", cover2.rect.x1 - MARGIN_R - MARGIN_L, fontsize=10)
            y += 10
            if kits:
                for kit in kits:
                    cover2, y = draw_wrapped_text(output_doc, cover2, MARGIN_L, y, f"Kit {kit.get('kit_number', kit['kit_name'])}: {kit['store_count']} stores", cover2.rect.x1 - MARGIN_R - MARGIN_L, fontsize=12)
            else:
                cover2, y = draw_wrapped_text(output_doc, cover2, MARGIN_L, y, "No kits reached the 10+ store threshold.", cover2.rect.x1 - MARGIN_R - MARGIN_L, fontsize=12)
            
            # Individual kit detail pages
            for kit in kits:
                kit_page = output_doc.new_page()
                y = MARGIN_T
                kit_page, y = draw_heading(output_doc, kit_page, f"Kit {kit.get('kit_number', kit['kit_name'])} — {kit['store_count']} stores", y, fontsize=16)
                kit_page, y = draw_wrapped_text(output_doc, kit_page, MARGIN_L, y, "Items:", kit_page.rect.x1 - MARGIN_R - MARGIN_L, fontsize=12)
                item_lines = [f"{it['promo']} (qty {it['qty']})" for it in kit.get('items', [])]
                kit_page, y = draw_bullets(output_doc, kit_page, item_lines, y, indent=16, fontsize=11)
                y += 10
                kit_page, y = draw_wrapped_text(output_doc, kit_page, MARGIN_L, y, "Stores:", kit_page.rect.x1 - MARGIN_R - MARGIN_L, fontsize=12)
                kit_page, y = draw_multicolumn_list(output_doc, kit_page, kit.get('stores', []), y, columns=4, fontsize=10, col_gap=20, leading=1.1, header_on_new_pages="Stores (cont.)", bullet="- ")
        
        # Save output PDF
        output_filename = f"sorted_{batch_id}.pdf"
        output_path = OUTPUT_DIR / output_filename
        output_doc.save(str(output_path))
        output_doc.close()
        source_doc.close()
        
        # Update batch with output path
        batch.output_path = str(output_path)
        batch.status = "completed"
        batch.completed_at = datetime.now(timezone.utc)
        session.commit()
        
        return {
            "success": True,
            "batch_id": batch_id,
            "output_path": str(output_path),
            "output_filename": output_filename,
            "counts": counts,
            "manual_reviews": len(bucket_manual),
            "wobbler_kits": len(kits),
            **stats
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        logger.error(f"Failed to generate output: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate output")
    finally:
        session.close()


@app.get("/api/batches/{batch_id}/download-output")
async def download_output(batch_id: str):
    """Download the generated output PDF."""
    session = Session()
    try:
        batch = session.query(ProcessingBatch).filter(
            ProcessingBatch.batch_id == batch_id
        ).first()
        
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        
        output_path = batch.output_path
        if not output_path or not Path(output_path).exists():
            raise HTTPException(status_code=404, detail="Output PDF not found. Generate it first.")
        
        return FileResponse(
            output_path,
            media_type="application/pdf",
            filename=f"sorted_{batch_id}.pdf"
        )
    finally:
        session.close()


# ----- Serve Frontend (production) -----
frontend_path = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
