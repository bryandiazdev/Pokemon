"""Pydantic v2 response models for the vision service.

These are the public contract of the API. Every numeric "score" is on a 0-100
scale unless stated otherwise, and every "confidence" is a 0-1 float describing
how much the (heuristic) analysis trusts its own output.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Severity = Literal["none", "minor", "moderate", "severe"]

# The only submission recommendation strings the rules engine may emit.
SubmissionRecommendation = Literal[
    "Strong submission candidate",
    "Possible submission candidate",
    "Borderline; inspect manually",
    "Unlikely to justify grading financially",
    "Insufficient image quality",
    "Serious condition issue detected",
]


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorEnvelope(BaseModel):
    success: Literal[False] = False
    error: ErrorBody


# --------------------------------------------------------------------------- #
# Image quality
# --------------------------------------------------------------------------- #
class QualityReport(BaseModel):
    accepted: bool = Field(..., description="Whether the image is good enough to analyze.")
    focus_score: float = Field(..., ge=0, le=100)
    exposure_score: float = Field(..., ge=0, le=100)
    glare_score: float = Field(..., ge=0, le=100, description="Higher is better (less glare).")
    coverage_score: float = Field(..., ge=0, le=100, description="How much of the frame is card.")
    resolution_score: float = Field(..., ge=0, le=100)
    overall_score: float = Field(..., ge=0, le=100)
    # Raw metrics for transparency / debugging.
    laplacian_variance: float
    mean_brightness: float
    clipped_highlight_fraction: float
    crushed_shadow_fraction: float
    glare_fraction: float
    frame_coverage: float
    megapixels: float
    color_cast: float = Field(..., description="0 = neutral, higher = stronger color cast.")
    issues: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Detection / geometry
# --------------------------------------------------------------------------- #
class DetectResult(BaseModel):
    detected: bool
    corners: list[list[float]] | None = Field(
        default=None, description="Ordered TL, TR, BR, BL as [x, y] pairs."
    )
    frame_coverage: float = Field(..., ge=0, le=1)
    confidence: float = Field(..., ge=0, le=1)
    note: str | None = None


class RectifyResult(BaseModel):
    rectified: bool
    width: int
    height: int
    aspect_ratio: float
    annotated_png_base64: str | None = None
    note: str | None = None


class OrientationResult(BaseModel):
    orientation: Literal["portrait", "landscape", "unknown"]
    rotated_degrees: int
    likely_side: Literal["front", "back", "unknown"]
    confidence: float = Field(..., ge=0, le=1)
    note: str | None = None


# --------------------------------------------------------------------------- #
# Centering
# --------------------------------------------------------------------------- #
class CenteringResult(BaseModel):
    left_border: float
    right_border: float
    top_border: float
    bottom_border: float
    horizontal_ratio: str = Field(..., description='e.g. "62/38" (larger side first not enforced).')
    vertical_ratio: str
    score: float = Field(..., ge=0, le=100)
    confidence: float = Field(..., ge=0, le=1)
    region_used: str = Field(..., description="Which region/heuristic produced the measurement.")
    note: str | None = None


# --------------------------------------------------------------------------- #
# Corners / edges / surface / structural
# --------------------------------------------------------------------------- #
class CornerFinding(BaseModel):
    corner: Literal["top_left", "top_right", "bottom_right", "bottom_left"]
    severity: Severity
    whitening_fraction: float
    rounding_estimate: float = Field(..., description="0 = sharp, higher = more rounded.")
    confidence: float = Field(..., ge=0, le=1)
    bounding_box: list[int] | None = Field(default=None, description="[x, y, w, h] in card px.")
    explanation: str
    grade_cap: int | None = Field(default=None, ge=1, le=10)


class CornersResult(BaseModel):
    findings: list[CornerFinding]
    score: float = Field(..., ge=0, le=100)
    confidence: float = Field(..., ge=0, le=1)
    note: str


class EdgeFinding(BaseModel):
    edge: Literal["top", "right", "bottom", "left"]
    severity: Severity
    whitening_fraction: float
    confidence: float = Field(..., ge=0, le=1)
    bounding_box: list[int] | None = None
    explanation: str
    grade_cap: int | None = Field(default=None, ge=1, le=10)


class EdgesResult(BaseModel):
    findings: list[EdgeFinding]
    score: float = Field(..., ge=0, le=100)
    confidence: float = Field(..., ge=0, le=1)
    note: str


class SurfaceResult(BaseModel):
    scratch_density: float = Field(..., description="Relative density of linear defects.")
    glare_fraction: float
    score: float = Field(..., ge=0, le=100)
    confidence: float = Field(..., ge=0, le=1)
    findings: list[str] = Field(default_factory=list)
    note: str


class StructuralResult(BaseModel):
    aspect_ratio: float
    expected_aspect_ratio: float
    dimensional_deviation: float = Field(..., description="Relative deviation from expected ratio.")
    convexity: float = Field(..., description="Contour solidity; lower can indicate bends/warping.")
    score: float = Field(..., ge=0, le=100)
    confidence: float = Field(..., ge=0, le=1)
    findings: list[str] = Field(default_factory=list)
    note: str


# --------------------------------------------------------------------------- #
# Grade potential (fusion)
# --------------------------------------------------------------------------- #
class GradeFinding(BaseModel):
    category: Literal["centering", "corners", "edges", "surface", "structural", "quality"]
    severity: Severity
    title: str
    explanation: str
    capture_type: str = Field(..., description="Which capture the finding came from, e.g. 'front'.")
    bounding_box: list[int] | None = None
    confidence: float = Field(..., ge=0, le=1)
    grade_cap: int | None = Field(default=None, ge=1, le=10)


class GradePotentialResult(BaseModel):
    estimated_min_grade: int = Field(..., ge=1, le=10)
    estimated_max_grade: int = Field(..., ge=1, le=10)
    estimated_ceiling: int = Field(..., ge=1, le=10)
    overall_confidence: float = Field(..., ge=0, le=1)
    centering_score: float = Field(..., ge=0, le=100)
    corner_score: float = Field(..., ge=0, le=100)
    edge_score: float = Field(..., ge=0, le=100)
    surface_score: float = Field(..., ge=0, le=100)
    structural_score: float = Field(..., ge=0, le=100)
    image_quality_score: float = Field(..., ge=0, le=100)
    limiting_defects: list[str] = Field(default_factory=list)
    suggested_recaptures: list[str] = Field(default_factory=list)
    submission_recommendation: SubmissionRecommendation
    findings: list[GradeFinding] = Field(default_factory=list)
    model_version: str
    rules_version: str
    disclaimer_version: str
    disclaimer: str
