import os
import time
import uuid
import hashlib
import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path

import auth_service
from s3_config import s3_client

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
BUCKET_NAME   = os.getenv("BUCKET_NAME", "esoft-backup-bucket")
SERVER2_PATH  = Path(os.getenv("SERVER2_PATH", "C:/D/server2_backup"))
TRANSIT_ROOT  = "transit"          # S3 prefix for in-flight data
MAX_RETRIES   = 3
RETRY_DELAY_S = 15 * 60           # 15 minutes in seconds (shortened for dev)

# ── Helpers ───────────────────────────────────────────────────────────────────
def _today_label() -> str:
    """Returns YYYY-MM-DD label used in S3 transit prefix and local archive."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")

def _ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)

def _md5_of_file(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def _etag_to_md5(etag: str) -> str:
    """Strip quotes from ETag. Multi-part ETags contain '-', skip comparison."""
    return etag.strip('"').strip("'")

def _save_job(job_id: str, job_type: str, status: str,
              user_id: str = None,
              files_total: int = 0, files_done: int = 0,
              size_bytes: int = 0, progress_pct: float = 0,
              errors: list = None,
              started_at: datetime = None, ended_at: datetime = None):
    """Upsert a sync job document into MongoDB."""
    try:
        now = datetime.now(timezone.utc)
        auth_service.sync_jobs_collection.update_one(
            {"job_id": job_id},
            {"$set": {
                "job_id":      job_id,
                "job_type":    job_type,
                "user_id":     user_id,
                "status":      status,
                "files_total": files_total,
                "files_done":  files_done,
                "size_bytes":  size_bytes,
                "progress_pct": round(progress_pct, 2),
                "errors":      errors or [],
                "started_at":  (started_at or now).isoformat(),
                "ended_at":    ended_at.isoformat() if ended_at else None,
                "updated_at":  now.isoformat(),
            }},
            upsert=True
        )
    except Exception as e:
        logger.warning(f"[SyncJob] Failed to save job record: {e}")


# ══════════════════════════════════════════════════════════════════════════════
#  JOB 1 — Push to S3 Transit (Global or User-scoped)
# ══════════════════════════════════════════════════════════════════════════════
def run_push_to_transit(user_id: str = None) -> dict:
    """
    Copy objects to transit/{date}/... 
    If user_id is provided, only copy that user's data.
    """
    job_id  = str(uuid.uuid4())
    date    = _today_label()
    # Path: transit/{date}/{user_id}/... or transit/{date}/global/...
    scope_path = user_id if user_id else "global"
    prefix  = f"{TRANSIT_ROOT}/{date}/{scope_path}/"
    
    started = datetime.now(timezone.utc)
    errors  = []

    # Normalize job types for Monitor
    if user_id:
        job_type = "user_transit_push"
    else:
        job_type = "s3_transit_push" # Global

    _save_job(job_id, job_type, "running", user_id=user_id, started_at=started)

    # List objects to copy
    try:
        paginator = s3_client.get_paginator("list_objects_v2")
        # Filter by user suffix if provided (e.g. "user_id/")
        list_prefix = f"{user_id}/" if user_id else ""
        pages = paginator.paginate(Bucket=BUCKET_NAME, Prefix=list_prefix)
        
        all_objects = []
        for page in pages:
            for obj in page.get("Contents", []):
                key = obj["Key"]
                # Skip transit prefix itself to avoid infinite recursion
                if not key.startswith(TRANSIT_ROOT + "/"):
                    all_objects.append(obj)
    except Exception as e:
        msg = f"Failed to list objects: {e}"
        _save_job(job_id, job_type, "failed", user_id=user_id, errors=[msg], started_at=started, ended_at=datetime.now(timezone.utc))
        return {"status": "failed", "error": msg}

    total = len(all_objects)
    done  = 0
    size  = 0
    skipped = 0

    # Optional: Get current transit state to avoid redundant copies
    existing_transit = {}
    try:
        t_paginator = s3_client.get_paginator("list_objects_v2")
        t_pages = t_paginator.paginate(Bucket=BUCKET_NAME, Prefix=prefix)
        for t_page in t_pages:
            for t_obj in t_page.get("Contents", []):
                # map base_name -> etag
                existing_transit[t_obj["Key"][len(prefix):]] = t_obj["ETag"].strip('"')
    except:
        pass

    if total == 0:
        _save_job(job_id, job_type, "done", user_id=user_id, files_total=0, files_done=0, progress_pct=100.0, started_at=started, ended_at=datetime.now(timezone.utc))
        return {"job_id": job_id, "status": "done", "files_done": 0, "size_bytes": 0, "errors": []}

    for obj in all_objects:
        src_key = obj["Key"]
        
        # Clean the key: remove the leading "user_id/" so it doesn't double-nest
        # and look ugly on Server 2.
        clean_name = src_key
        if user_id and src_key.startswith(f"{user_id}/"):
            clean_name = src_key[len(user_id)+1:]
            
        dest_key = prefix + clean_name
        
        # --- DELTA CHECK (S1 -> Transit) ---
        src_etag = obj.get("ETag", "").strip('"')
        if clean_name in existing_transit and existing_transit[clean_name] == src_etag:
            done += 1
            skipped += 1
            continue

        try:
            s3_client.copy_object(
                Bucket=BUCKET_NAME,
                CopySource={"Bucket": BUCKET_NAME, "Key": src_key},
                Key=dest_key,
            )
            done += 1
            size += obj.get("Size", 0)
            # Update progress
            if done % 5 == 0 or done == total:
                _save_job(job_id, job_type, "running", user_id=user_id, files_total=total, files_done=done, size_bytes=size, progress_pct=(done/total)*100, started_at=started)
        except Exception as e:
            errors.append(f"Copy failed [{src_key}]: {e}")

    status = "done" if not errors else "done_with_errors"
    msg = f"Done. Total: {total}, Done: {done-skipped}, Skipped: {skipped}"
    _save_job(job_id, job_type, status, user_id=user_id, files_total=total, files_done=done, size_bytes=size, progress_pct=100.0, errors=errors, started_at=started, ended_at=datetime.now(timezone.utc))
    
    # Cache transit info in DB for performance
    if status == "done":
        _update_transit_cache(user_id, total, size)
        
    return {"job_id": job_id, "status": status, "files_done": done, "skipped": skipped, "size_bytes": size, "errors": errors}

def _update_transit_cache(user_id: str, count: int, size: int):
    """Update metadata cache for transit objects."""
    auth_service.db['sync_cache'].update_one(
        {"user_id": user_id},
        {"$set": {"transit_count": count, "transit_size_bytes": size, "updated_at": datetime.now(timezone.utc)}},
        upsert=True
    )


# ══════════════════════════════════════════════════════════════════════════════
#  JOB 2 — Pull to Server 2 (Global or User-scoped)
# ══════════════════════════════════════════════════════════════════════════════
def run_pull_to_server2(user_id: str = None, date: str = None) -> dict:
    """
    Pull from transit/{date}/{scope}/ to local disk.
    If user_id is provided, save to Server2Path/{user_id}/.
    """
    job_id  = str(uuid.uuid4())
    date    = date or _today_label()
    scope_path = user_id if user_id else "global"
    prefix  = f"{TRANSIT_ROOT}/{date}/{scope_path}/"
    
    # Target directory on Server 2
    target_dir = SERVER2_PATH / user_id if user_id else SERVER2_PATH / "global"
    _ensure_dir(target_dir)
    
    started = datetime.now(timezone.utc)
    errors  = []

    # Normalize job types for Monitor
    if user_id:
        job_type = "user_server2_pull"
    else:
        job_type = "server2_pull" # Global

    _save_job(job_id, job_type, "running", user_id=user_id, started_at=started)

    try:
        paginator = s3_client.get_paginator("list_objects_v2")
        pages = paginator.paginate(Bucket=BUCKET_NAME, Prefix=prefix)
        transit_objects = []
        for page in pages:
            for obj in page.get("Contents", []):
                transit_objects.append(obj)
    except Exception as e:
        msg = f"Failed to list transit: {e}"
        _save_job(job_id, job_type, "failed", user_id=user_id, errors=[msg], started_at=started, ended_at=datetime.now(timezone.utc))
        return {"status": "failed", "error": msg}

    total = len(transit_objects)
    done  = 0
    size  = 0
    archive_root = target_dir / "archive" / date

    if total == 0:
        _save_job(job_id, job_type, "done", user_id=user_id, files_total=0, files_done=0, progress_pct=100.0, started_at=started, ended_at=datetime.now(timezone.utc))
        return {"job_id": job_id, "status": "done", "files_done": 0, "size_bytes": 0, "errors": []}

    for obj in transit_objects:
        s3_key = obj["Key"]
        etag   = _etag_to_md5(obj.get("ETag", ""))
        # Rel name from transit/{date}/{scope}/filename -> filename
        flat_name = s3_key[len(prefix):]
        local_path = target_dir / flat_name

        if _download_with_retry(s3_key, etag, local_path, archive_root, errors):
            done += 1
            size += obj.get("Size", 0)
            # Update progress
            if done % 5 == 0 or done == total:
                _save_job(job_id, job_type, "running", user_id=user_id, files_total=total, files_done=done, size_bytes=size, progress_pct=(done/total)*100, started_at=started)

    status = "done" if not errors else "done_with_errors"
    _save_job(job_id, job_type, status, user_id=user_id, files_total=total, files_done=done, size_bytes=size, progress_pct=100.0, errors=errors, started_at=started, ended_at=datetime.now(timezone.utc))
    return {"job_id": job_id, "status": status, "files_done": done, "size_bytes": size, "errors": errors}



def _download_with_retry(s3_key: str, etag: str,
                         local_path: Path, archive_root: Path,
                         errors: list) -> bool:
    """
    Download one S3 object with up to MAX_RETRIES attempts.
    On success, verify hash. On overwrite, archive the old file first.
    Returns True if file is saved & verified successfully.
    """
    _ensure_dir(local_path.parent)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            # --- DELTA CHECK ---
            if local_path.exists():
                # For non-multipart ETags, we can verify before downloading
                if "-" not in etag:
                    local_md5 = _md5_of_file(local_path)
                    if local_md5 == etag:
                        logger.info(f"[Delta] Skipping identical file: {local_path.name}")
                        return True # Already in sync
            
            # Download to a temp file first
            tmp_path = local_path.with_suffix(local_path.suffix + ".tmp")
            s3_client.download_file(BUCKET_NAME, s3_key, str(tmp_path))

            # Hash verification (skip multi-part ETags that contain '-')
            if "-" not in etag:
                local_md5 = _md5_of_file(tmp_path)
                if local_md5 != etag:
                    tmp_path.unlink(missing_ok=True)
                    raise ValueError(f"Hash mismatch: local={local_md5}, s3={etag}")

            # Soft-archive existing file before overwriting
            if local_path.exists():
                _ensure_dir(archive_root)
                archive_dest = archive_root / local_path.name
                # Avoid collision inside archive: append timestamp
                if archive_dest.exists():
                    ts = int(time.time())
                    archive_dest = archive_root / f"{ts}_{local_path.name}"
                shutil.move(str(local_path), str(archive_dest))
                logger.info(f"[Job2] Archived old version → {archive_dest}")

            # Atomically move temp → final
            shutil.move(str(tmp_path), str(local_path))
            logger.info(f"[Job2] Saved [{s3_key}] → {local_path}")
            return True

        except Exception as e:
            logger.warning(f"[Job2] Attempt {attempt}/{MAX_RETRIES} failed for [{s3_key}]: {e}")
            if attempt < MAX_RETRIES:
                logger.info(f"[Job2] Retrying in {RETRY_DELAY_S // 60} min …")
                time.sleep(RETRY_DELAY_S)
            else:
                err = f"[{s3_key}] Failed after {MAX_RETRIES} attempts: {e}"
                errors.append(err)
                # Clean up temp file if left behind
                tmp_path = local_path.with_suffix(local_path.suffix + ".tmp")
                if tmp_path.exists():
                    tmp_path.unlink(missing_ok=True)
                return False

    return False


# ══════════════════════════════════════════════════════════════════════════════
#  JOB 3 — Cleanup (Global or User-scoped)
# ══════════════════════════════════════════════════════════════════════════════
def cleanup_transit(user_id: str = None, date: str = None) -> dict:
    """Delete transit objects."""
    job_id = str(uuid.uuid4())
    date   = date or _today_label()
    scope  = user_id if user_id else "global"
    prefix = f"{TRANSIT_ROOT}/{date}/{scope}/"
    _save_job(job_id, "s3_cleanup", "running", user_id=user_id)

    try:
        response = s3_client.list_objects_v2(Bucket=BUCKET_NAME, Prefix=prefix)
        objects = [{"Key": obj["Key"]} for obj in response.get("Contents", [])]
        if objects:
            s3_client.delete_objects(Bucket=BUCKET_NAME, Delete={"Objects": objects})
        _save_job(job_id, "s3_cleanup", "done", user_id=user_id, files_done=len(objects), progress_pct=100.0)
        
        # Clear transit cache on cleanup
        _update_transit_cache(user_id, 0, 0)
        
        return {"status": "done", "deleted": len(objects)}
    except Exception as e:
        _save_job(job_id, "s3_cleanup", "failed", user_id=user_id, errors=[str(e)])
        return {"status": "failed", "error": str(e)}

def run_user_pipeline(user_id: str):
    """Orchestrate 3-node backup for a single user."""
    date = _today_label()
    # 1. Push
    push = run_push_to_transit(user_id)
    if push["status"] == "failed": return push
    # 2. Pull
    pull = run_pull_to_server2(user_id, date)
    if pull["status"] in ("done", "done_with_errors") and pull["files_done"] > 0:
        # 3. Cleanup
        cleanup_transit(user_id, date)
    return {"status": "completed", "push": push, "pull": pull}

def run_global_pipeline():
    """Nightly global run."""
    date = _today_label()
    push = run_push_to_transit(None)
    if push["status"] == "failed": return push
    pull = run_pull_to_server2(None, date)
    if pull["status"] in ("done", "done_with_errors"):
        cleanup_transit(None, date)
    return {"status": "completed"}

# ── Aliases for main.py ───────────────────────────────────────────────────────
run_global_sync_to_transit = run_push_to_transit
run_server2_pull           = run_pull_to_server2
run_full_pipeline          = run_global_pipeline
cleanup_s3_transit        = cleanup_transit
    
def get_user_sync_status(user_id: str) -> dict:
    """Get the last successful sync time for a specific user."""
    try:
        doc = auth_service.sync_jobs_collection.find_one(
            {"job_type": "user_server2_pull", "status": {"$in": ["done", "done_with_errors"]}},
            sort=[("started_at", -1)]
        )
        return {"last_sync": doc["started_at"] if doc else None}
    except:
        return {"last_sync": None}



# ══════════════════════════════════════════════════════════════════════════════
#  STATUS — Real-time snapshot for the Sync Monitor UI
# ══════════════════════════════════════════════════════════════════════════════


def get_sync_status_scoped(user_id: str = None) -> dict:
    """
    Aggregate last job for either global system or a specific user.
    """
    def _last_job(job_type: str, scope_user_id: str = None):
        try:
            query = {"job_type": job_type}
            if scope_user_id:
                query["user_id"] = scope_user_id
            else:
                query["user_id"] = None # Global jobs have user_id=None

            doc = auth_service.sync_jobs_collection.find_one(
                query,
                sort=[("started_at", -1)]
            )
            if doc:
                doc.pop("_id", None)
            return doc
        except Exception:
            return None

    if user_id:
        # User-scoped jobs
        last_push    = _last_job("user_transit_push", user_id)
        last_pull    = _last_job("user_server2_pull", user_id)
        last_cleanup = _last_job("s3_cleanup", user_id)
    else:
        # Global jobs
        last_push    = _last_job("s3_transit_push", None)
        last_pull    = _last_job("server2_pull", None)
        last_cleanup = _last_job("s3_cleanup", None)

    # Use cached transit info if available, else fallback to listing
    cache = auth_service.db['sync_cache'].find_one({"user_id": user_id})
    if cache:
        transit_count = cache.get("transit_count", 0)
        transit_size  = cache.get("transit_size_bytes", 0)
    else:
        # Fallback to listing (legacy or first time)
        transit_count = 0
        transit_size  = 0
        try:
            paginator = s3_client.get_paginator("list_objects_v2")
            pages = paginator.paginate(Bucket=BUCKET_NAME, Prefix=TRANSIT_ROOT + "/")
            for page in pages:
                for obj in page.get("Contents", []):
                    key = obj["Key"]
                    parts = key.split('/')
                    if len(parts) >= 3:
                        scope = parts[2]
                        if user_id:
                            if scope == user_id:
                                transit_count += 1
                                transit_size += obj.get("Size", 0)
                        else:
                            if scope == "global":
                                transit_count += 1
                                transit_size += obj.get("Size", 0)
            # Seed cache
            _update_transit_cache(user_id, transit_count, transit_size)
        except Exception:
            pass

    # Check Server 2 disk
    server2_file_count = 0
    server2_size       = 0
    
    # Target path for user or global
    target_path = SERVER2_PATH / user_id if user_id else SERVER2_PATH / "global"
    server2_exists = target_path.exists()
    
    if server2_exists:
        for f in target_path.rglob("*"):
            if f.is_file() and "archive" not in f.parts:
                server2_file_count += 1
                server2_size       += f.stat().st_size

    return {
        "server2_path":        str(target_path),
        "server2_exists":      server2_exists,
        "server2_file_count":  server2_file_count,
        "server2_size_bytes":  server2_size,
        "transit_count":       transit_count,
        "transit_size_bytes":  transit_size,
        "last_push":           last_push,
        "last_pull":           last_pull,
        "last_cleanup":        last_cleanup,
        "scope":               user_id or "global"
    }

def get_sync_history_scoped(user_id: str = None, limit: int = 20) -> list:
    """Return recent sync job history filtered by scope."""
    try:
        if user_id:
            query = {"user_id": user_id}
        else:
            query = {"user_id": None}

        docs = list(
            auth_service.sync_jobs_collection.find(
                query,
                sort=[("started_at", -1)],
                limit=limit
            )
        )
        for d in docs:
            d.pop("_id", None)
        return docs
    except Exception as e:
        logger.warning(f"[SyncHistory] {e}")
        return []
