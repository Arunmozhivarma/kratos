import json
import os
import platform

import cv2

try:
    # Reduce noisy OpenCV backend warnings in stdout/stderr.
    if hasattr(cv2, "utils") and hasattr(cv2.utils, "logging"):
        cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_ERROR)
    elif hasattr(cv2, "setLogLevel"):
        cv2.setLogLevel(2)  # ERROR
except Exception:
    pass

WINDOWS_BACKENDS = [
    ("dshow", cv2.CAP_DSHOW),
]


def get_linux_camera_name(index):
    path = f"/sys/class/video4linux/video{index}/name"
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return f.read().strip()
        except OSError:
            return None
    return None


def _try_open(index, backend):
    if backend is None:
        cap = cv2.VideoCapture(index)
    else:
        cap = cv2.VideoCapture(index, backend)

    if not cap.isOpened():
        cap.release()
        return None

    # Some Windows drivers need one read before reporting sane properties.
    cap.read()
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()
    return width, height


def probe_camera(index):
    if platform.system() == "Windows":
        for backend_name, backend in WINDOWS_BACKENDS:
            opened = _try_open(index, backend)
            if opened is None:
                continue

            width, height = opened
            return {
                "index": index,
                "label": f"Camera {index} ({backend_name})",
                "width": width,
                "height": height
            }
        return None

    opened = _try_open(index, None)
    if opened is None:
        return None

    width, height = opened
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
    max_probe = 20 if platform.system() == "Windows" else 10
    consecutive_failures = 0
    for i in range(max_probe):
        cam = probe_camera(i)
        if cam is not None:
            cameras.append(cam)
            consecutive_failures = 0
        else:
            consecutive_failures += 1
            if consecutive_failures >= 3:
                break

    preferred_index = pick_preferred_index(cameras)

    print(json.dumps({
        "cameras": cameras,
        "preferred_index": preferred_index
    }))


if __name__ == "__main__":
    main()
