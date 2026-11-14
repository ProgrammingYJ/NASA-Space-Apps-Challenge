"""Time, Kepler rotation and independently queried reference-state checks."""

from __future__ import annotations

import hashlib
import json
import math
import shutil
from pathlib import Path

import numpy as np
import pytest
from scipy.optimize import brentq

from science import long_term_model as model
from science.long_term_validation import AU_KM, parse_reference

ROOT = Path(__file__).resolve().parents[1]


def independent_gregorian_jd(year, month, day, hour=0):
    # Integer Gregorian JDN construction, independent of Astropy/ERFA.
    a = (14 - month) // 12
    y = year + 4800 - a
    m = month + 12 * a - 3
    jdn = day + (153 * m + 2) // 5 + 365 * y + y // 4 - y // 100 + y // 400 - 32045
    return jdn - 0.5 + hour / 24


def independent_position(row, jd):
    # Bracketed Kepler solve and explicit rotation matrices differ from the
    # production Newton solve and component-basis implementation.
    T = (jd - 2451545) / 36525
    a, e, i, L, p, node = np.array(row["elements_j2000"]) + T * np.array(row["rates_per_century"])
    b, c, s, f = (row["additional_terms"][k] for k in ["b", "c", "s", "f"])
    anomaly = L - p + b * T**2 + c * np.cos(np.deg2rad(f * T)) + s * np.sin(np.deg2rad(f * T))
    mean = np.deg2rad(anomaly % 360)
    eccentric = brentq(lambda E: E - e * np.sin(E) - mean, 0, 2 * np.pi, xtol=1e-14)
    r = np.array([a * (np.cos(eccentric) - e), a * np.sqrt(1 - e**2) * np.sin(eccentric), 0])

    def rz(x):
        return np.array([[np.cos(x), -np.sin(x), 0], [np.sin(x), np.cos(x), 0], [0, 0, 1]])

    inc = np.deg2rad(i)
    rx = np.array([[1, 0, 0], [0, np.cos(inc), -np.sin(inc)], [0, np.sin(inc), np.cos(inc)]])
    return rz(np.deg2rad(node)) @ rx @ rz(np.deg2rad(p - node)) @ r


@pytest.mark.parametrize(
    "date",
    [
        (-2999, 1, 1),
        (-1000, 1, 1),
        (0, 2, 29),
        (1, 1, 1),
        (99, 12, 31),
        (100, 3, 1),
        (1582, 10, 10),
        (1800, 1, 1),
        (1970, 1, 1),
        (2000, 1, 1),
        (2026, 11, 14),
        (3000, 1, 1),
    ],
)
def test_astronomical_calendar_against_independent_integer_jdn(date):
    assert model.calendar_jd(*date) == independent_gregorian_jd(*date)
    assert model.calendar_jd(*date, 12.5) == independent_gregorian_jd(*date, 12.5)


@pytest.mark.parametrize(
    "date",
    [
        (1900, 2, 29),
        (2026, 2, 30),
        (0, 13, 1),
        (1, 0, 1),
        (1, 1, 0),
        (-3000, 1, 1),
        (3001, 1, 1),
        (True, 1, 1),
    ],
)
def test_invalid_calendar_dates_are_rejected(date):
    with pytest.raises(ValueError):
        model.calendar_jd(*date)


def test_time_scale_epoch_and_fractional_day_are_explicit():
    assert model.calendar_jd(2000, 1, 1, 12) == 2451545
    assert model.calendar_jd(1970, 1, 1) == 2440587.5
    assert model.calendar_jd(0, 1, 1) < model.calendar_jd(1, 1, 1)
    for hour in [float("nan"), float("inf"), -1, 24, True]:
        with pytest.raises(ValueError):
            model.calendar_jd(2000, 1, 1, hour)


