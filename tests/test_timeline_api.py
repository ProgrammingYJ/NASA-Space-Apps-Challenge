"""Continuous scene time must not change archived observations or saved judgments."""

import hashlib
import time
from copy import deepcopy
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import create_app
from api.storage import atomic_json

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/manifests/solar_system_ephemeris.json"
GUIDE_EPOCH = "2026-11-14T00:00:00Z"
MIDPOINT = "2026-11-14T12:00:00Z"
BODY_IDS = {"mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"}


def wait_for_result(client, job_id):
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        response = client.get(f"/api/v1/jobs/{job_id}")
        assert response.status_code == 200, response.text[:300]
        value = response.json()
        if value["state"] not in ("queued", "running"):
            assert value["state"] == "succeeded", value
            return value["result_id"]
        time.sleep(0.05)
    pytest.fail("Actual original-image worker did not finish within the test bound")


def context_for(scene):
    return {
        "selected_object_id": "epsilon-indi-b",
        "model_epoch": scene["epoch"],
        "camera": {
            "position": [32.5, 18.0, -22.1],
            "target": [7.0, 0.8, -3.0],
            "representation_version": "solar-display-v1",
        },
        "panel_open": True,
        "source_manifest_sha256": scene["source_manifest_sha256"],
        "orbit_manifest_sha256": scene["orbit_manifest_sha256"],
        "show_orbits": False,
        "timeline_algorithm_version": "display-hermite-v1",
        "playback_rate_hours_per_second": 24,
        "playback_paused": True,
        "follow_object_id": "epsilon-indi-b",
    }


@pytest.fixture(scope="module")
def timeline_api(tmp_path_factory):
    with TestClient(create_app(tmp_path_factory.mktemp("timeline-api"))) as client:
        response = client.get("/api/v1/timeline")
        assert response.status_code == 200, response.text[:300]
        timeline = response.json()
        response = client.get("/api/v1/universe", params={"epoch": MIDPOINT})
        assert response.status_code == 200, response.text[:300]
        scene = response.json()
        requested = client.post("/api/v1/comparison-jobs", json={"observation_ids": ["S01", "S02"]})
        assert requested.status_code == 202, requested.text[:300]
        result_id = wait_for_result(client, requested.json()["job_id"])
        result = client.get(f"/api/v1/comparisons/{result_id}/manifest").json()
        body = {
            "result_id": result_id,
            "session": {
                "object_id": "epsilon-indi-b",
                "observation_ids": ["S01", "S02"],
                "active_frame": "B",
                "view_mode": "split",
                "contrast": 1.4,
                "locale": "fr",
                "universe_context": context_for(scene),
            },
            "judgment": "The model moves; original DATE-AVG, quality and association remain unchanged.",
        }
        saved = client.post("/api/v1/evidence", json=body)
        assert saved.status_code == 201, saved.text[:300]
        yield client, timeline, scene, result, saved.json()


def test_timeline_four_original_knots_have_explicit_scientific_scope(timeline_api):
    _, timeline, _, _, _ = timeline_api
    assert timeline["algorithm_version"] == "display-hermite-v1"
    assert timeline["time_coordinate"] == "TDB"
    assert timeline["display_time_scale"] == "UTC"
    assert timeline["units"] == {"position": "au", "velocity": "au/day"}
    assert timeline["source_manifest_sha256"] == hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    assert timeline["start_epoch"] == "2026-11-13T00:00:00Z"
    assert timeline["end_epoch"] == "2026-11-16T00:00:00Z"
    assert timeline["guide_reference_epoch"] == GUIDE_EPOCH
    assert len(timeline["knots"]) == 4
    assert all(set(knot["states"]) == BODY_IDS for knot in timeline["knots"])
    assert all(
        len(knot["states"][body][key]) == 3
        for knot in timeline["knots"]
        for body in BODY_IDS
        for key in ("position_au", "velocity_au_day")
    )
    assert all(a["tdb_jd"] < b["tdb_jd"] for a, b in zip(timeline["knots"], timeline["knots"][1:]))
    assert timeline["validation"]["sample_count"] == 27
    assert "not a global bound" in timeline["validation"]["scope"]
    assert len(timeline["timeline_validation_sha256"]) == 64


def test_exact_knots_remain_exact_while_guides_keep_their_reference_epoch(timeline_api):
    client, timeline, _, _, _ = timeline_api
    for knot in timeline["knots"]:
        response = client.get("/api/v1/universe", params={"epoch": knot["epoch"]})
        assert response.status_code == 200, response.text[:300]
        scene = response.json()
        assert scene["position_sampling"] == "source_exact"
        assert scene["guide_reference_epoch"] == GUIDE_EPOCH
        for body in scene["objects"]:
            if body["object_id"] in BODY_IDS:
                assert body["position_au"] == knot["states"][body["object_id"]]["position_au"]
                assert (
                    body["velocity_au_day"] == knot["states"][body["object_id"]]["velocity_au_day"]
                )
                assert body["orbit"]["epoch"] == GUIDE_EPOCH
            else:
                assert body.get("orbit") is None


@pytest.mark.parametrize(
    "epoch",
    [
        "2026-11-12T23:59:59.999Z",
        "2026-11-16T00:00:00.001Z",
        "2026-11-14T12:00:00",
        "not-a-time",
        "",
    ],
)
def test_timeline_has_no_extrapolation_or_implicit_timezone(timeline_api, epoch):
    client, _, _, _, _ = timeline_api
    response = client.get("/api/v1/universe", params={"epoch": epoch})
    assert response.status_code == 422, response.text[:300]
    assert response.json()["message_key"]


