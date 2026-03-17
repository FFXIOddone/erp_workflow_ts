"""
Config Management Router - Configuration import/export, versioning, and templates.

Provides:
- Import/Export configurations
- Configuration versioning
- Template library for sort rules
- Brand cloning functionality
- Backup/restore
"""

import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Depends, UploadFile, File, Response
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from database.models import (
    Brand, SortConfig, BlackoutRule, ParsePattern
)
from core.database import get_db

router = APIRouter(prefix="/api/config-management", tags=["Configuration Management"])


# ============== Pydantic Models ==============

class ConfigVersion(BaseModel):
    """Version info for a configuration."""
    version: int
    created_at: datetime
    description: Optional[str]
    data: Dict[str, Any]


class ConfigTemplate(BaseModel):
    """Predefined configuration template."""
    id: str
    name: str
    description: str
    category: str  # "sort", "blackout", "parse"
    config: Dict[str, Any]


class BrandCloneRequest(BaseModel):
    """Request to clone a brand configuration."""
    source_brand_id: int
    new_name: str
    new_code: Optional[str] = None
    include_patterns: bool = True
    include_sort_configs: bool = True
    include_blackout_rules: bool = True


class ImportResult(BaseModel):
    """Result of configuration import."""
    success: bool
    imported: Dict[str, int]  # e.g., {"brands": 1, "sort_configs": 2}
    warnings: List[str]
    errors: List[str]


# ============== In-Memory Version History (Demo) ==============

config_versions: Dict[str, List[Dict[str, Any]]] = {}  # brand_id -> versions

# ============== Predefined Templates ==============

SORT_TEMPLATES = [
    {
        "id": "kit_first",
        "name": "Kit Type Priority",
        "description": "Sort by kit type first, then alcohol, then location",
        "category": "sort",
        "config": {
            "tiers": [
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
                        {"id": "non_alcohol", "label": "Non-Alcohol", "order": 2}
                    ]
                },
                {
                    "name": "Store Code",
                    "field": "store_code",
                    "enabled": True,
                    "categories": []
                }
            ]
        }
    },
    {
        "id": "alcohol_first",
        "name": "Alcohol Priority",
        "description": "Sort by alcohol type first, then kit type",
        "category": "sort",
        "config": {
            "tiers": [
                {
                    "name": "Alcohol Type",
                    "field": "alcohol_type",
                    "enabled": True,
                    "categories": [
                        {"id": "alcohol", "label": "Alcohol", "order": 1},
                        {"id": "non_alcohol", "label": "Non-Alcohol", "order": 2}
                    ]
                },
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
                    "name": "Store Code",
                    "field": "store_code",
                    "enabled": True,
                    "categories": []
                }
            ]
        }
    },
    {
        "id": "location_first",
        "name": "Location Priority",
        "description": "Sort by state/location first, then kit type",
        "category": "sort",
        "config": {
            "tiers": [
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
                    "name": "Store Code",
                    "field": "store_code",
                    "enabled": True,
                    "categories": []
                }
            ]
        }
    }
]

BLACKOUT_TEMPLATES = [
    {
        "id": "wobbler_conditional",
        "name": "Conditional Wobbler Blackout",
        "description": "Blackout non-alcohol version when alcohol version is present",
        "category": "blackout",
        "config": {
            "rule_type": "conditional",
            "name": "Wobbler Alcohol Priority",
            "condition_logic": {
                "conditions": [
                    {"field": "item_contains", "value": "Alcohol Version"},
                    {"field": "item_contains", "value": "Non-Alcohol Version"}
                ],
                "operator": "AND",
                "target": {"field": "item_contains", "value": "Non-Alcohol Version"}
            }
        }
    }
]


# ============== Export/Import ==============

