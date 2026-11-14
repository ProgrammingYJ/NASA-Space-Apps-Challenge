"""Rounded official directions, contextual gallery extraction and distance units."""

import json
import math
import shutil
from pathlib import Path

import pytest

from science import galaxies

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def actual():
    return galaxies.get_galaxies(ROOT)


@pytest.mark.parametrize(
    "object_id,h,m,s,d,dm,ds,million_ly",
    [
        ("galaxy-m31", 0, 42, 44, 41, 16, 9, 2.5),
        ("galaxy-m33", 1, 33, 50, 30, 39, 37, 3),
        ("galaxy-m81", 9, 55, 33, 69, 3, 55, 11.6),
        ("galaxy-m87", 12, 30, 49, 12, 23, 28, 54),
    ],
)
def test_actual_primary_source_coordinates_and_distances(
    actual, object_id, h, m, s, d, dm, ds, million_ly
):
    obj = next(obj for obj in actual["objects"] if obj["object_id"] == object_id)
    # Independent sexagesimal arithmetic against values read in the published
    # CXC Fast Facts blocks, not a copied output of the implementation's Angle.
    assert obj["direction_icrs_deg"]["ra"] == pytest.approx(15 * (h + m / 60 + s / 3600), abs=1e-12)
    assert obj["direction_icrs_deg"]["dec"] == pytest.approx(d + dm / 60 + ds / 3600, abs=1e-12)
    assert obj["distance_ly"] == million_ly * 1e6
    # IAU AU definition, speed of light and Julian year supply a unit check
    # independent of the implementation's Astropy conversion. No accuracy is
    # added to the rounded source distance.
    meters_per_lightyear = 299_792_458 * 365.25 * 86_400
    meters_per_parsec = 648_000 / math.pi * 149_597_870_700
    assert obj["distance_mpc"] == pytest.approx(
        million_ly * meters_per_lightyear / meters_per_parsec, rel=1e-14
    )
    assert obj["distance_uncertainty"] is None
    assert "J2000" in obj["native_coordinates"]["coordinate_reference"]
    assert "approximate_display" in obj["direction_kind"]
    source_text = (ROOT / obj["coordinate_source"]["local_relative_path"]).read_text(
        encoding="utf-8"
    )
    label = next(
        spec["facts"] for spec in galaxies.SPECIFICATIONS if "galaxy-" + spec["id"] == object_id
    )
    facts = galaxies.parse_fast_facts(source_text, label)
    assert facts["ra_sexagesimal"] == obj["native_coordinates"]["ra_sexagesimal"]
    assert (
        facts["original_coordinate_text"] == obj["native_coordinates"]["original_coordinate_text"]
    )


def test_catalog_retains_source_difference_and_never_claims_actual_pose(actual):
    assert len(actual["objects"]) == len({obj["object_id"] for obj in actual["objects"]}) == 9
    assert len(actual["sources"]) == 17
    assert actual["images_downloaded"] is False
    assert [obj["morphology"] for obj in actual["objects"]].count("elliptical") == 2
    m87 = next(obj for obj in actual["objects"] if obj["object_id"] == "galaxy-m87")
    assert m87["source_difference"]["coordinate_page_distance_million_ly"] == 55
    assert m87["source_difference"]["adopted_nasa_distance_million_ly"] == 54
    assert "frame-bias" in actual["coordinate_policy"]
    assert "physical pose" in " ".join(actual["limitations"])
    assert not any("position_au" in obj or "velocity" in obj for obj in actual["objects"])
    json.dumps(actual, allow_nan=False)


def test_gallery_extractor_selects_target_facts_instead_of_first_coordinate():
    document = """<h3>Fast Facts for Other:</h3>Coordinates (J2000) RA 12h 00m 00s | Dec +30° 00' 00" Distance Estimate About 99 million light-years
    <h3>Fast Facts for M33:</h3>Coordinates (J2000): RA: 01h 33m 50s | Dec: +30° 39' 37" Distance Estimate: About 3 million light-years"""
    facts = galaxies.parse_fast_facts(document, "M33")
    assert facts["distance_million_ly"] == 3
    assert facts["ra"] < 24
    negative = document.replace("+30° 39' 37", "-00° 39' 37")
    assert galaxies.parse_fast_facts(negative, "M33")["dec"] == pytest.approx(-39 / 60 - 37 / 3600)
    with pytest.raises(ValueError, match="galaxy_fast_facts_missing"):
        galaxies.parse_fast_facts(document, "Missing")
    with pytest.raises(ValueError, match="invalid_source_galaxy_coordinates"):
        galaxies.parse_fast_facts(document.replace("01h 33m 50s", "25h 33m 50s"), "M33")


