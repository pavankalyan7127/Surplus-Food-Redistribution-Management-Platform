from typing import Callable, Optional
from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.database import Database

from app.core.security import decode_access_token
from app.db.mongodb import get_db
from app.models.user import UserRole
from app.schemas.auth import UserResponse
from app.services.auth_service import serialize_user_doc

security_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Database = Depends(get_db),
) -> UserResponse:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Find user by ObjectId or string ID
    query = {}
    if ObjectId.is_valid(user_id):
        query = {"_id": ObjectId(user_id)}
    else:
        query = {"_id": user_id}

    user_doc = db.users.find_one(query)
    if not user_doc:
        # Fallback query by email if sub was email
        user_doc = db.users.find_one({"email": str(user_id).lower()})

    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user_doc.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    return serialize_user_doc(user_doc)


def require_role(allowed_role: UserRole) -> Callable[[UserResponse], UserResponse]:
    """Dependency factory that validates the user's role."""
    def role_checker(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
        if current_user.role != allowed_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: this endpoint requires {allowed_role.value} role",
            )
        return current_user

    return role_checker
