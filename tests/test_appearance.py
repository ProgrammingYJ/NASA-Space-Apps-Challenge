"""Actual appearance file integrity, coordinate windows and sourced ring geometry."""

import hashlib
import json
import math
import shutil
from copy import deepcopy
from pathlib import Path
from urllib.parse import urlparse

import pytest
from astropy.time import Time

from science.appearance import (
    MANIFEST_PATH,
    OFFICIAL_HOSTS,
    PCK_PATH,
    RING_EPOCH,
    get_appearance,
    image_dimensions,
    ring_poles,
)

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def appearance():
    return get_appearance(ROOT)


def test_published_original_bytes_dimensions_and_credits_are_verified(appearance):
    assert {
        "mercury",
        "venus",
        "earth",
        "mars",
        "jupiter",
        "saturn",
        "uranus",
        "neptune",
        "pluto",
    } <= set(appearance["objects"])
    assert (
        appearance["source_manifest_sha256"]
        == hashlib.sha256((ROOT / MANIFEST_PATH).read_bytes()).hexdigest()
    )
    assert sum(record["bytes"] for record in appearance["objects"].values()) < 1_000_000_000
    for record in appearance["objects"].values():
        raw = (ROOT / record["local_path"]).read_bytes()
        assert len(raw) == record["bytes"]
        assert hashlib.sha256(raw).hexdigest() == record["sha256"]
        assert list(image_dimensions(raw)) == record["pixel_dimensions"]
        assert record["kind"] in {"observed_mosaic", "radar_mosaic", "representative_atmosphere"}
        assert record["credit"] and record["source"]["label"] and record["limitations"]
        assert urlparse(record["source"]["file_url"]).hostname in OFFICIAL_HOSTS
        assert record["source"]["file_url"].startswith("https://")


def test_coordinate_windows_select_map_data_without_modifying_figure_files(appearance):
    assert appearance["objects"]["saturn"]["texture_region_px"] == {
        "x": 205,
        "y": 175,
        "width": 874,
        "height": 437,
    }
    for ident in ("saturn", "moon-601", "moon-602", "moon-603", "moon-604", "moon-605"):
        record = appearance["objects"][ident]
        region = record["texture_region_px"]
        width, height = record["pixel_dimensions"]
        assert 0 < region["x"] < region["x"] + region["width"] <= width
        assert 0 < region["y"] < region["y"] + region["height"] <= height
        assert region["width"] / region["height"] == pytest.approx(2, abs=0.003)
        assert record["lat_bounds_deg"] == [-90, 90]
        assert record["longitude_direction"] == "positive_west"
        assert record["longitude_left_deg"] == 360 and record["longitude_right_deg"] == 0
        assert record["region_selection"]
    assert appearance["objects"]["mercury"]["pixel_dimensions"] == [4096, 2048]
    assert "Enhanced color" in appearance["objects"]["mercury"]["limitations"][0]
    assert appearance["objects"]["moon-606"]["observation_period"] == "2004 through 2017"
    assert "938" in appearance["objects"]["moon-606"]["limitations"][0]


def test_no_surface_is_invented_for_missing_maps_or_exoplanets(appearance):
    assert appearance["fallback"]["texture_url"] is None
    assert appearance["fallback"]["kind"] == "illustration"
    for ident in ("epsilon-indi-b", "wasp-4-b", "eris", "sedna", "moon-saturn-s2009s1"):
        assert ident not in appearance["objects"]
    assert appearance["objects"]["uranus"]["kind"] == "representative_atmosphere"
    assert appearance["objects"]["neptune"]["kind"] == "representative_atmosphere"
    assert "F467M" in appearance["objects"]["neptune"]["limitations"][0]
    if "ceres" not in appearance["objects"]:
        assert (
            appearance["reference_images"]["ceres_approach"]["projection"]
            == "unverified_approach_map"
        )


