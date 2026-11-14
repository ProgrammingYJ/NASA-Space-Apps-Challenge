"""Universe context and actual Pluto evidence must survive API boundaries honestly."""

import hashlib
import math
import time
from copy import deepcopy
from pathlib import Path

import pytest
from astropy.time import Time
from fastapi.testclient import TestClient

from api.main import create_app
from api.storage import atomic_json, read_json

ROOT = Path(__file__).resolve().parents[1]
SCENE_PATH = "data/manifests/solar_system_ephemeris.json"
PLUTO_PATH = "data/manifests/pluto_ephemeris.json"
ORBIT_PATH = "data/manifests/solar_system_orbits.json"


def await_job(client, job_id):
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        response = client.get(f"/api/v1/jobs/{job_id}")
        assert response.status_code == 200
        value = response.json()
        if value["state"] not in ("queued", "running"):
            return value
        time.sleep(0.05)
    pytest.fail("Actual Pluto worker did not finish within test bound")


def pluto_session(scene):
    return {
        "object_id": "pluto",
        "observation_ids": ["S12", "S14"],
        "active_frame": "B",
        "view_mode": "blink",
        "contrast": 1.4,
        "locale": "zh-Hant",
        "universe_context": {
            "selected_object_id": "pluto",
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
        },
    }


@pytest.fixture(scope="module")
def universe_api(tmp_path_factory):
    state = tmp_path_factory.mktemp("universe-api")
    with TestClient(create_app(state)) as client:
        scene_response = client.get("/api/v1/universe")
        assert scene_response.status_code == 200, scene_response.text
        scene = scene_response.json()
        requested = client.post("/api/v1/comparison-jobs", json={"observation_ids": ["S12", "S14"]})
        assert requested.status_code == 202, requested.text
        completed = await_job(client, requested.json()["job_id"])
        assert completed["state"] == "succeeded", completed
        result = client.get(f"/api/v1/comparisons/{completed['result_id']}/manifest").json()
        body = {
            "result_id": result["result_id"],
            "session": pluto_session(scene),
            "judgment": "Observer prediction and original pixels; motion remains unvalidated.",
        }
        saved_response = client.post("/api/v1/evidence", json=body)
        assert saved_response.status_code == 201, saved_response.text
        yield client, state, scene, result, saved_response.json()


def test_universe_supported_epochs_and_source_contract(universe_api):
    client, _, scene, _, _ = universe_api
    expected_ids = {
        "sun",
        "mercury",
        "venus",
        "earth",
        "mars",
        "jupiter",
        "saturn",
        "uranus",
        "neptune",
        "pluto",
        "epsilon-indi-b",
    }
    assert len(scene["available_epochs"]) == 4
    assert (
        scene["source_manifest_sha256"]
        == hashlib.sha256((ROOT / SCENE_PATH).read_bytes()).hexdigest()
    )
    assert (
        scene["orbit_manifest_sha256"]
        == hashlib.sha256((ROOT / ORBIT_PATH).read_bytes()).hexdigest()
    )
    for epoch in scene["available_epochs"]:
        response = client.get("/api/v1/universe", params={"epoch": epoch})
        assert response.status_code == 200, response.text
        value = response.json()
        assert value["epoch"] == epoch
        assert {body["object_id"] for body in value["objects"]} == expected_ids
        assert value["coordinate_frame"] == "Ecliptic of J2000.0"
        assert value["time_scale"] == "UTC"
        assert value["source_manifest_sha256"] == scene["source_manifest_sha256"]
        assert value["orbit_manifest_sha256"] == scene["orbit_manifest_sha256"]
        direction = next(body for body in value["objects"] if body["object_id"] == "epsilon-indi-b")
        assert direction["kind"] == "direction" and direction["distance_au"] is None
        assert direction.get("orbit") is None
        assert (
            next(body for body in value["objects"] if body["object_id"] == "sun").get("orbit")
            is None
        )
        guides = [body for body in value["objects"] if body.get("orbit") is not None]
        assert len(guides) == 9
        for body in guides:
            guide = body["orbit"]
            assert guide["kind"] == "osculating_kepler_guide"
            assert guide["coordinate_frame"] == "Ecliptic of J2000.0"
            assert guide["center"] == "Sun (10)"
            assert guide["units"] == "au" and guide["closed"] is True
            assert guide["epoch_tdb_jd"] == pytest.approx(Time(epoch, scale="utc").tdb.jd, abs=1e-8)
            points = guide["points_au"]
            assert len(points) == 257
            assert all(len(point) == 3 and all(math.isfinite(v) for v in point) for point in points)
            assert points[-1] == pytest.approx(points[0], abs=1e-12)
            # The independently acquired scene VECTORS were queried in UTC. The
            # guide ELEMENTS use the same event converted to TDB, not the UTC JD.
            assert points[0] == pytest.approx(body["position_au"], abs=1e-7)
            assert guide["limitations"]


