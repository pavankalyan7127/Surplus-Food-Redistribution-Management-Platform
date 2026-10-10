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
    HubSignupRequest,
    NgoSignupRequest,
    ProviderSignupRequest,
    TokenResponse,
    UserResponse,
)


from app.services.geocoding_service import GeocodingService


def serialize_user_doc(user_doc: dict, db: Optional[Database] = None) -> UserResponse:
    """Safely convert a MongoDB user document into UserResponse."""
    raw_id = user_doc.get("_id")
    str_id = str(raw_id) if raw_id is not None else ""
    loc = user_doc.get("location")
    lat: Optional[float] = None
    lon: Optional[float] = None
    if loc and isinstance(loc, dict) and loc.get("type") == "Point":
        coords = loc.get("coordinates")
        if isinstance(coords, (list, tuple)) and len(coords) == 2:
            lon, lat = float(coords[0]), float(coords[1])

    nearest_hub_id = user_doc.get("nearest_hub_id")
    nearest_hub_name: Optional[str] = None
    if nearest_hub_id and db is not None:
        try:
            hub_query = {"_id": ObjectId(nearest_hub_id)} if ObjectId.is_valid(nearest_hub_id) else {"_id": nearest_hub_id}
            hub_doc = db.users.find_one(hub_query)
            if hub_doc:
                nearest_hub_name = hub_doc.get("organization_name")
        except Exception:
            pass

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
        location=loc,
        latitude=lat,
        longitude=lon,
        nearest_hub_id=nearest_hub_id,
        nearest_hub_name=nearest_hub_name,
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

        # Geocode address if coordinates not supplied
        lat = payload.latitude
        lon = payload.longitude
        if lat is None or lon is None:
            geocoded = GeocodingService.geocode_address(payload.address)
            if geocoded:
                lat, lon = geocoded

        location_doc = None
        nearest_hub_id = None
        if lat is not None and lon is not None:
            # Store GeoJSON: coordinates are [longitude, latitude]
            location_doc = {
                "type": "Point",
                "coordinates": [float(lon), float(lat)]
            }
            nearest_hub = GeocodingService.find_nearest_eligible_hub(db, float(lat), float(lon))
            if nearest_hub:
                nearest_hub_id = str(nearest_hub["_id"])

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
            "location": location_doc,
            "nearest_hub_id": nearest_hub_id,
            "created_at": now,
            "updated_at": now,
        }

        try:
            result = db.users.insert_one(user_doc)
            user_doc["_id"] = result.inserted_id
            return serialize_user_doc(user_doc, db=db)
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
    def register_hub(db: Database, payload: HubSignupRequest) -> UserResponse:
        """Register a new central hub with automatic address geocoding."""
        normalized_email = payload.email.strip().lower()

        existing = db.users.find_one({"email": normalized_email})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists",
            )

        # Geocode address if coordinates not supplied
        lat = payload.latitude
        lon = payload.longitude
        if lat is None or lon is None:
            geocoded = GeocodingService.geocode_address(payload.address)
            if geocoded:
                lat, lon = geocoded

        location_doc = None
        if lat is not None and lon is not None:
            if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Coordinates out of valid geographical range.",
                )
            location_doc = {
                "type": "Point",
                "coordinates": [float(lon), float(lat)],
            }

        now = datetime.now(timezone.utc)
        user_doc = {
            "organization_name": payload.organization_name.strip(),
            "contact_name": payload.contact_name.strip(),
            "email": normalized_email,
            "password_hash": hash_password(payload.password),
            "phone": payload.phone.strip(),
            "address": payload.address.strip(),
            "role": UserRole.HUB.value,
            "is_active": True,
            "provider_type": None,
            "estimated_daily_meal_demand": None,
            "location": location_doc,
            "created_at": now,
            "updated_at": now,
        }

        try:
            result = db.users.insert_one(user_doc)
            user_doc["_id"] = result.inserted_id

            # If this hub has valid coordinates, recalculate nearest hubs for providers
            if location_doc:
                GeocodingService.recalculate_all_provider_hubs(db)

            return serialize_user_doc(user_doc, db=db)
        except DuplicateKeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists",
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
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
    ) -> UserResponse:
        """Provision a hub admin user (CLI / seed script only) with automatic geocoding."""
        normalized_email = email.strip().lower()
        now = datetime.now(timezone.utc)

        lat = latitude
        lon = longitude
        if lat is None or lon is None:
            geocoded = GeocodingService.geocode_address(address)
            if geocoded:
                lat, lon = geocoded

        location_doc = None
        if lat is not None and lon is not None:
            location_doc = {
                "type": "Point",
                "coordinates": [float(lon), float(lat)],
            }

        existing = db.users.find_one({"email": normalized_email})
        if existing:
            update_fields: dict = {
                "organization_name": organization_name.strip(),
                "contact_name": contact_name.strip(),
                "password_hash": hash_password(password),
                "phone": phone.strip(),
                "address": address.strip(),
                "role": UserRole.HUB.value,
                "is_active": True,
                "updated_at": now,
            }
            if location_doc:
                update_fields["location"] = location_doc

            db.users.update_one({"_id": existing["_id"]}, {"$set": update_fields})
            if location_doc:
                GeocodingService.recalculate_all_provider_hubs(db)

            updated = db.users.find_one({"_id": existing["_id"]})
            return serialize_user_doc(updated, db=db)

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
            "location": location_doc,
            "created_at": now,
            "updated_at": now,
        }
        res = db.users.insert_one(user_doc)
        user_doc["_id"] = res.inserted_id

        if location_doc:
            GeocodingService.recalculate_all_provider_hubs(db)

        return serialize_user_doc(user_doc, db=db)
