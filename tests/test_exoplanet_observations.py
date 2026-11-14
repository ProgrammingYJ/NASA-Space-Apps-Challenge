"""Real image identity, rights, byte integrity and unresolved-surface regressions."""

import json
import shutil
from pathlib import Path

import pytest

from science.exoplanet_observations import MANIFEST, get_exoplanet_observations, jpeg_dimensions

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def inputs(tmp_path):
    manifest = json.loads((ROOT / MANIFEST).read_bytes())
    paths = [MANIFEST, manifest["confirmed_catalog_dependency"]["path"]]
    paths += [source["local_relative_path"] for source in manifest["sources"].values()]
    paths += [item["local_relative_path"] for item in manifest["observations"]]
    for relative in paths:
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, target)
    return tmp_path, manifest


def rewrite(root, manifest):
    (root / MANIFEST).write_text(json.dumps(manifest), encoding="utf-8")


def test_three_images_are_specific_confirmed_planets_with_surface_limits_and_visible_credit_data():
    data = get_exoplanet_observations(ROOT)
    assert {item["planet_name"] for item in data["observations"]} == {
        "HIP 65426 b",
        "Beta Pictoris b",
        "HR 8799 c",
    }
    for item in data["observations"]:
        assert item["kind"] == "processed_direct_imaging"
        assert item["surface_resolved"] is False
        assert item["source_asset_type"] in {"Observation", "Collage"}
        assert item["license"]["name"] == "CC BY 4.0"
        assert item["license"]["url"] == "https://creativecommons.org/licenses/by/4.0/"
        assert item["credit"] and item["source"]["url"].startswith("https://")
        assert "surface unresolved" in item["image_alt"]
        assert item["project_modifications"].startswith("none")
    beta = next(item for item in data["observations"] if item["planet_name"] == "Beta Pictoris b")
    assert beta["credit"] == "ESO/Lagrange/SPHERE consortium."
    assert any("not a measured transit" in text for text in beta["limitations"])
    hip = next(item for item in data["observations"] if item["planet_name"] == "HIP 65426 b")
    assert hip["observation_dates"] == ["2022-07-17", "2022-07-30"]
    assert hip["wavelengths_um"] == [3, 4.44, 11.4, 15.5]
    assert any("optical artifacts" in text for text in hip["processing"])


def test_known_planet_without_an_adopted_image_returns_empty_without_fabrication():
    data = get_exoplanet_observations(ROOT, object_id="exo-0999f94f8286fba1976c")  # HR 8799 b
    assert data["observations"] == []
    data = get_exoplanet_observations(ROOT, object_id="exo-037ff94cfb7621193437")
    assert [item["planet_name"] for item in data["observations"]] == ["HR 8799 c"]


def test_authored_facts_and_image_bytes_are_sufficient_without_upstream_html(inputs):
    root, _ = inputs
    assert not (root / "data/reference/exoplanet-observations/upstream").exists()
    assert len(get_exoplanet_observations(root)["observations"]) == 3


def test_image_tampering_fails_before_it_can_be_published_as_verified(inputs):
    root, manifest = inputs
    image = root / manifest["observations"][0]["local_relative_path"]
    image.write_bytes(image.read_bytes() + b"changed")
    with pytest.raises(ValueError, match="exoplanet_observation_image_integrity_failed"):
        get_exoplanet_observations(root)


def test_source_extract_tampering_fails(inputs):
    root, manifest = inputs
    path = root / manifest["sources"]["eso-rights"]["local_relative_path"]
    path.write_bytes(b"{}")
    with pytest.raises(ValueError, match="exoplanet_observation_source_integrity_failed"):
        get_exoplanet_observations(root)


@pytest.mark.parametrize(
    "field,value,error",
    [
        ("surface_resolved", True, "exoplanet_observation_surface_claim_changed"),
        ("kind", "surface_map", "exoplanet_observation_surface_claim_changed"),
        ("credit", "Project-generated", "exoplanet_observation_claim_changed"),
        (
            "image_source_url",
            "https://www.eso.org/public/images/eso1414a/",
            "exoplanet_observation_claim_changed",
        ),
        ("license", {"name": "public domain"}, "exoplanet_observation_license_changed"),
    ],
)
def test_surface_artwork_credit_or_rights_cannot_replace_the_verified_observation(
    inputs, field, value, error
):
    root, manifest = inputs
    manifest["observations"][0][field] = value
    rewrite(root, manifest)
    with pytest.raises(ValueError, match=error):
        get_exoplanet_observations(root)


def test_source_path_is_confined_to_packaged_facts(inputs):
    root, manifest = inputs
    manifest["sources"]["eso-rights"]["local_relative_path"] = manifest[
        "confirmed_catalog_dependency"
    ]["path"]
    rewrite(root, manifest)
    with pytest.raises(ValueError, match="exoplanet_observation_path_escape"):
        get_exoplanet_observations(root)


@pytest.mark.parametrize("identifier", ["../../file", "exo-00000000000000000000"])
def test_invalid_or_unknown_ids_are_rejected(identifier):
    with pytest.raises(
        ValueError,
        match="invalid_exoplanet_observation_object_id|unknown_exoplanet_observation_object_id",
    ):
        get_exoplanet_observations(ROOT, object_id=identifier)


@pytest.mark.parametrize("raw", [b"<html>error</html>", b"\xff\xd8\xff\xe0\x00\xff\xff\xd9"])
def test_downloaded_html_or_truncated_jpeg_is_not_accepted_as_an_image(raw):
    with pytest.raises(ValueError, match="invalid_exoplanet_observation_jpeg"):
        jpeg_dimensions(raw)
