from ultralytics import YOLO
import cv2

# Load lightweight YOLO model
model = YOLO("yolov8n.pt")

# Open webcam (use video file path instead of 0 if needed)
cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    results = model(frame)

    for result in results:
        for box in result.boxes:
            cls = int(box.cls[0])

            # Filter only 'person'
            if model.names[cls] == "person":

                # Extract coordinates
                x1, y1, x2, y2 = map(int, box.xyxy[0])

                print(f"Person detected at: ({x1}, {y1}), ({x2}, {y2})")

                # Optional: draw bounding box
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

    cv2.imshow("Detection", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
