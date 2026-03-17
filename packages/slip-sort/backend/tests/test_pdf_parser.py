"""
Unit Tests for PDF Parser Service
"""

import pytest
from services.pdf_parser import PDFParser, ExtractedStore, ExtractedItem


class TestPDFParser:
    """Tests for the PDFParser class."""
    
    @pytest.fixture
    def parser(self):
        """Create a parser instance."""
        return PDFParser()
    
    def test_parser_initialization(self, parser):
        """Test parser initializes correctly."""
        assert parser is not None
        assert hasattr(parser, 'KIT_MARKERS')
        assert hasattr(parser, 'HEADER_PATTERN')
    
    def test_kit_markers_defined(self, parser):
        """Test that kit markers are properly defined."""
        assert 'counter' in parser.KIT_MARKERS
        assert 'shipper' in parser.KIT_MARKERS
        assert 'wobbler_alc' in parser.KIT_MARKERS
        assert 'wobbler_nonalc' in parser.KIT_MARKERS
    
    def test_header_pattern_matches(self, parser):
        """Test header pattern detection."""
        test_text = "Store: A1234 Some Store Name"
        match = parser.HEADER_PATTERN.search(test_text)
        assert match is not None
        assert match.group(1) == "A1234"
    
    def test_header_pattern_rejects_invalid(self, parser):
        """Test header pattern rejects invalid codes."""
        invalid_texts = [
            "Store: 1234",  # Missing letter prefix
            "Store: AA123",  # Two letters
            "Some random text",
        ]
        for text in invalid_texts:
            match = parser.HEADER_PATTERN.search(text)
            assert match is None, f"Should not match: {text}"
    
    def test_state_pattern_matches(self, parser):
        """Test state detection pattern."""
        test_cases = [
            ("New York", "NY"),
            ("Pennsylvania", "PA"),
            ("Ohio", "OH"),
            ("NY", "NY"),
            ("PA", "PA"),
        ]
        for text, expected in test_cases:
            match = parser.STATE_PATTERN.search(text)
            assert match is not None, f"Should match: {text}"
    
    def test_is_header_page(self, parser):
        """Test header page detection."""
        header_text = """
        Store: A1234
        Some Store Name
        123 Main St
        """
        assert parser.is_header_page(header_text) is True
        
        non_header_text = "Just some random content"
        assert parser.is_header_page(non_header_text) is False
    
    def test_extract_store_info(self, parser):
        """Test store info extraction."""
        text = """
        Store: A1234 Main Street Store
        Area: NY-North
        """
        info = parser.extract_store_info(text)
        assert info.get('store_code') == 'A1234'


class TestExtractedStore:
    """Tests for the ExtractedStore dataclass."""
    
    def test_default_values(self):
        """Test default values are set correctly."""
        store = ExtractedStore(store_code="A1234")
        
        assert store.store_code == "A1234"
        assert store.store_name == ""
        assert store.kit_type == "neither"
        assert store.alcohol_type == "none"
        assert store.has_banner is False
        assert store.has_pump_topper is False
        assert store.items == []
        assert store.pages == []
    
    def test_with_items(self):
        """Test store with items."""
        items = [
            ExtractedItem(sign_type="Poster", promotion_name="Sale", quantity=2),
            ExtractedItem(sign_type="Banner", promotion_name="Holiday", quantity=1),
        ]
        store = ExtractedStore(
            store_code="B5678",
            store_name="Test Store",
            items=items
        )
        
        assert len(store.items) == 2
        assert store.items[0].quantity == 2


class TestExtractedItem:
    """Tests for the ExtractedItem dataclass."""
    
    def test_create_item(self):
        """Test creating an extracted item."""
        item = ExtractedItem(
            sign_type="Poster",
            promotion_name="Summer Sale",
            quantity=5
        )
        
        assert item.sign_type == "Poster"
        assert item.promotion_name == "Summer Sale"
        assert item.quantity == 5
        assert item.raw_text == ""
    
    def test_item_with_raw_text(self):
        """Test item with raw text captured."""
        item = ExtractedItem(
            sign_type="Banner",
            promotion_name="Holiday",
            quantity=1,
            raw_text="Banner | Holiday | 1"
        )
        
        assert item.raw_text == "Banner | Holiday | 1"
