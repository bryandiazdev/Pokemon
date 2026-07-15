"""Shared upload-handling helpers for routers."""

from __future__ import annotations

import numpy as np
from fastapi import HTTPException, UploadFile, status

from ..imaging import ImageValidationError, load_image_bgr

# Content types we accept. We still validate by decoding, but reject obvious
# non-images early with a clear message.
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/bmp",
    "image/tiff",
    "application/octet-stream",  # some clients send this for binary uploads
}


async def read_image(file: UploadFile) -> np.ndarray:
    """Read + validate an UploadFile into a BGR ndarray, raising HTTP 4xx on error."""
    if file.content_type and file.content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported content type: {file.content_type}",
        )
    data = await file.read()
    try:
        return load_image_bgr(data)
    except ImageValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.message,
        ) from exc
