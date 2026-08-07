from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.schemas import LoginRequest, SignupRequest, TokenResponse, UserOut
from app.auth.security import create_access_token, hash_password, verify_password
from app.models.auth import Organization, User, UserRole


class AuthError(Exception):
    """Raised for user-facing auth failures (bad credentials, duplicate email)."""


def _to_token_response(user: User, org: Organization) -> TokenResponse:
    token = create_access_token(subject=user.id, extra_claims={"org_id": org.id})
    return TokenResponse(
        access_token=token,
        user=UserOut(id=user.id, email=user.email, role=user.role.value, org_id=org.id, organization_name=org.name),
    )


def signup(db: Session, req: SignupRequest) -> TokenResponse:
    existing = db.execute(select(User).where(User.email == req.email)).scalar_one_or_none()
    if existing is not None:
        raise AuthError("An account with this email already exists.")

    org = Organization(name=req.organization_name)
    db.add(org)
    db.flush()

    user = User(org_id=org.id, email=req.email, hashed_password=hash_password(req.password), role=UserRole.owner)
    db.add(user)
    db.commit()
    db.refresh(user)
    db.refresh(org)
    return _to_token_response(user, org)


def login(db: Session, req: LoginRequest) -> TokenResponse:
    user = db.execute(select(User).where(User.email == req.email)).scalar_one_or_none()
    if user is None or not verify_password(req.password, user.hashed_password):
        raise AuthError("Invalid email or password.")
    return _to_token_response(user, user.organization)
