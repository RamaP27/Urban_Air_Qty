# Urban Air Quality Intelligence

A starter MVP for monitoring urban air quality, visualizing pollutant levels, generating short-term trend estimates, and producing explainable recommendations.

## What is included

- **React + Vite dashboard** with location controls, AQI status, pollutant cards, a 24-hour trend chart, and AI insight panel.
- **FastAPI backend** with health, current air-quality, forecast, and insights endpoints.
- **Live data integration** using the Open-Meteo Air Quality API (no API key required for the demo integration).
- **Gemini integration (optional)** for natural-language insights. If no Gemini key is configured, the backend returns a deterministic rule-based summary.
- **Dockerfiles** and Google Cloud Run deployment instructions.

> This is an MVP starter, not a certified regulatory monitoring system. API data is modelled/gridded data, not a substitute for calibrated reference-grade monitoring stations. Forecast values in this starter are indicative trend samples, not validated predictions.

## Requirements

- Python 3.11+
- Node.js 20+
- (Optional) Google Cloud project and `gcloud` CLI for Cloud Run deployment

## Run locally

### 1. Backend

```bash
cd backend
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows PowerShell
# .venv\Scripts\Activate.ps1

pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Backend docs: http://localhost:8000/docs

### 2. Frontend

Open a second terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open the URL printed by Vite (normally http://localhost:5173).

The frontend defaults to `http://localhost:8000`. To change it, set `VITE_API_BASE_URL` in `frontend/.env`.

## Environment variables

Both `backend/.env.example` and `frontend/.env.example` are provided as templates. Copy them to `.env` before running locally (`.env` files are ignored by git).

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | *(empty)* | Optional Google Gemini API key. Leave blank for local development to use the rule-based insights fallback without crashing. |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model used when `GEMINI_API_KEY` is configured. |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated list of allowed frontend origins for CORS. |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Base URL of the FastAPI backend API. |

## Gemini setup (optional)

1. Create an API key in Google AI Studio, or configure an appropriate Gemini API access method for your environment.
2. Set `GEMINI_API_KEY` in `backend/.env`.
3. Optionally set `GEMINI_MODEL` (default: `gemini-2.0-flash`).
4. Restart the backend.

The backend uses the `google-genai` SDK. Without a key, insights still work using transparent rule-based recommendations.

Do not commit `.env` files or expose API keys in frontend code.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/air-quality/current?lat=12.9716&lon=77.5946` | Current/latest available air-quality values |
| GET | `/api/air-quality/forecast?lat=12.9716&lon=77.5946` | Hourly forecast samples |
| POST | `/api/insights` | Generate recommendations from supplied readings |

The default dashboard location is Bengaluru. Coordinates can be changed in the UI.

## Deploy to Google Cloud Run

Deploy backend and frontend as separate services. This keeps API configuration and frontend hosting independent.

### A. Deploy backend

```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com

cd backend
gcloud run deploy urban-air-quality-api \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --port 8080
```

After deployment, copy the backend service URL, for example:
`https://urban-air-quality-api-xxxxx-uc.a.run.app`

### B. Configure and deploy frontend

Replace `YOUR_BACKEND_CLOUD_RUN_URL` with the URL from step A:

```bash
cd ../frontend
gcloud run deploy urban-air-quality-dashboard \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-build-env-vars VITE_API_BASE_URL=https://YOUR_BACKEND_CLOUD_RUN_URL
```

Vite embeds `VITE_API_BASE_URL` at build time. If you change it after deployment, rebuild and redeploy the frontend.

### C. Verify

- Open the frontend Cloud Run URL.
- Check `BACKEND_URL/health`.
- Check `BACKEND_URL/docs`.
- Try changing coordinates in the dashboard.

### Deployment notes

- For production, restrict CORS to your frontend domain instead of `*`.
- Store secrets in Secret Manager and attach them to the Cloud Run service; do not pass secrets in source control.
- Configure authentication, rate limits, logging, monitoring, and a privacy notice before public launch.
- Connect calibrated IoT stations for hyperlocal measurements. The included Open-Meteo feed is suitable for a prototype, not enforcement or compliance decisions.

## Project structure

```text
urban-air-quality-intelligence/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── services.py
│   │   └── schemas.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── Dockerfile
│   └── .env.example
└── README.md
```
