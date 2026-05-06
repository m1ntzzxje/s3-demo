from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from dependencies import get_current_user, validate_file, BUCKET_NAME, MAX_FILE_SIZE
from s3_service import list_files, upload_file, get_presigned_url
import time

router = APIRouter(prefix="/api/department", tags=["Department"])
DEPT_PREFIX = "department/"

@router.get("")
def get_dept_files_api(current_user: dict = Depends(get_current_user)):
    try:
        return list_files(BUCKET_NAME, DEPT_PREFIX)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def dept_upload_api(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
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

@router.get("/download")
def dept_download_api(key: str, current_user: dict = Depends(get_current_user)):
    if not key.startswith(DEPT_PREFIX):
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        return {"url": get_presigned_url(BUCKET_NAME, key)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
