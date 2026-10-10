import logging
import math
import urllib.parse
import urllib.request
import json
import re
from typing import Optional, Tuple
from pymongo.database import Database

from app.core.config import settings

logger = logging.getLogger("app.services.geocoding")


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in kilometers between two lat/lon coordinates."""
    r = 6371.0  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


class GeocodingService:
    @staticmethod
    def geocode_address(address: str) -> Optional[Tuple[float, float]]:
        """
        Geocode physical address to (latitude, longitude).
        Uses intelligent multi-tier matching:
        1. Fuzzy OpenStreetMap lookup (Photon API)
        2. Strict Nominatim with progressive address fallback (removes door numbers / handles landmarks)
        """
        if not address or not address.strip():
            return None

        # Clean dashes and whitespace
        clean_address = re.sub(r'[–—]', '-', address.strip())

        # 1. Try Photon fuzzy OpenStreetMap lookup
        try:
            encoded_query = urllib.parse.quote(clean_address)
            url = f"https://photon.komoot.io/api/?q={encoded_query}&limit=1"
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "SurplusFoodRedistributionPlatform/1.0 (HackFest 2026)"},
            )
            with urllib.request.urlopen(req, timeout=3.5) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode())
                    features = data.get("features", [])
                    if features and len(features) > 0:
                        coords = features[0]["geometry"]["coordinates"] # [lon, lat]
                        return (float(coords[1]), float(coords[0]))
        except Exception as exc:
            logger.debug("Photon lookup attempted: %s", exc)

        # 2. Build progressive candidate queries for Nominatim
        candidates = [clean_address]

        # Strip door/shop/flat numbers like '87, ' or '#12/A, '
        no_door = re.sub(r'^(?:#?\d+[\w\/\-\.]*[\s,]+)+', '', clean_address).strip()
        if no_door and no_door != clean_address:
            candidates.append(no_door)

        # Split comma-separated components
        parts = [p.strip() for p in clean_address.split(',') if p.strip()]
        if len(parts) >= 3:
            # e.g. [road, city]
            candidates.append(f"{parts[1]}, {parts[-1]}")
            if len(parts) >= 4:
                candidates.append(f"{parts[1]}, {parts[-2]}")
                candidates.append(f"{parts[2]}, {parts[-1]}")

        # 3. Query Nominatim with candidate queries
        for q in candidates:
            try:
                encoded_query = urllib.parse.quote(q)
                url = f"https://nominatim.openstreetmap.org/search?q={encoded_query}&format=json&limit=1"
                req = urllib.request.Request(
                    url,
                    headers={"User-Agent": "SurplusFoodRedistributionPlatform/1.0 (HackFest 2026)"},
                )
                with urllib.request.urlopen(req, timeout=3.5) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode())
                        if data and len(data) > 0:
                            lat = float(data[0]["lat"])
                            lon = float(data[0]["lon"])
                            return (lat, lon)
            except Exception as exc:
                logger.debug("Nominatim attempt for '%s' failed: %s", q, exc)

        logger.warning("All geocoding attempts failed for address '%s'", clean_address)
        return None

    @staticmethod
    def find_nearest_eligible_hub(
        db: Database, lat: float, lon: float
    ) -> Optional[dict]:
        """
        Find nearest eligible hub with valid coordinates.
        Does NOT assign arbitrary hub if no hubs have valid coordinates.
        """
        hubs = list(db.users.find({"role": "hub", "is_active": True}))
        eligible_hubs = []

        for hub in hubs:
            loc = hub.get("location")
            if loc and isinstance(loc, dict) and loc.get("type") == "Point":
                coords = loc.get("coordinates")
                if isinstance(coords, (list, tuple)) and len(coords) == 2:
                    # GeoJSON is [lon, lat]
                    hub_lon, hub_lat = float(coords[0]), float(coords[1])
                    dist = calculate_haversine_distance(lat, lon, hub_lat, hub_lon)
                    eligible_hubs.append((dist, hub))

        if not eligible_hubs:
            return None

        # Sort by shortest distance
        eligible_hubs.sort(key=lambda x: x[0])
        return eligible_hubs[0][1]

    @staticmethod
    def recalculate_all_provider_hubs(db: Database) -> int:
        """
        Recalculates nearestHubId for all registered providers when hub locations change.
        Returns number of providers updated.
        """
        providers = list(db.users.find({"role": "provider"}))
        updated_count = 0

        for provider in providers:
            loc = provider.get("location")
            if loc and isinstance(loc, dict) and loc.get("type") == "Point":
                coords = loc.get("coordinates")
                if isinstance(coords, (list, tuple)) and len(coords) == 2:
                    prov_lon, prov_lat = float(coords[0]), float(coords[1])
                    nearest_hub = GeocodingService.find_nearest_eligible_hub(db, prov_lat, prov_lon)
                    hub_id_str = str(nearest_hub["_id"]) if nearest_hub else None
                    if provider.get("nearest_hub_id") != hub_id_str:
                        db.users.update_one(
                            {"_id": provider["_id"]},
                            {"$set": {"nearest_hub_id": hub_id_str}}
                        )
                        updated_count += 1

        return updated_count
