import json
import os
import platform

import cv2


def get_linux_camera_name(index):
    path = f"/sys/class/video4linux/video{index}/name"
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return f.read().strip()
        except OSError:
            return None
    return None


def probe_camera(index):
    if platform.system() == "Windows":
        cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
    else:
        cap = cv2.VideoCapture(index)

    if not cap.isOpened():
        cap.release()
        return None

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()

    label = get_linux_camera_name(index) if platform.system() == "Linux" else None
    if not label:
        label = f"Camera {index}"

    return {
        "index": index,
        "label": label,
        "width": width,
        "height": height
    }


def pick_preferred_index(cameras):
    if not cameras:
        return None

    def score(camera):
        label = camera.get("label", "").lower()
        value = 0

        # Prefer external USB cameras (Logitech first when available)
        if "logitech" in label:
            value += 100
        if "usb" in label or "external" in label or "webcam" in label:
            value += 50
        if "integrated" in label or "front" in label:
            value -= 25

        return value

    best = max(cameras, key=score)
    if score(best) > 0:
        return best["index"]

    # If labels don't help and multiple cameras exist, prefer non-zero index.
    non_zero = [cam for cam in cameras if cam["index"] != 0]
    if non_zero:
        return non_zero[0]["index"]

    return cameras[0]["index"]


def main():
    cameras = []
    for i in range(10):
        cam = probe_camera(i)
        if cam is not None:
            cameras.append(cam)

    preferred_index = pick_preferred_index(cameras)

    print(json.dumps({
        "cameras": cameras,
        "preferred_index": preferred_index
    }))


if __name__ == "__main__":
    main()
