"""Structural analysis (heuristic, neutral language).

We compute:
  * Dimensional ratio of the detected card vs the expected 2.5:3.5 (= 5/7) and
    flag a "possible dimensional irregularity" if it deviates notably. This can
    be caused by trimming, but ALSO by perspective, detection error, or a
    non-standard card, so we describe it neutrally and never accuse.
  * Contour convexity (solidity = contour area / convex-hull area). A low value
    can indicate a bend or warp in the card outline.

We deliberately use neutral wording ("possible dimensional irregularity",
"may indicate a bend") and never assert alteration, trimming, or fraud.
"""

from __future__ import annotations

import cv2
import numpy as np

from ..schemas import StructuralResult
from .detect import detect_card

EXPECTED_ASPECT = 2.5 / 3.5  # ~0.714 (width / height)
# Relative deviation from expected before we note a possible irregularity.
DEVIATION_NOTABLE = 0.06
# Solidity below this may indicate a bend/warp in the outline.
SOLIDITY_MIN = 0.97


def analyze_structural(image_bgr: np.ndarray) -> StructuralResult:
    """Assess dimensional ratio and outline convexity from the original image."""
    det = detect_card(image_bgr)
    findings: list[str] = []

    if not det.detected or det.corners is None:
        return StructuralResult(
            aspect_ratio=0.0,
            expected_aspect_ratio=round(EXPECTED_ASPECT, 4),
            dimensional_deviation=0.0,
            convexity=0.0,
            score=50.0,
            confidence=0.2,
            findings=["Card boundary not confidently detected; structural check skipped."],
            note="Structural analysis requires a clean card boundary.",
        )

    tl, tr, br, bl = det.corners
    width = (np.linalg.norm(tr - tl) + np.linalg.norm(br - bl)) / 2.0
    height = (np.linalg.norm(bl - tl) + np.linalg.norm(br - tr)) / 2.0
    aspect = float(width / height) if height > 0 else 0.0
    deviation = abs(aspect - EXPECTED_ASPECT) / EXPECTED_ASPECT

    # Solidity of the detected quad contour.
    contour = det.corners.astype(np.int32).reshape(-1, 1, 2)
    area = cv2.contourArea(contour)
    hull = cv2.convexHull(contour)
    hull_area = cv2.contourArea(hull)
    solidity = float(area / hull_area) if hull_area > 0 else 1.0

    score = 100.0
    if deviation > DEVIATION_NOTABLE:
        findings.append(
            f"Possible dimensional irregularity: measured aspect ratio {aspect:.3f} deviates "
            f"{deviation * 100:.1f}% from the standard {EXPECTED_ASPECT:.3f}. This can also come "
            "from camera perspective or detection error."
        )
        score -= min(30.0, deviation * 200.0)
    if solidity < SOLIDITY_MIN:
        findings.append(
            f"Outline solidity {solidity:.3f} is below expected; the card outline may indicate a "
            "slight bend or warp, or simply imperfect detection."
        )
        score -= min(20.0, (SOLIDITY_MIN - solidity) * 200.0)

    score = float(max(0.0, score))
    # Confidence tied to detection confidence; structural read is coarse.
    confidence = float(max(0.2, min(0.6, det.confidence)))

    return StructuralResult(
        aspect_ratio=round(aspect, 4),
        expected_aspect_ratio=round(EXPECTED_ASPECT, 4),
        dimensional_deviation=round(deviation, 4),
        convexity=round(solidity, 4),
        score=round(score, 1),
        confidence=round(confidence, 3),
        findings=findings,
        note=(
            "Structural checks are neutral geometric observations, not determinations of "
            "authenticity or alteration."
        ),
    )
