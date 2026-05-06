from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from dependencies import get_current_user, log_action, BUCKET_NAME
from s3_service import upload_file
import sync_service
import json, time

router = APIRouter(prefix="/api", tags=["Sync"])

@router.post("/backup")
async def run_backup_api(current_user: dict = Depends(get_current_user)):
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

@router.get("/sync/user-status")
def get_user_sync_status_api(current_user: dict = Depends(get_current_user)):
    return sync_service.get_user_sync_status(current_user["id"])

@router.post("/sync/user-trigger")
def trigger_user_sync_api(background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    background_tasks.add_task(sync_service.run_user_pipeline, current_user["id"])
    log_action(current_user["id"], "user_sync_trigger", {})
    return {"message": "Personal hard-copy backup started"}

@router.get("/sync/status")
def sync_status_api(current_user: dict = Depends(get_current_user)):
    try:
        return sync_service.get_sync_status_scoped(current_user["id"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sync/history")
def sync_history_api(limit: int = 20, current_user: dict = Depends(get_current_user)):
    try:
        return sync_service.get_sync_history_scoped(user_id=current_user["id"], limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/trigger/push")
def sync_trigger_push_api(background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    background_tasks.add_task(sync_service.run_push_to_transit, current_user["id"])
    log_action(current_user["id"], "sync_trigger_push", {})
    return {"message": "Personal transit push started"}

@router.post("/sync/trigger/pull")
def sync_trigger_pull_api(background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    background_tasks.add_task(sync_service.run_pull_to_server2, current_user["id"])
    log_action(current_user["id"], "sync_trigger_pull", {})
    return {"message": "Personal Server2 pull started"}

@router.post("/sync/trigger/pipeline")
def sync_trigger_pipeline_api(background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    background_tasks.add_task(sync_service.run_user_pipeline, current_user["id"])
    log_action(current_user["id"], "sync_trigger_pipeline", {})
    return {"message": "Personal backup pipeline started"}

@router.post("/sync/cleanup")
def sync_cleanup_api(current_user: dict = Depends(get_current_user)):
    try:
        result = sync_service.cleanup_s3_transit(current_user["id"])
        log_action(current_user["id"], "sync_cleanup", result)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
