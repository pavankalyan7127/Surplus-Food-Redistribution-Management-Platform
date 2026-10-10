from datetime import datetime
from enum import Enum
from typing import Optional
from bson import ObjectId
from pydantic import EmailStr, Field

from app.models.common import MongoBaseModel, PyObjectId, utc_now


class UserRole(str, Enum):
    PROVIDER = "provider"
    HUB = "hub"
    NGO = "ngo"


class ProviderType(str, Enum):
    RESTAURANT = "restaurant"
    BAKERY = "bakery"
    HOSTEL_MESS = "hostel_mess"
    OTHER = "other"


class UserInDB(MongoBaseModel):
    id: PyObjectId = Field(default_factory=lambda: str(ObjectId()), alias="_id")
    organization_name: str
    contact_name: str
    email: EmailStr
    password_hash: str
    phone: str
    address: str
    role: UserRole
    is_active: bool = True
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    # Role-specific fields
    provider_type: Optional[ProviderType] = None
    estimated_daily_meal_demand: Optional[int] = None
