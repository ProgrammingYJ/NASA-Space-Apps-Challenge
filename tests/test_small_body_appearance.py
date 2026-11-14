"""Check source-backed constraints and rejection of invented geometry.

Independent values below are traced to the cited primary papers, rather than
being regenerated from the profile builder as the expected result.
"""

import json
import math
import shutil
from pathlib import Path

import pytest

from science.small_body_appearance import (
    MANIFEST,
    _safe_url,
    get_small_body_appearance,
)

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def offline_root(tmp_path):
    """Only required facts/dependencies; no copyrighted upstream text."""
    manifest = json.loads((ROOT / MANIFEST).read_bytes())
    paths = [MANIFEST]
    paths += [source["local_relative_path"] for source in manifest["sources"].values()]
    paths += [source["path"] for source in manifest["dependencies"].values()]
    for relative in paths:
        destination = tmp_path / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, destination)
    return tmp_path


def rewrite_manifest(root, transform):
    path = root / MANIFEST
    data = json.loads(path.read_bytes())
    transform(data)
    path.write_text(json.dumps(data), encoding="utf-8")


def test_offline_factual_catalog_preserves_existing_objects_and_ceres_map(offline_root):
    result = get_small_body_appearance(offline_root)
    assert set(result["profiles"]) == {
        "ceres",
        "haumea",
        "makemake",
        "eris",
        "sedna",
        "quaoar",
        "orcus",
        "gonggong",
    }
    assert len(result["sources"]) == 12
    assert not (offline_root / "data/reference/small-body-appearance/upstream").exists()
    assert result["profiles"]["ceres"]["surface_resolved"] is True
    assert result["profiles"]["ceres"]["preserve_existing_map"] is True
    assert all(not profile["procedural_surface"] for profile in result["profiles"].values())
    assert all(
        not profile["surface_resolved"]
        for key, profile in result["profiles"].items()
        if key != "ceres"
    )


def test_sedna_thermal_radius_is_not_a_resolved_geographic_shape(offline_root):
    # Pal et al. 2012, A&A 541 L6: D=995 +/- 80 km.
    profile = get_small_body_appearance(offline_root)["profiles"]["sedna"]
    assert profile["reference_radius_km"] == 497.5
    assert profile["reference_radius_uncertainty_km"] == {"minus_km": 40, "plus_km": 40}
    assert profile["shape_axis_ratios"] is None
    assert profile["palette_status"] == "illustrative_not_calibrated_RGB"
    assert "reddish" in profile["color_evidence"]


def test_haumea_uses_published_conditional_axes_and_asymmetric_ring_uncertainty(offline_root):
    # Ortiz et al. 2017 main text: a,b,c=1161,852,513 km; Rring=2287 (-45,+75).
    profile = get_small_body_appearance(offline_root)["profiles"]["haumea"]
    a, b, c = profile["shape_axis_ratios"]
    assert a == 1
    assert math.isclose(b, 852 / 1161)
    assert math.isclose(c, 513 / 1161)
    assert math.isclose(profile["reference_radius_km"], 797.62, abs_tol=0.005)
    ring = profile["rings"][0]
    assert ring["center_radius_km"] == 2287
    assert ring["radius_uncertainty_km"] == {"minus_km": 45, "plus_km": 75}
    assert ring["width_km"] == 70
    assert any("ring-light" in limitation for limitation in profile["limitations"])


def test_quaoar_keeps_two_source_rings_without_fabricating_uniform_width_or_shape(offline_root):
    # Proudfoot et al. 2025 Table 2; Pereira et al. 2023 projected area radius.
    profile = get_small_body_appearance(offline_root)["profiles"]["quaoar"]
    assert profile["shape_axis_ratios"] is None
    assert profile["reference_radius_km"] == 543
    assert "Projected area-equivalent" in profile["reference_radius_definition"]
    assert [(ring["name"], ring["center_radius_km"]) for ring in profile["rings"]] == [
        ("Q1R", 4096),
        ("Q2R", 2529),
    ]
    assert [ring["radius_uncertainty_km"]["plus_km"] for ring in profile["rings"]] == [10, 12]
    assert all(ring["width_km"] is None for ring in profile["rings"])
    assert any("systematically" in limitation for limitation in profile["limitations"])


def test_orcus_and_gonggong_radius_assumptions_are_retained(offline_root):
    profiles = get_small_body_appearance(offline_root)["profiles"]
    assert profiles["orcus"]["reference_radius_km"] == 455
    assert profiles["orcus"]["reference_radius_uncertainty_km"] == {"minus_km": 20, "plus_km": 25}
    assert profiles["gonggong"]["reference_radius_km"] == 615
    assert "assuming a sphere" in profiles["gonggong"]["reference_radius_definition"]
    assert profiles["gonggong"]["shape_axis_ratios"] is None


def test_modified_source_facts_are_rejected(offline_root):
    data = json.loads((offline_root / MANIFEST).read_bytes())
    path = offline_root / data["sources"]["sedna-size"]["local_relative_path"]
    path.write_text("{}", encoding="utf-8")
    with pytest.raises(ValueError, match="source_integrity"):
        get_small_body_appearance(offline_root)


@pytest.mark.parametrize(
    "mutation",
    [
        lambda data: data["profiles"]["sedna"].update(surface_resolved=True),
        lambda data: data["profiles"]["quaoar"].update(shape_axis_ratios=[1, 0.7, 0.4]),
        lambda data: data["profiles"]["quaoar"]["rings"][0].update(width_km=100),
        lambda data: data["profiles"]["ceres"].update(preserve_existing_map=False),
    ],
)
def test_unsupported_surface_shape_width_or_map_override_is_rejected(offline_root, mutation):
    rewrite_manifest(offline_root, mutation)
    with pytest.raises(ValueError, match="appearance_claim_changed"):
        get_small_body_appearance(offline_root)


def test_path_escape_and_non_allowlisted_source_are_rejected(offline_root):
    rewrite_manifest(
        offline_root,
        lambda data: data["sources"]["sedna-size"].update(
            local_relative_path="data/manifests/appearance.json"
        ),
    )
    with pytest.raises(ValueError, match="source_path_escape"):
        get_small_body_appearance(offline_root)
    with pytest.raises(ValueError, match="invalid_small_body_source_url"):
        _safe_url("https://example.com/paper")
    with pytest.raises(ValueError, match="invalid_small_body_source_url"):
        _safe_url("http://arxiv.org/abs/1204.0899")


def test_original_catalog_and_map_dependency_changes_are_not_silently_accepted(offline_root):
    path = offline_root / "data/manifests/appearance.json"
    path.write_text("{}", encoding="utf-8")
    with pytest.raises(ValueError, match="dependency_changed"):
        get_small_body_appearance(offline_root)
