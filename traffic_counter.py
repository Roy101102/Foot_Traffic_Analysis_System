import os
import cv2
import time
import asyncio
import urllib.parse
import requests
import threading
import numpy as np
import torch
from contextlib import asynccontextmanager
from typing import Dict, Optional
from pydantic import BaseModel, ConfigDict, Field
from ultralytics import YOLO
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from heatmap_history import heatmap_store, history_router

# Low-latency RTSP options for OpenCV
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|fflags;nobuffer|max_delay;0"

# Target Database API endpoint running from dashboard_api.py
API_URL = "http://127.0.0.1:8000/api/traffic"

# Camera password: set the CAM_PASS environment variable to avoid keeping it in the code.
CAM_PASS = os.getenv("CAM_PASS", "Group5Bayawan")

# Reusable HTTP session for faster connection pooling
http_session = requests.Session()

# Global store and locks for active camera threads
camera_threads: Dict[str, "CameraCounterThread"] = {}
threads_lock = threading.Lock()
model_load_lock = threading.Lock()


# ============================================================
# DETECTION TUNING  (every value can be overridden with an environment variable)
# ============================================================
# Examples (Windows cmd):   set YOLO_MODEL=yolov8m.pt
#                           set YOLO_CONF=0.10
# The defaults below favour DETECTING EVERY PERSON quickly. If the video becomes
# too slow, use a smaller model (yolov8n.pt) or a smaller YOLO_IMGSZ (480).

HAS_CUDA = torch.cuda.is_available()
DEVICE = 0 if HAS_CUDA else "cpu"

# Bigger model = finds more people (n < s < m < l < x). GPU: medium, CPU: small.
YOLO_MODEL = os.getenv("YOLO_MODEL", "yolov8m.pt" if HAS_CUDA else "yolov8s.pt")

# Detection resolution. The old value was 320, which made people tiny and hard to find.
YOLO_IMGSZ = int(os.getenv("YOLO_IMGSZ", "640"))

# Minimum confidence to accept a detection. Lower = more people found, but more false alarms.
# (default YOLO value is 0.25)
YOLO_CONF = float(os.getenv("YOLO_CONF", "0.15"))
YOLO_IOU = float(os.getenv("YOLO_IOU", "0.6"))

# Boost contrast before detecting (helps dark scenes and grey night/IR images).
ENHANCE_CONTRAST = os.getenv("ENHANCE_CONTRAST", "1") != "0"

# A person is shown / added to the heatmap after this many frames (1 = immediately).
MIN_SHOW_FRAMES = int(os.getenv("MIN_SHOW_FRAMES", "1"))
# Entry/exit is only COUNTED after the track has lasted this many frames (stops one-frame ghosts).
MIN_COUNT_FRAMES = int(os.getenv("MIN_COUNT_FRAMES", "3"))

# Large camera frames are shrunk to this longest side before detection (saves time).
MAX_INFER_SIDE = int(os.getenv("MAX_INFER_SIDE", "1280"))

# Tracker settings, written to a file next to this script. Weak detections (just above
# YOLO_CONF) keep an existing person tracked; a NEW person starts at YOLO_CONF + 0.05.
TRACKER_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bytetrack_sensitive.yaml")


def write_tracker_config() -> str:
    high = round(YOLO_CONF + 0.05, 2)
    low = max(0.05, round(YOLO_CONF - 0.05, 2))
    content = (
        "tracker_type: bytetrack\n"
        f"track_high_thresh: {high}\n"
        f"track_low_thresh: {low}\n"
        f"new_track_thresh: {high}\n"
        "track_buffer: 60\n"        # keep a lost person's ID for ~60 frames
        "match_thresh: 0.8\n"
        "fuse_score: True\n"
    )
    try:
        with open(TRACKER_FILE, "w", encoding="utf-8") as f:
            f.write(content)
        return TRACKER_FILE
    except OSError as e:
        print(f"[DETECTOR] Could not write {TRACKER_FILE} ({e}). Using the default bytetrack.yaml.")
        return "bytetrack.yaml"


