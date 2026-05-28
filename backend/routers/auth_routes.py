"""
Auth Routes router.
"""
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, Header, status
from fastapi.responses import FileResponse, JSONResponse
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, date, timedelta
import uuid
import re
import os
import logging
from pathlib import Path
ROOT_DIR = Path(__file__).parent.parent
logger = logging.getLogger(__name__)
from .deps import get_db, get_current_user_dep
from data_quality import round_money, determine_payment_status, build_payment_mode_label
import auth as auth_module
from auth import audit_log
from .models import LoginRequest, UserCreateRequest, UserUpdateRequest, SettingsUpdateRequest, DEFAULT_SETTINGS, merge_settings
from jose import jwt as jose_jwt, JWTError
from pymongo import ReturnDocument
try:
    from PIL import Image as _PILImage
    _PIL_AVAILABLE = True
except ImportError:
    _PIL_AVAILABLE = False

# ==========================================
# RATE LIMITING
# TTLCache auto-expires entries — no manual cleanup needed.
# Falls back to plain dict if cachetools is not installed.
# ==========================================
_RATE_LIMIT_MAX = 5
_RATE_LIMIT_WINDOW = 900  # 15 minutes in seconds

try:
    from cachetools import TTLCache
    _login_attempts: dict = TTLCache(maxsize=1000, ttl=_RATE_LIMIT_WINDOW)
except ImportError:
    # cachetools not installed — use plain dict with manual expiry
    _login_attempts: dict = {}  # type: ignore

def _check_rate_limit(ip: str) -> None:
    """Raise 429 if this IP has exceeded the login attempt limit."""
    try:
        count = _login_attempts.get(ip, 0)
        if count >= _RATE_LIMIT_MAX:
            raise HTTPException(
                status_code=429,
                detail=f"Too many login attempts. Try again in {_RATE_LIMIT_WINDOW // 60} minutes."
            )
        # Increment AFTER the check so the Nth attempt is allowed, (N+1)th is blocked.
        _login_attempts[ip] = count + 1
    except HTTPException:
        raise
    except Exception:
        pass

def _clear_rate_limit(ip: str) -> None:
    """Clear rate limit counter on successful login."""
    try:
        _login_attempts.pop(ip, None)
    except Exception:
        pass

router = APIRouter()

@router.get("/settings/public")
async def get_public_settings(db = Depends(get_db)):
    settings = await db.settings.find_one({"key": "app_settings"}, {"_id": 0})
    merged = merge_settings(settings)
    return {
        "firm_name": merged.get("firm_name", "Retail Book"),
        "firm_logo": merged.get("firm_logo"),
        "firm_logo_dark": merged.get("firm_logo_dark"),
        "firm_name_color": merged.get("firm_name_color", "#C86B4D"),
    }

@router.get("/settings")
async def get_settings(db = Depends(get_db), current_user: dict = Depends(get_current_user_dep)):
    settings = await db.settings.find_one({"key": "app_settings"}, {"_id": 0})
    return merge_settings(settings)

