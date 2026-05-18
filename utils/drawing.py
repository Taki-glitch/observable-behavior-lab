"""Drawing helpers for the realtime OpenCV overlay."""

import cv2


OVERLAY_COLOR = (20, 20, 20)
TEXT_COLOR = (245, 245, 245)
ACCENT_COLOR = (80, 220, 120)


def draw_overlay(frame, metrics, fps):
    """Draw FPS and prototype scores onto the frame."""
    rows = [
        f"FPS: {fps:.1f}",
        f"Posture openness: {metrics['posture']:.0f}",
        f"Movement activity: {metrics['movement']:.0f}",
        f"Head stability: {metrics['head']:.0f}",
        "Press q to quit",
    ]
    panel_height = 30 + len(rows) * 28
    cv2.rectangle(frame, (12, 12), (330, panel_height), OVERLAY_COLOR, thickness=-1)
    cv2.rectangle(frame, (12, 12), (330, panel_height), ACCENT_COLOR, thickness=2)

    y_position = 42
    for row in rows:
        cv2.putText(
            frame,
            row,
            (24, y_position),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            TEXT_COLOR,
            2,
            cv2.LINE_AA,
        )
        y_position += 28
    return frame
