"""Per-corner condition analysis (heuristic).

For each of the four corners of a rectified card we crop a small ROI and measure:
  * Whitening: fraction of bright, low-saturation pixels in the corner relative
    to the card body. Corner wear on Pokemon cards shows as white fraying, so an
    elevated bright/desaturated fraction at the very tip is a wear signal.
  * Rounding: we threshold the corner ROI to isolate the card material and look
    at how "filled" the extreme corner triangle is; a rounded/worn corner leaves
    the tip empty.

This is explicitly a heuristic proxy, not a microscope. Whitening from glare or
a light background can masquerade as wear, so confidence is kept moderate and the
severity mapping is conservative.
"""

from __future__ import annotations

import cv2
import numpy as np

from ..schemas import CornerFinding, CornersResult

# Corner ROI size as a fraction of card dimensions.
ROI_FRAC = 0.14
# Whitening thresholds (fraction of ROI that is bright + desaturated).
WHITENING_MINOR = 0.12
WHITENING_MODERATE = 0.25
WHITENING_SEVERE = 0.45
# Brightness / saturation gates for "white wear" pixels.
WEAR_VALUE_MIN = 200
WEAR_SAT_MAX = 60

CORNERS = ("top_left", "top_right", "bottom_right", "bottom_left")


def _corner_roi(image: np.ndarray, corner: str, rh: int, rw: int) -> np.ndarray:
    h, w = image.shape[:2]
    if corner == "top_left":
        return image[0:rh, 0:rw]
    if corner == "top_right":
        return image[0:rh, w - rw : w]
    if corner == "bottom_right":
        return image[h - rh : h, w - rw : w]
    return image[h - rh : h, 0:rw]  # bottom_left


def _corner_bbox(corner: str, h: int, w: int, rh: int, rw: int) -> list[int]:
    if corner == "top_left":
        return [0, 0, rw, rh]
    if corner == "top_right":
        return [w - rw, 0, rw, rh]
    if corner == "bottom_right":
        return [w - rw, h - rh, rw, rh]
    return [0, h - rh, rw, rh]


def _severity(whitening: float) -> str:
    if whitening >= WHITENING_SEVERE:
        return "severe"
    if whitening >= WHITENING_MODERATE:
        return "moderate"
    if whitening >= WHITENING_MINOR:
        return "minor"
    return "none"


def _grade_cap(severity: str) -> int | None:
    # Conservative caps: a severe corner realistically caps a card well below gem.
    return {"severe": 6, "moderate": 8, "minor": 9}.get(severity)


def analyze_corners(rectified_bgr: np.ndarray) -> CornersResult:
    """Analyze all four corners and aggregate to a corner score."""
    h, w = rectified_bgr.shape[:2]
    rh = max(8, int(h * ROI_FRAC))
    rw = max(8, int(w * ROI_FRAC))

    hsv = cv2.cvtColor(rectified_bgr, cv2.COLOR_BGR2HSV)

    findings: list[CornerFinding] = []
    severities: list[str] = []

    for corner in CORNERS:
        roi = _corner_roi(hsv, corner, rh, rw)
        val = roi[:, :, 2]
        sat = roi[:, :, 1]
        wear_mask = (val >= WEAR_VALUE_MIN) & (sat <= WEAR_SAT_MAX)
        whitening = float(np.count_nonzero(wear_mask)) / float(wear_mask.size)

        # Rounding estimate: threshold the corner tip triangle; a fuller tip
        # means a sharp corner. We measure emptiness of the extreme 1/3 tip.
        gray_roi = cv2.cvtColor(
            _corner_roi(rectified_bgr, corner, rh, rw), cv2.COLOR_BGR2GRAY
        )
        _, card_mask = cv2.threshold(gray_roi, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        tip = max(4, min(rh, rw) // 3)
        # Pick the tip sub-block nearest the physical card corner.
        if corner == "top_left":
            tip_block = card_mask[0:tip, 0:tip]
        elif corner == "top_right":
            tip_block = card_mask[0:tip, -tip:]
        elif corner == "bottom_right":
            tip_block = card_mask[-tip:, -tip:]
        else:
            tip_block = card_mask[-tip:, 0:tip]
        fill = float(np.count_nonzero(tip_block)) / float(tip_block.size)
        rounding_estimate = float(max(0.0, 1.0 - fill))

        severity = _severity(whitening)
        severities.append(severity)

        confidence = 0.5  # heuristic; corner ROIs are easily fooled by glare.
        explanation = (
            f"Heuristic corner check: {whitening * 100:.1f}% of the corner reads as "
            f"bright/desaturated (possible whitening), rounding proxy {rounding_estimate:.2f}. "
            "Confirm under magnification; glare and background can mimic wear."
        )

        findings.append(
            CornerFinding(
                corner=corner,  # type: ignore[arg-type]
                severity=severity,  # type: ignore[arg-type]
                whitening_fraction=round(whitening, 4),
                rounding_estimate=round(rounding_estimate, 3),
                confidence=confidence,
                bounding_box=_corner_bbox(corner, h, w, rh, rw),
                explanation=explanation,
                grade_cap=_grade_cap(severity),
            )
        )

    # Aggregate score: start at 100 and subtract per-corner penalties.
    penalty_map = {"none": 0.0, "minor": 8.0, "moderate": 22.0, "severe": 40.0}
    score = 100.0 - sum(penalty_map[s] for s in severities)
    score = float(max(0.0, score))
    confidence = 0.5

    return CornersResult(
        findings=findings,
        score=round(score, 1),
        confidence=confidence,
        note=(
            "Per-corner analysis is heuristic and based on a single straight-on image. "
            "It cannot see microscopic wear a grader would catch."
        ),
    )
