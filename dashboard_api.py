import mysql.connector
from mysql.connector import Error
import requests
from typing import Optional
from pydantic import BaseModel

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# ------------------------------------------------------------------
# 1. FASTAPI APP & CORS INITIALIZATION
# ------------------------------------------------------------------
app = FastAPI(title="Mr. DIY Foot Traffic Analytics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
                "detected": max(0, int(row["entries"] or 0) - int(row["exits"] or 0))
            }
            for row in cam_rows if row["camera_id"]
        }

        cameras_status = []
        zone_names = {
            "cam_1": "Zone 1: Main Entrance & Exit Gate",
            "cam_2": "Zone 2: Aisle 1 (Hardware & Tools)",
            "cam_3": "Zone 3: Aisle 2 (Household & Electrical)"
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
                "exitCount": stats["exits"]
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)     