"""HTTP-powered behavior analysis dashboard."""

import atexit
import json
import mimetypes
import threading
import time
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import cv2

from detectors.face_detector import FaceDetector
from detectors.pose_detector import PoseDetector
from metrics.gaze import HeadStability
from metrics.movement import MovementActivity
from metrics.posture import PostureOpenness
from reports.generator import generate_session_summary


class BehaviorCamera:
    """Own webcam capture, detection, metrics, history, and event state."""

    def __init__(self, camera_index=0, history_seconds=30):
        self.camera_index = camera_index
        self.history_seconds = history_seconds
        self.lock = threading.Lock()
        self.capture_lock = threading.Lock()
        self.capture = None
        self.pose_detector = None
        self.face_detector = None
        self.movement_activity = MovementActivity()
        self.posture_openness = PostureOpenness()
        self.head_stability = HeadStability()
        self.started_at = time.time()
        self.previous_time = time.perf_counter()
        self.frame_count = 0
        self.metric_totals = {"movement": 0.0, "posture": 0.0, "head": 0.0}
        self.current_metrics = {
            "movement": 0.0,
            "posture": 0.0,
            "head": 0.0,
            "confidence": 0.0,
            "fps": 0.0,
        }
        self.history = deque(maxlen=history_seconds * 4)
        self.events = deque(maxlen=12)
        self.last_event_times = {}

    def open(self):
        """Open camera and MediaPipe resources lazily."""
        if self.capture is None:
            self.capture = cv2.VideoCapture(self.camera_index)
        if self.pose_detector is None:
            self.pose_detector = PoseDetector()
        if self.face_detector is None:
            self.face_detector = FaceDetector()

    def close(self):
        """Release camera and MediaPipe resources."""
        if self.capture is not None:
            self.capture.release()
            self.capture = None
        if self.pose_detector is not None:
            self.pose_detector.close()
            self.pose_detector = None
        if self.face_detector is not None:
            self.face_detector.close()
            self.face_detector = None

    def read_encoded_frame(self):
        """Read, analyze, annotate, and JPEG-encode one camera frame."""
        with self.capture_lock:
            self.open()
            success, frame = self.capture.read()
            if not success:
                return None

            pose_results = self.pose_detector.process(frame)
            face_results = self.face_detector.process(frame)
            movement_score = self.movement_activity.update(pose_results.pose_landmarks)
            posture_score = self.posture_openness.update(pose_results.pose_landmarks)
            head_score = self.head_stability.update(face_results.multi_face_landmarks)
            confidence_score = self._calculate_confidence(pose_results, face_results)
            fps = self._calculate_fps()

            annotated_frame = self.pose_detector.draw(frame, pose_results)
            annotated_frame = self.face_detector.draw(annotated_frame, face_results)
            self._draw_feed_label(annotated_frame, confidence_score)

            metrics = {
                "movement": movement_score,
                "posture": posture_score,
                "head": head_score,
                "confidence": confidence_score,
                "fps": fps,
            }
            self._record_metrics(metrics)

            encoded, buffer = cv2.imencode(".jpg", annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 82])
            if not encoded:
                return None
            return buffer.tobytes()

    def snapshot(self):
        """Return the latest metrics, timeline history, events, and session summary."""
        with self.lock:
            return {
                "metrics": dict(self.current_metrics),
                "history": list(self.history),
                "events": list(self.events),
                "summary": self._summary_locked(),
                "duration": round(time.time() - self.started_at, 1),
            }

    def _calculate_fps(self):
        current_time = time.perf_counter()
        elapsed = current_time - self.previous_time
        self.previous_time = current_time
        if elapsed <= 0:
            return 0.0
        return 1.0 / elapsed

    def _calculate_confidence(self, pose_results, face_results):
        pose_confidence = 55.0 if pose_results.pose_landmarks else 0.0
        face_confidence = 45.0 if face_results.multi_face_landmarks else 0.0
        return pose_confidence + face_confidence

    def _record_metrics(self, metrics):
        timestamp = time.time()
        sample = {
            "time": round(timestamp - self.started_at, 1),
            "movement": round(metrics["movement"], 1),
            "posture": round(metrics["posture"], 1),
            "head": round(metrics["head"], 1),
            "confidence": round(metrics["confidence"], 1),
        }

        with self.lock:
            self.current_metrics = {name: round(value, 1) for name, value in metrics.items()}
            self.history.append(sample)
            self.frame_count += 1
            for key in self.metric_totals:
                self.metric_totals[key] += metrics[key]
            self._record_observations_locked(metrics, timestamp)

    def _record_observations_locked(self, metrics, timestamp):
        if metrics["movement"] >= 65:
            self._append_event_locked("Increased upper-body movement detected", "movement", timestamp)
        if metrics["head"] <= 45:
            self._append_event_locked("Reduced head stability observed", "head", timestamp)
        if metrics["posture"] <= 35 and metrics["confidence"] >= 55:
            self._append_event_locked("Rather closed shoulder posture observed", "posture", timestamp)
        if metrics["confidence"] < 55:
            self._append_event_locked("Partial landmark visibility detected", "confidence", timestamp)

    def _append_event_locked(self, message, event_type, timestamp):
        last_timestamp = self.last_event_times.get(event_type, 0.0)
        if timestamp - last_timestamp < 5.0:
            return
        self.last_event_times[event_type] = timestamp
        self.events.appendleft(
            {
                "time": time.strftime("%H:%M:%S", time.localtime(timestamp)),
                "message": message,
                "type": event_type,
            }
        )

    def _summary_locked(self):
        if self.frame_count == 0:
            return "Session Summary\n----------------\n\nWaiting for live camera metrics."
        averages = {name: total / self.frame_count for name, total in self.metric_totals.items()}
        return generate_session_summary(averages["movement"], averages["posture"], averages["head"])

    def _draw_feed_label(self, frame, confidence_score):
        label = f"Live analysis | confidence {confidence_score:.0f}/100"
        cv2.rectangle(frame, (16, 16), (430, 58), (8, 12, 24), thickness=-1)
        cv2.putText(
            frame,
            label,
            (28, 44),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.72,
            (230, 245, 255),
            2,
            cv2.LINE_AA,
        )


