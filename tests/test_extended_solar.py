"""Actual-catalog reconciliation and immutable parent-relative ephemeris checks."""

import copy
import json
from collections import Counter
from pathlib import Path

import numpy as np
import pytest

import science.extended_solar as extension

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def actual():
    return extension.get_extended_solar(ROOT)


def test_complete_discovery_catalog_is_distinct_from_mean_element_rows():
    raw = ROOT / extension.RAW_ROOT
    mean = extension.parse_moon_catalog((raw / "catalog.html").read_text(encoding="utf-8"))
    reconciled = extension.reconcile_discovery(
        mean, (raw / "discovery.html").read_text(encoding="utf-8")
    )
    # The original mean-element HTML has Puck twice and lacks S/2009 S1.
    assert len(mean) == 460
    assert len(reconciled) == 461
    assert len({obj["object_id"] for obj in reconciled}) == 461
    assert Counter(obj["parent_id"] for obj in reconciled) == {
        "earth": 1,
        "mars": 2,
        "jupiter": 115,
        "saturn": 293,
        "uranus": 29,
        "neptune": 16,
        "pluto": 5,
    }
    puck = next(obj for obj in reconciled if obj["horizons_id"] == "715")
    assert puck["alternate_catalog_ephemeris_labels"]
    absent = next(obj for obj in reconciled if obj["name"] == "S/2009 S1")
    assert absent["horizons_id"] is None
    assert absent["query_name"] == "S/2009 S1"
    assert (
        next(obj for obj in reconciled if obj["name"] == "Megaclite")["catalog_name"] == "Magaclite"
    )


def test_published_mean_radius_is_kept_and_unpublished_values_remain_null(actual):
    by_id = {obj["object_id"]: obj for obj in actual["objects"]}
    assert by_id["moon-301"]["radius_km"] == 1737.4
    assert by_id["moon-606"]["radius_km"] == 2574.76
    assert by_id["moon-401"]["radius_km"] == 11.08
    unknown = [
        obj for obj in actual["objects"] if obj["kind"] == "moon" and obj["radius_km"] is None
    ]
    assert len(unknown) > 400
    assert all(obj["radius_source"] is None for obj in unknown)
    assert by_id["ceres"]["kind"] == "dwarf_planet"
    assert by_id["haumea"]["kind"] == "dwarf_planet"
    assert by_id["sedna"]["kind"] == "dwarf_candidate"
    assert by_id["quaoar"]["kind"] == "dwarf_candidate"


