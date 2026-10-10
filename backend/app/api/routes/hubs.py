from fastapi import APIRouter, Depends
from app.api.deps import require_role
from app.models.user import UserRole
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/hubs", tags=["Hubs"])


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current hub admin profile",
)
def get_hub_profile(
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
):
    return current_user
