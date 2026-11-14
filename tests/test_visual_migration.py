"""Display-reference migration must preserve typed observation and hypothesis values.

These small tests use the adopted, byte-verified migration records and real
Session models. They neither rebuild FITS comparisons nor claim HTTP/FITS QA.
"""

import hashlib
from copy import deepcopy
from pathlib import Path

import pytest

from api.main import migrate_solar_session
from api.models import Session
from science.display_compatibility import resolve_display_compatibility, verified_migrations

ROOT = Path(__file__).resolve().parents[1]


def source_hash(name):
    return hashlib.sha256((ROOT / "data/manifests" / name).read_bytes()).hexdigest()


@pytest.fixture(scope="module")
def verified_references():
    records = verified_migrations(ROOT)
    assert {record["field"] for record in records} == {
        "small_body_appearance_manifest_sha256",
        "mass_scenarios_manifest_sha256",
    }
    return records


def real_session(**context_changes):
    context = {
        "selected_object_id": "pluto",
        "model_epoch": "2026-11-14T00:00:00Z",
        "source_manifest_sha256": source_hash("solar_system_ephemeris.json"),
        "orbit_manifest_sha256": source_hash("solar_system_orbits.json"),
        "planet_criteria_manifest_sha256": source_hash("planet_criteria.json"),
        "extended_solar_manifest_sha256": source_hash("extended_solar.json"),
        "timeline_algorithm_version": "display-hermite-v1",
        "time_preference": "auto",
        "camera": {"position": [32.5, 18.0, -22.1], "target": [7.0, 0.8, -3.0]},
        "follow_object_id": "pluto",
        "show_kuiper_belt": True,
        "show_outer_tno": True,
        "scene_filter": "all",
        "render_preset": "balanced",
        "appearance_lighting": "inspection",
        **context_changes,
    }
    return Session.model_validate(
        {
            "object_id": "pluto",
            "observation_ids": ["S12", "S14"],
            "active_frame": "B",
            "view_mode": "blink",
            "contrast": 1.4,
            "locale": "fr",
            "universe_context": context,
        }
    )


def test_old_map_reference_is_explicitly_omitted_without_changing_observation_or_input():
    current = source_hash("appearance.json")
    old = "a" * 64
    assert current != old
    session = real_session(appearance_manifest_sha256=old)
    before = deepcopy(session.model_dump())

    active, exported_session, omitted = migrate_solar_session(session, current)

    assert session.model_dump() == before
    assert active.universe_context.appearance_manifest_sha256 is None
    assert "appearance_manifest_sha256" not in exported_session["universe_context"]
    assert omitted == [
        {
            "feature": "appearance",
            "paths": ["universe_context.appearance_manifest_sha256"],
            "reason": "visual_sources_updated_observation_preserved",
        }
    ]
    after = active.model_dump()
    after["universe_context"]["appearance_manifest_sha256"] = old
    assert after == before


def test_exact_verified_dependency_refresh_preserves_mass_hypothesis_and_scientific_hashes(
    verified_references,
):
    original_hashes = {
        name: source_hash(name)
        for name in (
            "small_body_appearance.json",
            "mass_scenarios.json",
            "planet_criteria.json",
            "solar_system_ephemeris.json",
        )
    }
    hypothesis = {
        "target_id": "sedna",
        "density_kg_m3": 1984.125,
        "analogue_id": "tethys",
        "include_source_ranges": False,
    }
    session = real_session(
        **{item["field"]: item["from_sha256"] for item in verified_references},
        mass_scenario=hypothesis,
    )
    before = deepcopy(session.model_dump())

    active, value, omitted = migrate_solar_session(
        session, source_hash("appearance.json"), verified_references
    )

    assert session.model_dump() == before
    assert active.universe_context.mass_scenario.model_dump() == hypothesis
    assert value["universe_context"]["mass_scenario"] == hypothesis
    assert {item["feature"] for item in omitted} == {"small_body_appearance", "mass_scenarios"}
    assert all(
        item["reason"] == "display_dependency_refreshed_scientific_values_identical"
        for item in omitted
    )
    expected = deepcopy(before)
    for item in verified_references:
        expected["universe_context"][item["field"]] = item["to_sha256"]
        assert getattr(active.universe_context, item["field"]) == item["to_sha256"]
    assert active.model_dump() == expected
    assert {name: source_hash(name) for name in original_hashes} == original_hashes


def test_unknown_reference_pair_is_not_rebound_or_dropped(verified_references):
    field = "mass_scenarios_manifest_sha256"
    current = next(item["to_sha256"] for item in verified_references if item["field"] == field)
    unknown = "f" * 64
    assert resolve_display_compatibility(ROOT, field, unknown, current) is None
    session = real_session(
        mass_scenarios_manifest_sha256=unknown,
        mass_scenario={"target_id": "sedna", "density_kg_m3": 2000},
    )
    before = deepcopy(session.model_dump())

    active, _, omitted = migrate_solar_session(session, source_hash("appearance.json"))

    assert active.model_dump() == before
    assert session.model_dump() == before
    assert omitted == []


def test_current_references_remain_current_and_unrelated_hashes_cannot_migrate(
    verified_references,
):
    current = source_hash("appearance.json")
    session = real_session(
        appearance_manifest_sha256=current,
        **{item["field"]: item["to_sha256"] for item in verified_references},
    )
    before = deepcopy(session.model_dump())
    unrelated = {
        "field": "planet_criteria_manifest_sha256",
        "from_sha256": session.universe_context.planet_criteria_manifest_sha256,
        "to_sha256": "f" * 64,
    }

    active, _, omitted = migrate_solar_session(
        session, current, [*verified_references, unrelated]
    )

    assert active.model_dump() == before
    assert session.model_dump() == before
    assert omitted == []


def test_observation_only_session_does_not_gain_a_synthetic_scene(verified_references):
    session = Session(observation_ids=["S01", "S02"], locale="zh-Hant")
    before = deepcopy(session.model_dump())

    active, value, omitted = migrate_solar_session(
        session, source_hash("appearance.json"), verified_references
    )

    assert active.model_dump() == session.model_dump() == before
    assert "universe_context" not in value
    assert omitted == []
