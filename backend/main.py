import os
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import requests
import uvicorn

# Ensure project root and current directory are on sys.path whether run from
# project root (`py -m backend.main`) or inside `backend/` (`py main.py`)
CURRENT_DIR = Path(__file__).resolve().parent
ROOT_DIR = CURRENT_DIR.parent
for p in (str(CURRENT_DIR), str(ROOT_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

# Import database and stats handlers from dashboard_api.py
from dashboard_api import (
    STREAM_SERVER_URL,
    TrafficEvent,
    record_traffic_event,
    fetch_dashboard_stats,
)

# Import background camera tracking threads / stream generator if available
try:
    from traffic_counter import CAMERAS, CameraCounterThread
except ImportError:
    CAMERAS = []
    CameraCounterThread = None

try:
    from traffic_counter import generate_mjpeg_stream
except ImportError:
    generate_mjpeg_stream = None

# Import Authentication Router & DB Initializer
try:
    from auth_routes import router as auth_router
except ImportError:
    from backend.auth_routes import router as auth_router

from database.auth_repository import init_auth_tables


# ============================================================
# FASTAPI APPLICATION & CORS CONFIGURATION
# ============================================================

app = FastAPI(title="MR. DIY Foot Traffic Analytics API")

# NOTE: "*" must NOT be included when allow_credentials=True, otherwise
# browsers reject HttpOnly authentication cookies.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register /api/auth/* routes (login, logout, me, forgot-password, reset-password)
app.include_router(auth_router)


# ============================================================
# STARTUP INITIALIZATION (AUTH DB + CAMERA THREADS)
# ============================================================

@app.on_event("startup")
def startup_event():
    """Initializes auth tables and launches background camera tracking threads."""
    init_auth_tables()
    print("✅ [AUTH] Authentication tables ready.")

    if CameraCounterThread and CAMERAS:
        print("\n🚀 [SYSTEM] Starting background camera tracking threads...")
        for config in CAMERAS:
            t = CameraCounterThread(config)
            t.daemon = True
            t.start()
        print("✅ [SYSTEM] All camera threads active and storing frames in memory.\n")


# ============================================================
# MJPEG STREAM PROXY HELPER
# ============================================================

def proxy_mjpeg_stream(camera_id: str):
    """Proxies MJPEG frames from traffic_counter.py running on port 8001."""
    url = f"{STREAM_SERVER_URL}/api/video_feed/{camera_id}"
    try:
        with requests.get(url, stream=True, timeout=(2.0, 10.0)) as resp:
            if resp.status_code != 200:
                return
            for chunk in resp.iter_content(chunk_size=4096):
                if chunk:
                    yield chunk
    except Exception as e:
        print(f"⚠️ [STREAM] Stream server unreachable at {url}: {e}")


# ============================================================
# API ROUTES
# ============================================================

@app.get("/")
def home():
    return {
        "status": "online",
        "message": "MR. DIY Foot Traffic Analytics API is running.",
    }


@app.post("/api/traffic")
def post_traffic(event: TrafficEvent):
    """Receives entry/exit crossing events and logs them to MySQL."""
    return record_traffic_event(event)


@app.get("/api/traffic")
@app.get("/api/dashboard-stats")
def get_dashboard_stats():
    """Serves real-time statistics and hourly trends to React UI."""
    return fetch_dashboard_stats()


@app.get("/api/video_feed/{camera_id}")
def video_feed(camera_id: str):
    """Serves MJPEG live video feeds directly to <img src="..." /> in React."""
    if camera_id not in ["cam_1", "cam_2", "cam_3"]:
        raise HTTPException(status_code=404, detail="Camera ID not found")

    stream_iter = (
        generate_mjpeg_stream(camera_id)
        if generate_mjpeg_stream is not None
        else proxy_mjpeg_stream(camera_id)
    )

    return StreamingResponse(
        stream_iter,
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":
    print("============================================================")
    print("MR. DIY FOOT TRAFFIC & VIDEO STREAM API SERVER")
    print("============================================================")
    print("API Base URL:     http://127.0.0.1:8000")
    print("Auth Endpoints:   http://127.0.0.1:8000/api/auth/login")
    print("Dashboard Stats:  http://127.0.0.1:8000/api/dashboard-stats")
    print("Video Stream 1:   http://127.0.0.1:8000/api/video_feed/cam_1")
    print("Video Stream 2:   http://127.0.0.1:8000/api/video_feed/cam_2")
    print("Video Stream 3:   http://127.0.0.1:8000/api/video_feed/cam_3")
    print("============================================================")

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
    )