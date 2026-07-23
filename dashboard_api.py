from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import mysql.connector
from mysql.connector import Error

app = FastAPI(title="MR. DIY Foot Traffic Analytics API")

# 🔒 Allow your React (Vite) app to securely fetch data from this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db_connection():
    return mysql.connector.connect(
        host='127.0.0.1',
        user='root',
        password='',
        database='mr_diy_analytics'
    )

@app.get("/api/dashboard-stats")
def get_dashboard_stats():
    """Pulls aggregated traffic numbers straight from XAMPP for the React UI."""
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # 1. Fetch total entries
        cursor.execute("SELECT COUNT(*) as count FROM foot_traffic_logs WHERE direction = 'ENTRY';")
        entries = cursor.fetchone()['count']
        
        # 2. Fetch total exits
        cursor.execute("SELECT COUNT(*) as count FROM foot_traffic_logs WHERE direction = 'EXIT';")
        exits = cursor.fetchone()['count']
        
        # 3. Fetch hourly traffic trends for charts
        hourly_query = """
            SELECT 
                HOUR(timestamp) as hour,
                SUM(CASE WHEN direction = 'ENTRY' THEN 1 ELSE 0 END) as entries,
                SUM(CASE WHEN direction = 'EXIT' THEN 1 ELSE 0 END) as exits
            FROM foot_traffic_logs
            GROUP BY HOUR(timestamp)
            ORDER BY hour ASC;
        """
        cursor.execute(hourly_query)
        hourly_trends = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return {
            "status": "success",
            "summary": {
                "total_entries": entries,
                "total_exits": exits,
                "current_occupancy": max(0, entries - exits)
            },
            "hourly_trends": hourly_trends
        }
        
    except Error as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)