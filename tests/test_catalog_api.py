"""Actual local history/galaxy/parent catalogs and mounted original texture API."""

import hashlib
import math
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import create_app
from science.kuiper import get_kuiper_display

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def catalog_api(tmp_path_factory):
    with TestClient(create_app(tmp_path_factory.mktemp("new-catalog-api"))) as client:
        yield client


def test_cosmic_history_catalog_has_source_hashes_and_ten_conceptual_milestones(catalog_api):
    response = catalog_api.get("/api/v1/cosmic-history")
    assert response.status_code == 200, response.text
    value = response.json()
    assert value["schema_version"] == "1.0"
    assert value["algorithm_version"] == "cosmic-chronology-v1"
    assert value["reference_age_gyr"] == 13.8
    assert len(value["stages"]) == 10
    assert len(value["sources"]) == 4
    assert (
        value["source_manifest_sha256"]
        == hashlib.sha256((ROOT / "data/manifests/cosmic_history.json").read_bytes()).hexdigest()
    )
    assert all(
        stage["source"]["sha256"]
        and stage["spatial_representation"] == "conceptual_illustration_only"
        for stage in value["stages"]
    )
    assert "not a measured spatial reconstruction" in " ".join(value["limitations"])


@pytest.mark.parametrize(
    "age,expected", [(0, "hot_big_bang"), (0.00038, "recombination"), (13.8, "present")]
)
def test_cosmic_age_endpoints_and_recombination_sample(catalog_api, age, expected):
    response = catalog_api.get("/api/v1/cosmic-history/sample", params={"age_gyr": age})
    assert response.status_code == 200, response.text
    value = response.json()
    assert value["stage_id"] == expected
    assert value["age_gyr"] == age
    assert value["lookback_gyr"] == pytest.approx(13.8 - age)
    assert value["stage_anchor_age_gyr"] == age


@pytest.mark.parametrize("age", ["-1", "nan", "inf", "13.81"])
def test_cosmic_invalid_age_is_422_not_silently_clamped_or_nonfinite(catalog_api, age):
    response = catalog_api.get("/api/v1/cosmic-history/sample", params={"age_gyr": age})
    assert response.status_code == 422, response.text


