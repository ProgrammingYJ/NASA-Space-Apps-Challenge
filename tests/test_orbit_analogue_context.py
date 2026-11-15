"""Restore the declared TOP 5 comparison, never infer it from a legacy filter."""

import hashlib
import json

import pytest
from pydantic import ValidationError

from api.models import UniverseContext
from api.service import orbit_analogue_context_reasons, outer_tno_context_reasons


def context(**changes):
    return UniverseContext(
        selected_object_id="pluto",
        model_epoch="2026-11-14T00:00:00Z",
        source_manifest_sha256="a" * 64,
        **changes,
    )


def analogue(sha="b" * 64):
    return {
        "algorithm_version": "tno-source-aei-exploratory-v1",
        "hypothesis": {"a_au": 400, "e": 0.2, "i_deg": 15, "epoch_jd_tdb": 2458270},
        "source_manifest_sha256": sha,
    }


def pinned(sha):
    return context(
        scene_filter="p9-reference",
        scene_filter_version="actual-analogue-top5-v1",
        orbit_analogue_context=analogue(sha),
    )


def fixture(root):
    def write(relative, value):
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        raw = json.dumps(value).encode()
        path.write_bytes(raw)
        return {
            "local_relative_path": relative,
            "bytes": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest(),
        }

    original = write(
        "data/reference/outer-tno/source.json",
        {
            "count": "1",
            "fields": ["spkid", "a", "e", "i", "w", "om", "ma", "epoch"],
            "data": [["20090377", "500", ".85", "11.9", "311.5", "144.5", "358", "2461000"]],
        },
    )
    original["request_metadata"] = write("data/reference/outer-tno/request.json", {"count": 1})
    manifest = {
        "schema_version": "1.0",
        "algorithm_version": "jpl-sbdb-tno-two-body-v1",
        "coordinate_frame": "heliocentric_IAU76_80_ecliptic_J2000",
        "time_scale": "TDB",
        "source": original,
        "selection": {"reported_count": 1, "complete_response": True},
        "objects": [{
            "object_id": "sbdb-20090377", "spkid": "20090377", "catalog_class": "TNO",
            "orbit": {"a_au": 500, "e": .85, "i_deg": 11.9, "omega_deg": 311.5,
                      "Omega_deg": 144.5, "M_deg": 358, "epoch_jd_tdb": 2461000},
        }],
    }
    manifest_path = root / "data/manifests/outer_tno.json"
    manifest_path.parent.mkdir(parents=True)

    def store():
        raw = json.dumps(manifest).encode()
        manifest_path.write_bytes(raw)
        return hashlib.sha256(raw).hexdigest()

    return manifest, manifest_path, store


def test_legacy_filters_are_accepted_without_assigning_new_semantics_or_reading_sources(tmp_path):
    for mode in (None, "all", "confirmed-planets", "p9-reference", "planets-and-p9"):
        legacy = context(scene_filter=mode)
        before = legacy.model_dump(exclude_none=True)
        assert "scene_filter_version" not in before
        assert "orbit_analogue_context" not in before
        assert orbit_analogue_context_reasons(legacy, tmp_path) == []
        assert outer_tno_context_reasons(legacy, tmp_path) == []
        assert legacy.model_dump(exclude_none=True) == before


def test_versioned_topfive_requires_exact_comparison_context_and_round_trips():
    value = pinned("b" * 64)
    assert UniverseContext.model_validate_json(value.model_dump_json()) == value
    for mode in ("p9-reference", "planets-and-p9"):
        with pytest.raises(ValidationError):
            context(scene_filter=mode, scene_filter_version="actual-analogue-top5-v1")
    with pytest.raises(ValidationError):
        context(orbit_analogue_context=analogue())
    for mode in ("all", "confirmed-planets"):
        assert context(scene_filter=mode, scene_filter_version="actual-analogue-top5-v1")


