"""Lightweight personal calibration for normalized behavior metrics."""

from collections import deque


class RollingCalibration:
    """Collect an initial baseline and expose stable per-person reference values."""

    def __init__(self, sample_size=30):
        self.sample_size = sample_size
        self.samples = {
            "movement": deque(maxlen=sample_size),
            "shoulder_width": deque(maxlen=sample_size),
            "head_motion": deque(maxlen=sample_size),
        }

    def add(self, name, value):
        """Add a raw calibration sample for a named signal."""
        if name in self.samples:
            self.samples[name].append(float(value))

    def baseline(self, name, fallback):
        """Return the current baseline average, or fallback until enough samples exist."""
        values = self.samples.get(name)
        if not values:
            return fallback
        return sum(values) / len(values)

    def ready(self, name):
        """Return whether a signal has enough samples for a stable baseline."""
        values = self.samples.get(name)
        return bool(values and len(values) >= self.sample_size)

    def reset(self):
        """Clear all calibration samples."""
        for values in self.samples.values():
            values.clear()
