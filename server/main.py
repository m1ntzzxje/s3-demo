from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from s3_service import (
    create_bucket_if_not_exists, enable_versioning, set_lifecycle_policy,
    list_files, upload_file, get_presigned_url, delete_file, move_file
)
import auth_service
import time, json, logging, jwt, os, re

# ─── File Security ────────────────────────────────────────────────────────────
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
    """Validate file extension and MIME type. Raises HTTPException if blocked."""
    # Sanitize filename — strip path traversal characters
    safe_name = re.sub(r'[\\/:*?"<>|]', '_', filename)
    # Check extension
    ext = os.path.splitext(safe_name)[1].lower()
    if ext in BLOCKED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' is blocked for security reasons"
        )
    # Check MIME type
    mime = (content_type or 'application/octet-stream').lower()
    if not any(mime.startswith(prefix) for prefix in ALLOWED_MIME_PREFIXES):
        raise HTTPException(
            status_code=400,
            detail=f"MIME type '{mime}' is not allowed"
        )
    return safe_name

# ─── App & Middleware ─────────────────────────────────────────────────────────
app = FastAPI(title="ESoft S3 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Constants ────────────────────────────────────────────────────────────────
BUCKET_NAME = "esoft-backup-bucket"
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

# ─── Auth Dependency ──────────────────────────────────────────────────────────
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(
            credentials.credentials,
            auth_service.SECRET_KEY,
            algorithms=[auth_service.ALGORITHM]
        )
        email = payload.get("sub")
        # Đọc user_id trực tiếp từ token payload (không cần truy vấn DB thêm lần nữa)
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

# ─── Audit Log Helper ─────────────────────────────────────────────────────────
from datetime import datetime, timezone as dt_timezone

def log_action(user_id: str, action: str, detail: dict = None):
    """Ghi log hành động vào MongoDB logs_collection."""
    try:
        auth_service.logs_collection.insert_one({
            "user_id": user_id,
            "action": action,
            "detail": detail or {},
            "timestamp": datetime.now(dt_timezone.utc)
        })
    except Exception as e:
        logging.warning(f"[Log] Failed to write audit log: {e}")

# ─── Startup ──────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    logging.getLogger().setLevel(logging.INFO)
    try:
        create_bucket_if_not_exists(BUCKET_NAME)
        enable_versioning(BUCKET_NAME)
        set_lifecycle_policy(BUCKET_NAME)
        logging.info(f"[Setup] Bucket [{BUCKET_NAME}] is ready with Versioning & Lifecycle enabled.")
    except Exception as e:
        logging.error(f"Error during S3 startup: {e}")

# ─── Auth Endpoints ──────────────────────────────────────────────────────────
class RegisterModel(BaseModel):
    username: str
    email: str
    password: str

class LoginModel(BaseModel):
    email: str
    password: str
    mfa_code: Optional[str] = None

@app.post("/api/auth/register")
def register_api(user: RegisterModel):
    res = auth_service.register_user(user.username, user.email, user.password)
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@app.post("/api/auth/login")
def login_api(user: LoginModel):
    # Simulate MFA check if mfa_code is provided or required
    if user.mfa_code and user.mfa_code != "102030":
        # Simulating that "102030" is the correct MFA code
        raise HTTPException(status_code=401, detail="Invalid MFA code")

    res = auth_service.authenticate_user(user.email, user.password)
    if not res["success"]:
        raise HTTPException(status_code=401, detail=res["message"])
    return res

# ─── S3 Endpoints (User-scoped) ──────────────────────────────────────────────
@app.get("/api/stats")
def get_stats_api(current_user: dict = Depends(get_current_user)):
    """Return real bucket metrics scoped to the current user."""
    try:
        prefix = f"{current_user['id']}/"
        all_files = list_files(BUCKET_NAME, prefix)
        total_size_bytes = sum(f.get('Size', 0) for f in all_files)

        backup_files = [f for f in all_files if f.get('Key', '').startswith(f"{prefix}backup/")]
        upload_files = [f for f in all_files if f.get('Key', '').startswith(f"{prefix}uploads/")]

        last_backup_time = None
        if backup_files:
            latest = max(backup_files, key=lambda x: x.get('LastModified', ''))
            last_mod = latest.get('LastModified')
            if last_mod:
                last_backup_time = last_mod.isoformat() if hasattr(last_mod, 'isoformat') else str(last_mod)

        MAX_STORAGE = 2 * 1024 * 1024 * 1024  # 2GB cap
        used_pct = round((total_size_bytes / MAX_STORAGE) * 100, 1) if MAX_STORAGE > 0 else 0

        return {
            "totalFiles": len(all_files),
            "uploadsCount": len(upload_files),
            "backupsCount": len(backup_files),
            "totalSizeBytes": total_size_bytes,
            "maxStorageBytes": MAX_STORAGE,
            "usedPercent": used_pct,
            "lastBackupTime": last_backup_time,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/files")
def get_files_api(current_user: dict = Depends(get_current_user)):
    try:
        prefix = f"{current_user['id']}/"
        return list_files(BUCKET_NAME, prefix)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload")
async def upload_api(
    file: UploadFile = File(...),
    lock_days: int = Form(0),
    prefix: str = Form(""),
    current_user: dict = Depends(get_current_user)
):
    # ── Security: Validate file type ──
    safe_filename = validate_file(file.filename, file.content_type)

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds the 20MB limit for demo")

    import hashlib
    content_hash = hashlib.sha256(contents).hexdigest()

    # ── Deduplication thực: So sánh SHA256 với MongoDB files_collection ──
    existing_doc = auth_service.files_collection.find_one({
        "user_id": current_user["id"],
        "sha256": content_hash
    })
    is_content_duplicate = existing_doc is not None

    # Clean up prefix to prevent traversal
    clean_prefix = prefix.strip().lstrip('/')
    if clean_prefix and not clean_prefix.endswith('/'):
        clean_prefix += '/'

    key = f"{current_user['id']}/uploads/{clean_prefix}{int(time.time() * 1000)}_{safe_filename}"
    try:
        result = upload_file(
            bucket_name=BUCKET_NAME,
            key=key,
            file_bytes=contents,
            content_type=file.content_type or "application/octet-stream",
            lock_days=lock_days
        )

        # ── Lưu metadata file vào MongoDB (bao gồm version_id từ S3) ──
        if not is_content_duplicate:
            auth_service.files_collection.insert_one({
                "user_id": current_user["id"],
                "filename": safe_filename,
                "key": key,
                "sha256": content_hash,
                "size": len(contents),
                "content_type": file.content_type or "application/octet-stream",
                "version_id": result.get("VersionId"),
                "lock_days": lock_days,
                "uploaded_at": datetime.now(dt_timezone.utc)
            })

        # ── Ghi audit log ──
        log_action(current_user["id"], "upload", {
            "filename": safe_filename, "size": len(contents),
            "sha256": content_hash, "duplicate": is_content_duplicate,
            "lock_days": lock_days
        })

        return {
            "message": "File uploaded successfully",
            "result": result,
            "is_content_duplicate": is_content_duplicate
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/backup")
async def run_backup_api(current_user: dict = Depends(get_current_user)):
    """Simulate an incremental hybrid backup (user-scoped)."""
    hybrid_data = json.dumps({
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "logs": "Backup incremental state updated",
        "status": "OK",
        "recordsSynced": 750
    }).encode("utf-8")

    key = f"{current_user['id']}/backup/system_state_incremental.json"
    try:
        result = upload_file(BUCKET_NAME, key, hybrid_data, "application/json")
        return {"message": "Hybrid backup simulated successfully", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/download")
def download_api(key: str, current_user: dict = Depends(get_current_user)):
    if not key or not key.startswith(f"{current_user['id']}/"):
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        return {"url": get_presigned_url(BUCKET_NAME, key)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/files")
def delete_api(key: str, current_user: dict = Depends(get_current_user)):
    if not key or not key.startswith(f"{current_user['id']}/"):
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        delete_file(BUCKET_NAME, key)
        log_action(current_user["id"], "delete", {"key": key})
        return {"message": "File deleted or marked for deletion (versioning)"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class MoveModel(BaseModel):
    source_key: str
    target_folder: str # e.g. "folder/subfolder/"

@app.post("/api/files/move")
def move_api(body: MoveModel, current_user: dict = Depends(get_current_user)):
    if not body.source_key.startswith(f"{current_user['id']}/"):
        raise HTTPException(status_code=403, detail="Forbidden")
    
    parts = body.source_key.split('/')
    filename = parts[-1]
    
    user_uploads_root = f"{current_user['id']}/uploads/"
    
    clean_target = body.target_folder.strip().lstrip('/')
    if clean_target and not clean_target.endswith('/'):
        clean_target += '/'
        
    target_key = f"{user_uploads_root}{clean_target}{filename}"
    
    if target_key == body.source_key:
        return {"message": "Already in target folder"}

    try:
        move_file(BUCKET_NAME, body.source_key, target_key)
        auth_service.files_collection.update_one(
            {"user_id": current_user["id"], "key": body.source_key},
            {"$set": {"key": target_key}}
        )
        log_action(current_user["id"], "move", {"from": body.source_key, "to": target_key})
        return {"message": "File moved successfully", "new_key": target_key}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/folders")
def delete_folder_api(prefix: str, current_user: dict = Depends(get_current_user)):
    """Delete all objects with a specific prefix (simulating folder deletion)."""
    if not prefix or not prefix.startswith(f"{current_user['id']}/"):
        raise HTTPException(status_code=403, detail="Forbidden")
    
    if not prefix.endswith('/'):
        prefix += '/'

    try:
        s3 = auth_service.s3_client_ref()
        # List all versions (to clean up everything including versions)
        response = s3.list_object_versions(Bucket=BUCKET_NAME, Prefix=prefix)
        
        objects_to_delete = []
        for v in response.get('Versions', []):
            objects_to_delete.append({'Key': v['Key'], 'VersionId': v['VersionId']})
        for m in response.get('DeleteMarkers', []):
            objects_to_delete.append({'Key': m['Key'], 'VersionId': m['VersionId']})

        if not objects_to_delete:
            return {"message": "Folder is already empty"}

        # S3 batch delete (max 1000 per call)
        # For simplicity in demo, we delete what we found in one go
        s3.delete_objects(
            Bucket=BUCKET_NAME,
            Delete={'Objects': objects_to_delete, 'Quiet': True}
        )
        
        # Also clean up MongoDB
        auth_service.files_collection.delete_many({
            "user_id": current_user["id"],
            "key": {"$regex": f"^{re.escape(prefix)}"}
        })
        
        log_action(current_user["id"], "delete_folder", {"prefix": prefix, "count": len(objects_to_delete)})
        return {"message": f"Deleted folder and {len(objects_to_delete)} objects"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── Trash Endpoints ──────────────────────────────────────────────────────────
@app.get("/api/trash")
def get_trash_api(current_user: dict = Depends(get_current_user)):
    """List all delete-marked (soft-deleted) objects for this user."""
    try:
        prefix = f"{current_user['id']}/"
        response = auth_service.s3_client_ref().list_object_versions(Bucket=BUCKET_NAME, Prefix=prefix)
        delete_markers = response.get('DeleteMarkers', [])
        # Only show the ones that are the "latest" version (i.e., effectively deleted)
        latest_markers = [m for m in delete_markers if m.get('IsLatest', False)]
        return [{"Key": m['Key'], "DeletedAt": m['LastModified'].isoformat(), "VersionId": m['VersionId']} for m in latest_markers]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/trash/restore")
def restore_file_api(key: str, current_user: dict = Depends(get_current_user)):
    """Restore a soft-deleted file by removing its latest delete marker."""
    if not key or not key.startswith(f"{current_user['id']}/"):
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        s3 = auth_service.s3_client_ref()
        response = s3.list_object_versions(Bucket=BUCKET_NAME, Prefix=key)
        markers = [m for m in response.get('DeleteMarkers', []) if m['Key'] == key and m.get('IsLatest')]
        if not markers:
            raise HTTPException(status_code=404, detail="No delete marker found")
        s3.delete_object(Bucket=BUCKET_NAME, Key=key, VersionId=markers[0]['VersionId'])
        log_action(current_user["id"], "restore", {"key": key})
        return {"message": f"Restored: {key.split('/')[-1]}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/trash/permanent")
def permanent_delete_api(key: str, current_user: dict = Depends(get_current_user)):
    """Permanently delete all versions of a file."""
    if not key or not key.startswith(f"{current_user['id']}/"):
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        s3 = auth_service.s3_client_ref()
        response = s3.list_object_versions(Bucket=BUCKET_NAME, Prefix=key)
        versions = response.get('Versions', []) + response.get('DeleteMarkers', [])
        versions = [v for v in versions if v['Key'] == key]
        for v in versions:
            s3.delete_object(Bucket=BUCKET_NAME, Key=key, VersionId=v['VersionId'])
        return {"message": f"Permanently deleted: {key.split('/')[-1]}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── Sharing Endpoints ────────────────────────────────────────────────────────
class ShareModel(BaseModel):
    key: str
    target_email: str

@app.post("/api/share")
def share_file_api(body: ShareModel, current_user: dict = Depends(get_current_user)):
    """Share a file with another user by email."""
    if not body.key.startswith(f"{current_user['id']}/"):
        raise HTTPException(status_code=403, detail="Forbidden")
    target = auth_service.users_collection.find_one({"email": body.target_email})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    from datetime import datetime, timezone
    auth_service.shares_collection.update_one(
        {"key": body.key, "target_id": str(target['_id'])},
        {"$set": {
            "key": body.key,
            "owner_id": current_user['id'],
            "owner_name": current_user['username'],
            "target_id": str(target['_id']),
            "filename": body.key.split('/')[-1],
            "shared_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    log_action(current_user["id"], "share", {
        "key": body.key, "target_email": body.target_email
    })
    return {"message": f"Shared with {body.target_email}"}

@app.get("/api/shared")
def get_shared_files_api(current_user: dict = Depends(get_current_user)):
    """Get all files shared with the current user."""
    shares = list(auth_service.shares_collection.find({"target_id": current_user['id']}))
    result = []
    for s in shares:
        try:
            url = get_presigned_url(BUCKET_NAME, s['key'])
        except:
            url = None
        result.append({
            "key": s['key'], "filename": s['filename'],
            "owner_name": s['owner_name'], "shared_at": s['shared_at'],
            "url": url
        })
    return result

@app.delete("/api/share")
def unshare_file_api(key: str, current_user: dict = Depends(get_current_user)):
    """Remove a share record (by owner or recipient)."""
    auth_service.shares_collection.delete_many({
        "key": key,
        "$or": [{"owner_id": current_user['id']}, {"target_id": current_user['id']}]
    })
    return {"message": "Share removed"}

# ─── Department Endpoints ─────────────────────────────────────────────────────
DEPT_PREFIX = "department/"

@app.get("/api/department")
def get_dept_files_api(current_user: dict = Depends(get_current_user)):
    """List all files in the shared department folder."""
    try:
        return list_files(BUCKET_NAME, DEPT_PREFIX)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/department/upload")
async def dept_upload_api(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    # ── Security: Validate file type ──
    safe_filename = validate_file(file.filename, file.content_type)

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 20MB limit")
    key = f"{DEPT_PREFIX}{current_user['username']}/{int(time.time() * 1000)}_{safe_filename}"
    try:
        result = upload_file(BUCKET_NAME, key, contents, file.content_type or "application/octet-stream")
        return {"message": "Uploaded to department", "key": key, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/department/download")
def dept_download_api(key: str, current_user: dict = Depends(get_current_user)):
    if not key.startswith(DEPT_PREFIX):
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        return {"url": get_presigned_url(BUCKET_NAME, key)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
