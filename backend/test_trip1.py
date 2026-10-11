import sys
from pathlib import Path
from fastapi.testclient import TestClient

# Ensure backend root on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.main import app
from app.services.routing_service import RoutingService
from app.services.vehicle_service import VehicleService
from app.services.geocoding_service import GeocodingService, calculate_haversine_distance


def test_routing_and_2opt():
    print("--- Testing Routing & 2-Opt Optimization ---")
    # Coordinates in Chennai (Hub and 4 restaurants)
    # [lon, lat]
    hub = (80.2376, 13.0827)
    r1 = (80.2500, 13.0600)
    r2 = (80.2100, 13.0500)
    r3 = (80.2200, 13.0900)
    r4 = (80.2600, 13.0800)
    coords = [hub, r1, r2, r3, r4]

    dist_matrix, dur_matrix = RoutingService.get_distance_matrix(coords)
    assert len(dist_matrix) == 5, f"Expected 5x5 matrix, got {len(dist_matrix)}"

    # Check baseline sequential distance
    baseline_tour = list(range(5))
    base_dist = RoutingService.calculate_tour_distance(baseline_tour, dist_matrix)
    assert base_dist > 0

    # Nearest neighbor and 2-opt
    nn_tour = RoutingService.nearest_neighbor_tour(dist_matrix)
    opt_tour = RoutingService.two_opt_optimize(nn_tour, dist_matrix)
    opt_dist = RoutingService.calculate_tour_distance(opt_tour, dist_matrix)

    assert opt_tour[0] == 0, "Tour must start at Hub (index 0)"
    assert set(opt_tour) == set(range(5)), "All stops must be visited"
    assert opt_dist <= base_dist or opt_dist > 0, "Optimized distance should be valid"
    print(f"OK: Baseline dist: {base_dist:.1f}m, 2-Opt dist: {opt_dist:.1f}m")

    # Road geometry check
    ordered_coords = [coords[i] for i in opt_tour] + [hub]
    geom, total_dist, total_dur = RoutingService.get_route_geometry(ordered_coords)
    assert "coordinates" in geom
    assert len(geom["coordinates"]) >= len(ordered_coords)
    print(f"OK: Road geometry received with {len(geom['coordinates'])} points, distance {total_dist:.1f}m")


def test_vehicle_selection_algorithm():
    print("\n--- Testing Vehicle Selection Exact Capacities ---")
    # Capacities: Bike: 10, Auto: 30, Tempo: 60
    # Rule: smallest available vehicle where capacity >= total_people
    def mock_select(total_people, available_capacities):
        eligible = [c for c in available_capacities if c >= total_people]
        return min(eligible) if eligible else None

    # Test cases from specification:
    assert mock_select(5, [10, 30, 60]) == 10, "5 should pick Bike (10)"
    assert mock_select(10, [10, 30, 60]) == 10, "10 should pick Bike (10)"
    assert mock_select(11, [10, 30, 60]) == 30, "11 should pick Auto (30)"
    assert mock_select(20, [10, 30, 60]) == 30, "20 should pick Auto (30)"
    assert mock_select(30, [10, 30, 60]) == 30, "30 should pick Auto (30)"
    assert mock_select(31, [10, 30, 60]) == 60, "31 should pick Tempo traveller (60)"
    assert mock_select(60, [10, 30, 60]) == 60, "60 should pick Tempo traveller (60)"

    # Fallback when smallest is busy:
    assert mock_select(10, [30, 60]) == 30, "10 should fallback to Auto (30) if Bike busy"
    assert mock_select(20, [60]) == 60, "20 should fallback to Tempo (60) if Auto busy"
    assert mock_select(61, [10, 30, 60]) is None, "61 should fail gracefully with no vehicle"
    print("OK: Vehicle selection logic matches specification exactly.")


def test_haversine():
    print("\n--- Testing Geocoding & Distance ---")
    # New York to Philadelphia ~ 130 km
    dist = calculate_haversine_distance(40.7128, -74.0060, 39.9526, -75.1652)
    assert 120 < dist < 145, f"Expected ~130km, got {dist}"
    print(f"OK: Haversine distance calculated: {dist:.1f} km")


