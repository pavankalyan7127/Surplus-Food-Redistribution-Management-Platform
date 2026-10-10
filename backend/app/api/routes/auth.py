from fastapi import APIRouter, Depends, status
from pymongo.database import Database

from app.api.deps import get_current_user, get_db
from app.schemas.auth import (
    HubSignupRequest,
    LoginRequest,
    NgoSignupRequest,
    ProviderSignupRequest,
    TokenResponse,
    UserResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/signup/provider",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new food provider",
)
def signup_provider(
    payload: ProviderSignupRequest,
    db: Database = Depends(get_db),
):
    return AuthService.register_provider(db=db, payload=payload)


@router.post(
    "/signup/ngo",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new NGO",
)
def signup_ngo(
    payload: NgoSignupRequest,
    db: Database = Depends(get_db),
):
    return AuthService.register_ngo(db=db, payload=payload)


@router.post(
    "/signup/hub",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new central hub with automatic geocoding",
)
def signup_hub(
    payload: HubSignupRequest,
    db: Database = Depends(get_db),
):
    return AuthService.register_hub(db=db, payload=payload)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate user and return JWT token",
)
def login(
    payload: LoginRequest,
    db: Database = Depends(get_db),
):
    return AuthService.authenticate(
        db=db,
        email=payload.email,
        password=payload.password,
        expected_role=payload.expected_role,
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user profile",
)
def get_me(current_user: UserResponse = Depends(get_current_user)):
    return current_user


@router.get(
    "/geocode",
    summary="Geocode physical address to coordinates preview",
)
def geocode_preview(address: str):
    from app.services.geocoding_service import GeocodingService
    coords = GeocodingService.geocode_address(address)
    if not coords:
        return {"found": False, "address": address, "latitude": None, "longitude": None}
    return {
        "found": True,
        "address": address,
        "latitude": coords[0],
        "longitude": coords[1],
    }
