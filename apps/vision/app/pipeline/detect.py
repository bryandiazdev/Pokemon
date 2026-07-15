"""Card boundary detection.

Real algorithm: convert to grayscale, blur, run Canny edge detection, dilate to
close gaps, find external contours, and pick the largest 4-point convex polygon
that occupies a reasonable fraction of the frame. This is a classic
document/card-scanner boundary detector.

Limitations (honest): a card photographed on a busy or same-color background, or
one that bleeds off the frame edges, may not yield a clean quadrilateral. In that
case we fall back to reporting failure rather than guessing.
"""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

# A detected quad must cover at least this fraction of the frame to be accepted
# as "the card" (rejects small incidental rectangles like logos in the scene).
MIN_FRAME_COVERAGE = 0.12
# Approximation accuracy for polygon simplification, as a fraction of perimeter.
POLY_EPS_FRACTION = 0.02


@dataclass
class DetectionOutput:
    detected: bool
    corners: np.ndarray | None  # shape (4, 2), ordered TL, TR, BR, BL
    frame_coverage: float
    confidence: float
    note: str | None = None


def _order_corners(pts: np.ndarray) -> np.ndarray:
    """Order 4 points as top-left, top-right, bottom-right, bottom-left."""
    pts = pts.reshape(4, 2).astype(np.float32)
    ordered = np.zeros((4, 2), dtype=np.float32)
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1).ravel()
    ordered[0] = pts[np.argmin(s)]  # TL: smallest x+y
    ordered[2] = pts[np.argmax(s)]  # BR: largest x+y
    ordered[1] = pts[np.argmin(diff)]  # TR: smallest y-x
    ordered[3] = pts[np.argmax(diff)]  # BL: largest y-x
    return ordered


def detect_card(image_bgr: np.ndarray) -> DetectionOutput:
    """Detect the card's quadrilateral boundary in a BGR image."""
    h, w = image_bgr.shape[:2]
    frame_area = float(h * w)
    if frame_area <= 0:
        return DetectionOutput(False, None, 0.0, 0.0, "Empty image.")

    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Canny thresholds derived from the median for robustness across exposures.
    median = float(np.median(blurred))
    lower = int(max(0, 0.66 * median))
    upper = int(min(255, 1.33 * median))
    edges = cv2.Canny(blurred, lower, upper)
    # Dilate to bridge small gaps in the card border.
    kernel = np.ones((5, 5), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return DetectionOutput(False, None, 0.0, 0.0, "No contours found.")

    contours = sorted(contours, key=cv2.contourArea, reverse=True)

    best_quad: np.ndarray | None = None
    best_area = 0.0
    for cnt in contours[:10]:
        area = cv2.contourArea(cnt)
        if area / frame_area < MIN_FRAME_COVERAGE:
            continue
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, POLY_EPS_FRACTION * peri, True)
        if len(approx) == 4 and cv2.isContourConvex(approx) and area > best_area:
            best_quad = approx
            best_area = area

    # Fallback: if no clean quad, try the minimum-area rectangle of the largest
    # contour. This still yields 4 corners but is less trustworthy.
    used_fallback = False
    if best_quad is None:
        largest = contours[0]
        area = cv2.contourArea(largest)
        if area / frame_area >= MIN_FRAME_COVERAGE:
            rect = cv2.minAreaRect(largest)
            box = cv2.boxPoints(rect)
            best_quad = box.astype(np.int32).reshape(4, 1, 2)
            best_area = area
            used_fallback = True

    if best_quad is None:
        return DetectionOutput(
            False, None, best_area / frame_area, 0.0, "No card-like quadrilateral found."
        )

    corners = _order_corners(best_quad)
    coverage = best_area / frame_area
    # Confidence: scale with coverage, penalize the fallback path.
    confidence = min(1.0, coverage)
    if used_fallback:
        confidence *= 0.6
    note = "min-area-rect fallback" if used_fallback else None
    return DetectionOutput(True, corners, coverage, round(confidence, 3), note)
