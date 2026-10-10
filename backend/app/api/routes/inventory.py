import logging
from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import DESCENDING
from pymongo.database import Database

from app.api.deps import require_role, get_db
from app.models.user import UserRole
from app.schemas.auth import UserResponse
from app.models.donation import IncomingDonationResponse
from app.models.inventory import InventoryResponse
from app.api.routes.donations import serialize_donation_doc
from app.services.inventory_service import InventoryService, InventoryWorkflowException

logger = logging.getLogger("app.api.routes.inventory")

router = APIRouter(prefix="/inventory", tags=["Inventory Staging & Management"])


@router.get(
    "/staging",
    response_model=List[IncomingDonationResponse],
    summary="Get all arrived donations pending food testing at the hub",
)
def get_inventory_staging(
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    """
    Returns all donations that have arrived at the hub (status: RECEIVED_AT_HUB or ARRIVED_AT_HUB)
    and are waiting for sensor-based food testing and AI shelf-life prediction.
    """
    raw_docs = InventoryService.get_staging_donations(db=db, hub_id=current_user.id)
    return [serialize_donation_doc(doc, db=db) for doc in raw_docs]


@router.post(
    "/test/{donation_id}",
    response_model=InventoryResponse,
    summary="Initiate food test, feasibility scoring, AI shelf-life prediction and inventory transfer",
)
def execute_food_test(
    donation_id: str,
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    """
    Initiates the complete food testing workflow:
    - Verifies donation belongs to the authenticated hub.
    - Connects to IoT sensor device and reads real-time temperature, humidity, MQ gas, and FSR load.
    - Calculates multi-metric feasibility score S = 0.45*ST + 0.20*SH + 0.20*SM + 0.15*SF.
    - Queries Gemini AI with full food metadata and live telemetry for remaining shelf-life estimation.
    - Persists complete record into Inventory collection.
    - Safely transitions original incoming donation to AT_INVENTORY.
    """
    try:
        inventory_record = InventoryService.process_food_test(
            db=db,
            hub_id=current_user.id,
            donation_id=donation_id,
        )
        return inventory_record
    except InventoryWorkflowException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get(
    "",
    response_model=List[InventoryResponse],
    summary="List all processed inventory items for the authenticated hub",
)
def list_hub_inventory(
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    """
    Retrieves all persisted inventory records for the authenticated hub.
    """
    hub_ids = [str(current_user.id)]
    if ObjectId.is_valid(current_user.id):
        hub_ids.append(ObjectId(current_user.id))

    docs = list(db.inventory.find({"hub_id": {"$in": hub_ids}}).sort("created_at", DESCENDING))
    return [InventoryService.serialize_inventory_doc(d, db=db) for d in docs]


@router.get(
    "/{inventory_id}",
    response_model=InventoryResponse,
    summary="Get details of a specific inventory item",
)
def get_inventory_item(
    inventory_id: str,
    current_user: UserResponse = Depends(require_role(UserRole.HUB)),
    db: Database = Depends(get_db),
):
    """
    Retrieves a single inventory item by ID, including complete sensor readings,
    feasibility score breakdown, and Gemini AI prediction.
    """
    query = {"_id": ObjectId(inventory_id)} if ObjectId.is_valid(inventory_id) else {"_id": inventory_id}
    doc = db.inventory.find_one(query)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory item not found")

    if str(doc.get("hub_id")) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return InventoryService.serialize_inventory_doc(doc, db=db)
