"""
Packing Slip Manager - PDF Parsing Service
Handles PDF text extraction, pattern matching, and data extraction.
"""

import re
import fitz  # PyMuPDF
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from pathlib import Path
import base64
from io import BytesIO


@dataclass
class ExtractedRegion:
    """A region of text extracted from a PDF page."""
    field: str
    text: str
    rect: Tuple[float, float, float, float]  # x0, y0, x1, y1
    page_num: int
    confidence: float = 1.0


@dataclass
class ExtractedItem:
    """A single line item extracted from the PDF."""
    sign_type: str
    promotion_name: str
    quantity: int
    raw_text: str = ""
    rect: Optional[Tuple[float, float, float, float]] = None


@dataclass
class ExtractedStore:
    """A single store's order extracted from the PDF."""
    store_code: str
    store_name: str = ""
    store_class: str = ""
    location: str = ""  # State
    area: str = ""
    pages: List[int] = field(default_factory=list)
    items: List[ExtractedItem] = field(default_factory=list)
    raw_text: str = ""
    
    # Classification
    kit_type: str = "neither"  # both, counter, shipper, neither
    alcohol_type: str = "none"  # alcohol, non_alcohol, none
    has_banner: bool = False
    has_pump_topper: bool = False
    
    # Additional attributes
    attributes: Dict[str, Any] = field(default_factory=dict)


