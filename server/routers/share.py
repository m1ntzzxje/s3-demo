from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from dependencies import get_current_user, log_action, BUCKET_NAME
from s3_service import get_presigned_url
import auth_service
from datetime import datetime, timezone

router = APIRouter(prefix="/api", tags=["Share"])

class ShareModel(BaseModel):
    key: str
    target_email: str

@router.post("/share")
def share_file_api(body: ShareModel, current_user: dict = Depends(get_current_user)):
    if not body.key.startswith(f"{current_user['id']}/"):
        raise HTTPException(status_code=403, detail="Forbidden")
    target = auth_service.users_collection.find_one({"email": body.target_email})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
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

@router.get("/shared")
def get_shared_files_api(current_user: dict = Depends(get_current_user)):
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

@router.delete("/share")
def unshare_file_api(key: str, current_user: dict = Depends(get_current_user)):
    auth_service.shares_collection.delete_many({
        "key": key,
        "$or": [{"owner_id": current_user['id']}, {"target_id": current_user['id']}]
    })
    return {"message": "Share removed"}
