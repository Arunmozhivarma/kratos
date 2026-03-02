import cv2
import json
import platform

zones = {}
drawing = False
start_point = None
current_fan_id = ""
typing_mode = False

def mouse_callback(event, x, y, flags, param):
    global drawing, start_point, zones, current_fan_id, typing_mode

    if typing_mode:
        return  # Disable drawing while typing

    if event == cv2.EVENT_LBUTTONDOWN:
        drawing = True
        start_point = (x, y)

    elif event == cv2.EVENT_LBUTTONUP and drawing:
        drawing = False
        end_point = (x, y)

        if current_fan_id:
            zones[current_fan_id] = [list(start_point), list(end_point)]
            print(f"Zone saved for {current_fan_id}")
            current_fan_id = ""  # Reset after saving
        else:
            print("No Fan ID set. Press 'n' first.")


if platform.system() == "Windows":
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
else:
    cap = cv2.VideoCapture(0)

cv2.namedWindow("Zone Config")
cv2.setMouseCallback("Zone Config", mouse_callback)

print("Press 'n' to enter Fan ID")
print("Press 's' to save zones")
print("Press 'q' to quit")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    temp = frame.copy()

    # Draw existing zones
    for fan_id, zone in zones.items():
        (x1, y1), (x2, y2) = zone
        cv2.rectangle(temp, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(temp, fan_id, (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

    # Show typing overlay
    if typing_mode:
        cv2.putText(temp, f"Enter Fan ID: {current_fan_id}",
                    (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8,
                    (0, 0, 255), 2)

    cv2.imshow("Zone Config", temp)

    key = cv2.waitKey(1) & 0xFF

    if key == ord('n'):
        typing_mode = True
        current_fan_id = ""

    elif typing_mode:
        if key == 13:  # Enter key
            typing_mode = False
            print(f"Fan ID set to: {current_fan_id}")
        elif key == 8:  # Backspace
            current_fan_id = current_fan_id[:-1]
        elif 32 <= key <= 126:  # Printable characters
            current_fan_id += chr(key)

    elif key == ord('s'):
        with open("zones.json", "w") as f:
            json.dump(zones, f, indent=4)
        print("Zones saved to zones.json")
        break

    elif key == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
