"""Posture openness metric based on calibrated visible shoulder distance."""

import mediapipe as mp

from metrics.calibration import RollingCalibration
from metrics.normalization import clamp_score, normalize_centered
from metrics.smoothing import ExponentialSmoother


class PostureOpenness:
    """Estimate shoulder openness on a personal-baseline 0-100 scale."""

    def __init__(self, calibration=None, relative_half_range=0.35, smoothing_alpha=0.2):
        self.pose_landmark = mp.solutions.pose.PoseLandmark
        self.calibration = calibration or RollingCalibration()
        self.relative_half_range = relative_half_range
        self.smoother = ExponentialSmoother(alpha=smoothing_alpha, initial_value=50.0)
        self.raw_score = 50.0

    def update(self, pose_landmarks):
        """Update the score from left and right shoulder landmarks."""
        if not pose_landmarks:
            return self.smoother.update(0.0)

        landmarks = pose_landmarks.landmark
        left_shoulder = landmarks[self.pose_landmark.LEFT_SHOULDER]
        right_shoulder = landmarks[self.pose_landmark.RIGHT_SHOULDER]
        shoulder_width = abs(left_shoulder.x - right_shoulder.x)
        self.calibration.add("shoulder_width", shoulder_width)
        baseline = self.calibration.baseline("shoulder_width", shoulder_width or 0.24)
        half_range = max(0.04, baseline * self.relative_half_range)
        self.raw_score = normalize_centered(shoulder_width, baseline, half_range)
        return self.score

    @property
    def score(self):
        """Return the temporally smoothed posture openness score."""
        return clamp_score(self.smoother.update(self.raw_score))

    def reset(self):
        """Reset smoothing for recalibration."""
        self.raw_score = 50.0
        self.smoother.reset(initial_value=50.0)
