from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Import database, logic, and streaming handlers from dashboard_api.py
from dashboard_api import (
    TrafficEvent,
    record_traffic_event,
    fetch_dashboard_stats,
    generate_mjpeg_stream,
)

# Import background camera tracking threads from traffic_counter.py
try:
    from traffic_counter import CAMERAS, CameraCounterThread
except ImportError:
    CAMERAS = []
    CameraCounterThread = None


# ============================================================
# FASTAPI APPLICATION & CORS CONFIGURATION
# ============================================================

app = FastAPI(title="MR. DIY Foot Traffic Analytics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# AUTOMATIC BACKGROUND CAMERA THREAD LAUNCHER
# ============================================================

@app.on_event("startup")
def startup_event():
    """Automatically launches background camera tracking threads on server startup."""
    if CameraCounterThread and CAMERAS:
        print("\n🚀 [SYSTEM] Starting background camera tracking threads...")
        for config in CAMERAS:
            t = CameraCounterThread(config)
            t.daemon = True
            t.start()
        print("✅ [SYSTEM] All camera threads active and storing frames in memory.\n")


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
async def video_feed(camera_id: str):
    """Serves MJPEG live video feeds directly to <img src="..." /> in React."""
    if camera_id not in ["cam_1", "cam_2", "cam_3"]:
        raise HTTPException(status_code=404, detail="Camera ID not found")

    return StreamingResponse(
        generate_mjpeg_stream(camera_id),
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
    print("Dashboard Stats: http://127.0.0.1:8000/api/dashboard-stats")
    print("Video Stream 1:  http://127.0.0.1:8000/api/video_feed/cam_1")
    print("Video Stream 2:  http://127.0.0.1:8000/api/video_feed/cam_2")
    print("Video Stream 3:  http://127.0.0.1:8000/api/video_feed/cam_3")
    print("============================================================")

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000
    )