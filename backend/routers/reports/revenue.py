"""
Revenue report router.
Handles revenue analytics with daily, weekly, and monthly aggregations.
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from ..deps import get_db, get_current_user_dep

router = APIRouter()

@router.get("/reports/revenue")
async def get_revenue_report(db: AsyncIOMotorDatabase = Depends(get_db), period: str = "daily", date_from: Optional[str] = None, date_to: Optional[str] = None, current_user: dict = Depends(get_current_user_dep)):
    match_query = {"cancelled": {"$ne": True}}
    if date_from:
        match_query.setdefault("date", {})["$gte"] = date_from
    if date_to:
        match_query.setdefault("date", {})["$lte"] = date_to

    _agg_fields = {
        "fabric_total":        {"$sum": "$fabric_amount"},
        "fabric_received":     {"$sum": "$fabric_received"},
        "tailoring_total":     {"$sum": "$tailoring_amount"},
        "tailoring_received":  {"$sum": "$tailoring_received"},
        "embroidery_total":    {"$sum": "$embroidery_amount"},
        "embroidery_received": {"$sum": "$embroidery_received"},
        "addon_total":         {"$sum": "$addon_amount"},
        "addon_received":      {"$sum": "$addon_received"},
        "count":               {"$sum": 1},
    }

    # Project only the fields needed for aggregation — reduces per-document size
    _proj = {"$project": {"date": 1, "fabric_amount": 1, "fabric_received": 1,
        "tailoring_amount": 1, "tailoring_received": 1,
        "embroidery_amount": 1, "embroidery_received": 1,
        "addon_amount": 1, "addon_received": 1}}

    # Push grouping into MongoDB for weekly/monthly — avoids fetching 1000 rows to Python
    if period == "weekly":
        pipeline = [
            {"$match": match_query},
            _proj,
            {"$addFields": {"_dt": {"$dateFromString": {"dateString": "$date", "onError": None}}}},
            {"$match": {"_dt": {"$ne": None}}},
            {"$group": {"_id": {"$dateToString": {"format": "%Y-W%V", "date": "$_dt"}}, **_agg_fields}},
            {"$sort": {"_id": 1}},
        ]
        return await db.items.aggregate(pipeline).to_list(500)

    if period == "monthly":
        pipeline = [
            {"$match": match_query},
            _proj,
            {"$addFields": {"_dt": {"$dateFromString": {"dateString": "$date", "onError": None}}}},
            {"$match": {"_dt": {"$ne": None}}},
            {"$group": {"_id": {"$dateToString": {"format": "%Y-%m", "date": "$_dt"}}, **_agg_fields}},
            {"$sort": {"_id": 1}},
        ]
        return await db.items.aggregate(pipeline).to_list(200)

    # daily — group by date string directly (no parse needed)
    pipeline = [
        {"$match": match_query},
        _proj,
        {"$group": {"_id": "$date", **_agg_fields}},
        {"$sort": {"_id": 1}},
        {"$limit": 500},
    ]
    return await db.items.aggregate(pipeline).to_list(500)
