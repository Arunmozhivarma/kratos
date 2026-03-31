import sys
import time
import threading
import queue
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

    # Backend API endpoint to report device status
    BACKEND_URL = "http://localhost:5000/api/devices/update"

    previous_statuses = {zone_key: False for zone_key in zones.keys()}
    last_fan_status = {zone_key: False for zone_key in zones.keys()}
    last_person_boxes = []
    frame_counter = 0
    status_queue = queue.Queue(maxsize=256)

    def status_sender():
        session = requests.Session()
        while True:
            item = status_queue.get()
            if item is None:
                break

            zone_key, status_text, payload = item
            try:
                resp = session.post(BACKEND_URL, json=payload, timeout=0.2)
                if resp.status_code == 200:
                    print(f"Updated {zone_key} to {status_text}", flush=True)
                else:
                    print(f"Failed to update {zone_key}: {resp.status_code}", flush=True)
            except requests.exceptions.RequestException as e:
                print(f"Error sending update for {zone_key}: {e}", flush=True)

    threading.Thread(target=status_sender, daemon=True).start()

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

            # Send updates to backend only if status changed
            for zone_key, status in fan_status.items():
                if status != previous_statuses[zone_key]:
                    try:
                        payload = {
                            "fan_id": zone_key.split('_')[-1],
                            "lab_id": lab_id,
                            "status": "ON" if status else "OFF"
                        }
                        status_queue.put_nowait((zone_key, "ON" if status else "OFF", payload))
                    except queue.Full:
                        # Drop non-critical update if the queue is saturated; the next state transition will resync.
                        pass
                    previous_statuses[zone_key] = status

            last_fan_status = fan_status
            last_person_boxes = person_boxes

        fan_status = last_fan_status

        # Draw person boxes from last inference to keep output fluid between inference frames.
        for x1, y1, x2, y2 in last_person_boxes:
            cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)

        # Draw zones and show status
        for zone_key, scaled in scaled_zones.items():
            zx1, zy1, zx2, zy2 = scaled
            color = (0, 255, 0) if fan_status[zone_key] else (0, 0, 255)
            cv2.rectangle(frame, (zx1, zy1), (zx2, zy2), color, 2)

            status_text = f"{zone_key}: ON" if fan_status[zone_key] else f"{zone_key}: OFF"
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
