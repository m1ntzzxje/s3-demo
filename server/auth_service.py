import os
from pymongo import MongoClient
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone

# --- MongoDB Connections ---
# Will connect to localhost MongoDB by default.
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = MongoClient(MONGO_URI)
db = client['esoft_s3_db']
users_collection = db['users']

# Ensure unique index on email
users_collection.create_index("email", unique=True)

# Shares collection
shares_collection = db['shares']
shares_collection.create_index([("key", 1), ("target_id", 1)], unique=True)

def s3_client_ref():
    """Return the configured S3 client for versioning operations."""
    from s3_config import s3_client
    return s3_client

# --- Security ---
SECRET_KEY = os.getenv("JWT_SECRET", "super_secret_esoft_key_2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 1 day

def verify_password(plain_password, hashed_password):
    if isinstance(plain_password, str):
        plain_password = plain_password.encode('utf-8')
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode('utf-8')
    return bcrypt.checkpw(plain_password, hashed_password)

def get_password_hash(password):
    if isinstance(password, str):
        password = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password, salt).decode('utf-8')

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def register_user(username, email, password):
    existing = users_collection.find_one({"email": email})
    if existing:
        return {"success": False, "message": "Email already registered"}
    
    hashed_password = get_password_hash(password)
    user_doc = {
        "username": username,
        "email": email,
        "password": hashed_password,
        "created_at": datetime.now(timezone.utc)
    }
    users_collection.insert_one(user_doc)
    return {"success": True, "message": "User registered successfully"}

def authenticate_user(email, password):
    user = users_collection.find_one({"email": email})
    if not user:
        return {"success": False, "message": "Invalid email or password"}
    
    if not verify_password(password, user['password']):
        return {"success": False, "message": "Invalid email or password"}
        
    # Valid user, generate token
    token = create_access_token(data={"sub": user["email"]})
    
    return {
        "success": True, 
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "name": user["username"],
            "email": user["email"]
        }
    }
