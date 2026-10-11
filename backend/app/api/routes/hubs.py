from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from pymongo import DESCENDING

from app.api.deps import get_db, require_role
from app.models.user import UserRole
from app.models.vehicle import VehicleResponse
from app.models.ngo_order import NgoOrderResponse, DeliveryHistoryItem
from app.schemas.auth import HubLocationUpdateRequest, UserResponse
from app.services.auth_service import serialize_user_doc
from app.services.geocoding_service import GeocodingService
from app.services.vehicle_service import VehicleService
from app.services.trip2_service import Trip2Service

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


@router.get(
    "/orders",
    response_model=List[NgoOrderResponse],
    summary="List only incoming/active NGO orders assigned to this Hub",
)
def list_hub_ngo_orders(
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    hub_candidates = Trip2Service.get_hub_candidates(current_user.id)
    # Only return incoming and in-transit orders (delivered orders are moved to history)
    docs = list(
        db.ngo_orders.find({
            "hub_id": {"$in": hub_candidates},
            "status": {"$in": ["CONFIRMED", "IN_TRANSIT"]},
        }).sort("created_at", DESCENDING)
    )
    return [Trip2Service.serialize_order_doc(d) for d in docs]


@router.get(
    "/orders/active",
    response_model=Optional[NgoOrderResponse],
    summary="Get active incoming NGO dispatch order for this Hub",
)
def get_active_hub_ngo_order(
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    hub_candidates = Trip2Service.get_hub_candidates(current_user.id)
    doc = db.ngo_orders.find_one(
        {"hub_id": {"$in": hub_candidates}, "status": {"$in": ["CONFIRMED", "IN_TRANSIT"]}},
        sort=[("created_at", DESCENDING)],
    )
    if not doc:
        return None
    return Trip2Service.serialize_order_doc(doc)


@router.post(
    "/orders/{order_id}/start",
    response_model=NgoOrderResponse,
    summary="Start delivery transit simulation from Hub to NGO",
)
def start_hub_ngo_delivery(
    order_id: str,
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    query = {"_id": ObjectId(order_id)} if ObjectId.is_valid(order_id) else {"_id": order_id}
    order = db.ngo_orders.find_one(query)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

    db.ngo_orders.update_one(
        query,
        {
            "$set": {
                "status": "IN_TRANSIT",
                "simulation_status": "IN_PROGRESS",
                "dispatched_at": datetime.now(timezone.utc),
            }
        },
    )
    updated = db.ngo_orders.find_one(query)
    return Trip2Service.serialize_order_doc(updated)


@router.post(
    "/orders/{order_id}/complete",
    response_model=NgoOrderResponse,
    summary="Mark NGO delivery completed, release vehicle, remove inventory, and archive to history",
)
def complete_hub_ngo_delivery(
    order_id: str,
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    try:
        final_doc = Trip2Service.complete_delivery_and_archive(db, order_id)
        return Trip2Service.serialize_order_doc(final_doc)
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get(
    "/history",
    response_model=List[DeliveryHistoryItem],
    summary="List all past NGO deliveries dispatched by this Hub from history collection",
)
def get_hub_delivery_history(
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    hub_candidates = Trip2Service.get_hub_candidates(current_user.id)
    docs = list(
        db.history.find({"hub_id": {"$in": hub_candidates}}).sort("delivered_at", DESCENDING)
    )
    results = []
    for d in docs:
        results.append(
            DeliveryHistoryItem(
                id=str(d["_id"]),
                order_id=str(d.get("order_id", "")),
                order_number=d.get("order_number", "ORD-HIST"),
                hub_id=str(d.get("hub_id", "")),
                hub_name=d.get("hub_name", "Central Hub"),
                hub_address=d.get("hub_address", ""),
                ngo_id=str(d.get("ngo_id", "")),
                ngo_name=d.get("ngo_name", "Partner NGO"),
                ngo_address=d.get("ngo_address", ""),
                total_people_served=int(d.get("total_people_served", 0)),
                vehicle_type=d.get("vehicle_type", "Standard Van"),
                packages=d.get("packages", []),
                delivered_at=d.get("delivered_at") or datetime.now(timezone.utc),
                created_at=d.get("created_at") or datetime.now(timezone.utc),
            )
        )
    return results

