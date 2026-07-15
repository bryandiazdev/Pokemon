from app.grading.rules import GradeInputs, evaluate
from app.schemas import GradeFinding


def test_serious_defect_caps_ceiling():
    # Everything is pristine EXCEPT a single severe corner finding capping at 6.
    findings = [
        GradeFinding(
            category="corners",
            severity="severe",
            title="Severe corner wear",
            explanation="test",
            capture_type="front",
            confidence=0.5,
            grade_cap=6,
        )
    ]
    result = evaluate(
        GradeInputs(
            centering_score=100,
            corner_score=100,
            edge_score=100,
            surface_score=100,
            structural_score=100,
            image_quality_score=95,
            findings=findings,
            provided_captures=["front", "back", "front_angled"],
        )
    )
    assert result.estimated_ceiling <= 6
    assert result.estimated_max_grade <= 6
    assert result.submission_recommendation == "Serious condition issue detected"


def test_poor_quality_reduces_confidence_and_flags():
    good = evaluate(
        GradeInputs(
            centering_score=95,
            corner_score=95,
            edge_score=95,
            surface_score=90,
            structural_score=95,
            image_quality_score=90,
            centering_confidence=0.8,
            corner_confidence=0.7,
            edge_confidence=0.7,
            surface_confidence=0.6,
            structural_confidence=0.6,
            provided_captures=["front", "back", "front_angled"],
        )
    )
    poor = evaluate(
        GradeInputs(
            centering_score=95,
            corner_score=95,
            edge_score=95,
            surface_score=90,
            structural_score=95,
            image_quality_score=20,  # insufficient
            centering_confidence=0.8,
            corner_confidence=0.7,
            edge_confidence=0.7,
            surface_confidence=0.6,
            structural_confidence=0.6,
            provided_captures=["front"],
        )
    )
    assert poor.overall_confidence < good.overall_confidence
    assert poor.submission_recommendation == "Insufficient image quality"


def test_ranges_are_ordered_and_bounded():
    result = evaluate(
        GradeInputs(
            centering_score=70,
            corner_score=65,
            edge_score=80,
            surface_score=60,
            structural_score=85,
            image_quality_score=75,
            provided_captures=["front"],
        )
    )
    assert 1 <= result.estimated_min_grade <= result.estimated_ceiling
    assert result.estimated_ceiling <= result.estimated_max_grade <= 10
