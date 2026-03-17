"""
Packing Slip Manager - Database Models
SQLite database for storing orders, stores, parse patterns, and configurations.

Features:
- Soft deletes via deleted_at column on key models
- Audit trail logging
- User/authentication models for multi-user support
- Optimized indexes for common queries
"""

from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey, JSON, Index, event
from sqlalchemy.orm import DeclarativeBase, relationship, sessionmaker
import json

try:
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    _HAS_PASSLIB = True
except ImportError:
    import hashlib
    import secrets
    _HAS_PASSLIB = False


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


def utcnow():
    """Return timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


# ============== Mixin Classes ==============

class SoftDeleteMixin:
    """
    Mixin for soft delete functionality.
    Records are not actually deleted, just marked with deleted_at timestamp.
    """
    deleted_at = Column(DateTime, nullable=True, default=None, index=True)
    deleted_by = Column(String(100), nullable=True, default=None)
    
    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None
    
    def soft_delete(self, user: str = "system"):
        """Mark record as deleted without actually removing from database."""
        self.deleted_at = utcnow()
        self.deleted_by = user
    
    def restore(self):
        """Restore a soft-deleted record."""
        self.deleted_at = None
        self.deleted_by = None


class TimestampMixin:
    """Mixin for created_at and updated_at timestamps."""
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


# ============== User & Authentication Models ==============

class User(Base, TimestampMixin, SoftDeleteMixin):
    """
    User model for multi-user support.
    Supports local authentication and future OAuth integration.
    """
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=True, unique=True, index=True)
    password_hash = Column(String(255), nullable=True)  # Nullable for OAuth users
    
    # Profile info
    display_name = Column(String(200), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    
    # Role & permissions
    role = Column(String(50), default="user")  # admin, manager, user, viewer
    permissions = Column(JSON, default=list)  # ["read", "write", "delete", "admin"]
    
    # Status
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    login_count = Column(Integer, default=0)
    
    # OAuth (future)
    oauth_provider = Column(String(50), nullable=True)  # google, microsoft, etc.
    oauth_id = Column(String(255), nullable=True)
    
    # Relationships
    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_users_active', 'is_active', 'deleted_at'),
    )
    
    def set_password(self, password: str):
        """Hash and set the user's password using bcrypt."""
        if _HAS_PASSLIB:
            self.password_hash = pwd_context.hash(password)
        else:
            # Fallback if passlib not installed (NOT recommended for production)
            import hashlib, secrets
            salt = secrets.token_hex(16)
            self.password_hash = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest() + f":{salt}"
    
    def verify_password(self, password: str) -> bool:
        """Verify the user's password."""
        if not self.password_hash:
            return False
        if _HAS_PASSLIB:
            return pwd_context.verify(password, self.password_hash)
        else:
            # Fallback for legacy SHA-256 hashes
            stored_hash, salt = self.password_hash.rsplit(":", 1)
            test_hash = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
            return test_hash == stored_hash


class APIKey(Base, TimestampMixin):
    """API keys for external integrations."""
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    name = Column(String(100), nullable=False)
    key_hash = Column(String(255), nullable=False, unique=True, index=True)
    key_prefix = Column(String(10), nullable=False)  # First 8 chars for identification
    
    # Permissions
    scopes = Column(JSON, default=list)  # ["read:orders", "write:brands", etc.]
    
    # Limits
    rate_limit = Column(Integer, default=1000)  # Requests per hour
    expires_at = Column(DateTime, nullable=True)
    
    # Usage tracking
    last_used = Column(DateTime, nullable=True)
    use_count = Column(Integer, default=0)
    
    is_active = Column(Boolean, default=True)
    
    user = relationship("User", back_populates="api_keys")
    
    __table_args__ = (
        Index('idx_api_keys_active', 'is_active', 'expires_at'),
    )
    
    @classmethod
    def generate_key(cls) -> tuple:
        """Generate a new API key. Returns (full_key, key_hash, prefix)."""
        key = f"slipsort_{secrets.token_urlsafe(32)}"
        key_hash = hashlib.sha256(key.encode()).hexdigest()
        prefix = key[:8]
        return key, key_hash, prefix


# ============== Audit Trail ==============

