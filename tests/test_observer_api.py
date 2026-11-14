"""Observed redshifts stay fixed while observer hypotheses round-trip as separate state."""

import hashlib
from copy import deepcopy
from itertools import pairwise
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import create_app
from api.storage import atomic_json, digest
from science.spherex import build_comparison

ROOT = Path(__file__).resolve().parents[1]
BLACK_HOLE_IDS = {
    "member-mw-sagittarius-a",
    "member-m87-black-hole",
    "member-centaurus-a-nucleus",
    "black-hole-cygnus-x1",
    "black-hole-gaia-bh1",
    "black-hole-gaia-bh2",
    "black-hole-gaia-bh3",
    "member-m33-x7",
    "member-m81-nucleus",
    "member-m51-nucleus",
    "member-m104-nucleus",
}
GALAXY_IDS = {
    "galaxy-m31",
    "galaxy-m33",
    "galaxy-m81",
    "galaxy-m87",
    "galaxy-lmc",
    "galaxy-smc",
    "galaxy-m51",
    "galaxy-m104",
    "galaxy-centaurus-a",
}
COSMIC_IDS = {
    "cosmic_gems_clusters",
    "firefly_sparkle_assembly",
    "ceers_projected_shapes",
    "rebels25_rotating_disc",
    "zs7_ongoing_merger",
}
OBSERVER_STATE = {
    "enabled": True,
    "mode": "black_hole_local",
    "radial_beta": -0.4,
    "emitted_wavelength_nm": 980,
    "cosmological_enabled": False,
    "gravitational_enabled": True,
    "emitter_radius_rs": 6,
    "local_observer_radius_rs": 12.5,
    "local_observer_azimuth_rad": 0.75,
}


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    with TestClient(create_app(tmp_path_factory.mktemp("observer-api"))) as value:
        yield value


@pytest.fixture(scope="module")
def sources(client):
    result = {}
    for name in ("black-holes", "observer-physics"):
        response = client.get("/api/v1/" + name)
        assert response.status_code == 200, response.text[:300]
        result[name] = response.json()
    return result


@pytest.fixture(scope="module")
def actual_result():
    # One real comparison for this module, never an ignored runtime/cache fixture.
    result = build_comparison(ROOT)
    result["result_id"] = "cmp_" + digest(result)[:24]
    return result


@pytest.fixture(scope="module")
def saved_evidence(client, sources, actual_result):
    atomic_json(
        client.app.state.service.state / "comparisons" / f"{actual_result['result_id']}.json",
        actual_result,
    )
    response = client.get("/api/v1/universe")
    assert response.status_code == 200, response.text[:300]
    scene = response.json()
    response = client.post(
        "/api/v1/evidence",
        json={
            "result_id": actual_result["result_id"],
            "session": {
                "object_id": "epsilon-indi-b",
                "observation_ids": ["S01", "S02"],
                "active_frame": "B",
                "view_mode": "split",
                "contrast": 1.4,
                "locale": "fr",
                "universe_context": {
                    "selected_object_id": "epsilon-indi-b",
                    "model_epoch": scene["epoch"],
                    "source_manifest_sha256": scene["source_manifest_sha256"],
                    "camera": {
                        "position": [32.5, 18.0, -22.1],
                        "target": [7.0, 0.8, -3.0],
                        "representation_version": "solar-display-v1",
                    },
                    "observer_physics_manifest_sha256": sources["observer-physics"][
                        "source_manifest_sha256"
                    ],
                    "black_holes_manifest_sha256": sources["black-holes"]["source_manifest_sha256"],
                    "observer_experiment": OBSERVER_STATE,
                    "observer_panel_open": True,
                    "selected_black_hole_id": "member-m87-black-hole",
                },
            },
            "judgment": "Observer hypothesis; archived observations and source z remain fixed.",
        },
    )
    assert response.status_code == 201, response.text[:300]
    return response.json()


