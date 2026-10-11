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


@router.get(
    "/track/{donation_id}",
    summary="Track a specific donation status, hub assignment, and selective road simulation geometry",
)
def track_donation(
    donation_id: str,
    db: Database = Depends(get_db),
):
    """
    Open-access tracking endpoint for Food Providers.
    Returns:
    - Donation batch metadata and current lifecycle status
    - Assigned Central Hub details and coordinates
    - Vehicle information (if scheduled/dispatched)
    - SELECTIVE road geometry: Strictly starting at Hub and terminating at this specific
      restaurant stop. Subsequent restaurant stops and return to hub are never exposed.
    """
    query = {"_id": ObjectId(donation_id)} if ObjectId.is_valid(donation_id) else {"_id": donation_id}
    donation_doc = db.incoming_donations.find_one(query)
    if not donation_doc:
        donation_doc = db.inventory.find_one(query)
    if not donation_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Donation record not found. Please verify the donation ID.",
        )

    # 1. Resolve Assigned Hub
    hub_id = str(donation_doc.get("hubId") or donation_doc.get("hub_id") or "")
    hub_doc = None
    if hub_id:
        hub_query = {"_id": ObjectId(hub_id)} if ObjectId.is_valid(hub_id) else {"_id": hub_id}
        hub_doc = db.users.find_one(hub_query)

    hub_info = {
        "id": hub_id or "default_hub",
        "organization_name": (hub_doc.get("organization_name") if hub_doc else None) or "Central Distribution Hub",
        "contact_name": (hub_doc.get("contact_name") if hub_doc else None) or "Central Hub Admin",
        "address": (hub_doc.get("address") if hub_doc else None) or "Central Logistics Depot, Coimbatore",
        "coordinates": (
            hub_doc.get("location", {}).get("coordinates")
            if hub_doc and hub_doc.get("location")
            else [76.9558, 11.0168]
        ),
    }

    # 2. Check linked pickup run
    pickup_run_id = str(donation_doc.get("pickupRunId") or donation_doc.get("pickup_run_id") or "")
    pickup_run = None
    if pickup_run_id:
        pr_query = {"_id": ObjectId(pickup_run_id)} if ObjectId.is_valid(pickup_run_id) else {"_id": pickup_run_id}
        pickup_run = db.pickup_runs.find_one(pr_query)

    if not pickup_run:
        # Check if any active run contains this donation ID
        pickup_run = db.pickup_runs.find_one({
            "donation_ids": {"$in": [str(donation_doc["_id"]), donation_id]},
            "simulation_status": {"$in": ["NOT_STARTED", "IN_PROGRESS", "PAUSED", "COMPLETED"]},
        })

    # 3. Locate target stop & compute selective road geometry
    pickup_run_info = None
    if pickup_run:
        ordered_stops = pickup_run.get("ordered_stops", [])
        total_stops = len(ordered_stops)
        target_stop = None
        target_stop_idx = 1

        # Match stop by donation ID
        for s in ordered_stops:
            s_dids = [str(did) for did in s.get("donation_ids", [])]
            if str(donation_doc["_id"]) in s_dids or donation_id in s_dids:
                target_stop = s
                target_stop_idx = s.get("stop_index", 1)
                break

        # Fallback match by provider name
        if not target_stop:
            p_name = donation_doc.get("providerName") or donation_doc.get("provider_name")
            for s in ordered_stops:
                if s.get("provider_name") == p_name:
                    target_stop = s
                    target_stop_idx = s.get("stop_index", 1)
                    break

        # Fallback to first stop if still unmatched
        if not target_stop and ordered_stops:
            target_stop = ordered_stops[0]
            target_stop_idx = 1

        # Extract strictly the sub-route from Hub to target_stop
        full_coords = pickup_run.get("route_geometry", {}).get("coordinates", [])
        sliced_coords: List[List[float]] = []

        if full_coords and target_stop:
            target_coords = target_stop.get("coordinates")
            if target_coords and len(target_coords) == 2:
                # Sequence stops in visit order up to target_stop_idx
                stops_in_order = sorted(
                    [s for s in ordered_stops if s.get("stop_index", 1) <= target_stop_idx],
                    key=lambda s: s.get("stop_index", 1),
                )
                curr_best_idx = 0
                for s in stops_in_order:
                    sc = s.get("coordinates")
                    if sc and len(sc) == 2:
                        min_d = float("inf")
                        best_i = curr_best_idx
                        for i in range(curr_best_idx, len(full_coords)):
                            pt = full_coords[i]
                            d = (pt[0] - sc[0]) ** 2 + (pt[1] - sc[1]) ** 2
                            if d < min_d:
                                min_d = d
                                best_i = i
                        curr_best_idx = best_i

                # Strictly slice up to target stop index
                sliced_coords = [list(c) for c in full_coords[: curr_best_idx + 1]]
                target_lon, target_lat = float(target_coords[0]), float(target_coords[1])
                if not sliced_coords or sliced_coords[-1] != [target_lon, target_lat]:
                    sliced_coords.append([target_lon, target_lat])

        # Fallback street grid routing if slice has < 2 points
        if (not sliced_coords or len(sliced_coords) < 2) and target_stop:
            hub_coord = hub_info["coordinates"]
            rest_coord = target_stop.get("coordinates")
            if hub_coord and rest_coord:
                from app.services.routing_service import RoutingService
                gen_coords, _, _ = RoutingService._generate_direct_street_path(
                    (float(hub_coord[0]), float(hub_coord[1])),
                    (float(rest_coord[0]), float(rest_coord[1]))
                )
                sliced_coords = gen_coords

        # Compute leg distance and duration
        from app.services.geocoding_service import calculate_haversine_distance
        leg_dist_m = 0.0
        for i in range(len(sliced_coords) - 1):
            p1 = sliced_coords[i]
            p2 = sliced_coords[i + 1]
            leg_dist_m += calculate_haversine_distance(p1[1], p1[0], p2[1], p2[0]) * 1000.0
        leg_dur_s = leg_dist_m / 8.33

        vehicle = pickup_run.get("assigned_vehicle", {})
        pickup_run_info = {
            "id": str(pickup_run["_id"]),
            "simulation_status": pickup_run.get("simulation_status", "NOT_STARTED"),
            "assigned_vehicle": {
                "id": str(vehicle.get("id", "")),
                "type": vehicle.get("type", "Electric Cargo Van"),
                "capacity": int(vehicle.get("capacity", 40)),
            },
            "stop_index": target_stop_idx,
            "total_stops": total_stops,
            "stop_status": target_stop.get("status", "PENDING") if target_stop else "PENDING",
            "started_at": pickup_run.get("started_at"),
            "completed_at": pickup_run.get("completed_at"),
            "route_geometry": {
                "type": "LineString",
                "coordinates": sliced_coords,
            },
            "distance_meters": round(leg_dist_m, 1),
            "duration_seconds": round(leg_dur_s, 1),
        }

    return {
        "donation": serialize_donation_doc(donation_doc, db=db),
        "hub": hub_info,
        "has_pickup_run": pickup_run is not None,
        "pickup_run": pickup_run_info,
    }


