"""Movement activity metric based on calibrated pose landmark displacement."""

import math

from metrics.calibration import RollingCalibration
from metrics.normalization import clamp_score, normalize_range
from metrics.smoothing import ExponentialSmoother


class MovementActivity:
    """Estimate body movement on a calibrated, smoothed 0-100 scale."""

    def __init__(self, calibration=None, active_motion_range=0.035, smoothing_alpha=0.2):
        self.previous_landmarks = None
        self.calibration = calibration or RollingCalibration()
        self.active_motion_range = active_motion_range
        self.smoother = ExponentialSmoother(alpha=smoothing_alpha)
        self.raw_score = 0.0

    def update(self, pose_landmarks):
        """Update the score from MediaPipe pose landmarks."""
        if not pose_landmarks:
            self.previous_landmarks = None
            return self.smoother.update(0.0)

        current = [(landmark.x, landmark.y) for landmark in pose_landmarks.landmark]
        if self.previous_landmarks is None:
            self.previous_landmarks = current
            self.calibration.add("movement", 0.0)
            return self.smoother.update(0.0)

        total_distance = 0.0
        compared_points = min(len(current), len(self.previous_landmarks))
        for index in range(compared_points):
            current_x, current_y = current[index]
            previous_x, previous_y = self.previous_landmarks[index]
            total_distance += math.dist((current_x, current_y), (previous_x, previous_y))

        raw_motion = total_distance / compared_points
        self.previous_landmarks = current
        self.calibration.add("movement", raw_motion)
        noise_floor = self.calibration.baseline("movement", 0.002)
        self.raw_score = normalize_range(raw_motion, noise_floor, noise_floor + self.active_motion_range)
        return self.score

    @property
    def score(self):
        """Return the temporally smoothed movement activity score."""
        return clamp_score(self.smoother.update(self.raw_score))

    def reset(self):
        """Reset smoothing and frame-to-frame state for recalibration."""
        self.previous_landmarks = None
        self.raw_score = 0.0
        self.smoother.reset()