def test_current_source_tables_errors_and_unsupported_objects():
    value = model.get_long_term_model(ROOT)
    assert len(value["tables"]["long"]["bodies"]) == len(value["tables"]["short"]["bodies"]) == 8
    earth = next(v for v in value["tables"]["long"]["bodies"] if v["object_id"] == "earth")
    assert earth["model_body_id"] == "earth-moon-barycenter" and earth["reference_target"] == "3"
    assert "Pluto" in value["unsupported"] and "Earth center" in value["unsupported"]
    assert value["default_table"] == "long"
    assert value["tables"]["long"]["bodies"][4]["additional_terms"]["f"] == 38.35125
    source = value["source"]
    assert "Pluto has also been removed" in (ROOT / source["local_relative_path"]).read_text(
        encoding="utf-8"
    )
    for fit in value["tables"].values():
        assert all(v["nominal_errors"]["distance_thousand_km"] > 0 for v in fit["bodies"])


def test_positions_against_independent_kepler_solve_and_rotation_matrices():
    data = model.get_long_term_model(ROOT)
    for family, dates in [
        ("long", [(-1000, 1, 1), (0, 1, 1), (2026, 11, 14), (2500, 1, 1)]),
        ("short", [(1800, 1, 1), (2000, 1, 1), (2026, 11, 14)]),
    ]:
        for date in dates:
            jd = independent_gregorian_jd(*date)
            for row in data["tables"][family]["bodies"]:
                np.testing.assert_allclose(
                    model.position_au(row, jd), independent_position(row, jd), atol=2e-10, rtol=0
                )


def test_explicit_bounds_no_automatic_fit_switch_and_no_observation_claim():
    for date in [(-2999, 1, 1), (3000, 1, 1), (1799, 12, 31), (2050, 1, 1)]:
        state = model.sample_long_term(ROOT, *date)
        assert state["table"] == "long" and state["position_kind"] == "approximate_simulation"
        assert len(state["objects"]) == 8
        assert all(np.isfinite(v["position_au"]).all() for v in state["objects"])
        assert state["time_scale"] == "TDB"
    with pytest.raises(ValueError):
        model.sample_long_term(ROOT, 3000, 1, 1, 0.01)
    with pytest.raises(ValueError):
        model.sample_long_term(ROOT, 3000, 1, 2)
    with pytest.raises(ValueError):
        model.sample_long_term(ROOT, 1799, table="short")
    with pytest.raises(ValueError):
        model.sample_long_term(ROOT, 2050, 1, 2, table="short")
    with pytest.raises(ValueError):
        model.sample_long_term(ROOT, 2000, table="unknown")


def test_independent_horizons_samples_and_reported_discrepancies():
    value = json.loads((ROOT / "data/manifests/long_term_validation.json").read_bytes())
    metadata = model.get_long_term_model(ROOT)
    assert value["model_manifest_sha256"] == metadata["source_manifest_sha256"]
    assert len(value["results"]) == 8
    counts = {"long": 0, "short": 0}
    for row in value["results"]:
        source = row["source"]
        raw = (ROOT / source["local_relative_path"]).read_bytes()
        assert len(raw) == source["bytes"] and hashlib.sha256(raw).hexdigest() == source["sha256"]
        references = parse_reference(raw, row["reference_target"])
        assert source["parameters"]["TIME_TYPE"] == "TDB"
        assert source["parameters"]["VEC_CORR"] == "NONE"
        for check, reference in zip(row["checks"], references, strict=True):
            jd = independent_gregorian_jd(**check["date_tdb"])
            assert jd == check["jd_tdb"] == reference["jd_tdb"]
            np.testing.assert_array_equal(check["position_au"], reference["position_au"])
            for family, stored in check["fits"].items():
                counts[family] += 1
                body = next(
                    v
                    for v in metadata["tables"][family]["bodies"]
                    if v["object_id"] == row["object_id"]
                )
                p = independent_position(body, jd)
                r = np.array(reference["position_au"])
                np.testing.assert_allclose(stored["position_au"], p, atol=2e-10, rtol=0)
                assert math.isclose(
                    stored["vector_error_km"], np.linalg.norm(p - r) * AU_KM, abs_tol=0.05
                )
                # Broad sanity only, not a source-nominal or global error bound:
                # it catches frame/phase/unit mistakes against actual ephemerides.
                angular = math.acos(
                    float(np.clip(np.dot(p, r) / (np.linalg.norm(p) * np.linalg.norm(r)), -1, 1))
                )
                assert angular < math.radians(1)
                assert abs(np.linalg.norm(p) / np.linalg.norm(r) - 1) < 0.05
    assert counts == {"long": 32, "short": 16}
    assert value["summary"]["long"]["sample_count"] == 32


