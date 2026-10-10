import unittest
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.main import app
from app.core.config import settings
from app.db.mongodb import MongoDB
from app.models.donation import DonationStatus
from app.services.sensor_service import SensorReading


class TestInventoryWorkflow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_cm = TestClient(app)
        cls.client = cls.client_cm.__enter__()
        # Login as Gandhipuram Hub Admin
        login_res = cls.client.post(
            "/api/v1/auth/login",
            json={"email": "gandhipuram.hub@surplusfood.org", "password": "HubAdmin@2026", "expected_role": "hub"},
        )
        if login_res.status_code != 200:
            # Fallback credentials
            login_res = cls.client.post(
                "/api/v1/auth/login",
                json={"email": "hub.admin@surplusfood.org", "password": "HubAdmin@2026", "expected_role": "hub"},
            )
        assert login_res.status_code == 200, f"Hub login failed: {login_res.text}"
        cls.token = login_res.json()["access_token"]
        cls.headers = {"Authorization": f"Bearer {cls.token}"}

    @classmethod
    def tearDownClass(cls):
        cls.client_cm.__exit__(None, None, None)

    def test_1_get_inventory_staging(self):
        res = self.client.get("/api/v1/inventory/staging", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        print(f"\n[Test] Inventory staging returned {len(data)} arrived donations.")

    def test_2_food_test_workflow_with_simulated_readings(self):
        # Retrieve an arrived donation
        res = self.client.get("/api/v1/inventory/staging", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        staging_items = res.json()
        if not staging_items:
            self.skipTest("No staging items available for food test.")

        target = staging_items[0]
        donation_id = target["id"]

        # Mock sensor readings and Gemini AI response for test
        mock_reading = SensorReading(
            temperature=24.5,
            humidity=52.0,
            mq_raw=260.0,
            fsr_raw=2100.0,
            uptime_seconds=300,
        )

        with patch("app.services.sensor_service.SensorService.fetch_sensor_data", return_value=mock_reading), \
             patch("app.services.gemini_service.GeminiService.predict_remaining_hours", return_value=4.5):
            test_res = self.client.post(f"/api/v1/inventory/test/{donation_id}", headers=self.headers)
            self.assertEqual(test_res.status_code, 200)
            inv_data = test_res.json()

            # Assert complete copied fields and new fields
            self.assertEqual(inv_data["original_donation_id"], donation_id)
            self.assertEqual(inv_data["food_name"], target["food_name"])
            self.assertEqual(inv_data["status"], "AT_INVENTORY")
            self.assertEqual(inv_data["sensor_temperature"], 24.5)
            self.assertEqual(inv_data["sensor_humidity"], 52.0)
            self.assertEqual(inv_data["mq_raw"], 260.0)
            self.assertEqual(inv_data["fsr_raw"], 2100.0)
            self.assertEqual(inv_data["predicted_remaining_hours"], 4.5)
            self.assertGreater(inv_data["feasibility_score"], 0.5)
            print(f"[Test] Food test passed! Feasibility={inv_data['feasibility_score']}, Predicted={inv_data['predicted_remaining_hours']}h")

            # Check that donation is removed from staging
            staging_after = self.client.get("/api/v1/inventory/staging", headers=self.headers).json()
            remaining_ids = [d["id"] for d in staging_after]
            self.assertNotIn(donation_id, remaining_ids)

            # Check that donation appears in list_hub_inventory
            inv_list = self.client.get("/api/v1/inventory", headers=self.headers).json()
            inv_orig_ids = [item["original_donation_id"] for item in inv_list]
            self.assertIn(donation_id, inv_orig_ids)

            # Verify idempotency: calling test again returns existing inventory without duplicating
            repeat_res = self.client.post(f"/api/v1/inventory/test/{donation_id}", headers=self.headers)
            self.assertEqual(repeat_res.status_code, 200)
            self.assertEqual(repeat_res.json()["original_donation_id"], donation_id)


if __name__ == "__main__":
    unittest.main()