@router.get("/export/{brand_id}")
async def export_brand_config(
    brand_id: int,
    include_patterns: bool = True,
    include_sort_configs: bool = True,
    include_blackout_rules: bool = True,
    db: Session = Depends(get_db)
):
    """
    Export all configuration for a brand as JSON.
    """
    brand = db.query(Brand).filter(Brand.id == brand_id).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    
    export_data = {
        "version": "2.0",
        "exported_at": datetime.utcnow().isoformat(),
        "brand": {
            "name": brand.name,
            "code": brand.code,
            "description": brand.description
        }
    }
    
    if include_patterns:
        patterns = db.query(ParsePattern).filter(
            ParsePattern.brand_id == brand_id
        ).all()
        export_data["parse_patterns"] = [
            {
                "name": p.name,
                "pattern_type": p.pattern_type,
                "detection_text": p.detection_text,
                "detection_regex": p.detection_regex,
                "regions": p.regions,
                "is_active": p.is_active
            }
            for p in patterns
        ]
    
    if include_sort_configs:
        sort_configs = db.query(SortConfig).filter(
            SortConfig.brand_id == brand_id
        ).all()
        export_data["sort_configs"] = [
            {
                "name": c.name,
                "is_default": c.is_default,
                "tiers": c.tiers
            }
            for c in sort_configs
        ]
    
    if include_blackout_rules:
        rules = db.query(BlackoutRule).filter(
            BlackoutRule.brand_id == brand_id
        ).all()
        export_data["blackout_rules"] = [
            {
                "rule_type": r.rule_type,
                "name": r.name,
                "sign_type": r.sign_type,
                "sign_version": r.sign_version,
                "condition_logic": r.condition_logic,
                "is_enabled": r.is_enabled
            }
            for r in rules
        ]
    
    json_content = json.dumps(export_data, indent=2)
    
    return Response(
        content=json_content,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename={brand.name.replace(' ', '_')}_config.json"
        }
    )


