from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import ProviderType, UserRole


class ProviderSignupRequest(BaseModel):
    organization_name: str = Field(..., min_length=2, max_length=150)
    contact_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    phone: str = Field(..., min_length=7, max_length=25)
    address: str = Field(..., min_length=5, max_length=255)
    provider_type: ProviderType


class NgoSignupRequest(BaseModel):
    organization_name: str = Field(..., min_length=2, max_length=150)
    contact_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    phone: str = Field(..., min_length=7, max_length=25)
    address: str = Field(..., min_length=5, max_length=255)
    estimated_daily_meal_demand: Optional[int] = Field(None, ge=1, le=100000)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)
    expected_role: UserRole


class UserResponse(BaseModel):
    id: str
    organization_name: str
    contact_name: str
    email: str
    phone: str
    address: str
    role: UserRole
    is_active: bool
    created_at: datetime
    provider_type: Optional[ProviderType] = None
    estimated_daily_meal_demand: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
