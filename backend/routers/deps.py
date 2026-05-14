"""
Shared dependencies injected into every router.
Import `db` and `get_current_user_dep` from here.
"""
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import auth as auth_module

# db is set once at startup by server.py
db = None  # type: ignore

def set_db(database):
    global db
    db = database

async def get_db(request: Request):
    """Dependency to get the database from the app state."""
    return request.app.state.db

async def get_current_user_dep(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(auth_module.security),
    db_dep = Depends(get_db),
):
    # Prefer Authorization header; fall back to ?token= query param (for direct download links).
    # SECURITY NOTE: Tokens in URLs are logged by servers/proxies and visible in browser history.
    # This fallback is intentional for invoice/export iframe links that cannot set headers.
    # Mitigations: short token lifetime (1 day), HTTPS enforced, blocklist on logout.
    if credentials is None:
        token_qp = request.query_params.get("token")
        if token_qp:
            from fastapi.security import HTTPAuthorizationCredentials
            credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token_qp)
    return await auth_module.get_current_user(credentials, db_dep)
