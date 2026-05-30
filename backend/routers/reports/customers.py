"""
Customer report router.
Handles customer analytics and payment status tracking.
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from ..deps import get_db, get_current_user_dep

router = APIRouter()

@router.get("/reports/customers")
async def get_customer_report(db: AsyncIOMotorDatabase = Depends(get_db), date_from: Optional[str] = None, date_to: Optional[str] = None, current_user: dict = Depends(get_current_user_dep)):
    match_query = {"cancelled": {"$ne": True}}
    if date_from:
        match_query.setdefault("date", {})["$gte"] = date_from
    if date_to:
        match_query.setdefault("date", {})["$lte"] = date_to

    pipeline = [
        {"$match": match_query},
        {"$project": {"name": 1, "ref": 1, "fabric_amount": 1, "tailoring_amount": 1,
            "fabric_received": 1, "tailoring_received": 1,
            "embroidery_received": 1, "addon_received": 1,
            "fabric_pending": 1, "tailoring_pending": 1, "embroidery_pending": 1, "addon_pending": 1,
            "fabric_pay_mode": 1, "tailoring_pay_mode": 1, "embroidery_pay_mode": 1, "addon_pay_mode": 1}},
    ]
    pipeline += [
        {"$group": {
            "_id": "$name",
            "total_fabric": {"$sum": "$fabric_amount"},
            "total_received": {"$sum": {"$add": ["$fabric_received", "$tailoring_received", "$embroidery_received", "$addon_received"]}},
            "total_pending_raw": {"$sum": {"$add": [
                {"$cond": [{"$not": [{"$regexMatch": {"input": {"$ifNull": ["$fabric_pay_mode",     ""]}, "regex": "^Settled"}}]}, "$fabric_pending",     0]},
                {"$cond": [{"$not": [{"$regexMatch": {"input": {"$ifNull": ["$tailoring_pay_mode",  ""]}, "regex": "^Settled"}}]}, "$tailoring_pending",  0]},
                {"$cond": [{"$not": [{"$regexMatch": {"input": {"$ifNull": ["$embroidery_pay_mode", ""]}, "regex": "^Settled"}}]}, "$embroidery_pending", 0]},
                {"$cond": [{"$not": [{"$regexMatch": {"input": {"$ifNull": ["$addon_pay_mode",      ""]}, "regex": "^Settled"}}]}, "$addon_pending",      0]},
            ]}},
            "total_tailoring": {"$sum": "$tailoring_amount"},
            "items_count": {"$sum": 1},
            "refs": {"$addToSet": "$ref"},
        }},
        {"$sort": {"total_fabric": -1}},
    ]
    result = await db.items.aggregate(pipeline).to_list(200)
    return [
        {
            "name": r["_id"],
            "total_fabric": r["total_fabric"],
            "total_received": r["total_received"],
            "total_pending": r["total_pending_raw"],
            "total_tailoring": r["total_tailoring"],
            "items_count": r["items_count"],
            "refs_count": len(r["refs"]),
        }
        for r in result if r["_id"]
    ]
