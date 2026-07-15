"""Card-analysis endpoints.

Design note for /grade-potential multi-file handling:
The endpoint accepts a list of `files` plus a parallel list of `capture_types`
form fields (e.g. front, back, front_angled, corner_tl). If fewer capture types
are provided than files, the first file defaults to "front" and the rest to
"additional". We select the primary FRONT-like capture for geometry (detection,
rectification, centering, corners, edges, structural); surface analysis is told
whether any angled capture exists so it can adjust confidence. This keeps the
contract simple while letting richer capture sets improve the estimate.
"""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from ..grading.rules import GradeInputs, evaluate
from ..imaging import encode_png_base64
from ..pipeline.centering import analyze_centering
from ..pipeline.corners import analyze_corners
from ..pipeline.detect import DetectionOutput, detect_card
from ..pipeline.edges import analyze_edges
from ..pipeline.orientation import normalize_orientation
from ..pipeline.rectify import annotate_corners, rectify_card
from ..pipeline.structural import analyze_structural
from ..pipeline.surface import analyze_surface
from ..schemas import (
    CenteringResult,
    CornersResult,
    DetectResult,
    EdgesResult,
    GradeFinding,
    GradePotentialResult,
    OrientationResult,
    RectifyResult,
    StructuralResult,
    SurfaceResult,
)
from ..security import require_api_key
from .common import read_image

router = APIRouter(prefix="/v1/cards", tags=["cards"], dependencies=[Depends(require_api_key)])


def _require_detection(image: np.ndarray) -> DetectionOutput:
    det = detect_card(image)
    if not det.detected or det.corners is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not confidently detect a card in the image.",
        )
    return det


def _rectified(image: np.ndarray) -> np.ndarray:
    det = _require_detection(image)
    return rectify_card(image, det.corners).image


@router.post("/detect", response_model=DetectResult)
async def detect(file: UploadFile = File(...)) -> DetectResult:
    image = await read_image(file)
    det = detect_card(image)
    return DetectResult(
        detected=det.detected,
        corners=[[float(x), float(y)] for x, y in det.corners] if det.corners is not None else None,
        frame_coverage=round(det.frame_coverage, 4),
        confidence=det.confidence,
        note=det.note,
    )


@router.post("/rectify", response_model=RectifyResult)
async def rectify(file: UploadFile = File(...)) -> RectifyResult:
    image = await read_image(file)
    det = detect_card(image)
    if not det.detected or det.corners is None:
        return RectifyResult(
            rectified=False,
            width=0,
            height=0,
            aspect_ratio=0.0,
            annotated_png_base64=None,
            note="Card not detected; cannot rectify.",
        )
    out = rectify_card(image, det.corners)
    annotated = annotate_corners(image, det.corners)
    return RectifyResult(
        rectified=True,
        width=out.width,
        height=out.height,
        aspect_ratio=out.aspect_ratio,
        annotated_png_base64=encode_png_base64(annotated),
        note=det.note,
    )


@router.post("/orientation", response_model=OrientationResult)
async def orientation(file: UploadFile = File(...)) -> OrientationResult:
    image = await read_image(file)
    out = normalize_orientation(image)
    return OrientationResult(
        orientation=out.orientation,
        rotated_degrees=out.rotated_degrees,
        likely_side=out.likely_side,
        confidence=out.confidence,
        note=out.note,
    )


@router.post("/centering", response_model=CenteringResult)
async def centering(file: UploadFile = File(...)) -> CenteringResult:
    image = await read_image(file)
    rect = _rectified(image)
    return analyze_centering(rect)


@router.post("/corners", response_model=CornersResult)
async def corners(file: UploadFile = File(...)) -> CornersResult:
    image = await read_image(file)
    rect = _rectified(image)
    return analyze_corners(rect)


@router.post("/edges", response_model=EdgesResult)
async def edges(file: UploadFile = File(...)) -> EdgesResult:
    image = await read_image(file)
    rect = _rectified(image)
    return analyze_edges(rect)


@router.post("/surface", response_model=SurfaceResult)
async def surface(file: UploadFile = File(...)) -> SurfaceResult:
    image = await read_image(file)
    rect = _rectified(image)
    return analyze_surface(rect, has_angled_capture=False)


@router.post("/structural", response_model=StructuralResult)
async def structural(file: UploadFile = File(...)) -> StructuralResult:
    image = await read_image(file)
    return analyze_structural(image)


