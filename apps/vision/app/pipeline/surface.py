"""Surface condition analysis (heuristic).

Real signal extraction: we look for linear print lines and scratches using a
morphological black-hat / top-hat on the gradient, which emphasizes thin
bright/dark streaks against the surrounding surface. We also measure specular
glare fraction (bright + desaturated pixels), because glare both hides defects
and is itself a capture problem.

CRITICAL limitation, surfaced in the response: a single straight-on photo cannot
reveal most surface defects. Scratches, indentations, and print lines are angle-
and light-dependent; graders tilt the card under a light. With only a flat image
we CANNOT be confident, so surface confidence here is deliberately LOW and we
recommend an angled recapture.
"""

from __future__ import annotations

import cv2
import numpy as np

from ..schemas import SurfaceResult

GLARE_VALUE_MIN = 245
GLARE_SAT_MAX = 30
# Scratch density above this (fraction of pixels flagged as linear defects) is
# notable but still low-confidence from a flat image.
SCRATCH_NOTABLE = 0.02


def analyze_surface(rectified_bgr: np.ndarray, has_angled_capture: bool = False) -> SurfaceResult:
    """Estimate surface condition; confidence is low without angled captures."""
    gray = cv2.cvtColor(rectified_bgr, cv2.COLOR_BGR2GRAY)
    total = float(gray.size)

    # Emphasize thin linear structures with a top-hat using a line-ish kernel.
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 1))
    tophat = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, kernel)
    kernel_v = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 9))
    tophat_v = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, kernel_v)
    combined = cv2.max(tophat, tophat_v)
    _, streaks = cv2.threshold(combined, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    scratch_density = float(np.count_nonzero(streaks)) / total

    hsv = cv2.cvtColor(rectified_bgr, cv2.COLOR_BGR2HSV)
    glare_mask = (hsv[:, :, 2] >= GLARE_VALUE_MIN) & (hsv[:, :, 1] <= GLARE_SAT_MAX)
    glare_fraction = float(np.count_nonzero(glare_mask)) / total

    # Score: penalize scratch density and glare. Kept gentle because signal is weak.
    score = 100.0 - min(40.0, scratch_density * 800.0) - min(30.0, glare_fraction * 600.0)
    score = float(max(0.0, score))

    findings: list[str] = []
    if scratch_density > SCRATCH_NOTABLE:
        findings.append(
            "Possible linear surface marks detected; confirm by tilting the card under light."
        )
    if glare_fraction > 0.02:
        findings.append("Glare is covering part of the surface and may hide defects.")

    # Confidence is intentionally low from a flat image; a bit higher if the
    # caller supplied an angled capture.
    confidence = 0.45 if has_angled_capture else 0.25

    return SurfaceResult(
        scratch_density=round(scratch_density, 5),
        glare_fraction=round(glare_fraction, 4),
        score=round(score, 1),
        confidence=confidence,
        findings=findings,
        note=(
            "Surface analysis from a flat image is unreliable: most scratches and print lines "
            "only appear under angled light or video. Treat this as a weak indicator and submit "
            "angled captures for a better read."
        ),
    )
