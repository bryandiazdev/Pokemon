"""Safe image loading and encoding helpers.

Loading untrusted image uploads is a security-sensitive operation:
  * A file may be far larger than we want to hold in memory.
  * A tiny compressed file may decode to billions of pixels (decompression bomb).
  * The bytes may not be a valid image at all.
  * The image may carry EXIF/metadata we do not want to keep.

`load_image_bgr` performs all of these guards and returns a clean OpenCV BGR
ndarray with EXIF orientation applied and metadata stripped.
"""

from __future__ import annotations

import base64
import io

import cv2
import numpy as np
from PIL import Image, ImageOps

from .config import get_settings


class ImageValidationError(Exception):
    """Raised when an upload cannot be safely decoded into an image."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def load_image_bgr(data: bytes) -> np.ndarray:
    """Validate and decode raw upload bytes into an OpenCV BGR ndarray.

    Applies size, pixel-count, and format guards; strips metadata; applies EXIF
    orientation so downstream geometry is correct.
    """
    settings = get_settings()

    if not data:
        raise ImageValidationError("empty_upload", "The uploaded file is empty.")

    if len(data) > settings.max_upload_bytes:
        raise ImageValidationError(
            "file_too_large",
            f"File exceeds the {settings.max_upload_bytes} byte limit.",
        )

    # First open only reads the header; use it to check declared pixel count
    # BEFORE fully decoding to defend against decompression bombs.
    try:
        probe = Image.open(io.BytesIO(data))
        width, height = probe.size
    except Exception as exc:  # noqa: BLE001 - any failure means "not an image".
        raise ImageValidationError("invalid_image", "File is not a valid image.") from exc

    if width <= 0 or height <= 0:
        raise ImageValidationError("invalid_image", "Image has non-positive dimensions.")

    if width * height > settings.max_pixels:
        raise ImageValidationError(
            "image_too_large",
            f"Image decodes to more than {settings.max_pixels} pixels.",
        )

    # Fully decode. Re-open from a fresh buffer since we consumed the probe.
    try:
        img = Image.open(io.BytesIO(data))
        # Apply EXIF orientation, then drop all metadata by re-materializing.
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")
        # Re-create the array with no PIL info attached -> metadata stripped.
        rgb = np.asarray(img, dtype=np.uint8)
    except Exception as exc:  # noqa: BLE001
        raise ImageValidationError("decode_failed", "Failed to decode the image.") from exc

    if rgb.ndim != 3 or rgb.shape[2] != 3:
        raise ImageValidationError("decode_failed", "Decoded image is not 3-channel RGB.")

    # Convert RGB -> BGR for OpenCV conventions.
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    return bgr


def encode_png_base64(image_bgr: np.ndarray) -> str:
    """Encode a BGR ndarray to a base64-encoded PNG string (no data URI prefix)."""
    ok, buffer = cv2.imencode(".png", image_bgr)
    if not ok:
        raise ImageValidationError("encode_failed", "Failed to encode image to PNG.")
    return base64.b64encode(buffer.tobytes()).decode("ascii")