def test_unsupported_model_epoch_has_input_error(universe_api):
    client, _, _, _, _ = universe_api
    response = client.get("/api/v1/universe", params={"epoch": "2020-01-01T00:00:00Z"})
    assert response.status_code == 422, response.text[:300]
    assert response.json()["message_key"]


@pytest.mark.parametrize(
    "camera",
    [
        {"position": [10000.1, 0, 0], "target": [0, 0, 0]},
        {"position": [9000, 9000, 0], "target": [0, 0, 0]},
        {"position": [0, 0, 0.04], "target": [0, 0, 0]},
        {"position": [1, 2, 3], "target": [1, 2, 3]},
        {"position": [1, 2], "target": [0, 0, 0]},
        {"position": [1, 2, 3], "target": [0, 0, 0], "representation_version": "unknown"},
    ],
)
def test_camera_display_bounds_are_validated(universe_api, camera):
    client, _, _, result, saved = universe_api
    session = deepcopy(saved["session"])
    session["universe_context"]["camera"] = camera
    response = client.post(
        "/api/v1/evidence",
        json={"result_id": result["result_id"], "session": session, "judgment": "test"},
    )
    assert response.status_code == 422, response.text[:300]


def test_context_selection_and_observation_pair_cannot_mix(universe_api):
    client, _, _, result, saved = universe_api
    session = deepcopy(saved["session"])
    session["universe_context"]["selected_object_id"] = "epsilon-indi-b"
    response = client.post(
        "/api/v1/evidence",
        json={"result_id": result["result_id"], "session": session, "judgment": "test"},
    )
    assert response.status_code == 422
    assert (
        client.post("/api/v1/comparison-jobs", json={"observation_ids": ["S01", "S14"]}).status_code
        == 422
    )


def test_scene_source_change_never_claims_restoration(universe_api):
    client, _, _, _, saved = universe_api
    changed = deepcopy(saved)
    changed["session"]["universe_context"]["source_manifest_sha256"] = "f" * 64
    response = client.post("/api/v1/evidence/import", json=changed)
    assert response.status_code == 200, response.text
    value = response.json()
    assert value["status"] == "recalculation_required"
    assert value["comparison"] is None
    assert value["reasons"]


def test_orbit_guide_source_change_never_claims_restoration(universe_api):
    client, _, _, _, saved = universe_api
    changed = deepcopy(saved)
    changed["session"]["universe_context"]["orbit_manifest_sha256"] = "f" * 64
    response = client.post("/api/v1/evidence/import", json=changed)
    assert response.status_code == 200, response.text[:300]
    value = response.json()
    assert value["status"] == "recalculation_required"
    assert value["comparison"] is None
    assert "orbit_ephemeris_changed" in value["reasons"]


def test_actual_pluto_ephemeris_snapshot_change_is_detected(universe_api, tmp_path):
    client, _, _, _, saved = universe_api
    # Change only a copied snapshot. No project original or actual observation is modified.
    atomic_json(
        tmp_path / "data/manifests/datasets.json", read_json(ROOT / "data/manifests/datasets.json")
    )
    atomic_json(tmp_path / PLUTO_PATH, {"changed_snapshot": True})
    atomic_json(tmp_path / SCENE_PATH, read_json(ROOT / SCENE_PATH))
    service = client.app.state.service
    actual_root = service.root
    try:
        service.root = tmp_path
        response = client.post("/api/v1/evidence/import", json=saved)
    finally:
        service.root = actual_root
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "recalculation_required"
    assert "ephemeris_changed" in response.json()["reasons"]
    assert response.json()["comparison"] is None


def test_pluto_context_and_original_result_survive_real_api_restart(universe_api, tmp_path):
    _, _, _, result, saved = universe_api
    atomic_json(tmp_path / "comparisons" / f"{result['result_id']}.json", result)
    body = {
        "result_id": result["result_id"],
        "session": deepcopy(saved["session"]),
        "judgment": saved["judgment"],
    }
    with TestClient(create_app(tmp_path)) as before:
        response = before.post("/api/v1/evidence", json=body)
        assert response.status_code == 201, response.text
        persisted = response.json()
    with TestClient(create_app(tmp_path)) as after:
        exported = after.get(f"/api/v1/evidence/{persisted['evidence_id']}/export")
        assert exported.json() == persisted
        restored = after.post("/api/v1/evidence/import", json=exported.json())
        assert restored.status_code == 200, restored.text
        value = restored.json()
        assert value["status"] == "restored"
        assert value["session"] == persisted["session"]
        assert value["comparison"] == result
        assert value["comparison"]["scientific_status"] == "association_insufficient"
        assert value["comparison"]["frames"][0]["prediction"]["source"]["observer_id"] == "-163182"
        assert value["judgment"] == saved["judgment"]