TRACKER_CONFIG = write_tracker_config()


# ============================================================
# PYDANTIC DATA SCHEMAS
# ============================================================

class CameraCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    camera_id: Optional[str] = None
    name: str
    ip: str
    user: Optional[str] = "admin"
    pass_word: Optional[str] = Field("", alias="pass")
    channel: Optional[str] = "102"
    line_y: Optional[int] = Field(300, ge=0, le=480)
    count_traffic: Optional[bool] = None


class CameraUpdate(BaseModel):
    name: Optional[str] = None
    line_y: Optional[int] = Field(None, ge=0, le=480)
    count_traffic: Optional[bool] = None


# ============================================================
# BACKEND DB LOGGING HELPER
# ============================================================

def send_request(camera_id: str, direction: str, track_id: int):
    """Worker function executed in a background thread to send crossing events to dashboard_api."""
    try:
        response = http_session.post(
            API_URL,
            json={
                "branch_id": 1,
                "camera_id": camera_id,
                "direction": direction,
                "track_id": int(track_id),
            },
            timeout=2,
        )
        if response.status_code == 200:
            print(f"[{camera_id}] Track ID {track_id} ({direction}) logged successfully to DB.")
        else:
            print(f"[{camera_id}] Status {response.status_code}: {response.text}")
    except requests.RequestException as e:
        print(f"[{camera_id}] Could not connect to API server at {API_URL}: {e}")


def log_to_backend(camera_id: str, direction: str, track_id: int):
    """Spawns a non-blocking daemon thread for API requests."""
    threading.Thread(
        target=send_request,
        args=(camera_id, direction, track_id),
        daemon=True,
    ).start()


# ============================================================
# INITIAL CAMERA CONFIGURATIONS (ZONE 1, 2 & 3)
# ============================================================

DEFAULT_CAMERAS = [
    {
        "camera_id": "cam_1",
        "name": "Zone 1: Main Entrance Gate",
        "ip": "172.16.32.97",
        "user": "admin",
        "pass": CAM_PASS,
        "channel": "102",
        "line_y": 300,
        "count_traffic": True,   # Entrance/Exit gate: counts entries & exits
    },
    {
        "camera_id": "cam_2",
        "name": "Zone 2: Hardware & Tools Aisle",
        "ip": "172.16.32.100",
        "user": "admin",
        "pass": CAM_PASS,
        "channel": "102",
        "line_y": 300,
        "count_traffic": False,  # Interior aisle: heatmap & live presence only
    },
    {
        "camera_id": "cam_3",
        "name": "Zone 3: Household & Electrical Aisle",
        "ip": "172.16.32.111",
        "user": "admin",
        "pass": CAM_PASS,
        "channel": "102",
        "line_y": 300,
        "count_traffic": False,  # Interior aisle: heatmap & live presence only
    },
]


# ============================================================
# FLOOR PLAN CALIBRATION (CAMERA PIXELS -> FLOOR PLAN 0..1)
# ============================================================

FLOOR_CALIBRATION = {
    "cam_1": {  # Entrance
        "img": [[0, 0], [640, 0], [640, 480], [0, 480]],
        "floor": [[0.30, 0.75], [0.70, 0.75], [0.70, 1.00], [0.30, 1.00]],
    },
    "cam_2": {  # Left wing (Hardware & Tools)
        "img": [[0, 0], [640, 0], [640, 480], [0, 480]],
        "floor": [[0.02, 0.05], [0.40, 0.05], [0.40, 0.65], [0.02, 0.65]],
    },
    "cam_3": {  # Right wing (Household & Electrical)
        "img": [[0, 0], [640, 0], [640, 480], [0, 480]],
        "floor": [[0.60, 0.05], [0.98, 0.05], [0.98, 0.65], [0.60, 0.65]],
    },
}


# ============================================================
# DEDICATED RTSP FRAME FLUSHER (PREVENTS BUFFER ACCUMULATION)
# ============================================================