def test_offline_reader_and_source_or_coefficient_corruption(tmp_path, monkeypatch):
    def forbidden(*_a, **_kw):
        raise AssertionError("Unexpected runtime fetch")

    monkeypatch.setattr(model, "urlopen", forbidden)
    data = model.get_long_term_model(ROOT)
    m = tmp_path / model.MANIFEST
    m.parent.mkdir(parents=True)
    source = tmp_path / data["source"]["local_relative_path"]
    source.parent.mkdir(parents=True)
    shutil.copyfile(ROOT / data["source"]["local_relative_path"], source)
    data.pop("source_manifest_sha256")
    m.write_text(json.dumps(data), encoding="utf-8")
    assert model.get_long_term_model(tmp_path)
    data["tables"]["long"]["bodies"][4]["additional_terms"]["f"] = 0
    m.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ValueError, match="coefficients_changed"):
        model.get_long_term_model(tmp_path)
    shutil.copyfile(ROOT / model.MANIFEST, m)
    source.write_bytes(source.read_bytes() + b" ")
    with pytest.raises(ValueError, match="source_integrity"):
        model.get_long_term_model(tmp_path)


def test_original_precise_inputs_remain_immutable():
    expected = {
        "solar_system_ephemeris.json": "83fb1ac397b4c64e36377965efe57f9a1bf19e5b1a60ce290a12b39411613a8a",
        "solar_system_orbits.json": "b58622f6ce82c686c644c26c48625ab3d3af8a36fb426790939ab6473ba6c623",
        "timeline_validation.json": "6562f9898ba8716d41595f1b9288c0cf364b3ec4119e02cafb6a961a19527f99",
    }
    for filename, expected_hash in expected.items():
        assert (
            hashlib.sha256((ROOT / "data/manifests" / filename).read_bytes()).hexdigest()
            == expected_hash
        )


def test_new_read_api_routes_preserve_calendar_contract_and_reject_invalid_dates():
    from fastapi.testclient import TestClient

    from api.main import create_app

    # These pure read routes need no worker/state lifecycle or observation jobs.
    client = TestClient(create_app())
    response = client.get("/api/v1/long-term-model")
    assert response.status_code == 200
    assert response.json()["algorithm_version"] == model.ALGORITHM
    for year in [-2999, 0, 1, 99, 100, 2026, 3000]:
        response = client.get("/api/v1/long-term-simulation", params={"year": year})
        assert response.status_code == 200
        assert response.json()["jd_tdb"] == independent_gregorian_jd(year, 1, 1)
        assert response.json()["time_scale"] == "TDB"
    for params in [
        {"year": -3000},
        {"year": 3001},
        {"year": 3000, "day": 2},
        {"year": 1900, "month": 2, "day": 29},
        {"year": 2000, "hour": "nan"},
        {"year": 2000, "hour": "inf"},
    ]:
        assert client.get("/api/v1/long-term-simulation", params=params).status_code == 422


def test_simulation_api_distinguishes_corrupt_sources_from_invalid_dates(monkeypatch):
    from fastapi.testclient import TestClient

    from api.main import create_app

    def corrupt_source(*args, **kwargs):
        raise ValueError("long_term_source_integrity")

    monkeypatch.setattr(model, "sample_long_term", corrupt_source)
    client = TestClient(create_app())
    response = client.get("/api/v1/long-term-simulation", params={"year": 2026})
    assert response.status_code == 503
    assert response.json()["code"] == "simulation_source_unavailable"
