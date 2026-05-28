"""
Retail Management API — entry point.

All route logic lives in routers/. This file handles:
  - App + DB setup
  - Middleware
  - Static file serving
  - Startup / shutdown lifecycle

IMPORTANT: The in-memory rate limiter (auth.py) is single-worker only.
If running with multiple uvicorn workers, rate limiting will not work correctly.
For production with multiple workers, use Redis-backed rate limiting.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import uuid
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

import auth as auth_module  # noqa: F401 — imported for side-effects (security obj)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ==========================================
# LOGGING
# ==========================================
log_file = ROOT_DIR / "server.log"
error_log_file = ROOT_DIR / "errors.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        RotatingFileHandler(log_file, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)

# Separate error logger for stack traces
error_logger = logging.getLogger("error_logger")
error_logger.setLevel(logging.ERROR)
error_handler = RotatingFileHandler(error_log_file, maxBytes=50 * 1024 * 1024, backupCount=10, encoding="utf-8")
error_handler.setFormatter(logging.Formatter(
    "%(asctime)s - %(levelname)s\n%(message)s\n{'='*80}\n"
))
error_logger.addHandler(error_handler)

# Suppress WinError 10054 noise (browser forcibly closes SSL on Windows)
logging.getLogger("asyncio").setLevel(logging.CRITICAL)

# ==========================================
# DATABASE
# ==========================================
mongo_url = os.environ.get("MONGO_URL")
db_name = os.environ.get("DB_NAME")
if not mongo_url:
    raise RuntimeError(
        "MONGO_URL is not set. Add it to backend/.env before starting the server."
    )
if not db_name:
    raise RuntimeError(
        "DB_NAME is not set. Add it to backend/.env before starting the server."
    )

client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
db = client[db_name]

# Inject db into the shared deps module BEFORE any router is imported.
# This maintains compatibility with the existing global `db` imports
# in routers while we transition to `Depends(get_db)`.
import importlib, importlib.util, sys  # noqa: E402
_spec = importlib.util.spec_from_file_location(
    "routers.deps", ROOT_DIR / "routers" / "deps.py"
)
_deps = importlib.util.module_from_spec(_spec)
sys.modules["routers.deps"] = _deps  # register before routers load
_spec.loader.exec_module(_deps)
_deps.set_db(db)

# ==========================================
# LIFECYCLE
# ==========================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    from pymongo import ASCENDING, DESCENDING

    await db.items.create_index("id",      unique=True)
    await db.items.create_index("ref")
    await db.items.create_index("barcode")
    await db.items.create_index("name")
    await db.items.create_index("date")
    await db.items.create_index("order_no")
    await db.items.create_index("karigar")
    await db.items.create_index("cancelled")

    await db.items.create_index([(  "tailoring_status", ASCENDING), ("date",            DESCENDING)])
    await db.items.create_index([(  "ref",              ASCENDING), ("fabric_pay_mode",  ASCENDING)])
    await db.items.create_index([(  "name",             ASCENDING), ("fabric_pay_mode",  ASCENDING)])
    await db.items.create_index([(  "tailoring_status", ASCENDING), ("labour_paid",      ASCENDING)])
    await db.items.create_index([(  "embroidery_status", ASCENDING), ("emb_labour_paid",  ASCENDING)])
    await db.items.create_index([(  "embroidery_status", ASCENDING), ("date",             DESCENDING)])
    await db.items.create_index("fabric_pay_mode")
    await db.items.create_index("tailoring_pay_mode")
    await db.items.create_index("embroidery_pay_mode")
    await db.items.create_index("addon_pay_mode")

    await db.items.create_index("fabric_pay_date")
    await db.items.create_index("tailoring_pay_date")
    await db.items.create_index("embroidery_pay_date")
    await db.items.create_index("addon_pay_date")
    await db.items.create_index("delivery_date")
    await db.items.create_index([("delivery_date", ASCENDING), ("tailoring_status", ASCENDING)])
    await db.items.create_index(
        [("name", "text"), ("barcode", "text"), ("ref", "text"), ("order_no", "text"), ("karigar", "text"), ("addon_desc", "text")],
        name="items_text_search"
    )

    await db.advances.create_index("id",   unique=True)
    await db.advances.create_index("ref")
    await db.advances.create_index("date")
    await db.advances.create_index([("ref",  ASCENDING), ("date",  ASCENDING)])
    await db.advances.create_index([("date", ASCENDING), ("tally", ASCENDING)])
    await db.items.create_index("created_at")
    await db.settings.create_index("key", unique=True)
    await db.token_blocklist.create_index("jti", unique=True)
    await db.token_blocklist.create_index("created_at", expireAfterSeconds=86400)
    await db.audit_logs.create_index("username")
    await db.audit_logs.create_index("action")
    await db.audit_logs.create_index([("timestamp", DESCENDING)])
    await db.counters.create_index("created_at", expireAfterSeconds=86400 * 90)

    # Error logging indexes
    await db.error_logs.create_index("error_id", unique=True)
    await db.error_logs.create_index("timestamp")
    await db.error_logs.create_index("resolved")
    await db.error_logs.create_index("error_type")
    await db.error_logs.create_index([("path", 1), ("timestamp", -1)])

    # Bug report indexes
    await db.bug_reports.create_index("report_id", unique=True)
    await db.bug_reports.create_index("timestamp")
    await db.bug_reports.create_index("status")
    await db.bug_reports.create_index("priority")
    await db.bug_reports.create_index("username")

    # User collection indexes (Fix 2.7)
    await db.users.create_index("username", unique=True)
    await db.users.create_index("role")
    await db.users.create_index("is_active")

    logger.info("MongoDB indexes ensured.")

    yield

    client.close()


# ==========================================
# APP
# ==========================================
_debug = os.environ.get("DEBUG", "false").lower() == "true"
app = FastAPI(
    title="Retail Management API",
    version="2.0.0",
    description="Full-featured retail management system for fabric shops and tailoring businesses.",
    lifespan=lifespan,
    docs_url="/docs" if _debug else None,
    redoc_url="/redoc" if _debug else None,
    openapi_url="/openapi.json" if _debug else None,
    openapi_tags=[
        {"name": "Bills", "description": "Bill creation and dashboard"},
        {"name": "Tailoring", "description": "Tailoring order management"},
        {"name": "Job Work", "description": "Embroidery tracking"},
        {"name": "Reports", "description": "Revenue and customer analytics"},
        {"name": "Settlements", "description": "Payment processing"},
        {"name": "Auth", "description": "Authentication and user management"},
    ],
)

# Attach db to app state for use in Depends(get_db)
app.state.db = db

# Max upload size: 50 MB
MAX_UPLOAD_SIZE = 50 * 1024 * 1024

# ==========================================
# ROUTERS
# ==========================================
from routers import (  # noqa: E402
    bills_router, tailoring_router, jobwork_router,
    settlements_router, daybook_router, labour_router,
    advances_router, orders_router, items_router,
    reports_router, data_router, auth_router,
)

PREFIX = "/api"
app.include_router(bills_router,       prefix=PREFIX)
app.include_router(tailoring_router,   prefix=PREFIX)
app.include_router(jobwork_router,     prefix=PREFIX)
app.include_router(settlements_router, prefix=PREFIX)
app.include_router(daybook_router,     prefix=PREFIX)
app.include_router(labour_router,      prefix=PREFIX)
app.include_router(advances_router,    prefix=PREFIX)
app.include_router(orders_router,      prefix=PREFIX)
app.include_router(items_router,       prefix=PREFIX)
app.include_router(reports_router,     prefix=PREFIX)
app.include_router(data_router,        prefix=PREFIX)
app.include_router(auth_router,        prefix=PREFIX)

# ==========================================
# MIDDLEWARE
# ==========================================
# NOTE: Middleware must be registered BEFORE routes so Starlette wraps them correctly.

# CORS — fail loudly if not configured in production
cors_origins = os.environ.get("CORS_ORIGINS")
if not cors_origins:
    if os.environ.get("DEBUG", "").lower() != "true":
        raise RuntimeError(
            "CORS_ORIGINS environment variable not set. "
            "Set it to your allowed origins (e.g. 'https://yourshop.com'). "
            "For development, set DEBUG=true to allow all origins."
        )
    cors_origins = "*"

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins.split(",") if cors_origins != "*" else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=2048)  # 2KB threshold for gzip efficiency


# ==========================================
# SECURITY HEADERS MIDDLEWARE (Fix 1.4)
# ==========================================
@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(self), microphone=(), geolocation=()"
    return response


# ==========================================
# GLOBAL RATE LIMITING MIDDLEWARE (Fix 1.5)
# ==========================================
# Single-worker in-memory rate limiter for all endpoints
# 200 requests per minute per IP, stricter for expensive endpoints
_RATE_LIMIT_MAX = 200
_RATE_LIMIT_WINDOW = 60  # 1 minute in seconds

try:
    from cachetools import TTLCache
    _global_rate_limits: dict = TTLCache(maxsize=10000, ttl=_RATE_LIMIT_WINDOW)
except ImportError:
    _global_rate_limits: dict = {}  # type: ignore

@app.middleware("http")
async def global_rate_limit(request: Request, call_next):
    """Apply global rate limiting to all endpoints."""
    # Get client IP
    client_ip = request.client.host if request.client else "unknown"
    
    # Skip rate limiting for GET requests (read-only)
    if request.method == "GET":
        return await call_next(request)
    
    # Check rate limit
    try:
        count = _global_rate_limits.get(client_ip, 0)
        if count >= _RATE_LIMIT_MAX:
            return JSONResponse(
                status_code=429,
                content={"detail": f"Rate limit exceeded. Maximum {_RATE_LIMIT_MAX} requests per minute."}
            )
        _global_rate_limits[client_ip] = count + 1
    except Exception:
        pass  # Fail open on rate limit errors
    
    return await call_next(request)


# ==========================================
# ERROR LOGGING MIDDLEWARE
@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    if request.method in ("POST", "PUT", "PATCH"):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_UPLOAD_SIZE:
            return JSONResponse(
                {"detail": f"Request body too large. Maximum allowed size is {MAX_UPLOAD_SIZE // (1024 * 1024)}MB."},
                status_code=413,
            )
    return await call_next(request)


# Cache-Control TTLs for read-only GET endpoints (seconds).
# Mutations (POST/PUT/DELETE) always receive no-store.
_CACHE_TTLS: dict[str, int] = {
    "/api/settings/public":    120,   # firm name/logo — very stable
    "/api/settings":           120,
    "/api/dashboard":           30,   # refreshed every 30 s in UI anyway
    "/api/customers":           60,
    "/api/labour/karigars":    300,   # karigar list rarely changes
    "/api/jobwork/filters":    120,
    "/api/reports/summary":     30,
    "/api/reports/revenue":     30,
    "/api/reports/customers":   30,
    "/api/daybook/dates":       60,
    "/api/daybook/pending-count": 30,
}

@app.middleware("http")
async def cache_control(request: Request, call_next):
    response = await call_next(request)
    if request.method != "GET":
        response.headers["Cache-Control"] = "no-store"
        return response
    path = request.url.path
    ttl = next((v for k, v in _CACHE_TTLS.items() if path == k or path.startswith(k + "?")), None)
    if ttl:
        response.headers["Cache-Control"] = f"private, max-age={ttl}, stale-while-revalidate={ttl * 2}"
    elif path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


# ==========================================
# ERROR HANDLING & BUG REPORTING
# ==========================================
@app.middleware("http")
async def error_logging_middleware(request: Request, call_next):
    """Log unhandled Python exceptions and 5xx responses.
    NOTE: HTTPExceptions raised by FastAPI endpoints are handled by FastAPI's own
    exception handlers and do NOT reach this middleware as exceptions — they return
    normal responses. This middleware fires only for truly unhandled Python errors.
    """
    try:
        response = await call_next(request)
        # Also log unexpected 5xx responses that slipped through without raising
        if response.status_code >= 500:
            error_logger.warning(f"5xx response {response.status_code} for {request.method} {request.url.path}")
        return response
    except Exception as exc:
        import traceback
        from datetime import datetime, timezone

        # Build detailed error context with UUID for uniqueness (Fix 3.8)
        error_id = f"err_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        stack_trace = traceback.format_exc()

        # Get request body safely — body may be consumed for form/multipart requests
        try:
            body = getattr(request, "_body", None) or await request.body()
            body_preview = body[:1000].decode('utf-8', errors='replace') if body else ""
        except Exception:
            body_preview = "<body unavailable — likely consumed by form parser>"

        client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
        user_agent = request.headers.get("user-agent", "unknown")

        # Build log entry
        log_entry = f"""
