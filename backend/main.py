from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import mysql.connector
from mysql.connector import Error
import uvicorn


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(title="MR. DIY Foot Traffic Analytics API")


# ============================================================
# CORS CONFIGURATION
# ============================================================

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


# ============================================================
# DATABASE CONNECTION
# ============================================================

def get_db_connection():
    return mysql.connector.connect(
        host="127.0.0.1",
        user="root",
        password="",
        database="mr_diy_analytics",
    )


# ============================================================
# TRAFFIC DATA MODEL
# ============================================================

class TrafficEvent(BaseModel):
    branch_id: int = 1
    direction: str
    track_id: int


# ============================================================
# HOME
# ============================================================

@app.get("/")
def home():
    return {
        "message": "MR. DIY Foot Traffic Analytics API is running."
    }


# ============================================================
# RECEIVE TRAFFIC EVENT
# ============================================================

@app.post("/api/traffic")
def record_traffic(event: TrafficEvent):

    connection = None
    cursor = None

    try:
        # Validate direction
        if event.direction not in ["ENTRY", "EXIT"]:
            return {
                "status": "error",
                "message": "Direction must be ENTRY or EXIT."
            }

        connection = get_db_connection()
        cursor = connection.cursor()

        query = """
            INSERT INTO foot_traffic_logs
            (branch_id, direction, track_id)
            VALUES (%s, %s, %s)
        """

        values = (
            event.branch_id,
            event.direction,
            event.track_id
        )

        cursor.execute(query, values)
        connection.commit()

        print(
            f"[DB] {event.direction} | "
            f"Track ID: {event.track_id} | "
            f"Database record created."
        )

        return {
            "status": "success",
            "message": "Traffic event recorded successfully.",
            "data": {
                "branch_id": event.branch_id,
                "direction": event.direction,
                "track_id": event.track_id
            }
        }

    except Error as e:

        if connection:
            connection.rollback()

        print(f"[DB ERROR] {e}")

        return {
            "status": "error",
            "message": str(e)
        }

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# DASHBOARD STATISTICS
# ============================================================

@app.get("/api/dashboard-stats")
def get_dashboard_stats():

    connection = None
    cursor = None

    try:

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # ----------------------------------------------------
        # TOTAL ENTRIES TODAY
        # ----------------------------------------------------

        cursor.execute("""
            SELECT COUNT(*) AS count
            FROM foot_traffic_logs
            WHERE direction = 'ENTRY'
            AND DATE(timestamp) = CURDATE()
        """)

        total_entries = cursor.fetchone()["count"]

        # ----------------------------------------------------
        # TOTAL EXITS TODAY
        # ----------------------------------------------------

        cursor.execute("""
            SELECT COUNT(*) AS count
            FROM foot_traffic_logs
            WHERE direction = 'EXIT'
            AND DATE(timestamp) = CURDATE()
        """)

        total_exits = cursor.fetchone()["count"]

        # ----------------------------------------------------
        # HOURLY DATA
        # ----------------------------------------------------

        cursor.execute("""
            SELECT
                HOUR(timestamp) AS hour,
                SUM(
                    CASE
                        WHEN direction = 'ENTRY' THEN 1
                        ELSE 0
                    END
                ) AS entries,
                SUM(
                    CASE
                        WHEN direction = 'EXIT' THEN 1
                        ELSE 0
                    END
                ) AS exits
            FROM foot_traffic_logs
            WHERE DATE(timestamp) = CURDATE()
            GROUP BY HOUR(timestamp)
            ORDER BY hour
        """)

        rows = cursor.fetchall()

        hourly_lookup = {}

        for row in rows:

            hourly_lookup[row["hour"]] = {
                "hour": row["hour"],
                "entries": row["entries"] or 0,
                "exits": row["exits"] or 0,
            }

        hourly_trends = []

        for hour in range(24):

            if hour in hourly_lookup:

                hourly_trends.append(
                    hourly_lookup[hour]
                )

            else:

                hourly_trends.append({
                    "hour": hour,
                    "entries": 0,
                    "exits": 0
                })

        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        return {
            "status": "success",

            "summary": {
                "total_entries": total_entries,
                "total_exits": total_exits,
                "current_occupancy": max(
                    0,
                    total_entries - total_exits
                )
            },

            "hourly_trends": hourly_trends
        }

    except Error as e:

        print(f"[DB ERROR] {e}")

        return {
            "status": "error",
            "message": str(e)
        }

    finally:

        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":

    print("Starting MR. DIY API...")
    print("API: http://127.0.0.1:8000")
    print(
        "Dashboard API: "
        "http://127.0.0.1:8000/api/dashboard-stats"
    )

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000
    )