class AuditLog(Base):
    """
    Audit log for tracking all changes to the system.
    Provides compliance and debugging capabilities.
    """
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Who
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    username = Column(String(100), nullable=True)  # Denormalized for deleted users
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    # What
    action = Column(String(50), nullable=False)  # CREATE, UPDATE, DELETE, ACCESS, LOGIN, etc.
    resource_type = Column(String(100), nullable=False)  # orders, brands, config, etc.
    resource_id = Column(String(100), nullable=True)
    
    # Details
    description = Column(Text, nullable=True)
    old_value = Column(JSON, nullable=True)  # Previous state for updates
    new_value = Column(JSON, nullable=True)  # New state for creates/updates
    extra_data = Column(JSON, default=dict)  # Additional context (renamed from metadata)
    
    # When
    timestamp = Column(DateTime, default=utcnow, index=True)
    
    # Correlation
    correlation_id = Column(String(50), nullable=True, index=True)
    batch_id = Column(String(100), nullable=True)
    
    user = relationship("User", back_populates="audit_logs")
    
    __table_args__ = (
        Index('idx_audit_resource', 'resource_type', 'resource_id'),
        Index('idx_audit_user_action', 'user_id', 'action'),
        Index('idx_audit_timestamp_action', 'timestamp', 'action'),
    )


# ============== Session Management ==============

class UserSession(Base):
    """User session tracking for security."""
    __tablename__ = "user_sessions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    session_token = Column(String(255), nullable=False, unique=True, index=True)
    refresh_token = Column(String(255), nullable=True, unique=True)
    
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    created_at = Column(DateTime, default=utcnow)
    expires_at = Column(DateTime, nullable=False)
    last_activity = Column(DateTime, default=utcnow)
    
    is_active = Column(Boolean, default=True)
    
    __table_args__ = (
        Index('idx_sessions_user_active', 'user_id', 'is_active'),
    )


# ============== Core Business Models ==============

class Brand(Base, SoftDeleteMixin):
    """Brand/client configuration (e.g., Kwik Fill, Sheetz, etc.)"""
    __tablename__ = "brands"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    code = Column(String(20), nullable=True, index=True)  # Short code like "KF" for file naming
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    
    # Relationships
    parse_patterns = relationship("ParsePattern", back_populates="brand", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="brand", cascade="all, delete-orphan")
    sort_configs = relationship("SortConfig", back_populates="brand", cascade="all, delete-orphan")
    blackout_rules = relationship("BlackoutRule", back_populates="brand", cascade="all, delete-orphan")
    settings = relationship("BrandSettings", back_populates="brand", uselist=False, cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_brands_name_active', 'name', 'deleted_at'),
    )


