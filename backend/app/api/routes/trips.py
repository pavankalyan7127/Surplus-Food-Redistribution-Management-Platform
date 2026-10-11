import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from pymongo import ReturnDocument
from pymongo.database import Database

from app.api.deps import get_current_user, get_db, require_role
from app.models.donation import DonationStatus
from app.models.pickup_run import (
    AssignedVehicleInfo,
    OrderedStop,
    PickupRunResponse,
    SimulationStatus,
    StopStatus,
)
from app.models.user import UserRole
from app.schemas.auth import UserResponse
from app.services.routing_service import RoutingService
from app.services.vehicle_service import VehicleService

logger = logging.getLogger("app.api.routes.trips")

router = APIRouter(prefix="/trips", tags=["Trips & Logistics (Trip Type 1)"])


@router.get("", summary="List trips for user")
def list_trips(
    current_user: UserResponse = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    if current_user.role == UserRole.HUB:
        runs = list(db.pickup_runs.find({"hub_id": current_user.id}).sort("created_at", -1))
        return [serialize_pickup_run(r) for r in runs]
    return []


class PlanPickupRequest(BaseModel):
    force: bool = False


def serialize_pickup_run(doc: dict) -> PickupRunResponse:
    vehicle_dict = doc.get("assigned_vehicle", {})
    return PickupRunResponse(
        id=str(doc["_id"]),
        hub_id=str(doc.get("hub_id")),
        donation_ids=[str(d) for d in doc.get("donation_ids", [])],
        assigned_vehicle=AssignedVehicleInfo(
            id=str(vehicle_dict.get("id")),
            type=str(vehicle_dict.get("type")),
            capacity=int(vehicle_dict.get("capacity", 0)),
        ),
        total_people_served=int(doc.get("total_people_served", 0)),
        ordered_stops=[
            OrderedStop(
                stop_index=s.get("stop_index"),
                provider_id=str(s.get("provider_id")),
                provider_name=s.get("provider_name"),
                address=s.get("address"),
                coordinates=s.get("coordinates"),
                donation_ids=[str(did) for did in s.get("donation_ids", [])],
                people_served=int(s.get("people_served", 0)),
                status=StopStatus(s.get("status", StopStatus.PENDING.value)),
                picked_up_at=s.get("picked_up_at"),
            )
            for s in doc.get("ordered_stops", [])
        ],
        route_geometry=doc.get("route_geometry"),
        total_distance_meters=float(doc.get("total_distance_meters", 0.0)),
        total_duration_seconds=float(doc.get("total_duration_seconds", 0.0)),
        baseline_distance_meters=float(doc.get("baseline_distance_meters", 0.0)),
        optimized_distance_meters=float(doc.get("optimized_distance_meters", 0.0)),
        distance_saved_meters=float(doc.get("distance_saved_meters", 0.0)),
        percentage_saved=float(doc.get("percentage_saved", 0.0)),
        simulation_status=SimulationStatus(
            doc.get("simulation_status", SimulationStatus.NOT_STARTED.value)
        ),
        current_stop_index=int(doc.get("current_stop_index", 0)),
        created_at=doc.get("created_at") or datetime.now(timezone.utc),
        started_at=doc.get("started_at"),
        completed_at=doc.get("completed_at"),
    )


def execute_pickup_planning(db: Database, hub_id: str, force: bool = False) -> dict:
    """
    Core pickup planning logic:
    1. Check for existing active pickup runs for this hub.
    2. Check hub coordinates.
    3. Fetch eligible unreserved READY_FOR_PICKUP donations.
    4. Verify threshold (>20 people served, unless force=True).
    5. Assign smallest available vehicle.
    6. Run 2-Opt road TSP optimization and fetch OSRM road geometry.
    7. Persist run document and transition donations to RESERVED_FOR_PICKUP.
    """
    now = datetime.now(timezone.utc)
    hub_id_candidates = [str(hub_id)]
    if ObjectId.is_valid(hub_id):
        hub_id_candidates.append(ObjectId(hub_id))

    # 1. Concurrency / Duplicate check
    active_run = db.pickup_runs.find_one({
        "hub_id": {"$in": hub_id_candidates},
        "simulation_status": {"$in": ["NOT_STARTED", "IN_PROGRESS", "PAUSED"]},
    })
    if active_run:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An active pickup run is already in progress (ID: {active_run['_id']}). Please complete or cancel it before starting a new run.",
        )

    # 2. Check hub coordinates
    hub_doc = db.users.find_one({"_id": ObjectId(hub_id)} if ObjectId.is_valid(hub_id) else {"_id": hub_id})
    hub_loc = (hub_doc or {}).get("location")
    if not hub_loc or not isinstance(hub_loc, dict) or hub_loc.get("type") != "Point":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hub location coordinates have not been configured yet. Please configure the central hub location before initiating pickup runs.",
        )
    hub_coords = hub_loc.get("coordinates")  # [lon, lat]
    if not isinstance(hub_coords, (list, tuple)) or len(hub_coords) != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid hub coordinates in database.",
        )
    hub_lon, hub_lat = float(hub_coords[0]), float(hub_coords[1])

    # 3. Fetch eligible unreserved pending donations
    eligible_donations = list(
        db.incoming_donations.find({
            "hubId": {"$in": hub_id_candidates},
            "status": DonationStatus.READY_FOR_PICKUP.value,
            "pickupRunId": None,
        })
    )

    if not eligible_donations:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No eligible pending donations found for pickup.",
        )

    total_people_served = sum(int(d.get("peopleServed", 0)) for d in eligible_donations)

    # 4. Threshold check: > 20 unless force=True
    if not force and total_people_served <= 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Total people served ({total_people_served}) does not exceed the automatic pickup threshold of 20. Use 'FORCEFULLY START PICKUPS' to initiate manual collection.",
        )

    # 5. Vehicle assignment: smallest available sufficient vehicle
    reserved_vehicle = VehicleService.select_and_reserve_vehicle(
        db=db, hub_id=str(hub_id), total_people=total_people_served
    )
    if not reserved_vehicle:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vehicle capacity unavailable: No free vehicle belonging to this hub has sufficient capacity for {total_people_served} people served.",
        )

    try:
        # 6. Group donations by establishment/pickup location directly from incoming_donations collection
        provider_donations_map: Dict[str, List[dict]] = {}
        for d in eligible_donations:
            p_key = str(d.get("pickupAddress") or d.get("pickup_address") or d.get("providerName") or d.get("provider_name") or d.get("providerId") or d["_id"])
            provider_donations_map.setdefault(p_key, []).append(d)

        stops_input = []
        for p_key, d_list in provider_donations_map.items():
            first_d = d_list[0]
            # Directly fetch coordinates from donation document
            coords = None
            loc = first_d.get("pickupLocation") or first_d.get("pickup_location")
            if loc and isinstance(loc, dict) and loc.get("type") == "Point":
                coords = loc.get("coordinates")
            elif first_d.get("provider_coordinates"):
                coords = first_d.get("provider_coordinates")
            elif first_d.get("longitude") is not None and first_d.get("latitude") is not None:
                coords = [float(first_d["longitude"]), float(first_d["latitude"])]

            # Legacy fallback if coords not in donation
            if not coords and first_d.get("providerId"):
                pid = str(first_d["providerId"])
                p_doc = db.users.find_one({"_id": ObjectId(pid)} if ObjectId.is_valid(pid) else {"_id": pid})
                if p_doc and p_doc.get("location"):
                    coords = p_doc["location"].get("coordinates")

            if not coords or len(coords) < 2:
                # Fallback to regional coordinates
                coords = [76.9558, 11.0168]

            prov_name = first_d.get("providerName") or first_d.get("provider_name") or "Food Provider"
            prov_addr = first_d.get("pickupAddress") or first_d.get("pickup_address") or "Coimbatore"
            prov_id = str(first_d.get("providerId") or first_d.get("provider_id") or first_d["_id"])

            stops_input.append({
                "provider_id": prov_id,
                "provider_name": prov_name,
                "address": prov_addr,
                "coordinates": [float(coords[0]), float(coords[1])],
                "donation_ids": [str(d["_id"]) for d in d_list],
                "people_served": sum(int(d.get("peopleServed", 0)) for d in d_list),
            })

        # 7. Coordinates list: index 0 is Hub, indices 1..K are provider stops
        all_coords = [(hub_lon, hub_lat)] + [
            (s["coordinates"][0], s["coordinates"][1]) for s in stops_input
        ]

        # 8. Distance Matrix and 2-Opt TSP
        dist_matrix, dur_matrix = RoutingService.get_distance_matrix(all_coords)

        # Baseline: sequential round trip
        baseline_tour = list(range(len(all_coords)))
        baseline_distance = RoutingService.calculate_tour_distance(baseline_tour, dist_matrix)

        # Optimization: Nearest-neighbor initial tour + 2-opt improvement
        nn_tour = RoutingService.nearest_neighbor_tour(dist_matrix)
        optimized_tour = RoutingService.two_opt_optimize(nn_tour, dist_matrix)
        optimized_distance = RoutingService.calculate_tour_distance(optimized_tour, dist_matrix)

        if optimized_distance > baseline_distance:
            optimized_tour = baseline_tour
            optimized_distance = baseline_distance

        distance_saved = max(0.0, baseline_distance - optimized_distance)
        percentage_saved = (distance_saved / baseline_distance * 100.0) if baseline_distance > 0 else 0.0

        # 9. Ordered stops (skip index 0 which is hub)
        ordered_stops_list = []
        ordered_coords = [(hub_lon, hub_lat)]

        for stop_idx, node in enumerate(optimized_tour[1:], start=1):
            orig_stop = stops_input[node - 1]
            ordered_stops_list.append(
                OrderedStop(
                    stop_index=stop_idx,
                    provider_id=orig_stop["provider_id"],
                    provider_name=orig_stop["provider_name"],
                    address=orig_stop["address"],
                    coordinates=orig_stop["coordinates"],
                    donation_ids=orig_stop["donation_ids"],
                    people_served=orig_stop["people_served"],
                    status=StopStatus.PENDING,
                ).model_dump()
            )
            ordered_coords.append((orig_stop["coordinates"][0], orig_stop["coordinates"][1]))

        # Return to Hub
        ordered_coords.append((hub_lon, hub_lat))

        # 10. Road Geometry from OSRM
        route_geom, total_dist_m, total_dur_s = RoutingService.get_route_geometry(ordered_coords)

        all_donation_ids = [str(d["_id"]) for d in eligible_donations]

        # 11. Create pickup run document
        run_doc = {
            "hub_id": str(hub_id),
            "donation_ids": all_donation_ids,
            "assigned_vehicle": {
                "id": str(reserved_vehicle["_id"]),
                "type": reserved_vehicle["type"],
                "capacity": reserved_vehicle["capacity"],
            },
            "total_people_served": total_people_served,
            "ordered_stops": ordered_stops_list,
            "route_geometry": route_geom,
            "total_distance_meters": round(total_dist_m, 1),
            "total_duration_seconds": round(total_dur_s, 1),
            "baseline_distance_meters": round(baseline_distance, 1),
            "optimized_distance_meters": round(optimized_distance, 1),
            "distance_saved_meters": round(distance_saved, 1),
            "percentage_saved": round(percentage_saved, 2),
            "simulation_status": SimulationStatus.NOT_STARTED.value,
            "current_stop_index": 0,
            "created_at": now,
            "started_at": None,
            "completed_at": None,
        }

        res = db.pickup_runs.insert_one(run_doc)
        run_doc["_id"] = res.inserted_id

        # 12. Transition included donations to RESERVED_FOR_PICKUP
        db.incoming_donations.update_many(
            {"_id": {"$in": [d["_id"] for d in eligible_donations]}},
            {
                "$set": {
                    "status": DonationStatus.RESERVED_FOR_PICKUP.value,
                    "pickupRunId": str(run_doc["_id"]),
                    "updatedAt": now,
                }
            },
        )

        return run_doc

    except HTTPException:
        raise
    except Exception as exc:
        # Roll back vehicle reservation on failure
        VehicleService.release_vehicle(db, str(reserved_vehicle["_id"]))
        logger.error("Failed to plan pickup trip: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Route planning failed: {str(exc)}",
        )


