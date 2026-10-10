from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/trips", tags=["Trips & Logistics (Team Members 1 & 2)"])


@router.get("", summary="Placeholder: List trips")
def list_trips(current_user: UserResponse = Depends(get_current_user)):
    """
    Placeholder endpoint for Team Members 1 & 2.
    Trip Type 1: Provider -> Hub (Collection)
    Trip Type 2: Hub -> NGO (Distribution)
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "module": "trips",
            "message": "Trip tracking and routing modules are under development.",
            "workflow": ["Trip Type 1: Provider -> Hub", "Trip Type 2: Hub -> NGO"],
            "owners": ["Team Member 1", "Team Member 2"],
        },
    )
