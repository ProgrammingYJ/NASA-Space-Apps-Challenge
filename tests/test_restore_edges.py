"""Restore failures must preserve evidence and explain why recomputation is needed."""

from copy import deepcopy
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import create_app
from api.service import Service
from api.storage import atomic_json, digest, read_json
from science.spherex import build_comparison

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def actual_result():
    comparison = build_comparison(ROOT)
    comparison["result_id"] = "cmp_" + digest(comparison)[:24]
    return comparison


def evidence_for(comparison):
    return {
        "schema_version": "1.0",
        "evidence_id": "ev_" + "b" * 32,
        "created_at": "2026-11-14T01:51:00+00:00",
        "result_id": comparison["result_id"],
        "session": {
            "object_id": "epsilon-indi-b",
            "observation_ids": ["S01", "S02"],
            "active_frame": "B",
            "view_mode": "split",
            "contrast": 1.2,
            "locale": "fr",
        },
        "judgment": "Association insuffisante; conserver les conditions.",
        "comparison": comparison,
        "comparison_sha256": digest(comparison),
        "ai_assistance": "Code assisted by Codex; original observations unchanged.",
    }


def test_missing_original_is_recalculation_reason(actual_result, tmp_path):
    # Only the manifest is copied: the actual original files remain untouched.
    atomic_json(
        tmp_path / "data/manifests/datasets.json", read_json(ROOT / "data/manifests/datasets.json")
    )
    service = object.__new__(Service)
    service.root = tmp_path
    assert "source_missing" in service.verify_inputs(actual_result)


def test_changed_manifest_hash_is_explicit_reason(actual_result, tmp_path):
    manifest = read_json(ROOT / "data/manifests/datasets.json")
    for record in manifest["files"]:
        if record["id"] == "S10":
            record["sha256"] = "f" * 64
    atomic_json(tmp_path / "data/manifests/datasets.json", manifest)
    service = object.__new__(Service)
    service.root = tmp_path
    reasons = service.verify_inputs(actual_result)
    assert "source_manifest_changed" in reasons
    assert "source_missing" in reasons


def test_missing_local_result_does_not_claim_restored(actual_result, tmp_path):
    with TestClient(create_app(tmp_path)) as client:
        response = client.post("/api/v1/evidence/import", json=evidence_for(actual_result))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "recalculation_required"
    assert "result_missing" in body["reasons"]
    assert body["comparison"] is None
    assert body["session"]["active_frame"] == "B"
    assert body["judgment"] == evidence_for(actual_result)["judgment"]


def test_changed_algorithm_does_not_reuse_saved_science(actual_result, tmp_path):
    changed = deepcopy(actual_result)
    changed["algorithm_version"] = "spherex-native-prior-version"
    with TestClient(create_app(tmp_path)) as client:
        response = client.post("/api/v1/evidence/import", json=evidence_for(changed))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "recalculation_required"
    assert "algorithm_changed" in body["reasons"]
    assert body["comparison"] is None


def test_malformed_nested_comparison_has_structured_error(actual_result, tmp_path):
    changed = deepcopy(actual_result)
    changed["frames"] = ["invalid-frame"]
    with TestClient(create_app(tmp_path), raise_server_exceptions=False) as client:
        response = client.post("/api/v1/evidence/import", json=evidence_for(changed))
    assert response.status_code in (409, 422), response.text
    assert response.json()["message_key"]
    assert response.json()["request_id"]


def test_saved_evidence_survives_api_restart(actual_result, tmp_path):
    atomic_json(tmp_path / "comparisons" / f"{actual_result['result_id']}.json", actual_result)
    evidence = evidence_for(actual_result)
    with TestClient(create_app(tmp_path)) as first_session:
        response = first_session.post(
            "/api/v1/evidence",
            json={
                "result_id": evidence["result_id"],
                "session": evidence["session"],
                "judgment": evidence["judgment"],
            },
        )
        assert response.status_code == 201, response.text
        saved = response.json()

    with TestClient(create_app(tmp_path)) as new_session:
        exported = new_session.get(f"/api/v1/evidence/{saved['evidence_id']}/export")
        assert exported.status_code == 200
        assert exported.json() == saved
        restored = new_session.post("/api/v1/evidence/import", json=exported.json())
        assert restored.status_code == 200, restored.text
        assert restored.json()["status"] == "restored"
        assert restored.json()["comparison"] == actual_result
        assert restored.json()["session"] == saved["session"]
        assert restored.json()["judgment"] == saved["judgment"]
