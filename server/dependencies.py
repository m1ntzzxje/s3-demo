from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from datetime import datetime, timezone as dt_timezone
import auth_service
import logging
import os
import re

security = HTTPBearer()

BUCKET_NAME = os.getenv("BUCKET_NAME", "esoft-backup-bucket")
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

BLOCKED_EXTENSIONS = {
    '.exe', '.bat', '.cmd', '.sh', '.msi', '.dll', '.scr',
    '.ps1', '.vbs', '.wsf', '.com', '.pif', '.hta', '.cpl',
    '.jar', '.inf', '.reg',
}

ALLOWED_MIME_PREFIXES = (
    'image/', 'text/', 'application/pdf', 'application/json',
    'application/zip', 'application/gzip', 'application/x-tar',
    'application/x-7z-compressed', 'application/x-rar-compressed',
    'application/vnd.openxmlformats', 'application/vnd.ms-',
    'application/msword', 'application/octet-stream',
    'video/', 'audio/', 'application/xml',
)

def validate_file(filename: str, content_type: str):
    safe_name = re.sub(r'[\\/:*?"<>|]', '_', filename)
    ext = os.path.splitext(safe_name)[1].lower()
    if ext in BLOCKED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' is blocked for security reasons"
        )
    mime = (content_type or 'application/octet-stream').lower()
    if not any(mime.startswith(prefix) for prefix in ALLOWED_MIME_PREFIXES):
        raise HTTPException(
            status_code=400,
            detail=f"MIME type '{mime}' is not allowed"
        )
    return safe_name

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(
            credentials.credentials,
            auth_service.SECRET_KEY,
            algorithms=[auth_service.ALGORITHM]
        )
        email = payload.get("sub")
        user_id_from_token = payload.get("user_id")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid auth token")
        user = auth_service.users_collection.find_one({"email": email})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return {
            "id": user_id_from_token or str(user["_id"]),
            "username": user["username"],
            "email": email
        }
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

def log_action(user_id: str, action: str, detail: dict = None):
    try:
        auth_service.logs_collection.insert_one({
            "user_id": user_id,
            "action": action,
            "detail": detail or {},
            "timestamp": datetime.now(dt_timezone.utc)
        })
    except Exception as e:
        logging.warning(f"[Log] Failed to write audit log: {e}")
