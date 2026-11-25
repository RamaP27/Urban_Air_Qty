import os
from datetime import datetime, timedelta, timezone
import httpx

OPEN_METEO_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

async def fetch_air_quality(lat: float, lon: float):
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "pm10,pm2_5,nitrogen_dioxide,ozone,carbon_monoxide,sulphur_dioxide,us_aqi",
        "forecast_days": 2,
        "timezone": "auto",
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(OPEN_METEO_URL, params=params)
        response.raise_for_status()
        payload = response.json()

    hourly = payload.get("hourly", {})
    times = hourly.get("time", [])
    if not times:
        raise ValueError("The air-quality provider returned no hourly observations.")

    # Select the latest timestamp that is not in the future according to provider timezone.
    utc_offset = payload.get("utc_offset_seconds", 0) or 0
    now_local = (datetime.now(timezone.utc) + timedelta(seconds=utc_offset)).replace(tzinfo=None)
    idx = 0
    for i, stamp in enumerate(times):
        try:
            if datetime.fromisoformat(stamp) <= now_local:
                idx = i
        except ValueError:
            continue
    values = {}
    for key in ["pm10", "pm2_5", "nitrogen_dioxide", "ozone",
                "carbon_monoxide", "sulphur_dioxide", "us_aqi"]:
        series = hourly.get(key) or []
        values[key] = series[idx] if idx < len(series) else None

    return {
        "source": "Open-Meteo Air Quality API",
        "latitude": lat,
        "longitude": lon,
        "timestamp": times[idx],
        "readings": values,
        "hourly": {
            "time": times[:24],
            "us_aqi": (hourly.get("us_aqi") or [])[:24],
            "pm2_5": (hourly.get("pm2_5") or [])[:24],
        },
    }

async def fetch_forecast(lat: float, lon: float):
    data = await fetch_air_quality(lat, lon)
    hourly = data["hourly"]
    points = []
    for i, stamp in enumerate(hourly["time"]):
        aqi = hourly["us_aqi"][i] if i < len(hourly["us_aqi"]) else None
        pm25 = hourly["pm2_5"][i] if i < len(hourly["pm2_5"]) else None
        points.append({"time": stamp, "us_aqi": aqi, "pm2_5": pm25})
    return {"source": data["source"], "points": points}

def aqi_category(aqi):
    if aqi is None: return ("Unavailable", "No AQI reading is available.")
    if aqi <= 50: return ("Good", "Air quality is satisfactory.")
    if aqi <= 100: return ("Moderate", "Acceptable overall; unusually sensitive people may be affected.")
    if aqi <= 150: return ("Unhealthy for Sensitive Groups", "Sensitive groups should reduce prolonged outdoor exertion.")
    if aqi <= 200: return ("Unhealthy", "Everyone may begin to experience health effects.")
    if aqi <= 300: return ("Very Unhealthy", "Health alert: reduce outdoor exposure.")
    return ("Hazardous", "Health warning: avoid outdoor exertion and follow local advisories.")

def rule_based_insights(location: str, readings: dict):
    aqi = readings.get("us_aqi")
    pm25 = readings.get("pm2_5")
    category, description = aqi_category(aqi)
    actions = []
    if isinstance(aqi, (int, float)) and aqi > 100:
        actions.append("Issue a public advisory for sensitive groups and consider shifting strenuous outdoor activities.")
    if isinstance(pm25, (int, float)) and pm25 > 35:
        actions.append("Investigate particulate sources such as road dust, construction, open burning, and diesel activity.")
    if not actions:
        actions.append("Continue monitoring and compare readings across nearby locations to identify emerging hotspots.")
    actions.append("Validate elevated readings with calibrated local monitoring stations before operational or regulatory action.")
    return {
        "location": location,
        "category": category,
        "summary": f"{description} Current reported AQI: {aqi if aqi is not None else 'unavailable'}.",
        "recommendations": actions,
        "generated_by": "rule-based fallback",
    }

async def generate_insights(location: str, readings: dict):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return rule_based_insights(location, readings)
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        prompt = (
            "You are an urban air-quality decision-support assistant. "
            "Use only the supplied readings; do not invent measurements or claim causation. "
            "Return concise, cautious recommendations for city operators and residents. "
            "Mention uncertainty and advise validation for consequential decisions. "
            f"Location: {location}. Readings: {readings}. "
            "Respond with a short summary followed by 3 practical actions."
        )
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
            contents=prompt,
        )
        return {
            "location": location,
            "category": aqi_category(readings.get("us_aqi"))[0],
            "summary": response.text or "No generated summary was returned.",
            "recommendations": [],
            "generated_by": "Google Gemini",
        }
    except Exception:
        # Keep the application useful if the optional GenAI service is unavailable.
        return rule_based_insights(location, readings)
