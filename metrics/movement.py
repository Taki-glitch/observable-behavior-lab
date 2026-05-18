"""Movement activity metric based on pose landmark displacement."""

import math
from collections import deque


class MovementActivity:
    """Estimate body movement on a 0-100 scale from frame-to-frame motion."""

    def __init__(self, history_size=8, sensitivity=4.0):
        self.previous_landmarks = None
        self.history = deque(maxlen=history_size)
        self.sensitivity = sensitivity

    def update(self, pose_landmarks):
        """Update the score from MediaPipe pose landmarks."""
        if not pose_landmarks:
            self.previous_landmarks = None
            self.history.append(0.0)
            return 0.0

        current = [(landmark.x, landmark.y) for landmark in pose_landmarks.landmark]
        if self.previous_landmarks is None:
            self.previous_landmarks = current
            self.history.append(0.0)
            return 0.0

        total_distance = 0.0
        compared_points = min(len(current), len(self.previous_landmarks))
        for index in range(compared_points):
            current_x, current_y = current[index]
            previous_x, previous_y = self.previous_landmarks[index]
            total_distance += math.dist((current_x, current_y), (previous_x, previous_y))

        self.previous_landmarks = current
        normalized = min(100.0, (total_distance / compared_points) * 100.0 * self.sensitivity)
        self.history.append(normalized)
        return self.score

    @property
    def score(self):
        """Return the smoothed movement activity score."""
        if not self.history:
            return 0.0
        return sum(self.history) / len(self.history)
