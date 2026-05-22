"""
Items router.
"""
from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, date
import uuid
import re
from bson import ObjectId
from .deps import get_db, get_current_user_dep
from data_quality import round_money, determine_payment_status, build_payment_mode_label
import auth as auth_module
from auth import audit_log
from .models import ItemCreateRequest, ItemUpdateRequest

router = APIRouter()

async def _reset_counter_for_date(db, bill_date: str):
    """After a deletion, reset the counter to the current max seq in DB for that date.
    This allows the next bill on that date to reuse the freed slot if it was the last one."""
    if not bill_date:
        return
    remaining_refs = await db.items.distinct("ref", {"date": bill_date})
    max_seq = 0
    for r in remaining_refs:
        try:
            max_seq = max(max_seq, int(r.split("/")[0]))
        except (ValueError, IndexError):
            pass
    counter_key = f"bill_seq_{bill_date}"
    if max_seq > 0:
        await db.counters.update_one(
            {"_id": counter_key},
            {"$set": {"seq": max_seq}},
            upsert=True,
        )
    else:
        # All bills for this date were deleted — remove the counter entirely
        await db.counters.delete_one({"_id": counter_key})

@router.delete("/items/bulk/delete")
async def bulk_delete_items(
    item_ids: List[str] = Body(...),
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user_dep)
):
    # Restrict to admin/manager only
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Collect affected dates BEFORE deletion so we can reset counters after
    affected_items = await db.items.find({"id": {"$in": item_ids}}, {"_id": 0, "date": 1}).to_list(500)
    affected_dates = {i["date"] for i in affected_items if i.get("date")}

    # Audit log the bulk delete
    await audit_log(db, "bulk_delete", current_user, "items", f"count:{len(item_ids)}", {"count": len(item_ids)})

    result = await db.items.delete_many({"id": {"$in": item_ids}})

    # Reset counters for all affected dates
    for d in affected_dates:
        await _reset_counter_for_date(db, d)

    return {"message": f"{result.deleted_count} items deleted"}

@router.put("/items/{item_id}")
async def update_item(item_id: str, req: ItemUpdateRequest, db = Depends(get_db), current_user: dict = Depends(get_current_user_dep)):
    item = await db.items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    update_fields = {f: v for f, v in req.model_dump(exclude_unset=True).items()}

    # Recalculate fabric_amount and fabric_pending if price/qty/discount changed
    # Skip recalculation for cancelled items — their amounts are intentionally zeroed.
    if not item.get("cancelled") and any(f in update_fields for f in ["price", "qty", "discount"]):
        p = update_fields.get("price", item.get("price", 0))
        q = update_fields.get("qty", item.get("qty", 0))
        d = update_fields.get("discount", item.get("discount", 0))
        new_fabric_amount = round_money((p - (p * d / 100)) * q)
        update_fields["fabric_amount"] = new_fabric_amount
        fabric_received = update_fields.get("fabric_received", item.get("fabric_received", 0))
        new_pending = round_money(new_fabric_amount - (fabric_received or 0))
        update_fields["fabric_pending"] = new_pending
        raw_mode = item.get("fabric_pay_mode", "")
        clean_modes = [m.strip() for m in raw_mode.replace("Settled - ", "").replace("Settled", "").split(",") if m.strip() and m.strip() != "N/A"]
        update_fields["fabric_pay_mode"] = build_payment_mode_label(
            clean_modes or ["Cash"], new_pending, fabric_received or 0
        )

    if update_fields:
        await db.items.update_one({"id": item_id}, {"$set": update_fields})
        await audit_log(db, "update", current_user, "item", item_id, {"fields": list(update_fields.keys())})

    updated = await db.items.find_one({"id": item_id}, {"_id": 0})
    return updated

@router.delete("/items/{item_id}")
async def delete_item(item_id: str, db = Depends(get_db), current_user: dict = Depends(get_current_user_dep)):
    item = await db.items.find_one({"id": item_id}, {"_id": 0})
    result = await db.items.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    await audit_log(db, "delete", current_user, "item", item_id, {"barcode": item.get("barcode") if item else None})
    if item:
        await _reset_counter_for_date(db, item.get("date"))
    return {"message": "Item deleted"}


