"""
Test script to compare /items vs /search endpoints for Manage Orders page
"""
import asyncio
import os
from dotenv import load_dotenv
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
import re
import sys
sys.path.insert(0, str(Path(__file__).parent))
from constants import tailoring_status_values, embroidery_status_values
from data_quality import determine_payment_status

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ.get("MONGO_URL")
db_name = os.environ.get("DB_NAME")

async def test_reference_02_130726():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Test for reference "02/130726"
    test_ref = "02/130726"
    print(f"=== TESTING REFERENCE: {test_ref} ===")
    
    # Test 1: Get all items directly from database
    print("\n=== TEST 1: DIRECT DATABASE QUERY ===")
    all_items = await db.items.find({"ref": test_ref, "cancelled": {"$ne": True}}, {"_id": 0}).to_list(100)
    
    total_all = sum(i.get('fabric_amount', 0) + i.get('tailoring_amount', 0) + i.get('embroidery_amount', 0) + i.get('addon_amount', 0) for i in all_items)
    
    print(f"Found {len(all_items)} items in database")
    print(f"Total amount: {total_all}")
    
    # Test 2: Simulate the new backend auto-complete logic
    print("\n=== TEST 2: BACKEND AUTO-COMPLETE LOGIC ===")
    PAGE_SIZE = 50
    query_items = {"cancelled": {"$ne": True}}
    projection = {"_id": 0}
    
    # Get page 3 (where the first items for this ref appear)
    items_page3 = await db.items.find(query_items, projection).sort("date", -1).skip((3-1) * PAGE_SIZE).limit(PAGE_SIZE).to_list(PAGE_SIZE)
    
    # Simulate backend auto-complete: fetch complete data for all refs in this page
    refs_in_page = [item["ref"] for item in items_page3 if item.get("ref")]
    if refs_in_page:
        complete_query = query_items.copy()
        complete_query["ref"] = {"$in": refs_in_page}
        complete_items = await db.items.find(complete_query, projection).sort("date", -1).to_list(2000)
        
        # Merge: replace any paginated items with complete versions
        complete_ids = {item["id"] for item in complete_items}
        merged_items = complete_items.copy()
        
        # Add paginated items that are not in the complete set
        for paginated_item in items_page3:
            if paginated_item["id"] not in complete_ids:
                merged_items.append(paginated_item)
        
        # Filter to only items with this ref
        merged_items_ref = [i for i in merged_items if i.get('ref') == test_ref]
        total_merged = sum(i.get('fabric_amount', 0) + i.get('tailoring_amount', 0) + i.get('embroidery_amount', 0) + i.get('addon_amount', 0) for i in merged_items_ref)
        
        print(f"After auto-complete: Found {len(merged_items_ref)} items for this ref, total={total_merged}")
    
    # Test 3: Compare
    print("\n=== TEST 3: COMPARISON ===")
    print(f"Direct DB: {len(all_items)} items, total={total_all}")
    if refs_in_page:
        print(f"Backend auto-complete: {len(merged_items_ref)} items, total={total_merged}")
    
    if refs_in_page and len(merged_items_ref) == len(all_items) and total_merged == total_all:
        print(f"✅ BACKEND AUTO-COMPLETE SUCCESSFUL: All items loaded with correct total!")
    else:
        print(f"⚠️  BACKEND AUTO-COMPLETE FAILED: Expected {len(all_items)} items, got {len(merged_items_ref) if refs_in_page else 0}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(test_reference_02_130726())
