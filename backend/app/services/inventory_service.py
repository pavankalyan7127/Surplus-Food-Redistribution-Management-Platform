import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from bson import ObjectId
from pymongo import DESCENDING
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.models.donation import DonationStatus
from app.models.inventory import InventoryResponse, FeasibilityBreakdown
from app.services.sensor_service import SensorService, SensorServiceException
from app.services.feasibility_service import FeasibilityService
from app.services.gemini_service import GeminiService, GeminiServiceException

logger = logging.getLogger("app.services.inventory_service")


class InventoryWorkflowException(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class InventoryService:
    @staticmethod
    def serialize_inventory_doc(doc: dict, db: Optional[Database] = None) -> InventoryResponse:
        provider_id = str(doc.get("provider_id") or doc.get("providerId") or "")
        hub_id = str(doc.get("hub_id") or doc.get("hubId") or "")

        provider_name = doc.get("provider_name")
        provider_address = doc.get("provider_address")
        provider_coords = doc.get("provider_coordinates")

        if db is not None and provider_id and not provider_name:
            try:
                p_query = {"_id": ObjectId(provider_id)} if ObjectId.is_valid(provider_id) else {"_id": provider_id}
                p_doc = db.users.find_one(p_query)
                if p_doc:
                    provider_name = p_doc.get("organization_name")
                    provider_address = p_doc.get("address")
                    loc = p_doc.get("location")
                    if loc and isinstance(loc, dict) and loc.get("type") == "Point":
                        provider_coords = loc.get("coordinates")
            except Exception:
                pass

        breakdown_data = doc.get("feasibility_breakdown")
        breakdown = FeasibilityBreakdown(**breakdown_data) if breakdown_data else None

        return InventoryResponse(
            id=str(doc["_id"]),
            original_donation_id=str(doc.get("original_donation_id") or ""),
            provider_id=provider_id,
            hub_id=hub_id,
            provider_name=provider_name,
            provider_type=doc.get("provider_type") or doc.get("providerType"),
            provider_address=provider_address,
            pickup_address=doc.get("pickup_address") or doc.get("pickupAddress") or provider_address,
            provider_coordinates=provider_coords,
            food_name=doc.get("food_name") or doc.get("foodName", ""),
            description=doc.get("description"),
            food_category=doc.get("food_category") or doc.get("foodCategory", "Cooked Meals"),
            dietary_type=doc.get("dietary_type") or doc.get("dietaryType", "Vegetarian"),
            preparation_date_time=doc.get("preparation_date_time") or doc.get("preparationDateTime") or datetime.now(timezone.utc),
            people_served=int(doc.get("people_served") or doc.get("peopleServed", 0)),
            storage_requirements=doc.get("storage_requirements") or doc.get("storageRequirements", "Room Temperature"),
            pickup_notes=doc.get("pickup_notes") or doc.get("pickupNotes"),
            safety_deadline=doc.get("safety_deadline") or doc.get("safetyDeadline"),
            pickup_run_id=str(doc.get("pickup_run_id") or doc.get("pickupRunId") or "") or None,
            picked_up_at=doc.get("picked_up_at"),
            received_at_hub_at=doc.get("received_at_hub_at"),
            original_created_at=doc.get("original_created_at") or doc.get("createdAt"),
            original_updated_at=doc.get("original_updated_at") or doc.get("updatedAt"),
            sensor_temperature=float(doc.get("sensor_temperature", 0.0)),
            sensor_humidity=float(doc.get("sensor_humidity", 0.0)),
            mq_raw=float(doc.get("mq_raw", 0.0)),
            fsr_raw=float(doc.get("fsr_raw", 0.0)),
            uptime_seconds=doc.get("uptime_seconds"),
            feasibility_score=float(doc.get("feasibility_score", 0.0)),
            feasibility_breakdown=breakdown,
            predicted_remaining_hours=float(doc.get("predicted_remaining_hours", 0.0)),
            food_tested_at=doc.get("food_tested_at") or datetime.now(timezone.utc),
            status=doc.get("status", "AT_INVENTORY"),
            created_at=doc.get("created_at") or datetime.now(timezone.utc),
            updated_at=doc.get("updated_at") or datetime.now(timezone.utc),
        )

    @classmethod
    def get_staging_donations(cls, db: Database, hub_id: str) -> List[Dict[str, Any]]:
        """
        Retrieves all donations arrived at the authenticated hub that are pending food testing.
        Matches status: RECEIVED_AT_HUB or ARRIVED_AT_HUB.
        """
        hub_ids = [str(hub_id)]
        if ObjectId.is_valid(hub_id):
            hub_ids.append(ObjectId(hub_id))

        query = {
            "hubId": {"$in": hub_ids},
            "status": {"$in": [
                DonationStatus.RECEIVED_AT_HUB.value,
                DonationStatus.ARRIVED_AT_HUB.value,
                DonationStatus.FOOD_TESTING_IN_PROGRESS.value,
            ]}
        }

        docs = list(db.incoming_donations.find(query).sort("createdAt", DESCENDING))
        return docs

    @classmethod
    def process_food_test(cls, db: Database, hub_id: str, donation_id: str) -> InventoryResponse:
        """
        Executes the end-to-end food test and inventory transition workflow:
        1. Validate donation belongs to hub and status is arrived at hub.
        2. Set atomic testing reservation to prevent concurrent requests.
        3. Fetch live IoT sensor readings from configured SENSOR_API_URL.
        4. Calculate feasibility score using weighted multi-sensor formula.
        5. Request shelf-life prediction from Gemini AI.
        6. Persist complete record into Inventory collection.
        7. Remove processed record from incoming_donations and update status to AT_INVENTORY.
        """
        d_query = {"_id": ObjectId(donation_id)} if ObjectId.is_valid(donation_id) else {"_id": donation_id}
        donation = db.incoming_donations.find_one(d_query)

        if not donation:
            # Check if it was already processed into inventory
            existing_inv = db.inventory.find_one({"original_donation_id": str(donation_id)})
            if existing_inv:
                logger.info("Donation %s was already processed into inventory.", donation_id)
                return cls.serialize_inventory_doc(existing_inv, db=db)
            raise InventoryWorkflowException("Donation record not found.", status_code=404)

        # Verify hub ownership
        donation_hub = str(donation.get("hubId") or donation.get("hub_id") or "")
        if donation_hub != str(hub_id):
            raise InventoryWorkflowException("Unauthorized: This donation does not belong to your hub.", status_code=403)

        # Check existing inventory to prevent duplicates
        existing_inv = db.inventory.find_one({"original_donation_id": str(donation["_id"])})
        if existing_inv:
            # Ensure it is removed from incoming donations if dangling
            db.incoming_donations.delete_one(d_query)
            return cls.serialize_inventory_doc(existing_inv, db=db)

        # Verify status is eligible
        current_status = donation.get("status")
        valid_statuses = [DonationStatus.RECEIVED_AT_HUB.value, DonationStatus.ARRIVED_AT_HUB.value]
        if current_status not in valid_statuses:
            if current_status == DonationStatus.FOOD_TESTING_IN_PROGRESS.value:
                raise InventoryWorkflowException(
                    "Food testing is already currently in progress for this donation. Please wait.",
                    status_code=409,
                )
            raise InventoryWorkflowException(
                f"Donation is not in arrived staging state (current status: {current_status}).",
                status_code=400,
            )

        # Atomic concurrency lock: transition to FOOD_TESTING_IN_PROGRESS
        res = db.incoming_donations.find_one_and_update(
            {"_id": donation["_id"], "status": {"$in": valid_statuses}},
            {"$set": {"status": DonationStatus.FOOD_TESTING_IN_PROGRESS.value, "updatedAt": datetime.now(timezone.utc)}},
            return_document=False
        )
        if not res:
            raise InventoryWorkflowException("Concurrency conflict: donation is being tested by another request.", status_code=409)

        original_status = current_status

        try:
            # Step 2: Fetch live IoT sensor data
            logger.info("Fetching sensor data for donation %s...", donation_id)
            sensor_reading = SensorService.fetch_sensor_data()
            sensor_dict = sensor_reading.model_dump()

            # Step 3: Calculate feasibility score
            storage_req = donation.get("storageRequirements") or donation.get("storage_requirements", "Room Temperature")
            feasibility_score, breakdown = FeasibilityService.calculate_feasibility(
                temperature=sensor_reading.temperature,
                humidity=sensor_reading.humidity,
                mq_raw=sensor_reading.mq_raw,
                fsr_raw=sensor_reading.fsr_raw,
                storage_requirements=storage_req,
            )

            # Step 4 & 5: Predict remaining usable time via Gemini AI
            logger.info("Querying Gemini AI for usable shelf-life...")
            predicted_hours = GeminiService.predict_remaining_hours(
                food_data=donation,
                sensor_data=sensor_dict,
                feasibility_score=feasibility_score,
            )

            # Step 6: Assemble full Inventory record
            now = datetime.now(timezone.utc)
            provider_id = str(donation.get("providerId") or donation.get("provider_id") or "") or None

            # Provider details stored directly in incoming_donations
            provider_name = donation.get("providerName") or donation.get("provider_name")
            provider_type = donation.get("providerType") or donation.get("provider_type")
            provider_address = donation.get("pickupAddress") or donation.get("pickup_address") or donation.get("address")
            provider_coords = None
            loc = donation.get("pickupLocation") or donation.get("pickup_location")
            if loc and isinstance(loc, dict) and loc.get("type") == "Point":
                provider_coords = loc.get("coordinates")
            elif donation.get("provider_coordinates"):
                provider_coords = donation.get("provider_coordinates")

            # Fallback for legacy donation documents
            if (not provider_name or not provider_coords) and provider_id:
                try:
                    p_query = {"_id": ObjectId(provider_id)} if ObjectId.is_valid(provider_id) else {"_id": provider_id}
                    p_doc = db.users.find_one(p_query)
                    if p_doc:
                        if not provider_name:
                            provider_name = p_doc.get("organization_name")
                        if not provider_type:
                            provider_type = p_doc.get("provider_type")
                        if not provider_address:
                            provider_address = p_doc.get("address")
                        if not provider_coords:
                            u_loc = p_doc.get("location")
                            if u_loc and isinstance(u_loc, dict) and u_loc.get("type") == "Point":
                                provider_coords = u_loc.get("coordinates")
                except Exception:
                    pass

            inventory_doc = {
                "original_donation_id": str(donation["_id"]),
                "provider_id": provider_id,
                "hub_id": str(hub_id),
                "provider_name": provider_name or "Food Provider",
                "provider_type": provider_type or "restaurant",
                "provider_address": provider_address,
                "pickup_address": provider_address,
                "provider_coordinates": provider_coords,
                "food_name": donation.get("foodName") or donation.get("food_name", ""),
                "description": donation.get("description"),
                "food_category": donation.get("foodCategory") or donation.get("food_category", "Cooked Meals"),
                "dietary_type": donation.get("dietaryType") or donation.get("dietary_type", "Vegetarian"),
                "preparation_date_time": donation.get("preparationDateTime") or donation.get("preparation_date_time"),
                "people_served": int(donation.get("peopleServed") or donation.get("people_served", 0)),
                "storage_requirements": storage_req,
                "pickup_notes": donation.get("pickupNotes") or donation.get("pickup_notes"),
                "safety_deadline": donation.get("safetyDeadline") or donation.get("safety_deadline"),
                "pickup_run_id": str(donation.get("pickupRunId") or donation.get("pickup_run_id") or "") or None,
                "picked_up_at": donation.get("picked_up_at"),
                "received_at_hub_at": donation.get("received_at_hub_at"),
                "original_created_at": donation.get("createdAt") or donation.get("created_at"),
                "original_updated_at": donation.get("updatedAt") or donation.get("updated_at"),
                # Sensor readings
                "sensor_temperature": sensor_reading.temperature,
                "sensor_humidity": sensor_reading.humidity,
                "mq_raw": sensor_reading.mq_raw,
                "fsr_raw": sensor_reading.fsr_raw,
                "uptime_seconds": sensor_reading.uptime_seconds,
                # Quality & AI evaluations
                "feasibility_score": feasibility_score,
                "feasibility_breakdown": breakdown.model_dump(),
                "predicted_remaining_hours": predicted_hours,
                "food_tested_at": now,
                # Final Inventory State
                "status": "AT_INVENTORY",
                "created_at": now,
                "updated_at": now,
            }

            # Persist to db.inventory (with unique constraint safety)
            try:
                insert_res = db.inventory.insert_one(inventory_doc)
                inventory_doc["_id"] = insert_res.inserted_id
            except DuplicateKeyError:
                # In case already inserted
                inventory_doc = db.inventory.find_one({"original_donation_id": str(donation["_id"])})

            # Step 7: Transition and remove from active incoming_donations
            # Only remove after inventory is persisted
            db.incoming_donations.delete_one({"_id": donation["_id"]})

            logger.info("Successfully completed food test and moved donation %s to Inventory (%s)",
                        donation_id, str(inventory_doc["_id"]))

            return cls.serialize_inventory_doc(inventory_doc, db=db)

        except (SensorServiceException, GeminiServiceException) as known_err:
            # Revert reservation to original state so the donation remains recoverable in staging
            logger.warning("Rolling back donation %s status to %s due to error: %s",
                           donation_id, original_status, str(known_err))
            db.incoming_donations.update_one(
                {"_id": donation["_id"]},
                {"$set": {"status": original_status, "updatedAt": datetime.now(timezone.utc)}}
            )
            raise InventoryWorkflowException(known_err.message, status_code=502 if getattr(known_err, "is_unreachable", False) else 400)

        except Exception as unexpected_err:
            logger.error("Unexpected error during food test workflow for %s: %s", donation_id, str(unexpected_err))
            db.incoming_donations.update_one(
                {"_id": donation["_id"]},
                {"$set": {"status": original_status, "updatedAt": datetime.now(timezone.utc)}}
            )
            raise InventoryWorkflowException(f"Food testing failed: {str(unexpected_err)}", status_code=500)
