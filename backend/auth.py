"""Authentication and audit utilities for the Retail API."""
import os
import sys
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext

from motor.motor_asyncio import AsyncIOMotorDatabase

# --- Config ---
# Load or generate a stable JWT secret that persists across server restarts.
def _load_or_create_secret() -> str:
    env_val = os.environ.get("JWT_SECRET_KEY")
    if env_val:
        return env_val
    
    # Check for a persistent secret file instead of writing to .env
    secret_file = Path(__file__).parent / ".jwt_secret"
    if secret_file.exists():
        val = secret_file.read_text().strip()
        if val:
            return val

    # Use an exclusive lock so concurrent workers don't both write different secrets.
    lock_file = Path(__file__).parent / ".jwt_secret.lock"
    with open(lock_file, "w") as lf:
        try:
            if sys.platform == "win32":
                import msvcrt
                msvcrt.locking(lf.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(lf, fcntl.LOCK_EX)
            
            # Re-read inside the lock
            if secret_file.exists():
                val = secret_file.read_text().strip()
                if val:
                    return val
            
            new_secret = secrets.token_hex(32)
            secret_file.write_text(new_secret)
            return new_secret
        finally:
            try:
                if sys.platform == "win32":
                    import msvcrt
                    msvcrt.locking(lf.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(lf, fcntl.LOCK_UN)
            except OSError:
                pass

SECRET_KEY = _load_or_create_secret()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 1  # Reduced from 7 for security

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

async def is_jti_revoked(db, jti: str) -> bool:
    """Check if a JTI exists in the DB blocklist.
    
    This performs a DB lookup on every request with a revoked token.
    For typical retail usage (~10 concurrent users, 1-day token lifetime),
    this overhead is negligible and ensures multi-worker safety.
    """
    if not jti:
        return False
    doc = await db.token_blocklist.find_one({"jti": jti}, {"_id": 1})
    return doc is not None



# --- Helpers ---
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "jti": str(uuid.uuid4())})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncIOMotorDatabase = None,  # injected by caller
):
    """Dependency to extract and validate the current user from a JWT token."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        jti: str = payload.get("jti")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    if jti:
        if await is_jti_revoked(db, jti):
            raise HTTPException(status_code=401, detail="Token has been revoked")

    user = await db.users.find_one({"username": username.lower().strip() if username else username}, {"password_hash": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="User is disabled")

    return user


async def audit_log(db, action: str, user: dict, entity_type: str = "", entity_id: str = "", details: dict = None):
    """Record an audit log entry."""
    log = {
        "timestamp": datetime.now(timezone.utc),
        "action": action,
        "username": user.get("username", "unknown") if user else "system",
        "full_name": user.get("full_name", "") if user else "",
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details or {},
    }
    await db.audit_logs.insert_one(log)


# ============================================================================
# API KEY ROTATION
# ============================================================================

_api_key_file = os.path.join(os.path.dirname(__file__), ".api_key")
_api_key_history_file = os.path.join(os.path.dirname(__file__), ".api_key_history")


def _load_api_key():
    """Load current API key from file or environment."""
    # First check environment
    env_key = os.environ.get("ADMIN_API_KEY")
    if env_key:
        return env_key
    
    # Then check file
    if os.path.exists(_api_key_file):
        with open(_api_key_file, "r") as f:
            return f.read().strip()
    
    return None


def _save_api_key(key: str, username: str = "system"):
    """Save new API key and add old one to history."""
    # Load current key for history
    current_key = _load_api_key()
    
    # Save new key
    with open(_api_key_file, "w") as f:
        f.write(key)
    os.chmod(_api_key_file, 0o600)  # Restrict permissions
    
    # Add old key to history with timestamp
    if current_key:
        from datetime import datetime
        history_entry = f"{datetime.utcnow().isoformat()}|{username}|{current_key[:16]}...\n"
        with open(_api_key_history_file, "a") as f:
            f.write(history_entry)


def rotate_admin_api_key(username: str = "system"):
    """
    Rotate the admin API key.
    
    Returns:
        tuple: (new_key, old_key_preview) where old_key_preview is first 16 chars of old key
    """
    import secrets
    new_key = secrets.token_hex(32)
    old_key = _load_api_key()
    _save_api_key(new_key, username)
    
    # Clear any cached key
    os.environ["ADMIN_API_KEY"] = new_key
    
    old_preview = old_key[:16] + "..." if old_key else "None"
    return new_key, old_preview


# Initialize ADMIN_API_KEY from file if not in environment
if not os.environ.get("ADMIN_API_KEY"):
    loaded = _load_api_key()
    if loaded:
        os.environ["ADMIN_API_KEY"] = loaded
