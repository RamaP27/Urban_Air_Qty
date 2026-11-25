import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .schemas import InsightRequest
from .services import fetch_air_quality, fetch_forecast, generate_insights, aqi_category

load_dotenv()

app = FastAPI(
    title="Urban Air Quality Intelligence API",
    description="Prototype API for air-quality monitoring and decision support.",
    version="1.0.0",
)

origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok", "service": "urban-air-quality-api"}

@app.get("/api/air-quality/current")
async def current_air_quality(lat: float = 12.9716, lon: float = 77.5946):
    try:
        data = await fetch_air_quality(lat, lon)
        category, description = aqi_category(data["readings"].get("us_aqi"))
        data["category"] = category
        data["description"] = description
        return data
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Air-quality provider unavailable: {str(exc)}")

@app.get("/api/air-quality/forecast")
async def air_quality_forecast(lat: float = 12.9716, lon: float = 77.5946):
    try:
        return await fetch_forecast(lat, lon)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Forecast provider unavailable: {str(exc)}")

@app.post("/api/insights")
async def insights(request: InsightRequest):
    return await generate_insights(request.location, request.readings)
