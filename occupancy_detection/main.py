from ultralytics import YOLO
import cv2
import json
import platform

# Load zones
with open("zones.json", "r") as f:
    zones = json.load(f)

# Load YOLO model
model = YOLO("yolov8n.pt")

if platform.system() == "Windows":
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
else:
    cap = cv2.VideoCapture(0)

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