class BrandSettings(Base):
    """
    Configurable settings for a brand.
    All previously hardcoded values are now editable here.
    """
    __tablename__ = "brand_settings"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), nullable=False, unique=True)
    
    # === Box Categories ===
    box_categories = Column(JSON, default=lambda: {
        "large_box": {"name": "28x2x44", "label": "28×2×44 (Large Items)"},
        "banner_box": {"name": "8x8x36", "label": "8×8×36 (Banner Present)"},
        "standard_box": {"name": "8x8x30", "label": "8×8×30 (Standard)"},
        "stay_flat_envelope": {"name": "Stay Flat Envelope", "label": "Stay Flat Envelope"},
        "padded_envelope": {"name": "Padded Envelope", "label": "Padded Envelope"},
        "padded_pack": {"name": "Padded Pack", "label": "Padded Pack"}
    })
    
    # === Default Standard Box ===
    default_standard_box = Column(String(50), default="8x8x30")
    
    # === Box Capacity Limits ===
    # Max capacity sum before needing manual review
    large_box_capacity_limit = Column(Integer, default=20)
    
    # === Predetermined Wobblers (excluded from kit detection) ===
    predetermined_wobblers = Column(JSON, default=lambda: [
        "shelf wobbler kit; alcohol version",
        "shelf wobbler kit; non-alcohol version"
    ])
    
    # === Sign Type Keywords for Classification ===
    sign_type_keywords = Column(JSON, default=lambda: {
        "banner": ["banner sign"],
        "yard": ["yard sign"],
        "aframe": ["a frame", "a-frame"],
        "bollard": ["bollard cover"],
        "polekit": ["pole sign kit", "pole sign"],
        "windmaster": ["windmaster"],
        "door_24x36": ["door decal 24x36", "door sign 24x36"],
        "door_6x30": ["door decal 24x6", "Door Decal; 24\"W X 6\"H"],
        "window_sign": ["window sign"],
        "pump_topper": ["pump topper"],
        "corner_cooler": ["corner cooler cling", "corner cooler"],
        "starburst": ["starbursts"],
        "wobbler": ["shelf wobbler", "wobbler"],
        "nozzle": ["nozzle talker", "nozzle"]
    })
    
    # === Size Order for Sorting (smallest to largest) ===
    size_order = Column(JSON, default=lambda: [
        "nozzle", "wobbler", "corner_cooler", "starburst", "pump_topper",
        "banner", "door_6x30", "yard", "window_sign", "door_24x36",
        "aframe", "polekit", "windmaster", "bollard"
    ])
    
    # === Large Items (require 28x2x44 box) ===
    large_item_types = Column(JSON, default=lambda: [
        "yard", "aframe", "bollard", "windmaster", "polekit"
    ])
    
    # === PDF Layout Settings ===
    pdf_margin_left = Column(Integer, default=72)
    pdf_margin_right = Column(Integer, default=72)
    pdf_margin_top = Column(Integer, default=72)
    pdf_margin_bottom = Column(Integer, default=72)
    pdf_line_leading = Column(Float, default=1.2)
    
    # === Kit Detection Settings ===
    kit_marker_patterns = Column(JSON, default=lambda: {
        "counter": {
            "text": "*CANDY; COUNTER KIT*",
            "regex": "\\*\\s*CANDY\\s*;\\s*COUNTER\\s*KIT\\s*\\*"
        },
        "shipper": {
            "text": "*CANDY; SHIPPER KIT*",
            "regex": "\\*\\s*CANDY\\s*;\\s*SHIPPER\\s*KIT\\s*\\*"
        },
        "limited_counter": {
            "text": "*CANDY; LIMITED COUNTER KIT*",
            "regex": "\\*\\s*CANDY\\s*;\\s*LIMITED\\s*COUNTER\\s*KIT\\s*\\*"
        },
        "limited_shipper": {
            "text": "*CANDY; LIMITED SHIPPER KIT*",
            "regex": "\\*\\s*CANDY\\s*;\\s*LIMITED\\s*SHIPPER\\s*KIT\\s*\\*"
        },
        "wobbler_alc": {
            "text": "*Shelf Wobbler Kit; Alcohol Version*",
            "regex": "\\*\\s*Shelf\\s*Wobbler\\s*Kit\\s*;\\s*Alcohol\\s*Version\\s*\\*"
        },
        "wobbler_nonalc": {
            "text": "*Shelf Wobbler Kit; Non-Alcohol Version*",
            "regex": "\\*\\s*Shelf\\s*Wobbler\\s*Kit\\s*;\\s*Non-Alcohol\\s*Version\\s*\\*"
        }
    })
    
    # === Wobbler Kit Detection Threshold ===
    # Minimum number of stores that must share a wobbler for it to be considered a kit
    wobbler_kit_threshold = Column(Integer, default=10)
    
    # === Output File Naming ===
    output_filename_pattern = Column(String(200), default="{brand}_{date}_sorted.pdf")
    
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    
    brand = relationship("Brand", back_populates="settings")


class ParsePattern(Base):
    """
    Visual parse pattern for extracting data from PDFs.
    Stores region coordinates that user defined by clicking on sample PDF.
    """
    __tablename__ = "parse_patterns"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), nullable=False)
    name = Column(String(100), nullable=False)  # e.g., "Store Header", "Item Row"
    pattern_type = Column(String(50), nullable=False)  # "header", "item_row", "footer"
    
    # Detection settings
    detection_text = Column(String(255), nullable=True)  # Text that indicates this pattern applies
    detection_regex = Column(String(255), nullable=True)  # Regex for detection
    
    # Region definitions (JSON array of field regions)
    # Each region: {"field": "store_number", "x0": 0.1, "y0": 0.1, "x1": 0.3, "y1": 0.15, "type": "text"}
    regions = Column(JSON, default=list)
    
    # Sample image of pattern for reference
    sample_image_base64 = Column(Text, nullable=True)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    
    brand = relationship("Brand", back_populates="parse_patterns")


