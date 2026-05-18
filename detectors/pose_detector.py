"""Pose detection wrapper built on top of MediaPipe Pose."""

import cv2
import mediapipe as mp


class PoseDetector:
    """Process webcam frames and draw body pose landmarks."""

    def __init__(self, min_detection_confidence=0.5, min_tracking_confidence=0.5):
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            min_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )
        self.drawer = mp.solutions.drawing_utils

    def process(self, frame):
        """Return MediaPipe pose results for a BGR frame."""
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        results = self.pose.process(rgb)
        rgb.flags.writeable = True
        return results

    def draw(self, frame, results):
        """Draw the body skeleton on the frame when pose landmarks exist."""
        if results.pose_landmarks:
            self.drawer.draw_landmarks(
                frame,
                results.pose_landmarks,
                self.mp_pose.POSE_CONNECTIONS,
            )
        return frame

    def close(self):
        """Release MediaPipe resources."""
        self.pose.close()
