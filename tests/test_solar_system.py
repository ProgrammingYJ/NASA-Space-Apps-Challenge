"""Bounded solar scene tests, including a separate Horizons units/frame query.

The cross-check uses the same JPL dynamical model through a different request
path (ICRF/KM-S/single JD), not an independent dynamical ephemeris solution.
"""

import hashlib
import json
import math
from pathlib import Path

import numpy as np
import pytest

from science.solar_system import EPHEMERIS_MANIFEST, EPOCHS, get_universe

ROOT = Path(__file__).resolve().parents[1]


def test_exact_source_epochs_bodies_and_units():
    scene = get_universe(ROOT)
    assert scene["epoch"] == "2026-11-14T00:00:00Z"
    assert scene["available_epochs"] == EPOCHS
    assert scene["coordinate_frame"] == "Ecliptic of J2000.0"
    assert scene["center"]["horizons_id"] == "10"
    assert scene["units"] == {"position": "au", "velocity": "au/day", "radius": "km"}
    assert {body["object_id"] for body in scene["objects"]} == {
        "sun",
        "mercury",
        "venus",
        "earth",
        "mars",
        "jupiter",
        "saturn",
        "uranus",
        "neptune",
        "pluto",
        "epsilon-indi-b",
    }
    by_id = {body["object_id"]: body for body in scene["objects"]}
    assert by_id["sun"]["position_au"] == [0, 0, 0]
    assert by_id["earth"]["radius_km"] == 6371.0084
    assert by_id["jupiter"]["radius_km"] == 69911
    assert by_id["pluto"]["radius_km"] == 1188.3
    assert by_id["sun"]["radius_km"] == 695700
    assert by_id["earth"]["radius_source"]["uncertainty_km"] == 0.0001
    assert by_id["jupiter"]["radius_source"]["uncertainty_km"] == 6
    assert by_id["pluto"]["radius_source"]["uncertainty_km"] == 1.6
    assert by_id["pluto"]["horizons_id"] == "999"  # Pluto center, not system barycenter 9.
    json.dumps(scene, allow_nan=False)


@pytest.mark.parametrize("epoch", EPOCHS)
def test_each_selected_time_is_an_exact_queried_state(epoch):
    manifest = json.loads((ROOT / EPHEMERIS_MANIFEST).read_text(encoding="utf-8"))
    scene = get_universe(ROOT, epoch)
    assert scene["epoch"] == epoch
    by_id = {body["object_id"]: body for body in scene["objects"]}
    for source in manifest["bodies"]:
        sample = next(sample for sample in source["samples"] if sample["epoch_utc"] == epoch)
        assert by_id[source["object_id"]]["position_au"] == sample["position_au"]
        assert by_id[source["object_id"]]["velocity_au_day"] == sample["velocity_au_day"]
        assert by_id[source["object_id"]]["position_kind"] == "geometric_ephemeris_sample"


@pytest.mark.parametrize(
    "epoch", ["2026-11-14T12:00:00Z", "2026-11-12T00:00:00Z", "2027-01-01T00:00:00Z"]
)
def test_unqueried_time_is_rejected_instead_of_extrapolated(epoch):
    with pytest.raises(ValueError, match="unsupported_scene_epoch"):
        get_universe(ROOT, epoch)


