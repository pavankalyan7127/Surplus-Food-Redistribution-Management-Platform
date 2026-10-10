import sys
from pathlib import Path
from fastapi.testclient import TestClient

# Ensure backend root on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.main import app

def test_full_flow():
    with TestClient(app) as client:
        print("--- 1. Testing Health Endpoints ---")
        res = client.get("/api/v1/health")
        assert res.status_code == 200, f"Health check failed: {res.text}"
        print("OK: /api/v1/health returned 200", res.json())

        res_db = client.get("/api/v1/health/db")
        assert res_db.status_code == 200, f"DB Health check failed: {res_db.text}"
        print("OK: /api/v1/health/db returned 200", res_db.json())

        print("\n--- 2. Testing Provider Registration & Login ---")
        provider_data = {
            "organization_name": "Sunrise Bakery & Cafe",
            "contact_name": "Maria Rossi",
            "email": "sunrise.bakery@example.com",
            "password": "Password123!",
            "phone": "+1-555-0101",
            "address": "45 Baker Street, Market District",
            "provider_type": "bakery"
        }
        reg_res = client.post("/api/v1/auth/signup/provider", json=provider_data)
        if reg_res.status_code == 201:
            print("OK: Provider registered successfully:", reg_res.json()["email"])
        elif reg_res.status_code == 400 and "already exists" in reg_res.text:
            print("OK: Provider already registered in Atlas")
        else:
            assert False, f"Provider registration failed: {reg_res.text}"

        assert "password" not in reg_res.text
        assert "password_hash" not in reg_res.text

        # Provider Login
        login_res = client.post("/api/v1/auth/login", json={
            "email": "sunrise.bakery@example.com",
            "password": "Password123!",
            "expected_role": "provider"
        })
        assert login_res.status_code == 200, f"Provider login failed: {login_res.text}"
        token_data = login_res.json()
        provider_token = token_data["access_token"]
        print("OK: Provider login succeeded, token received.")

        # Provider accessing /providers/me
        headers = {"Authorization": f"Bearer {provider_token}"}
        me_res = client.get("/api/v1/providers/me", headers=headers)
        assert me_res.status_code == 200
        assert me_res.json()["role"] == "provider"
        print("OK: /api/v1/providers/me accessible by provider")

        # Provider attempting to access hub endpoint -> Expect 403 Forbidden
        hub_res = client.get("/api/v1/hubs/me", headers=headers)
        assert hub_res.status_code == 403, f"Expected 403, got: {hub_res.status_code}"
        print("OK: Provider correctly blocked from /api/v1/hubs/me with 403")

        # Provider attempting to login with wrong role 'ngo' -> Expect 401
        bad_role_login = client.post("/api/v1/auth/login", json={
            "email": "sunrise.bakery@example.com",
            "password": "Password123!",
            "expected_role": "ngo"
        })
        assert bad_role_login.status_code == 401, f"Expected 401, got: {bad_role_login.status_code}"
        print("OK: Role mismatch login correctly blocked with 401")

        print("\n--- 3. Testing NGO Registration & Login ---")
        ngo_data = {
            "organization_name": "Hope Community Kitchen",
            "contact_name": "David Chen",
            "email": "hope.kitchen@example.org",
            "password": "HopeKitchen2026!",
            "phone": "+1-555-0202",
            "address": "88 Shelter Ave, Downtown",
            "estimated_daily_meal_demand": 250
        }
        ngo_reg = client.post("/api/v1/auth/signup/ngo", json=ngo_data)
        if ngo_reg.status_code == 201:
            print("OK: NGO registered successfully:", ngo_reg.json()["email"])
        elif ngo_reg.status_code == 400 and "already exists" in ngo_reg.text:
            print("OK: NGO already registered in Atlas")
        else:
            assert False, f"NGO registration failed: {ngo_reg.text}"

        # NGO Login
        ngo_login = client.post("/api/v1/auth/login", json={
            "email": "hope.kitchen@example.org",
            "password": "HopeKitchen2026!",
            "expected_role": "ngo"
        })
        assert ngo_login.status_code == 200, f"NGO login failed: {ngo_login.text}"
        ngo_token = ngo_login.json()["access_token"]
        print("OK: NGO login succeeded, token received.")

        # NGO accessing /ngos/me
        ngo_headers = {"Authorization": f"Bearer {ngo_token}"}
        ngo_me = client.get("/api/v1/ngos/me", headers=ngo_headers)
        assert ngo_me.status_code == 200
        assert ngo_me.json()["role"] == "ngo"
        print("OK: /api/v1/ngos/me accessible by NGO")

        print("\n--- 4. Testing Hub Login (Provisioned Admin) ---")
        hub_login = client.post("/api/v1/auth/login", json={
            "email": "hub.admin@surplusfood.org",
            "password": "HubAdmin@2026",
            "expected_role": "hub"
        })
        assert hub_login.status_code == 200, f"Hub login failed: {hub_login.text}"
        hub_token = hub_login.json()["access_token"]
        print("OK: Hub login succeeded, token received.")

        # Hub accessing /hubs/me
        hub_headers = {"Authorization": f"Bearer {hub_token}"}
        hub_me = client.get("/api/v1/hubs/me", headers=hub_headers)
        assert hub_me.status_code == 200
        assert hub_me.json()["role"] == "hub"
        print("OK: /api/v1/hubs/me accessible by Hub Admin")

        print("\n--- 5. Testing Trip Type 1 Endpoints & IoT Placeholder ---")
        donations_res = client.get("/api/v1/donations", headers=headers)
        assert donations_res.status_code == 200, f"Expected 200, got {donations_res.status_code}"
        print("OK: /api/v1/donations returned 200 (Trip Type 1 Active)")

        trips_res = client.get("/api/v1/trips", headers=headers)
        assert trips_res.status_code == 200, f"Expected 200, got {trips_res.status_code}"
        print("OK: /api/v1/trips returned 200 (Trip Type 1 Active)")

        iot_res = client.get("/api/v1/iot/telemetry", headers=hub_headers)
        assert iot_res.status_code == 501, f"Expected 501, got {iot_res.status_code}"
        print("OK: /api/v1/iot/telemetry returned 501 Not Implemented for Team Member 3")

        print("\nALL BACKEND API TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_full_flow()