def test_black_hole_api_preserves_real_identifiers_null_scales_and_actual_image_metadata(sources):
    value = sources["black-holes"]
    assert (
        value["source_manifest_sha256"]
        == hashlib.sha256((ROOT / "data/manifests/black_holes.json").read_bytes()).hexdigest()
    )
    assert value["coverage"] == {
        "black_holes": 11,
        "with_adopted_mass": 9,
        "with_observation_image": 2,
        "complete_census": False,
    }
    objects = value["objects"]
    assert set(objects) == BLACK_HOLE_IDS
    assert sum(row["mass_solar"] is not None for row in objects.values()) == 9
    assert {
        key for key, row in objects.items() if row["existing_universe_object_id"] is not None
    } == {key for key in BLACK_HOLE_IDS if key.startswith("member-")}
    assert all(
        row["object_id"] == key
        and row["existing_universe_object_id"] in (None, key)
        and row["classification_status"] == "source_identified_black_hole"
        and row["spin_dimensionless"] is None
        and row["surface_resolved"] is False
        for key, row in objects.items()
    )
    for identifier in ("member-m51-nucleus", "member-m104-nucleus"):
        assert objects[identifier]["mass_solar"] is None
        assert objects[identifier]["nonrotating_model"] is None
    assert all(
        row["nonrotating_model"]["spin_assumed"] == 0
        for row in objects.values()
        if row["mass_solar"] is not None
    )

    images = {key: row["image"] for key, row in objects.items() if row["image"] is not None}
    assert set(images) == {"member-mw-sagittarius-a", "member-m87-black-hole"}
    for image in images.values():
        raw = (ROOT / image["local_relative_path"]).read_bytes()
        assert image["bytes"] == len(raw) > 0
        assert image["sha256"] == hashlib.sha256(raw).hexdigest()
        assert image["url"].startswith("/observations/black-holes/")
        assert image["image_page_source"]["url"].startswith("https://www.eso.org/")
        assert image["resolved_url"].startswith("https://cdn.eso.org/")
        assert image["credit"] == "EHT Collaboration"
        assert image["license"] == "CC BY 4.0"
        assert image["license_url"].startswith("https://www.eso.org/")
        assert image["kind"] == "processed_radio_interferometric_observation_reconstruction"
        assert image["observation_year"] == 2017
        assert image["artist_concept"] is False
        assert image["surface_resolved"] is False
        assert image["bytes_modified_locally"] is False
        assert len(image["pixel_dimensions"]) == 2
        assert all(type(size) is int and size > 0 for size in image["pixel_dimensions"])


def test_observer_api_keeps_measured_negative_and_missing_redshifts_outside_flrw_table(sources):
    value = sources["observer-physics"]
    assert (
        value["source_manifest_sha256"]
        == hashlib.sha256((ROOT / "data/manifests/observer_physics.json").read_bytes()).hexdigest()
    )
    observations = value["source_redshifts"]
    assert set(observations) == GALAXY_IDS | COSMIC_IDS
    assert sum(row["measured_redshift"] is not None for row in observations.values()) == 10
    assert observations["galaxy-m31"]["measured_redshift"] == -0.000991
    assert observations["galaxy-m33"]["measured_redshift"] < 0
    assert observations["rebels25_rotating_disc"]["measured_redshift"] == 7.31
    for identifier in COSMIC_IDS - {"rebels25_rotating_disc"}:
        assert observations[identifier]["measured_redshift"] is None
        assert observations[identifier]["status"] == "not_adopted_from_selected_source"
    assert all(row["source"]["url"].startswith("https://") for row in observations.values())

    model = value["cosmology"]
    assert model["redshift_domain"] == [0, 20]
    assert model["h0_km_s_mpc"] == 67.66
    assert model["omega_m"] == 0.3111
    assert model["omega_lambda"] == 0.6889
    assert model["tcmb_k"] == 0
    assert "computational switch" in model["tcmb_setting_role"]
    assert model["physical_CMB_temperature_claimed"] is False
    assert model["radiation_neutrino_evolution_included"] is False
    assert model["is_full_astropy_planck18"] is False
    table = model["inverse_distance_table"]
    assert len(table) == 2049
    assert table[0] == {"z": 0, "comoving_distance_mpc": 0}
    assert table[-1]["z"] == 20
    assert all(
        left["z"] < right["z"] and left["comoving_distance_mpc"] < right["comoving_distance_mpc"]
        for left, right in pairwise(table)
    )
    assert value["camera_interpretation"]["derive_velocity_from_pan"] is False
    assert value["camera_interpretation"]["enlarged_moon_or_body_geometry_invertible"] is False