def _findings_from_corners(res: CornersResult, capture: str) -> list[GradeFinding]:
    out: list[GradeFinding] = []
    for f in res.findings:
        if f.severity == "none":
            continue
        out.append(
            GradeFinding(
                category="corners",
                severity=f.severity,
                title=f"{f.corner.replace('_', ' ').title()} corner wear",
                explanation=f.explanation,
                capture_type=capture,
                bounding_box=f.bounding_box,
                confidence=f.confidence,
                grade_cap=f.grade_cap,
            )
        )
    return out


def _findings_from_edges(res: EdgesResult, capture: str) -> list[GradeFinding]:
    out: list[GradeFinding] = []
    for f in res.findings:
        if f.severity == "none":
            continue
        out.append(
            GradeFinding(
                category="edges",
                severity=f.severity,
                title=f"{f.edge.title()} edge whitening",
                explanation=f.explanation,
                capture_type=capture,
                bounding_box=f.bounding_box,
                confidence=f.confidence,
                grade_cap=f.grade_cap,
            )
        )
    return out


@router.post("/grade-potential", response_model=GradePotentialResult)
async def grade_potential(
    files: list[UploadFile] = File(...),
    capture_types: list[str] | None = Form(default=None),
) -> GradePotentialResult:
    """Full fusion across one or more captures -> a conservative grade estimate."""
    if not files:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one image file is required.",
        )

    # Normalize capture types to match the number of files.
    types: list[str] = list(capture_types or [])
    normalized: list[str] = []
    for i in range(len(files)):
        if i < len(types) and types[i].strip():
            normalized.append(types[i].strip().lower())
        else:
            normalized.append("front" if i == 0 else "additional")

    # Load all images (validates each).
    loaded: list[tuple[str, np.ndarray]] = []
    for capture, file in zip(normalized, files, strict=False):
        loaded.append((capture, await read_image(file)))

    # Pick the primary front-like capture for geometry.
    primary_capture, primary_image = loaded[0]
    for capture, image in loaded:
        if capture == "front":
            primary_capture, primary_image = capture, image
            break

    from ..pipeline.quality import assess_quality  # local import keeps module load light

    quality = assess_quality(primary_image)

    findings: list[GradeFinding] = []

    # If the primary image quality is too poor to even detect the card, return a
    # cautious "insufficient image quality" result rather than guessing.
    det = detect_card(primary_image)
    if not det.detected or det.corners is None or not quality.accepted:
        for issue in quality.issues:
            findings.append(
                GradeFinding(
                    category="quality",
                    severity="moderate",
                    title="Image quality issue",
                    explanation=issue,
                    capture_type=primary_capture,
                    confidence=0.6,
                )
            )
        inputs = GradeInputs(
            centering_score=0.0,
            corner_score=0.0,
            edge_score=0.0,
            surface_score=0.0,
            structural_score=0.0,
            image_quality_score=quality.overall_score,
            findings=findings,
            provided_captures=normalized,
        )
        return evaluate(inputs)

    rect = rectify_card(primary_image, det.corners).image

    centering_res = analyze_centering(rect)
    corners_res = analyze_corners(rect)
    edges_res = analyze_edges(rect)
    has_angled = any("angled" in c for c in normalized)
    surface_res = analyze_surface(rect, has_angled_capture=has_angled)
    structural_res = analyze_structural(primary_image)

    findings.extend(_findings_from_corners(corners_res, primary_capture))
    findings.extend(_findings_from_edges(edges_res, primary_capture))
    for msg in structural_res.findings:
        findings.append(
            GradeFinding(
                category="structural",
                severity="minor",
                title="Structural observation",
                explanation=msg,
                capture_type=primary_capture,
                confidence=structural_res.confidence,
            )
        )
    for msg in surface_res.findings:
        findings.append(
            GradeFinding(
                category="surface",
                severity="minor",
                title="Surface observation",
                explanation=msg,
                capture_type=primary_capture,
                confidence=surface_res.confidence,
            )
        )

    inputs = GradeInputs(
        centering_score=centering_res.score,
        corner_score=corners_res.score,
        edge_score=edges_res.score,
        surface_score=surface_res.score,
        structural_score=structural_res.score,
        image_quality_score=quality.overall_score,
        centering_confidence=centering_res.confidence,
        corner_confidence=corners_res.confidence,
        edge_confidence=edges_res.confidence,
        surface_confidence=surface_res.confidence,
        structural_confidence=structural_res.confidence,
        findings=findings,
        provided_captures=normalized,
    )
    return evaluate(inputs)