def test_reader_never_queries_network_and_coverage_is_explicit(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("runtime network access")

    monkeypatch.setattr(extension, "urlopen", forbidden)
    result = extension.get_extended_solar(ROOT, parent_id="saturn")
    assert len(result["objects"]) == 293
    assert all(obj["parent_id"] == "saturn" for obj in result["objects"])
    assert result["summary"]["catalog_moons"] == 468
    assert result["summary"]["available_moons"] == 463
    assert all(
        obj["status"]
        in {"catalog_only", "available", "acquisition_failed", "ephemeris_unavailable"}
        for obj in result["objects"]
    )
    json.dumps(result, allow_nan=False)


@pytest.mark.parametrize(
    "object_id", ["moon-301", "moon-401", "moon-606", "moon-901", "ceres", "eris"]
)
def test_actual_vectors_have_parent_center_and_exact_endpoints(actual, object_id):
    obj = next(obj for obj in actual["objects"] if obj["object_id"] == object_id)
    if obj["status"] != "available":
        pytest.skip("Source acquisition has not reached this catalog entry")
    assert obj["position_reference"] == "parent_body_center"
    assert obj["knots"][0]["epoch"] == "2026-11-13T00:00:00Z"
    assert obj["knots"][-1]["epoch"] == "2026-11-16T00:00:00Z"
    for knot in (obj["knots"][0], obj["knots"][len(obj["knots"]) // 2], obj["knots"][-1]):
        sampled = extension.sample_object(obj, knot["epoch"])
        assert sampled["position_au"] == knot["position_au"]
        assert sampled["velocity_au_day"] == knot["velocity_au_day"]
        assert sampled["position_kind"] == "geometric_ephemeris_sample"
        assert sampled["coordinate_frame"] == "Ecliptic of J2000.0"
    if object_id == "moon-301":
        distances = np.linalg.norm([knot["position_au"] for knot in obj["knots"]], axis=1)
        assert np.all(
            (distances > 0.002) & (distances < 0.003)
        )  # Earth-relative, not a heliocentric AU.
    with pytest.raises(ValueError, match="extended_epoch_outside_range"):
        extension.sample_object(obj, "2026-11-16T00:00:01Z")


def test_fast_inner_moons_use_shorter_cadence_and_unavailable_is_not_zero():
    assert extension.cadence_minutes(0.3187) == 5  # Phobos mean period is a cadence hint only.
    assert extension.cadence_minutes(1.37) == 15
    assert extension.cadence_minutes(15.9) == 60
    assert extension.cadence_minutes(None) == 60
    assert (
        extension.sample_object({"status": "ephemeris_unavailable"}, "2026-11-14T00:00:00Z") is None
    )


@pytest.mark.parametrize("object_id", ["moon-301", "moon-401", "moon-606"])
def test_relative_velocity_units_are_consistent_with_published_period_scale(actual, object_id):
    # The independently published mean-period table is only a scale check: an
    # instantaneous eccentric orbit's angular period need not equal its mean.
    obj = next(obj for obj in actual["objects"] if obj["object_id"] == object_id)
    knot = obj["knots"][len(obj["knots"]) // 2]
    r, v = np.asarray(knot["position_au"]), np.asarray(knot["velocity_au_day"])
    instantaneous_angular_period = 2 * np.pi * np.dot(r, r) / np.linalg.norm(np.cross(r, v))
    assert 0.8 < instantaneous_angular_period / obj["period_days"] < 1.2


def test_wrong_parent_or_target_cannot_be_accepted(actual):
    moon = next(obj for obj in actual["objects"] if obj["object_id"] == "moon-301")
    source = json.loads((ROOT / moon["source"]["local_relative_path"]).read_text(encoding="utf-8"))[
        "result"
    ]
    with pytest.raises(ValueError, match="vector_parent_mismatch"):
        extension._parse_vectors(
            source.replace("Earth (399)", "Sun (10)"), moon, moon["cadence_minutes"]
        )
    with pytest.raises(ValueError, match="vector_target_mismatch"):
        extension._parse_vectors(
            source.replace("Moon (301)", "Mars (499)"), moon, moon["cadence_minutes"]
        )


def test_runtime_hash_check_rejects_corrupted_original(actual, tmp_path):
    moon = copy.deepcopy(next(obj for obj in actual["objects"] if obj["object_id"] == "moon-301"))
    manifest = {**actual, "objects": [moon], "sources": {}}
    manifest.pop("midpoint_validation", None)
    source_path = tmp_path / moon["source"]["local_relative_path"]
    source_path.parent.mkdir(parents=True)
    source_path.write_bytes(b"corrupted-source")
    path = tmp_path / extension.MANIFEST
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="extended_source_integrity"):
        extension.get_extended_solar(tmp_path)


def test_source_identity_failures_remain_unavailable_instead_of_other_bodies(actual):
    by_id = {obj["object_id"]: obj for obj in actual["objects"]}
    for object_id in ("moon-saturn-s2009s1", "moon-75052"):
        obj = by_id[object_id]
        assert obj["status"] == "ephemeris_unavailable"
        assert obj["knots"] == []
        assert "No validated satellite ephemeris" in obj["reason"]
        assert extension.sample_object(obj, "2026-11-14T00:00:00Z") is None
    assert by_id["moon-635"]["status"] == "ephemeris_unavailable"
    assert "2018" in by_id["moon-635"]["reason"]


def test_independent_non_knot_km_queries_validate_local_interpolation(actual):
    # These three separate source queries use KM-S instead of the original AU-D.
    # The small sampled discrepancies are not a global error bound.
    by_id = {obj["object_id"]: obj for obj in actual["objects"]}
    checks = actual["midpoint_validation"]["checks"]
    assert len(checks) == 3
    for check in checks:
        sample = extension.sample_object(by_id[check["object_id"]], check["epoch"])
        position = np.asarray(sample["position_au"]) * 149597870.700
        velocity = np.asarray(sample["velocity_au_day"]) * 149597870.700 / 86400
        assert np.linalg.norm(position - check["actual_position_km"]) == pytest.approx(
            check["position_discrepancy_km"], abs=1e-12
        )
        assert np.linalg.norm(velocity - check["actual_velocity_km_s"]) == pytest.approx(
            check["velocity_discrepancy_km_s"], abs=1e-12
        )
        assert check["position_discrepancy_km"] < 0.01


def test_seven_tno_moons_have_separate_membership_and_ephemeris_evidence(actual):
    by_id = {obj["object_id"]: obj for obj in actual["objects"]}
    for slug, name, parent, target_id, primary_id, source in extension.DWARF_MOONS:
        obj = by_id["moon-" + slug]
        assert (obj["name"], obj["parent_id"], obj["kind"]) == (name, parent, "moon")
        assert obj["catalog_source_url"] == extension.DWARF_MOON_SOURCES[source]
        assert obj["horizons_id"] == target_id
        assert obj["parent_horizons_center_id"] == primary_id
        assert obj["radius_km"] is None
        assert obj["period_days"] is None
        assert obj["identity_sources"]
        assert obj["status"] == ("available" if target_id else "ephemeris_unavailable")
    assert actual["summary"]["available_objects"] == 471
    assert actual["summary"]["status_counts"] == {"available": 471, "ephemeris_unavailable": 5}
    assert len(actual["objects"]) == len({obj["object_id"] for obj in actual["objects"]}) == 476
    for object_id in ("moon-mk2", "moon-xiangliu"):
        obj = by_id[object_id]
        assert obj["knots"] == []
        assert "major-body listing" in obj["reason"]
        for source in obj["identity_sources"]:
            text = json.loads((ROOT / source["local_relative_path"]).read_text())
            assert "No matches found" in text.get("result", "")
        assert extension.sample_object(obj, "2026-11-14T00:00:00Z") is None


def test_tno_parent_primary_solution_preserves_original_barycenter_source(actual):
    by_id = {obj["object_id"]: obj for obj in actual["objects"]}
    for parent, expected_id in {
        "haumea": "920136108",
        "eris": "920136199",
        "quaoar": "920050000",
        "orcus": "920090482",
    }.items():
        obj = by_id[parent]
        assert obj["horizons_id"] == expected_id
        assert obj["superseded_horizons_id"].endswith(";")
        assert obj["source"]["sha256"] != obj["superseded_barycenter_source"]["sha256"]
        source = json.loads((ROOT / obj["source"]["local_relative_path"]).read_text())["result"]
        assert f"{parent.title()} (primary body) ({expected_id})" in source
        assert "Center body name: Sun (10)" in source
        assert "Primary-body center" in obj["position_definition"]
        assert obj["solution_notes"]
    assert len(extension.get_extended_solar(ROOT, parent_id="haumea")["objects"]) == 2
    assert len(extension.get_extended_solar(ROOT, parent_id="makemake")["objects"]) == 1


def test_separate_heliocentric_km_queries_validate_tno_center_composition(actual):
    by_id = {obj["object_id"]: obj for obj in actual["objects"]}
    validation = actual["tno_center_validation"]
    assert len(validation["checks"]) == 5
    assert "not independent dynamics" in validation["limitations"]
    for check in validation["checks"]:
        parent = extension.sample_object(by_id[check["parent_id"]], check["epoch"])
        moon = extension.sample_object(by_id[check["object_id"]], check["epoch"])
        p = (np.asarray(parent["position_au"]) + moon["position_au"]) * 149597870.700
        v = (
            (np.asarray(parent["velocity_au_day"]) + moon["velocity_au_day"])
            * 149597870.700
            / 86400
        )
        assert np.linalg.norm(p - check["actual_heliocentric_position_km"]) == pytest.approx(
            check["position_discrepancy_km"], abs=1e-12
        )
        assert np.linalg.norm(v - check["actual_heliocentric_velocity_km_s"]) == pytest.approx(
            check["velocity_discrepancy_km_s"], abs=1e-12
        )
        assert check["position_discrepancy_km"] < 0.01
        assert check["velocity_discrepancy_km_s"] < 1e-6
    # This is a sampled consistency discrepancy, not an astrometric error bar.
    assert validation["max_sampled_position_discrepancy_km"] < 0.001
