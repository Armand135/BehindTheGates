"""FastAPI dependencies for authenticated routes, plus a token-decoding
helper the WebSocket endpoint reuses (browsers can't send custom headers on
a WebSocket handshake, so that path authenticates via a `?token=` query
param instead of the `Authorization` header used everywhere else).
"""
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.security import decode_access_token
from app.database import get_db
from app.models.auth import User

_bearer_scheme = HTTPBearer(auto_error=False)


def get_user_from_token(token: str, db: Session) -> User:
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = db.get(User, payload.get("sub"))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return get_user_from_token(credentials.credentials, db)
