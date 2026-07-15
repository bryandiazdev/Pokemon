"""Orientation normalization.

Real algorithm: if the image is wider than tall, it is likely a landscape
capture of a portrait card, so we rotate it 90 degrees to portrait.

Front/back heuristic (honest about limits): the back of a modern Pokemon card is
a large, fairly uniform blue field with a central Poke Ball, so the back tends to
have a strong blue channel dominance and lower overall color variance than a
front (which has varied artwork). We use channel means + variance as a weak
signal only, and always report modest confidence. This is NOT a reliable
front/back classifier and must not be treated as one.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import cv2
import numpy as np


@dataclass
class OrientationOutput:
    orientation: Literal["portrait", "landscape", "unknown"]
    rotated_degrees: int
    likely_side: Literal["front", "back", "unknown"]
    confidence: float
    image: np.ndarray
    note: str | None = None


def normalize_orientation(image_bgr: np.ndarray) -> OrientationOutput:
    """Rotate to portrait if needed and give a weak front/back guess."""
    h, w = image_bgr.shape[:2]
    rotated_degrees = 0
    out = image_bgr

    if w > h:
        out = cv2.rotate(image_bgr, cv2.ROTATE_90_CLOCKWISE)
        rotated_degrees = 90
        orientation: Literal["portrait", "landscape", "unknown"] = "portrait"
    elif h >= w:
        orientation = "portrait"
    else:  # pragma: no cover - defensive
        orientation = "unknown"

    # Weak front/back heuristic on the (portrait) image.
    b, g, r = (float(c.mean()) for c in cv2.split(out))
    total = b + g + r + 1e-6
    blue_dominance = b / total
    color_var = float(np.var(cv2.cvtColor(out, cv2.COLOR_BGR2HSV)[:, :, 0]))

    # Card backs skew blue and low-hue-variance. Thresholds are deliberately
    # loose; confidence stays low because this is unreliable.
    if blue_dominance > 0.40 and color_var < 900:
        likely_side: Literal["front", "back", "unknown"] = "back"
        confidence = 0.35
    else:
        likely_side = "front"
        confidence = 0.30

    return OrientationOutput(
        orientation=orientation,
        rotated_degrees=rotated_degrees,
        likely_side=likely_side,
        confidence=confidence,
        image=out,
        note="Front/back detection is a weak heuristic and not authoritative.",
    )
