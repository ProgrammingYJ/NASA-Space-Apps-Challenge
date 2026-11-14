"""Actual Solar parent catalogues and mounted original texture API."""

import hashlib
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


@pytest.mark.parametrize(
    "object_id", ["sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"]
)
def test_base_solar_bodies_have_normal_empty_observation_state(catalog_api, object_id):
    response = catalog_api.get("/api/v1/observations", params={"object_id": object_id})
    assert response.status_code == 200, response.text
    assert response.json() == {
        "object_id": object_id,
        "observations": [],
        "status": "no_linked_observations",
        "next_cursor": None,
    }


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
