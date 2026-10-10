from fastapi import APIRouter, Depends
from app.api.deps import require_role
from app.models.user import UserRole
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/ngos", tags=["NGOs"])


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current NGO profile",
)
def get_ngo_profile(
    current_user: UserResponse = Depends(require_role(UserRole.NGO)),
):
    return current_user
