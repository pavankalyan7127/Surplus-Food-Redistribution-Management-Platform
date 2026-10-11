from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class NgoOrderStatus(str, Enum):
    CONFIRMED = "CONFIRMED"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class CheckStatus(str, Enum):
    EMPTY = "EMPTY"
    DEFICIT = "DEFICIT"
    EXCEEDS_GRACE = "EXCEEDS_GRACE"
    MATCH = "MATCH"


class FoodRequestCheckPayload(BaseModel):
    hub_id: str
    requested_portions: int = Field(..., gt=0, le=10000, description="Portion count requested by NGO")


class AllocatedPackageInfo(BaseModel):
    id: str
    original_donation_id: Optional[str] = None
    food_name: str
    provider_name: Optional[str] = None
    people_served: int
    predicted_remaining_hours: float
    feasibility_score: float
    storage_requirements: Optional[str] = None
    food_category: Optional[str] = None


class FoodRequestCheckResponse(BaseModel):
    status: CheckStatus
    hub_id: str
    requested_portions: int
    available_portions: int
    matched_portions: int
    packages: List[AllocatedPackageInfo] = []
    package_ids: List[str] = []
    message: str


class CreateNgoOrderPayload(BaseModel):
    hub_id: str
    requested_portions: int = Field(..., gt=0)
    confirmed_portions: int = Field(..., gt=0)
    package_ids: List[str] = Field(..., min_length=1)


class NgoOrderResponse(BaseModel):
    id: str
    order_number: str
    hub_id: str
    hub_name: str
    hub_address: str
    hub_coordinates: List[float]
    ngo_id: str
    ngo_name: str
    ngo_address: str
    ngo_coordinates: List[float]
    total_people_served: int
    package_ids: List[str]
    packages: List[Dict[str, Any]]
    assigned_vehicle: Optional[Dict[str, Any]] = None
    route_geometry: Optional[Dict[str, Any]] = None
    total_distance_meters: Optional[float] = None
    total_duration_seconds: Optional[float] = None
    status: str = "CONFIRMED"
    simulation_status: str = "NOT_STARTED"
    created_at: datetime
    dispatched_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None


class DeliveryHistoryItem(BaseModel):
    id: str
    order_id: str
    order_number: str
    hub_id: str
    hub_name: str
    hub_address: str
    ngo_id: str
    ngo_name: str
    ngo_address: str
    total_people_served: int
    vehicle_type: str
    packages: List[Dict[str, Any]]
    delivered_at: datetime
    created_at: datetime