class RTSPFrameGrabber:
    def __init__(self, rtsp_url: str):
        self.rtsp_url = rtsp_url
        self.cap = None
        self.grabbed = False
        self.frame = None
        self.frame_id = 0
        self.stopped = False
        self._lock = threading.Lock()
        self._connect()

    def _connect(self):
        if self.cap is not None:
            self.cap.release()
        self.cap = cv2.VideoCapture(self.rtsp_url, cv2.CAP_FFMPEG)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    def start(self):
        threading.Thread(target=self.update, daemon=True).start()
        return self

    def update(self):
        consecutive_failures = 0
        while not self.stopped:
            if self.cap is None or not self.cap.isOpened():
                time.sleep(1.0)
                self._connect()
                continue

            grabbed, frame = self.cap.read()
            if grabbed and frame is not None:
                consecutive_failures = 0
                with self._lock:
                    self.grabbed = True
                    self.frame = frame
                    self.frame_id += 1
            else:
                consecutive_failures += 1
                if consecutive_failures >= 30:
                    with self._lock:
                        self.grabbed = False
                    consecutive_failures = 0
                    time.sleep(1.0)
                    self._connect()
                else:
                    time.sleep(0.01)

    def read(self):
        with self._lock:
            if not self.grabbed or self.frame is None:
                return False, None, self.frame_id
            return True, self.frame.copy(), self.frame_id

    def stop(self):
        self.stopped = True
        if self.cap is not None:
            self.cap.release()


# ============================================================
# MULTI-CAMERA DETECTION THREAD WORKER
# ============================================================

