import os
import cv2
import urllib.parse
import requests
import threading
from ultralytics import YOLO

# Force OpenCV to use low-latency RTSP options (TCP + Disable Buffer)
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|fflags;nobuffer|max_delay;0"


# ============================================================
# FASTAPI BACKEND CONNECTION (ASYNC / NON-BLOCKING)
# ============================================================

API_URL = "http://127.0.0.1:8000/api/traffic"


def send_request(direction, track_id):
    """Worker function executed in a background thread."""
    try:
        response = requests.post(
            API_URL,
            json={
                "branch_id": 1,
                "direction": direction,
                "track_id": int(track_id)
            },
            timeout=3
        )
        if response.status_code == 200:
            print(f"🗄️ [BACKEND-SYNC] Track ID {track_id} ({direction}) sent successfully.")
        else:
            print(f"⚠️ [BACKEND-ERROR] Status {response.status_code}: {response.text}")
    except requests.RequestException as error:
        print(f"❌ [BACKEND-CONNECTION-ERROR] Could not connect to FastAPI: {error}")


def log_to_backend(direction, track_id):
    """Spawns a daemon thread to send API requests without blocking the video stream."""
    threading.Thread(target=send_request, args=(direction, track_id), daemon=True).start()


# ============================================================
# REAL-TIME THREADED CAMERA STREAM
# ============================================================

class RTSPStream:
    """Reads RTSP frames in a background thread to prevent buffer accumulation lag."""
    def __init__(self, src):
        self.cap = cv2.VideoCapture(src, cv2.CAP_FFMPEG)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Keep internal buffer minimal
        self.grabbed, self.frame = self.cap.read()
        self.stopped = False

    def start(self):
        threading.Thread(target=self.update, daemon=True).start()
        return self

    def update(self):
        while not self.stopped:
            if not self.cap.isOpened():
                break
            grabbed, frame = self.cap.read()
            if grabbed:
                self.grabbed, self.frame = grabbed, frame

    def read(self):
        return self.grabbed, self.frame

    def stop(self):
        self.stopped = True
        self.cap.release()


# ============================================================
# 1. LOAD YOLOv8 MODEL
# ============================================================

model = YOLO("yolov8n.pt")


# ============================================================
# 2. VIDEO SOURCE (HIKVISION RTSP CAMERA STREAM)
# ============================================================

CAMERA_IP   = "172.16.64.5"
CAMERA_USER = "admin"
CAMERA_PASS = "Group5Bayawan"
CHANNEL     = "102"  # Sub-stream for optimal AI inference speed

encoded_pass = urllib.parse.quote_plus(CAMERA_PASS)
VIDEO_SOURCE = f"rtsp://{CAMERA_USER}:{encoded_pass}@{CAMERA_IP}:554/Streaming/Channels/{CHANNEL}"

# Start real-time background stream
stream = RTSPStream(VIDEO_SOURCE).start()

if not stream.grabbed:
    print("❌ Unable to open video source. Check IP, credentials, or network connection.")
    exit(1)


# ============================================================
# 3. TRIPWIRE CONFIGURATION
# ============================================================

line_y = 300
entry_count = 0
exit_count = 0


# ============================================================
# 4. TRACKING DATA
# ============================================================

track_history = {}
track_frame_counters = {}
track_states = {}


# ============================================================
# START DETECTION
# ============================================================

print("============================================================")
print("MR. DIY FOOT TRAFFIC ANALYSIS SYSTEM (REAL-TIME ENABLED)")
print("============================================================")
print(f"FastAPI Backend: {API_URL}")
print(f"RTSP Stream:     {VIDEO_SOURCE}")
print("Press 'q' to stop detection.")
print("============================================================")


while True:
    success, frame = stream.read()

    if not success or frame is None:
        continue

    # Resize frame for processing speed
    frame = cv2.resize(frame, (640, 480))

    # YOLOv8 Tracking
    results = model.track(
        frame,
        persist=True,
        classes=[0],  # Person class
        verbose=False
    )

    # Draw tripwire
    cv2.line(frame, (0, line_y), (640, line_y), (255, 0, 0), 3)

    # Process Detections
    if results[0].boxes.id is not None:
        boxes = results[0].boxes.xyxy.cpu().numpy()
        track_ids = results[0].boxes.id.cpu().numpy().astype(int)

        for box, track_id in zip(boxes, track_ids):
            x1, y1, x2, y2 = box

            center_x = int((x1 + x2) / 2)
            center_y = int((y1 + y2) / 2)

            track_frame_counters[track_id] = track_frame_counters.get(track_id, 0) + 1

            # Stability filter (requires > 2 consecutive frame detections)
            if track_frame_counters[track_id] > 2:

                # Visuals
                cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)
                cv2.circle(frame, (center_x, center_y), 5, (0, 0, 255), -1)
                cv2.putText(frame, f"ID: {track_id}", (int(x1), int(y1) - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

                if track_id not in track_states:
                    track_states[track_id] = {"crossed": False}

                if track_id in track_history:
                    prev_y = track_history[track_id]

                    if not track_states[track_id]["crossed"]:
                        # ENTRY: Top to Bottom
                        if prev_y <= line_y and center_y > line_y:
                            entry_count += 1
                            track_states[track_id]["crossed"] = True
                            print(f"🟢 [ENTRY] Person ID {track_id} entered. Total Entries: {entry_count}")
                            log_to_backend(direction="ENTRY", track_id=track_id)

                        # EXIT: Bottom to Top
                        elif prev_y >= line_y and center_y < line_y:
                            exit_count += 1
                            track_states[track_id]["crossed"] = True
                            print(f"🔴 [EXIT] Person ID {track_id} exited. Total Exits: {exit_count}")
                            log_to_backend(direction="EXIT", track_id=track_id)

                track_history[track_id] = center_y

    # Display Overlay
    cv2.putText(frame, f"Entries: {entry_count}", (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    cv2.putText(frame, f"Exits: {exit_count}", (20, 90), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
    cv2.putText(frame, f"Total Traffic: {entry_count + exit_count}", (20, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

    cv2.imshow("MR. DIY Foot Traffic Analysis System", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

# Cleanup
stream.stop()
cv2.destroyAllWindows()

print("============================================================")
print("Detection stopped.")
print(f"Final Entries: {entry_count}")
print(f"Final Exits: {exit_count}")
print("============================================================")
