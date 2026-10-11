from datetime import datetime, timedelta, timezone
from typing import List, Optional
import logging
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import DESCENDING
from pymongo.database import Database

logger = logging.getLogger("app.api.donations")

from app.api.deps import get_current_user, get_db, require_role
from app.core.config import settings
from app.models.donation import (
    DonationStatus,
    FoodCategory,
    IncomingDonationCreate,
    IncomingDonationResponse,
)
from app.models.user import UserRole
from app.schemas.auth import UserResponse
from app.services.geocoding_service import GeocodingService

router = APIRouter(prefix="/donations", tags=["Donations & Collections (Trip Type 1)"])


def calculate_safety_deadline(prep_time: datetime, category: FoodCategory) -> datetime:
    """Configurable food-safety window based on food category and preparation time."""
    # Ensure timezone aware
    if prep_time.tzinfo is None:
        prep_time = prep_time.replace(tzinfo=timezone.utc)

    # Holding policy: Cooked meals: 6 hours; Dairy: 4 hours; Bakery: 24 hours; Produce: 36 hours; Default: settings.FOOD_SAFETY_MAX_HOURS
    hours_map = {
        FoodCategory.COOKED_MEALS: 6,
        FoodCategory.DAIRY: 4,
        FoodCategory.BAKERY: 24,
        FoodCategory.PRODUCE: 36,
        FoodCategory.PACKAGED: 72,
        FoodCategory.BEVERAGES: 12,
        FoodCategory.OTHER: settings.FOOD_SAFETY_MAX_HOURS,
    }
    allowed_hours = hours_map.get(category, settings.FOOD_SAFETY_MAX_HOURS)
    return prep_time + timedelta(hours=allowed_hours)


def serialize_donation_doc(doc: dict, db: Optional[Database] = None) -> IncomingDonationResponse:
    provider_id = str(doc.get("providerId") or doc.get("provider_id") or "") or None
    hub_id = str(doc.get("hubId") or doc.get("hub_id") or "") or None

    provider_name = doc.get("providerName") or doc.get("provider_name")
    provider_type = doc.get("providerType") or doc.get("provider_type")
    pickup_address = doc.get("pickupAddress") or doc.get("pickup_address") or doc.get("address")
    provider_coords = None
    loc = doc.get("pickupLocation") or doc.get("pickup_location")
    if loc and isinstance(loc, dict) and loc.get("type") == "Point":
        provider_coords = loc.get("coordinates")
    elif doc.get("provider_coordinates"):
        provider_coords = doc.get("provider_coordinates")
    elif doc.get("longitude") is not None and doc.get("latitude") is not None:
        provider_coords = [float(doc["longitude"]), float(doc["latitude"])]

    # Fallback to users collection if legacy document
    if (not provider_name or not provider_coords) and db is not None and provider_id:
        try:
            p_query = {"_id": ObjectId(provider_id)} if ObjectId.is_valid(provider_id) else {"_id": provider_id}
            p_doc = db.users.find_one(p_query)
            if p_doc:
                if not provider_name:
                    provider_name = p_doc.get("organization_name")
                if not provider_type:
                    provider_type = p_doc.get("provider_type")
                if not pickup_address:
                    pickup_address = p_doc.get("address")
                if not provider_coords:
                    u_loc = p_doc.get("location")
                    if u_loc and isinstance(u_loc, dict) and u_loc.get("type") == "Point":
                        provider_coords = u_loc.get("coordinates")
        except Exception:
            pass

    return IncomingDonationResponse(
        id=str(doc["_id"]),
        provider_id=provider_id,
        hub_id=hub_id,
        provider_name=provider_name or "Food Provider",
        provider_type=provider_type or "restaurant",
        provider_address=pickup_address,
        pickup_address=pickup_address,
        provider_coordinates=provider_coords,
        food_name=doc.get("foodName") or doc.get("food_name", ""),
        description=doc.get("description"),
        food_category=doc.get("foodCategory") or doc.get("food_category", "Cooked Meals"),
        dietary_type=doc.get("dietaryType") or doc.get("dietary_type", "Vegetarian"),
        preparation_date_time=doc.get("preparationDateTime") or doc.get("preparation_date_time") or datetime.now(timezone.utc),
        people_served=int(doc.get("peopleServed") or doc.get("people_served", 0)),
        storage_requirements=doc.get("storageRequirements") or doc.get("storage_requirements", "Room Temperature"),
        pickup_notes=doc.get("pickupNotes") or doc.get("pickup_notes"),
        status=DonationStatus(doc.get("status", DonationStatus.READY_FOR_PICKUP.value)),
        pickup_run_id=str(doc.get("pickupRunId") or doc.get("pickup_run_id") or "") or None,
        safety_deadline=doc.get("safetyDeadline") or doc.get("safety_deadline"),
        created_at=doc.get("createdAt") or doc.get("created_at") or datetime.now(timezone.utc),
        updated_at=doc.get("updated_at") or doc.get("updatedAt") or datetime.now(timezone.utc),
        picked_up_at=doc.get("picked_up_at"),
        received_at_hub_at=doc.get("received_at_hub_at"),
    )


