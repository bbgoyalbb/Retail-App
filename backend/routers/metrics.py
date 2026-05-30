"""
Metrics router for Prometheus-compatible metrics.

NOTE: This router requires the prometheus_client dependency.
Add to requirements.txt: prometheus_client==0.20.0
"""
from fastapi import APIRouter
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from prometheus_client.fastapi import expose_metrics
from starlette.responses import Response

router = APIRouter()

# Define metrics
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint']
)

active_connections = Gauge(
    'active_connections',
    'Active database connections'
)

items_total = Gauge(
    'items_total',
    'Total number of items in database'
)

@router.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    return Response(generate_latest(), media_type="text/plain")

# Expose metrics to FastAPI app
def setup_metrics(app):
    """Setup metrics for the FastAPI app."""
    app.include_router(router)
    return app