def test_separate_horizons_icrf_km_query_validates_frame_and_units():
    # Retrieved 2026-11-14 with official Horizons API, separately from the dataset:
    # COMMAND=399/599/999, CENTER=500@10, TLIST=2461358.5, TLIST_TYPE=JD,
    # TIME_TYPE=UT, REF_PLANE=FRAME, REF_SYSTEM=ICRF, OUT_UNITS=KM-S,
    # VEC_TABLE=3, VEC_CORR=NONE, CSV_FORMAT=YES, OBJ_DATA=NO.
    # https://ssd-api.jpl.nasa.gov/doc/horizons.html
    references_icrf_km = {
        "earth": [92654042.66140375, 105927818.1536438, 45917248.95318533],
        "jupiter": [-559164250.3996062, 515668258.3312439, 234640631.8555878],
        "pluto": [3004227865.979241, -3865796609.192666, -2111449672.949486],
    }
    range_km = {
        "earth": 1.480333341910580e8,
        "jupiter": 7.960117070074544e8,
        "pluto": 5.331790338692080e9,
    }
    by_id = {body["object_id"]: body for body in get_universe(ROOT)["objects"]}
    epsilon = math.radians(84381.448 / 3600)  # Horizons manual's exact IAU76/80 rotation.
    au_km = 149597870.700  # IAU2012 exact astronomical unit; JPL astrodynamic parameters.
    for object_id, (x, y, z) in references_icrf_km.items():
        expected = [
            x / au_km,
            (y * math.cos(epsilon) + z * math.sin(epsilon)) / au_km,
            (-y * math.sin(epsilon) + z * math.cos(epsilon)) / au_km,
        ]
        assert by_id[object_id]["position_au"] == pytest.approx(expected, abs=1e-12)
        assert math.sqrt(
            sum(value**2 for value in by_id[object_id]["position_au"])
        ) * au_km == pytest.approx(range_km[object_id], abs=0.001)


def test_direction_marker_has_no_invented_physical_distance():
    marker = next(
        body for body in get_universe(ROOT)["objects"] if body["object_id"] == "epsilon-indi-b"
    )
    assert marker["kind"] == "direction"
    assert marker["distance_au"] is None
    assert "position_au" not in marker
    assert marker["radius_km"] is None
    direction = marker["direction_ecliptic"]
    assert math.sqrt(sum(component**2 for component in direction)) == pytest.approx(1, abs=1e-14)
    epsilon = math.radians(84381.448 / 3600)
    # Independently inverse-rotate the direction to the reported propagated ICRS.
    x, y, z = direction
    equatorial = [
        x,
        y * math.cos(epsilon) - z * math.sin(epsilon),
        y * math.sin(epsilon) + z * math.cos(epsilon),
    ]
    ra = math.degrees(math.atan2(equatorial[1], equatorial[0])) % 360
    dec = math.degrees(math.asin(equatorial[2]))
    assert marker["direction_icrs_deg"]["ra"] == pytest.approx(ra, abs=1e-10)
    assert marker["direction_icrs_deg"]["dec"] == pytest.approx(dec, abs=1e-10)


def test_original_bounded_responses_are_preserved_and_hashed():
    manifest = json.loads((ROOT / EPHEMERIS_MANIFEST).read_text(encoding="utf-8"))
    for body in manifest["bodies"]:
        source = body["ephemeris_source"]
        raw = source["raw_response_json"].encode("utf-8")
        assert len(raw) == source["response_bytes"] <= 200000
        assert hashlib.sha256(raw).hexdigest() == source["response_sha256"]
        assert source["url"].startswith("https://ssd.jpl.nasa.gov/api/horizons.api?")
        assert source["parameters"]["CENTER"] == "'500@10'"
        assert source["parameters"]["VEC_CORR"] == "'NONE'"
        assert source["parameters"]["TIME_TYPE"] == "'UT'"
    physical = manifest["physical_parameters_source"]
    assert (
        hashlib.sha256(physical["raw_response_html"].encode("utf-8")).hexdigest()
        == physical["response_sha256"]
    )


def test_source_corruption_is_rejected(tmp_path):
    manifest = json.loads((ROOT / EPHEMERIS_MANIFEST).read_text(encoding="utf-8"))
    target = tmp_path / EPHEMERIS_MANIFEST
    target.parent.mkdir(parents=True)
    manifest["bodies"][0]["ephemeris_source"]["raw_response_json"] += " "
    target.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="ephemeris_source_integrity"):
        get_universe(tmp_path)


def test_display_states_are_finite_for_all_supported_epochs():
    for epoch in EPOCHS:
        for body in get_universe(ROOT, epoch)["objects"]:
            if body["kind"] == "solar_system":
                assert np.isfinite(body["position_au"]).all()
                assert np.isfinite(body["velocity_au_day"]).all()
                assert body["radius_km"] > 0
