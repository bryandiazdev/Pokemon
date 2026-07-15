def _post(client, data: bytes, name: str = "card.png"):
    return client.post(
        "/v1/images/quality",
        files={"file": (name, data, "image/png")},
    )


def test_sharp_image_passes(client, perfect_card_bytes):
    resp = _post(client, perfect_card_bytes)
    assert resp.status_code == 200
    body = resp.json()
    assert body["accepted"] is True
    assert body["focus_score"] >= 50


def test_blurry_image_flagged(client, blurry_card_bytes):
    resp = _post(client, blurry_card_bytes)
    assert resp.status_code == 200
    body = resp.json()
    assert body["focus_score"] < 50
    assert any("soft" in i.lower() or "focus" in i.lower() for i in body["issues"])


def test_glare_image_flagged(client, glare_card_bytes):
    resp = _post(client, glare_card_bytes)
    assert resp.status_code == 200
    body = resp.json()
    assert body["glare_fraction"] > 0.02
    assert any("glare" in i.lower() for i in body["issues"])
