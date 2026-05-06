from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import auth_service

router = APIRouter(prefix="/api/auth", tags=["Auth"])

class RegisterModel(BaseModel):
    username: str
    email: str
    password: str

class LoginModel(BaseModel):
    email: str
    password: str
    mfa_code: Optional[str] = None

@router.post("/register")
def register_api(user: RegisterModel):
    res = auth_service.register_user(user.username, user.email, user.password)
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@router.post("/login")
def login_api(user: LoginModel):
    if user.mfa_code and user.mfa_code != "102030":
        raise HTTPException(status_code=401, detail="Invalid MFA code")

    res = auth_service.authenticate_user(user.email, user.password)
    if not res["success"]:
        raise HTTPException(status_code=401, detail=res["message"])
    return res
