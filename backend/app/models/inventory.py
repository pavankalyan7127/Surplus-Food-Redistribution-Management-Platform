from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

from app.models.donation import DonationStatus, FoodCategory, DietaryType, StorageRequirement


class FeasibilityBreakdown(BaseModel):
    temperature_score: float = Field(..., ge=0.0, le=1.0, description="Temperature compliance score (w=0.45)")
    humidity_score: float = Field(..., ge=0.0, le=1.0, description="Humidity compliance score (w=0.20)")
    mq_score: float = Field(..., ge=0.0, le=1.0, description="MQ gas baseline deviation score (w=0.20)")
    fsr_score: float = Field(..., ge=0.0, le=1.0, description="FSR load compliance score (w=0.15)")
    composite_score: float = Field(..., ge=0.0, le=1.0, description="Weighted composite score S in [0.0, 1.0]")


class InventoryResponse(BaseModel):
    id: str
    original_donation_id: str
    provider_id: Optional[str] = None
    hub_id: str
    provider_name: Optional[str] = None
    provider_type: Optional[str] = None
    provider_address: Optional[str] = None
    pickup_address: Optional[str] = None
    provider_coordinates: Optional[list] = None

    # Original donation metadata
    food_name: str
    description: Optional[str] = None
    food_category: str
    dietary_type: str
    preparation_date_time: datetime
    people_served: int
    storage_requirements: str
    pickup_notes: Optional[str] = None
    safety_deadline: Optional[datetime] = None
    pickup_run_id: Optional[str] = None
    picked_up_at: Optional[datetime] = None
    received_at_hub_at: Optional[datetime] = None
    original_created_at: Optional[datetime] = None
    original_updated_at: Optional[datetime] = None

    # Sensor measurements
    sensor_temperature: float = Field(..., description="Temperature in Celsius from IoT sensor")
    sensor_humidity: float = Field(..., description="Relative humidity in % from IoT sensor")
    mq_raw: float = Field(..., description="Raw gas sensor reading from MQ sensor")
    fsr_raw: float = Field(..., description="Raw pressure/load reading from FSR sensor")
    uptime_seconds: Optional[int] = Field(None, description="Sensor uptime in seconds")

    # Feasibility and AI evaluation
    feasibility_score: float = Field(..., ge=0.0, le=1.0, description="Composite food feasibility score S")
    feasibility_breakdown: Optional[FeasibilityBreakdown] = None
    predicted_remaining_hours: float = Field(..., ge=0.0, description="AI-predicted shelf-life in decimal hours")
    food_tested_at: datetime = Field(..., description="Timestamp of food testing execution")

    # Status and audit
    status: str = Field(default="AT_INVENTORY", description="Current inventory status")
    created_at: datetime
    updated_at: datetime
