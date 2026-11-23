import sys
from pathlib import Path
import mysql.connector
from mysql.connector import Error
import requests
from typing import Optional
from pydantic import BaseModel

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Automatically locate auth_routes.py and its parent directory inside the project
BASE_DIR = Path(__file__).resolve().parent
auth_matches = list(BASE_DIR.rglob("auth_routes.py"))
if not auth_matches:
    raise FileNotFoundError(f"Could not find auth_routes.py anywhere inside {BASE_DIR}")

AUTH_DIR = auth_matches[0].parent
for path_to_add in (str(AUTH_DIR), str(AUTH_DIR.parent)):
    if path_to_add not in sys.path:
        sys.path.insert(0, path_to_add)

from auth_routes import router as auth_router

# ------------------------------------------------------------------
# 1. FASTAPI APP & CORS INITIALIZATION
# ------------------------------------------------------------------
app = FastAPI(title="Mr. DIY Foot Traffic Analytics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register authentication & user management endpoints (/api/auth/*)
app.include_router(auth_router)

STREAM_SERVER_URL = "http://127.0.0.1:8001"


def check_stream_server_health():
    """Queries traffic_counter.py on Port 8001 for active camera status."""
    try:
        res = requests.get(f"{STREAM_SERVER_URL}/api/health", timeout=0.8)
        if res.status_code == 200:
            return res.json().get("cameras", {})
    except Exception:
        pass
    return {}


def get_db_connection():
    """Establishes connection to the XAMPP MySQL database."""
    return mysql.connector.connect(
        host="127.0.0.1",
        user="root",
        password="",
        database="mr_diy_analytics",
    )


class TrafficEvent(BaseModel):
    branch_id: int = 1
    camera_id: Optional[str] = "cam_1"
    direction: str
    track_id: int


def record_traffic_event(event: TrafficEvent):
    """Records traffic entry/exit events into the MySQL database."""
    direction_upper = str(event.direction).upper()
    if direction_upper in ["IN", "ENTRY"]:
        direction_upper = "ENTRY"
    elif direction_upper in ["OUT", "EXIT"]:
        direction_upper = "EXIT"

    if direction_upper not in ["ENTRY", "EXIT"]:
        return {"status": "error", "message": "Direction must be ENTRY or EXIT."}

    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        try:
            query = """
                INSERT INTO foot_traffic_logs
                (branch_id, camera_id, direction, track_id)
                VALUES (%s, %s, %s, %s)
            """
            cursor.execute(query, (event.branch_id, event.camera_id, direction_upper, event.track_id))
        except Error:
            query = """
                INSERT INTO foot_traffic_logs
                (branch_id, direction, track_id)
                VALUES (%s, %s, %s)
            """
            cursor.execute(query, (event.branch_id, direction_upper, event.track_id))

        connection.commit()
        print(f"🗄️ [DB LOG] {direction_upper} | Camera: {event.camera_id} | Track ID: {event.track_id}")

        return {
            "status": "success",
            "message": "Traffic event recorded successfully.",
            "data": {
                "branch_id": event.branch_id,
                "camera_id": event.camera_id,
                "direction": direction_upper,
                "track_id": event.track_id,
            },
        }

    except Error as e:
        if connection:
            connection.rollback()
        print(f"❌ [DB ERROR] {e}")
        return {"status": "error", "message": str(e)}

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


def fetch_dashboard_stats():
    """Queries MySQL for current day traffic metrics and bridges camera status from Port 8001."""
    active_cameras_map = check_stream_server_health()

    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # 1. Fetch total entries today
        cursor.execute("""
            SELECT COUNT(*) AS count
            FROM foot_traffic_logs
            WHERE direction = 'ENTRY'
            AND DATE(timestamp) = CURDATE()
        """)
        entries_row = cursor.fetchone()
        total_entries = entries_row["count"] if entries_row else 0

        # 2. Fetch total exits today
        cursor.execute("""
            SELECT COUNT(*) AS count
            FROM foot_traffic_logs
            WHERE direction = 'EXIT'
            AND DATE(timestamp) = CURDATE()
        """)
        exits_row = cursor.fetchone()
        total_exits = exits_row["count"] if exits_row else 0

        # 3. Fetch hourly breakdown for today
        cursor.execute("""
            SELECT
                HOUR(timestamp) AS hour,
                SUM(CASE WHEN direction = 'ENTRY' THEN 1 ELSE 0 END) AS entries,
                SUM(CASE WHEN direction = 'EXIT' THEN 1 ELSE 0 END) AS exits
            FROM foot_traffic_logs
            WHERE DATE(timestamp) = CURDATE()
            GROUP BY HOUR(timestamp)
            ORDER BY hour
        """)
        rows = cursor.fetchall()
        hourly_lookup = {
            row["hour"]: {
                "hour": row["hour"],
                "entries": int(row["entries"] or 0),
                "exits": int(row["exits"] or 0),
            }
            for row in rows
        }

        hourly_trends = []
        for hour in range(24):
            if hour in hourly_lookup:
                hourly_trends.append(hourly_lookup[hour])
            else:
                hourly_trends.append({"hour": hour, "entries": 0, "exits": 0})

        # 4. Fetch Zone/Camera breakdown for current day
        cursor.execute("""
            SELECT
                camera_id,
                SUM(CASE WHEN direction = 'ENTRY' THEN 1 ELSE 0 END) AS entries,
                SUM(CASE WHEN direction = 'EXIT' THEN 1 ELSE 0 END) AS exits
            FROM foot_traffic_logs
            WHERE DATE(timestamp) = CURDATE()
            GROUP BY camera_id
        """)
        cam_rows = cursor.fetchall()
        cam_stats_map = {
            row["camera_id"]: {
                "entries": int(row["entries"] or 0),
                "exits": int(row["exits"] or 0),
                "detected": max(0, int(row["entries"] or 0) - int(row["exits"] or 0)),
            }
            for row in cam_rows
            if row["camera_id"]
        }

        cameras_status = []
        zone_names = {
            "cam_1": "Zone 1: Main Entrance & Exit Gate",
            "cam_2": "Zone 2: Aisle 1 (Hardware & Tools)",
            "cam_3": "Zone 3: Aisle 2 (Household & Electrical)",
        }

        for cam_id in ["cam_1", "cam_2", "cam_3"]:
            is_online = active_cameras_map.get(cam_id, False)
            stats = cam_stats_map.get(cam_id, {"entries": 0, "exits": 0, "detected": 0})

            cameras_status.append({
                "id": cam_id,
                "name": zone_names.get(cam_id, cam_id),
                "isOnline": is_online,
                "isStreaming": is_online,
                "streamUrl": f"{STREAM_SERVER_URL}/api/video_feed/{cam_id}",
                "entries": stats["entries"],
                "exits": stats["exits"],
                "detected": stats["detected"],
                "visitors": stats["detected"],
                "liveCount": stats["detected"],
                "entryCount": stats["entries"],
                "exitCount": stats["exits"],
            })

        return {
            "status": "success",
            "is_connected": True,
            "summary": {
                "total_entries": total_entries,
                "total_exits": total_exits,
                "current_occupancy": max(0, total_entries - total_exits),
            },
            "hourly_trends": hourly_trends,
            "cameras": cameras_status,
            "zones": cameras_status,
        }

    except Error as e:
        print(f"❌ [DB ERROR] {e}")
        return {"status": "error", "message": str(e)}

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# ------------------------------------------------------------------
# 2. FASTAPI ROUTE DEFINITIONS
# ------------------------------------------------------------------

@app.post("/api/traffic")
async def post_traffic_event(event: TrafficEvent):
    result = record_traffic_event(event)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result


@app.get("/api/dashboard-stats")
async def get_dashboard_stats():
    return fetch_dashboard_stats()


@app.get("/api/public/store-status")
async def get_public_store_status():
    """Public, read-only crowd status and aisle availability for customer phones/kiosks."""
    live_zone_counts = {"cam_1": 0, "cam_2": 0, "cam_3": 0}
    try:
        cam_res = requests.get(f"{STREAM_SERVER_URL}/api/cameras", timeout=0.8)
        if cam_res.status_code == 200:
            for cam in cam_res.json():
                cid = cam.get("camera_id") or cam.get("id")
                if cid in live_zone_counts:
                    count = cam.get("peopleDetected", cam.get("detected", cam.get("liveCount", 0)))
                    live_zone_counts[cid] = int(count or 0)
    except Exception:
        pass

    stats = fetch_dashboard_stats()
    summary = stats.get("summary", {})
    occupancy = int(summary.get("current_occupancy", 0))

    if occupancy <= 5:
        crowd_level = "Quiet"
    elif occupancy <= 15:
        crowd_level = "Moderate"
    else:
        crowd_level = "Busy"

    formatted_trends = [
        {
            "hour": f"{int(item['hour']):02d}:00",
            "entries": int(item.get("entries", 0)),
        }
        for item in stats.get("hourly_trends", [])
    ]

    return {
        "storeName": "MR. DIY",
        "crowdLevel": crowd_level,
        "currentOccupancy": occupancy,
        "aisles": [
            {
                "id": "zone_2",
                "name": "Hardware & Tools Aisle",
                "shelves": ["Hardware", "Tools", "Paint"],
                "peopleNow": live_zone_counts["cam_2"],
                "status": "Busy" if live_zone_counts["cam_2"] >= 4 else "Available",
            },
            {
                "id": "zone_3",
                "name": "Household & Electrical Aisle",
                "shelves": ["Household", "Electrical", "Storage"],
                "peopleNow": live_zone_counts["cam_3"],
                "status": "Busy" if live_zone_counts["cam_3"] >= 4 else "Available",
            },
        ],
        "hourlyTrends": formatted_trends,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)