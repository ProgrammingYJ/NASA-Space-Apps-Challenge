"""Guard confirmed-only discovery against promotion of uncertain literature."""

import json
import shutil
from pathlib import Path

import pytest

from science.extragalactic_planets import MANIFEST, get_extragalactic_planets

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def inputs(tmp_path):
    manifest = json.loads((ROOT / MANIFEST).read_bytes())
    paths = [MANIFEST, manifest["catalog_audit"]["path"]]
    paths += [source["local_relative_path"] for source in manifest["sources"].values()]
    for relative in paths:
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, target)
    return tmp_path, manifest


def rewrite(root, manifest):
    (root / MANIFEST).write_text(json.dumps(manifest), encoding="utf-8")


def test_review_is_not_promoted_to_confirmed_objects_or_counted_as_a_census():
    result = get_extragalactic_planets(ROOT)
    assert result["objects"] == result["confirmed_objects"] == []
    review = result["reviewed_unconfirmed_evidence"]
    assert len(review) == 5
    assert sum(item["status"] == "candidate" for item in review) == 2
    assert sum(item["status"] == "population_inference" for item in review) == 3
    assert all(item["confirmed"] is False for item in review)
    assert result["catalog_audit"]["rows"] == 6470
    assert result["catalog_audit"]["candidate_alias_matches"] == []
    assert result["coverage"] == "adopted_literature_cases_not_complete_census"
    assert result["confirmation_scope"] == "adopted_collection_only_not_a_global_census"
    assert len(result["sources"]) == 11
    assert result["status_context_source"] == result["sources"]["m51-chandra"]
    assert "status-context-2026" not in result["sources"]


def test_excluded_lamost_context_is_audit_only_and_not_a_runtime_input(inputs):
    root, manifest = inputs
    excluded = manifest["excluded_source_audit"][0]
    assert excluded["source_id"] == "status-context-2026"
    assert excluded["status"] == "excluded_not_used"
    assert excluded["runtime_dependency"] is False
    assert "LAMOST" in excluded["reason"]
    assert not (
        root / "data/reference/extragalactic-planets/facts/status-context-2026.json"
    ).exists()
    assert get_extragalactic_planets(root)["confirmed_objects"] == []


def test_global_confirmation_claim_cannot_replace_the_adopted_collection_scope(inputs):
    root, manifest = inputs
    manifest["confirmation_scope"] = "no_confirmed_planets_in_the_universe"
    rewrite(root, manifest)
    with pytest.raises(ValueError, match="extragalactic_confirmation_scope_changed"):
        get_extragalactic_planets(root)


def test_conditional_lens_mass_is_not_turned_into_a_measured_planet_or_orbital_period():
    review = get_extragalactic_planets(ROOT, galaxy_id="galaxy-m31")[
        "reviewed_unconfirmed_evidence"
    ]
    assert len(review) == 1
    event = review[0]
    params = {parameter["key"]: parameter for parameter in event["parameters"]}
    assert params["mass_ratio"]["value"] == 0.0122
    assert params["assumed_host_mass"]["value"] == 0.5
    assert params["conditional_companion_mass"]["value"] == 6.34
    assert params["conditional_companion_mass"]["qualifier"] == "conditional_not_direct_measurement"
    assert params["einstein_time"]["qualifier"] == "microlensing_timescale_not_orbital_period"
    assert event["coordinate"]["role"] == "microlensing_source_sightline"
    # Independent sexagesimal arithmetic for the actual PA-99-N2 catalog direction.
    assert event["coordinate"]["ra_deg"] == pytest.approx(15 * (44 / 60 + 20.89 / 3600))
    assert event["coordinate"]["dec_deg"] == pytest.approx(41 + 28 / 60 + 44.6 / 3600)
    assert event["coordinate"]["frame"] == "ICRS"


def test_population_evidence_retains_black_hole_alternative_and_unknown_geometry():
    data = get_extragalactic_planets(ROOT)
    populations = [
        item
        for item in data["reviewed_unconfirmed_evidence"]
        if item["status"] == "population_inference"
    ]
    assert len(populations) == 3
    for item in populations:
        assert item["individually_identified_planets"] == 0
        assert any("primordial black holes" in text for text in item["limitations"])
        assert item["galaxy_id"] is None
        assert item["orbit"] is None and item["resolved_surface"] is None
        assert item["distance_pc"] is None and item["galaxy_relative_position_pc"] is None
    assert (
        len(
            get_extragalactic_planets(ROOT, galaxy_id="galaxy-m51")["reviewed_unconfirmed_evidence"]
        )
        == 1
    )
    assert (
        get_extragalactic_planets(ROOT, galaxy_id="galaxy-lmc")["reviewed_unconfirmed_evidence"]
        == []
    )


def test_distributable_inputs_work_without_copyrighted_upstream_documents(inputs):
    root, _ = inputs
    assert not (root / "data/reference/extragalactic-planets/upstream").exists()
    assert get_extragalactic_planets(root)["confirmed_objects"] == []


def test_integrity_failure_is_not_silently_treated_as_empty_data(inputs):
    root, manifest = inputs
    source = next(iter(manifest["sources"].values()))
    (root / source["local_relative_path"]).write_bytes(b"changed")
    with pytest.raises(ValueError, match="extragalactic_source_integrity_failed"):
        get_extragalactic_planets(root)


def test_source_path_cannot_escape_packaged_facts(inputs):
    root, manifest = inputs
    manifest["sources"]["m51-paper"]["local_relative_path"] = "data/manifests/exoplanets.json"
    rewrite(root, manifest)
    with pytest.raises(ValueError, match="extragalactic_source_path_escape"):
        get_extragalactic_planets(root)


@pytest.mark.parametrize(
    "field,value",
    [("confirmed", True), ("orbit", {"period_days": 70}), ("resolved_surface", "invented.png")],
)
def test_uncertainty_cannot_be_overwritten_with_a_confirmed_planet_or_geometry(
    inputs, field, value
):
    root, manifest = inputs
    manifest["reviewed_unconfirmed_evidence"][0][field] = value
    rewrite(root, manifest)
    with pytest.raises(
        ValueError, match="extragalactic_confirmation_promotion|extragalactic_unsourced_geometry"
    ):
        get_extragalactic_planets(root)


def test_review_record_cannot_leak_into_the_confirmed_collection(inputs):
    root, manifest = inputs
    manifest["confirmed_objects"] = [manifest["reviewed_unconfirmed_evidence"][0]]
    rewrite(root, manifest)
    with pytest.raises(ValueError, match="extragalactic_unconfirmed_object_promotion"):
        get_extragalactic_planets(root)


@pytest.mark.parametrize("galaxy", ["../../file", "galaxy-unknown"])
def test_filter_rejects_unknown_or_path_like_galaxies(galaxy):
    with pytest.raises(ValueError, match="unknown_extragalactic_galaxy"):
        get_extragalactic_planets(ROOT, galaxy_id=galaxy)
