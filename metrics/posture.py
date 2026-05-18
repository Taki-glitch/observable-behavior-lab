"""Posture openness metric based on visible shoulder distance."""

import mediapipe as mp


class PostureOpenness:
    """Estimate shoulder openness on a 0-100 scale."""

    def __init__(self, min_shoulder_width=0.12, max_shoulder_width=0.42):
        self.pose_landmark = mp.solutions.pose.PoseLandmark
        self.min_shoulder_width = min_shoulder_width
        self.max_shoulder_width = max_shoulder_width
        self.score = 0.0

    def update(self, pose_landmarks):
        """Update the score from left and right shoulder landmarks."""
        if not pose_landmarks:
            self.score = 0.0
            return self.score

        landmarks = pose_landmarks.landmark
        left_shoulder = landmarks[self.pose_landmark.LEFT_SHOULDER]
        right_shoulder = landmarks[self.pose_landmark.RIGHT_SHOULDER]
        shoulder_width = abs(left_shoulder.x - right_shoulder.x)
        span = self.max_shoulder_width - self.min_shoulder_width
        self.score = max(0.0, min(100.0, ((shoulder_width - self.min_shoulder_width) / span) * 100.0))
        return self.score
