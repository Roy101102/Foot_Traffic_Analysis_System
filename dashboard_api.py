import mysql.connector
from mysql.connector import Error
import cv2
import time
from typing import Optional
from pydantic import BaseModel

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# Import global frame store from traffic_counter.py safely
try:
    from traffic_counter import GLOBAL_FRAMES
except ImportError:
    GLOBAL_FRAMES = {}

# ------------------------------------------------------------------
# 1. FASTAPI APP & CORS INITIALIZATION
# ------------------------------------------------------------------
app = FastAPI(title="Mr. DIY Foot Traffic Analytics API")

# Enable CORS for React frontend polling
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    # Normalize direction to uppercase
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

        # Insert into foot_traffic_logs using camera_id column
        try:
            query = """
                INSERT INTO foot_traffic_logs
                (branch_id, camera_id, direction, track_id)
                VALUES (%s, %s, %s, %s)
            """
            cursor.execute(query, (event.branch_id, event.camera_id, direction_upper, event.track_id))
        except Error:
            # Fallback if camera_id column is missing
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
    """Queries MySQL for current day traffic metrics and aggregates 24-hour trends."""
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

        # Build full 24-hour array (0-23 hours)
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
                "detected": max(0, int(row["entries"] or 0) - int(row["exits"] or 0))
            }
            for row in cam_rows if row["camera_id"]
        }

        # Camera online/offline status & zone stats mapping
        cameras_status = []
        zone_names = {
            "cam_1": "Zone 1: Main Entrance & Exit Gate",
            "cam_2": "Zone 2: Aisle 1 (Hardware & Tools)",
            "cam_3": "Zone 3: Aisle 2 (Household & Electrical)"
        }

        for cam_id in ["cam_1", "cam_2", "cam_3"]:
            is_online = cam_id in GLOBAL_FRAMES and GLOBAL_FRAMES[cam_id] is not None
            stats = cam_stats_map.get(cam_id, {"entries": 0, "exits": 0, "detected": 0})
            
            cameras_status.append({
                "id": cam_id,
                "name": zone_names.get(cam_id, cam_id),
                "isOnline": is_online,
                "entries": stats["entries"],
                "exits": stats["exits"],
                "detected": stats["detected"],
                "visitors": stats["detected"]  # Supports UI 'visitors' label
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
            "zones": cameras_status
        }

    except Error as e:
        print(f"❌ [DB ERROR] {e}")
        return {"status": "error", "message": str(e)}

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


def generate_mjpeg_stream(camera_id: str):
    """Generates continuous JPEG image chunks from memory for video streaming."""
    while True:
        if camera_id in GLOBAL_FRAMES and GLOBAL_FRAMES[camera_id] is not None:
            frame = GLOBAL_FRAMES[camera_id]
            ret, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if ret:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"
                )
        time.sleep(0.04)  # ~25 FPS


# ------------------------------------------------------------------
# 2. FASTAPI ROUTE DEFINITIONS
# ------------------------------------------------------------------

@app.post("/api/traffic")
async def post_traffic_event(event: TrafficEvent):
    """Receives YOLO entry/exit events from traffic_counter.py."""
    result = record_traffic_event(event)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result


@app.get("/api/dashboard-stats")
async def get_dashboard_stats():
    """Serves real-time traffic summary and zone statistics to React UI."""
    return fetch_dashboard_stats()


@app.get("/api/video_feed/{camera_id}")
async def video_feed(camera_id: str):
    """Provides live MJPEG camera streams to the frontend."""
    return StreamingResponse(
        generate_mjpeg_stream(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)