from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/donations", tags=["Donations & Collections (Team Member 1)"])


@router.get("", summary="Placeholder: List surplus food donations")
def list_donations(current_user: UserResponse = Depends(get_current_user)):
    """
    Placeholder endpoint for Team Member 1.
    Handles surplus food posting and donation clustering (Restaurant -> Hub).
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "module": "donations",
            "message": "Donation management is currently under active development for Trip Type 1 (Provider -> Hub).",
            "owner": "Team Member 1",
        },
    )


@router.post("", summary="Placeholder: Post surplus food donation")
def create_donation(current_user: UserResponse = Depends(get_current_user)):
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "module": "donations",
            "message": "Posting surplus food is currently under active development.",
            "owner": "Team Member 1",
        },
    )
