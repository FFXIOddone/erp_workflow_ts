"""
Unit Tests for Database Models
"""

import pytest
from datetime import datetime
from sqlalchemy.orm import sessionmaker

from database.models import Brand, ParsePattern, Order, OrderItem, SortConfig, BlackoutRule


class TestBrandModel:
    """Tests for the Brand model."""
    
    def test_create_brand(self, test_db):
        """Test creating a new brand."""
        brand = Brand(
            name="Test Brand",
            code="TB",
            description="A test brand"
        )
        test_db.add(brand)
        test_db.commit()
        
        assert brand.id is not None
        assert brand.name == "Test Brand"
        assert brand.code == "TB"
        assert brand.created_at is not None
    
    def test_brand_unique_name(self, test_db):
        """Test that brand names must be unique."""
        brand1 = Brand(name="Unique Brand")
        test_db.add(brand1)
        test_db.commit()
        
        brand2 = Brand(name="Unique Brand")
        test_db.add(brand2)
        
        with pytest.raises(Exception):
            test_db.commit()
    
    def test_brand_relationships(self, test_db):
        """Test brand relationship cascading."""
        brand = Brand(name="Parent Brand")
        test_db.add(brand)
        test_db.commit()
        
        pattern = ParsePattern(
            brand_id=brand.id,
            name="Test Pattern",
            pattern_type="header"
        )
        test_db.add(pattern)
        test_db.commit()
        
        # Verify relationship
        assert len(brand.parse_patterns) == 1
        assert brand.parse_patterns[0].name == "Test Pattern"


class TestParsePatternModel:
    """Tests for the ParsePattern model."""
    
    def test_create_pattern(self, test_db):
        """Test creating a parse pattern."""
        brand = Brand(name="Test Brand")
        test_db.add(brand)
        test_db.commit()
        
        pattern = ParsePattern(
            brand_id=brand.id,
            name="Store Header",
            pattern_type="header",
            detection_text="Store:",
            regions=[
                {"field": "store_code", "x0": 0.1, "y0": 0.1, "x1": 0.3, "y1": 0.15}
            ]
        )
        test_db.add(pattern)
        test_db.commit()
        
        assert pattern.id is not None
        assert pattern.is_active is True
        assert len(pattern.regions) == 1
    
    def test_pattern_json_regions(self, test_db):
        """Test that regions are stored as JSON."""
        brand = Brand(name="Test Brand")
        test_db.add(brand)
        test_db.commit()
        
        regions = [
            {"field": "store_code", "x0": 0.1, "y0": 0.1, "x1": 0.3, "y1": 0.15},
            {"field": "store_name", "x0": 0.3, "y0": 0.1, "x1": 0.6, "y1": 0.15}
        ]
        
        pattern = ParsePattern(
            brand_id=brand.id,
            name="Test Pattern",
            pattern_type="header",
            regions=regions
        )
        test_db.add(pattern)
        test_db.commit()
        
        # Fetch fresh from DB
        test_db.refresh(pattern)
        assert pattern.regions == regions


class TestOrderModel:
    """Tests for the Order model."""
    
    def test_create_order(self, test_db):
        """Test creating an order."""
        brand = Brand(name="Test Brand")
        test_db.add(brand)
        test_db.commit()
        
        order = Order(
            brand_id=brand.id,
            store_code="A1234",
            kit_type="both",
            alcohol_type="alcohol",
            box_category="28x2x44"
        )
        test_db.add(order)
        test_db.commit()
        
        assert order.id is not None
        assert order.store_code == "A1234"
    
    def test_order_items(self, test_db):
        """Test order items relationship."""
        brand = Brand(name="Test Brand")
        test_db.add(brand)
        test_db.commit()
        
        order = Order(
            brand_id=brand.id,
            store_code="B5678"
        )
        test_db.add(order)
        test_db.commit()
        
        item1 = OrderItem(order_id=order.id, sign_type="Poster", quantity=2)
        item2 = OrderItem(order_id=order.id, sign_type="Banner", quantity=1)
        test_db.add_all([item1, item2])
        test_db.commit()
        
        assert len(order.items) == 2


class TestSortConfigModel:
    """Tests for the SortConfig model."""
    
    def test_create_sort_config(self, test_db):
        """Test creating a sort configuration."""
        brand = Brand(name="Test Brand")
        test_db.add(brand)
        test_db.commit()
        
        tiers = [
            {
                "name": "Kit Type",
                "field": "kit_type",
                "enabled": True,
                "categories": [
                    {"id": "both", "label": "Both", "order": 0}
                ]
            }
        ]
        
        config = SortConfig(
            brand_id=brand.id,
            name="Default Sort",
            is_default=True,
            tiers=tiers
        )
        test_db.add(config)
        test_db.commit()
        
        assert config.id is not None
        assert config.is_default is True
        assert len(config.tiers) == 1


class TestBlackoutRuleModel:
    """Tests for the BlackoutRule model."""
    
    def test_create_blackout_rule(self, test_db):
        """Test creating a blackout rule."""
        brand = Brand(name="Test Brand")
        test_db.add(brand)
        test_db.commit()
        
        rule = BlackoutRule(
            brand_id=brand.id,
            rule_type="hide",
            name="Hide Test Items",
            sign_type="Test Sign",
            is_enabled=True
        )
        test_db.add(rule)
        test_db.commit()
        
        assert rule.id is not None
        assert rule.is_enabled is True
    
    def test_toggle_blackout_rule(self, test_db):
        """Test toggling a blackout rule."""
        brand = Brand(name="Test Brand")
        test_db.add(brand)
        test_db.commit()
        
        rule = BlackoutRule(
            brand_id=brand.id,
            rule_type="redact",
            name="Redact Sensitive",
            is_enabled=True
        )
        test_db.add(rule)
        test_db.commit()
        
        # Toggle
        rule.is_enabled = not rule.is_enabled
        test_db.commit()
        
        assert rule.is_enabled is False
