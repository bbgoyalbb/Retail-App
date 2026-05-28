"""
Shared dependencies injected into every router.
Import `db` and `get_current_user_dep` from here.

DI PATTERN: The `db` global is set once at startup by server.py's lifespan function.
This is a simple DI pattern for single-process deployments. For multi-worker deployments,
consider passing db via app.state instead of a global variable.
"""
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorDatabase
import auth as auth_module
import logging

_logger = logging.getLogger(__name__)

def warn_if_capped(results: list, cap: int, context: str = "") -> list:
    """Log a warning when a to_list(cap) call returns exactly `cap` items.
    This means results were silently truncated — the caller should paginate.
    Returns the list unchanged for use in-line: results = warn_if_capped(await cursor.to_list(N), N, 'context')
    """
    if len(results) >= cap:
        _logger.warning(
            "to_list cap hit (%d items): results may be truncated. %s",
            cap, context or "(no context)"
        )
    return results

# db is set once at startup by server.py (DI pattern)
db = None  # type: ignore

def set_db(database):
    """Set the global database instance. Called once at startup."""
    global db
    db = database

async def get_db(request: Request) -> AsyncIOMotorDatabase:
    """Dependency to get the database from the app state."""
    return request.app.state.db

async def get_current_user_dep(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(auth_module.security),
    db_dep = Depends(get_db),
):
    # Prefer Authorization header (Bearer JWT).
    # Fall back to ?token= query param which may be either:
    #   - a short-lived single-use download token (opaque, ~32 bytes)
    #   - a legacy JWT (kept for any direct iframe links not yet migrated)
    if credentials is None:
        token_qp = request.query_params.get("token")
        if token_qp:
            # Try as download token first (opaque, fast in-memory lookup)
            from routers.auth_routes import _download_tokens, validate_download_token
            from datetime import datetime, timezone
            entry = _download_tokens.get(token_qp)
            if entry is not None:
                # It's a download token — validate and resolve to a DB user
                username = await validate_download_token(token_qp)
                user = await db_dep.users.find_one(
                    {"username": username}, {"password_hash": 0}
                )
                if not user:
                    raise HTTPException(status_code=401, detail="User not found")
                if not user.get("is_active", True):
                    raise HTTPException(status_code=403, detail="User is disabled")
                return user
            # Fall through and treat as JWT
            credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token_qp)
    return await auth_module.get_current_user(credentials, db_dep)
