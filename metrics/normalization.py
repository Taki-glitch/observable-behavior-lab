"""Shared normalization helpers for bounded behavior metrics."""


def clamp_score(value):
    """Clamp a metric value to the public 0-100 score range."""
    return max(0.0, min(100.0, float(value)))


def normalize_range(value, minimum, maximum):
    """Normalize a value from a calibrated range into a 0-100 score."""
    if maximum <= minimum:
        return 0.0
    return clamp_score(((value - minimum) / (maximum - minimum)) * 100.0)


def normalize_centered(value, center, half_range):
    """Normalize around a personal baseline where the baseline maps to 50."""
    if half_range <= 0:
        return 50.0
    return clamp_score(50.0 + ((value - center) / half_range) * 50.0)