class DashboardRequestHandler(BaseHTTPRequestHandler):
    """Serve dashboard assets, metrics JSON, and the MJPEG video stream."""

    camera = None
    web_root = Path(__file__).resolve().parent / "web"

    def do_GET(self):
        route = urlparse(self.path).path
        if route == "/":
            self._serve_static_file("index.html")
            return
        if route == "/video_feed":
            self._serve_video_feed()
            return
        if route == "/api/metrics":
            self._serve_json(self.camera.snapshot())
            return
        if route == "/api/summary":
            self._serve_json({"summary": self.camera.snapshot()["summary"]})
            return
        self._serve_static_file(route.lstrip("/"))

    def log_message(self, format, *args):
        """Keep the console focused on explicit server messages."""
        return

    def _serve_static_file(self, relative_path):
        target = (self.web_root / relative_path).resolve()
        if not target.is_file() or self.web_root not in target.parents:
            self.send_error(404, "File not found")
            return

        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        content = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def _serve_json(self, payload):
        content = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def _serve_video_feed(self):
        self.send_response(200)
        self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

        while True:
            frame = self.camera.read_encoded_frame()
            if frame is None:
                time.sleep(0.2)
                continue
            try:
                self.wfile.write(b"--frame\r\n")
                self.wfile.write(b"Content-Type: image/jpeg\r\n")
                self.wfile.write(f"Content-Length: {len(frame)}\r\n\r\n".encode("ascii"))
                self.wfile.write(frame)
                self.wfile.write(b"\r\n")
            except (BrokenPipeError, ConnectionResetError):
                break


def create_server(host="127.0.0.1", port=8000):
    """Create the local threaded dashboard server."""
    camera = BehaviorCamera()
    DashboardRequestHandler.camera = camera
    atexit.register(camera.close)
    return ThreadingHTTPServer((host, port), DashboardRequestHandler)