def test_nine_galaxies_keep_actual_sources_native_directions_and_rounded_distance_units(
    catalog_api,
):
    response = catalog_api.get("/api/v1/catalog/galaxies")
    assert response.status_code == 200, response.text
    value = response.json()
    assert (
        value["source_manifest_sha256"]
        == hashlib.sha256((ROOT / "data/manifests/galaxies.json").read_bytes()).hexdigest()
    )
    assert {obj["object_id"] for obj in value["objects"]} == {
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
    for obj in value["objects"]:
        assert obj["coordinate_source"]["url"].startswith("https://")
        assert obj["coordinate_source"]["sha256"]
        assert obj["distance_source"]["sha256"]
        assert obj["native_coordinates"]["original_coordinate_text"]
        assert "J2000" in obj["native_coordinates"]["coordinate_reference"]
        assert obj["distance_mpc"] == pytest.approx(
            obj["distance_ly"]
            * (299_792_458 * 365.25 * 86_400)
            / (648_000 / math.pi * 149_597_870_700)
            / 1e6,
            rel=1e-14,
        )
        assert obj["distance_uncertainty"] is None
        assert obj["limitations"]
    m87 = next(obj for obj in value["objects"] if obj["object_id"] == "galaxy-m87")
    assert m87["distance_ly"] == 54e6
    assert m87["source_difference"]["coordinate_page_distance_million_ly"] == 55
    objects = {obj["object_id"]: obj for obj in value["objects"]}
    # Independent source facts: NASA M31's stated inclination, the NASA M81
    # lithograph's two main arms, APOD's LMC bar/single arm, and no spiral
    # pattern for the CXC elliptical M87/Centaurus A descriptions.
    assert objects["galaxy-m31"]["appearance"]["inclination_deg"] == 77
    assert objects["galaxy-m81"]["appearance"]["arms"] == 2
    assert objects["galaxy-lmc"]["appearance"]["arms"] == 1
    assert objects["galaxy-m87"]["appearance"]["arms"] == 0
    assert objects["galaxy-centaurus-a"]["appearance"]["arms"] == 0
    assert objects["galaxy-lmc"]["distance_ly"] == 160_000
    assert objects["galaxy-smc"]["distance_ly"] == 200_000
    assert all(obj["appearance"]["position_angle_deg"] is None for obj in objects.values())
    assert all(
        obj["appearance"]["inclination_deg"] is None
        for object_id, obj in objects.items()
        if object_id != "galaxy-m31"
    )
    assert len({obj["appearance"]["renderer"] for obj in objects.values()}) == 9


@pytest.mark.parametrize(
    "parent,count,available",
    [
        ("haumea", 2, True),
        ("eris", 1, True),
        ("quaoar", 1, True),
        ("orcus", 1, True),
        ("makemake", 1, False),
        ("gonggong", 1, False),
    ],
)
def test_all_six_tno_parents_are_supported_and_unavailable_is_honest(
    catalog_api, parent, count, available
):
    response = catalog_api.get("/api/v1/catalog/solar-system", params={"parent_id": parent})
    assert response.status_code == 200, response.text  # Regression: PARENTS omitted these six.
    value = response.json()
    assert len(value["objects"]) == count
    assert value["summary"]["catalog_moons"] == 468
    assert value["summary"]["available_moons"] == 463
    for obj in value["objects"]:
        assert obj["parent_id"] == parent
        assert obj["status"] == ("available" if available else "ephemeris_unavailable")
        if available:
            assert obj["parent_horizons_center_id"].startswith("920")
            assert obj["knots"][0]["epoch"] == "2026-11-13T00:00:00Z"
            assert obj["knots"][-1]["epoch"] == "2026-11-16T00:00:00Z"
        else:
            assert obj["knots"] == []
            assert obj["horizons_id"] is None
            assert obj["reason"]


def test_catalog_index_does_not_duplicate_large_knot_arrays(catalog_api):
    response = catalog_api.get("/api/v1/catalog/solar-system")
    assert response.status_code == 200
    value = response.json()
    assert len(value["objects"]) == 476
    assert all("knots" not in obj for obj in value["objects"])
    assert (
        catalog_api.get(
            "/api/v1/catalog/solar-system", params={"parent_id": "invented"}
        ).status_code
        == 422
    )


def test_actual_jpeg_and_png_are_mounted_with_original_bytes_and_unknown_is_404(catalog_api):
    response = catalog_api.get("/api/v1/appearance")
    assert response.status_code == 200, response.text
    for object_id, content_type in [("earth", "image/jpeg"), ("neptune", "image/png")]:
        source = response.json()["objects"][object_id]
        image = catalog_api.get(source["texture_url"])
        assert image.status_code == 200, image.text[:150]
        assert image.headers["content-type"] == content_type
        assert len(image.content) == source["bytes"]
        assert hashlib.sha256(image.content).hexdigest() == source["sha256"]
    assert catalog_api.get("/textures/unknown-file.png").status_code == 404


def test_kuiper_main_region_source_and_renderer_assumptions_are_distinct():
    value = get_kuiper_display(ROOT)
    assert value["algorithm_version"] == "kuiper-region-v1"
    assert value["range_au"] == [30, 50]
    assert value["source"]["url"] == "https://science.nasa.gov/solar-system/kuiper-belt/facts/"
    assert value["separate_scattered_disk_reference"]["outer_reach_au_approximately"] == 1000
    assert value["separate_scattered_disk_reference"]["rendered_by_this_annulus"] is False
    assert value["renderer_assumptions"]["point_count"] == 650
    assert value["renderer_assumptions"]["height_range_au"] == [-0.6, 0.6]
    assert value["renderer_assumptions"]["points_are_catalog_objects"] is False
    assert value["renderer_assumptions"]["distribution_is_measured_density"] is False
    assert value["renderer_assumptions"]["height_is_measured_thickness"] is False


def test_kuiper_api_returns_verified_display_version_and_source_hash(catalog_api):
    response = catalog_api.get("/api/v1/kuiper-belt")
    assert response.status_code == 200, response.text
    value = response.json()
    assert value["display_version"] == "kuiper-region-v1"
    assert value["range_au"] == [30, 50]
    assert (
        value["source_manifest_sha256"]
        == hashlib.sha256((ROOT / "data/manifests/kuiper_display.json").read_bytes()).hexdigest()
    )
    assert value["source"]["sha256"]
    assert value["renderer_assumptions"]["points_are_catalog_objects"] is False
