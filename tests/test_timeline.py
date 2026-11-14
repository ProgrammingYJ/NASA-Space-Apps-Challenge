"""Display-only timeline math, range limits, source preservation and validation."""

import csv
import hashlib
import io
import json
from datetime import UTC
from pathlib import Path

import numpy as np
import pytest
from astropy.time import Time

from science.solar_system import BODY_IDS, EPOCHS, get_universe
from science.timeline import (
    AU_KM,
    VALIDATION_MANIFEST,
    get_timeline,
    hermite_state,
    sample_timeline,
)

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def timeline():
    return get_timeline(ROOT)


def test_small_payload_provides_actual_source_knots(timeline):
    assert len(json.dumps(timeline, allow_nan=False)) < 20000
    assert timeline["algorithm_version"] == "display-hermite-v1"
    assert timeline["time_coordinate"] == "TDB"
    assert timeline["guide_reference_epoch"] == "2026-11-14T00:00:00Z"
    assert [knot["epoch"] for knot in timeline["knots"]] == EPOCHS
    for knot in timeline["knots"]:
        assert set(knot["states"]) == set(BODY_IDS)
        assert knot["tdb_jd"] == float(Time(knot["epoch"], scale="utc").tdb.jd)


@pytest.mark.parametrize("epoch", EPOCHS)
def test_endpoint_source_position_velocity_and_provenance_are_exact(timeline, epoch):
    scene = sample_timeline(ROOT, epoch, timeline=timeline)
    original = get_universe(ROOT, epoch)
    by_id = {body["object_id"]: body for body in original["objects"]}
    assert scene["epoch"] == epoch
    assert scene["position_sampling"] == "source_exact"
    assert scene["interpolation"]["method"] == "none"
    for body in scene["objects"]:
        source = by_id[body["object_id"]]
        if body["object_id"] in BODY_IDS:
            assert body["position_au"] == source["position_au"]
            assert body["velocity_au_day"] == source["velocity_au_day"]
            assert body["source"] == source["source"]
            assert body["position_kind"] == "geometric_ephemeris_sample"


def test_hermite_reproduces_independently_defined_cubic_with_tdb_day_units():
    # A known polynomial provides both positions and analytic derivatives, with
    # a non-unit interval to catch omitted/scaled velocity terms.
    def position(t):
        return np.array([1 + 2 * t + 3 * t * t + 4 * t**3, -3 + t * t, 7 - 5 * t])

    def velocity(t):
        return np.array([2 + 6 * t + 12 * t * t, 2 * t, -5])

    interval = 2.5
    for fraction in (0, 0.1, 0.35, 0.8, 1):
        p, v = hermite_state(
            position(0), velocity(0), position(interval), velocity(interval), fraction, interval
        )
        assert p == pytest.approx(position(fraction * interval), abs=1e-12)
        assert v == pytest.approx(velocity(fraction * interval), abs=1e-12)


def test_calculated_scene_is_labelled_and_direction_keeps_no_distance(timeline):
    scene = sample_timeline(ROOT, "2026-11-14T12:34:56.789Z", timeline=timeline)
    assert scene["position_sampling"] == "display_interpolation"
    assert scene["interpolation"]["method"] == "cubic_hermite"
    assert scene["interpolation"]["source_epochs"] == EPOCHS[1:3]
    assert scene["guide_reference_epoch"] == "2026-11-14T00:00:00Z"
    assert all("Orbit guides" not in line or "2026-11-14" in line for line in scene["limitations"])
    for body in scene["objects"]:
        if body["object_id"] in BODY_IDS:
            assert body["position_kind"] == "interpolated_ephemeris"
            assert np.isfinite(body["position_au"]).all()
        elif body["object_id"] == "epsilon-indi-b":
            assert "position_au" not in body
            assert body["distance_au"] is None
            assert np.linalg.norm(body["direction_ecliptic"]) == pytest.approx(1, abs=1e-14)
            assert body["position_kind"] == "interpolated_catalog_direction"
    json.dumps(scene, allow_nan=False)


