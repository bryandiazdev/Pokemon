"""Image-quality endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile

from ..pipeline.quality import assess_quality
from ..schemas import QualityReport
from ..security import require_api_key
from .common import read_image

router = APIRouter(prefix="/v1/images", tags=["images"], dependencies=[Depends(require_api_key)])


@router.post("/quality", response_model=QualityReport)
async def image_quality(file: UploadFile = File(...)) -> QualityReport:
    """Run the quality pipeline on a single uploaded image."""
    image = await read_image(file)
    return assess_quality(image)