@pytest.mark.parametrize("key,value", [
    ("a_au", 0), ("a_au", -1), ("a_au", 2000.01), ("a_au", "400"),
    ("e", -.01), ("e", 1), ("e", .99001), ("e", True),
    ("i_deg", -.01), ("i_deg", 180.01),
    ("epoch_jd_tdb", 625697.49), ("epoch_jd_tdb", 2816787.51),
    ("a_au", float("nan")), ("e", float("inf")), ("i_deg", float("-inf")),
])
def test_hypothesis_strict_finite_ranges(key, value):
    saved = analogue()
    saved["hypothesis"][key] = value
    with pytest.raises(ValidationError):
        context(scene_filter_version="actual-analogue-top5-v1", orbit_analogue_context=saved)


def test_bounds_versions_hash_and_unknown_fields():
    for a, e, i, jd in [(2000, .99, 180, 2816787.5), (.001, 0, 0, 625697.5)]:
        saved = analogue()
        saved["hypothesis"] = {"a_au": a, "e": e, "i_deg": i, "epoch_jd_tdb": jd}
        assert context(scene_filter_version="actual-analogue-top5-v1", orbit_analogue_context=saved)
    invalid = [
        {**analogue(), "algorithm_version": "future-rule"},
        {**analogue(), "source_manifest_sha256": "unverified"},
        {**analogue(), "source_manifest_sha256": "A" * 64},
        {**analogue(), "rows": ["sbdb-1"]},
        {**analogue(), "hypothesis": {**analogue()["hypothesis"], "score": .9}},
    ]
    for saved in invalid:
        with pytest.raises(ValidationError):
            context(scene_filter_version="actual-analogue-top5-v1", orbit_analogue_context=saved)
    with pytest.raises(ValidationError):
        context(scene_filter_version="old-reference-v0")


def test_source_check_reads_actual_bytes_and_preserves_saved_evidence(tmp_path, monkeypatch):
    import api.service

    _, path, store = fixture(tmp_path)
    saved = pinned(store())
    before = saved.model_dump()
    assert orbit_analogue_context_reasons(saved, tmp_path) == []
    assert outer_tno_context_reasons(saved, tmp_path) == []
    assert saved.model_dump() == before
    path.write_bytes(path.read_bytes() + b" ")
    assert outer_tno_context_reasons(saved, tmp_path) == ["orbit_analogue_sources_changed"]
    store()
    monkeypatch.setattr(api.service, "ORBIT_ANALOGUE_ALGORITHM", "future-rule")
    assert outer_tno_context_reasons(saved, tmp_path) == ["orbit_analogue_algorithm_changed"]
    monkeypatch.setattr(api.service, "ORBIT_ANALOGUE_ALGORITHM", "tno-source-aei-exploratory-v1")
    path.unlink()
    assert outer_tno_context_reasons(saved, tmp_path) == ["orbit_analogue_data_unavailable"]
    assert saved.model_dump() == before


@pytest.mark.parametrize("failure", [
    "response_bytes", "request_missing", "incomplete", "identity", "elements", "frame", "path",
])
def test_a_matching_manifest_hash_does_not_prove_the_original_sources(tmp_path, failure):
    manifest, _, store = fixture(tmp_path)
    if failure == "response_bytes":
        (tmp_path / manifest["source"]["local_relative_path"]).write_bytes(b"changed")
    elif failure == "request_missing":
        (tmp_path / manifest["source"]["request_metadata"]["local_relative_path"]).unlink()
    elif failure == "incomplete":
        manifest["selection"]["complete_response"] = False
    elif failure == "identity":
        manifest["objects"][0]["spkid"] = "999"
    elif failure == "elements":
        manifest["objects"][0]["orbit"]["a_au"] = 501
    elif failure == "frame":
        manifest["coordinate_frame"] = "ICRS"
    elif failure == "path":
        manifest["source"]["local_relative_path"] = "../outside.json"
    saved = pinned(store())
    assert outer_tno_context_reasons(saved, tmp_path) == ["orbit_analogue_data_unavailable"]