def test_observer_state_roundtrip_keeps_original_comparison_and_fixed_source_z(
    client, sources, actual_result, saved_evidence
):
    exported = client.get(f"/api/v1/evidence/{saved_evidence['evidence_id']}/export")
    assert exported.status_code == 200
    assert exported.json() == saved_evidence
    restored = client.post("/api/v1/evidence/import", json=exported.json())
    assert restored.status_code == 200, restored.text[:300]
    value = restored.json()
    assert value["status"] == "restored"
    assert value["reasons"] == []
    assert value["session"] == saved_evidence["session"]
    context = value["session"]["universe_context"]
    assert context["observer_experiment"] == OBSERVER_STATE
    assert context["selected_black_hole_id"] == "member-m87-black-hole"
    assert context["observer_panel_open"] is True
    assert value["comparison"] == actual_result
    assert value["judgment"] == saved_evidence["judgment"]
    assert value["comparison"]["frames"][0]["metadata"]["date_avg"] == ("2025-04-30T02:06:28.716")
    assert value["comparison"]["frames"][1]["metadata"]["date_avg"] == ("2026-09-23T17:21:46.185")
    for name in ("black-holes", "observer-physics"):
        response = client.get("/api/v1/" + name)
        assert response.status_code == 200
        assert response.json() == sources[name]


def test_observer_context_and_hashes_survive_fresh_api_process_state(
    actual_result, saved_evidence, tmp_path
):
    atomic_json(tmp_path / "comparisons" / f"{actual_result['result_id']}.json", actual_result)
    with TestClient(create_app(tmp_path)) as first:
        response = first.post(
            "/api/v1/evidence",
            json={
                "result_id": actual_result["result_id"],
                "session": saved_evidence["session"],
                "judgment": saved_evidence["judgment"],
            },
        )
        assert response.status_code == 201, response.text[:300]
        saved = response.json()
    with TestClient(create_app(tmp_path)) as fresh:
        response = fresh.get(f"/api/v1/evidence/{saved['evidence_id']}/export")
        assert response.status_code == 200
        assert response.json() == saved
        restored = fresh.post("/api/v1/evidence/import", json=response.json())
        assert restored.status_code == 200, restored.text[:300]
        assert restored.json()["status"] == "restored"
        assert restored.json()["session"] == saved["session"]
        assert restored.json()["comparison"] == actual_result


@pytest.mark.parametrize(
    "key,reason",
    [
        ("observer_physics_manifest_sha256", "observer_physics_sources_changed"),
        ("black_holes_manifest_sha256", "black_hole_sources_changed"),
    ],
)
def test_changed_observer_source_hash_blocks_save_and_requires_recalculation_on_import(
    client, saved_evidence, key, reason
):
    changed = deepcopy(saved_evidence)
    changed["session"]["universe_context"][key] = "f" * 64
    rejected = client.post(
        "/api/v1/evidence",
        json={name: changed[name] for name in ("result_id", "session", "judgment")},
    )
    assert rejected.status_code == 422
    assert rejected.json()["code"] == "invalid_universe_context"
    response = client.post("/api/v1/evidence/import", json=changed)
    assert response.status_code == 200, response.text[:300]
    restored = response.json()
    assert restored["status"] == "recalculation_required"
    assert reason in restored["reasons"]
    assert restored["comparison"] is None
    assert restored["session"]["universe_context"]["observer_experiment"] == OBSERVER_STATE
    assert restored["judgment"] == saved_evidence["judgment"]
    assert client.get(f"/api/v1/evidence/{saved_evidence['evidence_id']}/export").json() == (
        saved_evidence
    )


def test_unknown_black_hole_cannot_be_saved_or_silently_restored(client, saved_evidence):
    changed = deepcopy(saved_evidence)
    changed["session"]["universe_context"]["selected_black_hole_id"] = "black-hole-not-catalogued"
    response = client.post(
        "/api/v1/evidence",
        json={name: changed[name] for name in ("result_id", "session", "judgment")},
    )
    assert response.status_code == 422
    assert response.json()["code"] == "invalid_universe_context"
    response = client.post("/api/v1/evidence/import", json=changed)
    assert response.status_code == 200, response.text[:300]
    value = response.json()
    assert value["status"] == "recalculation_required"
    assert "unsupported_black_hole_selection" in value["reasons"]
    assert value["comparison"] is None
    assert value["session"]["universe_context"]["selected_black_hole_id"] == (
        "black-hole-not-catalogued"
    )