@router.post("/items")
async def create_item(req: ItemCreateRequest, db = Depends(get_db), current_user: dict = Depends(get_current_user_dep)):
    """Create a new item for an existing order."""
    item_id = str(uuid.uuid4())
    
    # Initialize all fields with defaults
    doc = {
        "id": item_id,
        "ref": req.ref,
        "name": req.name,
        "date": req.date,
        "barcode": req.barcode or "",
        "price": req.price or 0,
        "qty": req.qty or 0,
        "discount": req.discount or 0,
        "fabric_amount": req.fabric_amount or 0,
        "fabric_received": req.fabric_received or 0,
        "fabric_pending": req.fabric_pending or 0,
        "fabric_pay_date": req.fabric_pay_date or "",
        "fabric_pay_mode": req.fabric_pay_mode or "N/A",
        "tailoring_status": req.tailoring_status or "N/A",
        "article_type": req.article_type or "N/A",
        "order_no": req.order_no or "N/A",
        "delivery_date": req.delivery_date or "N/A",
        "tailoring_amount": req.tailoring_amount or 0,
        "tailoring_received": req.tailoring_received or 0,
        "tailoring_pending": req.tailoring_pending or 0,
        "tailoring_pay_date": req.tailoring_pay_date or "",
        "tailoring_pay_mode": req.tailoring_pay_mode or "N/A",
        "embroidery_status": req.embroidery_status or "N/A",
        "karigar": req.karigar or "N/A",
        "embroidery_amount": req.embroidery_amount or 0,
        "embroidery_received": req.embroidery_received or 0,
        "embroidery_pending": req.embroidery_pending or 0,
        "embroidery_pay_date": req.embroidery_pay_date or "",
        "embroidery_pay_mode": req.embroidery_pay_mode or "N/A",
        "addon_desc": req.addon_desc or "N/A",
        "addon_amount": req.addon_amount or 0,
        "addon_received": req.addon_received or 0,
        "addon_pending": req.addon_pending or 0,
        "addon_pay_date": req.addon_pay_date or "",
        "addon_pay_mode": req.addon_pay_mode or "N/A",
        "labour_amount": req.labour_amount or 0,
        "labour_paid": req.labour_paid or "N/A",
        "labour_pay_date": req.labour_pay_date or "",
        "labour_payment_mode": req.labour_payment_mode or "N/A",
        "emb_labour_amount": req.emb_labour_amount or 0,
        "emb_labour_paid": req.emb_labour_paid or "N/A",
        "emb_labour_date": req.emb_labour_date or "",
        "emb_labour_payment_mode": req.emb_labour_payment_mode or "N/A",
        "tally_fabric": req.tally_fabric or False,
        "tally_tailoring": req.tally_tailoring or False,
        "tally_embroidery": req.tally_embroidery or False,
        "tally_addon": req.tally_addon or False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.items.insert_one(doc)
    await audit_log(db, "create", current_user, "item", item_id, {"ref": req.ref, "barcode": req.barcode})
    doc.pop("_id", None)
    return doc

# ==========================================
# SEARCH
# ==========================================

@router.get("/search")
async def search_items(
    db = Depends(get_db),
    q: str = "",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    customer: Optional[str] = None,
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    limit: int = 100,
    skip: int = 0,
    current_user: dict = Depends(get_current_user_dep),
):
    def safe_regex(pattern: str) -> str:
        """Escape special regex characters to prevent ReDoS attacks."""
        return re.escape(pattern.strip()) if pattern else ""
    
    filters = [{"cancelled": {"$ne": True}}]

    if q:
        escaped = safe_regex(q)
        filters.append({"$or": [
            {"name": {"$regex": escaped, "$options": "i"}},
            {"barcode": {"$regex": escaped, "$options": "i"}},
            {"ref": {"$regex": escaped, "$options": "i"}},
            {"article_type": {"$regex": escaped, "$options": "i"}},
            {"order_no": {"$regex": escaped, "$options": "i"}},
            {"karigar": {"$regex": escaped, "$options": "i"}},
            {"addon_desc": {"$regex": escaped, "$options": "i"}},
        ]})

    if customer and customer != "All":
        filters.append({"name": customer})

    if date_from or date_to:
        date_q = {}
        if date_from:
            date_q["$gte"] = date_from
        if date_to:
            date_q["$lte"] = date_to
        filters.append({"date": date_q})

    if status and status != "All":
        if status in ["Pending", "Stitched", "Delivered", "Awaiting Order", "N/A"]:
            filters.append({"tailoring_status": status})
        elif status in ["Required", "In Progress", "Finished", "Not Required"]:
            filters.append({"embroidery_status": status})

    if payment_status and payment_status != "All":
        if payment_status == "Settled":
            filters.append({"fabric_pay_mode": {"$regex": "^Settled"}})
        elif payment_status == "Pending":
            filters.append({"fabric_pay_mode": {"$not": {"$regex": "^Settled"}}, "fabric_amount": {"$gt": 0}})

    if min_amount is not None or max_amount is not None:
        amt_q = {}
        if min_amount is not None:
            amt_q["$gte"] = min_amount
        if max_amount is not None:
            amt_q["$lte"] = max_amount
        filters.append({"fabric_amount": amt_q})

    query = {"$and": filters} if len(filters) > 1 else (filters[0] if filters else {})

    items = await db.items.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    for item in items:
        item["payment_status"] = determine_payment_status(item.get("fabric_pending", 0), item.get("fabric_received", 0))
    total = await db.items.count_documents(query)
    return {"items": items, "total": total}

# ==========================================
# Group Management Endpoints
# ==========================================

@router.post("/items/group")
async def create_group(
    item_ids: List[str] = Body(...),
    group_name: str = Body(...),
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user_dep)
):
    """Create a new group with the specified items using unique _id."""
    if not item_ids:
        raise HTTPException(status_code=400, detail="No items provided")
    if not group_name or not group_name.strip():
        raise HTTPException(status_code=400, detail="Group name is required")

    # Debug logging
    print(f"[DEBUG] create_group: Received item_ids={item_ids}")

    # Use _id instead of barcode for unique identification
    items = await db.items.find({"_id": {"$in": item_ids}}).to_list(1000)
    print(f"[DEBUG] create_group: Found {len(items)} items with _id")

    if len(items) != len(item_ids):
        # Try with id field as fallback
        print(f"[DEBUG] create_group: Not found with _id, trying with id field")
        items = await db.items.find({"id": {"$in": item_ids}}).to_list(1000)
        print(f"[DEBUG] create_group: Found {len(items)} items with id field")

        if len(items) != len(item_ids):
            print(f"[DEBUG] create_group: Still not found. Looking for any items with these IDs in database...")
            # Log sample items to see what fields they have
            sample = await db.items.find().to_list(5)
            print(f"[DEBUG] create_group: Sample item fields: {sample[0].keys() if sample else 'None'}")
            raise HTTPException(status_code=404, detail="Some items not found")

    # Normalize customer names (case-insensitive, trimmed) for comparison
    customers = set(str(item.get("name", "")).strip().lower() for item in items if item.get("name"))
    if len(customers) > 1:
        actual_names = [item.get("name") for item in items]
        raise HTTPException(status_code=400, detail=f"Cannot group items from different customers: {actual_names}")

    # Generate unique group_id
    group_id = str(uuid.uuid4())

    # Update items with group_id and group_name
    result = await db.items.update_many(
        {"_id": {"$in": item_ids}},
        {"$set": {"group_id": group_id, "group_name": group_name.strip()}}
    )

    await audit_log(db, "group_create", current_user, "items", group_id, {
        "group_name": group_name,
        "item_count": result.modified_count,
        "item_ids": item_ids
    })

    return {"group_id": group_id, "group_name": group_name, "item_count": result.modified_count}

