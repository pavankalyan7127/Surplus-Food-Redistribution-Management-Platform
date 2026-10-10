import logging
from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from pymongo import ASCENDING, ReturnDocument
from pymongo.database import Database

from app.models.vehicle import DEFAULT_VEHICLES

logger = logging.getLogger("app.services.vehicle")


class VehicleService:
    @staticmethod
    def ensure_hub_vehicles(db: Database, hub_id: str) -> List[dict]:
        """
        Ensure default vehicle fleet exists in MongoDB for this hub.
        Does not duplicate vehicles on repeated runs.
        """
        existing = list(db.vehicles.find({"owned_by_hub_ID": str(hub_id)}))
        if existing:
            return existing

        now = datetime.now(timezone.utc)
        docs_to_insert = []
        for v in DEFAULT_VEHICLES:
            docs_to_insert.append({
                "owned_by_hub_ID": str(hub_id),
                "type": v["type"],
                "capacity": v["capacity"],
                "isFree": True,
                "created_at": now,
                "updated_at": now,
            })

        if docs_to_insert:
            db.vehicles.insert_many(docs_to_insert)

        return list(db.vehicles.find({"owned_by_hub_ID": str(hub_id)}))

    @staticmethod
    def get_hub_vehicles(db: Database, hub_id: str) -> List[dict]:
        VehicleService.ensure_hub_vehicles(db, hub_id)
        return list(db.vehicles.find({"owned_by_hub_ID": str(hub_id)}).sort("capacity", ASCENDING))

    @staticmethod
    def select_and_reserve_vehicle(
        db: Database, hub_id: str, total_people: int
    ) -> Optional[dict]:
        """
        Selects the smallest available vehicle with sufficient capacity (capacity >= total_people).
        If smallest is busy, picks next-smallest with sufficient capacity.
        Atomically sets isFree = False.
        Returns the reserved vehicle dict, or None if no vehicle has sufficient capacity.
        """
        VehicleService.ensure_hub_vehicles(db, hub_id)

        # Find all free vehicles with capacity >= total_people, ordered by smallest capacity first
        candidates = list(
            db.vehicles.find({
                "owned_by_hub_ID": str(hub_id),
                "isFree": True,
                "capacity": {"$gte": total_people},
            }).sort("capacity", ASCENDING)
        )

        for candidate in candidates:
            # Atomically claim this vehicle
            reserved = db.vehicles.find_one_and_update(
                {"_id": candidate["_id"], "isFree": True},
                {"$set": {"isFree": False, "updated_at": datetime.now(timezone.utc)}},
                return_document=ReturnDocument.AFTER,
            )
            if reserved:
                return reserved

        return None

    @staticmethod
    def release_vehicle(db: Database, vehicle_id: str) -> bool:
        """Release vehicle back into available pool."""
        query = {"_id": ObjectId(vehicle_id)} if ObjectId.is_valid(vehicle_id) else {"_id": vehicle_id}
        res = db.vehicles.update_one(
            query,
            {"$set": {"isFree": True, "updated_at": datetime.now(timezone.utc)}},
        )
        return res.modified_count > 0
