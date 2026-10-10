import unittest
from app.services.feasibility_service import (
    FeasibilityService,
    WEIGHT_TEMPERATURE,
    WEIGHT_HUMIDITY,
    WEIGHT_MQ_GAS,
    WEIGHT_FSR_LOAD,
)


class TestFeasibilityService(unittest.TestCase):
    def test_weights_sum_to_one(self):
        total_weight = WEIGHT_TEMPERATURE + WEIGHT_HUMIDITY + WEIGHT_MQ_GAS + WEIGHT_FSR_LOAD
        self.assertAlmostEqual(total_weight, 1.0, places=5)
        self.assertEqual(WEIGHT_TEMPERATURE, 0.45)
        self.assertEqual(WEIGHT_HUMIDITY, 0.20)
        self.assertEqual(WEIGHT_MQ_GAS, 0.20)
        self.assertEqual(WEIGHT_FSR_LOAD, 0.15)

    def test_ideal_conditions_room_temp(self):
        # 22°C (room temp ideal), 50% humidity (ideal), MQ=240 (below baseline), FSR=2000 (ideal)
        score, breakdown = FeasibilityService.calculate_feasibility(
            temperature=22.0,
            humidity=50.0,
            mq_raw=240.0,
            fsr_raw=2000.0,
            storage_requirements="Room Temperature",
        )
        self.assertEqual(breakdown.temperature_score, 1.0)
        self.assertEqual(breakdown.humidity_score, 1.0)
        self.assertEqual(breakdown.mq_score, 1.0)
        self.assertEqual(breakdown.fsr_score, 1.0)
        self.assertEqual(score, 1.0)

    def test_sample_sensor_readings(self):
        # Example from prompt: temp=30.2, humidity=58.6, mq_raw=289, fsr_raw=2390
        score, breakdown = FeasibilityService.calculate_feasibility(
            temperature=30.2,
            humidity=58.6,
            mq_raw=289.0,
            fsr_raw=2390.0,
            storage_requirements="Room Temperature",
        )
        self.assertGreater(score, 0.60)
        self.assertLessEqual(score, 1.0)
        self.assertEqual(breakdown.humidity_score, 1.0)
        self.assertEqual(breakdown.fsr_score, 1.0)
        self.assertGreater(breakdown.mq_score, 0.90)

    def test_severe_spoilage_and_temperature_breach(self):
        # Hot 45°C for refrigerated food, 95% humidity, MQ=1000 (heavy gas), FSR=100 (loose)
        score, breakdown = FeasibilityService.calculate_feasibility(
            temperature=45.0,
            humidity=95.0,
            mq_raw=1000.0,
            fsr_raw=100.0,
            storage_requirements="Refrigerated (Cold Chain)",
        )
        self.assertEqual(breakdown.temperature_score, 0.0)
        self.assertEqual(breakdown.mq_score, 0.0)
        self.assertEqual(breakdown.fsr_score, 0.0)
        self.assertLess(score, 0.10)

    def test_refrigerated_storage_compliance(self):
        # 3.0°C is within 0-4°C ideal
        st = FeasibilityService.calculate_temperature_score(3.0, "Refrigerated (Cold Chain)")
        self.assertEqual(st, 1.0)

        # 10.0°C is outside refrigerated range
        st_warm = FeasibilityService.calculate_temperature_score(10.0, "Refrigerated (Cold Chain)")
        self.assertLess(st_warm, 0.5)

    def test_hot_holding_compliance(self):
        # 65°C is ideal hot holding (>= 60°C)
        st = FeasibilityService.calculate_temperature_score(65.0, "Hot Holding")
        self.assertEqual(st, 1.0)

        # 30°C is cold for hot holding
        st_cold = FeasibilityService.calculate_temperature_score(30.0, "Hot Holding")
        self.assertEqual(st_cold, 0.0)


class TestGeminiService(unittest.TestCase):
    def test_valid_numeric_parsing(self):
        from app.services.gemini_service import GeminiService
        self.assertEqual(GeminiService.parse_and_validate_prediction("3.4"), 3.4)
        self.assertEqual(GeminiService.parse_and_validate_prediction("0"), 0.0)
        self.assertEqual(GeminiService.parse_and_validate_prediction("  12.5 \n"), 12.5)
        self.assertEqual(GeminiService.parse_and_validate_prediction("```json\n4.25\n```"), 4.25)

    def test_negative_value_rejected(self):
        from app.services.gemini_service import GeminiService, GeminiServiceException
        with self.assertRaises(GeminiServiceException):
            GeminiService.parse_and_validate_prediction("-2.5")

    def test_invalid_text_rejected(self):
        from app.services.gemini_service import GeminiService, GeminiServiceException
        with self.assertRaises(GeminiServiceException):
            GeminiService.parse_and_validate_prediction("The food looks okay")

        with self.assertRaises(GeminiServiceException):
            GeminiService.parse_and_validate_prediction("")

    def test_maximum_reasonable_cap(self):
        from app.services.gemini_service import GeminiService
        capped = GeminiService.parse_and_validate_prediction("9999.0")
        self.assertEqual(capped, 168.0)


if __name__ == "__main__":
    unittest.main()
