"""HTTP contracts distinguish empty confirmed collections from failed evidence."""

import pytest
from fastapi.testclient import TestClient

from api.main import create_app
from api.models import SimulationContext, UniverseContext


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    with TestClient(create_app(tmp_path_factory.mktemp("catalog-evidence"))) as value:
        yield value


def test_small_body_profile_http_retains_actual_maps_and_unresolved_shape_limits(client):
    response = client.get("/api/v1/small-body-appearance")
    assert response.status_code == 200, response.text
    data = response.json()
    assert set(data["profiles"]) == {
        "ceres",
        "haumea",
        "makemake",
        "eris",
        "sedna",
        "quaoar",
        "orcus",
        "gonggong",
    }
    assert data["profiles"]["ceres"]["surface_resolved"] is True
    assert data["profiles"]["ceres"]["preserve_existing_map"] is True
    assert sum(profile["surface_resolved"] is False for profile in data["profiles"].values()) == 7
    assert data["profiles"]["sedna"]["shape_axis_ratios"] is None
    assert len(data["profiles"]["haumea"]["rings"]) == 1
    assert len(data["profiles"]["quaoar"]["rings"]) == 2


def test_planet_criteria_keeps_policy_and_unknown_dynamical_quantities_separate(client):
    response = client.get("/api/v1/planet-criteria")
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data["objects"]) == 17
    sedna = data["objects"]["sedna"]
    assert sedna["official_classification"] == "dwarf_candidate"
    assert sedna["mass"]["earth_masses"] is None and sedna["clearing"]["pi"] is None
    assert sedna["clearing"]["minimum_mass_earth"] > 0
    states = {row["id"]: row["status"] for row in sedna["criteria"]}
    assert states == {
        "orbits_sun": "met",
        "equilibrium_shape": "unknown",
        "orbital_dominance": "unknown",
    }
    earth = client.get("/api/v1/planet-criteria?object_id=earth")
    assert earth.status_code == 200 and set(earth.json()["objects"]) == {"earth"}
    assert client.get("/api/v1/planet-criteria?object_id=moon-301").status_code == 422


@pytest.mark.parametrize("unavailable", [FileNotFoundError, ValueError])
@pytest.mark.parametrize(
    "module,function,path",
    [
        ("science.small_body_appearance", "get_small_body_appearance", "small-body-appearance"),
        ("science.planet_criteria", "get_planet_criteria", "planet-criteria"),
    ],
)
def test_source_failure_is_not_reported_as_an_empty_collection(
    client, monkeypatch, unavailable, module, function, path
):
    import importlib

    def failure(*args, **kwargs):
        raise unavailable("integrity_failed")

    monkeypatch.setattr(importlib.import_module(module), function, failure)
    response = client.get(
        "/api/v1/"
        + ("" if path in {"small-body-appearance", "planet-criteria"} else "catalog/")
        + path
    )
    assert response.status_code == 503
    assert response.json()["request_id"]


@pytest.mark.parametrize("rate", [1, 6, 24, 72, 8766, 87660, 876600])
def test_unified_clock_rates_round_trip_in_both_existing_context_fields(rate):
    simulation = SimulationContext(
        algorithm_version="jpl-kepler-long-term-v1",
        source_manifest_sha256="a" * 64,
        model_calendar_ms=0,
        playback_rate_hours_per_second=rate,
    )
    context = UniverseContext(
        selected_object_id="epsilon-indi-b",
        model_epoch="2026-11-14T00:00:00Z",
        source_manifest_sha256="a" * 64,
        playback_rate_hours_per_second=rate,
        simulation_context=simulation,
        time_preference="auto",
        small_body_appearance_manifest_sha256="b" * 64,
    )
    restored = UniverseContext.model_validate_json(context.model_dump_json())
    assert restored.playback_rate_hours_per_second == rate
    assert restored.simulation_context.playback_rate_hours_per_second == rate
    assert restored.time_preference == "auto"
    assert restored.small_body_appearance_manifest_sha256 == "b" * 64


@pytest.mark.parametrize("preference,simulation", [("simulation", None), ("ephemeris", True)])
def test_inconsistent_explicit_time_source_is_rejected(preference, simulation):
    from pydantic import ValidationError

    fitted = {
        "algorithm_version": "jpl-kepler-long-term-v1",
        "source_manifest_sha256": "a" * 64,
        "model_calendar_ms": 0,
    }
    with pytest.raises(ValidationError):
        UniverseContext(
            selected_object_id="epsilon-indi-b",
            model_epoch="2026-11-14T00:00:00Z",
            source_manifest_sha256="a" * 64,
            time_preference=preference,
            simulation_context=fitted if simulation else None,
        )
