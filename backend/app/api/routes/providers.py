from fastapi import APIRouter, Depends
from app.api.deps import require_role
from app.models.user import UserRole
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/providers", tags=["Providers"])


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current food provider profile",
)
def get_provider_profile(
    current_user: UserResponse = Depends(require_role(UserRole.PROVIDER)),
):
    return current_user
