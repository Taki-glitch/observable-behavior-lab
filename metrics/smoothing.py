"""Temporal smoothing primitives for realtime scores."""


class ExponentialSmoother:
    """Apply exponential moving average smoothing to reduce frame noise."""

    def __init__(self, alpha=0.2, initial_value=0.0):
        self.alpha = alpha
        self.value = initial_value
        self.initialized = False

    def update(self, raw_value):
        """Return the smoothed value using: previous * 0.8 + current * 0.2."""
        raw_value = float(raw_value)
        if not self.initialized:
            self.value = raw_value
            self.initialized = True
        else:
            self.value = ((1.0 - self.alpha) * self.value) + (self.alpha * raw_value)
        return self.value

    def reset(self, initial_value=0.0):
        """Reset the smoother for a new calibration or session."""
        self.value = initial_value
        self.initialized = False