@router.post("/import")
async def import_brand_config(
    file: UploadFile = File(...),
    merge_existing: bool = False,
    target_brand_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Import configuration from JSON file.
    
    Args:
        file: JSON configuration file
        merge_existing: If true, merge with existing config. If false, replace.
        target_brand_id: Import into existing brand (if not set, creates new brand)
    """
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="Only JSON files are supported")
    
    try:
        content = await file.read()
        config = json.loads(content)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    
    result = {
        "success": True,
        "imported": {},
        "warnings": [],
        "errors": []
    }
    
    # Validate structure
    if "brand" not in config:
        raise HTTPException(status_code=400, detail="Missing 'brand' in configuration")
    
    try:
        # Get or create brand
        if target_brand_id:
            brand = db.query(Brand).filter(Brand.id == target_brand_id).first()
            if not brand:
                raise HTTPException(status_code=404, detail="Target brand not found")
        else:
            brand_data = config["brand"]
            # Check for existing brand with same name
            existing = db.query(Brand).filter(Brand.name == brand_data["name"]).first()
            if existing and not merge_existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Brand '{brand_data['name']}' already exists. Use merge_existing=true or specify target_brand_id."
                )
            
            if existing:
                brand = existing
            else:
                brand = Brand(
                    name=brand_data["name"],
                    code=brand_data.get("code"),
                    description=brand_data.get("description")
                )
                db.add(brand)
                db.flush()
                result["imported"]["brands"] = 1
        
        # Import parse patterns
        if "parse_patterns" in config:
            if not merge_existing:
                # Delete existing patterns
                db.query(ParsePattern).filter(
                    ParsePattern.brand_id == brand.id
                ).delete()
            
            for pattern_data in config["parse_patterns"]:
                pattern = ParsePattern(
                    brand_id=brand.id,
                    name=pattern_data["name"],
                    pattern_type=pattern_data["pattern_type"],
                    detection_text=pattern_data.get("detection_text"),
                    detection_regex=pattern_data.get("detection_regex"),
                    regions=pattern_data.get("regions", []),
                    is_active=pattern_data.get("is_active", True)
                )
                db.add(pattern)
            
            result["imported"]["parse_patterns"] = len(config["parse_patterns"])
        
        # Import sort configs
        if "sort_configs" in config:
            if not merge_existing:
                db.query(SortConfig).filter(
                    SortConfig.brand_id == brand.id
                ).delete()
            
            for sort_data in config["sort_configs"]:
                sort_config = SortConfig(
                    brand_id=brand.id,
                    name=sort_data["name"],
                    is_default=sort_data.get("is_default", False),
                    tiers=sort_data.get("tiers", [])
                )
                db.add(sort_config)
            
            result["imported"]["sort_configs"] = len(config["sort_configs"])
        
        # Import blackout rules
        if "blackout_rules" in config:
            if not merge_existing:
                db.query(BlackoutRule).filter(
                    BlackoutRule.brand_id == brand.id
                ).delete()
            
            for rule_data in config["blackout_rules"]:
                rule = BlackoutRule(
                    brand_id=brand.id,
                    rule_type=rule_data.get("rule_type", "cancelled"),
                    name=rule_data.get("name"),
                    sign_type=rule_data.get("sign_type"),
                    sign_version=rule_data.get("sign_version"),
                    condition_logic=rule_data.get("condition_logic"),
                    is_enabled=rule_data.get("is_enabled", True)
                )
                db.add(rule)
            
            result["imported"]["blackout_rules"] = len(config["blackout_rules"])
        
        db.commit()
        result["brand_id"] = brand.id
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        result["success"] = False
        result["errors"].append(str(e))
    
    return result


# ============== Versioning ==============

@router.post("/version/{brand_id}")
async def create_config_version(
    brand_id: int,
    description: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Create a version snapshot of the current configuration.
    """
    brand = db.query(Brand).filter(Brand.id == brand_id).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    
    # Gather current config
    patterns = db.query(ParsePattern).filter(ParsePattern.brand_id == brand_id).all()
    sort_configs = db.query(SortConfig).filter(SortConfig.brand_id == brand_id).all()
    rules = db.query(BlackoutRule).filter(BlackoutRule.brand_id == brand_id).all()
    
    version_data = {
        "brand": {
            "name": brand.name,
            "code": brand.code,
            "description": brand.description
        },
        "parse_patterns": [
            {
                "name": p.name,
                "pattern_type": p.pattern_type,
                "detection_text": p.detection_text,
                "detection_regex": p.detection_regex,
                "regions": p.regions,
                "is_active": p.is_active
            }
            for p in patterns
        ],
        "sort_configs": [
            {
                "name": c.name,
                "is_default": c.is_default,
                "tiers": c.tiers
            }
            for c in sort_configs
        ],
        "blackout_rules": [
            {
                "rule_type": r.rule_type,
                "name": r.name,
                "sign_type": r.sign_type,
                "sign_version": r.sign_version,
                "condition_logic": r.condition_logic,
                "is_enabled": r.is_enabled
            }
            for r in rules
        ]
    }
    
    # Store version
    brand_key = str(brand_id)
    if brand_key not in config_versions:
        config_versions[brand_key] = []
    
    version_number = len(config_versions[brand_key]) + 1
    
    version_entry = {
        "version": version_number,
        "created_at": datetime.utcnow().isoformat(),
        "description": description,
        "data": version_data
    }
    
    config_versions[brand_key].append(version_entry)
    
    return {
        "success": True,
        "version": version_number,
        "message": f"Version {version_number} created"
    }


@router.get("/versions/{brand_id}")
async def list_config_versions(brand_id: int):
    """
    List all saved versions for a brand.
    """
    brand_key = str(brand_id)
    versions = config_versions.get(brand_key, [])
    
    return {
        "brand_id": brand_id,
        "version_count": len(versions),
        "versions": [
            {
                "version": v["version"],
                "created_at": v["created_at"],
                "description": v["description"]
            }
            for v in reversed(versions)  # Most recent first
        ]
    }


@router.post("/versions/{brand_id}/restore/{version}")
async def restore_config_version(
    brand_id: int,
    version: int,
    db: Session = Depends(get_db)
):
    """
    Restore a previous configuration version.
    """
    brand_key = str(brand_id)
    versions = config_versions.get(brand_key, [])
    
    version_entry = None
    for v in versions:
        if v["version"] == version:
            version_entry = v
            break
    
    if not version_entry:
        raise HTTPException(status_code=404, detail=f"Version {version} not found")
    
    brand = db.query(Brand).filter(Brand.id == brand_id).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    
    version_data = version_entry["data"]
    
    try:
        # Clear and restore parse patterns
        db.query(ParsePattern).filter(ParsePattern.brand_id == brand_id).delete()
        for p_data in version_data.get("parse_patterns", []):
            pattern = ParsePattern(
                brand_id=brand_id,
                name=p_data["name"],
                pattern_type=p_data["pattern_type"],
                detection_text=p_data.get("detection_text"),
                detection_regex=p_data.get("detection_regex"),
                regions=p_data.get("regions", []),
                is_active=p_data.get("is_active", True)
            )
            db.add(pattern)
        
        # Clear and restore sort configs
        db.query(SortConfig).filter(SortConfig.brand_id == brand_id).delete()
        for s_data in version_data.get("sort_configs", []):
            sort_config = SortConfig(
                brand_id=brand_id,
                name=s_data["name"],
                is_default=s_data.get("is_default", False),
                tiers=s_data.get("tiers", [])
            )
            db.add(sort_config)
        
        # Clear and restore blackout rules
        db.query(BlackoutRule).filter(BlackoutRule.brand_id == brand_id).delete()
        for r_data in version_data.get("blackout_rules", []):
            rule = BlackoutRule(
                brand_id=brand_id,
                rule_type=r_data.get("rule_type", "cancelled"),
                name=r_data.get("name"),
                sign_type=r_data.get("sign_type"),
                sign_version=r_data.get("sign_version"),
                condition_logic=r_data.get("condition_logic"),
                is_enabled=r_data.get("is_enabled", True)
            )
            db.add(rule)
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Restored to version {version}",
            "restored": {
                "parse_patterns": len(version_data.get("parse_patterns", [])),
                "sort_configs": len(version_data.get("sort_configs", [])),
                "blackout_rules": len(version_data.get("blackout_rules", []))
            }
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")


# ============== Templates ==============

@router.get("/templates")
async def list_templates(category: Optional[str] = None):
    """
    List available configuration templates.
    """
    templates = SORT_TEMPLATES + BLACKOUT_TEMPLATES
    
    if category:
        templates = [t for t in templates if t["category"] == category]
    
    return {
        "templates": templates,
        "categories": ["sort", "blackout", "parse"]
    }


@router.get("/templates/{template_id}")
async def get_template(template_id: str):
    """
    Get a specific template by ID.
    """
    all_templates = SORT_TEMPLATES + BLACKOUT_TEMPLATES
    
    for template in all_templates:
        if template["id"] == template_id:
            return template
    
    raise HTTPException(status_code=404, detail="Template not found")


@router.post("/templates/{template_id}/apply/{brand_id}")
async def apply_template(
    template_id: str,
    brand_id: int,
    config_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Apply a template to a brand.
    """
    # Find template
    all_templates = SORT_TEMPLATES + BLACKOUT_TEMPLATES
    template = None
    for t in all_templates:
        if t["id"] == template_id:
            template = t
            break
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Verify brand exists
    brand = db.query(Brand).filter(Brand.id == brand_id).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    
    name = config_name or template["name"]
    
    if template["category"] == "sort":
        sort_config = SortConfig(
            brand_id=brand_id,
            name=name,
            is_default=False,
            tiers=template["config"]["tiers"]
        )
        db.add(sort_config)
        db.commit()
        
        return {
            "success": True,
            "type": "sort_config",
            "id": sort_config.id,
            "name": sort_config.name
        }
    
    elif template["category"] == "blackout":
        config = template["config"]
        rule = BlackoutRule(
            brand_id=brand_id,
            rule_type=config.get("rule_type", "conditional"),
            name=config.get("name", name),
            condition_logic=config.get("condition_logic"),
            is_enabled=True
        )
        db.add(rule)
        db.commit()
        
        return {
            "success": True,
            "type": "blackout_rule",
            "id": rule.id,
            "name": rule.name
        }
    
    raise HTTPException(status_code=400, detail="Unsupported template category")


# ============== Brand Cloning ==============

@router.post("/clone-brand")
async def clone_brand(
    request: BrandCloneRequest,
    db: Session = Depends(get_db)
):
    """
    Clone a brand with all its configuration.
    """
    source_brand = db.query(Brand).filter(Brand.id == request.source_brand_id).first()
    if not source_brand:
        raise HTTPException(status_code=404, detail="Source brand not found")
    
    # Check if new name already exists
    existing = db.query(Brand).filter(Brand.name == request.new_name).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Brand with name '{request.new_name}' already exists"
        )
    
    try:
        # Create new brand
        new_brand = Brand(
            name=request.new_name,
            code=request.new_code or (source_brand.code + "_copy" if source_brand.code else None),
            description=f"Cloned from {source_brand.name}"
        )
        db.add(new_brand)
        db.flush()
        
        cloned = {"brand": 1}
        
        # Clone parse patterns
        if request.include_patterns:
            patterns = db.query(ParsePattern).filter(
                ParsePattern.brand_id == request.source_brand_id
            ).all()
            
            for p in patterns:
                new_pattern = ParsePattern(
                    brand_id=new_brand.id,
                    name=p.name,
                    pattern_type=p.pattern_type,
                    detection_text=p.detection_text,
                    detection_regex=p.detection_regex,
                    regions=p.regions,
                    is_active=p.is_active
                )
                db.add(new_pattern)
            
            cloned["patterns"] = len(patterns)
        
        # Clone sort configs
        if request.include_sort_configs:
            sort_configs = db.query(SortConfig).filter(
                SortConfig.brand_id == request.source_brand_id
            ).all()
            
            for c in sort_configs:
                new_config = SortConfig(
                    brand_id=new_brand.id,
                    name=c.name,
                    is_default=c.is_default,
                    tiers=c.tiers
                )
                db.add(new_config)
            
            cloned["sort_configs"] = len(sort_configs)
        
        # Clone blackout rules
        if request.include_blackout_rules:
            rules = db.query(BlackoutRule).filter(
                BlackoutRule.brand_id == request.source_brand_id
            ).all()
            
            for r in rules:
                new_rule = BlackoutRule(
                    brand_id=new_brand.id,
                    rule_type=r.rule_type,
                    name=r.name,
                    sign_type=r.sign_type,
                    sign_version=r.sign_version,
                    condition_logic=r.condition_logic,
                    is_enabled=r.is_enabled
                )
                db.add(new_rule)
            
            cloned["blackout_rules"] = len(rules)
        
        db.commit()
        
        return {
            "success": True,
            "new_brand_id": new_brand.id,
            "new_brand_name": new_brand.name,
            "cloned": cloned
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Clone failed: {str(e)}")


# ============== Backup/Restore ==============

@router.get("/backup")
async def create_full_backup(db: Session = Depends(get_db)):
    """
    Create a full backup of all configurations.
    """
    brands = db.query(Brand).all()
    
    backup_data = {
        "version": "2.0",
        "backup_type": "full",
        "created_at": datetime.utcnow().isoformat(),
        "brands": []
    }
    
    for brand in brands:
        patterns = db.query(ParsePattern).filter(ParsePattern.brand_id == brand.id).all()
        sort_configs = db.query(SortConfig).filter(SortConfig.brand_id == brand.id).all()
        rules = db.query(BlackoutRule).filter(BlackoutRule.brand_id == brand.id).all()
        
        brand_data = {
            "brand": {
                "id": brand.id,
                "name": brand.name,
                "code": brand.code,
                "description": brand.description
            },
            "parse_patterns": [
                {
                    "name": p.name,
                    "pattern_type": p.pattern_type,
                    "detection_text": p.detection_text,
                    "detection_regex": p.detection_regex,
                    "regions": p.regions,
                    "is_active": p.is_active
                }
                for p in patterns
            ],
            "sort_configs": [
                {
                    "name": c.name,
                    "is_default": c.is_default,
                    "tiers": c.tiers
                }
                for c in sort_configs
            ],
            "blackout_rules": [
                {
                    "rule_type": r.rule_type,
                    "name": r.name,
                    "sign_type": r.sign_type,
                    "sign_version": r.sign_version,
                    "condition_logic": r.condition_logic,
                    "is_enabled": r.is_enabled
                }
                for r in rules
            ]
        }
        
        backup_data["brands"].append(brand_data)
    
    json_content = json.dumps(backup_data, indent=2)
    
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    
    return Response(
        content=json_content,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=packing_slip_backup_{timestamp}.json"
        }
    )
