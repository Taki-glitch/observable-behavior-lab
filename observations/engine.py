"""Convert numeric metrics into cautious descriptive observations."""

import time


class ObservationEngine:
    """Generate de-duplicated, non-interpretive observations from normalized metrics."""

    def __init__(self, cooldown_seconds=5.0):
        self.cooldown_seconds = cooldown_seconds
        self.last_event_times = {}

    def evaluate(self, metrics, timestamp=None):
        """Return new observation events for the latest metric snapshot."""
        timestamp = timestamp or time.time()
        rules = [
            (metrics["movement"] >= 67, "movement", "High upper-body movement observed."),
            (34 <= metrics["movement"] < 67, "movement_moderate", "Moderate upper-body movement observed."),
            (metrics["head"] <= 45, "head", "Frequent head orientation changes detected."),
            (metrics["posture"] <= 35 and metrics["confidence"] >= 55, "posture", "Posture appears relatively contracted."),
            (metrics["confidence"] < 55, "confidence", "Partial landmark visibility observed."),
        ]
        events = []
        for condition, event_type, message in rules:
            if not condition or not self._can_emit(event_type, timestamp):
                continue
            events.append(
                {
                    "time": time.strftime("%H:%M:%S", time.localtime(timestamp)),
                    "message": message,
                    "type": event_type,
                }
            )
        return events

    def reset(self):
        """Clear event cooldown state."""
        self.last_event_times.clear()

    def _can_emit(self, event_type, timestamp):
        last_timestamp = self.last_event_times.get(event_type, 0.0)
        if timestamp - last_timestamp < self.cooldown_seconds:
            return False
        self.last_event_times[event_type] = timestamp
        return True


def cautious_hypotheses(metrics):
    """Return optional low-confidence hypotheses without asserting a cause."""
    hypotheses = []
    if metrics.get("movement", 0.0) >= 67 or metrics.get("head", 100.0) <= 45:
        hypotheses.extend(["increased tension", "heightened engagement", "situational discomfort"])
    if metrics.get("posture", 100.0) <= 35:
        hypotheses.extend(["protective posture", "reduced openness", "camera framing effects"])
    return sorted(set(hypotheses))
