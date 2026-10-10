from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DATABASE: str = "surplus_food_platform"

    JWT_SECRET_KEY: str = "super_secret_hackfest_jwt_key_surplus_food_2026_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    FRONTEND_ORIGIN: str = "http://localhost:5173"

    # Trip Type 1 Geocoding & Routing Services
    OSRM_BASE_URL: str = "https://router.project-osrm.org"
    GEOCODING_PROVIDER: str = "nominatim"
    GEOCODING_API_KEY: str = ""
    MAP_STYLE_URL: str = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
    FOOD_SAFETY_MAX_HOURS: int = 12

    # IoT Sensors & Food Quality Staging
    SENSOR_API_URL: str = "http://10.249.180.92/api/data"
    SENSOR_TIMEOUT_SECONDS: float = 6.0
    SENSOR_SIMULATION_MODE: bool = False

    # Gemini AI Expiration Prediction
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins(self) -> List[str]:
        origins = [self.FRONTEND_ORIGIN.strip()]
        if "http://localhost:5173" not in origins:
            origins.append("http://localhost:5173")
        if "http://127.0.0.1:5173" not in origins:
            origins.append("http://127.0.0.1:5173")
        return origins


settings = Settings()
