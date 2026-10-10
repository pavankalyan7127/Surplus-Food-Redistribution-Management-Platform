from fastapi import APIRouter, Depends, status
from pymongo.database import Database

from app.api.deps import get_current_user, get_db
from app.schemas.auth import (
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