class Store(Base):
    """Individual store/location"""
    __tablename__ = "stores"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    store_code = Column(String(20), nullable=False, index=True)  # e.g., "A1234"
    name = Column(String(200), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(50), nullable=True)
    zip_code = Column(String(20), nullable=True)
    region = Column(String(100), nullable=True)
    store_class = Column(String(50), nullable=True)
    
    # Custom attributes (flexible JSON for brand-specific data)
    attributes = Column(JSON, default=dict)
    
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    
    # Relationships
    orders = relationship("Order", back_populates="store", cascade="all, delete-orphan")


class Order(Base, SoftDeleteMixin):
    """Single store order (one packing slip section)"""
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), nullable=False, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=True, index=True)
    
    # Order identification
    order_reference = Column(String(100), nullable=True, index=True)
    store_code = Column(String(20), nullable=False, index=True)  # Denormalized for quick access
    
    # Classification results
    store_type = Column(String(100), nullable=True, index=True)  # e.g., "Alcohol Counter + Shipper"
    kit_type = Column(String(50), nullable=True, index=True)  # "both", "counter", "shipper", "neither"
    alcohol_type = Column(String(50), nullable=True, index=True)  # "alcohol", "non_alcohol", "none"
    box_category = Column(String(50), nullable=True)  # "28x2x44", "8x8x36", etc.
    
    # Flags
    has_banner = Column(Boolean, default=False)
    has_pump_topper = Column(Boolean, default=False)
    needs_manual_review = Column(Boolean, default=False, index=True)
    manual_review_reason = Column(Text, nullable=True)
    
    # Source info
    source_pdf = Column(String(500), nullable=True)
    source_pages = Column(JSON, default=list)  # [0, 1, 2] page indices
    
    # Raw extracted data
    raw_text = Column(Text, nullable=True)
    extracted_data = Column(JSON, default=dict)
    
    # Processing info
    processed_at = Column(DateTime, default=utcnow, index=True)
    batch_id = Column(String(100), nullable=True, index=True)  # Groups orders from same PDF
    
    brand = relationship("Brand", back_populates="orders")
    store = relationship("Store", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_orders_brand_batch', 'brand_id', 'batch_id'),
        Index('idx_orders_store_date', 'store_code', 'processed_at'),
        Index('idx_orders_classification', 'kit_type', 'alcohol_type', 'store_type'),
        Index('idx_orders_active', 'deleted_at', 'processed_at'),
    )


class OrderItem(Base):
    """Individual line item in an order"""
    __tablename__ = "order_items"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    
    sign_type = Column(String(200), nullable=True)
    promotion_name = Column(String(500), nullable=True)
    quantity = Column(Integer, default=1)
    
    # For special markers
    is_kit_marker = Column(Boolean, default=False)
    kit_type = Column(String(50), nullable=True)  # "counter", "shipper", "wobbler_alc", etc.
    
    # Raw data
    raw_text = Column(Text, nullable=True)
    
    order = relationship("Order", back_populates="items")


class FormattingRule(Base):
    """
    Selective formatting rules for PDF output customization.
    
    Allows users to define custom colors, fonts, and styles for:
    - Specific PDF elements (headers, rows, footers)
    - Text containing certain patterns
    - Specific data fields
    """
    __tablename__ = "formatting_rules"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), nullable=True)  # Nullable for global rules
    
    name = Column(String(200), nullable=False)
    
    # Target type: 'element', 'text_match', 'field'
    target_type = Column(String(50), nullable=False)
    target_value = Column(String(500), nullable=False)  # Element name, text pattern, or field name
    
    # Styles as JSON
    # Structure: {
    #   "background_color": "#FFEB3B",
    #   "text_color": "#000000",
    #   "font_size": 12,
    #   "font_weight": "normal"|"bold",
    #   "font_style": "normal"|"italic",
    #   "text_decoration": "none"|"underline"|"line-through",
    #   "border_color": "#000000",
    #   "border_width": 1,
    #   "opacity": 100
    # }
    styles = Column(JSON, default=dict)
    
    priority = Column(Integer, default=0)  # Higher priority rules apply later (override)
    is_enabled = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class SortConfig(Base):
    """Tiered sorting configuration per brand"""
    __tablename__ = "sort_configs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), nullable=False)
    name = Column(String(100), nullable=False)
    is_default = Column(Boolean, default=False)
    
    # Tiered sort configuration (JSON)
    # Structure: {"tiers": [{"name": "Kit Type", "field": "kit_type", "enabled": true, "categories": [...]}]}
    tiers = Column(JSON, default=list)
    
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    
    brand = relationship("Brand", back_populates="sort_configs")


