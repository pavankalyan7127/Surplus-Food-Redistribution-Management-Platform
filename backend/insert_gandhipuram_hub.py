import sys
from pathlib import Path
from datetime import datetime, timezone
from pymongo import MongoClient

# Ensure backend root on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.core.config import settings
from app.core.security import hash_password
from app.models.user import UserRole
from app.services.geocoding_service import GeocodingService
from app.services.vehicle_service import VehicleService

def provision_gandhipuram_hub():
    # Setup DNS fallback for Windows
    try:
        import dns.resolver
        dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
        dns.resolver.default_resolver.nameservers = ['8.8.8.8', '1.1.1.1']
    except Exception:
        pass

    client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=20000)
    db = client[settings.MONGODB_DATABASE]

    hub_name = "Gandhipuram Hub"
    address = "159, 5th Street, Cross Cut Road, Gandhipuram, Coimbatore 641012"
    email = "gandhipuram.hub@surplusfood.org"
    password = "HubAdmin@2026"
    contact_name = "Gandhipuram Logistics Lead"
    phone = "+91 98765 43210"

    print(f"1. Geocoding address: '{address}' ...")
    coords = GeocodingService.geocode_address(address)
    if not coords:
        print("Geocoding failed!")
        return

    lat, lon = coords
    print(f"   -> Successfully converted to Coordinates: Latitude = {lat}, Longitude = {lon}")

    # GeoJSON format: [longitude, latitude]
    location_doc = {
        "type": "Point",
        "coordinates": [float(lon), float(lat)]
    }

    now = datetime.now(timezone.utc)
    hub_data = {
        "organization_name": hub_name,
        "contact_name": contact_name,
        "email": email.strip().lower(),
        "password_hash": hash_password(password),
        "phone": phone,
        "address": address,
        "role": UserRole.HUB.value,
        "is_active": True,
        "provider_type": None,
        "estimated_daily_meal_demand": None,
        "location": location_doc,
        "updated_at": now,
    }

    # Check if exists
    existing = db.users.find_one({"email": hub_data["email"]})
    if existing:
        db.users.update_one({"_id": existing["_id"]}, {"$set": hub_data})
        hub_id = existing["_id"]
        print(f"2. Updated existing Hub account in MongoDB (ID: {hub_id})")
    else:
        hub_data["created_at"] = now
        res = db.users.insert_one(hub_data)
        hub_id = res.inserted_id
        print(f"2. Created new Hub account in MongoDB (ID: {hub_id})")

    # Also update the default hub.admin@surplusfood.org if desired so existing logged in admin also has this real location
    existing_admin = db.users.find_one({"email": "hub.admin@surplusfood.org"})
    if existing_admin:
        db.users.update_one(
            {"_id": existing_admin["_id"]},
            {
                "$set": {
                    "organization_name": hub_name,
                    "address": address,
                    "location": location_doc,
                    "updated_at": now,
                }
            }
        )
        print(f"   -> Also synchronized coordinates to default admin account 'hub.admin@surplusfood.org' (ID: {existing_admin['_id']})")

    # 3. Seed vehicles for this hub
    print("3. Seeding vehicle fleet for Gandhipuram Hub...")
    vehicles = VehicleService.ensure_hub_vehicles(db, str(hub_id))
    for v in vehicles:
        print(f"   - Vehicle: {v['type']}, Capacity: {v['capacity']} people, Free: {v['isFree']}")

    # 4. Recalculate nearestHubId for all registered food providers
    print("4. Calculating nearest hub for all food providers...")
    updated_count = GeocodingService.recalculate_all_provider_hubs(db)
    print(f"   -> Updated nearest hub for {updated_count} food provider(s).")

    print("\n[SUCCESS] Hub data inserted and verified in MongoDB:")
    print(f"   - Hub Name:         {hub_name}")
    print(f"   - Address:          {address}")
    print(f"   - GeoJSON Location: {location_doc}")
    print(f"   - Latitude:         {lat}")
    print(f"   - Longitude:        {lon}")
    print(f"   - Login Email:      {email}")
    print(f"   - Login Password:   {password}")
    print("   - Also synchronized to: hub.admin@surplusfood.org (HubAdmin@2026)")

if __name__ == "__main__":
    provision_gandhipuram_hub()
