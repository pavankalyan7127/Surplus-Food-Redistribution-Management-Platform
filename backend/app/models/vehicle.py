from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from bson import ObjectId
from pydantic import BaseModel, Field

from app.models.common import MongoBaseModel, PyObjectId, utc_now


class VehicleType(str, Enum):
    BIKE = "Bike"
    AUTO = "Auto"
    TEMPO_TRAVELLER = "Tempo traveller"


class VehicleCreate(BaseModel):
    type: VehicleType
    capacity: int = Field(..., gt=0)
    isFree: bool = True


class VehicleResponse(BaseModel):
    id: str
    owned_by_hub_ID: str
    type: str
    capacity: int
    isFree: bool
    created_at: datetime
    updated_at: datetime


DEFAULT_VEHICLES = [
    {"type": "Bike", "capacity": 10},
    {"type": "Auto", "capacity": 30},
    {"type": "Tempo traveller", "capacity": 60},
]
