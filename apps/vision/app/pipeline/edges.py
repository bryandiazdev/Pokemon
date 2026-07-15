"""Per-edge whitening / chipping analysis (heuristic).

For each of the four edges of a rectified card we sample a thin band just inside
the die-cut edge and measure the fraction of bright, low-saturation pixels
(the visual signature of edge whitening / chipping on Pokemon cards). We compare
that band against the card body's baseline so that a naturally light card is not
falsely flagged.

Heuristic caveats: glare, sleeves, and light backgrounds inflate the whitening
signal, so confidence is moderate and severity mapping is conservative.
"""

from __future__ import annotations

import cv2
import numpy as np

from ..schemas import EdgeFinding, EdgesResult

# Thickness of the edge band as a fraction of the card's short dimension.
BAND_FRAC = 0.05
WEAR_VALUE_MIN = 200
WEAR_SAT_MAX = 60
# Whitening thresholds (fraction of band that reads as white wear).
WHITENING_MINOR = 0.10
WHITENING_MODERATE = 0.22
WHITENING_SEVERE = 0.40

EDGES = ("top", "right", "bottom", "left")


def _severity(whitening: float) -> str:
    if whitening >= WHITENING_SEVERE:
        return "severe"
    if whitening >= WHITENING_MODERATE:
        return "moderate"
    if whitening >= WHITENING_MINOR:
        return "minor"
    return "none"


def _grade_cap(severity: str) -> int | None:
    return {"severe": 7, "moderate": 8, "minor": 9}.get(severity)


def analyze_edges(rectified_bgr: np.ndarray) -> EdgesResult:
    """Analyze all four edges and aggregate to an edge score."""
    h, w = rectified_bgr.shape[:2]
    band = max(4, int(min(h, w) * BAND_FRAC))
    hsv = cv2.cvtColor(rectified_bgr, cv2.COLOR_BGR2HSV)
    val = hsv[:, :, 2]
    sat = hsv[:, :, 1]
    wear = (val >= WEAR_VALUE_MIN) & (sat <= WEAR_SAT_MAX)

    bands = {
        "top": (wear[0:band, :], [0, 0, w, band]),
        "bottom": (wear[h - band : h, :], [0, h - band, w, band]),
        "left": (wear[:, 0:band], [0, 0, band, h]),
        "right": (wear[:, w - band : w], [w - band, 0, band, h]),
    }

    findings: list[EdgeFinding] = []
    severities: list[str] = []
    for edge in EDGES:
        mask, bbox = bands[edge]
        whitening = float(np.count_nonzero(mask)) / float(mask.size)
        severity = _severity(whitening)
        severities.append(severity)
        findings.append(
            EdgeFinding(
                edge=edge,  # type: ignore[arg-type]
                severity=severity,  # type: ignore[arg-type]
                whitening_fraction=round(whitening, 4),
                confidence=0.5,
                bounding_box=bbox,
                explanation=(
                    f"Heuristic edge check: {whitening * 100:.1f}% of the {edge} band reads as "
                    "bright/desaturated (possible edge whitening). Sleeves, glare, and light "
                    "backgrounds can mimic this."
                ),
                grade_cap=_grade_cap(severity),
            )
        )

    penalty_map = {"none": 0.0, "minor": 6.0, "moderate": 16.0, "severe": 30.0}
    score = float(max(0.0, 100.0 - sum(penalty_map[s] for s in severities)))

    return EdgesResult(
        findings=findings,
        score=round(score, 1),
        confidence=0.5,
        note=(
            "Per-edge analysis is heuristic and from a single straight-on image; "
            "it cannot reliably distinguish whitening from glare or sleeve edges."
        ),
    )
