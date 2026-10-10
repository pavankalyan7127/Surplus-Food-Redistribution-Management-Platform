import logging
from typing import Dict, Any, Tuple
from app.models.donation import StorageRequirement
from app.models.inventory import FeasibilityBreakdown

logger = logging.getLogger("app.services.feasibility_service")

# Exact formula weights specified in the project definition
WEIGHT_TEMPERATURE = 0.45
WEIGHT_HUMIDITY = 0.20
WEIGHT_MQ_GAS = 0.20
WEIGHT_FSR_LOAD = 0.15


class FeasibilityService:
    @staticmethod
    def calculate_temperature_score(temperature: float, storage_req: str) -> float:
        """
        Calculates ST in [0.0, 1.0]: Compliance with selected storage-temperature range.
        Handles: Room Temperature, Refrigerated (Cold Chain), Frozen, Hot Holding.
        """
        req_normalized = (storage_req or "").lower().strip()

        if "refrigerat" in req_normalized or "cold" in req_normalized:
            # Ideal: 0°C to 4°C, safe margin -2°C to 8°C
            ideal_min, ideal_max = 0.0, 4.0
            tol_low, tol_high = 2.0, 4.0
            if ideal_min <= temperature <= ideal_max:
                return 1.0
            elif temperature < ideal_min:
                return max(0.0, 1.0 - (ideal_min - temperature) / tol_low)
            else:
                return max(0.0, 1.0 - (temperature - ideal_max) / tol_high)

        elif "frozen" in req_normalized:
            # Ideal: <= -18°C, acceptable up to -10°C
            if temperature <= -18.0:
                return 1.0
            elif temperature >= -5.0:
                return 0.0
            else:
                return max(0.0, 1.0 - (temperature - (-18.0)) / 13.0)

        elif "hot" in req_normalized:
            # Ideal: >= 60°C, acceptable down to 50°C
            if temperature >= 60.0:
                return 1.0
            elif temperature <= 40.0:
                return 0.0
            else:
                return max(0.0, 1.0 - (60.0 - temperature) / 20.0)

        else:
            # Room Temperature (Default)
            # Ideal: 18°C to 25°C, acceptable 12°C to 32°C
            ideal_min, ideal_max = 18.0, 25.0
            tol_low, tol_high = 6.0, 7.0
            if ideal_min <= temperature <= ideal_max:
                return 1.0
            elif temperature < ideal_min:
                return max(0.0, 1.0 - (ideal_min - temperature) / tol_low)
            else:
                return max(0.0, 1.0 - (temperature - ideal_max) / tol_high)

    @staticmethod
    def calculate_humidity_score(humidity: float) -> float:
        """
        Calculates SH in [0.0, 1.0]: Compliance with configured humidity range.
        Ideal range for storage environment: 40% to 65% RH.
        """
        ideal_min, ideal_max = 40.0, 65.0
        tol_low, tol_high = 15.0, 20.0

        if ideal_min <= humidity <= ideal_max:
            return 1.0
        elif humidity < ideal_min:
            return max(0.0, 1.0 - (ideal_min - humidity) / tol_low)
        else:
            return max(0.0, 1.0 - (humidity - ideal_max) / tol_high)

    @staticmethod
    def calculate_mq_gas_score(mq_raw: float, baseline: float = 250.0, critical_threshold: float = 900.0) -> float:
        """
        Calculates SM in [0.0, 1.0]: Deviation from a calibrated environmental gas-sensor baseline.
        Clean baseline is ~250. Spoilage/VOC gases cause reading to climb towards 900+.
        """
        if mq_raw <= baseline:
            return 1.0
        elif mq_raw >= critical_threshold:
            return 0.0
        else:
            span = critical_threshold - baseline
            return max(0.0, min(1.0, 1.0 - (mq_raw - baseline) / span))

    @staticmethod
    def calculate_fsr_load_score(fsr_raw: float) -> float:
        """
        Calculates SF in [0.0, 1.0]: Compliance with a configured pressure or load range.
        Expected load range: 1000 to 3200 ADC units.
        """
        ideal_min, ideal_max = 1000.0, 3200.0
        tol_low, tol_high = 600.0, 700.0

        if ideal_min <= fsr_raw <= ideal_max:
            return 1.0
        elif fsr_raw < ideal_min:
            return max(0.0, 1.0 - (ideal_min - fsr_raw) / tol_low)
        else:
            return max(0.0, 1.0 - (fsr_raw - ideal_max) / tol_high)

    @classmethod
    def calculate_feasibility(
        cls,
        temperature: float,
        humidity: float,
        mq_raw: float,
        fsr_raw: float,
        storage_requirements: str = "Room Temperature",
    ) -> Tuple[float, FeasibilityBreakdown]:
        """
        Calculates the complete feasibility score:
        S = wT * ST + wH * SH + wM * SM + wF * SF
        Returns (composite_score, FeasibilityBreakdown).
        """
        st = cls.calculate_temperature_score(temperature, storage_requirements)
        sh = cls.calculate_humidity_score(humidity)
        sm = cls.calculate_mq_gas_score(mq_raw)
        sf = cls.calculate_fsr_load_score(fsr_raw)

        composite = (
            WEIGHT_TEMPERATURE * st +
            WEIGHT_HUMIDITY * sh +
            WEIGHT_MQ_GAS * sm +
            WEIGHT_FSR_LOAD * sf
        )
        composite_clamped = round(max(0.0, min(1.0, composite)), 4)

        breakdown = FeasibilityBreakdown(
            temperature_score=round(st, 4),
            humidity_score=round(sh, 4),
            mq_score=round(sm, 4),
            fsr_score=round(sf, 4),
            composite_score=composite_clamped,
        )

        logger.info(
            "Feasibility Calculated: S=%.4f (ST=%.3f, SH=%.3f, SM=%.3f, SF=%.3f)",
            composite_clamped, st, sh, sm, sf
        )

        return composite_clamped, breakdown