class PDFParser:
    """PDF parsing engine with configurable patterns."""
    
    # Known kit markers
    KIT_MARKERS = {
        "counter": [
            r"\*\s*CANDY\s*;\s*COUNTER\s*KIT\s*\*",
            r"\*CANDY; COUNTER KIT\*"
        ],
        "counter_limited": [
            r"\*\s*CANDY\s*;\s*LIMITED\s*COUNTER\s*KIT\s*\*",
            r"\*CANDY; LIMITED COUNTER KIT\*"
        ],
        "shipper": [
            r"\*\s*CANDY\s*;\s*SHIPPER\s*KIT\s*\*",
            r"\*CANDY; SHIPPER KIT\*"
        ],
        "shipper_limited": [
            r"\*\s*CANDY\s*;\s*LIMITED\s*SHIPPER\s*KIT\s*\*",
            r"\*CANDY; LIMITED SHIPPER KIT\*"
        ],
        "wobbler_alc": [
            r"\*\s*Shelf\s*Wobbler\s*Kit\s*;\s*Alcohol\s*Version\s*\*"
        ],
        "wobbler_nonalc": [
            r"\*\s*Shelf\s*Wobbler\s*Kit\s*;\s*Non-Alcohol\s*Version\s*\*"
        ]
    }
    
    # Header detection pattern
    HEADER_PATTERN = re.compile(r'Store:\s*([A-Z]\d{4})')
    
    # State detection
    STATE_PATTERN = re.compile(r'\b(NY|PA|OH|New York|Pennsylvania|Ohio)\b', re.IGNORECASE)
    STATE_MAP = {'NEW YORK': 'NY', 'PENNSYLVANIA': 'PA', 'OHIO': 'OH'}
    
    def __init__(self, parse_patterns: Optional[List[Dict]] = None):
        """
        Initialize parser with optional custom patterns.
        
        Args:
            parse_patterns: List of pattern definitions from database
        """
        self.parse_patterns = parse_patterns or []
        self._compiled_patterns = {}
        self._compile_patterns()
    
    def _compile_patterns(self):
        """Pre-compile regex patterns for performance."""
        for kit_type, patterns in self.KIT_MARKERS.items():
            self._compiled_patterns[kit_type] = [
                re.compile(p, re.IGNORECASE) for p in patterns
            ]
    
    def open_pdf(self, pdf_path: str) -> fitz.Document:
        """Open a PDF file."""
        return fitz.open(pdf_path)
    
    def get_page_image(self, doc: fitz.Document, page_num: int, 
                       scale: float = 1.5) -> str:
        """
        Render a PDF page as a base64 image for the pattern builder.
        
        Args:
            doc: Open PDF document
            page_num: Page number (0-indexed)
            scale: Render scale (1.5 = 150%)
            
        Returns:
            Base64-encoded PNG image
        """
        page = doc[page_num]
        mat = fitz.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=mat)
        
        img_bytes = pix.tobytes("png")
        return base64.b64encode(img_bytes).decode('utf-8')
    
    def extract_text_from_region(self, page: fitz.Page, 
                                  region: Dict[str, float]) -> str:
        """
        Extract text from a specific region of a page.
        
        Args:
            page: PDF page object
            region: Dict with x0, y0, x1, y1 as percentages (0-1)
            
        Returns:
            Extracted text string
        """
        rect = page.rect
        # Convert percentage coordinates to absolute
        x0 = rect.x0 + (region['x0'] * rect.width)
        y0 = rect.y0 + (region['y0'] * rect.height)
        x1 = rect.x0 + (region['x1'] * rect.width)
        y1 = rect.y0 + (region['y1'] * rect.height)
        
        clip_rect = fitz.Rect(x0, y0, x1, y1)
        text = page.get_text("text", clip=clip_rect)
        return text.strip()
    
    def detect_columns(self, page: fitz.Page) -> Dict[str, float]:
        """Detect column boundaries on a page."""
        results = {
            'x_promo_left': page.rect.width * 0.25,
            'x_qty_left': page.rect.width * 0.80,
            'header_bottom': 0
        }
        
        # Try to find column headers - use FIRST match only
        # "Sign Type" appears both as header AND in "Sign Type Total:" footer
        sign_type_rects = page.search_for('Sign Type')
        promo_rects = page.search_for('Promotion Name')
        qty_rects = page.search_for('Qty Ordered')
        
        # Get only the first occurrence of each header (matching KFSORT1.0.py)
        rect_sign = sign_type_rects[0] if sign_type_rects else None
        rect_promo = promo_rects[0] if promo_rects else None
        rect_qty = qty_rects[0] if qty_rects else None
        
        if rect_promo:
            results['x_promo_left'] = rect_promo.x0
        if rect_qty:
            results['x_qty_left'] = rect_qty.x0
        
        # Find header bottom using only first matches
        header_rects = [r for r in [rect_sign, rect_promo, rect_qty] if r]
        if header_rects:
            results['header_bottom'] = max(r.y1 for r in header_rects)
        
        return results
    
    def is_header_page(self, text: str) -> bool:
        """Check if page text contains a store header."""
        return bool(self.HEADER_PATTERN.search(text))
    
    def extract_store_info(self, text: str) -> Dict[str, str]:
        """Extract store metadata from header text."""
        info = {}
        
        # Store code
        match = self.HEADER_PATTERN.search(text)
        if match:
            info['store_code'] = match.group(1)
        
        for line in text.splitlines():
            if 'Sign Type' in line:
                break
            if 'Store:' in line:
                info['store_name'] = line.split('Store:')[-1].strip()
            elif 'Area:' in line:
                info['area'] = line.split('Area:')[-1].strip()
            elif 'Class:' in line:
                info['store_class'] = line.split('Class:')[-1].strip()
            else:
                state_match = self.STATE_PATTERN.search(line)
                if state_match and 'location' not in info:
                    state = state_match.group().upper()
                    info['location'] = self.STATE_MAP.get(state, state)
        
        return info
    
    def detect_kit_markers(self, text: str) -> Dict[str, bool]:
        """Detect kit markers in text."""
        results = {
            'is_counter': False,
            'is_counter_limited': False,
            'is_shipper': False,
            'is_shipper_limited': False,
            'is_alcohol': False,
            'is_non_alcohol': False
        }
        
        for pattern in self._compiled_patterns.get('counter', []):
            if pattern.search(text):
                results['is_counter'] = True
                break
        
        for pattern in self._compiled_patterns.get('counter_limited', []):
            if pattern.search(text):
                results['is_counter_limited'] = True
                break
        
        for pattern in self._compiled_patterns.get('shipper', []):
            if pattern.search(text):
                results['is_shipper'] = True
                break
        
        for pattern in self._compiled_patterns.get('shipper_limited', []):
            if pattern.search(text):
                results['is_shipper_limited'] = True
                break
        
        for pattern in self._compiled_patterns.get('wobbler_alc', []):
            if pattern.search(text):
                results['is_alcohol'] = True
                break
        
        for pattern in self._compiled_patterns.get('wobbler_nonalc', []):
            if pattern.search(text):
                results['is_non_alcohol'] = True
                break
        
        return results
    
    def classify_store(self, kit_markers: Dict[str, bool]) -> Tuple[str, str]:
        """
        Classify store type based on kit markers.
        
        Returns:
            Tuple of (kit_type, alcohol_type)
        """
        # Check for limited variants first (more specific)
        is_counter_limited = kit_markers.get('is_counter_limited', False)
        is_shipper_limited = kit_markers.get('is_shipper_limited', False)
        is_counter = kit_markers.get('is_counter', False)
        is_shipper = kit_markers.get('is_shipper', False)
        
        # Kit type - prioritize limited detection
        if is_counter_limited and is_shipper_limited:
            kit_type = "both_limited"
        elif is_counter_limited and is_shipper:
            kit_type = "counter_limited"  # Counter is limited, shipper is regular
        elif is_counter and is_shipper_limited:
            kit_type = "shipper_limited"  # Shipper is limited, counter is regular
        elif is_counter_limited:
            kit_type = "counter_limited"
        elif is_shipper_limited:
            kit_type = "shipper_limited"
        elif is_counter and is_shipper:
            kit_type = "both"
        elif is_counter:
            kit_type = "counter"
        elif is_shipper:
            kit_type = "shipper"
        else:
            kit_type = "neither"
        
        # Alcohol type
        if kit_markers['is_alcohol']:
            alcohol_type = "alcohol"
        elif kit_markers['is_non_alcohol']:
            alcohol_type = "non_alcohol"
        else:
            alcohol_type = "none"
        
        return kit_type, alcohol_type
    
    def extract_items_from_page(self, page: fitz.Page, 
                                 columns: Dict[str, float]) -> List[ExtractedItem]:
        """Extract item rows from a page."""
        items = []
        words = page.get_text('words')
        
        # Group words by line
        lines = {}
        for word in words:
            x0, y0, x1, y1, text, block, line_num, word_num = word
            if y0 < columns['header_bottom'] + 2:
                continue
            if y1 > page.rect.y1 - 36:
                continue
            
            key = (block, line_num, round(y0, 1))
            if key not in lines:
                lines[key] = []
            lines[key].append((x0, y0, x1, y1, text, word_num))
        
        # Process each line
        last_type = None
        promo_buffer = []
        
        for key in sorted(lines.keys(), key=lambda k: k[2]):
            parts = sorted(lines[key], key=lambda t: t[-1])
            
            left_parts = []
            mid_parts = []
            right_parts = []
            
            for x0, y0, x1, y1, text, word_num in parts:
                xc = (x0 + x1) / 2
                if xc < columns['x_promo_left']:
                    left_parts.append(text)
                elif xc < columns['x_qty_left']:
                    mid_parts.append(text)
                else:
                    right_parts.append(text)
            
            type_text = ' '.join(left_parts).strip()
            promo_text = ' '.join(mid_parts).strip()
            qty_text = ' '.join(right_parts).strip()
            
            if type_text:
                last_type = type_text
            
            if 'Sign Type Total' in (type_text + ' ' + promo_text):
                last_type = None
                promo_buffer = []
                continue
            
            if qty_text.isdigit() and last_type:
                full_promo = ' '.join(promo_buffer + [promo_text]).strip()
                if full_promo:
                    items.append(ExtractedItem(
                        sign_type=last_type,
                        promotion_name=full_promo,
                        quantity=int(qty_text),
                        raw_text=f"{last_type} | {full_promo} | {qty_text}"
                    ))
                promo_buffer = []
            else:
                if promo_text and not re.search(r'[a-z]+://|www\.', promo_text, re.I):
                    promo_buffer.append(promo_text)
        
        return items
    
    def parse_pdf(self, pdf_path: str) -> List[ExtractedStore]:
        """
        Parse an entire PDF and extract all stores.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            List of ExtractedStore objects
        """
        stores = []
        
        with fitz.open(pdf_path) as doc:
            current_store = None
            accumulated_text = ""
            store_info = {}
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                text = page.get_text('text') or ""
                
                if not text.strip():
                    continue
                
                if self.is_header_page(text):
                    # Save previous store
                    if current_store is not None:
                        kit_markers = self.detect_kit_markers(accumulated_text)
                        kit_type, alcohol_type = self.classify_store(kit_markers)
                        current_store.kit_type = kit_type
                        current_store.alcohol_type = alcohol_type
                        current_store.raw_text = accumulated_text
                        
                        # Check for banner/pump topper
                        current_store.has_banner = 'banner' in accumulated_text.lower()
                        current_store.has_pump_topper = 'pump topper' in accumulated_text.lower()
                        
                        stores.append(current_store)
                    
                    # Start new store
                    store_info = self.extract_store_info(text)
                    current_store = ExtractedStore(
                        store_code=store_info.get('store_code', f'UNKNOWN_{page_num}'),
                        store_name=store_info.get('store_name', ''),
                        store_class=store_info.get('store_class', ''),
                        location=store_info.get('location', ''),
                        area=store_info.get('area', ''),
                        pages=[page_num]
                    )
                    accumulated_text = text + " "
                else:
                    accumulated_text += text + " "
                    if current_store:
                        current_store.pages.append(page_num)
                
                # Extract items from this page
                if current_store:
                    columns = self.detect_columns(page)
                    page_items = self.extract_items_from_page(page, columns)
                    current_store.items.extend(page_items)
            
            # Don't forget the last store
            if current_store is not None:
                kit_markers = self.detect_kit_markers(accumulated_text)
                kit_type, alcohol_type = self.classify_store(kit_markers)
                current_store.kit_type = kit_type
                current_store.alcohol_type = alcohol_type
                current_store.raw_text = accumulated_text
                current_store.has_banner = 'banner' in accumulated_text.lower()
                current_store.has_pump_topper = 'pump topper' in accumulated_text.lower()
                stores.append(current_store)
        
        return stores
    
    def get_pdf_info(self, pdf_path: str) -> Dict[str, Any]:
        """Get basic info about a PDF file."""
        with fitz.open(pdf_path) as doc:
            return {
                'page_count': len(doc),
                'filename': Path(pdf_path).name,
                'metadata': doc.metadata
            }


if __name__ == "__main__":
    # Test parsing
    import sys
    if len(sys.argv) > 1:
        parser = PDFParser()
        stores = parser.parse_pdf(sys.argv[1])
        print(f"Found {len(stores)} stores:")
        for store in stores:
            print(f"  {store.store_code}: {len(store.items)} items, kit={store.kit_type}, alc={store.alcohol_type}")
