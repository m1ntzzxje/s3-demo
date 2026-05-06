from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import logging
import os

from s3_service import create_bucket_if_not_exists, enable_versioning, set_lifecycle_policy
from dependencies import BUCKET_NAME
import sync_service

# Import routers
from routers import auth, files, trash, share, department, sync

app = FastAPI(title="ESoft S3 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(files.router)
app.include_router(trash.router)
app.include_router(share.router)
app.include_router(department.router)
app.include_router(sync.router)

_scheduler = BackgroundScheduler(timezone="UTC")

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

    # ── APScheduler: 3-Node Backup Jobs ──────────────────────────────────────
    sync_hour_push = int(os.getenv("SYNC_S3_TO_TRANSIT_HOUR", "0"))
    sync_hour_pull = int(os.getenv("SYNC_SERVER2_PULL_HOUR",  "3"))

    _scheduler.add_job(
        sync_service.run_global_pipeline,
        trigger=CronTrigger(hour=sync_hour_push, minute=0),
        id="job_global_pipeline",
        name=f"Global 3-Node Sync ({sync_hour_push:02d}:00 UTC)",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    _scheduler.start()

    logging.info(f"[Scheduler] Jobs registered: push={sync_hour_push}h UTC, pull={sync_hour_pull}h UTC")

@app.on_event("shutdown")
async def shutdown_event():
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logging.info("[Scheduler] APScheduler stopped.")