@router.post(
    "/track/{donation_id}/request-dispatch",
    summary="Trigger immediate pickup run planning for this donation (Manual dispatch trigger)",
)
def request_donation_dispatch(
    donation_id: str,
    db: Database = Depends(get_db),
):
    """
    Allows open-access providers to trigger pickup planning if not already scheduled.
    """
    query = {"_id": ObjectId(donation_id)} if ObjectId.is_valid(donation_id) else {"_id": donation_id}
    donation_doc = db.incoming_donations.find_one(query)
    if not donation_doc:
        raise HTTPException(status_code=404, detail="Donation record not found")

    hub_id = str(donation_doc.get("hubId") or donation_doc.get("hub_id") or "")
    if not hub_id:
        hub = db.users.find_one({"role": "hub", "is_active": True})
        if hub:
            hub_id = str(hub["_id"])

    if not hub_id:
        raise HTTPException(status_code=400, detail="Central Hub not configured")

    # If already linked to a run, do not plan again
    if not donation_doc.get("pickupRunId"):
        try:
            from app.api.routes.trips import execute_pickup_planning
            execute_pickup_planning(db=db, hub_id=hub_id, force=True)
        except Exception as exc:
            logger.info("Dispatch trigger notice: %s", exc)

    return track_donation(donation_id=donation_id, db=db)


@router.post(
    "/track/{donation_id}/start-simulation",
    summary="Start simulation of vehicle transit towards this restaurant",
)
def start_donation_simulation(
    donation_id: str,
    db: Database = Depends(get_db),
):
    """
    Synchronizes simulation start status with the Hub run.
    """
    tracking = track_donation(donation_id=donation_id, db=db)
    pickup_run = tracking.get("pickup_run")
    if not pickup_run or not pickup_run.get("id"):
        raise HTTPException(status_code=400, detail="Pickup run has not been planned yet")

    run_id = pickup_run["id"]
    query = {"_id": ObjectId(run_id)} if ObjectId.is_valid(run_id) else {"_id": run_id}
    now = datetime.now(timezone.utc)
    from pymongo import ReturnDocument
    db.pickup_runs.find_one_and_update(
        query,
        {"$set": {"simulation_status": "IN_PROGRESS", "started_at": now}},
        return_document=ReturnDocument.AFTER,
    )

    return track_donation(donation_id=donation_id, db=db)


@router.post(
    "/track/{donation_id}/complete-stop",
    summary="Mark vehicle arrival and collection at this restaurant",
)
def complete_donation_stop(
    donation_id: str,
    db: Database = Depends(get_db),
):
    """
    Marks this specific stop and donation as PICKED_UP when the vehicle arrives.
    """
    tracking = track_donation(donation_id=donation_id, db=db)
    pickup_run = tracking.get("pickup_run")
    if not pickup_run or not pickup_run.get("id"):
        raise HTTPException(status_code=400, detail="No active pickup run")

    run_id = pickup_run["id"]
    stop_idx = pickup_run.get("stop_index", 1)
    query = {"_id": ObjectId(run_id)} if ObjectId.is_valid(run_id) else {"_id": run_id}
    run = db.pickup_runs.find_one(query)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    stops = run.get("ordered_stops", [])
    for s in stops:
        if s.get("stop_index") == stop_idx:
            s["status"] = "PICKED_UP"
            s["picked_up_at"] = datetime.now(timezone.utc)
            break

    now = datetime.now(timezone.utc)
    d_query = {"_id": ObjectId(donation_id)} if ObjectId.is_valid(donation_id) else {"_id": donation_id}
    db.incoming_donations.update_one(
        d_query,
        {"$set": {"status": DonationStatus.ARRIVED_AT_HUB.value, "picked_up_at": now, "received_at_hub_at": now, "updatedAt": now}},
    )

    db.pickup_runs.update_one(
        query,
        {"$set": {"ordered_stops": stops, "current_stop_index": stop_idx}},
    )

    return track_donation(donation_id=donation_id, db=db)