class BlackoutRule(Base):
    """
    Blackout/redaction rules per brand.
    
    Supports two rule types:
    - "cancelled": Always blackout this item (simple sign_type + sign_version match)
    - "conditional": Blackout target when conditions are met on the same order
    
    For conditional rules, the logic is stored as JSON:
    {
        "conditions": [
            {"field": "item_contains", "value": "Alcohol Version"},
            {"field": "item_contains", "value": "Non-Alcohol Version"}
        ],
        "operator": "AND",  // "AND" or "OR"
        "target": {"field": "item_contains", "value": "Non-Alcohol Version"}
    }
    
    This allows madlib-style rules like:
    "If order contains [Alcohol Version] AND [Non-Alcohol Version], blackout [Non-Alcohol Version]"
    """
    __tablename__ = "blackout_rules"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), nullable=False)
    
    # Rule type: "cancelled" for simple always-blackout, "conditional" for logic-based
    rule_type = Column(String(50), default="cancelled")
    
    # Human-readable name/description for the rule
    name = Column(String(255), nullable=True)
    
    # For "cancelled" type: simple item matching
    sign_type = Column(String(200), nullable=True)
    sign_version = Column(String(500), nullable=True)
    
    # For "conditional" type: JSON logic definition
    # Structure: {"conditions": [...], "operator": "AND"|"OR", "target": {...}}
    condition_logic = Column(JSON, nullable=True)
    
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)
    
    brand = relationship("Brand", back_populates="blackout_rules")


class ProcessingBatch(Base):
    """Tracks PDF processing batches for history/troubleshooting"""
    __tablename__ = "processing_batches"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(String(100), nullable=False, unique=True, index=True)
    
    source_filename = Column(String(500), nullable=False)
    source_path = Column(String(1000), nullable=True)
    output_filename = Column(String(500), nullable=True)
    output_path = Column(String(1000), nullable=True)
    
    brand_id = Column(Integer, ForeignKey("brands.id"), nullable=True, index=True)
    
    # Stats
    total_pages = Column(Integer, default=0)
    total_stores = Column(Integer, default=0)
    total_items = Column(Integer, default=0)
    
    # Box counts
    box_counts = Column(JSON, default=dict)  # {"28x2x44": 5, "8x8x36": 10, ...}
    
    # Status
    status = Column(String(50), default="pending", index=True)  # pending, processing, completed, error
    error_message = Column(Text, nullable=True)
    
    started_at = Column(DateTime, default=utcnow, index=True)
    completed_at = Column(DateTime, nullable=True)
    
    __table_args__ = (
        Index('idx_batch_status_date', 'status', 'started_at'),
        Index('idx_batch_brand_status', 'brand_id', 'status'),
    )


# Database initialization
def init_database(db_path: str = "packing_slip_manager.db"):
    """Initialize the SQLite database and create all tables."""
    engine = create_engine(f"sqlite:///{db_path}", echo=False)
    Base.metadata.create_all(engine)
    return engine


def get_session(engine):
    """Create a new database session."""
    Session = sessionmaker(bind=engine)
    return Session()


# Kit marker constants (matching original KFSORT1.0.py)
KIT_MARKERS = {
    "counter": {
        "text": "*CANDY; COUNTER KIT*",
        "regex": r"\*\s*CANDY\s*;\s*COUNTER\s*KIT\s*\*"
    },
    "shipper": {
        "text": "*CANDY; SHIPPER KIT*",
        "regex": r"\*\s*CANDY\s*;\s*SHIPPER\s*KIT\s*\*"
    },
    "wobbler_alc": {
        "text": "*Shelf Wobbler Kit; Alcohol Version*",
        "regex": r"\*\s*Shelf\s*Wobbler\s*Kit\s*;\s*Alcohol\s*Version\s*\*"
    },
    "wobbler_nonalc": {
        "text": "*Shelf Wobbler Kit; Non-Alcohol Version*",
        "regex": r"\*\s*Shelf\s*Wobbler\s*Kit\s*;\s*Non-Alcohol\s*Version\s*\*"
    }
}