def test_ring_radii_are_center_distances_and_detailed_gaps_have_sources(appearance):
    assert set(appearance["rings"]) == {"saturn", "jupiter", "uranus", "neptune"}
    for record in appearance["rings"].values():
        assert record["units"] == "km" and record["center"] == "planet_center"
        assert record["epoch"] == RING_EPOCH
        assert record["source"]["url"].startswith("https://")
        assert record["pole_source"]["local_path"] == PCK_PATH
        assert record["limitations"]
        for band in record["bands_km"] + record["gaps_km"]:
            assert 0 < band["inner_km"] < band["outer_km"]
    saturn = appearance["rings"]["saturn"]
    gaps = {item["name"]: item for item in saturn["gaps_km"]}
    assert (gaps["Encke gap"]["inner_km"], gaps["Encke gap"]["outer_km"]) == (133423, 133745)
    assert (gaps["Keeler gap"]["inner_km"], gaps["Keeler gap"]["outer_km"]) == (136487, 136522)
    assert "pds-rings.seti.org/saturn" in saturn["source"]["url"]
    assert "vertically extended" in " ".join(appearance["rings"]["jupiter"]["limitations"])


def test_iau_pole_polynomial_and_neptune_periodic_term_have_tdb_units(appearance):
    poles = ring_poles(ROOT)
    centuries = (Time(RING_EPOCH, scale="utc").tdb.jd - 2451545.0) / 36525.0
    assert poles["saturn"]["pole_icrs_deg"] == pytest.approx(
        {"ra": 40.589 - 0.036 * centuries, "dec": 83.537 - 0.004 * centuries}, abs=1e-12
    )
    neptune_angle = math.radians(357.85 + 52.316 * centuries)
    assert poles["neptune"]["pole_icrs_deg"] == pytest.approx(
        {
            "ra": 299.36 + 0.70 * math.sin(neptune_angle),
            "dec": 43.46 - 0.51 * math.cos(neptune_angle),
        },
        abs=1e-12,
    )
    assert poles["uranus"]["pole_icrs_deg"] == {"ra": 257.311, "dec": -15.175}
    for ident, pole in poles.items():
        assert appearance["rings"][ident]["pole_icrs_deg"] == pole["pole_icrs_deg"]
        ra, dec = (math.radians(pole["pole_icrs_deg"][key]) for key in ("ra", "dec"))
        vector = [math.cos(dec) * math.cos(ra), math.cos(dec) * math.sin(ra), math.sin(dec)]
        assert math.hypot(*vector) == pytest.approx(1, abs=1e-15)


def copied_small_manifest(tmp_path):
    manifest = json.loads((ROOT / MANIFEST_PATH).read_text(encoding="utf-8"))
    manifest["objects"] = {"uranus": manifest["objects"]["uranus"]}
    for record in [manifest["objects"]["uranus"], *manifest["reference_sources"]]:
        dest = tmp_path / record["local_path"]
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / record["local_path"], dest)
    target = tmp_path / MANIFEST_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(manifest), encoding="utf-8")
    return manifest, target


def test_changed_local_texture_is_detected_without_touching_originals(tmp_path):
    manifest, _ = copied_small_manifest(tmp_path)
    target = tmp_path / manifest["objects"]["uranus"]["local_path"]
    target.write_bytes(target.read_bytes() + b"changed")
    with pytest.raises(ValueError, match="appearance_asset_integrity"):
        get_appearance(tmp_path)


def test_changed_pole_reference_is_detected_without_touching_originals(tmp_path):
    copied_small_manifest(tmp_path)
    target = tmp_path / PCK_PATH
    target.write_bytes(target.read_bytes() + b"changed")
    with pytest.raises(ValueError, match="appearance_reference_integrity"):
        get_appearance(tmp_path)


@pytest.mark.parametrize("change", ["path", "region"])
def test_manifest_paths_and_native_pixel_windows_are_bounded(tmp_path, change):
    manifest, path = copied_small_manifest(tmp_path)
    record = manifest["objects"]["uranus"]
    if change == "path":
        record["local_path"] = "web/public/textures/../../outside.png"
    else:
        record["texture_region_px"] = {"x": 0, "y": 0, "width": 999999, "height": 1}
    path.write_text(json.dumps(deepcopy(manifest)), encoding="utf-8")
    with pytest.raises(ValueError, match="invalid_appearance_path|appearance_region_bounds"):
        get_appearance(tmp_path)
