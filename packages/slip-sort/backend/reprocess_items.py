"""
Reprocess script to populate order_items for existing orders.
This script re-parses the source PDFs and adds items to orders that were
processed before the item extraction bug was fixed.
"""

import sys
import json
from pathlib import Path

# Add the backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from services.pdf_parser import PDFParser
from database.models import Order, OrderItem, ProcessingBatch

import os

DATABASE_URL = f"sqlite:///{os.environ.get('DB_PATH', 'packing_slip_manager.db')}"


def reprocess_batch(batch_id: str):
    """Reprocess all orders in a batch to extract items."""
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Get batch
        batch = session.query(ProcessingBatch).filter(
            ProcessingBatch.batch_id == batch_id
        ).first()
        
        if not batch:
            print(f"Batch {batch_id} not found")
            return
        
        print(f"Reprocessing batch: {batch_id}")
        print(f"Source file: {batch.source_path}")
        
        # Get all orders in this batch
        orders = session.query(Order).filter(Order.batch_id == batch_id).all()
        print(f"Found {len(orders)} orders in batch")
        
        # Parse the PDF
        parser = PDFParser()
        pdf_path = batch.source_path
        
        if not Path(pdf_path).exists():
            print(f"PDF not found: {pdf_path}")
            return
        
        extracted_stores = parser.parse_pdf(pdf_path)
        print(f"Extracted {len(extracted_stores)} stores from PDF")
        
        # Build lookup by store code and pages
        store_lookup = {}
        for es in extracted_stores:
            # Key by store_code and first page
            key = (es.store_code, tuple(es.pages))
            store_lookup[key] = es
        
        total_items_added = 0
        orders_updated = 0
        
        for order in orders:
            # Find matching extracted store
            pages = json.loads(order.source_pages) if isinstance(order.source_pages, str) else order.source_pages
            key = (order.store_code, tuple(pages))
            
            es = store_lookup.get(key)
            if not es:
                # Try just by store code
                for k, v in store_lookup.items():
                    if k[0] == order.store_code:
                        es = v
                        break
            
            if not es:
                print(f"  No match for order {order.id} ({order.store_code})")
                continue
            
            # Delete existing items (if any)
            session.query(OrderItem).filter(OrderItem.order_id == order.id).delete()
            
            # Add new items
            items_added = 0
            for item in es.items:
                order_item = OrderItem(
                    order_id=order.id,
                    sign_type=item.sign_type,
                    promotion_name=item.promotion_name,
                    quantity=item.quantity,
                    raw_text=item.raw_text
                )
                session.add(order_item)
                items_added += 1
            
            total_items_added += items_added
            orders_updated += 1
        
        # Update batch totals
        batch.total_items = total_items_added
        batch.total_pages = sum(len(es.pages) for es in extracted_stores)
        
        session.commit()
        print(f"\nReprocessing complete!")
        print(f"  Orders updated: {orders_updated}")
        print(f"  Total items added: {total_items_added}")
        print(f"  Total pages: {batch.total_pages}")
        
    except Exception as e:
        session.rollback()
        print(f"Error: {e}")
        raise
    finally:
        session.close()


def reprocess_all_batches():
    """Reprocess all batches in the database."""
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        batches = conn.execute(
            text("SELECT batch_id, source_filename FROM processing_batches")
        ).fetchall()
    
    print(f"Found {len(batches)} batches to reprocess\n")
    
    for batch_id, filename in batches:
        print(f"\n{'='*50}")
        print(f"Batch: {batch_id}")
        print(f"File: {filename}")
        print('='*50)
        reprocess_batch(batch_id)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Reprocess specific batch
        reprocess_batch(sys.argv[1])
    else:
        # Reprocess all batches
        reprocess_all_batches()
