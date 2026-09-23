"""
Replaces the Node/Express auth service. Reads/writes the SAME `users`
collection Node used to own, so existing signed-up users still work
(their passwords will need to be reset/rehashed once, see note below).
"""
import logging
import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr

from db import db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth")
users = db.users

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGO = "HS256"
JWT_EXPIRE_HOURS = 24

if not JWT_SECRET:
    raise RuntimeError("Missing JWT_SECRET in .env — set it before starting the server.")

_bearer = HTTPBearer()


class SignupBody(BaseModel):
    username: str
    emailId: EmailStr
    password: str


class LoginBody(BaseModel):
    emailId: EmailStr
    password: str


def _make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def get_current_user_id(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> str:
    """FastAPI dependency — use this on any route that needs a logged-in user.
    Example: def upload(user_id: str = Depends(get_current_user_id)): ...
    """
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        return payload["sub"]
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@router.post("/signup")
def signup(body: SignupBody):
    try:
        if len(body.username) < 5 or len(body.username) > 20:
            raise HTTPException(400, "Username must be 5-20 characters")
        if len(body.password) < 8:
            raise HTTPException(400, "Password must be at least 8 characters")

        email = body.emailId.strip().lower()
        if users.find_one({"emailId": email}):
            raise HTTPException(409, "Email already registered")

        hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
        result = users.insert_one({
            "username": body.username,
            "emailId": email,
            "password": hashed,
            "createdAt": datetime.now(timezone.utc),
        })

        user_id = str(result.inserted_id)
        return {
            "message": "Signup successful",
            "token": _make_token(user_id),
            "user": {"id": user_id, "username": body.username, "emailId": email},
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Signup failed for email=%s", body.emailId)
        raise HTTPException(status_code=500, detail="Signup failed due to server error. Check App Service logs for the MongoDB/DB exception.")


@router.post("/login")
def login(body: LoginBody):
    try:
        email = body.emailId.strip().lower()
        user = users.find_one({"emailId": email})

        if not user or not bcrypt.checkpw(body.password.encode(), user["password"].encode()):
            raise HTTPException(401, "Invalid email or password")

        user_id = str(user["_id"])
        return {
            "message": "Login successful",
            "token": _make_token(user_id),
            "user": {"id": user_id, "username": user["username"], "emailId": user["emailId"]},
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Login failed for email=%s", body.emailId)
        raise HTTPException(status_code=500, detail="Login failed due to server error. Check App Service logs for the MongoDB/DB exception.")