def test_model_playback_never_changes_actual_original_result(timeline_api):
    client, _, _, result, saved = timeline_api
    for epoch in ("2026-11-13T01:02:03.456Z", MIDPOINT, "2026-11-15T23:59:59.999Z"):
        response = client.get("/api/v1/universe", params={"epoch": epoch})
        assert response.status_code == 200, response.text[:300]
        scene = response.json()
        assert scene["position_sampling"] == "display_interpolation"
        assert scene["interpolation"]["algorithm_version"] == "display-hermite-v1"
        assert 0 < scene["interpolation"]["fraction"] < 1
        assert scene["supported_time_range"]["extrapolation"] is False
        actual = client.get(f"/api/v1/comparisons/{result['result_id']}/manifest")
        assert actual.json() == result
    exported = client.get(f"/api/v1/evidence/{saved['evidence_id']}/export").json()
    assert exported == saved
    assert exported["comparison"]["frames"][0]["metadata"]["date_avg"] == "2025-04-30T02:06:28.716"
    assert exported["comparison"]["frames"][1]["metadata"]["date_avg"] == "2026-09-23T17:21:46.185"


@pytest.mark.parametrize(
    "key,value",
    [
        ("playback_rate_hours_per_second", 3),
        ("playback_rate_hours_per_second", 0),
        ("playback_paused", False),
        ("timeline_algorithm_version", "unknown-hermite-v999"),
        ("follow_object_id", "earth"),
    ],
)
def test_saved_playback_contract_rejects_inconsistent_state(timeline_api, key, value):
    client, _, _, result, saved = timeline_api
    session = deepcopy(saved["session"])
    session["universe_context"][key] = value
    response = client.post(
        "/api/v1/evidence",
        json={
            "result_id": result["result_id"],
            "session": session,
            "judgment": "invalid timeline snapshot",
        },
    )
    assert response.status_code == 422, response.text[:300]


def test_legacy_context_does_not_silently_adopt_continuous_interpolation(timeline_api):
    client, _, _, result, saved = timeline_api
    session = deepcopy(saved["session"])
    context = session["universe_context"]
    for key in (
        "timeline_algorithm_version",
        "playback_rate_hours_per_second",
        "playback_paused",
        "follow_object_id",
    ):
        context.pop(key, None)
    body = {
        "result_id": result["result_id"],
        "session": session,
        "judgment": "legacy exact knots only",
    }
    response = client.post("/api/v1/evidence", json=body)
    assert response.status_code == 422, response.text[:300]
    context["model_epoch"] = GUIDE_EPOCH
    response = client.post("/api/v1/evidence", json=body)
    assert response.status_code == 201, response.text[:300]
    imported = client.post("/api/v1/evidence/import", json=response.json())
    assert imported.status_code == 200, imported.text[:300]
    assert imported.json()["status"] == "restored"


def test_legacy_nondefault_guide_cannot_silently_change_its_reference_event(timeline_api):
    client, _, _, _, saved = timeline_api
    legacy = deepcopy(saved)
    context = legacy["session"]["universe_context"]
    for key in (
        "timeline_algorithm_version",
        "playback_rate_hours_per_second",
        "playback_paused",
        "follow_object_id",
    ):
        context.pop(key, None)
    context["model_epoch"] = "2026-11-15T00:00:00Z"
    response = client.post("/api/v1/evidence/import", json=legacy)
    assert response.status_code == 200, response.text[:300]
    restored = response.json()
    assert restored["status"] == "recalculation_required"
    assert "orbit_guide_reference_changed" in restored["reasons"]
    assert restored["comparison"] is None
    # Earlier evidence that did not record an orbit layer makes no old-epoch
    # guide claim; its exact original state and comparison remain restorable.
    context.pop("orbit_manifest_sha256")
    response = client.post("/api/v1/evidence/import", json=legacy)
    assert response.status_code == 200, response.text[:300]
    assert response.json()["status"] == "restored"


def test_continuous_time_rate_camera_and_original_survive_api_restart(timeline_api, tmp_path):
    _, _, _, result, saved = timeline_api
    atomic_json(tmp_path / "comparisons" / f"{result['result_id']}.json", result)
    with TestClient(create_app(tmp_path)) as before:
        response = before.post(
            "/api/v1/evidence",
            json={
                "result_id": result["result_id"],
                "session": saved["session"],
                "judgment": saved["judgment"],
            },
        )
        assert response.status_code == 201, response.text[:300]
        persisted = response.json()
    with TestClient(create_app(tmp_path)) as after:
        exported = after.get(f"/api/v1/evidence/{persisted['evidence_id']}/export")
        assert exported.json() == persisted
        response = after.post("/api/v1/evidence/import", json=exported.json())
        assert response.status_code == 200, response.text[:300]
        restored = response.json()
        assert restored["status"] == "restored"
        assert restored["session"] == persisted["session"]
        context = restored["session"]["universe_context"]
        assert context["model_epoch"] == MIDPOINT
        assert context["timeline_algorithm_version"] == "display-hermite-v1"
        assert context["playback_rate_hours_per_second"] == 24
        assert context["playback_paused"] is True
        assert context["follow_object_id"] == "epsilon-indi-b"
        assert restored["comparison"] == result
        assert restored["judgment"] == saved["judgment"]
