import cv2
import requests
from ultralytics import YOLO


# ============================================================
# FASTAPI BACKEND CONNECTION
# ============================================================

API_URL = "http://127.0.0.1:8000/api/traffic"


def log_to_backend(direction, track_id):
    """
    Sends a traffic event to the FastAPI backend.
    FastAPI is responsible for saving the data to MySQL/XAMPP.
    """

    try:
        response = requests.post(
            API_URL,
            json={
                "branch_id": 1,
                "direction": direction,
                "track_id": int(track_id)
            },
            timeout=5
        )

        if response.status_code == 200:
            print(
                f"🗄️ [BACKEND-SYNC] "
                f"Track ID {track_id} ({direction}) sent successfully."
            )
        else:
            print(
                f"⚠️ [BACKEND-ERROR] "
                f"Status {response.status_code}: {response.text}"
            )

    except requests.RequestException as error:
        print(
            f"❌ [BACKEND-CONNECTION-ERROR] "
            f"Could not connect to FastAPI: {error}"
        )


# ============================================================
# 1. LOAD YOLOv8 MODEL
# ============================================================

model = YOLO("yolov8n.pt")


# ============================================================
# 2. VIDEO SOURCE
# ============================================================

VIDEO_SOURCE = "sample.mp4"

cap = cv2.VideoCapture(VIDEO_SOURCE)

if not cap.isOpened():
    print("❌ Unable to open video source.")
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

# Stores the previous Y-coordinate of each tracked person.
# Example:
# {
#     12: 280,
#     15: 350
# }
track_history = {}


# Counts how many consecutive frames an ID has been detected.
track_frame_counters = {}


# Prevents the same tracking ID from being counted repeatedly.
# Example:
# {
#     12: {"crossed": True}
# }
track_states = {}


# ============================================================
# START DETECTION
# ============================================================

print("============================================================")
print("MR. DIY FOOT TRAFFIC ANALYSIS SYSTEM")
print("============================================================")
print(f"FastAPI Backend: {API_URL}")
print("Press 'q' to stop the detection.")
print("============================================================")


while cap.isOpened():

    success, frame = cap.read()

    if not success:
        print("Video feed ended or cannot be read.")
        break


    # ========================================================
    # RESIZE FRAME
    # ========================================================

    frame = cv2.resize(frame, (640, 480))


    # ========================================================
    # YOLOv8 + TRACKING
    # ========================================================

    results = model.track(
        frame,
        persist=True,
        classes=[0],       # Person class
        verbose=False
    )


    # ========================================================
    # DRAW TRIPWIRE
    # ========================================================

    cv2.line(
        frame,
        (0, line_y),
        (640, line_y),
        (255, 0, 0),
        3
    )


    # ========================================================
    # PROCESS DETECTIONS
    # ========================================================

    if results[0].boxes.id is not None:

        boxes = results[0].boxes.xyxy.cpu().numpy()

        track_ids = (
            results[0]
            .boxes
            .id
            .cpu()
            .numpy()
            .astype(int)
        )


        for box, track_id in zip(boxes, track_ids):

            x1, y1, x2, y2 = box


            # =================================================
            # CALCULATE CENTER POINT
            # =================================================

            center_x = int((x1 + x2) / 2)
            center_y = int((y1 + y2) / 2)


            # =================================================
            # TRACK FRAME COUNTER
            # =================================================

            if track_id not in track_frame_counters:

                track_frame_counters[track_id] = 1

            else:

                track_frame_counters[track_id] += 1


            # =================================================
            # STABILITY FILTER
            # =================================================

            if track_frame_counters[track_id] > 2:


                # =============================================
                # DRAW TRACKING BOX
                # =============================================

                cv2.rectangle(
                    frame,
                    (int(x1), int(y1)),
                    (int(x2), int(y2)),
                    (0, 255, 0),
                    2
                )


                # =============================================
                # DRAW CENTER POINT
                # =============================================

                cv2.circle(
                    frame,
                    (center_x, center_y),
                    5,
                    (0, 0, 255),
                    -1
                )


                # =============================================
                # DISPLAY TRACK ID
                # =============================================

                cv2.putText(
                    frame,
                    f"ID: {track_id}",
                    (int(x1), int(y1) - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (0, 255, 0),
                    2
                )


                # =============================================
                # INITIALIZE TRACK STATE
                # =============================================

                if track_id not in track_states:

                    track_states[track_id] = {
                        "crossed": False
                    }


                # =============================================
                # CHECK PREVIOUS POSITION
                # =============================================

                if track_id in track_history:

                    prev_y = track_history[track_id]


                    # =========================================
                    # ONLY COUNT ONCE
                    # =========================================

                    if not track_states[track_id]["crossed"]:


                        # =====================================
                        # ENTRY
                        #
                        # Person moves from ABOVE the line
                        # to BELOW the line.
                        # =====================================

                        if (
                            prev_y <= line_y
                            and center_y > line_y
                        ):

                            entry_count += 1

                            track_states[track_id]["crossed"] = True


                            print(
                                f"🟢 [ENTRY] "
                                f"Person ID {track_id} entered. "
                                f"Total Entries: {entry_count}"
                            )


                            # =================================
                            # SEND TO FASTAPI
                            # =================================

                            log_to_backend(
                                direction="ENTRY",
                                track_id=track_id
                            )


                        # =====================================
                        # EXIT
                        #
                        # Person moves from BELOW the line
                        # to ABOVE the line.
                        # =====================================

                        elif (
                            prev_y >= line_y
                            and center_y < line_y
                        ):

                            exit_count += 1

                            track_states[track_id]["crossed"] = True


                            print(
                                f"🔴 [EXIT] "
                                f"Person ID {track_id} exited. "
                                f"Total Exits: {exit_count}"
                            )


                            # =================================
                            # SEND TO FASTAPI
                            # =================================

                            log_to_backend(
                                direction="EXIT",
                                track_id=track_id
                            )


                # =============================================
                # UPDATE TRACK HISTORY
                # =============================================

                track_history[track_id] = center_y


    # ========================================================
    # DISPLAY COUNTERS
    # ========================================================

    cv2.putText(
        frame,
        f"Entries: {entry_count}",
        (20, 50),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 255, 0),
        2
    )


    cv2.putText(
        frame,
        f"Exits: {exit_count}",
        (20, 90),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 0, 255),
        2
    )


    cv2.putText(
        frame,
        f"Total Traffic: {entry_count + exit_count}",
        (20, 130),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2
    )


    # ========================================================
    # SHOW VIDEO
    # ========================================================

    cv2.imshow(
        "MR. DIY Foot Traffic Analysis System",
        frame
    )


    # ========================================================
    # EXIT
    # ========================================================

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break


# ============================================================
# SAFE CLOSING
# ============================================================

cap.release()

cv2.destroyAllWindows()

print("============================================================")
print("Detection stopped.")
print(f"Final Entries: {entry_count}")
print(f"Final Exits: {exit_count}")
print("============================================================")
