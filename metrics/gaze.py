"""Head stability metric based on Face Mesh nose movement."""

import math
from collections import deque


class HeadStability:
    """Estimate head stability on a 0-100 scale from nose landmark movement."""

    NOSE_TIP_INDEX = 1

    def __init__(self, history_size=12, sensitivity=7.5):
        self.previous_position = None
        self.movement_history = deque(maxlen=history_size)
        self.sensitivity = sensitivity

    def update(self, face_landmarks):
        """Update the score using the first detected face mesh."""
        if not face_landmarks:
            self.previous_position = None
            self.movement_history.append(1.0)
            return self.score

        nose_tip = face_landmarks[0].landmark[self.NOSE_TIP_INDEX]
        current_position = (nose_tip.x, nose_tip.y)
        if self.previous_position is None:
            self.previous_position = current_position
            self.movement_history.append(0.0)
            return self.score

        movement = math.dist(current_position, self.previous_position)
        self.previous_position = current_position
        self.movement_history.append(movement)
        return self.score

    @property
    def score(self):
        """Return the smoothed head stability score."""
        if not self.movement_history:
            return 0.0
        average_movement = sum(self.movement_history) / len(self.movement_history)
        instability = min(1.0, average_movement * self.sensitivity)
        return (1.0 - instability) * 100.0
