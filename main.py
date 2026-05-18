"""Realtime webcam prototype for observable behavior metrics."""

import time

import cv2

from detectors.face_detector import FaceDetector
from detectors.pose_detector import PoseDetector
from metrics.gaze import HeadStability
from metrics.movement import MovementActivity
from metrics.posture import PostureOpenness
from reports.generator import generate_session_summary
from utils.drawing import draw_overlay


WINDOW_NAME = "Behavior Prototype"


def main():
    """Run the V0 webcam prototype until the user presses q."""
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Unable to open webcam index 0.")

    pose_detector = PoseDetector()
    face_detector = FaceDetector()
    movement_activity = MovementActivity()
    posture_openness = PostureOpenness()
    head_stability = HeadStability()

    previous_time = time.perf_counter()
    metric_totals = {"movement": 0.0, "posture": 0.0, "head": 0.0}
    frame_count = 0

    try:
        while True:
            success, frame = cap.read()
            if not success:
                break

            pose_results = pose_detector.process(frame)
            face_results = face_detector.process(frame)

            movement_score = movement_activity.update(pose_results.pose_landmarks)
            posture_score = posture_openness.update(pose_results.pose_landmarks)
            head_score = head_stability.update(face_results.multi_face_landmarks)

            current_time = time.perf_counter()
            elapsed = current_time - previous_time
            fps = 1.0 / elapsed if elapsed > 0 else 0.0
            previous_time = current_time

            frame = pose_detector.draw(frame, pose_results)
            frame = face_detector.draw(frame, face_results)
            frame = draw_overlay(
                frame,
                {"movement": movement_score, "posture": posture_score, "head": head_score},
                fps,
            )

            cv2.imshow(WINDOW_NAME, frame)
            metric_totals["movement"] += movement_score
            metric_totals["posture"] += posture_score
            metric_totals["head"] += head_score
            frame_count += 1

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        cap.release()
        pose_detector.close()
        face_detector.close()
        cv2.destroyAllWindows()

    if frame_count:
        averages = {name: total / frame_count for name, total in metric_totals.items()}
        print(
            generate_session_summary(
                averages["movement"],
                averages["posture"],
                averages["head"],
            )
        )


if __name__ == "__main__":
    main()
