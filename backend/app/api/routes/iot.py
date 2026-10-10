from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import require_role
from app.models.user import UserRole
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/iot", tags=["IoT Monitoring (Team Member 3)"])


@router.get("/telemetry", summary="Placeholder: IoT sensor telemetry")
def get_iot_telemetry(
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
):
    """
    Placeholder endpoint for Team Member 3.
    Ingestion, storage, and real-time monitoring of hub storage IoT sensors (temp, humidity, gas).
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "module": "iot",
            "message": "IoT telemetry streaming and sensor ingestion are under active development.",
            "owner": "Team Member 3",
        },
    )
