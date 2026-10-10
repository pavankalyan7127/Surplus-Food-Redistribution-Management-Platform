from datetime import datetime, timezone
from typing import Optional, Tuple
from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import ProviderType, UserInDB, UserRole
from app.schemas.auth import (
    NgoSignupRequest,
    ProviderSignupRequest,
    TokenResponse,
    UserResponse,
)


def serialize_user_doc(user_doc: dict) -> UserResponse:
    """Safely convert a MongoDB user document into UserResponse."""
    raw_id = user_doc.get("_id")
    str_id = str(raw_id) if raw_id is not None else ""
    return UserResponse(
        id=str_id,
        organization_name=user_doc.get("organization_name", ""),
        contact_name=user_doc.get("contact_name", ""),
        email=user_doc.get("email", ""),
        phone=user_doc.get("phone", ""),
        address=user_doc.get("address", ""),
        role=user_doc.get("role"),
        is_active=bool(user_doc.get("is_active", True)),
        created_at=user_doc.get("created_at") or datetime.now(timezone.utc),
        provider_type=user_doc.get("provider_type"),
        estimated_daily_meal_demand=user_doc.get("estimated_daily_meal_demand"),
    )


class AuthService:
    @staticmethod
    def register_provider(db: Database, payload: ProviderSignupRequest) -> UserResponse:
        normalized_email = payload.email.strip().lower()

        # Check existing user
        existing = db.users.find_one({"email": normalized_email})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists",
            )

        now = datetime.now(timezone.utc)
        user_doc = {
            "organization_name": payload.organization_name.strip(),
            "contact_name": payload.contact_name.strip(),
            "email": normalized_email,
            "password_hash": hash_password(payload.password),
            "phone": payload.phone.strip(),
            "address": payload.address.strip(),
            "role": UserRole.PROVIDER.value,
            "is_active": True,
            "provider_type": payload.provider_type.value,
            "estimated_daily_meal_demand": None,
            "created_at": now,
            "updated_at": now,
        }

        try:
            result = db.users.insert_one(user_doc)
            user_doc["_id"] = result.inserted_id
            return serialize_user_doc(user_doc)
        except DuplicateKeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists",
            )

    @staticmethod
    def register_ngo(db: Database, payload: NgoSignupRequest) -> UserResponse:
        normalized_email = payload.email.strip().lower()

        # Check existing user
        existing = db.users.find_one({"email": normalized_email})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists",
            )

        now = datetime.now(timezone.utc)
        user_doc = {
            "organization_name": payload.organization_name.strip(),
            "contact_name": payload.contact_name.strip(),
            "email": normalized_email,
            "password_hash": hash_password(payload.password),
            "phone": payload.phone.strip(),
            "address": payload.address.strip(),
            "role": UserRole.NGO.value,
            "is_active": True,
            "provider_type": None,
            "estimated_daily_meal_demand": payload.estimated_daily_meal_demand,
            "created_at": now,
            "updated_at": now,
        }

        try:
            result = db.users.insert_one(user_doc)
            user_doc["_id"] = result.inserted_id
            return serialize_user_doc(user_doc)
        except DuplicateKeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists",
            )

    @staticmethod
    def authenticate(
        db: Database,
        email: str,
        password: str,
        expected_role: UserRole,
    ) -> TokenResponse:
        normalized_email = email.strip().lower()
        generic_error = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

        user_doc = db.users.find_one({"email": normalized_email})
        if not user_doc:
            raise generic_error

        # Validate password hash
        if not verify_password(password, user_doc.get("password_hash", "")):
            raise generic_error

        # Validate role matches expected role
        if user_doc.get("role") != expected_role.value:
            raise generic_error

        # Validate account active status
        if not user_doc.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive. Please contact support.",
            )

        # Create access token
        user_response = serialize_user_doc(user_doc)
        token = create_access_token(
            subject=user_response.id,
            role=user_response.role.value,
            extra_claims={"email": user_response.email},
        )

        expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            expires_in=expires_in,
            user=user_response,
        )

    @staticmethod
    def create_or_update_hub_admin(
        db: Database,
        email: str,
        password: str,
        organization_name: str,
        contact_name: str,
        phone: str,
        address: str,
    ) -> UserResponse:
        """Provision a hub admin user (CLI / seed script only)."""
        normalized_email = email.strip().lower()
        now = datetime.now(timezone.utc)

        existing = db.users.find_one({"email": normalized_email})
        if existing:
            db.users.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "organization_name": organization_name.strip(),
                        "contact_name": contact_name.strip(),
                        "password_hash": hash_password(password),
                        "phone": phone.strip(),
                        "address": address.strip(),
                        "role": UserRole.HUB.value,
                        "is_active": True,
                        "updated_at": now,
                    }
                },
            )
            updated = db.users.find_one({"_id": existing["_id"]})
            return serialize_user_doc(updated)

        user_doc = {
            "organization_name": organization_name.strip(),
            "contact_name": contact_name.strip(),
            "email": normalized_email,
            "password_hash": hash_password(password),
            "phone": phone.strip(),
            "address": address.strip(),
            "role": UserRole.HUB.value,
            "is_active": True,
            "provider_type": None,
            "estimated_daily_meal_demand": None,
            "created_at": now,
            "updated_at": now,
        }
        res = db.users.insert_one(user_doc)
        user_doc["_id"] = res.inserted_id
        return serialize_user_doc(user_doc)