ERROR ID: {error_id}
METHOD: {request.method}
URL: {request.url}
CLIENT IP: {client_ip}
USER AGENT: {user_agent}
BODY PREVIEW: {body_preview[:500]}

STACK TRACE:
{stack_trace}
"""
        # Log to file
        error_logger.error(log_entry)

        # Store in MongoDB for dashboard viewing
        try:
            await db.error_logs.insert_one({
                "error_id": error_id,
                "timestamp": datetime.now(timezone.utc),
                "method": request.method,
                "path": str(request.url.path),
                "query_params": dict(request.query_params),
                "client_ip": client_ip,
                "user_agent": user_agent,
                "error_type": type(exc).__name__,
                "error_message": str(exc),
                "stack_trace": stack_trace,
                "body_preview": body_preview[:1000],
                "resolved": False,
            })
        except Exception as db_err:
            error_logger.error(f"Failed to store error in DB: {db_err}")

        # Return generic error to client (don't leak internals)
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error",
                "error_id": error_id,
                "message": "The error has been logged. Please report this error ID to support."
            }
        )


# Import auth dependency for bug report endpoint
from routers.deps import get_current_user_dep

@app.post("/api/bug-report", include_in_schema=False)
async def submit_bug_report(request: Request, current_user: dict = Depends(get_current_user_dep)):
    """Receive bug reports from frontend with full context. Requires authentication (Fix 1.7)."""
    from datetime import datetime, timezone

    try:
        data = await request.json()
    except Exception:
        data = {}

    # Extract bug report fields
    title = data.get("title", "Untitled Bug Report")
    description = data.get("description", "")
    page = data.get("page", "unknown")
    user_agent = data.get("userAgent", request.headers.get("user-agent", "unknown"))
    console_logs = data.get("consoleLogs", [])
    username = data.get("username", "anonymous")

    # Generate report ID with UUID for uniqueness (Fix 3.9)
    report_id = f"bug_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"

    # Build bug report document
    bug_report = {
        "report_id": report_id,
        "timestamp": datetime.now(timezone.utc),
        "username": current_user.get("username", username),  # Use authenticated user (Fix 1.7)
        "title": title,
        "description": description,
        "page": page,
        "user_agent": user_agent,
        "console_logs": console_logs[:100],  # Limit to 100 log entries
        "client_ip": request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown"),
        "status": "new",  # new, investigating, resolved, wontfix
        "priority": "normal",  # low, normal, high, critical
        "resolved_at": None,
        "resolution_notes": None,
    }

    # Store in MongoDB
    try:
        await db.bug_reports.insert_one(bug_report)
        logger.info(f"Bug report submitted: {report_id} - {title}")
    except Exception as e:
        error_logger.error(f"Failed to store bug report: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Failed to submit bug report"}
        )

    # Also log to file for immediate visibility
    log_entry = f"""
BUG REPORT: {report_id}
USER: {current_user.get('username', username)} (authenticated)
PAGE: {page}
TITLE: {title}
DESCRIPTION: {description[:500]}
CONSOLE LOGS: {len(console_logs)} entries
"""
    error_logger.error(log_entry)

    return {
        "report_id": report_id,
        "message": "Bug report submitted successfully. Thank you!",
        "status": "received"
    }


# ==========================================
# STATIC FILES & HEALTH
# ==========================================
uploads_dir = ROOT_DIR / "static" / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

build_dir = ROOT_DIR.parent / "frontend" / "build"
static_dir = build_dir / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=static_dir), name="react-static")

    # Serve root-level files (manifest.json, favicon.ico, etc.) before SPA fallback
    @app.get("/manifest.json", include_in_schema=False)
    async def serve_manifest():
        return FileResponse(str(build_dir / "manifest.json"))

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        return FileResponse(str(build_dir / "index.html"))


@app.get("/health", tags=["Health"])
async def health_check():
    try:
        await db.command("ping")
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        return JSONResponse({"status": "error", "database": str(exc)}, status_code=503)


