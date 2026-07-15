"""Versioned, conservative grade-potential rules engine.

This module maps sub-scores and findings to an estimated grade RANGE. It is
deliberately conservative and never emits false precision:

  * Individual sub-scores (0-100) map to a component grade (1-10).
  * The estimated ceiling is the min of the component grades AND any per-finding
    `grade_cap` -- i.e. a single serious limiting defect caps the ceiling
    regardless of how good everything else is.
  * The estimated max never exceeds the ceiling; the estimated min sits a band
    below the ceiling, widened when confidence is low.
  * Overall confidence is the (capture-weighted) mean of component confidences,
    then reduced when image quality is poor or captures are missing.

PSA-style centering thresholds are encoded as DOCUMENTED constants with a source
note and effective date. They are approximate, public-knowledge tolerances used
here only to bucket centering quality -- they are NOT official PSA criteria and
PSA may grade differently.

Source note: PSA publicly describes maximum front centering tolerances of about
55/45 for Gem Mint 10 and 60/40 for Mint 9 (see PSA grading standards,
referenced 2024). Encoded below with an effective date so they can be revised.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..config import get_settings
from ..schemas import GradeFinding, GradePotentialResult, SubmissionRecommendation
from .disclaimer import DISCLAIMER, DISCLAIMER_VERSION

RULES_EFFECTIVE_DATE = "2024-01-01"

# Approximate public PSA front-centering tolerances (larger-side percentage).
# Used only to bucket a centering ratio into a plausible grade influence.
PSA_CENTERING_TOLERANCE = {
    10: 55.0,  # ~55/45 max for Gem Mint 10
    9: 60.0,  # ~60/40 max for Mint 9
    8: 65.0,  # ~65/35 for NM-MT 8
    7: 70.0,
}

# Image-quality score below this forces an "insufficient image quality" outcome.
MIN_QUALITY_FOR_GRADE = 45.0
# Below this quality we also cut confidence hard.
LOW_QUALITY_CONFIDENCE = 60.0


@dataclass
class GradeInputs:
    centering_score: float
    corner_score: float
    edge_score: float
    surface_score: float
    structural_score: float
    image_quality_score: float
    centering_confidence: float = 0.6
    corner_confidence: float = 0.5
    edge_confidence: float = 0.5
    surface_confidence: float = 0.3
    structural_confidence: float = 0.4
    findings: list[GradeFinding] = field(default_factory=list)
    # Which capture types were supplied (front, back, front_angled, ...).
    provided_captures: list[str] = field(default_factory=list)


def _score_to_grade(score: float) -> int:
    """Map a 0-100 component score to a conservative 1-10 grade.

    The mapping is intentionally strict at the top: near-perfect scores are
    required for a 10, so we don't over-promise gem mint.
    """
    if score >= 97:
        return 10
    if score >= 90:
        return 9
    if score >= 82:
        return 8
    if score >= 72:
        return 7
    if score >= 62:
        return 6
    if score >= 50:
        return 5
    if score >= 38:
        return 4
    if score >= 26:
        return 3
    if score >= 14:
        return 2
    return 1


def _recommendation(
    ceiling: int,
    quality_ok: bool,
    has_serious_defect: bool,
    confidence: float,
) -> SubmissionRecommendation:
    if not quality_ok:
        return "Insufficient image quality"
    if has_serious_defect:
        return "Serious condition issue detected"
    if ceiling >= 9 and confidence >= 0.5:
        return "Strong submission candidate"
    if ceiling >= 8:
        return "Possible submission candidate"
    if ceiling >= 6:
        return "Borderline; inspect manually"
    return "Unlikely to justify grading financially"


def evaluate(inputs: GradeInputs) -> GradePotentialResult:
    """Fuse sub-scores and findings into a conservative grade-potential result."""
    settings = get_settings()

    quality_ok = inputs.image_quality_score >= MIN_QUALITY_FOR_GRADE

    # Component grades from scores.
    component_grades = {
        "centering": _score_to_grade(inputs.centering_score),
        "corners": _score_to_grade(inputs.corner_score),
        "edges": _score_to_grade(inputs.edge_score),
        "surface": _score_to_grade(inputs.surface_score),
        "structural": _score_to_grade(inputs.structural_score),
    }

    # Per-finding caps: any serious limiting defect caps the ceiling.
    finding_caps = [f.grade_cap for f in inputs.findings if f.grade_cap is not None]
    has_serious_defect = any(f.severity == "severe" for f in inputs.findings)

    ceiling = min(component_grades.values())
    if finding_caps:
        ceiling = min(ceiling, min(finding_caps))
    ceiling = int(max(1, min(10, ceiling)))

    # Confidence: capture-weighted mean of component confidences.
    confidences = [
        inputs.centering_confidence,
        inputs.corner_confidence,
        inputs.edge_confidence,
        inputs.surface_confidence,
        inputs.structural_confidence,
    ]
    overall_confidence = sum(confidences) / len(confidences)
    # Reduce confidence for poor quality and for missing captures.
    if inputs.image_quality_score < LOW_QUALITY_CONFIDENCE:
        overall_confidence *= 0.5
    provided = {c.lower() for c in inputs.provided_captures}
    if not any("angled" in c for c in provided):
        overall_confidence *= 0.8  # no angled capture -> surface read is weak
    if "back" not in provided:
        overall_confidence *= 0.9  # only front seen
    overall_confidence = float(max(0.05, min(1.0, overall_confidence)))

    # Range around the ceiling. Lower confidence -> wider band.
    band = 1 if overall_confidence >= 0.55 else 2
    estimated_max = ceiling
    estimated_min = int(max(1, ceiling - band))

    # If image quality is insufficient, collapse to a cautious, wide, low result.
    if not quality_ok:
        estimated_max = min(estimated_max, 8)
        estimated_min = 1
        ceiling = min(ceiling, estimated_max)
        overall_confidence = min(overall_confidence, 0.2)

    # Limiting defects: components whose grade equals the ceiling (they bound it).
    limiting_defects: list[str] = []
    for name, grade in component_grades.items():
        if grade <= ceiling:
            limiting_defects.append(name)
    for f in inputs.findings:
        if f.grade_cap is not None and f.grade_cap <= ceiling:
            limiting_defects.append(f"{f.category}: {f.title}")

    # Suggested recaptures based on missing/weak captures.
    suggested_recaptures: list[str] = []
    if not quality_ok:
        suggested_recaptures.append("Retake a sharp, well-lit, glare-free photo of the full card.")
    if not any("angled" in c for c in provided):
        suggested_recaptures.append(
            "Add an angled photo under a light to reveal surface scratches and print lines."
        )
    if "back" not in provided:
        suggested_recaptures.append("Add a photo of the card back for centering and edge checks.")

    recommendation = _recommendation(
        ceiling, quality_ok, has_serious_defect, overall_confidence
    )

    return GradePotentialResult(
        estimated_min_grade=estimated_min,
        estimated_max_grade=estimated_max,
        estimated_ceiling=ceiling,
        overall_confidence=round(overall_confidence, 3),
        centering_score=round(inputs.centering_score, 1),
        corner_score=round(inputs.corner_score, 1),
        edge_score=round(inputs.edge_score, 1),
        surface_score=round(inputs.surface_score, 1),
        structural_score=round(inputs.structural_score, 1),
        image_quality_score=round(inputs.image_quality_score, 1),
        limiting_defects=sorted(set(limiting_defects)),
        suggested_recaptures=suggested_recaptures,
        submission_recommendation=recommendation,
        findings=inputs.findings,
        model_version=settings.model_version,
        rules_version=settings.rules_version,
        disclaimer_version=DISCLAIMER_VERSION,
        disclaimer=DISCLAIMER,
    )
