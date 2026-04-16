import os
import boto3
from botocore.client import Config
from dotenv import load_dotenv

load_dotenv()

S3_ENDPOINT = os.getenv("S3_ENDPOINT")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY")
S3_REGION = os.getenv("S3_REGION", "us-east-1")

# ── Security: Fail loudly if secrets are missing ──
if not S3_ACCESS_KEY or not S3_SECRET_KEY:
    raise RuntimeError(
        "S3_ACCESS_KEY and S3_SECRET_KEY must be set in .env file. "
        "Do NOT hardcode credentials in source code."
    )
if not S3_ENDPOINT:
    raise RuntimeError("S3_ENDPOINT must be set in .env file.")

s3_client = boto3.client(
    "s3",
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    region_name=S3_REGION,
    config=Config(signature_version="s3v4")
)
