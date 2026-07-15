ALLOWED_RECOMMENDATIONS = {
    "Strong submission candidate",
    "Possible submission candidate",
    "Borderline; inspect manually",
    "Unlikely to justify grading financially",
    "Insufficient image quality",
    "Serious condition issue detected",
}


def _grade(client, data: bytes, capture_type: str = "front"):
    return client.post(
        "/v1/cards/grade-potential",
        files=[("files", ("card.png", data, "image/png"))],
        data={"capture_types": capture_type},
    )


def test_good_front_yields_valid_result(client, perfect_card_bytes):
    resp = _grade(client, perfect_card_bytes)
    assert resp.status_code == 200
    body = resp.json()

    for key in ("estimated_min_grade", "estimated_max_grade", "estimated_ceiling"):
        assert 1 <= body[key] <= 10

    assert body["estimated_min_grade"] <= body["estimated_max_grade"]
    assert body["estimated_ceiling"] <= body["estimated_max_grade"]
    assert body["estimated_min_grade"] <= body["estimated_ceiling"]

    assert body["submission_recommendation"] in ALLOWED_RECOMMENDATIONS
    assert body["disclaimer"]
    assert body["model_version"]
    assert body["rules_version"]
    assert body["disclaimer_version"]
    assert 0.0 <= body["overall_confidence"] <= 1.0


def test_blurry_image_insufficient_quality(client, blurry_card_bytes):
    resp = _grade(client, blurry_card_bytes)
    assert resp.status_code == 200
    body = resp.json()
    # A heavily blurred capture should either be rejected on quality grounds or
    # at least carry low confidence.
    assert (
        body["submission_recommendation"] == "Insufficient image quality"
        or body["overall_confidence"] <= 0.4
    )
