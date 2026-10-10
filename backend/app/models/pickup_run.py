from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SimulationStatus(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class StopStatus(str, Enum):
    PENDING = "PENDING"
    PICKED_UP = "PICKED_UP"


class OrderedStop(BaseModel):
    stop_index: int
    provider_id: str
    provider_name: str
    address: str
    coordinates: List[float]  # [longitude, latitude]
    donation_ids: List[str]
    people_served: int
    status: StopStatus = StopStatus.PENDING
    picked_up_at: Optional[datetime] = None


class AssignedVehicleInfo(BaseModel):
    id: str
    type: str
    capacity: int


class PickupRunResponse(BaseModel):
    id: str
    hub_id: str
    donation_ids: List[str]
    assigned_vehicle: AssignedVehicleInfo
    total_people_served: int
    ordered_stops: List[OrderedStop]
    route_geometry: Optional[Dict[str, Any]] = None  # GeoJSON LineString
    total_distance_meters: float
    total_duration_seconds: float
    baseline_distance_meters: float
    optimized_distance_meters: float
    distance_saved_meters: float
    percentage_saved: float
    simulation_status: SimulationStatus
    current_stop_index: int
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