class CameraCounterThread(threading.Thread):
    def __init__(self, config: dict):
        super().__init__(daemon=True)
        self.config = config
        self.camera_id = config["camera_id"]
        self.display_name = config.get("name", f"Camera {self.camera_id}")
        self.ip = config.get("ip", "")
        self.user = config.get("user", "admin")
        self.pass_word = config.get("pass", "")
        self.channel = config.get("channel", "102")
        self.line_y = int(config.get("line_y", 300))
        self.stopped = False

        # Only entrance cameras count entries/exits; interior zones only track heatmap points
        if config.get("count_traffic") is not None:
            self.count_traffic = bool(config["count_traffic"])
        else:
            self.count_traffic = (
                self.camera_id == "cam_1"
                or self.ip.strip() == "172.16.32.100"
                or "entrance" in self.display_name.lower()
            )

        self.latest_jpeg_bytes: Optional[bytes] = None
        self.last_frame_time: float = 0.0
        self.lock = threading.Lock()

        encoded_pass = urllib.parse.quote_plus(self.pass_word)
        self.rtsp_url = (
            f"rtsp://{self.user}:{encoded_pass}@{self.ip}:554/Streaming/Channels/{self.channel}"
        )

        self.entry_count = 0
        self.exit_count = 0
        self.track_history: Dict[int, int] = {}
        self.track_frame_counters: Dict[int, int] = {}
        self.track_last_seen: Dict[int, int] = {}
        self.track_states: Dict[int, dict] = {}
        self.processed_frames = 0
        self.detect_fps = 0.0

        # Per-thread contrast enhancer (OpenCV CLAHE objects are not thread-safe)
        self.clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))

        # Serialize model initialization to avoid concurrent file/weights access.
        # The warm-up runs one dummy frame so the FIRST real frame is not slow.
        with model_load_lock:
            self.model = YOLO(YOLO_MODEL)
            self._warm_up()

        # ---- HEATMAP: latest floor-plan positions + homography for this camera ----
        self.latest_points: list = []
        cal = FLOOR_CALIBRATION.get(self.camera_id)
        self.H = (
            cv2.getPerspectiveTransform(np.float32(cal["img"]), np.float32(cal["floor"]))
            if cal
            else None
        )

    # ---------------- detection helpers ----------------

    def _infer(self, image):
        return self.model.track(
            image,
            persist=True,
            classes=[0],              # person only
            imgsz=YOLO_IMGSZ,
            conf=YOLO_CONF,
            iou=YOLO_IOU,
            tracker=TRACKER_CONFIG,
            device=DEVICE,
            agnostic_nms=True,
            max_det=50,
            verbose=False,
        )

    def _warm_up(self):
        try:
            self._infer(np.zeros((480, 640, 3), dtype=np.uint8))
        except Exception as e:
            print(f"[{self.camera_id}] Model warm-up skipped: {e}")

    def _enhance(self, image):
        """CLAHE on the brightness channel only: more contrast, same colours."""
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l_chan, a_chan, b_chan = cv2.split(lab)
        l_chan = self.clahe.apply(l_chan)
        return cv2.cvtColor(cv2.merge((l_chan, a_chan, b_chan)), cv2.COLOR_LAB2BGR)

    # ---------------- controls ----------------

    def set_name(self, name: str):
        with self.lock:
            self.display_name = name

    def set_line_y(self, line_y: int):
        with self.lock:
            self.line_y = max(0, min(480, int(line_y)))

    def set_count_traffic(self, enabled: bool):
        with self.lock:
            self.count_traffic = bool(enabled)

    def reset_counts(self):
        with self.lock:
            self.entry_count = 0
            self.exit_count = 0
            self.track_history.clear()
            self.track_states.clear()
            self.track_frame_counters.clear()
            self.track_last_seen.clear()

    def get_latest_frame(self) -> Optional[bytes]:
        with self.lock:
            return self.latest_jpeg_bytes

    def get_points(self) -> list:
        """Latest person positions on the floor plan (normalized 0..1)."""
        with self.lock:
            return list(self.latest_points)

    def is_active(self) -> bool:
        with self.lock:
            if self.stopped or self.latest_jpeg_bytes is None:
                return False
            return (time.time() - self.last_frame_time) < 5.0

    def get_info(self, base_url: str = "http://127.0.0.1:8001"):
        clean_base = base_url.rstrip("/")
        with self.lock:
            online = (
                not self.stopped
                and self.latest_jpeg_bytes is not None
                and (time.time() - self.last_frame_time) < 5.0
            )
            entries = self.entry_count if self.count_traffic else 0
            exits = self.exit_count if self.count_traffic else 0
            return {
                "id": self.camera_id,
                "camera_id": self.camera_id,
                "name": self.display_name,
                "ip": self.ip,
                "user": self.user,
                "channel": self.channel,
                "lineY": self.line_y,
                "line_y": self.line_y,
                "countTraffic": self.count_traffic,
                "entryCount": entries,
                "exitCount": exits,
                "liveCount": max(0, entries - exits),
                "peopleDetected": len(self.latest_points),
                "detectFps": round(self.detect_fps, 1),
                "isOnline": online,
                "isStreaming": not self.stopped,
                "streamUrl": f"{clean_base}/api/video_feed/{self.camera_id}",
            }

    def _prune_stale_tracks(self, max_age_frames: int = 150):
        stale_ids = [
            tid
            for tid, last_seen in self.track_last_seen.items()
            if (self.processed_frames - last_seen) > max_age_frames
        ]
        for tid in stale_ids:
            self.track_last_seen.pop(tid, None)
            self.track_history.pop(tid, None)
            self.track_frame_counters.pop(tid, None)
            self.track_states.pop(tid, None)

    def run(self):
        mode_label = "ENTRANCE COUNTER + HEATMAP" if self.count_traffic else "INTERIOR HEATMAP ONLY"
        print(f"Connecting to [{self.camera_id}] {self.display_name} ({self.ip}) [{mode_label}]...")
        stream = RTSPFrameGrabber(self.rtsp_url).start()
        last_grabbed_id = -1

        try:
            while not self.stopped:
                grabbed, frame, frame_id = stream.read()
                if not grabbed or frame is None or frame_id == last_grabbed_id:
                    time.sleep(0.01)
                    continue

                last_grabbed_id = frame_id
                self.processed_frames += 1

                # Everything the dashboard uses (line_y, floor calibration) lives in 640x480
                display_frame = cv2.resize(frame, (640, 480))

                # Detect on the ORIGINAL frame (more pixels per person than a 640x480 copy),
                # shrunk only if it is huge. Boxes are scaled back to 640x480 below.
                infer_frame = frame
                h, w = frame.shape[:2]
                if max(h, w) > MAX_INFER_SIDE:
                    k = MAX_INFER_SIDE / float(max(h, w))
                    infer_frame = cv2.resize(
                        frame, (int(w * k), int(h * k)), interpolation=cv2.INTER_AREA
                    )
                ih, iw = infer_frame.shape[:2]
                scale = np.array([640.0 / iw, 480.0 / ih, 640.0 / iw, 480.0 / ih], dtype=np.float32)

                if ENHANCE_CONTRAST:
                    infer_frame = self._enhance(infer_frame)

                t0 = time.time()
                results = self._infer(infer_frame)
                dt = max(1e-3, time.time() - t0)
                self.detect_fps = (0.8 * self.detect_fps + 0.2 / dt) if self.detect_fps else (1.0 / dt)
                if self.processed_frames % 300 == 0:
                    print(
                        f"[{self.camera_id}] detector at {self.detect_fps:.1f} FPS "
                        f"({YOLO_MODEL}, imgsz={YOLO_IMGSZ}, conf={YOLO_CONF})"
                    )

                with self.lock:
                    current_line_y = self.line_y
                    cam_name = self.display_name
                    should_count = self.count_traffic

                # HEATMAP: positions found in THIS frame
                frame_points = []

                with self.lock:
                    if results and results[0].boxes is not None and results[0].boxes.id is not None:
                        boxes = results[0].boxes.xyxy.cpu().numpy() * scale
                        confs = results[0].boxes.conf.cpu().numpy()
                        track_ids = results[0].boxes.id.cpu().numpy().astype(int)

                        for box, conf, track_id in zip(boxes, confs, track_ids):
                            x1, y1, x2, y2 = box
                            center_x = int((x1 + x2) / 2)
                            center_y = int((y1 + y2) / 2)

                            self.track_last_seen[track_id] = self.processed_frames
                            self.track_frame_counters[track_id] = (
                                self.track_frame_counters.get(track_id, 0) + 1
                            )
                            frames_seen = self.track_frame_counters[track_id]

                            # People are SHOWN straight away (MIN_SHOW_FRAMES=1)...
                            if frames_seen >= MIN_SHOW_FRAMES:
                                # ---- HEATMAP: foot point (bottom-center of box) -> floor plan ----
                                foot_x = int((x1 + x2) / 2)
                                foot_y = int(y2)
                                if self.H is not None:
                                    foot = np.float32([[[foot_x, foot_y]]])
                                    fx, fy = cv2.perspectiveTransform(foot, self.H)[0][0]
                                    if 0.0 <= fx <= 1.0 and 0.0 <= fy <= 1.0:
                                        frame_points.append(
                                            {
                                                "x": float(fx),
                                                "y": float(fy),
                                                "frames": int(frames_seen),
                                                "camera_id": self.camera_id,
                                                "track_id": int(track_id),
                                            }
                                        )
                                # yellow dot = foot point used for the heatmap
                                cv2.circle(display_frame, (foot_x, foot_y), 6, (0, 255, 255), -1)

                                cv2.rectangle(
                                    display_frame,
                                    (int(x1), int(y1)),
                                    (int(x2), int(y2)),
                                    (0, 255, 0),
                                    2,
                                )
                                cv2.circle(display_frame, (center_x, center_y), 5, (0, 0, 255), -1)
                                cv2.putText(
                                    display_frame,
                                    f"ID: {track_id} {conf:.2f}",
                                    (int(x1), max(15, int(y1) - 10)),
                                    cv2.FONT_HERSHEY_SIMPLEX,
                                    0.6,
                                    (0, 255, 0),
                                    2,
                                )

                                # Only Zone 1 (entrance/exit gate) counts entries & exits
                                if should_count:
                                    if track_id not in self.track_states:
                                        self.track_states[track_id] = {"last_direction": None}

                                    # ...but only COUNTED once the track is stable (MIN_COUNT_FRAMES)
                                    if (
                                        frames_seen >= MIN_COUNT_FRAMES
                                        and track_id in self.track_history
                                    ):
                                        prev_y = self.track_history[track_id]
                                        last_dir = self.track_states[track_id]["last_direction"]

                                        if (
                                            prev_y <= current_line_y
                                            and center_y > current_line_y
                                            and last_dir != "ENTRY"
                                        ):
                                            self.entry_count += 1
                                            self.track_states[track_id]["last_direction"] = "ENTRY"
                                            print(
                                                f"[{self.camera_id} ENTRY] Person ID {track_id}. "
                                                f"Total Entries: {self.entry_count}"
                                            )
                                            log_to_backend(self.camera_id, "ENTRY", track_id)

                                        elif (
                                            prev_y >= current_line_y
                                            and center_y < current_line_y
                                            and last_dir != "EXIT"
                                        ):
                                            self.exit_count += 1
                                            self.track_states[track_id]["last_direction"] = "EXIT"
                                            print(
                                                f"[{self.camera_id} EXIT] Person ID {track_id}. "
                                                f"Total Exits: {self.exit_count}"
                                            )
                                            log_to_backend(self.camera_id, "EXIT", track_id)

                                    self.track_history[track_id] = center_y

                    # HEATMAP: publish this frame's positions (empty list = nobody visible)
                    self.latest_points = frame_points

                    if self.processed_frames % 100 == 0:
                        self._prune_stale_tracks()

                # Save this frame's positions for the historical heatmap (throttled inside)
                heatmap_store.record(self.camera_id, frame_points)

                cv2.putText(
                    display_frame, cam_name, (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2
                )

                ret, buffer = cv2.imencode(".jpg", display_frame)
                if ret:
                    with self.lock:
                        self.latest_jpeg_bytes = buffer.tobytes()
                        self.last_frame_time = time.time()
        finally:
            stream.stop()

    def stop(self):
        self.stopped = True


# ============================================================
# FASTAPI LIFESPAN & INITIALIZATION
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    heatmap_store.start()
    print("============================================================")
    print("MR. DIY MULTI-CAMERA REAL-TIME FOOT TRAFFIC SYSTEM")
    print("============================================================")
    print("YOLO Streamer Server running on: http://0.0.0.0:8001")
    print("Stream endpoints live at: http://<server-ip>:8001/api/video_feed/cam_X")
    print("Heatmap points at:        http://127.0.0.1:8001/api/heatmap_points")
    print(f"Database Events posting to: {API_URL}")
    print(
        f"Detector: {YOLO_MODEL} | imgsz={YOLO_IMGSZ} | conf={YOLO_CONF} | "
        f"device={'GPU' if HAS_CUDA else 'CPU'} | contrast boost={'on' if ENHANCE_CONTRAST else 'off'}"
    )
    print("============================================================")

    with threads_lock:
        for config in DEFAULT_CAMERAS:
            cam_id = config["camera_id"]
            if cam_id not in camera_threads:
                t = CameraCounterThread(config)
                t.start()
                camera_threads[cam_id] = t

    yield

    print("\n[SYSTEM] Shutting down camera streams...")
    heatmap_store.stop()
    with threads_lock:
        for t in camera_threads.values():
            t.stop()
        camera_threads.clear()


app = FastAPI(title="MR. DIY Live Video Streamer API", lifespan=lifespan)
app.include_router(history_router)   # /api/heatmap_history (saved heatmap by day/week/month)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# FASTAPI ENDPOINTS & CAMERA MANAGEMENT CONTROLLERS
# ============================================================

@app.get("/api/health")
async def health_check():
    """Returns status of camera threads."""
    with threads_lock:
        status = {cam_id: thread.is_active() for cam_id, thread in camera_threads.items()}
    return {"status": "ok", "cameras": status}


@app.get("/api/heatmap_points")
async def heatmap_points():
    """Current person positions on the floor plan (normalized 0..1) from all cameras."""
    with threads_lock:
        threads = list(camera_threads.values())
    points = [p for t in threads for p in t.get_points()]
    return {"points": points}


@app.get("/api/cameras")
async def get_cameras(request: Request):
    """Returns detailed information and metrics for all running cameras."""
    base_url = str(request.base_url)
    with threads_lock:
        return [thread.get_info(base_url) for thread in camera_threads.values()]


@app.post("/api/cameras", status_code=201)
def add_camera(camera: CameraCreate, request: Request):
    """Dynamically validates RTSP connection and starts camera pipeline thread."""
    cam_id = camera.camera_id or f"cam_{int(time.time())}"
    with threads_lock:
        if cam_id in camera_threads:
            raise HTTPException(status_code=400, detail="Camera ID already exists.")

    is_entrance = (
        camera.count_traffic
        if camera.count_traffic is not None
        else (cam_id == "cam_1" or camera.ip.strip() == "172.16.32.100" or "entrance" in camera.name.lower())
    )

    config = {
        "camera_id": cam_id,
        "name": camera.name,
        "ip": camera.ip,
        "user": camera.user or "admin",
        "pass": camera.pass_word or "",
        "channel": camera.channel or "102",
        "line_y": camera.line_y if camera.line_y is not None else 300,
        "count_traffic": is_entrance,
    }

    t = CameraCounterThread(config)
    t.start()

    # Poll up to 5 seconds to verify stream yields frames
    start_time = time.time()
    connected = False
    while time.time() - start_time < 5.0:
        if t.get_latest_frame() is not None:
            connected = True
            break
        time.sleep(0.2)

    if not connected:
        t.stop()
        raise HTTPException(
            status_code=401,
            detail="Authentication failed or stream unreachable. Please verify the IP address, RTSP username, and password.",
        )

    with threads_lock:
        if cam_id in camera_threads:
            t.stop()
            raise HTTPException(status_code=400, detail="Camera ID already exists.")
        camera_threads[cam_id] = t

    return t.get_info(str(request.base_url))


@app.patch("/api/cameras/{camera_id}")
async def update_camera(camera_id: str, camera_update: CameraUpdate, request: Request):
    """Updates properties such as the camera name, line_y, or count_traffic dynamically."""
    with threads_lock:
        thread = camera_threads.get(camera_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Camera not found.")

    if camera_update.name is not None:
        thread.set_name(camera_update.name)
    if camera_update.line_y is not None:
        thread.set_line_y(camera_update.line_y)
    if camera_update.count_traffic is not None:
        thread.set_count_traffic(camera_update.count_traffic)

    return thread.get_info(str(request.base_url))


@app.delete("/api/cameras/{camera_id}")
async def delete_camera(camera_id: str):
    """Stops and removes a camera pipeline."""
    with threads_lock:
        thread = camera_threads.pop(camera_id, None)
    if not thread:
        raise HTTPException(status_code=404, detail="Camera not found.")

    thread.stop()
    return {"message": f"Camera {camera_id} stopped and deleted."}


@app.post("/api/cameras/{camera_id}/reset")
async def reset_camera_counts(camera_id: str, request: Request):
    """Resets entry and exit counts for a specific camera."""
    with threads_lock:
        thread = camera_threads.get(camera_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Camera not found.")

    thread.reset_counts()
    return thread.get_info(str(request.base_url))


@app.get("/api/video_feed/{camera_id}")
async def video_feed(camera_id: str):
    """HTTP MJPEG streaming endpoint for React UI."""
    with threads_lock:
        thread = camera_threads.get(camera_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Camera not found.")

    async def generate_mjpeg_stream():
        last_sent = None
        while not thread.stopped:
            frame_bytes = thread.get_latest_frame()
            if frame_bytes and frame_bytes is not last_sent:
                last_sent = frame_bytes
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
                )
            await asyncio.sleep(0.033)

    return StreamingResponse(
        generate_mjpeg_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ============================================================
# MAIN APPLICATION ENTRY POINT
# ============================================================

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
