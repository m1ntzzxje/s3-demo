from fastapi import APIRouter, HTTPException, Depends
from dependencies import get_current_user, log_action, BUCKET_NAME
import auth_service

router = APIRouter(prefix="/api/trash", tags=["Trash"])

@router.get("")
def get_trash_api(current_user: dict = Depends(get_current_user)):
    try:
        prefix = f"{current_user['id']}/"
        response = auth_service.s3_client_ref().list_object_versions(Bucket=BUCKET_NAME, Prefix=prefix)
        delete_markers = response.get('DeleteMarkers', [])
        latest_markers = [m for m in delete_markers if m.get('IsLatest', False)]
        return [{"Key": m['Key'], "DeletedAt": m['LastModified'].isoformat(), "VersionId": m['VersionId']} for m in latest_markers]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/restore")
def restore_file_api(key: str, current_user: dict = Depends(get_current_user)):
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

@router.delete("/permanent")
def permanent_delete_api(key: str, current_user: dict = Depends(get_current_user)):
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
