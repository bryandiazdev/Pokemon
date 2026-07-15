"""Perspective rectification.

Real algorithm: given the 4 ordered card corners, compute a perspective
transform to a canonical portrait card and warp. Pokemon cards are 2.5" x 3.5",
so we target a 500 x 700 canvas (same 5:7 ratio) by default.
"""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

# Canonical output size. 5:7 matches a real 2.5" x 3.5" trading card.
CANONICAL_WIDTH = 500
CANONICAL_HEIGHT = 700


@dataclass
class RectifyOutput:
    image: np.ndarray
    width: int
    height: int
    aspect_ratio: float


def rectify_card(
    image_bgr: np.ndarray,
    corners: np.ndarray,
    out_width: int = CANONICAL_WIDTH,
    out_height: int = CANONICAL_HEIGHT,
) -> RectifyOutput:
    """Warp the quad defined by `corners` (TL, TR, BR, BL) to a canonical card."""
    src = corners.astype(np.float32)
    dst = np.array(
        [
            [0, 0],
            [out_width - 1, 0],
            [out_width - 1, out_height - 1],
            [0, out_height - 1],
        ],
        dtype=np.float32,
    )
    matrix = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(image_bgr, matrix, (out_width, out_height))
    return RectifyOutput(
        image=warped,
        width=out_width,
        height=out_height,
        aspect_ratio=round(out_width / out_height, 4),
    )


def annotate_corners(image_bgr: np.ndarray, corners: np.ndarray) -> np.ndarray:
    """Return a copy of the image with the detected quad drawn on it."""
    annotated = image_bgr.copy()
    pts = corners.astype(np.int32).reshape(-1, 1, 2)
    cv2.polylines(annotated, [pts], isClosed=True, color=(0, 255, 0), thickness=3)
    labels = ["TL", "TR", "BR", "BL"]
    for (x, y), label in zip(corners.astype(int), labels, strict=False):
        cv2.circle(annotated, (int(x), int(y)), 6, (0, 0, 255), -1)
        cv2.putText(
            annotated, label, (int(x) + 8, int(y) + 8),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2
        )
    return annotated
