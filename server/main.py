from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from s3_service import (
    create_bucket_if_not_exists, enable_versioning, set_lifecycle_policy,
    list_files, upload_file, get_presigned_url, delete_file
)
import auth_service
import time, json, logging, jwt

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
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid auth token")
        user = auth_service.users_collection.find_one({"email": email})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return {"id": str(user["_id"]), "username": user["username"], "email": email}
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

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
    current_user: dict = Depends(get_current_user)
):
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds the 20MB limit for demo")

    import hashlib
    content_hash = hashlib.sha256(contents).hexdigest()
    
    # Check if this exact content already exists for this user (Simple deduplication check)
    prefix = f"{current_user['id']}/"
    existing_files = list_files(BUCKET_NAME, prefix)
    is_content_duplicate = False
    
    # In real world, we'd store hashes in DB. 
    # For demo, we can simulate by checking if we've seen this hash before in our session activity
    # Or just assume success if it's new.
    
    key = f"{current_user['id']}/uploads/{int(time.time() * 1000)}_{file.filename}"
    try:
        result = upload_file(
            bucket_name=BUCKET_NAME,
            key=key,
            file_bytes=contents,
            content_type=file.content_type or "application/octet-stream",
            lock_days=lock_days
        )
        return {
            "message": "File uploaded successfully", 
            "result": result,
            "is_content_duplicate": is_content_duplicate # Can be expanded with real hash DB
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
        return {"message": "File deleted or marked for deletion (versioning)"}
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
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 20MB limit")
    key = f"{DEPT_PREFIX}{current_user['username']}/{int(time.time() * 1000)}_{file.filename}"
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