# Default store type order (matching original KFSORT1.0.py)
DEFAULT_STORE_TYPE_ORDER = [
    "Alcohol Counter + Shipper",
    "Alcohol Counter",
    "Alcohol Shipper",
    "Alcohol No Counter/Shipper",
    "Non-Alcohol Counter + Shipper",
    "Non-Alcohol Counter",
    "Non-Alcohol Shipper",
    "Non-Alcohol No Counter/Shipper",
    "Counter + Shipper",
    "Counter",
    "Shipper",
    "No Counter/Shipper",
    ""
]


# Default data seeding
def seed_default_data(session):
    """Seed the database with default Kwik Fill configuration matching KFSORT1.0.py."""
    
    # Check if already seeded
    existing = session.query(Brand).filter_by(name="Kwik Fill").first()
    if existing:
        return existing
    
    # Create Kwik Fill brand
    kwik_fill = Brand(
        name="Kwik Fill",
        description="Kwik Fill convenience stores - default configuration matching KFSORT1.0.py"
    )
    session.add(kwik_fill)
    session.flush()
    
    # Default sort config - matching original _DEFAULT_TIERED_SORT
    default_sort = SortConfig(
        brand_id=kwik_fill.id,
        name="Default Tiered Sort",
        is_default=True,
        tiers=[
            {
                "name": "Kit Type",
                "field": "kit_type",
                "enabled": True,
                "categories": [
                    {"id": "both", "label": "Counter + Shipper", "order": 1},
                    {"id": "counter", "label": "Counter Only", "order": 2},
                    {"id": "shipper", "label": "Shipper Only", "order": 3},
                    {"id": "neither", "label": "No Counter/Shipper", "order": 4}
                ]
            },
            {
                "name": "Alcohol Type",
                "field": "alcohol_type",
                "enabled": True,
                "categories": [
                    {"id": "alcohol", "label": "Alcohol", "order": 1},
                    {"id": "non_alcohol", "label": "Non-Alcohol", "order": 2},
                    {"id": "none", "label": "Neither", "order": 3}
                ]
            },
            {
                "name": "Location",
                "field": "state",
                "enabled": True,
                "categories": [
                    {"id": "NY", "label": "New York", "order": 1},
                    {"id": "PA", "label": "Pennsylvania", "order": 2},
                    {"id": "OH", "label": "Ohio", "order": 3},
                    {"id": "_other", "label": "Other", "order": 99}
                ]
            },
            {
                "name": "Store Code",
                "field": "store_code",
                "enabled": True,
                "categories": []  # Empty = alphabetical sort
            }
        ]
    )
    session.add(default_sort)
    
    # Default parse pattern for Kwik Fill header
    # Regex matches: Store: A1234 format
    header_pattern = ParsePattern(
        brand_id=kwik_fill.id,
        name="Store Header",
        pattern_type="header",
        detection_text="Store:",
        detection_regex=r"Store:\s?[A-Z]\d{4}",
        regions=[
            {"field": "store_code", "x0": 0.05, "y0": 0.02, "x1": 0.35, "y1": 0.06, "type": "text"},
            {"field": "store_class", "x0": 0.05, "y0": 0.06, "x1": 0.35, "y1": 0.10, "type": "text"},
            {"field": "location", "x0": 0.35, "y0": 0.02, "x1": 0.65, "y1": 0.06, "type": "text"}
        ],
        is_active=True
    )
    session.add(header_pattern)
    
    # Item row pattern - columns: Sign Type | Promotion Name | Qty
    item_pattern = ParsePattern(
        brand_id=kwik_fill.id,
        name="Item Row",
        pattern_type="item_row",
        detection_text=None,
        detection_regex=None,
        regions=[
            {"field": "sign_type", "x0": 0.0, "y0": 0.0, "x1": 0.25, "y1": 1.0, "type": "text"},
            {"field": "promotion_name", "x0": 0.25, "y0": 0.0, "x1": 0.80, "y1": 1.0, "type": "text"},
            {"field": "quantity", "x0": 0.80, "y0": 0.0, "x1": 1.0, "y1": 1.0, "type": "number"}
        ],
        is_active=True
    )
    session.add(item_pattern)
    
    # Default CONDITIONAL blackout rules - Alcohol/Non-Alcohol logic
    # These are the primary rules for handling wobbler alcohol versioning
    default_conditional_rules = [
        {
            "name": "If Alcohol, blackout Non-Alcohol",
            "rule_type": "conditional",
            "condition_logic": {
                "conditions": [
                    {"field": "item_contains", "value": "Alcohol Version"}
                ],
                "operator": "AND",
                "target": {"field": "item_contains", "value": "Non-Alcohol Version"}
            },
            "is_enabled": True
        },
        {
            "name": "If Non-Alcohol, blackout Alcohol",
            "rule_type": "conditional",
            "condition_logic": {
                "conditions": [
                    {"field": "item_contains", "value": "Non-Alcohol Version"}
                ],
                "operator": "AND",
                "target": {"field": "item_contains", "value": "Alcohol Version"}
            },
            "is_enabled": True
        }
    ]
    
    for rule_data in default_conditional_rules:
        rule = BlackoutRule(
            brand_id=kwik_fill.id,
            rule_type=rule_data["rule_type"],
            name=rule_data["name"],
            condition_logic=rule_data["condition_logic"],
            is_enabled=rule_data["is_enabled"]
        )
        session.add(rule)
    
    # Default formatting rules - all kit highlights are now configurable
    # These can be edited/disabled via the Selective Formatting settings page
    default_formatting_rules = [
        # Standard kit highlights
        {
            "name": "Counter Kit Highlight",
            "target_type": "text_match",
            "target_value": "CANDY; COUNTER KIT",
            "styles": {
                "background_color": "#ADD9E6",
                "text_color": "#000000",
                "opacity": 60
            },
            "priority": 10
        },
        {
            "name": "Shipper Kit Highlight",
            "target_type": "text_match",
            "target_value": "CANDY; SHIPPER KIT",
            "styles": {
                "background_color": "#FFB5C2",
                "text_color": "#000000",
                "opacity": 60
            },
            "priority": 10
        },
        # Limited kit highlights (same colors, white text effect)
        {
            "name": "Limited Counter Kit Highlight",
            "target_type": "text_match",
            "target_value": "CANDY; LIMITED COUNTER KIT",
            "styles": {
                "background_color": "#ADD9E6",
                "text_color": "#FFFFFF",
                "opacity": 100
            },
            "priority": 10
        },
        {
            "name": "Limited Shipper Kit Highlight", 
            "target_type": "text_match",
            "target_value": "CANDY; LIMITED SHIPPER KIT",
            "styles": {
                "background_color": "#FFB5C2",
                "text_color": "#FFFFFF",
                "opacity": 100
            },
            "priority": 10
        },
        # Wobbler kit highlights
        {
            "name": "Wobbler Kit (Alcohol) Highlight",
            "target_type": "text_match",
            "target_value": "Shelf Wobbler Kit; Alcohol Version",
            "styles": {
                "background_color": "#CCE6CC",
                "text_color": "#000000",
                "opacity": 60
            },
            "priority": 10
        },
        {
            "name": "Wobbler Kit (Non-Alcohol) Highlight",
            "target_type": "text_match",
            "target_value": "Shelf Wobbler Kit; Non-Alcohol Version",
            "styles": {
                "background_color": "#F2D9B3",
                "text_color": "#000000",
                "opacity": 60
            },
            "priority": 10
        }
    ]
    
    for rule_data in default_formatting_rules:
        rule = FormattingRule(
            brand_id=kwik_fill.id,
            name=rule_data["name"],
            target_type=rule_data["target_type"],
            target_value=rule_data["target_value"],
            styles=rule_data["styles"],
            priority=rule_data["priority"],
            is_enabled=True
        )
        session.add(rule)
    
    # Create default brand settings with all configurable values
    default_settings = BrandSettings(brand_id=kwik_fill.id)
    session.add(default_settings)
    
    session.commit()
    return kwik_fill


if __name__ == "__main__":
    # Test database creation
    engine = init_database("test_packing_slip.db")
    session = get_session(engine)
    seed_default_data(session)
    print("Database initialized successfully!")
    session.close()
