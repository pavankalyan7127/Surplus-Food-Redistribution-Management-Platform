import re
import math
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from app.core.config import settings

logger = logging.getLogger("app.services.gemini_service")

SYSTEM_INSTRUCTION = (
    "You are a food-condition analysis component for a food redistribution prototype. "
    "Analyze the supplied food metadata, preparation time, storage conditions, sensor readings, and feasibility score "
    "to estimate the remaining usable time in hours.\n\n"
    "Return exactly one numeric value representing the estimated remaining time in hours. "
    "Do not return explanations, labels, units, Markdown, JSON, or any other text.\n\n"
    "For example, a response of 3.4 represents 3.4 decimal hours, which equals 3 hours and 24 minutes. "
    "Do not interpret 3.4 as 3 hours and 40 minutes.\n\n"
    "Do not fabricate missing sensor values or food metadata. If the supplied information is insufficient "
    "to produce a defensible estimate, or the food appears unsafe, return a value of 0 rather than inventing a reassuring estimate.\n\n"
    "This is an experimental prototype prediction, not a validated food-safety certification."
)

MAX_REASONABLE_HOURS = 168.0  # 7 days max boundary for surplus perishable food


class GeminiServiceException(Exception):
    """Raised when Gemini AI prediction fails or returns invalid output."""
    def __init__(self, message: str, is_config_error: bool = False):
        super().__init__(message)
        self.message = message
        self.is_config_error = is_config_error


class GeminiService:
    @staticmethod
    def parse_and_validate_prediction(raw_text: str) -> float:
        """
        Validates that the AI response is a finite non-negative number within [0, MAX_REASONABLE_HOURS].
        """
        if not raw_text or not raw_text.strip():
            raise GeminiServiceException("Gemini returned an empty response.")

        clean_text = raw_text.strip()
        # Clean any accidental markdown code blocks
        clean_text = re.sub(r"^```(?:json|text)?", "", clean_text).strip("` \n\r\t")

        # Match single numeric decimal or integer
        match = re.search(r"[-+]?\d*\.?\d+", clean_text)
        if not match:
            raise GeminiServiceException(
                f"Gemini response did not contain a valid numeric value. Received: '{raw_text[:100]}'"
            )

        try:
            val = float(match.group(0))
        except ValueError:
            raise GeminiServiceException(f"Failed to parse numeric value from Gemini response: '{raw_text[:100]}'")

        if math.isnan(val) or math.isinf(val):
            raise GeminiServiceException("Gemini returned a non-finite numerical value (NaN/Infinity).")

        if val < 0:
            raise GeminiServiceException(f"Gemini returned an invalid negative prediction: {val} hours.")

        if val > MAX_REASONABLE_HOURS:
            logger.warning("Gemini prediction %f hours exceeds maximum bound of %f hours. Capping to max.", val, MAX_REASONABLE_HOURS)
            val = MAX_REASONABLE_HOURS

        return round(val, 2)

    @classmethod
    def predict_remaining_hours(
        cls,
        food_data: Dict[str, Any],
        sensor_data: Dict[str, Any],
        feasibility_score: float,
    ) -> float:
        """
        Executes Gemini AI expiration prediction with full food metadata and sensor readings.
        """
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            err_msg = (
                "GEMINI_API_KEY is not configured on the backend server. "
                "Please configure GEMINI_API_KEY in backend/.env to enable AI food expiration prediction."
            )
            logger.error(err_msg)
            raise GeminiServiceException(err_msg, is_config_error=True)

        # Build comprehensive structured prompt
        prep_time = food_data.get("preparationDateTime") or food_data.get("preparation_date_time")
        now = datetime.now(timezone.utc)
        elapsed_hours = 0.0
        if isinstance(prep_time, datetime):
            if prep_time.tzinfo is None:
                prep_time = prep_time.replace(tzinfo=timezone.utc)
            elapsed_hours = max(0.0, round((now - prep_time).total_seconds() / 3600.0, 1))

        prompt_lines = [
            "FOOD DONATION ITEM CONTEXT:",
            f"- Food Name: {food_data.get('foodName') or food_data.get('food_name', 'Unknown')}",
            f"- Category: {food_data.get('foodCategory') or food_data.get('food_category', 'Cooked Meals')}",
            f"- Dietary Type: {food_data.get('dietaryType') or food_data.get('dietary_type', 'Vegetarian')}",
            f"- Storage Requirements: {food_data.get('storageRequirements') or food_data.get('storage_requirements', 'Room Temperature')}",
            f"- People Served: {food_data.get('peopleServed') or food_data.get('people_served', 0)}",
            f"- Description: {food_data.get('description', 'N/A')}",
            f"- Pickup Notes: {food_data.get('pickupNotes') or food_data.get('pickup_notes', 'N/A')}",
            f"- Time Elapsed Since Preparation: {elapsed_hours} hours",
            "",
            "LIVE IOT SENSOR READINGS AT SMART HUB:",
            f"- Temperature: {sensor_data.get('temperature')} °C",
            f"- Relative Humidity: {sensor_data.get('humidity')} %",
            f"- MQ Gas Sensor Raw: {sensor_data.get('mq_raw')}",
            f"- FSR Pressure/Load Raw: {sensor_data.get('fsr_raw')}",
            f"- Sensor Uptime: {sensor_data.get('uptime_seconds', 'N/A')} seconds",
            "",
            "COMPUTED QUALITY METRICS:",
            f"- Overall Feasibility Score (0.0 to 1.0): {feasibility_score}",
            "",
            "Estimate the remaining safe usable shelf-life in decimal hours:",
        ]
        user_prompt = "\n".join(prompt_lines)

        logger.info("Calling Gemini AI (%s) for food expiration prediction...", settings.GEMINI_MODEL)

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)
            config = types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.1,
            )

            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=user_prompt,
                config=config,
            )

            raw_prediction = response.text
            logger.info("Received raw Gemini response: '%s'", raw_prediction)
            validated_hours = cls.parse_and_validate_prediction(raw_prediction)
            logger.info("Validated Gemini predicted remaining hours: %.2f hours", validated_hours)
            return validated_hours

        except GeminiServiceException:
            raise
        except Exception as e:
            err_msg = f"Failed to obtain prediction from Gemini AI ({type(e).__name__}): {str(e)}"
            logger.error(err_msg)
            raise GeminiServiceException(err_msg)
