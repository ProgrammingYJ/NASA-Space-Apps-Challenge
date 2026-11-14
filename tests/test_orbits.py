"""Instantaneous ellipse guide checks, separate from integrated orbit claims."""

import hashlib
import json
from pathlib import Path

import numpy as np
import pytest
from astropy.time import Time

from science.orbits import ORBIT_MANIFEST, ellipse_points, get_orbits
from science.solar_system import BODY_IDS, EPOCHS, get_universe

ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize("epoch", EPOCHS)
def test_actual_nine_curves_match_separate_vector_states_and_source_epoch(epoch):
    data = get_orbits(ROOT, epoch)
    scene = get_universe(ROOT, epoch)
    states = {body["object_id"]: body for body in scene["objects"]}
    assert set(data["orbits"]) == set(BODY_IDS)
    assert set(data["exclusions"]) == {"sun", "epsilon-indi-b"}
    for object_id, orbit in data["orbits"].items():
        assert orbit["kind"] == "osculating_kepler_guide"
        assert orbit["epoch"] == epoch
        assert orbit["epoch_tdb_jd"] == pytest.approx(
            float(Time(epoch, scale="utc").tdb.jd), abs=1e-9
        )
        assert orbit["units"] == "au"
        assert orbit["coordinate_frame"] == "Ecliptic of J2000.0"
        assert orbit["center"] == "Sun (10)"
        points = np.asarray(orbit["points_au"])
        assert points.shape == (257, 3)
        assert np.isfinite(points).all()
        assert np.array_equal(points[0], points[-1])
        # VECTORS/UTC is a separate Horizons request from ELEMENTS/TDB. The first
        # vertex uses source true anomaly, testing rotation, phase, units/time.
        residual = np.linalg.norm(points[0] - np.asarray(states[object_id]["position_au"]))
        assert residual < 1e-9
        assert residual == pytest.approx(orbit["state_check_residual_au"], abs=1e-16)
        assert any("not a full-period integrated" in text for text in orbit["limitations"])
    json.dumps(data, allow_nan=False)


def test_independent_right_angle_rotation_and_sun_focus():
    # Perihelion points +Y; a quarter eccentric anomaly points +Z. This is a
    # hand-solvable inclined ellipse, rather than copying the matrix algorithm.
    elements = {
        "a_au": 2.0,
        "e": 0.25,
        "inclination_deg": 90,
        "node_deg": 90,
        "argument_periapsis_deg": 0,
        "true_anomaly_deg": 0,
    }
    points = ellipse_points(elements)
    assert points[0] == pytest.approx([0, 1.5, 0], abs=1e-14)
    assert points[64] == pytest.approx([0, -0.5, np.sqrt(3.75)], abs=1e-14)
    assert points[128] == pytest.approx([0, -2.5, 0], abs=1e-14)
    assert np.max(np.abs(points[:, 0])) < 1e-14
    # Focus-to-point distances sum to 2a for the Sun and the second focus.
    other_focus = np.array([0, -1, 0])
    assert np.linalg.norm(points, axis=1) + np.linalg.norm(
        points - other_focus, axis=1
    ) == pytest.approx(np.full(257, 4.0), abs=1e-13)


def test_arbitrary_angles_against_independent_basis_vectors():
    elements = {
        "a_au": 3.2,
        "e": 0.4,
        "inclination_deg": 27.1,
        "node_deg": 71.3,
        "argument_periapsis_deg": 46.7,
        "true_anomaly_deg": 123.4,
    }
    points = ellipse_points(elements)
    node, peri, inc, anomaly = np.deg2rad([71.3, 46.7, 27.1, 123.4])
    p = np.array(
        [
            np.cos(node) * np.cos(peri) - np.sin(node) * np.sin(peri) * np.cos(inc),
            np.sin(node) * np.cos(peri) + np.cos(node) * np.sin(peri) * np.cos(inc),
            np.sin(peri) * np.sin(inc),
        ]
    )
    q = np.array(
        [
            -np.cos(node) * np.sin(peri) - np.sin(node) * np.cos(peri) * np.cos(inc),
            -np.sin(node) * np.sin(peri) + np.cos(node) * np.cos(peri) * np.cos(inc),
            np.cos(peri) * np.sin(inc),
        ]
    )
    radius = 3.2 * (1 - 0.4**2) / (1 + 0.4 * np.cos(anomaly))
    expected = radius * (p * np.cos(anomaly) + q * np.sin(anomaly))
    assert points[0] == pytest.approx(expected, abs=1e-13)
    assert points @ np.cross(p, q) == pytest.approx(np.zeros(257), abs=1e-13)


def test_original_element_responses_and_kepler_conventions():
    manifest = json.loads((ROOT / ORBIT_MANIFEST).read_text(encoding="utf-8"))
    assert manifest["source_time_scale"] == "TDB"
    assert manifest["scene_time_scale"] == "UTC"
    for body in manifest["bodies"]:
        source = body["source"]
        raw = source["raw_response_json"].encode("utf-8")
        assert hashlib.sha256(raw).hexdigest() == source["response_sha256"]
        assert len(raw) == source["response_bytes"] <= 200000
        assert source["parameters"]["CENTER"] == "'500@10'"
        assert source["parameters"]["EPHEM_TYPE"] == "'ELEMENTS'"
        assert source["parameters"]["TIME_TYPE"] == "'TDB'"
        assert body["horizons_id"] == BODY_IDS[body["object_id"]]
        for sample in body["samples"]:
            e = sample["elements"]
            expected_period = 2 * np.pi * np.sqrt(e["a_au"] ** 3 / body["keplerian_gm_au3_day2"])
            assert e["period_days"] == pytest.approx(expected_period, rel=1e-11)


def test_no_orbit_is_invented_for_unsupported_epoch_or_corrupt_source(tmp_path):
    with pytest.raises(ValueError, match="unsupported_orbit_epoch"):
        get_orbits(ROOT, "2026-11-14T12:00:00Z")
    manifest = json.loads((ROOT / ORBIT_MANIFEST).read_text(encoding="utf-8"))
    manifest["bodies"][0]["source"]["raw_response_json"] += " "
    path = tmp_path / ORBIT_MANIFEST
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps(manifest), encoding="utf-8")
    # Copy only the preexisting scene manifest needed for the independent check.
    scene_path = tmp_path / "data/manifests/solar_system_ephemeris.json"
    scene_path.write_bytes((ROOT / "data/manifests/solar_system_ephemeris.json").read_bytes())
    with pytest.raises(ValueError, match="orbit_source_integrity"):
        get_orbits(tmp_path)


@pytest.mark.parametrize("eccentricity", [-0.1, 1.0, 1.2, np.nan])
def test_nonelliptic_input_is_rejected(eccentricity):
    with pytest.raises(ValueError, match="unsupported_nonelliptic_orbit"):
        ellipse_points({"a_au": 1, "e": eccentricity})