@pytest.mark.parametrize(
    "changes",
    [
        {
            "radial_beta": -0.99,
            "emitted_wavelength_nm": 0.001,
            "emitter_radius_rs": 1.01,
            "local_observer_radius_rs": 1e6,
            "local_observer_azimuth_rad": -1e6,
        },
        {
            "radial_beta": 0.99,
            "emitted_wavelength_nm": 1e9,
            "emitter_radius_rs": 1e6,
            "local_observer_radius_rs": 1.01,
            "local_observer_azimuth_rad": 1e6,
        },
    ],
)
def test_observer_api_accepts_closed_ui_domain_boundaries(client, saved_evidence, changes):
    changed = deepcopy(saved_evidence)
    expected = OBSERVER_STATE | changes
    changed["session"]["universe_context"]["observer_experiment"] = expected
    response = client.post("/api/v1/evidence/import", json=changed)
    assert response.status_code == 200, response.text[:300]
    assert response.json()["status"] == "restored"
    assert response.json()["session"]["universe_context"]["observer_experiment"] == expected


@pytest.mark.parametrize(
    "key,value",
    [
        ("radial_beta", -0.990001),
        ("radial_beta", 0.990001),
        ("radial_beta", "NaN"),
        ("emitted_wavelength_nm", 0.000999),
        ("emitted_wavelength_nm", 1e9 + 1),
        ("emitted_wavelength_nm", "Infinity"),
        ("emitter_radius_rs", 1.009999),
        ("emitter_radius_rs", 1e6 + 1),
        ("local_observer_radius_rs", 1),
        ("local_observer_radius_rs", 1e6 + 1),
        ("local_observer_azimuth_rad", -1e6 - 1),
        ("local_observer_azimuth_rad", 1e6 + 1),
        ("mode", "physical_camera_trajectory"),
        ("unknown_physics_parameter", 1),
    ],
)
def test_observer_api_rejects_out_of_domain_nonfinite_and_unsupported_state(
    client, saved_evidence, key, value
):
    changed = deepcopy(saved_evidence)
    changed["session"]["universe_context"]["observer_experiment"][key] = value
    response = client.post("/api/v1/evidence/import", json=changed)
    assert response.status_code == 422, response.text[:300]
    assert response.json()["code"] == "invalid_request"
    assert response.json()["message_key"] and response.json()["request_id"]


@pytest.mark.parametrize("key", ["observer_physics_manifest_sha256", "black_holes_manifest_sha256"])
def test_observer_hypotheses_and_black_hole_selection_require_their_source_hashes(
    client, saved_evidence, key
):
    changed = deepcopy(saved_evidence)
    del changed["session"]["universe_context"][key]
    response = client.post("/api/v1/evidence/import", json=changed)
    assert response.status_code == 422
    assert response.json()["code"] == "invalid_request"


@pytest.mark.parametrize(
    "endpoint,reader,error_code",
    [
        ("black-holes", "get_black_holes", "black_hole_source_unavailable"),
        ("observer-physics", "get_observer_physics", "observer_physics_source_unavailable"),
    ],
)
def test_source_integrity_failure_is_structured_unavailable_and_blocks_restoration(
    client, saved_evidence, monkeypatch, endpoint, reader, error_code
):
    import science.relativity

    def unavailable(*args, **kwargs):
        raise ValueError("source_integrity_failed")

    monkeypatch.setattr(science.relativity, reader, unavailable)
    response = client.get("/api/v1/" + endpoint)
    assert response.status_code == 503, response.text[:300]
    assert response.json()["code"] == error_code
    assert response.json()["message_key"] and response.json()["request_id"]
    response = client.post("/api/v1/evidence/import", json=saved_evidence)
    assert response.status_code == 200, response.text[:300]
    assert response.json()["status"] == "recalculation_required"
    assert "observer_physics_data_unavailable" in response.json()["reasons"]
    assert response.json()["comparison"] is None
