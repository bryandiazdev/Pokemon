"""Deterministic synthetic test fixtures.

We synthesize card-like images with numpy + OpenCV so tests need no real photos
and are fully deterministic. `make_card_image` draws a bright bordered rectangle
(the "card") on a dark background, with a configurable inner border to simulate
centering, plus optional blur and glare.
"""

from __future__ import annotations

import cv2
import numpy as np
import pytest


def _to_png_bytes(image_bgr: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".png", image_bgr)
    assert ok, "failed to encode synthetic image"
    return buf.tobytes()


def make_card_image(
    centering: str = "perfect",
    blur: bool = False,
    glare: bool = False,
    canvas: tuple[int, int] = (1400, 1000),  # (height, width)
    card_size: tuple[int, int] = (840, 600),  # (height, width), 5:7 aspect
) -> bytes:
    """Return PNG bytes of a synthetic Pokemon-like card on a dark background.

    centering:
      "perfect" -> equal inner borders (well centered)
      "off"     -> inner region shifted so horizontal borders are uneven
    """
    ch, cw = canvas
    kh, kw = card_size

    # Dark textured background so the card contrasts strongly.
    img = np.full((ch, cw, 3), 30, dtype=np.uint8)

    # Card position, centered on the canvas.
    y0 = (ch - kh) // 2
    x0 = (cw - kw) // 2
    y1, x1 = y0 + kh, x0 + kw

    # Yellow card border (BGR). Pokemon cards have a bright yellow outer border.
    img[y0:y1, x0:x1] = (0, 255, 255)

    # Inner border widths (in card-local pixels).
    if centering == "off":
        bl, br = 40, 100  # left thinner, right thicker -> off-center horizontally
        bt, bb = 70, 70
    else:  # perfect
        bl = br = 70
        bt = bb = 70

    iy0, iy1 = y0 + bt, y1 - bb
    ix0, ix1 = x0 + bl, x1 - br

    # Inner artwork region: a dark navy panel that contrasts with the yellow
    # border, giving a strong gradient at the inner-frame transition.
    img[iy0:iy1, ix0:ix1] = (60, 40, 20)

    # A lighter inset "art box" to add some real high-frequency detail so a sharp
    # image has meaningful Laplacian variance.
    ay0, ay1 = iy0 + 30, iy0 + (iy1 - iy0) // 2
    ax0, ax1 = ix0 + 30, ix1 - 30
    img[ay0:ay1, ax0:ax1] = (200, 180, 160)

    if glare:
        # Large specular highlight: near-white, desaturated blob over the card.
        gy0, gy1 = y0 + 100, y0 + 400
        gx0, gx1 = x0 + 80, x0 + 480
        img[gy0:gy1, gx0:gx1] = (255, 255, 255)

    if blur:
        img = cv2.GaussianBlur(img, (31, 31), 0)

    return _to_png_bytes(img)


@pytest.fixture
def perfect_card_bytes() -> bytes:
    return make_card_image(centering="perfect")


@pytest.fixture
def off_center_card_bytes() -> bytes:
    return make_card_image(centering="off")


@pytest.fixture
def blurry_card_bytes() -> bytes:
    return make_card_image(centering="perfect", blur=True)


@pytest.fixture
def glare_card_bytes() -> bytes:
    return make_card_image(centering="perfect", glare=True)


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)
