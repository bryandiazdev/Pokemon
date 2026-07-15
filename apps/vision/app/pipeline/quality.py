"""Image quality assessment.

Real metrics computed here:
  * Focus / blur      -> variance of the Laplacian (classic sharpness measure).
  * Exposure          -> histogram mean brightness + clipped highlight/shadow %.
  * Glare             -> fraction of near-white, low-saturation specular pixels.
  * Card coverage     -> from the boundary detector.
  * Resolution        -> megapixels.
  * Color cast        -> spread of per-channel means (neutral photos are even).

Each metric is mapped to a 0-100 sub-score and combined into an overall score
and an `accepted` boolean, along with human-readable retake instructions.

All thresholds live as module constants with comments so they can be tuned.
"""

from __future__ import annotations

import cv2
import numpy as np

from ..schemas import QualityReport
from .detect import detect_card

# --- Tunable thresholds --------------------------------------------------- #
# Laplacian variance below this reads as soft/blurry for a full-card photo.
BLUR_VARIANCE_MIN = 60.0
# Above this variance the image is comfortably sharp.
BLUR_VARIANCE_GOOD = 300.0
# Acceptable mean brightness window (0-255).
BRIGHTNESS_MIN = 60.0
BRIGHTNESS_MAX = 200.0
# Fraction of pixels allowed to be clipped before we complain.
MAX_CLIPPED_HIGHLIGHTS = 0.06
MAX_CRUSHED_SHADOWS = 0.06
# Specular glare: pixels that are very bright AND very desaturated.
GLARE_VALUE_MIN = 245  # in HSV V (0-255)
GLARE_SAT_MAX = 30  # in HSV S (0-255)
MAX_GLARE_FRACTION = 0.02
# Card should fill a decent chunk of the frame.
MIN_COVERAGE = 0.15
GOOD_COVERAGE = 0.45
# Resolution targets.
MIN_MEGAPIXELS = 1.0
GOOD_MEGAPIXELS = 4.0
# Overall acceptance threshold.
ACCEPT_SCORE = 60.0


def _linear_score(value: float, low: float, high: float) -> float:
    """Map value in [low, high] linearly to [0, 100], clamped."""
    if high == low:
        return 100.0
    t = (value - low) / (high - low)
    return float(max(0.0, min(1.0, t)) * 100.0)


def assess_quality(image_bgr: np.ndarray) -> QualityReport:
    """Compute a full QualityReport for a BGR image."""
    h, w = image_bgr.shape[:2]
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

    # Focus: variance of Laplacian.
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    focus_score = _linear_score(lap_var, BLUR_VARIANCE_MIN, BLUR_VARIANCE_GOOD)

    # Exposure.
    mean_brightness = float(gray.mean())
    total_px = float(gray.size)
    clipped_high = float(np.count_nonzero(gray >= 250)) / total_px
    crushed_low = float(np.count_nonzero(gray <= 5)) / total_px
    # Score high when brightness is mid-range and little clipping.
    if mean_brightness < BRIGHTNESS_MIN:
        exposure_base = _linear_score(mean_brightness, 0, BRIGHTNESS_MIN)
    elif mean_brightness > BRIGHTNESS_MAX:
        exposure_base = _linear_score(255 - mean_brightness, 0, 255 - BRIGHTNESS_MAX)
    else:
        exposure_base = 100.0
    clip_penalty = min(1.0, (clipped_high + crushed_low) / 0.20) * 40.0
    exposure_score = float(max(0.0, exposure_base - clip_penalty))

    # Glare: bright + desaturated pixels.
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    sat = hsv[:, :, 1]
    val = hsv[:, :, 2]
    glare_mask = (val >= GLARE_VALUE_MIN) & (sat <= GLARE_SAT_MAX)
    glare_fraction = float(np.count_nonzero(glare_mask)) / total_px
    # More glare -> lower score. At MAX_GLARE_FRACTION score ~ 50; scale down.
    glare_score = float(max(0.0, 100.0 - (glare_fraction / max(MAX_GLARE_FRACTION, 1e-6)) * 50.0))
    glare_score = min(100.0, glare_score)

    # Coverage from detector.
    det = detect_card(image_bgr)
    coverage = det.frame_coverage
    coverage_score = _linear_score(coverage, MIN_COVERAGE, GOOD_COVERAGE)

    # Resolution.
    megapixels = (h * w) / 1_000_000.0
    resolution_score = _linear_score(megapixels, MIN_MEGAPIXELS, GOOD_MEGAPIXELS)

    # Color cast: standard deviation of channel means, normalized.
    b, g, r = (float(c.mean()) for c in cv2.split(image_bgr))
    channel_means = np.array([b, g, r])
    color_cast = float(np.std(channel_means))

    # Weighted overall score. Focus and glare matter most for grading utility.
    overall_score = float(
        0.30 * focus_score
        + 0.20 * glare_score
        + 0.20 * exposure_score
        + 0.20 * coverage_score
        + 0.10 * resolution_score
    )

    issues: list[str] = []
    if focus_score < 50:
        issues.append("Image looks soft. Hold steady and let the camera focus, then retake.")
    if glare_fraction > MAX_GLARE_FRACTION:
        issues.append("Glare is hiding part of the surface. Retake in brighter indirect light.")
    if mean_brightness < BRIGHTNESS_MIN:
        issues.append("Photo is too dark. Retake in brighter indirect light.")
    if mean_brightness > BRIGHTNESS_MAX or clipped_high > MAX_CLIPPED_HIGHLIGHTS:
        issues.append("Photo is over-exposed. Reduce direct light and retake.")
    if crushed_low > MAX_CRUSHED_SHADOWS:
        issues.append("Shadows are crushed. Even out the lighting and retake.")
    if coverage < MIN_COVERAGE:
        issues.append("Move closer while keeping the full card visible.")
    if megapixels < MIN_MEGAPIXELS:
        issues.append("Resolution is low. Use a higher-quality camera setting.")
    if color_cast > 40:
        issues.append("Strong color cast detected. Use neutral white lighting and retake.")

    accepted = overall_score >= ACCEPT_SCORE and focus_score >= 40

    return QualityReport(
        accepted=accepted,
        focus_score=round(focus_score, 1),
        exposure_score=round(exposure_score, 1),
        glare_score=round(glare_score, 1),
        coverage_score=round(coverage_score, 1),
        resolution_score=round(resolution_score, 1),
        overall_score=round(overall_score, 1),
        laplacian_variance=round(lap_var, 2),
        mean_brightness=round(mean_brightness, 2),
        clipped_highlight_fraction=round(clipped_high, 4),
        crushed_shadow_fraction=round(crushed_low, 4),
        glare_fraction=round(glare_fraction, 4),
        frame_coverage=round(coverage, 4),
        megapixels=round(megapixels, 2),
        color_cast=round(color_cast, 2),
        issues=issues,
    )
