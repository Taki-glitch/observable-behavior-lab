"""Generate explainable, descriptive session summaries from normalized metrics."""

from observations.engine import cautious_hypotheses


def describe_score(score, low_label, middle_label, high_label):
    """Convert a numeric score into a conservative descriptive label."""
    if score < 34:
        return low_label
    if score < 67:
        return middle_label
    return high_label


def generate_observation_lines(movement_score, posture_score, head_score):
    """Build cautious descriptive observations without emotion detection."""
    observations = []
    if movement_score >= 67:
        observations.append("High upper-body movement observed.")
    elif movement_score >= 34:
        observations.append("Moderate upper-body movement observed.")
    else:
        observations.append("Limited upper-body movement observed.")

    if head_score < 45:
        observations.append("Frequent head orientation changes detected.")
    elif head_score < 67:
        observations.append("Some head orientation variability observed.")
    else:
        observations.append("Head orientation appeared relatively stable.")

    if posture_score < 35:
        observations.append("Posture appears relatively contracted.")
    elif posture_score > 67:
        observations.append("Posture appears relatively open.")
    else:
        observations.append("Posture appears near the calibrated baseline.")
    return observations


def generate_session_summary(movement_score, posture_score, head_score, include_hypotheses=False):
    """Return a non-interpretive text report for a completed session."""
    movement_label = describe_score(movement_score, "Low", "Moderate", "High")
    posture_label = describe_score(posture_score, "Rather closed", "Neutral", "Rather open")
    head_label = describe_score(head_score, "Low", "Low to moderate", "Moderate to high")
    observations = generate_observation_lines(movement_score, posture_score, head_score)

    lines = [
        "Session Summary",
        "----------------",
        "",
        f"Movement Activity: {movement_label} ({movement_score:.1f}/100)",
        f"Posture: {posture_label} ({posture_score:.1f}/100)",
        f"Head Stability: {head_label} ({head_score:.1f}/100)",
        "",
        "Observations:",
        *observations,
    ]

    if include_hypotheses:
        hypotheses = cautious_hypotheses(
            {"movement": movement_score, "posture": posture_score, "head": head_score}
        )
        lines.extend(
            [
                "",
                "Cautious hypotheses:",
                *(f"- May be compatible with {hypothesis}." for hypothesis in hypotheses),
                "Confidence: low",
            ]
        )
    else:
        lines.extend(["", "Confidence: Low to moderate"])

    return "\n".join(lines)
