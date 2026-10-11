import os
import cv2
import time
import asyncio
import urllib.parse
import requests
import threading
from ultralytics import YOLO
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Low-latency RTSP options for OpenCV
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|fflags;nobuffer|max_delay;0"

# Target Database API endpoint running from dashboard_api.py
API_URL = "http://127.0.0.1:8000/api/traffic"

# ============================================================
# FASTAPI BACKEND INITIALIZATION (VIDEO STREAMING SERVER)
# ============================================================

app = FastAPI(title="MR. DIY Live Video Streamer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

camera_threads = {}


def send_request(camera_id, direction, track_id):
    """Worker function executed in a background thread to send crossing events to dashboard_api."""
    try:
        response = requests.post(
            API_URL,
            json={
                "branch_id": 1,
                "camera_id": camera_id,
                "direction": direction,
                "track_id": int(track_id)
            },
            timeout=2
        )
        if response.status_code == 200:
            print(f"🗄️ [{camera_id}] Track ID {track_id} ({direction}) logged successfully to DB.")
        else:
            print(f"⚠️ [{camera_id}] Status {response.status_code}: {response.text}")
    except requests.RequestException as e:
        print(f"❌ [{camera_id}] Could not connect to API server at {API_URL}: {e}")


def log_to_backend(camera_id, direction, track_id):
    """Spawns a non-blocking daemon thread for API requests."""
    threading.Thread(
        target=send_request, 
        args=(camera_id, direction, track_id), 
        daemon=True
    ).start()


# ============================================================
# CAMERA CONFIGURATIONS
# ============================================================

CAMERAS = [
    {
        "camera_id": "cam_1",
        "name": "Zone 1: Main Entrance",
        "ip": "192.168.1.51",
        "user": "admin",
        "pass": "Group5Bayawan",
        "channel": "102",
        "line_y": 300,
    },
    {
        "camera_id": "cam_2",
        "name": "Zone 2: Hardware Aisle",
        "ip": "192.168.1.52",
        "user": "admin",
        "pass": "Group5Bayawan",
        "channel": "102",
        "line_y": 300,
    },
    {
        "camera_id": "cam_3",
        "name": "Zone 3: Checkout Counter",
        "ip": "192.168.1.53",
        "user": "admin",
        "pass": "Group5Bayawan",
        "channel": "102",
        "line_y": 300,
    },
]


# ============================================================
# DEDICATED RTSP FRAME FLUSHER (PREVENTS BUFFER ACCUMULATION)
# ============================================================

class RTSPFrameGrabber:
    def __init__(self, rtsp_url):
        self.cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
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
            else:
                time.sleep(0.005)

    def read(self):
        return self.grabbed, self.frame

    def stop(self):
        self.stopped = True
        self.cap.release()


# ============================================================
# MULTI-CAMERA DETECTION THREAD WORKER
# ============================================================

class CameraCounterThread(threading.Thread):
    def __init__(self, config):
        super().__init__()
        self.config = config
        self.camera_id = config["camera_id"]
        self.name = config["name"]
        self.line_y = config["line_y"]
        self.stopped = False

        self.latest_jpeg_bytes = None
        self.lock = threading.Lock()

        encoded_pass = urllib.parse.quote_plus(config["pass"])
        self.rtsp_url = f"rtsp://{config['user']}:{encoded_pass}@{config['ip']}:554/Streaming/Channels/{config['channel']}"

        self.model = YOLO("yolov8n.pt")

        self.entry_count = 0
        self.exit_count = 0
        self.track_history = {}
        self.track_frame_counters = {}
        self.track_states = {}

    def get_latest_frame(self):
        with self.lock:
            return self.latest_jpeg_bytes

    def is_active(self):
        return not self.stopped and self.latest_jpeg_bytes is not None

    def run(self):
        print(f"🎥 Connecting to [{self.camera_id}] {self.name} ({self.config['ip']})...")
        stream = RTSPFrameGrabber(self.rtsp_url).start()
        time.sleep(1)

        while not self.stopped:
            grabbed, frame = stream.read()
            if not grabbed or frame is None:
                time.sleep(0.01)
                continue

            display_frame = cv2.resize(frame, (640, 480))

            results = self.model.track(
                display_frame,
                persist=True,
                classes=[0],
                imgsz=320,
                verbose=False
            )

            cv2.line(display_frame, (0, self.line_y), (640, self.line_y), (255, 0, 0), 3)

            if results[0].boxes.id is not None:
                boxes = results[0].boxes.xyxy.cpu().numpy()
                track_ids = results[0].boxes.id.cpu().numpy().astype(int)

                for box, track_id in zip(boxes, track_ids):
                    x1, y1, x2, y2 = box
                    center_x = int((x1 + x2) / 2)
                    center_y = int((y1 + y2) / 2)

                    self.track_frame_counters[track_id] = self.track_frame_counters.get(track_id, 0) + 1

                    if self.track_frame_counters[track_id] > 2:
                        cv2.rectangle(display_frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)
                        cv2.circle(display_frame, (center_x, center_y), 5, (0, 0, 255), -1)
                        cv2.putText(
                            display_frame, 
                            f"ID: {track_id}", 
                            (int(x1), int(y1) - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2
                        )

                        if track_id not in self.track_states:
                            self.track_states[track_id] = {"crossed": False}

                        if track_id in self.track_history:
                            prev_y = self.track_history[track_id]

                            if not self.track_states[track_id]["crossed"]:
                                if prev_y <= self.line_y and center_y > self.line_y:
                                    self.entry_count += 1
                                    self.track_states[track_id]["crossed"] = True
                                    print(f"🟢 [{self.camera_id} ENTRY] Person ID {track_id}. Total Entries: {self.entry_count}")
                                    log_to_backend(self.camera_id, "ENTRY", track_id)

                                elif prev_y >= self.line_y and center_y < self.line_y:
                                    self.exit_count += 1
                                    self.track_states[track_id]["crossed"] = True
                                    print(f"🔴 [{self.camera_id} EXIT] Person ID {track_id}. Total Exits: {self.exit_count}")
                                    log_to_backend(self.camera_id, "EXIT", track_id)

                        self.track_history[track_id] = center_y

            cv2.putText(display_frame, f"{self.name}", (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            cv2.putText(display_frame, f"Entries: {self.entry_count}", (20, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            cv2.putText(display_frame, f"Exits: {self.exit_count}", (20, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            cv2.putText(display_frame, f"Total Traffic: {self.entry_count + self.exit_count}", (20, 135), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

            ret, buffer = cv2.imencode('.jpg', display_frame)
            if ret:
                with self.lock:
                    self.latest_jpeg_bytes = buffer.tobytes()

        stream.stop()

    def stop(self):
        self.stopped = True


# ============================================================
# FASTAPI ENDPOINTS FOR MJPEG LIVE STREAMING
# ============================================================

@app.get("/api/health")
async def health_check():
    """Returns status of camera threads to dashboard_api."""
    status = {}
    for cam_id, thread in camera_threads.items():
        status[cam_id] = thread.is_active()
    return {"status": "ok", "cameras": status}


@app.get("/api/video_feed/{camera_id}")
async def video_feed(camera_id: str):
    """HTTP MJPEG streaming endpoint for React UI."""
    async def generate_mjpeg_stream():
        thread = camera_threads.get(camera_id)
        if not thread:
            return
        
        while not thread.stopped:
            frame_bytes = thread.get_latest_frame()
            if frame_bytes:
                yield ( 
                    b'--frame\r\n'
                    b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'
                )
            await asyncio.sleep(0.033)

    return StreamingResponse(
        generate_mjpeg_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


# ============================================================
# MAIN APPLICATION ENTRY POINT
# ============================================================

if __name__ == "__main__":
    print("============================================================")
    print("MR. DIY MULTI-CAMERA REAL-TIME FOOT TRAFFIC SYSTEM")
    print("============================================================")
    print("YOLO Streamer Server running on: http://127.0.0.1:8001")
    print("Stream endpoints live at: http://127.0.0.1:8001/api/video_feed/cam_X")
    print("Database Events posting to: http://127.0.0.1:8000/api/traffic")
    print("============================================================")

    for config in CAMERAS:
        t = CameraCounterThread(config)
        t.daemon = True
        t.start()
        camera_threads[config["camera_id"]] = t

    try:
        uvicorn.run(app, host="127.0.0.1", port=8001, log_level="info")
    except KeyboardInterrupt:
        print("\n[SYSTEM] Shutting down camera streams...")
        for t in camera_threads.values():
            t.stop()