@router.put("/items/group/{group_id}")
async def update_group(
    group_id: str,
    item_ids: Optional[List[str]] = Body(None),
    group_name: Optional[str] = Body(None),
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user_dep)
):
    """Update a group - rename or add/remove items."""
    # Check if group exists
    existing_group = await db.items.find_one({"group_id": group_id})
    if not existing_group:
        raise HTTPException(status_code=404, detail="Group not found")

    updates = {}
    audit_data = {}

    # Update group name if provided
    if group_name is not None and group_name.strip():
        updates["group_name"] = group_name.strip()
        audit_data["group_name"] = group_name.strip()

    # Update items if provided
    if item_ids is not None:
        # Validate all items exist and belong to same customer using _id
        items = await db.items.find({"_id": {"$in": item_ids}}).to_list(len(item_ids))
        if len(items) != len(item_ids):
            raise HTTPException(status_code=404, detail="Some items not found")

        # Normalize customer names (case-insensitive, trimmed) for comparison
        customers = set(str(item.get("name", "")).strip().lower() for item in items if item.get("name"))
        if len(customers) > 1:
            actual_names = [item.get("name") for item in items]
            raise HTTPException(status_code=400, detail=f"Cannot group items from different customers: {actual_names}")

        # Remove group_id from all items currently in this group
        await db.items.update_many(
            {"group_id": group_id},
            {"$unset": {"group_id": "", "group_name": ""}}
        )

        # Add group_id to new set of items
        if item_ids:
            result = await db.items.update_many(
                {"_id": {"$in": item_ids}},
                {"$set": {"group_id": group_id, "group_name": group_name.strip() if group_name else existing_group.get("group_name", "")}}
            )
            audit_data["item_count"] = result.modified_count
            audit_data["item_ids"] = item_ids
        else:
            audit_data["item_count"] = 0
            audit_data["item_ids"] = []

    if updates:
        await db.items.update_many(
            {"group_id": group_id},
            {"$set": updates}
        )

    await audit_log(db, "group_update", current_user, "items", group_id, audit_data)

    return {"group_id": group_id, "updated": True}

@router.delete("/items/group/{group_id}")
async def delete_group(
    group_id: str,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user_dep)
):
    """Delete a group (remove group_id from all items)."""
    # Check if group exists
    existing_group = await db.items.find_one({"group_id": group_id})
    if not existing_group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Remove group_id from all items in this group
    result = await db.items.update_many(
        {"group_id": group_id},
        {"$unset": {"group_id": "", "group_name": ""}}
    )

    await audit_log(db, "group_delete", current_user, "items", group_id, {
        "item_count": result.modified_count
    })

    return {"group_id": group_id, "deleted": True, "item_count": result.modified_count}

@router.get("/items/group/{group_id}")
async def get_group(
    group_id: str,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user_dep)
):
    """Get details of a group including all items."""
    items = await db.items.find({"group_id": group_id}, {"_id": 0}).to_list(1000)
    if not items:
        raise HTTPException(status_code=404, detail="Group not found")

    group_name = items[0].get("group_name", "")
    return {
        "group_id": group_id,
        "group_name": group_name,
        "items": items,
        "item_count": len(items)
    }

# ==========================================
# HTML INVOICE v3 (print-ready, screen-ready, WhatsApp-ready)
# ==========================================