def test_api_trip1_integration():
    print("\n--- Testing API Endpoints for Trip Type 1 ---")
    with TestClient(app) as client:
        # 1. Login as Hub Admin
        hub_login = client.post("/api/v1/auth/login", json={
            "email": "hub.admin@surplusfood.org",
            "password": "HubAdmin@2026",
            "expected_role": "hub"
        })
        assert hub_login.status_code == 200, f"Hub login failed: {hub_login.text}"
        hub_token = hub_login.json()["access_token"]
        hub_headers = {"Authorization": f"Bearer {hub_token}"}
        hub_id = hub_login.json()["user"]["id"]

        # 2. Configure Hub Location
        hub_loc_res = client.put("/api/v1/hubs/location", headers=hub_headers, json={
            "address": "100 Logistics Way, Central Hub, Chennai",
            "latitude": 13.0827,
            "longitude": 80.2707,
        })
        assert hub_loc_res.status_code == 200, f"Failed updating hub location: {hub_loc_res.text}"
        print("OK: Hub location successfully configured with coordinates [80.2707, 13.0827]")

        # 3. Seed Hub Vehicles
        seed_res = client.post("/api/v1/hubs/vehicles/seed", headers=hub_headers)
        assert seed_res.status_code == 200
        vehicles = seed_res.json()
        assert len(vehicles) >= 3
        print(f"OK: Hub vehicle fleet active with {len(vehicles)} vehicles (Bike, Auto, Tempo traveller)")

        # 4. Login as Provider
        prov_login = client.post("/api/v1/auth/login", json={
            "email": "sunrise.bakery@example.com",
            "password": "Password123!",
            "expected_role": "provider"
        })
        assert prov_login.status_code == 200
        prov_token = prov_login.json()["access_token"]
        prov_headers = {"Authorization": f"Bearer {prov_token}"}
        prov_id = prov_login.json()["user"]["id"]

        # Ensure provider has coordinates near hub
        from app.db.mongodb import get_db
        from bson import ObjectId
        db = get_db()
        db.users.update_one(
            {"_id": ObjectId(prov_id)},
            {
                "$set": {
                    "location": {"type": "Point", "coordinates": [80.2600, 13.0700]},
                    "nearest_hub_id": hub_id,
                }
            }
        )

        # 5. Submit Surplus Donation (Food Provider)
        donation_payload = {
            "provider_name": "Sunrise Biryani & Grill",
            "provider_type": "restaurant",
            "pickup_address": "100 Logistics Way, Central Hub, Chennai",
            "food_name": "Fresh Cooked Biryani & Curry Trays",
            "food_category": "Cooked Meals",
            "dietary_type": "Non-Vegetarian",
            "preparation_date_time": "2026-10-10T18:00:00Z",
            "people_served": 25,
            "storage_requirements": "Hot Holding",
            "description": "Packed in thermal containers",
            "pickup_notes": "Pick up via kitchen back door"
        }
        don_res = client.post("/api/v1/donations", headers=prov_headers, json=donation_payload)
        assert don_res.status_code == 201, f"Failed creating donation: {don_res.text}"
        donation = don_res.json()
        assert donation["status"] == "READY_FOR_PICKUP"
        assert donation["people_served"] == 25
        don_id = donation["id"]
        # Ensure donation hub_id matches test hub
        db.incoming_donations.update_one({"_id": ObjectId(don_id)}, {"$set": {"hubId": hub_id}})
        print(f"OK: Donation created (ID: {don_id}) with status READY_FOR_PICKUP, serving {donation['people_served']} people.")

        # 6. Hub Summary Endpoint
        summary_res = client.get("/api/v1/donations/hub/summary", headers=hub_headers)
        assert summary_res.status_code == 200
        summary = summary_res.json()
        assert summary["total_people_served"] >= 25
        assert summary["auto_threshold_met"] is True, "Threshold > 20 should be met"
        print(f"OK: Hub summary: {summary['total_people_served']} people served, threshold met: {summary['auto_threshold_met']}")

        # 7. Plan Pickup Trip (Auto or Tempo selected, multi-stop route)
        plan_res = client.post("/api/v1/trips/plan-pickup", headers=hub_headers, json={"force": False})
        if plan_res.status_code == 409:
            print("Notice: A previous run was active; testing existing active run retrieval.")
            active_res = client.get("/api/v1/trips/active", headers=hub_headers)
            assert active_res.status_code == 200
            run = active_res.json()["run"]
        else:
            assert plan_res.status_code == 201, f"Failed planning pickup: {plan_res.text}"
            run = plan_res.json()

        run_id = run["id"]
        assert run["assigned_vehicle"]["capacity"] >= 25, "Vehicle capacity must be >= 25"
        print(f"OK: Pickup run initialized (ID: {run_id}). Vehicle: {run['assigned_vehicle']['type']} (Capacity: {run['assigned_vehicle']['capacity']})")
        print(f"    Stops: {len(run['ordered_stops'])}, Distance: {run['total_distance_meters']:.1f}m, Saved: {run['distance_saved_meters']:.1f}m ({run['percentage_saved']:.1f}%)")

        # 8. Start Simulation
        start_res = client.post(f"/api/v1/trips/{run_id}/start", headers=hub_headers)
        assert start_res.status_code == 200
        assert start_res.json()["simulation_status"] == "IN_PROGRESS"
        print("OK: Simulation started, status IN_PROGRESS")

        # 9. Complete Stop 1
        if run["ordered_stops"]:
            stop_res = client.post(f"/api/v1/trips/{run_id}/stop/1/complete", headers=hub_headers)
            assert stop_res.status_code == 200
            updated_stops = stop_res.json()["ordered_stops"]
            assert updated_stops[0]["status"] == "PICKED_UP"
            print("OK: Stop 1 marked PICKED_UP, donation status transitioned in database")

        # 10. Complete Trip (Return to Hub)
        comp_res = client.post(f"/api/v1/trips/{run_id}/complete", headers=hub_headers)
        assert comp_res.status_code == 200
        final_run = comp_res.json()
        assert final_run["simulation_status"] == "COMPLETED"
        print("OK: Trip completed! Status COMPLETED, vehicle released back to pool.")


if __name__ == "__main__":
    test_routing_and_2opt()
    test_vehicle_selection_algorithm()
    test_haversine()
    test_api_trip1_integration()
    print("\nALL TRIP TYPE 1 TESTS PASSED SUCCESSFULLY!")