@router.post(
    "",
    response_model=IncomingDonationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit surplus food donation (Food Provider - Open Access)",
)
def create_donation(
    payload: IncomingDonationCreate,
    db: Database = Depends(get_db),
):
    """
    Food provider submits a surplus donation directly without account signup or login.
    1. Geocodes pickup address to coordinates dynamically.
    2. Identifies nearest eligible Central Hub.
    3. Saves donation directly in incoming_donations (NO user record created in users collection).
    4. Automatically triggers pickup planning if cumulative portions exceed 20.
    """
    now = datetime.now(timezone.utc)

    # 1. Geocode pickup address dynamically
    address_str = payload.pickup_address.strip() if payload.pickup_address else "Gandhipuram, Coimbatore"
    geocoded = GeocodingService.geocode_address(address_str)
    if geocoded:
        lat, lon = geocoded
    else:
        logger.warning("Geocoding unresolvable for '%s', using regional Coimbatore reference coordinates", address_str)
        lat, lon = 11.0168, 76.9558

    # 2. Identify nearest central hub based on dynamically geocoded coordinates
    nearest_hub = GeocodingService.find_nearest_eligible_hub(db, float(lat), float(lon))
    if not nearest_hub:
        nearest_hub = db.users.find_one({"role": "hub", "is_active": True})

    if not nearest_hub:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No central hub with configured coordinates is currently available. Please contact support or await hub setup.",
        )

    hub_id = str(nearest_hub["_id"])

    # 3. Food safety deadline
    safety_deadline = calculate_safety_deadline(payload.preparation_date_time, payload.food_category)

    # 4. Construct incoming donation doc (saved directly in incoming_donations, NOT users)
    doc = {
        "providerName": payload.provider_name.strip() if payload.provider_name else "Food Provider",
        "provider_name": payload.provider_name.strip() if payload.provider_name else "Food Provider",
        "providerType": payload.provider_type.strip() if payload.provider_type else "restaurant",
        "provider_type": payload.provider_type.strip() if payload.provider_type else "restaurant",
        "pickupAddress": address_str,
        "pickup_address": address_str,
        "pickupLocation": {
            "type": "Point",
            "coordinates": [float(lon), float(lat)],
        },
        "provider_coordinates": [float(lon), float(lat)],
        "latitude": float(lat),
        "longitude": float(lon),
        "hubId": hub_id,
        "hub_id": hub_id,
        "providerId": None,
        "foodName": payload.food_name.strip(),
        "food_name": payload.food_name.strip(),
        "description": payload.description.strip() if payload.description else None,
        "foodCategory": payload.food_category.value,
        "food_category": payload.food_category.value,
        "dietaryType": payload.dietary_type.value,
        "dietary_type": payload.dietary_type.value,
        "preparationDateTime": payload.preparation_date_time,
        "preparation_date_time": payload.preparation_date_time,
        "peopleServed": payload.people_served,
        "people_served": payload.people_served,
        "storageRequirements": payload.storage_requirements.value,
        "storage_requirements": payload.storage_requirements.value,
        "pickupNotes": payload.pickup_notes.strip() if payload.pickup_notes else None,
        "status": DonationStatus.READY_FOR_PICKUP.value,
        "pickupRunId": None,
        "safetyDeadline": safety_deadline,
        "createdAt": now,
        "updatedAt": now,
        "picked_up_at": None,
        "received_at_hub_at": None,
    }

    res = db.incoming_donations.insert_one(doc)
    doc["_id"] = res.inserted_id

    # 5. Automatic Dispatch Trigger: If total people served > 20
    try:
        hub_id_candidates = [str(hub_id)]
        if ObjectId.is_valid(hub_id):
            hub_id_candidates.append(ObjectId(hub_id))

        eligible_docs = list(db.incoming_donations.find({
            "hubId": {"$in": hub_id_candidates},
            "status": DonationStatus.READY_FOR_PICKUP.value,
            "pickupRunId": None,
        }))
        total_people = sum(int(d.get("peopleServed", 0)) for d in eligible_docs)
        if total_people > 20:
            from app.api.routes.trips import execute_pickup_planning
            execute_pickup_planning(db=db, hub_id=str(hub_id), force=False)
    except Exception as exc:
        logger.warning("Auto-dispatch check notice: %s", exc)

    return serialize_donation_doc(doc, db=db)


