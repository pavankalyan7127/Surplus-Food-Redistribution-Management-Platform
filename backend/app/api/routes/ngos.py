import logging
from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from pymongo import DESCENDING

from app.api.deps import get_db, require_role
from app.models.user import UserRole
from app.schemas.auth import UserResponse
from app.models.ngo_order import (
    FoodRequestCheckPayload,
    FoodRequestCheckResponse,
    CreateNgoOrderPayload,
    NgoOrderResponse,
    DeliveryHistoryItem,
)
from app.services.geocoding_service import calculate_haversine_distance
from app.services.trip2_service import Trip2Service

logger = logging.getLogger("app.routes.ngos")
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


@router.get(
    "/hubs",
    summary="List all Central Hubs with live available inventory portions and distance",
)
def list_hubs_for_ngo(
    current_user: UserResponse = Depends(require_role(UserRole.NGO)),
    db: Database = Depends(get_db),
):
    """
    Returns active Central Hubs sorted by distance from the calling NGO,
    including current available inventory portions and package count.
    """
    # Fetch current NGO's coordinates
    ngo_user = db.users.find_one({"_id": ObjectId(current_user.id) if ObjectId.is_valid(current_user.id) else current_user.id})
    ngo_coords = None
    if ngo_user and ngo_user.get("location"):
        coords = ngo_user["location"].get("coordinates")
        if coords and len(coords) == 2:
            ngo_coords = (float(coords[1]), float(coords[0]))  # (lat, lon)

    # Fetch all active hubs
    hub_docs = list(db.users.find({"role": "hub", "is_active": True}))
    if not hub_docs:
        # Check without is_active in case hubs are just role=hub
        hub_docs = list(db.users.find({"role": "hub"}))

    hubs_result = []
    for hub in hub_docs:
        hub_id_str = str(hub["_id"])
        hub_candidates = Trip2Service.get_hub_candidates(hub_id_str)

        # Count available portions in inventory
        inv_items = list(
            db.inventory.find({
                "hub_id": {"$in": hub_candidates},
                "status": "AT_INVENTORY",
            })
        )
        available_portions = sum(int(item.get("people_served", 0)) for item in inv_items)
        package_count = len(inv_items)

        # Extract coordinates [lon, lat]
        hub_lon = None
        hub_lat = None
        dist_km = None
        if hub.get("location") and isinstance(hub["location"], dict):
            coords = hub["location"].get("coordinates")
            if coords and len(coords) == 2:
                hub_lon = float(coords[0])
                hub_lat = float(coords[1])
                if ngo_coords:
                    dist_km = round(
                        calculate_haversine_distance(ngo_coords[0], ngo_coords[1], hub_lat, hub_lon),
                        2,
                    )

        # Proximity filter: only consider hubs within a 12 km radius as nearest hubs
        MAX_NEARBY_HUB_RADIUS_KM = 12.0
        if dist_km is not None and dist_km > MAX_NEARBY_HUB_RADIUS_KM:
            continue

        hubs_result.append({
            "id": hub_id_str,
            "organization_name": hub.get("organization_name", "Central Logistics Hub"),
            "address": hub.get("address", "Central Hub Location"),
            "phone_number": hub.get("phone_number", ""),
            "email": hub.get("email", ""),
            "latitude": hub_lat,
            "longitude": hub_lon,
            "distance_km": dist_km,
            "available_portions": available_portions,
            "package_count": package_count,
        })

    # Sort hubs by distance ascending (nearest first; None distance at end)
    hubs_result.sort(key=lambda h: (h["distance_km"] is None, h["distance_km"] or 0))
    return hubs_result


@router.post(
    "/request-check",
    response_model=FoodRequestCheckResponse,
    summary="Evaluate stock and 20% grace limit for requested food count",
)
def check_food_request(
    payload: FoodRequestCheckPayload,
    current_user: UserResponse = Depends(require_role(UserRole.NGO)),
    db: Database = Depends(get_db),
):
    try:
        return Trip2Service.evaluate_inventory_for_ngo(
            db=db,
            hub_id=payload.hub_id,
            requested_portions=payload.requested_portions,
        )
    except Exception as exc:
        logger.error("Error evaluating food request: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check hub stock: {str(exc)}",
        )


@router.post(
    "/orders",
    response_model=NgoOrderResponse,
    summary="Confirm and dispatch food delivery order from Hub to NGO",
)
def create_ngo_order(
    payload: CreateNgoOrderPayload,
    current_user: UserResponse = Depends(require_role(UserRole.NGO)),
    db: Database = Depends(get_db),
):
    ngo_user = db.users.find_one({"_id": ObjectId(current_user.id) if ObjectId.is_valid(current_user.id) else current_user.id})
    if not ngo_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NGO account not found.")

    try:
        order_doc = Trip2Service.create_and_dispatch_order(
            db=db,
            ngo_user=ngo_user,
            hub_id=payload.hub_id,
            requested_portions=payload.requested_portions,
            confirmed_portions=payload.confirmed_portions,
            package_ids=payload.package_ids,
        )
        return Trip2Service.serialize_order_doc(order_doc)
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))
    except Exception as exc:
        logger.error("Error creating NGO order: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Order creation failed: {str(exc)}",
        )


@router.get(
    "/orders/active",
    response_model=Optional[NgoOrderResponse],
    summary="Get active incoming dispatch order for the current NGO",
)
def get_active_ngo_order(
    current_user: UserResponse = Depends(require_role(UserRole.NGO)),
    db: Database = Depends(get_db),
):
    # Only return orders currently in-transit or confirmed (delivered orders are moved to history)
    order_doc = db.ngo_orders.find_one(
        {"ngo_id": str(current_user.id), "status": {"$in": ["CONFIRMED", "IN_TRANSIT"]}},
        sort=[("created_at", DESCENDING)],
    )

    if not order_doc:
        return None

    return Trip2Service.serialize_order_doc(order_doc)


@router.post(
    "/orders/{order_id}/start",
    response_model=NgoOrderResponse,
    summary="Start dispatch simulation for an NGO order",
)
def start_ngo_order_simulation(
    order_id: str,
    current_user: UserResponse = Depends(require_role(UserRole.NGO)),
    db: Database = Depends(get_db),
):
    query = {"_id": ObjectId(order_id)} if ObjectId.is_valid(order_id) else {"_id": order_id}
    order = db.ngo_orders.find_one(query)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

    db.ngo_orders.update_one(
        query,
        {"$set": {"status": "IN_TRANSIT", "simulation_status": "IN_PROGRESS"}}
    )
    updated = db.ngo_orders.find_one(query)
    return Trip2Service.serialize_order_doc(updated)


@router.post(
    "/orders/{order_id}/complete",
    response_model=NgoOrderResponse,
    summary="Complete delivery and archive packages to history",
)
def complete_ngo_order(
    order_id: str,
    current_user: UserResponse = Depends(require_role(UserRole.NGO)),
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
    summary="List all past food deliveries received by this NGO from history collection",
)
def get_ngo_delivery_history(
    current_user: UserResponse = Depends(require_role(UserRole.NGO)),
    db: Database = Depends(get_db),
):
    ngo_candidates = [str(current_user.id)]
    if ObjectId.is_valid(current_user.id):
        ngo_candidates.append(ObjectId(current_user.id))

    docs = list(
        db.history.find({"ngo_id": {"$in": ngo_candidates}}).sort("delivered_at", DESCENDING)
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

