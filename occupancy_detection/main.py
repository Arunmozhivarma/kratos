import sys
import time
import threading
from ultralytics import YOLO
import cv2
import requests
import platform
import logging
from flask import Flask, Response
from flask_cors import CORS

# Suppress Flask default logging to avoid cluttering stdout for Node.js
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__)
CORS(app) # Allow cross-origin requests from React
current_frame = None
condition = threading.Condition()

@app.route('/video_feed')
def video_feed():
    def generate():
        global current_frame
        while True:
            with condition:
                # Wait blocks the generator until YOLO says a completely new frame is fully processed
                condition.wait()
                frame_bytes = current_frame
            
            if frame_bytes is None:
                continue
                
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

def run_detection(lab_id):
    global current_frame

    # Fetch zones from the Node backend API instead of local json
    try:
        api_url = f"http://localhost:5000/api/zones?labId={lab_id}"
        print(f"Fetching zones from: {api_url}", flush=True)
        response = requests.get(api_url)
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

    print("Waiting for camera access. Starting YOLO detection loop...", flush=True)
    cap = None

    while True:
        if cap is None or not cap.isOpened():
            if platform.system() == "Windows":
                cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
            else:
                cap = cv2.VideoCapture(0)
            
            # Prevent camera hardware buffer from stacking old frames and causing massive lag
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            
            if not cap.isOpened():
                print("Camera locked or unavailable. Retrying...", flush=True)
                time.sleep(2)
                continue

        ret, frame = cap.read()
        if not ret:
            cap.release()
            time.sleep(1)
            continue

        results = model(frame, verbose=False)

        # Track which fan zones are occupied this frame
        fan_status = {zone_key: False for zone_key in zones.keys()}

        for result in results:
            for box in result.boxes:
                cls = int(box.cls[0])

                if model.names[cls] == "person":
                    x1, y1, x2, y2 = map(int, box.xyxy[0])

                    # Draw person box directly onto frame
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)

                    # Calculate center point
                    cx = (x1 + x2) // 2
                    cy = (y1 + y2) // 2

                    h, w = frame.shape[:2]
                    
                    # Check each bounded zone
                    for zone_key, zone in zones.items():
                        (zx1, zy1), (zx2, zy2) = zone
                        
                        # Scale from frontend 1280x720 canvas coordinates to actual camera frame resolution
                        zx1 = int(zx1 * w / 1280.0)
                        zy1 = int(zy1 * h / 720.0)
                        zx2 = int(zx2 * w / 1280.0)
                        zy2 = int(zy2 * h / 720.0)

                        if min(zx1, zx2) <= cx <= max(zx1, zx2) and min(zy1, zy2) <= cy <= max(zy1, zy2):
                            fan_status[zone_key] = True

        # Send updates to backend only if status changed
        for zone_key, status in fan_status.items():
            if status != previous_statuses[zone_key]:
                # Extract the actual integer device key (e.g. configBox1_1 -> 1)
                actual_fan_id = zone_key.split('_')[-1]
                try:
                    payload = {
                        "fan_id": actual_fan_id,
                        "lab_id": lab_id,
                        "status": "ON" if status else "OFF"
                    }
                    resp = requests.post(BACKEND_URL, json=payload)
                    if resp.status_code == 200:
                        # Output string identically parsed by Node (flush guarantees immediate read)
                        print(f"Updated {zone_key} to {'ON' if status else 'OFF'}", flush=True)
                    else:
                        print(f"Failed to update {zone_key}: {resp.status_code}", flush=True)
                except requests.exceptions.RequestException as e:
                    print(f"Error sending update for {zone_key}: {e}", flush=True)
                previous_statuses[zone_key] = status

        h, w = frame.shape[:2]

        # Draw zones and show status
        for zone_key, zone in zones.items():
            (zx1, zy1), (zx2, zy2) = zone
            zx1 = int(zx1 * w / 1280.0)
            zy1 = int(zy1 * h / 720.0)
            zx2 = int(zx2 * w / 1280.0)
            zy2 = int(zy2 * h / 720.0)

            color = (0, 255, 0) if fan_status[zone_key] else (0, 0, 255)
            cv2.rectangle(frame, (zx1, zy1), (zx2, zy2), color, 2)

            status_text = f"{zone_key}: ON" if fan_status[zone_key] else f"{zone_key}: OFF"
            # Ensure text is not drawn outside image if zy1 is near 0
            text_y = zy1 - 10 if zy1 > 20 else min(zy1, zy2) + 20
            
            cv2.putText(frame, status_text, (zx1, text_y),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        # Compress frame to JPEG instantly (quality 70 for speed and lower network latency)
        ret, jpeg = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
        if ret:
            frame_bytes = jpeg.tobytes()
            # Safely notify all streaming web browsers that a fresh image is explicitly ready to draw
            with condition:
                current_frame = frame_bytes
                condition.notify_all()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python main.py <labId>")
        sys.exit(1)

    try:
        lab_id = sys.argv[1]
    except Exception as e:
        print(f"Error reading labId: {e}", flush=True)
        sys.exit(1)

    # Start Flask MJPEG endpoint as a background daemon
    threading.Thread(target=lambda: app.run(host='0.0.0.0', port=5001, debug=False, use_reloader=False), daemon=True).start()

    run_detection(lab_id)
