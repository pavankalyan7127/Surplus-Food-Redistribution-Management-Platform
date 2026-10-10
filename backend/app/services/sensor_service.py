import logging
from typing import Dict, Any, Optional
import httpx
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger("app.services.sensor_service")


class SensorReading(BaseModel):
    temperature: float = Field(..., description="Temperature in Celsius")
    humidity: float = Field(..., description="Relative humidity percentage")
    mq_raw: float = Field(..., description="Raw gas sensor reading")
    fsr_raw: float = Field(..., description="Raw pressure/force sensor reading")
    uptime_seconds: Optional[int] = Field(None, description="Sensor uptime in seconds")


class SensorServiceException(Exception):
    """Custom exception raised when sensor data retrieval fails."""
    def __init__(self, message: str, is_unreachable: bool = False):
        super().__init__(message)
        self.message = message
        self.is_unreachable = is_unreachable


class SensorService:
    @classmethod
    def fetch_sensor_data(cls) -> SensorReading:
        """
        Fetches live sensor telemetry from the IoT sensor device.
        Connects to SENSOR_API_URL with strict timeout and validation.
        """
        target_url = settings.SENSOR_API_URL

        # Developer simulation mode (only if explicitly enabled in environment)
        if getattr(settings, "SENSOR_SIMULATION_MODE", False):
            logger.warning("SENSOR_SIMULATION_MODE is enabled: Returning simulated sensor readings.")
            return SensorReading(
                temperature=28.4,
                humidity=54.2,
                mq_raw=280.0,
                fsr_raw=2250.0,
                uptime_seconds=360,
            )

        logger.info("Requesting live sensor data from %s...", target_url)

        try:
            with httpx.Client(timeout=settings.SENSOR_TIMEOUT_SECONDS) as client:
                response = client.get(target_url)

            if response.status_code != 200:
                raise SensorServiceException(
                    f"Sensor API at {target_url} returned HTTP status {response.status_code}: {response.text[:200]}"
                )

            data = response.json()
            if not isinstance(data, dict):
                raise SensorServiceException(
                    f"Malformed sensor response from {target_url}: expected JSON object, received {type(data).__name__}"
                )

            # Validate expected fields
            required_keys = ["temperature", "humidity", "mq_raw", "fsr_raw"]
            missing_keys = [k for k in required_keys if k not in data]
            if missing_keys:
                raise SensorServiceException(
                    f"Incomplete sensor payload from {target_url}. Missing mandatory fields: {', '.join(missing_keys)}"
                )

            reading = SensorReading(
                temperature=float(data["temperature"]),
                humidity=float(data["humidity"]),
                mq_raw=float(data["mq_raw"]),
                fsr_raw=float(data["fsr_raw"]),
                uptime_seconds=int(data["uptime_seconds"]) if "uptime_seconds" in data and data["uptime_seconds"] is not None else None,
            )
            logger.info("Successfully fetched sensor readings: Temp=%.1f°C, Hum=%.1f%%, MQ=%.0f, FSR=%.0f",
                        reading.temperature, reading.humidity, reading.mq_raw, reading.fsr_raw)
            return reading

        except httpx.ConnectTimeout:
            err_msg = (
                f"Connection timed out after {settings.SENSOR_TIMEOUT_SECONDS}s attempting to reach sensor endpoint {target_url}. "
                "Ensure the IoT device is powered on and connected to the same local network."
            )
            logger.error(err_msg)
            raise SensorServiceException(err_msg, is_unreachable=True)

        except (httpx.ConnectError, httpx.NetworkError) as net_err:
            err_msg = (
                f"Unable to establish connection to sensor endpoint {target_url} ({net_err}). "
                "Please verify that the host machine is on the target subnet (e.g. 10.249.x.x) and the device is active."
            )
            logger.error(err_msg)
            raise SensorServiceException(err_msg, is_unreachable=True)

        except httpx.HTTPError as http_err:
            err_msg = f"HTTP error communicating with sensor at {target_url}: {str(http_err)}"
            logger.error(err_msg)
            raise SensorServiceException(err_msg)

        except (ValueError, TypeError) as val_err:
            err_msg = f"Invalid numeric sensor value in response from {target_url}: {str(val_err)}"
            logger.error(err_msg)
            raise SensorServiceException(err_msg)
