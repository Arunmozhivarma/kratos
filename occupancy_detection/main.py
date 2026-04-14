import sys
import time
import threading
import queue
import importlib.util
import os
from datetime import datetime
from ultralytics import YOLO
import cv2
import requests
import platform
import logging
import gc
from flask import Flask, Response
from flask_cors import CORS

# Suppress Flask default logging to avoid cluttering stdout for Node.js
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__)
CORS(app) # Allow cross-origin requests from React
current_frame = None
condition = threading.Condition()
TARGET_STREAM_FPS = 24
STREAM_INTERVAL_SEC = 1.0 / TARGET_STREAM_FPS
INFERENCE_EVERY_N_FRAMES = 3
INFERENCE_IMG_SIZE = 384
PERSON_CLASS_ID = 0
PERSON_CONFIDENCE_THRESHOLD = 0.45
PERSON_NMS_IOU = 0.45
ZONE_REFERENCE_WIDTH = 1280.0
ZONE_REFERENCE_HEIGHT = 720.0
CAPTURE_WIDTH = 854
CAPTURE_HEIGHT = 480
MIN_OFF_DELAY_SEC = 5.0
MAX_OFF_DELAY_SEC = 60.0
MIN_ON_DELAY_SEC = 5.0
MAX_ON_DELAY_SEC = 60.0


def load_occupancy_probability_provider():
    ml_main_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "ml-model", "main.py")
    )
    try:
        spec = importlib.util.spec_from_file_location("ml_model_main", ml_main_path)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Failed to load module spec from {ml_main_path}")

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        provider = getattr(module, "get_current_occupancy_probability", None)
        if not callable(provider):
            raise RuntimeError("ml-model/main.py does not expose get_current_occupancy_probability()")

        def in_trained_time_window():
            try:
                get_current_period = getattr(module, "get_current_period", None)
                day_map = getattr(module, "DAY_MAP", {})
                if not callable(get_current_period) or not isinstance(day_map, dict):
                    return True

                now = datetime.now()
                day_name = now.strftime("%A")
                if day_name not in day_map:
                    return False

                return get_current_period(now) is not None
            except Exception:
                # Keep detection running even if timetable inspection fails.
                return True

        print("Loaded occupancy probability provider from ml-model/main.py", flush=True)
        return provider, in_trained_time_window
    except Exception as e:
        print(f"Failed to load occupancy model provider, defaulting to p=0.0: {e}", flush=True)
        return (lambda: 0.0), (lambda: False)

@app.route('/video_feed')
def video_feed():
    def generate():
        global current_frame
        last_sent_ts = 0.0
        while True:
            with condition:
                # Wait for a fresh frame, but keep a timeout so clients continue receiving bytes smoothly.
                condition.wait(timeout=STREAM_INTERVAL_SEC)
                frame_bytes = current_frame
            
            if frame_bytes is None:
                continue

            now = time.time()
            delay = STREAM_INTERVAL_SEC - (now - last_sent_ts)
            if delay > 0:
                time.sleep(delay)
            last_sent_ts = time.time()
                
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/latest_frame.jpg')
def latest_frame():
    global current_frame
    frame_bytes = current_frame
    if frame_bytes is None:
        return Response(status=503)

    response = Response(frame_bytes, mimetype='image/jpeg')
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