@router.put("/settings")
async def update_settings(data: SettingsUpdateRequest, db = Depends(get_db), current_user: dict = Depends(get_current_user_dep)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update settings")
    # Convert Pydantic model to dict, excluding unset fields
    update_data = data.model_dump(exclude_unset=True)
    # Validate hex color format if provided
    if "firm_name_color" in update_data:
        color = update_data["firm_name_color"]
        if color and not re.fullmatch(r'#[0-9a-fA-F]{3,6}', color):
            raise HTTPException(status_code=400, detail="Invalid color format. Use hex like #C86B4D or #fff")
    # Deduplicate list fields before saving
    for list_key in ("payment_modes", "addon_items", "article_types", "karigars"):
        if isinstance(update_data.get(list_key), list):
            seen = set()
            update_data[list_key] = [x for x in update_data[list_key] if not (x.lower() in seen or seen.add(x.lower()))]
    update_data["key"] = "app_settings"
    settings = await db.settings.find_one_and_update(
        {"key": "app_settings"},
        {"$set": update_data},
        upsert=True,
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )
    await audit_log(db, "update", current_user, "settings", "app_settings", {"fields": list(update_data.keys())})
    return merge_settings(settings)

# ==========================================
# LOGO UPLOAD
# ==========================================

@router.post("/upload/logo")
async def upload_logo(file: UploadFile = File(...), current_user: dict = Depends(get_current_user_dep)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files allowed")
    if file.size and file.size > 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 1MB)")
    contents = await file.read()
    try:
        if not _PIL_AVAILABLE:
            raise RuntimeError("Pillow not installed")
        import io as _io
        # Open twice: first to read format (verify() invalidates the object),
        # then to validate integrity.
        img = _PILImage.open(_io.BytesIO(contents))
        img_format = img.format  # read format BEFORE verify()
        img.verify()
        # Re-open for processing since verify() invalidates
        img = _PILImage.open(_io.BytesIO(contents))
        # Resize to max 300px dimension, maintain aspect ratio
        MAX_DIM = 300
        if img.width > MAX_DIM or img.height > MAX_DIM:
            img.thumbnail((MAX_DIM, MAX_DIM), _PILImage.Resampling.LANCZOS)
        # Convert to RGB if RGBA (for WebP compatibility)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        # Save as WebP for better compression
        output = _io.BytesIO()
        img.save(output, format="WebP", quality=85, optimize=True)
        contents = output.getvalue()
        ext = "webp"
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or corrupt image file")
    upload_dir = ROOT_DIR / "static" / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"logo_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{os.urandom(4).hex()}.{ext}"
    file_path = upload_dir / safe_name
    with open(file_path, "wb") as f:
        f.write(contents)
    return {"url": f"/uploads/{safe_name}"}

# ==========================================
# SHORT-LIVED DOWNLOAD TOKENS (Fix 1.3)
# Replaces JWT-in-URL pattern for invoice/export/backup downloads
# ==========================================

_download_tokens: dict = {}  # token -> {username, expires_at, used}

@router.post("/auth/download-token")
async def create_download_token(current_user: dict = Depends(get_current_user_dep)):
    """Issue a short-lived (5 min), single-use download token for file endpoints."""
    import secrets
    token = secrets.token_urlsafe(32)
    _download_tokens[token] = {
        "username": current_user["username"],
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
        "used": False,
    }
    # Prune expired tokens (simple cleanup)
    now = datetime.now(timezone.utc)
    expired = [k for k, v in _download_tokens.items() if v["expires_at"] < now]
    for k in expired:
        del _download_tokens[k]
    return {"download_token": token}

async def validate_download_token(token: str) -> str:
    """Validate a download token and mark it as used. Returns the username."""
    entry = _download_tokens.get(token)
    if not entry:
        raise HTTPException(status_code=401, detail="Invalid or expired download token")
    if entry["used"]:
        raise HTTPException(status_code=401, detail="Download token already used")
    if entry["expires_at"] < datetime.now(timezone.utc):
        del _download_tokens[token]
        raise HTTPException(status_code=401, detail="Download token expired")
    entry["used"] = True
    return entry["username"]

# ==========================================
# AUTH ENDPOINTS
# ==========================================

@router.post("/auth/login")
async def login(req: LoginRequest, request: Request, db = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)
    user = await db.users.find_one({"username": req.username.lower().strip()})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not auth_module.verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="User is disabled")
    _clear_rate_limit(client_ip)
    token = auth_module.create_access_token({"sub": user["username"]})
    await audit_log(db, "login", user, "user", user["username"], {"ip": client_ip})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "username": user["username"],
            "full_name": user.get("full_name", ""),
            "role": user.get("role", "cashier"),
            "is_active": user.get("is_active", True),
            "allowed_pages": user.get("allowed_pages", []),
        }
    }

@router.post("/auth/logout")
async def logout(request: Request, db = Depends(get_db), current_user: dict = Depends(get_current_user_dep)):
    try:
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.removeprefix("Bearer ").strip()
        payload = jose_jwt.decode(token, auth_module.SECRET_KEY, algorithms=[auth_module.ALGORITHM])
        jti = payload.get("jti")
        if jti:
            await db.token_blocklist.insert_one({
                "jti": jti,
                "created_at": datetime.now(timezone.utc),
            })
    except Exception:
        pass
    return {"message": "Logged out"}

@router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user_dep)):
    return {
        "username": current_user["username"],
        "full_name": current_user.get("full_name", ""),
        "role": current_user.get("role", "cashier"),
        "is_active": current_user.get("is_active", True),
        "allowed_pages": current_user.get("allowed_pages", []),
    }

