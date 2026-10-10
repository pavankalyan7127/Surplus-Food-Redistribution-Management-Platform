from datetime import datetime, timezone
from typing import List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database

from app.api.deps import get_db, require_role
from app.models.user import UserRole
from app.models.vehicle import VehicleResponse
from app.schemas.auth import HubLocationUpdateRequest, UserResponse
from app.services.auth_service import serialize_user_doc
from app.services.geocoding_service import GeocodingService
from app.services.vehicle_service import VehicleService

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


@router.put(
    "/location",
    response_model=dict,
    summary="Update hub address and geographical coordinates",
)
def update_hub_location(
    payload: HubLocationUpdateRequest,
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    """
    Configure or update hub physical address and coordinates.
    Validates coordinates or resolves address via geocoding.
    Automatically recalculates nearestHubId for registered food providers.
    """
    lat = payload.latitude
    lon = payload.longitude

    if lat is None or lon is None:
        geocoded = GeocodingService.geocode_address(payload.address)
        if not geocoded:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Address could not be automatically geocoded. Please provide valid latitude and longitude.",
            )
        lat, lon = geocoded

    if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Coordinates out of valid range (latitude between -90 and 90, longitude between -180 and 180).",
        )

    # GeoJSON coordinates format is [longitude, latitude]
    location_doc = {
        "type": "Point",
        "coordinates": [float(lon), float(lat)],
    }

    query = {"_id": ObjectId(current_user.id)} if ObjectId.is_valid(current_user.id) else {"_id": current_user.id}
    db.users.update_one(
        query,
        {
            "$set": {
                "address": payload.address.strip(),
                "location": location_doc,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    # Automatically recalculate provider assignments
    providers_recalculated = GeocodingService.recalculate_all_provider_hubs(db)

    updated_hub = db.users.find_one(query)

    return {
        "message": "Hub location updated successfully",
        "hub": serialize_user_doc(updated_hub, db=db),
        "providers_recalculated": providers_recalculated,
    }


@router.get(
    "/vehicles",
    response_model=List[VehicleResponse],
    summary="List vehicle fleet for the current hub",
)
def list_hub_vehicles(
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    docs = VehicleService.get_hub_vehicles(db, current_user.id)
    results = []
    for d in docs:
        results.append(
            VehicleResponse(
                id=str(d["_id"]),
                owned_by_hub_ID=str(d.get("owned_by_hub_ID")),
                type=d.get("type"),
                capacity=int(d.get("capacity", 0)),
                isFree=bool(d.get("isFree", True)),
                created_at=d.get("created_at") or datetime.now(timezone.utc),
                updated_at=d.get("updated_at") or datetime.now(timezone.utc),
            )
        )
    return results


@router.post(
    "/vehicles/seed",
    response_model=List[VehicleResponse],
    summary="Seed default vehicles for this hub if empty",
)
def seed_hub_vehicles(
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    docs = VehicleService.ensure_hub_vehicles(db, current_user.id)
    results = []
    for d in docs:
        results.append(
            VehicleResponse(
                id=str(d["_id"]),
                owned_by_hub_ID=str(d.get("owned_by_hub_ID")),
                type=d.get("type"),
                capacity=int(d.get("capacity", 0)),
                isFree=bool(d.get("isFree", True)),
                created_at=d.get("created_at") or datetime.now(timezone.utc),
                updated_at=d.get("updated_at") or datetime.now(timezone.utc),
            )
        )
    return results