def test_reader_never_fetches_and_rejects_changed_source(monkeypatch, tmp_path, actual):
    def forbidden(*args, **kwargs):
        raise AssertionError("Runtime network access")

    monkeypatch.setattr(galaxies, "urlopen", forbidden)
    assert len(galaxies.get_galaxies(ROOT)["objects"]) == 9
    shutil.copytree(ROOT / galaxies.RAW_ROOT, tmp_path / galaxies.RAW_ROOT)
    manifest_path = tmp_path / galaxies.MANIFEST
    manifest_path.parent.mkdir(parents=True)
    manifest_path.write_text(json.dumps(actual), encoding="utf-8")
    source_path = tmp_path / actual["sources"]["m81_nasa"]["local_relative_path"]
    source_path.write_bytes(b"changed source")
    with pytest.raises(ValueError, match="galaxy_source_integrity"):
        galaxies.get_galaxies(tmp_path)


def test_source_path_escape_and_invalid_schema_rejected(tmp_path, actual):
    shutil.copytree(ROOT / galaxies.RAW_ROOT, tmp_path / galaxies.RAW_ROOT)
    manifest_path = tmp_path / galaxies.MANIFEST
    manifest_path.parent.mkdir(parents=True)
    changed = json.loads(json.dumps(actual))
    changed["sources"]["m81_nasa"]["local_relative_path"] = "../outside.html"
    manifest_path.write_text(json.dumps(changed), encoding="utf-8")
    with pytest.raises(ValueError, match="galaxy_source_missing_or_outside_root"):
        galaxies.get_galaxies(tmp_path)
    changed["schema_version"] = "unsupported"
    manifest_path.write_text(json.dumps(changed), encoding="utf-8")
    with pytest.raises(ValueError, match="unsupported_galaxy_schema"):
        galaxies.get_galaxies(tmp_path)


@pytest.mark.parametrize(
    "slug,h,m,s,d,dm,ds,distance",
    [
        ("lmc", 5, 23, 34.6, -69, 45, 22, 160000),
        ("smc", 0, 52, 44.8, -72, 49, 43, 200000),
        ("m51", 13, 29, 52.3, 47, 11, 54, 31e6),
        ("m104", 12, 39, 59.4, -11, 37, 23, 28e6),
        ("centaurus-a", 13, 25, 27.62, -43, 1, 8.8, 12e6),
    ],
)
def test_additional_five_have_actual_reference_directions_and_distances(
    actual, slug, h, m, s, d, dm, ds, distance
):
    obj = next(obj for obj in actual["objects"] if obj["object_id"] == "galaxy-" + slug)
    assert obj["direction_icrs_deg"]["ra"] == pytest.approx(15 * (h + m / 60 + s / 3600), abs=1e-12)
    assert obj["direction_icrs_deg"]["dec"] == pytest.approx(
        (1 if d >= 0 else -1) * (abs(d) + dm / 60 + ds / 3600), abs=1e-12
    )
    assert obj["distance_ly"] == distance
    assert obj["coordinate_source"]["sha256"] and obj["distance_source"]["sha256"]
    assert obj["image_source"]["url"].startswith("https://")
    if slug == "lmc":
        assert "ICRS epoch J2000" in obj["native_coordinates"]["coordinate_reference"]
        assert "2003A&A...412...45P" in obj["native_coordinates"]["coordinate_reference"]


def test_nine_distinct_shape_guides_keep_only_sourced_numeric_values(actual):
    shapes = {obj["object_id"]: obj["appearance"] for obj in actual["objects"]}
    assert len({shape["renderer"] for shape in shapes.values()}) == 9
    assert shapes["galaxy-m31"]["inclination_deg"] == 77
    assert all(shape["position_angle_deg"] is None for shape in shapes.values())
    assert all(
        shape["inclination_deg"] is None for key, shape in shapes.items() if key != "galaxy-m31"
    )
    assert shapes["galaxy-m81"]["arms"] == 2
    assert shapes["galaxy-lmc"]["arms"] == 1
    assert shapes["galaxy-m87"]["arms"] == 0
    assert shapes["galaxy-m51"]["companion"]["name"] == "NGC 5195"
    assert shapes["galaxy-m51"]["companion"]["display_offset_is_assumed"] is True
    assert "renderer style" in shapes["galaxy-m33"]["classification_note"]
    assert (
        (ROOT / shapes["galaxy-m81"]["source"]["local_relative_path"])
        .read_bytes()
        .startswith(b"%PDF")
    )
    old = json.loads((ROOT / actual["superseded_catalog"]["local_relative_path"]).read_bytes())
    current = {obj["object_id"]: obj for obj in actual["objects"]}
    for previous in old["objects"]:
        assert (
            current[previous["object_id"]]["direction_icrs_deg"] == previous["direction_icrs_deg"]
        )
        assert current[previous["object_id"]]["distance_ly"] == previous["distance_ly"]
        assert current[previous["object_id"]]["coordinate_source"] == previous["coordinate_source"]
