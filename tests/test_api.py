import time

import pytest
from fastapi.testclient import TestClient

from api.main import create_app
from api.storage import atomic_json, digest


def wait_job(client, job):
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        result = client.get("/api/v1/jobs/" + job["job_id"]).json()
        if result["state"] not in ("queued", "running"):
            return result
        time.sleep(0.1)
    pytest.fail("Worker did not finish")


@pytest.fixture(scope="module")
def completed(tmp_path_factory):
    state = tmp_path_factory.mktemp("state")
    with TestClient(create_app(state)) as client:
        job = client.post("/api/v1/comparison-jobs", json={"observation_ids": ["S01", "S02"]})
        assert job.status_code == 202
        final = wait_job(client, job.json())
        assert final["state"] == "succeeded", final
        result = client.get("/api/v1/comparisons/" + final["result_id"] + "/manifest").json()
        yield client, state, result


def test_real_save_export_restore_and_rejection(completed):
    client, _, result = completed
    session = {
        "object_id": "epsilon-indi-b",
        "observation_ids": ["S01", "S02"],
        "active_frame": "B",
        "view_mode": "blink",
        "contrast": 1.5,
        "locale": "zh-Hant",
    }
    saved = client.post(
        "/api/v1/evidence",
        json={
            "result_id": result["result_id"],
            "session": session,
            "judgment": "判定保留 · source ≠ identification",
        },
    )
    assert saved.status_code == 201, saved.text
    evidence = saved.json()
    raw = client.get("/api/v1/evidence/" + evidence["evidence_id"] + "/export")
    assert raw.json() == evidence
    restored = client.post("/api/v1/evidence/import", json=evidence)
    assert restored.status_code == 200, restored.text
    assert restored.json()["status"] == "restored"
    assert restored.json()["session"] == session
    assert restored.json()["comparison"] == result
    assert restored.json()["judgment"] == evidence["judgment"]
    csv = client.get("/api/v1/evidence/" + evidence["evidence_id"] + "/export?format=csv")
    assert csv.status_code == 200 and "S01" in csv.text and "S02" in csv.text
    evidence["comparison"]["frames"][0]["cutout"]["IMAGE"][0][0] = -123456789
    assert client.post("/api/v1/evidence/import", json=evidence).status_code == 409


def test_no_data_validation_and_traversal(completed):
    client, _, _result = completed
    for object_id in ("barnards-star", "wise0855", "rw-aurigae", "r-draconis"):
        body = client.get("/api/v1/observations", params={"object_id": object_id}).json()
        assert body["status"] == "unverified" and body["observations"] == []
        assert body["available_sources"]
    assert (
        client.post("/api/v1/comparison-jobs", json={"observation_ids": ["S01", "S01"]}).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/comparison-jobs", json={"observation_ids": ["../x", "S02"]}
        ).status_code
        == 422
    )
    assert client.get("/api/v1/comparisons/cmp_bad/manifest").status_code == 404
    response = client.post("/api/v1/evidence/import", json={"schema_version": "99"})
    assert response.status_code == 422 and response.json()["message_key"]
    assert client.post("/api/v1/evidence/import", content=b"x" * 8_000_001).status_code == 413


def test_result_corruption_not_restored(completed):
    client, state, result = completed
    changed = dict(result, scientific_status="fabricated")
    target = state / "comparisons" / (result["result_id"] + ".json")
    atomic_json(target, changed)
    assert client.get("/api/v1/comparisons/" + result["result_id"] + "/manifest").status_code == 409
    atomic_json(target, result)


def test_cancel_queued_and_restart(completed, tmp_path):
    client, _, _ = completed
    # Hold API writer serialization while enqueueing then cancelling a queued job.
    svc = client.app.state.service
    with svc.guard:
        job = svc.submit(["S01", "S02"])
        cancelled = svc.cancel(job["job_id"])
    assert cancelled["state"] == "cancelled"
    interrupted_id = "job_" + "a" * 32
    atomic_json(
        tmp_path / "jobs" / (interrupted_id + ".json"),
        {"job_id": interrupted_id, "state": "running"},
    )
    with TestClient(create_app(tmp_path)) as other:
        recovered = other.get("/api/v1/jobs/" + interrupted_id).json()
        assert recovered["state"] == "interrupted"


def test_nonfinite_json_rejected():
    with pytest.raises(ValueError):
        digest({"value": float("nan")})
