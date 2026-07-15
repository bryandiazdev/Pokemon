"""Deterministic centering analysis on a rectified card.

Approach (real): a graded card's centering is judged by comparing the width of
the border on opposite sides of the inner frame (the printed content region).
On a rectified card we locate the inner frame by projection profiles:

  1. Convert to grayscale and compute a gradient magnitude image (Sobel).
  2. Sum gradient energy per row and per column -> projection profiles. The
     inner-frame edges appear as strong, roughly symmetric gradient peaks near
     the borders because the border/artwork transition is a high-contrast edge.
  3. Search inward from each side for the first sustained gradient peak to locate
     the inner-frame boundary on that side.
  4. Border width on each side = distance from the card edge to that boundary.

From the four border widths we compute horizontal and vertical ratios and a
centering score (50/50 -> ~100).

IMPORTANT honesty note: not all Pokemon layouts have a simple rectangular inner
border. Full-art, alt-art, and textured cards have artwork bleeding to the edge
with no crisp border transition. When the detected inner frame is weak or
asymmetric in a way that suggests no clean border, we LOWER confidence sharply so
downstream logic does not over-trust the number.
"""

from __future__ import annotations

import cv2
import numpy as np

from ..schemas import CenteringResult

# Ignore the outermost few percent when hunting for the inner edge, since the
# card's own die-cut edge also produces gradient energy.
EDGE_MARGIN_FRAC = 0.03
# A border-transition peak must reach at least this fraction of the max profile
# value to count as the inner frame.
PEAK_THRESHOLD_FRAC = 0.35
# We only search the outer portion of each side for the border transition.
SEARCH_FRAC = 0.35


def _find_inner_edge(profile: np.ndarray, length: int, from_start: bool) -> int | None:
    """Find the inner-frame edge position by scanning a 1-D gradient profile.

    Returns the index (distance from the near card edge) of the first strong,
    sustained gradient peak, or None if none is found.
    """
    margin = int(length * EDGE_MARGIN_FRAC)
    search_end = int(length * SEARCH_FRAC)
    threshold = profile.max() * PEAK_THRESHOLD_FRAC
    if threshold <= 0:
        return None

    if from_start:
        indices = range(margin, search_end)
    else:
        indices = range(length - 1 - margin, length - 1 - search_end, -1)

    for i in indices:
        if profile[i] >= threshold:
            # Return distance from the near edge.
            return i if from_start else (length - 1 - i)
    return None


def analyze_centering(rectified_bgr: np.ndarray) -> CenteringResult:
    """Estimate centering from border widths on a rectified card image."""
    h, w = rectified_bgr.shape[:2]
    gray = cv2.cvtColor(rectified_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)

    # Gradient magnitude.
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    mag = cv2.magnitude(gx, gy)

    # Column profile (vertical edges -> horizontal borders) uses gx energy.
    col_profile = np.abs(gx).sum(axis=0)
    # Row profile (horizontal edges -> vertical borders) uses gy energy.
    row_profile = np.abs(gy).sum(axis=1)

    left = _find_inner_edge(col_profile, w, from_start=True)
    right = _find_inner_edge(col_profile, w, from_start=False)
    top = _find_inner_edge(row_profile, h, from_start=True)
    bottom = _find_inner_edge(row_profile, h, from_start=False)

    # Confidence starts high and is reduced for every ambiguity.
    confidence = 0.75
    note_parts: list[str] = []

    # Fallbacks when an edge could not be located: assume symmetric (neutral)
    # and drop confidence a lot, since we effectively could not measure it.
    if left is None or right is None:
        confidence -= 0.35
        note_parts.append("Horizontal inner border ambiguous (possible full-art layout).")
        left = left if left is not None else int(w * 0.08)
        right = right if right is not None else int(w * 0.08)
    if top is None or bottom is None:
        confidence -= 0.35
        note_parts.append("Vertical inner border ambiguous (possible full-art layout).")
        top = top if top is not None else int(h * 0.08)
        bottom = bottom if bottom is not None else int(h * 0.08)

    left_f, right_f, top_f, bottom_f = float(left), float(right), float(top), float(bottom)

    # Ratios. Express as "A/B" where A is the left/top share of the two borders.
    h_total = left_f + right_f
    v_total = top_f + bottom_f
    h_left_pct = 50.0 if h_total == 0 else (left_f / h_total) * 100.0
    v_top_pct = 50.0 if v_total == 0 else (top_f / v_total) * 100.0
    horizontal_ratio = f"{round(h_left_pct)}/{round(100 - h_left_pct)}"
    vertical_ratio = f"{round(v_top_pct)}/{round(100 - v_top_pct)}"

    # Score: perfect 50/50 -> 100. Deviation of X percentage points from 50 on
    # the worse axis reduces the score. A 60/40 card (10pt deviation) -> ~80.
    h_dev = abs(h_left_pct - 50.0)
    v_dev = abs(v_top_pct - 50.0)
    worst_dev = max(h_dev, v_dev)
    score = float(max(0.0, 100.0 - worst_dev * 2.0))

    # If overall gradient energy is very low, the card may be low-contrast /
    # full-art; reduce confidence further.
    if float(mag.mean()) < 8.0:
        confidence -= 0.15
        note_parts.append("Low border contrast; centering estimate is weak.")

    confidence = float(max(0.05, min(1.0, confidence)))
    note = (
        " ".join(note_parts)
        if note_parts
        else "Inner border detected via gradient projection profiles."
    )

    return CenteringResult(
        left_border=round(left_f, 1),
        right_border=round(right_f, 1),
        top_border=round(top_f, 1),
        bottom_border=round(bottom_f, 1),
        horizontal_ratio=horizontal_ratio,
        vertical_ratio=vertical_ratio,
        score=round(score, 1),
        confidence=round(confidence, 3),
        region_used="gradient_projection_profile",
        note=note,
    )