@router.post("/auth/register")
async def register_user(req: UserCreateRequest, db = Depends(get_db), current_user: dict = Depends(get_current_user_dep)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create users")
    if len(req.username.strip()) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(req.username.strip()) > 50:
        raise HTTPException(status_code=400, detail="Username must be 50 characters or fewer")
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if req.role not in ["admin", "manager", "cashier"]:
        raise HTTPException(status_code=400, detail="Role must be admin, manager, or cashier")
    existing = await db.users.find_one({"username": req.username.lower().strip()})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    new_user = {
        "username": req.username,
        "password_hash": auth_module.get_password_hash(req.password),
        "full_name": req.full_name,
        "role": req.role,
        "is_active": True,
        "allowed_pages": req.allowed_pages,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    new_user["username"] = req.username.lower().strip()
    await db.users.insert_one(new_user)
    await audit_log(db, "create", current_user, "user", new_user["username"], {"full_name": req.full_name, "role": req.role})
    logger.info(f"User '{new_user['username']}' created by '{current_user['username']}'")
    return {"message": "User created successfully", "username": new_user["username"]}


@router.post("/auth/rotate-api-key")
async def rotate_api_key(
    request: Request,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user_dep)
):
    """
    Rotate the admin API key.
    Only admins can rotate the API key.
    Returns the new key - save it immediately as it won't be shown again.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can rotate API keys")
    
    new_key, old_preview = auth_module.rotate_admin_api_key(current_user.get("username"))
    
    await audit_log(
        db, 
        "rotate_api_key", 
        current_user, 
        "system", 
        "admin_api_key", 
        {"old_key_preview": old_preview}
    )
    
    logger.warning(f"API key rotated by '{current_user['username']}'. Old key: {old_preview}")
    
    return {
        "message": "API key rotated successfully. Save this key immediately - it won't be shown again.",
        "new_key": new_key,
        "old_key_preview": old_preview,
        "rotated_by": current_user.get("username"),
        "rotated_at": datetime.now(timezone.utc).isoformat()
    }

@router.get("/auth/users")
async def list_users(
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user_dep),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can list users")
    users = await db.users.find({}, {"password_hash": 0}).skip(skip).limit(limit).to_list(length=limit)
    total = await db.users.count_documents({})
    for u in users:
        u["_id"] = str(u["_id"])
    return {"users": users, "total": total, "skip": skip, "limit": limit}

@router.put("/auth/users/{username}")
async def update_user(username: str, data: UserUpdateRequest, db = Depends(get_db), current_user: dict = Depends(get_current_user_dep)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update users")
    if username == "admin" and current_user["username"] != "admin":
        raise HTTPException(status_code=403, detail="Cannot modify the admin account")
    # Convert Pydantic model to dict, excluding unset fields
    update_data = data.model_dump(exclude_unset=True)
    update = {}
    if "full_name" in update_data: update["full_name"] = update_data["full_name"]
    if "role" in update_data:
        if update_data["role"] not in ["admin", "manager", "cashier"]:
            raise HTTPException(status_code=400, detail="Role must be admin, manager, or cashier")
        update["role"] = update_data["role"]
    if "is_active" in update_data: update["is_active"] = update_data["is_active"]
    if "allowed_pages" in update_data: update["allowed_pages"] = update_data["allowed_pages"]
    if "password" in update_data and update_data["password"]:
        if len(update_data["password"]) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        update["password_hash"] = auth_module.get_password_hash(update_data["password"])
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.users.update_one({"username": username}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await audit_log(db, "update", current_user, "user", username, {"fields": list(update.keys())})
    logger.info(f"User '{username}' updated by '{current_user['username']}'")
    return {"message": "User updated successfully"}

@router.delete("/auth/users/{username}")
async def delete_user(username: str, db = Depends(get_db), current_user: dict = Depends(get_current_user_dep)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete users")
    if username == current_user["username"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    if username == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete the admin account")
    result = await db.users.delete_one({"username": username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await audit_log(db, "delete", current_user, "user", username, {})
    logger.info(f"User '{username}' deleted by '{current_user['username']}'")
    return {"message": "User deleted successfully"}

# ==========================================
# AUDIT LOGS
# ==========================================

@router.get("/audit-logs")
async def list_audit_logs(
    db = Depends(get_db),
    limit: int = Query(50, ge=1, le=500),
    skip: int = Query(0, ge=0),
    user: str = Query(None, description="Filter by username"),
    action: str = Query(None, description="Filter by action type"),
    date_from: str = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: str = Query(None, description="Filter to date (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_user_dep),
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view audit logs")
    
    # Build query filter with ReDoS protection
    query_filter = {}
    if user:
        escaped_user = re.escape(user.strip()) if user else ""
        query_filter["username"] = {"$regex": escaped_user, "$options": "i"}
    if action:
        escaped_action = re.escape(action.strip()) if action else ""
        query_filter["action"] = {"$regex": escaped_action, "$options": "i"}
    if date_from or date_to:
        date_filter = {}
        if date_from:
            try:
                date_filter["$gte"] = datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date_from format. Use YYYY-MM-DD")
        if date_to:
            try:
                date_filter["$lte"] = datetime.strptime(date_to, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=1)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date_to format. Use YYYY-MM-DD")
        query_filter["timestamp"] = date_filter
    
    cursor = db.audit_logs.find(query_filter).sort("timestamp", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    for d in docs:
        d["_id"] = str(d["_id"])
    
    # Get total count for pagination
    total_count = await db.audit_logs.count_documents(query_filter)
    
    return {"logs": docs, "count": len(docs), "total": total_count}