@router.post(
    "/plan-pickup",
    response_model=PickupRunResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Plan multi-stop pickup run (Automated threshold >20 or Force override)",
)
def plan_pickup_trip(
    payload: PlanPickupRequest = PlanPickupRequest(),
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    """
    Endpoint for Hub to plan pickup route.
    """
    run_doc = execute_pickup_planning(db=db, hub_id=current_user.id, force=payload.force)
    return serialize_pickup_run(run_doc)


@router.get(
    "/active",
    summary="Get active pickup run for the authenticated hub",
)
def get_active_pickup_trip(
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    hub_candidates = [str(current_user.id)]
    if ObjectId.is_valid(current_user.id):
        hub_candidates.append(ObjectId(current_user.id))
    active_run = db.pickup_runs.find_one({
        "hub_id": {"$in": hub_candidates},
        "simulation_status": {"$in": ["NOT_STARTED", "IN_PROGRESS", "PAUSED"]},
    })
    if not active_run:
        return {"has_active_run": False, "run": None}
    return {"has_active_run": True, "run": serialize_pickup_run(active_run)}


@router.post(
    "/{run_id}/start",
    response_model=PickupRunResponse,
    summary="Start route simulation",
)
def start_simulation(
    run_id: str,
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    query = {"_id": ObjectId(run_id)} if ObjectId.is_valid(run_id) else {"_id": run_id}
    now = datetime.now(timezone.utc)
    updated = db.pickup_runs.find_one_and_update(
        {**query, "hub_id": current_user.id},
        {"$set": {"simulation_status": SimulationStatus.IN_PROGRESS.value, "started_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Pickup run not found")
    return serialize_pickup_run(updated)


@router.post(
    "/{run_id}/pause",
    response_model=PickupRunResponse,
    summary="Pause route simulation",
)
def pause_simulation(
    run_id: str,
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    query = {"_id": ObjectId(run_id)} if ObjectId.is_valid(run_id) else {"_id": run_id}
    updated = db.pickup_runs.find_one_and_update(
        {**query, "hub_id": current_user.id},
        {"$set": {"simulation_status": SimulationStatus.PAUSED.value}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Pickup run not found")
    return serialize_pickup_run(updated)


@router.post(
    "/{run_id}/resume",
    response_model=PickupRunResponse,
    summary="Resume route simulation",
)
def resume_simulation(
    run_id: str,
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    query = {"_id": ObjectId(run_id)} if ObjectId.is_valid(run_id) else {"_id": run_id}
    updated = db.pickup_runs.find_one_and_update(
        {**query, "hub_id": current_user.id},
        {"$set": {"simulation_status": SimulationStatus.IN_PROGRESS.value}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Pickup run not found")
    return serialize_pickup_run(updated)


@router.post(
    "/{run_id}/stop/{stop_index}/complete",
    response_model=PickupRunResponse,
    summary="Complete a pickup stop during simulation",
)
def complete_stop(
    run_id: str,
    stop_index: int,
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    query = {"_id": ObjectId(run_id)} if ObjectId.is_valid(run_id) else {"_id": run_id}
    run = db.pickup_runs.find_one({**query, "hub_id": current_user.id})
    if not run:
        raise HTTPException(status_code=404, detail="Pickup run not found")

    stops = run.get("ordered_stops", [])
    target_stop = None
    for s in stops:
        if s.get("stop_index") == stop_index:
            s["status"] = StopStatus.PICKED_UP.value
            s["picked_up_at"] = datetime.now(timezone.utc)
            target_stop = s
            break

    if not target_stop:
        raise HTTPException(status_code=400, detail=f"Stop index {stop_index} not found in this run")

    now = datetime.now(timezone.utc)
    # Update donations for this stop to PICKED_UP
    donation_ids_raw = target_stop.get("donation_ids", [])
    donation_obj_ids = [ObjectId(did) for did in donation_ids_raw if ObjectId.is_valid(did)]
    db.incoming_donations.update_many(
        {"_id": {"$in": donation_obj_ids}},
        {"$set": {"status": DonationStatus.PICKED_UP.value, "picked_up_at": now, "updatedAt": now}},
    )

    updated = db.pickup_runs.find_one_and_update(
        query,
        {"$set": {"ordered_stops": stops, "current_stop_index": stop_index}},
        return_document=ReturnDocument.AFTER,
    )
    return serialize_pickup_run(updated)


@router.post(
    "/{run_id}/complete",
    response_model=PickupRunResponse,
    summary="Complete pickup run after returning to Central Hub",
)
def complete_pickup_run(
    run_id: str,
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    """
    Vehicle returned to Central Hub.
    1. Transition all collected donations to RECEIVED_AT_HUB.
    2. Set simulation_status to COMPLETED.
    3. Release assigned vehicle back to available fleet pool.
    """
    query = {"_id": ObjectId(run_id)} if ObjectId.is_valid(run_id) else {"_id": run_id}
    run = db.pickup_runs.find_one({**query, "hub_id": current_user.id})
    if not run:
        raise HTTPException(status_code=404, detail="Pickup run not found")

    now = datetime.now(timezone.utc)

    # 1. Update all donations to RECEIVED_AT_HUB
    d_ids = run.get("donation_ids", [])
    obj_ids = [ObjectId(did) for did in d_ids if ObjectId.is_valid(did)]
    db.incoming_donations.update_many(
        {"_id": {"$in": obj_ids}},
        {
            "$set": {
                "status": DonationStatus.RECEIVED_AT_HUB.value,
                "received_at_hub_at": now,
                "updatedAt": now,
            }
        },
    )

    # 2. Release vehicle
    vehicle_info = run.get("assigned_vehicle", {})
    if vehicle_info.get("id"):
        VehicleService.release_vehicle(db, vehicle_info["id"])

    # 3. Mark run as completed
    updated = db.pickup_runs.find_one_and_update(
        query,
        {
            "$set": {
                "simulation_status": SimulationStatus.COMPLETED.value,
                "completed_at": now,
            }
        },
        return_document=ReturnDocument.AFTER,
    )

    return serialize_pickup_run(updated)