@router.get(
    "",
    response_model=List[IncomingDonationResponse],
    summary="List donations for authenticated user",
)
def list_donations(
    current_user: UserResponse = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    if current_user.role == UserRole.PROVIDER:
        return get_provider_donations(db=db)
    elif current_user.role == UserRole.HUB:
        return get_hub_donations(status_filter=None, current_user=current_user, db=db)
    return []


@router.get(
    "/provider",
    response_model=List[IncomingDonationResponse],
    summary="Get all recent donations for provider portal",
)
def get_provider_donations(
    provider_name: Optional[str] = Query(None, description="Filter by restaurant/bakery name"),
    db: Database = Depends(get_db),
):
    query = {}
    if provider_name:
        query = {"$or": [{"providerName": provider_name}, {"provider_name": provider_name}]}
    incoming_docs = list(
        db.incoming_donations.find(query).sort("createdAt", DESCENDING).limit(30)
    )
    inv_docs = list(
        db.inventory.find(query).sort("created_at", DESCENDING).limit(30)
    )
    combined = [serialize_donation_doc(d, db=db) for d in incoming_docs]
    for inv in inv_docs:
        combined.append(serialize_donation_doc(inv, db=db))
    combined.sort(key=lambda x: x.created_at, reverse=True)
    return combined[:30]


def get_hub_id_query(hub_id: str):
    ids = [str(hub_id)]
    if ObjectId.is_valid(hub_id):
        ids.append(ObjectId(hub_id))
    return {"$in": ids}


@router.get(
    "/hub",
    response_model=List[IncomingDonationResponse],
    summary="Get all donations assigned to the authenticated hub",
)
def get_hub_donations(
    status_filter: Optional[str] = Query(None, description="Optional filter by status"),
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    query: dict = {"hubId": get_hub_id_query(current_user.id)}
    if status_filter:
        query["status"] = status_filter

    docs = list(db.incoming_donations.find(query).sort("createdAt", DESCENDING))
    return [serialize_donation_doc(d, db=db) for d in docs]


@router.get(
    "/hub/summary",
    summary="Get summary metrics for eligible incoming collections (Hub)",
)
def get_hub_donations_summary(
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    """
    Returns:
    - TOTAL PEOPLE THAT CAN BE SERVED (sum of peopleServed for eligible, unreserved pending donations)
    - Total pending donations
    - Number of distinct eligible restaurants
    - Auto-threshold trigger status (total_people_served > 20)
    - Active pickup run status
    """
    now = datetime.now(timezone.utc)
    # Eligible pending donations: READY_FOR_PICKUP and pickupRunId is None
    eligible_docs = list(
        db.incoming_donations.find({
            "hubId": get_hub_id_query(current_user.id),
            "status": DonationStatus.READY_FOR_PICKUP.value,
            "pickupRunId": None,
        })
    )

    total_people_served = sum(int(d.get("peopleServed", 0)) for d in eligible_docs)
    distinct_providers = {str(d.get("providerId")) for d in eligible_docs if d.get("providerId")}

    # Check active run for this hub
    active_run = db.pickup_runs.find_one({
        "hub_id": get_hub_id_query(current_user.id),
        "simulation_status": {"$in": ["NOT_STARTED", "IN_PROGRESS", "PAUSED"]},
    })

    return {
        "hub_id": current_user.id,
        "total_people_served": total_people_served,
        "pending_donations_count": len(eligible_docs),
        "eligible_restaurants_count": len(distinct_providers),
        "auto_threshold_met": total_people_served > 20,
        "has_active_run": active_run is not None,
        "active_run_id": str(active_run["_id"]) if active_run else None,
    }
