from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from bson import ObjectId
from pydantic import BaseModel, Field

from app.models.common import MongoBaseModel, PyObjectId, utc_now


class DonationStatus(str, Enum):
    READY_FOR_PICKUP = "READY_FOR_PICKUP"
    RESERVED_FOR_PICKUP = "RESERVED_FOR_PICKUP"
    PICKED_UP = "PICKED_UP"
    RECEIVED_AT_HUB = "RECEIVED_AT_HUB"
    ARRIVED_AT_HUB = "ARRIVED_AT_HUB"
    FOOD_TESTING_IN_PROGRESS = "FOOD_TESTING_IN_PROGRESS"
    AT_INVENTORY = "AT_INVENTORY"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class FoodCategory(str, Enum):
    COOKED_MEALS = "Cooked Meals"
    BAKERY = "Bakery & Bread"
    PRODUCE = "Fresh Produce"
    DAIRY = "Dairy & Eggs"
    PACKAGED = "Packaged / Dry Goods"
    BEVERAGES = "Beverages"
    OTHER = "Other"


class DietaryType(str, Enum):
    VEGETARIAN = "Vegetarian"
    NON_VEGETARIAN = "Non-Vegetarian"
    VEGAN = "Vegan"


class StorageRequirement(str, Enum):
    ROOM_TEMP = "Room Temperature"
    REFRIGERATED = "Refrigerated (Cold Chain)"
    FROZEN = "Frozen"
    HOT_HOLDING = "Hot Holding"


class IncomingDonationCreate(BaseModel):
    provider_name: str = Field(default="Food Provider", min_length=2, max_length=150, description="Restaurant / Bakery / Food Establishment Name")
    provider_type: str = Field(default="restaurant", description="restaurant, bakery, or mess")
    pickup_address: str = Field(default="Gandhipuram, Coimbatore, Tamil Nadu", min_length=3, max_length=300, description="Physical pickup address")
    food_name: str = Field(..., min_length=2, max_length=150)
    food_category: FoodCategory = FoodCategory.COOKED_MEALS
    dietary_type: DietaryType = DietaryType.VEGETARIAN
    preparation_date_time: datetime
    people_served: int = Field(..., gt=0, le=5000)
    storage_requirements: StorageRequirement = StorageRequirement.ROOM_TEMP
    description: Optional[str] = Field(None, max_length=500)
    pickup_notes: Optional[str] = Field(None, max_length=500)


class IncomingDonationResponse(BaseModel):
    id: str
    provider_id: Optional[str] = None
    hub_id: Optional[str] = None
    provider_name: Optional[str] = None
    provider_type: Optional[str] = None
    provider_address: Optional[str] = None
    pickup_address: Optional[str] = None
    provider_coordinates: Optional[list] = None
    food_name: str
    description: Optional[str] = None
    food_category: str
    dietary_type: str
    preparation_date_time: datetime
    people_served: int
    storage_requirements: str
    pickup_notes: Optional[str] = None
    status: DonationStatus
    pickup_run_id: Optional[str] = None
    safety_deadline: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    picked_up_at: Optional[datetime] = None
    received_at_hub_at: Optional[datetime] = None
