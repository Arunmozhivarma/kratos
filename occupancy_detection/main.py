from ultralytics import YOLO
import cv2
import json
import requests

# Load zones
with open("zones.json", "r") as f:
    zones = json.load(f)

# Load YOLO model
model = YOLO("yolov8n.pt")

# Backend API endpoint
BACKEND_URL = "http://localhost:5000/api/devices/update"

# Track previous statuses to avoid unnecessary API calls
previous_statuses = {fan_id: False for fan_id in zones.keys()}

cap = cv2.VideoCapture(1, cv2.CAP_DSHOW)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    results = model(frame, verbose=False)

    # Track which fans are occupied this frame
    fan_status = {fan_id: False for fan_id in zones.keys()}

    for result in results:
        for box in result.boxes:
            cls = int(box.cls[0])

            if model.names[cls] == "person":
                x1, y1, x2, y2 = map(int, box.xyxy[0])

                # Draw person box
                cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)

                # Calculate center point
                cx = (x1 + x2) // 2
                cy = (y1 + y2) // 2

                # Check each fan zone
                for fan_id, zone in zones.items():
                    (zx1, zy1), (zx2, zy2) = zone

                    if zx1 <= cx <= zx2 and zy1 <= cy <= zy2:
                        fan_status[fan_id] = True
    
    # Send updates to backend only if status changed
    for fan_id, status in fan_status.items():
        if status != previous_statuses[fan_id]:
            try:
                response = requests.post(BACKEND_URL, json={"fan_id": fan_id, "status": "ON" if status else "OFF"})
                if response.status_code == 200:
                    print(f"Updated {fan_id} to {'ON' if status else 'OFF'}")
                else:
                    print(f"Failed to update {fan_id}: {response.status_code}")
            except requests.exceptions.RequestException as e:
                print(f"Error sending update for {fan_id}: {e}")
            previous_statuses[fan_id] = status

    # Draw zones and show status
    for fan_id, zone in zones.items():
        (zx1, zy1), (zx2, zy2) = zone

        color = (0, 255, 0) if fan_status[fan_id] else (0, 0, 255)
        cv2.rectangle(frame, (zx1, zy1), (zx2, zy2), color, 2)

        status_text = f"{fan_id}: ON" if fan_status[fan_id] else f"{fan_id}: OFF"
        cv2.putText(frame, status_text, (zx1, zy1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    cv2.imshow("Occupancy Detection", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
