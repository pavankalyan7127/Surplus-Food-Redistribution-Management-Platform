import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from bson import ObjectId
from pymongo.database import Database
from pymongo import DESCENDING

from app.models.ngo_order import (
    CheckStatus,
    FoodRequestCheckResponse,
    AllocatedPackageInfo,
    NgoOrderResponse,
    DeliveryHistoryItem,
)
from app.services.vehicle_service import VehicleService
from app.services.routing_service import RoutingService
from app.services.geocoding_service import GeocodingService

logger = logging.getLogger("app.services.trip2")


class Trip2Service:
    @staticmethod
    def get_hub_candidates(hub_id: str) -> List[Any]:
        candidates = [str(hub_id)]
        if ObjectId.is_valid(hub_id):
            candidates.append(ObjectId(hub_id))
        return candidates

    @classmethod
    def evaluate_inventory_for_ngo(
        cls, db: Database, hub_id: str, requested_portions: int
    ) -> FoodRequestCheckResponse:
        """
        Evaluates hub inventory against requested portions.
        1. Ranks indivisible packages by predicted remaining hours (least time first).
        2. Handles Empty, Deficit, Match within <=20% grace, and Exceeds >20% grace.
        """
        hub_candidates = cls.get_hub_candidates(hub_id)

        # 1. Fetch available inventory packages at this hub
        inv_docs = list(
            db.inventory.find({
                "hub_id": {"$in": hub_candidates},
                "status": "AT_INVENTORY",
            })
        )

        total_available = sum(int(d.get("people_served", 0)) for d in inv_docs)

        # Case 1: Empty Inventory
        if total_available == 0 or len(inv_docs) == 0:
            return FoodRequestCheckResponse(
                status=CheckStatus.EMPTY,
                hub_id=str(hub_id),
                requested_portions=requested_portions,
                available_portions=0,
                matched_portions=0,
                packages=[],
                package_ids=[],
                message="No inventory is currently available at this Central Hub. Please check back later.",
            )

        # Sort packages strictly by predicted shelf-life ascending (least time priority)
        # Fall back to creation time if equal
        def sort_key(d: dict):
            hours = float(d.get("predicted_remaining_hours") or 999.0)
            created = d.get("created_at") or datetime.min.replace(tzinfo=timezone.utc)
            return (hours, created)

        sorted_docs = sorted(inv_docs, key=sort_key)

        def make_package_info(d: dict) -> AllocatedPackageInfo:
            return AllocatedPackageInfo(
                id=str(d["_id"]),
                original_donation_id=str(d.get("original_donation_id") or ""),
                food_name=d.get("food_name") or d.get("foodName", "Surplus Food"),
                provider_name=d.get("provider_name") or "Food Provider",
                people_served=int(d.get("people_served", 0)),
                predicted_remaining_hours=float(d.get("predicted_remaining_hours", 0.0)),
                feasibility_score=float(d.get("feasibility_score", 0.0)),
                storage_requirements=d.get("storage_requirements"),
                food_category=d.get("food_category"),
            )

        # Case 2: Deficit (Total stock < requested count)
        if total_available < requested_portions:
            all_pkgs = [make_package_info(d) for d in sorted_docs]
            all_ids = [str(d["_id"]) for d in sorted_docs]
            return FoodRequestCheckResponse(
                status=CheckStatus.DEFICIT,
                hub_id=str(hub_id),
                requested_portions=requested_portions,
                available_portions=total_available,
                matched_portions=total_available,
                packages=all_pkgs,
                package_ids=all_ids,
                message=f"We currently only have {total_available} portions available. Is it okay if we provide {total_available} portions as of now? You can check back later for the remaining.",
            )

        # Case 3: Greedy accumulation by least time priority (Indivisible packages)
        accumulated_docs = []
        accumulated_portions = 0

        for doc in sorted_docs:
            accumulated_docs.append(doc)
            accumulated_portions += int(doc.get("people_served", 0))
            if accumulated_portions >= requested_portions:
                break

        matched_pkgs = [make_package_info(d) for d in accumulated_docs]
        matched_ids = [str(d["_id"]) for d in accumulated_docs]

        # Check Grace Quantity Threshold: up to 20%
        grace_limit = int(requested_portions * 1.20)

        if accumulated_portions <= grace_limit:
            # Case 4: Perfect or acceptable within 20% grace allowance
            return FoodRequestCheckResponse(
                status=CheckStatus.MATCH,
                hub_id=str(hub_id),
                requested_portions=requested_portions,
                available_portions=total_available,
                matched_portions=accumulated_portions,
                packages=matched_pkgs,
                package_ids=matched_ids,
                message=f"Optimal match confirmed! {len(matched_pkgs)} food package(s) allocated serving {accumulated_portions} people (AI-prioritized by shortest shelf-life).",
            )
        else:
            # Case 5: Exceeds 20% grace allowance (e.g. requested 25, but indivisible package gives 60)
            return FoodRequestCheckResponse(
                status=CheckStatus.EXCEEDS_GRACE,
                hub_id=str(hub_id),
                requested_portions=requested_portions,
                available_portions=total_available,
                matched_portions=accumulated_portions,
                packages=matched_pkgs,
                package_ids=matched_ids,
                message=f"We have food packages available totaling {accumulated_portions} portions (exceeds your requested {requested_portions} portions by more than 20%). Would you like to accept this {accumulated_portions}-portion allocation?",
            )

    @classmethod
    def create_and_dispatch_order(
        cls,
        db: Database,
        ngo_user: dict,
        hub_id: str,
        requested_portions: int,
        confirmed_portions: int,
        package_ids: List[str],
    ) -> dict:
        """
        Creates confirmed dispatch order:
        1. Validates and marks packages ALLOCATED_TO_ORDER.
        2. Assigns smallest sufficient vehicle from Hub fleet.
        3. Computes direct OSRM road geometry Hub -> NGO.
        4. Saves document to ngo_orders.
        """
        now = datetime.now(timezone.utc)
        hub_candidates = cls.get_hub_candidates(hub_id)

        # 1. Fetch Hub details & coordinates
        hub_doc = db.users.find_one({"_id": {"$in": [ObjectId(hub_id) if ObjectId.is_valid(hub_id) else hub_id, hub_id]}})
        if not hub_doc:
            raise ValueError("Designated Central Hub not found.")

        hub_loc = hub_doc.get("location")
        if not hub_loc or not isinstance(hub_loc, dict) or hub_loc.get("type") != "Point":
            # Regional fallback
            hub_coords = [76.9680, 11.0180]
        else:
            hub_coords = [float(hub_loc["coordinates"][0]), float(hub_loc["coordinates"][1])]

        # 2. Fetch NGO coordinates
        ngo_loc = ngo_user.get("location")
        if not ngo_loc or not isinstance(ngo_loc, dict) or ngo_loc.get("type") != "Point":
            # Attempt geocoding on-the-fly
            geocoded = GeocodingService.geocode_address(ngo_user.get("address", ""))
            if geocoded:
                ngo_coords = [float(geocoded[1]), float(geocoded[0])]
                # Save to NGO user profile
                db.users.update_one(
                    {"_id": ngo_user["_id"]},
                    {"$set": {"location": {"type": "Point", "coordinates": ngo_coords}}}
                )
            else:
                ngo_coords = [76.9558, 11.0080]
        else:
            ngo_coords = [float(ngo_loc["coordinates"][0]), float(ngo_loc["coordinates"][1])]

        # 3. Reserve packages in inventory
        obj_ids = [ObjectId(pid) for pid in package_ids if ObjectId.is_valid(pid)]
        matched_packages = list(db.inventory.find({"_id": {"$in": obj_ids}}))
        if len(matched_packages) == 0:
            raise ValueError("Selected inventory packages are no longer available.")

        # 4. Assign vehicle from Hub fleet
        reserved_vehicle = VehicleService.select_and_reserve_vehicle(
            db=db, hub_id=str(hub_id), total_people=confirmed_portions
        )
        if not reserved_vehicle:
            # Fallback vehicle metadata so demo is not blocked
            reserved_vehicle = {
                "_id": str(uuid.uuid4())[:8],
                "type": "Auto" if confirmed_portions <= 30 else "Tempo traveller",
                "capacity": 30 if confirmed_portions <= 30 else 60,
            }

        # 5. Generate OSRM road geometry Hub -> NGO
        # Format for RoutingService: [(lon, lat), (lon, lat)]
        start_coord = (hub_coords[0], hub_coords[1])
        end_coord = (ngo_coords[0], ngo_coords[1])
        route_geom, dist_m, dur_s = RoutingService.get_route_geometry([start_coord, end_coord])

        # 6. Generate order document
        order_number = f"ORD-T2-{uuid.uuid4().hex[:6].upper()}"
        order_doc = {
            "order_number": order_number,
            "hub_id": str(hub_id),
            "hub_name": hub_doc.get("organization_name", "Central Logistics Hub"),
            "hub_address": hub_doc.get("address", "Central Hub"),
            "hub_coordinates": hub_coords,
            "ngo_id": str(ngo_user["_id"]),
            "ngo_name": ngo_user.get("organization_name", "Partner NGO"),
            "ngo_address": ngo_user.get("address", ""),
            "ngo_coordinates": ngo_coords,
            "requested_portions": requested_portions,
            "total_people_served": confirmed_portions,
            "package_ids": [str(p["_id"]) for p in matched_packages],
            "packages": [
                {
                    "id": str(p["_id"]),
                    "original_donation_id": p.get("original_donation_id"),
                    "food_name": p.get("food_name"),
                    "provider_name": p.get("provider_name"),
                    "people_served": p.get("people_served"),
                    "predicted_remaining_hours": p.get("predicted_remaining_hours"),
                    "feasibility_score": p.get("feasibility_score"),
                    "sensor_temperature": p.get("sensor_temperature"),
                    "sensor_humidity": p.get("sensor_humidity"),
                    "mq_raw": p.get("mq_raw"),
                    "fsr_raw": p.get("fsr_raw"),
                }
                for p in matched_packages
            ],
            "assigned_vehicle": {
                "id": str(reserved_vehicle.get("_id", "")),
                "type": reserved_vehicle.get("type", "Delivery Vehicle"),
                "capacity": reserved_vehicle.get("capacity", 50),
            },
            "route_geometry": route_geom,
            "total_distance_meters": round(dist_m, 1),
            "total_duration_seconds": round(dur_s, 1),
            "status": "CONFIRMED",
            "simulation_status": "NOT_STARTED",
            "created_at": now,
            "dispatched_at": None,
            "delivered_at": None,
        }

        res = db.ngo_orders.insert_one(order_doc)
        order_doc["_id"] = res.inserted_id

        # Mark packages allocated
        db.inventory.update_many(
            {"_id": {"$in": obj_ids}},
            {"$set": {"status": "ALLOCATED_TO_ORDER", "order_id": str(order_doc["_id"])}}
        )

        return order_doc

    @classmethod
    def complete_delivery_and_archive(cls, db: Database, order_id: str) -> dict:
        """
        Finalizes delivery:
        1. Sets order status to DELIVERED.
        2. Releases assigned vehicle.
        3. Removes delivered packages from db.inventory.
        4. Inserts comprehensive record into db.history.
        """
        now = datetime.now(timezone.utc)
        query = {"_id": ObjectId(order_id)} if ObjectId.is_valid(order_id) else {"_id": order_id}

        order = db.ngo_orders.find_one(query)
        if not order:
            raise ValueError("Order not found.")

        # Update order status
        db.ngo_orders.update_one(
            query,
            {"$set": {"status": "DELIVERED", "simulation_status": "COMPLETED", "delivered_at": now}}
        )

        # Release vehicle if valid
        veh_id = order.get("assigned_vehicle", {}).get("id")
        if veh_id and ObjectId.is_valid(veh_id):
            VehicleService.release_vehicle(db, veh_id)

        # Remove delivered packages from inventory collection
        pkg_ids_raw = order.get("package_ids", [])
        obj_pkg_ids = [ObjectId(pid) for pid in pkg_ids_raw if ObjectId.is_valid(pid)]
        if obj_pkg_ids:
            db.inventory.delete_many({"_id": {"$in": obj_pkg_ids}})

        # Create history document in MongoDB history collection
        history_doc = {
            "order_id": str(order["_id"]),
            "order_number": order.get("order_number", "ORD-T2-COMPLETED"),
            "hub_id": str(order.get("hub_id")),
            "hub_name": order.get("hub_name", "Central Hub"),
            "hub_address": order.get("hub_address", ""),
            "ngo_id": str(order.get("ngo_id")),
            "ngo_name": order.get("ngo_name", "Partner NGO"),
            "ngo_address": order.get("ngo_address", ""),
            "total_people_served": order.get("total_people_served", 0),
            "vehicle_type": order.get("assigned_vehicle", {}).get("type", "Standard Van"),
            "packages": order.get("packages", []),
            "delivered_at": now,
            "created_at": order.get("created_at", now),
        }

        db.history.insert_one(history_doc)
        order["status"] = "DELIVERED"
        order["simulation_status"] = "COMPLETED"
        order["delivered_at"] = now
        return order

    @classmethod
    def serialize_order_doc(cls, doc: dict) -> NgoOrderResponse:
        return NgoOrderResponse(
            id=str(doc["_id"]),
            order_number=doc.get("order_number", "ORD-T2"),
            hub_id=str(doc.get("hub_id", "")),
            hub_name=doc.get("hub_name", "Central Hub"),
            hub_address=doc.get("hub_address", ""),
            hub_coordinates=doc.get("hub_coordinates", [76.9680, 11.0180]),
            ngo_id=str(doc.get("ngo_id", "")),
            ngo_name=doc.get("ngo_name", "Partner NGO"),
            ngo_address=doc.get("ngo_address", ""),
            ngo_coordinates=doc.get("ngo_coordinates", [76.9558, 11.0080]),
            total_people_served=int(doc.get("total_people_served", 0)),
            package_ids=doc.get("package_ids", []),
            packages=doc.get("packages", []),
            assigned_vehicle=doc.get("assigned_vehicle"),
            route_geometry=doc.get("route_geometry"),
            total_distance_meters=doc.get("total_distance_meters"),
            total_duration_seconds=doc.get("total_duration_seconds"),
            status=doc.get("status", "CONFIRMED"),
            simulation_status=doc.get("simulation_status", "NOT_STARTED"),
            created_at=doc.get("created_at") or datetime.now(timezone.utc),
            dispatched_at=doc.get("dispatched_at"),
            delivered_at=doc.get("delivered_at"),
        )
