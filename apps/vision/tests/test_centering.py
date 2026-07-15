def _centering(client, data: bytes):
    resp = client.post(
        "/v1/cards/centering",
        files={"file": ("card.png", data, "image/png")},
    )
    assert resp.status_code == 200
    return resp.json()


def test_perfect_centering_scores_high(client, perfect_card_bytes):
    body = _centering(client, perfect_card_bytes)
    assert body["score"] >= 75
    # Ratio should be close to 50/50.
    left, right = (int(x) for x in body["horizontal_ratio"].split("/"))
    assert abs(left - right) <= 15


def test_off_center_scores_lower(client, perfect_card_bytes, off_center_card_bytes):
    perfect = _centering(client, perfect_card_bytes)
    off = _centering(client, off_center_card_bytes)
    assert off["score"] < perfect["score"]
    # Horizontal ratio should be visibly unbalanced.
    left, right = (int(x) for x in off["horizontal_ratio"].split("/"))
    assert abs(left - right) >= 15