def run_detection(lab_id, preferred_camera_index):
    global current_frame
    gc.disable()
    occupancy_probability_provider, in_trained_time_window_provider = load_occupancy_probability_provider()
    try:
        initial_occupancy_probability = float(occupancy_probability_provider())
    except Exception as e:
        print(f"Error getting initial occupancy probability, defaulting to 0.0: {e}", flush=True)
        initial_occupancy_probability = 0.0
    initial_occupancy_probability = max(0.0, min(1.0, initial_occupancy_probability))
    initial_in_trained_time_window = bool(in_trained_time_window_provider())
    initial_off_delay_sec = MIN_OFF_DELAY_SEC + initial_occupancy_probability * (MAX_OFF_DELAY_SEC - MIN_OFF_DELAY_SEC)
    if initial_in_trained_time_window:
        initial_on_delay_sec = MIN_ON_DELAY_SEC + (1.0 - initial_occupancy_probability) * (
            MAX_ON_DELAY_SEC - MIN_ON_DELAY_SEC
        )
    else:
        initial_on_delay_sec = MAX_ON_DELAY_SEC
    print(
        (
            "Initial ML occupancy prediction at detection start: "
            f"{initial_occupancy_probability * 100:.2f}% | "
            f"computed ON delay: {initial_on_delay_sec:.2f}s | "
            f"computed OFF delay: {initial_off_delay_sec:.2f}s"
        ),
        flush=True
    )

    # Fetch zones from the Node backend API instead of local json
    try:
        api_url = f"http://localhost:5000/api/zones?labId={lab_id}"
        print(f"Fetching zones from: {api_url}", flush=True)
        response = requests.get(api_url, timeout=2.0)
        if response.status_code == 200:
            zones = response.json()
        else:
            print(f"Failed to fetch zones. Status: {response.status_code}", flush=True)
            zones = {}
    except requests.exceptions.RequestException as e:
        print(f"Error fetching zones: {e}", flush=True)
        zones = {}

    print(f"Loaded zones covering {len(zones)} locations: {list(zones.keys())}", flush=True)

    # Load YOLO model
    model = YOLO("yolov8n.pt")

    # Backend API endpoint that forwards zone-driven ON/OFF to ESP32.
    BACKEND_URL = "http://localhost:5000/api/esp32/control"

    device_statuses = {zone_key: False for zone_key in zones.keys()}
    zone_occupied_since = {zone_key: None for zone_key in zones.keys()}
    zone_empty_since = {zone_key: None for zone_key in zones.keys()}
    last_fan_status = {zone_key: False for zone_key in zones.keys()}
    last_person_boxes = []
    last_on_delay_sec = initial_on_delay_sec
    last_off_delay_sec = MIN_OFF_DELAY_SEC
    frame_counter = 0
    status_queue = queue.Queue(maxsize=256)

    def status_sender():
        session = requests.Session()
        while True:
            item = status_queue.get()
            if item is None:
                break

            zone_key, status_text, payload = item
            max_attempts = 3
            for attempt in range(1, max_attempts + 1):
                try:
                    print(
                        f"Dispatching {status_text} for {zone_key} to {BACKEND_URL} with payload={payload} (attempt {attempt}/{max_attempts})",
                        flush=True
                    )
                    resp = session.post(BACKEND_URL, json=payload, timeout=1.5)
                    if resp.status_code == 200:
                        print(
                            f"Updated {zone_key} to {status_text} (backend_status={resp.status_code})",
                            flush=True
                        )
                        break

                    print(
                        f"Failed to update {zone_key}: status={resp.status_code} body={resp.text[:200]}",
                        flush=True
                    )
                except requests.exceptions.RequestException as e:
                    print(f"Error sending update for {zone_key}: {e}", flush=True)

                if attempt < max_attempts:
                    time.sleep(0.2)

    threading.Thread(target=status_sender, daemon=True).start()

    def queue_status_update(zone_key, turn_on):
        actual_device_id = zone_key.split('_')[-1]
        payload = {
            "device_id": actual_device_id,
            "status": "ON" if turn_on else "OFF",
            "lab_id": str(lab_id)
        }
        try:
            status_queue.put_nowait((zone_key, "ON" if turn_on else "OFF", payload))
            print(
                f"Queued {'ON' if turn_on else 'OFF'} for {zone_key} (device_id={actual_device_id})",
                flush=True
            )
            return True
        except queue.Full:
            # Drop non-critical update if the queue is saturated; the next state transition will resync.
            print(f"Dropped update for {zone_key}: status queue is full", flush=True)
            return False

    print("Waiting for camera access. Starting YOLO detection loop...", flush=True)
    cap = None

    def open_camera_with_fallback(preferred_index):
        candidates = [preferred_index] + [i for i in range(6) if i != preferred_index]
        for camera_index in candidates:
            if platform.system() == "Windows":
                local_cap = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
            else:
                local_cap = cv2.VideoCapture(camera_index)

            # Keep a low capture size for speed while preserving 16:9 aspect ratio.
            local_cap.set(cv2.CAP_PROP_FRAME_WIDTH, CAPTURE_WIDTH)
            local_cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAPTURE_HEIGHT)
            local_cap.set(cv2.CAP_PROP_FPS, 30)
            local_cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            if local_cap.isOpened():
                actual_w = int(local_cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                actual_h = int(local_cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                actual_fps = local_cap.get(cv2.CAP_PROP_FPS)
                print(
                    f"Using camera index {camera_index} at {actual_w}x{actual_h} @ {actual_fps:.1f} FPS",
                    flush=True
                )
                return local_cap, camera_index

            local_cap.release()
        return None, None

    while True:
        if cap is None or not cap.isOpened():
            cap, _ = open_camera_with_fallback(preferred_camera_index)

            if cap is None:
                print("Camera locked or unavailable. Retrying...", flush=True)
                time.sleep(2)
                continue

        ret, frame = cap.read()
        if not ret:
            cap.release()
            cap = None
            time.sleep(1)
            continue

        h, w = frame.shape[:2]
        scaled_zones = {}
        for zone_key, zone in zones.items():
            (zx1, zy1), (zx2, zy2) = zone
            scaled_zones[zone_key] = (
                int(zx1 * w / ZONE_REFERENCE_WIDTH),
                int(zy1 * h / ZONE_REFERENCE_HEIGHT),
                int(zx2 * w / ZONE_REFERENCE_WIDTH),
                int(zy2 * h / ZONE_REFERENCE_HEIGHT)
            )

        frame_counter += 1
        run_inference = (frame_counter % INFERENCE_EVERY_N_FRAMES == 0)

        if run_inference:
            # Keep inference size bounded to reduce jitter on CPU-only runs.
            results = model(
                frame,
                verbose=False,
                imgsz=INFERENCE_IMG_SIZE,
                classes=[PERSON_CLASS_ID],
                conf=PERSON_CONFIDENCE_THRESHOLD,
                iou=PERSON_NMS_IOU,
                max_det=20
            )

            # Track which fan zones are occupied this frame
            fan_status = {zone_key: False for zone_key in zones.keys()}
            person_boxes = []

            for result in results:
                for box in result.boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    person_boxes.append((x1, y1, x2, y2))

            for x1, y1, x2, y2 in person_boxes:
                # Calculate center point
                cx = (x1 + x2) // 2
                cy = (y1 + y2) // 2

                # Check each bounded zone
                for zone_key, scaled in scaled_zones.items():
                    zx1, zy1, zx2, zy2 = scaled
                    if min(zx1, zx2) <= cx <= max(zx1, zx2) and min(zy1, zy2) <= cy <= max(zy1, zy2):
                        fan_status[zone_key] = True

            now_ts = time.time()
            try:
                occupancy_probability = float(occupancy_probability_provider())
            except Exception as e:
                print(f"Error getting occupancy probability, defaulting to 0.0: {e}", flush=True)
                occupancy_probability = 0.0

            occupancy_probability = max(0.0, min(1.0, occupancy_probability))
            in_trained_time_window = bool(in_trained_time_window_provider())
            if in_trained_time_window:
                on_delay_sec = MIN_ON_DELAY_SEC + (1.0 - occupancy_probability) * (
                    MAX_ON_DELAY_SEC - MIN_ON_DELAY_SEC
                )
            else:
                on_delay_sec = MAX_ON_DELAY_SEC
            off_delay_sec = MIN_OFF_DELAY_SEC + occupancy_probability * (MAX_OFF_DELAY_SEC - MIN_OFF_DELAY_SEC)
            last_on_delay_sec = on_delay_sec
            last_off_delay_sec = off_delay_sec

            # ON/OFF signals are both delay-based using continuous occupied/empty duration.
            for zone_key, occupied in fan_status.items():
                if occupied:
                    zone_empty_since[zone_key] = None
                    if zone_occupied_since[zone_key] is None:
                        zone_occupied_since[zone_key] = now_ts

                    occupied_elapsed_sec = now_ts - zone_occupied_since[zone_key]
                    if not device_statuses[zone_key] and occupied_elapsed_sec >= on_delay_sec:
                        print(
                            f"{zone_key} reached ON threshold ({occupied_elapsed_sec:.2f}s >= {on_delay_sec:.2f}s). Sending ON.",
                            flush=True
                        )
                        if queue_status_update(zone_key, turn_on=True):
                            device_statuses[zone_key] = True
                else:
                    zone_occupied_since[zone_key] = None
                    if zone_empty_since[zone_key] is None:
                        zone_empty_since[zone_key] = now_ts

                    empty_elapsed_sec = now_ts - zone_empty_since[zone_key]
                    if device_statuses[zone_key] and empty_elapsed_sec >= off_delay_sec:
                        print(
                            f"{zone_key} reached OFF threshold ({empty_elapsed_sec:.2f}s >= {off_delay_sec:.2f}s). Sending OFF.",
                            flush=True
                        )
                        if queue_status_update(zone_key, turn_on=False):
                            device_statuses[zone_key] = False

            last_fan_status = fan_status
            last_person_boxes = person_boxes

        fan_status = last_fan_status

        # Draw person boxes from last inference to keep output fluid between inference frames.
        for x1, y1, x2, y2 in last_person_boxes:
            cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)

        # Draw zones and show status
        for zone_key, scaled in scaled_zones.items():
            zx1, zy1, zx2, zy2 = scaled
            device_on = device_statuses[zone_key]
            zone_occupied = fan_status[zone_key]
            color = (0, 255, 0) if device_on else (0, 0, 255)
            cv2.rectangle(frame, (zx1, zy1), (zx2, zy2), color, 2)

            status_text = f"{zone_key}: {'ON' if device_on else 'OFF'}"
            if not zone_occupied and device_on and zone_empty_since[zone_key] is not None:
                empty_elapsed = time.time() - zone_empty_since[zone_key]
                wait_remaining = max(0, int(last_off_delay_sec - empty_elapsed))
                status_text += f" ({wait_remaining}s)"
            elif zone_occupied and not device_on and zone_occupied_since[zone_key] is not None:
                occupied_elapsed = time.time() - zone_occupied_since[zone_key]
                wait_remaining = max(0, int(last_on_delay_sec - occupied_elapsed))
                status_text += f" ({wait_remaining}s)"
            # Ensure text is not drawn outside image if zy1 is near 0
            text_y = zy1 - 10 if zy1 > 20 else min(zy1, zy2) + 20
            
            cv2.putText(frame, status_text, (zx1, text_y),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        # Compress frame quickly (quality 60) for better visual clarity and smoothness balance.
        ret, jpeg = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 60])
        if ret:
            frame_bytes = jpeg.tobytes()
            # Safely notify all streaming web browsers that a fresh image is explicitly ready to draw
            with condition:
                current_frame = frame_bytes
                condition.notify_all()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python main.py <labId> [cameraIndex]")
        sys.exit(1)

    try:
        lab_id = sys.argv[1]
        preferred_camera_index = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    except Exception as e:
        print(f"Error reading startup arguments: {e}", flush=True)
        sys.exit(1)

    # Start Flask MJPEG endpoint as a background daemon
    threading.Thread(target=lambda: app.run(host='0.0.0.0', port=5001, debug=False, use_reloader=False), daemon=True).start()

    run_detection(lab_id, preferred_camera_index)
