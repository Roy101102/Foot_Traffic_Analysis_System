import cv2
from ultralytics import YOLO
import mysql.connector
from mysql.connector import Error

# =====================================================================
# 🛠️ DATABASE COUPLING LAYER
# =====================================================================
try:
    db_connection = mysql.connector.connect(
        host='127.0.0.1',
        user='root',
        password='',
        database='mr_diy_analytics'
    )
    db_cursor = db_connection.cursor()
    print("✅ Real-Time Sync Enabled: Database connected successfully.")
except Error as e:
    print(f"❌ Database connection initialization failed: {e}")
    exit(1)

def log_to_database(direction, track_id):
    """Safely pushes real-time analytics data straight into XAMPP."""
    try:
        query = "INSERT INTO foot_traffic_logs (branch_id, direction, track_id) VALUES (%s, %s, %s);"
        values = (1, direction, int(track_id))
        db_cursor.execute(query, values)
        db_connection.commit() # Forces immediate update for your Figma-coded dashboard
        print(f"🗄️ [DB-SYNC] Track ID {track_id} ({direction}) committed to XAMPP.")
    except Error as err:
        print(f"⚠️ [DB-ERROR] Failed to save row to MySQL: {err}")
# =====================================================================

# 1. Load the lightweight Nano model optimized for your CPU
model = YOLO("yolov8n.pt")

# 2. Define video source
VIDEO_SOURCE = "sample.mp4"
cap = cv2.VideoCapture(VIDEO_SOURCE)

# 3. Define the virtual tripwire (Line position)
line_y = 300  
entry_count = 0
exit_count = 0

# Track history stores the previous Y-coordinate: { track_id: prev_y }
track_history = {}

# NEW: Track frame count to ensure the ID is real and persistent: { track_id: frames_seen_count }
track_frame_counters = {}

# Track states to lock IDs after they cross: { track_id: {"crossed": True/False} }
track_states = {}

print("Press 'q' to exit the simulation.")

while cap.isOpened():
    success, frame = cap.read()
    if not success:
        print("Video feed ended or cannot be read.")
        break

    # Resize frame to 640x480 for CPU performance optimization
    frame = cv2.resize(frame, (640, 480))

    # 4. Run YOLOv8 Tracker
    results = model.track(frame, persist=True, classes=[0], verbose=False)

    # Draw the main tripwire line (Blue color, thickness 3)
    cv2.line(frame, (0, line_y), (640, line_y), (255, 0, 0), 3)

    # 5. Process tracking data if objects are detected
    if results[0].boxes.id is not None:
        boxes = results[0].boxes.xyxy.cpu().numpy()  
        track_ids = results[0].boxes.id.cpu().numpy().astype(int)

        for box, track_id in zip(boxes, track_ids):
            x1, y1, x2, y2 = box
            
            # Calculate the stable absolute center of the person
            center_x = int((x1 + x2) / 2)
            center_y = int((y1 + y2) / 2)

            # Track how many consecutive frames we have successfully seen this ID
            if track_id not in track_frame_counters:
                track_frame_counters[track_id] = 1
            else:
                track_frame_counters[track_id] += 1

            # Only draw visuals and check logic if the object is stable (seen for more than 2 frames)
            if track_frame_counters[track_id] > 2:
                # Draw visual tracking box, ID text, and center dot
                cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)
                cv2.circle(frame, (center_x, center_y), 5, (0, 0, 255), -1)
                cv2.putText(frame, f"ID: {track_id}", (int(x1), int(y1) - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

                # 6. INSTANT-LOCK TRIPWIRE LOGIC (With Ghost Filter)
                if track_id in track_history:
                    prev_y = track_history[track_id]
                    
                    # Initialize state registry for new IDs
                    if track_id not in track_states:
                        track_states[track_id] = {"crossed": False}

                    # Only check for crossings if this person hasn't already counted
                    if not track_states[track_id]["crossed"]:
                        
                        # ENTRY: Center point moved down past the line
                        if prev_y <= line_y and center_y > line_y:
                            entry_count += 1
                            track_states[track_id]["crossed"] = True
                            print(f"[EVENT] Person ID {track_id} Entered. Total Entries: {entry_count}")
                            
                            # 📥 SYNC TO DATABASE
                            log_to_database(direction='ENTRY', track_id=track_id)
                        
                        # EXIT: Center point moved up past the line
                        elif prev_y >= line_y and center_y < line_y:
                            exit_count += 1
                            track_states[track_id]["crossed"] = True
                            print(f"[EVENT] Person ID {track_id} Exited. Total Exits: {exit_count}")
                            
                            # 📥 SYNC TO DATABASE
                            log_to_database(direction='EXIT', track_id=track_id)

            # Permanently record this frame's Y position for the next loop's comparison
            track_history[track_id] = center_y

    # 7. Display Counter UI overlays
    cv2.putText(frame, f"Entries: {entry_count}", (20, 50),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    cv2.putText(frame, f"Exits: {exit_count}", (20, 90),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

    cv2.imshow("MR. DIY Foot Traffic Simulation Engine", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# =====================================================================
# 🔒 SAFE CLOSING SEQUENCE
# =====================================================================
cap.release()
cv2.destroyAllWindows()

if db_connection.is_connected():
    db_cursor.close()
    db_connection.close()
    print("🔒 MySQL Pipeline safely disconnected.")
# =====================================================================