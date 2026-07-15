def test_detect_finds_card(client, perfect_card_bytes):
    resp = client.post(
        "/v1/cards/detect",
        files={"file": ("card.png", perfect_card_bytes, "image/png")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["detected"] is True
    assert body["corners"] is not None
    assert len(body["corners"]) == 4
    # Card should occupy a substantial fraction of the frame.
    assert body["frame_coverage"] > 0.2


def test_rectify_returns_canonical_dims(client, perfect_card_bytes):
    resp = client.post(
        "/v1/cards/rectify",
        files={"file": ("card.png", perfect_card_bytes, "image/png")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["rectified"] is True
    assert body["width"] == 500
    assert body["height"] == 700
    assert body["annotated_png_base64"]
