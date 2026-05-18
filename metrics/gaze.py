"""Head stability metric based on calibrated Face Mesh nose movement."""

import math

from metrics.calibration import RollingCalibration
from metrics.normalization import clamp_score, normalize_range
from metrics.smoothing import ExponentialSmoother


class HeadStability:
    """Estimate head stability on a calibrated, smoothed 0-100 scale."""

    NOSE_TIP_INDEX = 1

    def __init__(self, calibration=None, active_motion_range=0.025, smoothing_alpha=0.2):
        self.previous_position = None
        self.calibration = calibration or RollingCalibration()
        self.active_motion_range = active_motion_range
        self.smoother = ExponentialSmoother(alpha=smoothing_alpha, initial_value=100.0)
        self.raw_score = 100.0

    def update(self, face_landmarks):
        """Update the score using the first detected face mesh."""
        if not face_landmarks:
            self.previous_position = None
            return self.smoother.update(0.0)

        nose_tip = face_landmarks[0].landmark[self.NOSE_TIP_INDEX]
        current_position = (nose_tip.x, nose_tip.y)
        if self.previous_position is None:
            self.previous_position = current_position
            self.calibration.add("head_motion", 0.0)
            return self.smoother.update(100.0)

        raw_motion = math.dist(current_position, self.previous_position)
        self.previous_position = current_position
        self.calibration.add("head_motion", raw_motion)
        baseline = self.calibration.baseline("head_motion", 0.001)
        instability = normalize_range(raw_motion, baseline, baseline + self.active_motion_range)
        self.raw_score = 100.0 - instability
        return self.score

    @property
    def score(self):
        """Return the temporally smoothed head stability score."""
        return clamp_score(self.smoother.update(self.raw_score))

    def reset(self):
        """Reset smoothing and frame-to-frame state for recalibration."""
        self.previous_position = None
        self.raw_score = 100.0
        self.smoother.reset(initial_value=100.0)
