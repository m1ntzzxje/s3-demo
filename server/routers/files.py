from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel
from dependencies import get_current_user, validate_file, log_action, BUCKET_NAME, MAX_FILE_SIZE
from s3_service import list_files, upload_file, get_presigned_url, delete_file, move_file
import auth_service
import time
import hashlib
from datetime import datetime, timezone as dt_timezone
import re

router = APIRouter(prefix="/api", tags=["Files"])

@router.get("/stats")
def get_stats_api(current_user: dict = Depends(get_current_user)):
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

@router.get("/files")
def get_files_api(current_user: dict = Depends(get_current_user)):
    try:
        prefix = f"{current_user['id']}/"
        return list_files(BUCKET_NAME, prefix)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_api(
    file: UploadFile = File(...),
    lock_days: int = Form(0),
    prefix: str = Form(""),
    current_user: dict = Depends(get_current_user)
):
    safe_filename = validate_file(file.filename, file.content_type)
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds the 20MB limit for demo")

    content_hash = hashlib.sha256(contents).hexdigest()

    existing_doc = auth_service.files_collection.find_one({
        "user_id": current_user["id"],
        "sha256": content_hash
    })
    is_content_duplicate = existing_doc is not None

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

@router.get("/download")
def download_api(key: str, current_user: dict = Depends(get_current_user)):
    if not key or not key.startswith(f"{current_user['id']}/"):
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        return {"url": get_presigned_url(BUCKET_NAME, key)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/files")
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
    target_folder: str

@router.post("/files/move")
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

@router.delete("/folders")
def delete_folder_api(prefix: str, current_user: dict = Depends(get_current_user)):
    if not prefix or not prefix.startswith(f"{current_user['id']}/"):
        raise HTTPException(status_code=403, detail="Forbidden")
    
    if not prefix.endswith('/'):
        prefix += '/'

    try:
        s3 = auth_service.s3_client_ref()
        response = s3.list_object_versions(Bucket=BUCKET_NAME, Prefix=prefix)
        
        objects_to_delete = []
        for v in response.get('Versions', []):
            objects_to_delete.append({'Key': v['Key'], 'VersionId': v['VersionId']})
        for m in response.get('DeleteMarkers', []):
            objects_to_delete.append({'Key': m['Key'], 'VersionId': m['VersionId']})

        if not objects_to_delete:
            return {"message": "Folder is already empty"}

        s3.delete_objects(
            Bucket=BUCKET_NAME,
            Delete={'Objects': objects_to_delete, 'Quiet': True}
        )
        
        auth_service.files_collection.delete_many({
            "user_id": current_user["id"],
            "key": {"$regex": f"^{re.escape(prefix)}"}
        })
        
        log_action(current_user["id"], "delete_folder", {"prefix": prefix, "count": len(objects_to_delete)})
        return {"message": f"Deleted folder and {len(objects_to_delete)} objects"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
