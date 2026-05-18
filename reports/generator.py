"""Generate descriptive session summaries from prototype metrics."""


def describe_score(score, low_label, middle_label, high_label):
    """Convert a numeric score into a conservative descriptive label."""
    if score < 34:
        return low_label
    if score < 67:
        return middle_label
    return high_label


def generate_session_summary(movement_score, posture_score, head_score):
    """Return a non-interpretive text report for a completed session."""
    movement_label = describe_score(movement_score, "Low", "Moderate", "High")
    posture_label = describe_score(posture_score, "Rather closed", "Neutral", "Rather open")
    head_label = describe_score(head_score, "Low", "Low to moderate", "Moderate to high")

    observations = []
    if movement_score >= 67:
        observations.append("Frequent upper-body motion detected.")
    elif movement_score >= 34:
        observations.append("Moderate upper-body motion detected.")
    else:
        observations.append("Limited upper-body motion detected.")

    if head_score < 67:
        observations.append("Variable head orientation observed.")
    else:
        observations.append("Head orientation appeared relatively stable.")

    return "\n".join(
        [
            "Session Summary",
            "----------------",
            "",
            f"Movement Activity: {movement_label}",
            f"Posture: {posture_label}",
            f"Head Stability: {head_label}",
            "",
            "Observations:",
            *observations,
            "",
            "Confidence: Low to moderate",
        ]
    )
