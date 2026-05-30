"""
Reports router package.
Combines invoice, revenue, customers, and summary report routers.
"""
from fastapi import APIRouter
from .invoice import router as invoice_router
from .revenue import router as revenue_router
from .customers import router as customers_router
from .summary import router as summary_router

# Combine all report routers into one
router = APIRouter()
router.include_router(invoice_router)
router.include_router(revenue_router)
router.include_router(customers_router)
router.include_router(summary_router)

__all__ = ["router"]
