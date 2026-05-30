"""
Summary report router.
Handles overall business summary with totals, pending amounts, and analytics.
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
import asyncio
from motor.motor_asyncio import AsyncIOMotorDatabase
from ..deps import get_db, get_current_user_dep

router = APIRouter()

@router.get("/reports/summary")
async def get_summary_report(db: AsyncIOMotorDatabase = Depends(get_db), date_from: Optional[str] = None, date_to: Optional[str] = None, current_user: dict = Depends(get_current_user_dep)):
    match_query = {"cancelled": {"$ne": True}}
    if date_from:
        match_query.setdefault("date", {})["$gte"] = date_from
    if date_to:
        match_query.setdefault("date", {})["$lte"] = date_to

    _ns = {"$not": {"$regex": "^Settled"}}
    _proj_summary = {"$project": {
        "fabric_amount": 1, "fabric_received": 1, "fabric_pending": 1, "fabric_pay_mode": 1,
        "tailoring_amount": 1, "tailoring_received": 1, "tailoring_pending": 1, "tailoring_pay_mode": 1,
        "embroidery_amount": 1, "embroidery_received": 1, "embroidery_pending": 1, "embroidery_pay_mode": 1,
        "addon_amount": 1, "addon_received": 1, "addon_pending": 1, "addon_pay_mode": 1,
        "article_type": 1,
    }}
    pipeline = [
        {"$match": match_query},
        _proj_summary,
        {"$facet": {
            "totals": [{"$group": {
                "_id": None,
                "total_fabric":              {"$sum": "$fabric_amount"},
                "total_fabric_received":     {"$sum": "$fabric_received"},
                "total_tailoring":           {"$sum": "$tailoring_amount"},
                "total_tailoring_received":  {"$sum": "$tailoring_received"},
                "total_embroidery":          {"$sum": "$embroidery_amount"},
                "total_embroidery_received": {"$sum": "$embroidery_received"},
                "total_addon":               {"$sum": "$addon_amount"},
                "total_addon_received":      {"$sum": "$addon_received"},
                "total_items":               {"$sum": 1},
            }}],
            "fabric_pending":     [{"$match": {"fabric_pay_mode":     _ns}}, {"$group": {"_id": None, "v": {"$sum": "$fabric_pending"}}}],
            "tailoring_pending":  [{"$match": {"tailoring_pay_mode":  _ns}}, {"$group": {"_id": None, "v": {"$sum": "$tailoring_pending"}}}],
            "embroidery_pending": [{"$match": {"embroidery_pay_mode": _ns}}, {"$group": {"_id": None, "v": {"$sum": "$embroidery_pending"}}}],
            "addon_pending":      [{"$match": {"addon_pay_mode":      _ns}}, {"$group": {"_id": None, "v": {"$sum": "$addon_pending"}}}],
            "article_types":      [{"$match": {"article_type": {"$nin": ["N/A", "", None]}}}, {"$group": {"_id": "$article_type", "count": {"$sum": 1}}}],
            "mode_counts_fab":  [{"$match": {"fabric_pay_mode":     {"$regex": "^Settled"}}}, {"$group": {"_id": "$fabric_pay_mode",     "amount": {"$sum": "$fabric_received"}}}],
            "mode_counts_tail": [{"$match": {"tailoring_pay_mode":  {"$regex": "^Settled"}}}, {"$group": {"_id": "$tailoring_pay_mode",  "amount": {"$sum": "$tailoring_received"}}}],
            "mode_counts_emb":  [{"$match": {"embroidery_pay_mode": {"$regex": "^Settled"}}}, {"$group": {"_id": "$embroidery_pay_mode", "amount": {"$sum": "$embroidery_received"}}}],
            "mode_counts_ao":   [{"$match": {"addon_pay_mode":      {"$regex": "^Settled"}}}, {"$group": {"_id": "$addon_pay_mode",      "amount": {"$sum": "$addon_received"}}}],
        }}
    ]
    res_list, adv = await asyncio.gather(
        db.items.aggregate(pipeline).to_list(1),
        db.advances.aggregate([{"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1),
    )
    r = res_list[0] if res_list else {}
    t = r.get("totals", [{}])[0] if r.get("totals") else {}

    # Parse mode_counts from all 4 settled categories
    mode_counts = {}
    for bucket in ["mode_counts_fab", "mode_counts_tail", "mode_counts_emb", "mode_counts_ao"]:
        for entry in r.get(bucket, []):
            label = entry.get("_id", "") or ""
            amount = entry.get("amount", 0)
            parts = label.replace("Settled - ", "").split(", ")
            for p in parts:
                p = p.strip()
                if p:
                    mode_counts[p] = mode_counts.get(p, 0) + amount

    return {
        "total_fabric":              t.get("total_fabric", 0),
        "total_fabric_received":     t.get("total_fabric_received", 0),
        "total_fabric_pending":      r["fabric_pending"][0]["v"]     if r.get("fabric_pending")     else 0,
        "total_tailoring":           t.get("total_tailoring", 0),
        "total_tailoring_received":  t.get("total_tailoring_received", 0),
        "total_tailoring_pending":   r["tailoring_pending"][0]["v"]  if r.get("tailoring_pending")  else 0,
        "total_embroidery":          t.get("total_embroidery", 0),
        "total_embroidery_received": t.get("total_embroidery_received", 0),
        "total_embroidery_pending":  r["embroidery_pending"][0]["v"] if r.get("embroidery_pending") else 0,
        "total_addon":               t.get("total_addon", 0),
        "total_addon_received":      t.get("total_addon_received", 0),
        "total_addon_pending":       r["addon_pending"][0]["v"]      if r.get("addon_pending")      else 0,
        "total_advance":             adv[0]["total"] if adv else 0,
        "total_items":               t.get("total_items", 0),
        "payment_modes": [{"mode": k, "amount": v} for k, v in sorted(mode_counts.items(), key=lambda x: -x[1])],
        "article_types": [{"type": e["_id"], "count": e["count"]} for e in sorted(r.get("article_types", []), key=lambda x: -x["count"])],
    }