@pytest.mark.parametrize(
    "epoch", ["2026-11-12T23:59:59Z", "2026-11-16T00:00:00.001Z", "2026-11-14T00:00:00"]
)
def test_no_extrapolation_or_implicit_time_scale(timeline, epoch):
    with pytest.raises(ValueError):
        sample_timeline(ROOT, epoch, timeline=timeline)


def test_timezone_offset_identifies_same_event_without_shifting_source(timeline):
    scene = sample_timeline(ROOT, "2026-11-14T09:00:00+09:00", timeline=timeline)
    assert scene["epoch"] == "2026-11-14T00:00:00Z"
    assert scene["position_sampling"] == "source_exact"


def test_actual_midpoint_queries_and_reported_discrepancies(timeline):
    manifest = json.loads((ROOT / VALIDATION_MANIFEST).read_text(encoding="utf-8"))
    errors = []
    assert manifest["source_manifest_sha256"] == timeline["source_manifest_sha256"]
    for result in manifest["results"]:
        source = result["source"]
        raw = source["raw_response_json"].encode("utf-8")
        assert hashlib.sha256(raw).hexdigest() == source["response_sha256"]
        text = json.loads(raw)["result"]
        assert "Reference frame : Ecliptic of J2000.0" in text
        assert "Output units    : AU-D" in text
        rows = list(csv.reader(io.StringIO(text.split("$$SOE", 1)[1].split("$$EOE", 1)[0].strip())))
        for check, row in zip(result["checks"], rows, strict=True):
            actual = [float(item) for item in row[2:5]]
            assert check["actual_position_au"] == actual
            assert float(row[0]) == pytest.approx(
                float(Time(check["epoch"], scale="utc").jd), abs=1e-9
            )
            scene = sample_timeline(ROOT, check["epoch"], timeline=timeline)
            body = next(
                body for body in scene["objects"] if body["object_id"] == result["object_id"]
            )
            error_km = float(np.linalg.norm(np.asarray(actual) - body["position_au"]) * AU_KM)
            assert check["position_discrepancy_km"] == pytest.approx(error_km, abs=1e-8)
            errors.append(error_km)
    assert len(errors) == 27
    assert max(errors) == pytest.approx(
        timeline["validation"]["max_observed_midpoint_error_km"], abs=1e-8
    )
    assert "not a global bound" in timeline["validation"]["scope"]


def test_client_linear_utc_fraction_is_close_to_tdb_fraction_for_this_range(timeline):
    # Browsers linearly map UTC milliseconds to each knot's TDB endpoints; this
    # separately checks that approximation against server Astropy conversion.
    maximum_difference_km = 0.0
    for interval in range(3):
        a, b = timeline["knots"][interval : interval + 2]
        for fraction in (0.1, 0.25, 0.5, 0.75, 0.9):
            utc_jd = float(Time(a["epoch"], scale="utc").jd) + fraction
            epoch = (
                Time(utc_jd, format="jd", scale="utc").to_datetime().replace(tzinfo=UTC).isoformat()
            )
            scene = sample_timeline(ROOT, epoch, timeline=timeline)
            by_id = {body["object_id"]: body for body in scene["objects"]}
            for object_id in BODY_IDS:
                left, right = a["states"][object_id], b["states"][object_id]
                position, _ = hermite_state(
                    left["position_au"],
                    left["velocity_au_day"],
                    right["position_au"],
                    right["velocity_au_day"],
                    fraction,
                    b["tdb_jd"] - a["tdb_jd"],
                )
                difference = float(
                    np.linalg.norm(position - by_id[object_id]["position_au"]) * AU_KM
                )
                maximum_difference_km = max(maximum_difference_km, difference)
    assert (
        maximum_difference_km < 0.01
    )  # This range/sample parity check only (<10m), not source accuracy.


@pytest.mark.parametrize("fraction,interval", [(-0.1, 1), (1.1, 1), (0.5, 0), (np.nan, 1)])
def test_invalid_math_inputs_are_rejected(fraction, interval):
    with pytest.raises(ValueError):
        hermite_state([0, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0], fraction, interval)
