from fastapi import APIRouter, HTTPException, status
from app.core.config import settings
from app.db.mongodb import MongoDB

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("", summary="Application health check")
def health_check():
    return {
        "status": "ok",
        "service": "Surplus Food Redistribution API",
        "version": "1.0.0"
    }


@router.get("/db", summary="Database connectivity health check")
def db_health_check():
    is_connected = MongoDB.ping()
    if not is_connected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "unhealthy",
                "database": settings.MONGODB_DATABASE,
                "error": "Cannot reach MongoDB server"
            }
        )
    return {
        "status": "healthy",
        "database": settings.MONGODB_DATABASE,
        "connected": True
    }
