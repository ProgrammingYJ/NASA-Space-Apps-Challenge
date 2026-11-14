"""Historical source contracts and a separately requested JPL interpolation sample."""

import json
import math
import shutil
from pathlib import Path

import pytest
from astropy.time import Time
from scipy.interpolate import CubicHermiteSpline

from science.comets import MANIFEST, get_comets, hermite_position, parse_vectors

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def inputs(tmp_path):
    manifest = json.loads((ROOT / MANIFEST).read_bytes())
    paths = [MANIFEST, *(source["local_relative_path"] for source in manifest["sources"].values())]
    for relative in paths:
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, target)
    return tmp_path, manifest


def rewrite(root, manifest):
    (root / MANIFEST).write_text(json.dumps(manifest), encoding="utf-8")


def test_four_historical_windows_keep_jpl_tdb_ecliptic_reference_and_daily_spacing():
    result = get_comets(ROOT)
    assert len(result["objects"]) == 4
    assert len(result["sources"]) == 10
    assert sum(len(item["knots"]) for item in result["objects"]) == 489
    for item, start, stop in zip(
        result["objects"],
        ["1986-01-01", "1997-02-01", "2020-05-01", "2015-06-01"],
        ["1986-05-01", "1997-06-01", "2020-09-01", "2015-10-01"],
        strict=True,
    ):
        # Independent Astropy calendar conversion checks source JD/TDB association.
        assert item["knots"][0]["jd_tdb"] == Time(start, scale="tdb").jd
        assert item["knots"][-1]["jd_tdb"] == Time(stop, scale="tdb").jd
        assert (item["center"], item["frame"], item["time_scale"]) == (
            "Sun",
            "J2000 ecliptic",
            "TDB",
        )
        assert all("UTC" not in knot["calendar_tdb"] for knot in item["knots"])
        assert any("illustrations" in limitation for limitation in item["limitations"])


def test_near_perihelion_quarter_samples_use_separate_requests_and_scipy_interpolation():
    for item in get_comets(ROOT)["objects"]:
        check = item["interpolation_check"]
        left, right = item["knots"][check["left_index"] : check["left_index"] + 2]
        sample = check["sample"]
        assert sample["jd_tdb"] == left["jd_tdb"] + 0.25
        assert sample["jd_tdb"] not in {knot["jd_tdb"] for knot in item["knots"]}
        independent = CubicHermiteSpline(
            [left["jd_tdb"], right["jd_tdb"]],
            [left["position_au"], right["position_au"]],
            [left["velocity_au_day"], right["velocity_au_day"]],
            axis=0,
        )(sample["jd_tdb"])
        assert hermite_position(left, right, sample["jd_tdb"]) == pytest.approx(
            independent, abs=2e-15
        )
        assert math.dist(independent, sample["position_au"]) <= 1e-5
        assert check["scope"].endswith("not_orbit_accuracy_bound")


@pytest.mark.parametrize(
    "field,value", [("time_scale", "UTC"), ("frame", "ICRS"), ("center", "Earth")]
)
def test_reference_contract_cannot_be_silently_relabelled(inputs, field, value):
    root, manifest = inputs
    manifest["objects"][0][field] = value
    rewrite(root, manifest)
    with pytest.raises(ValueError, match="comet_identity_or_reference_changed"):
        get_comets(root)


def test_source_corruption_is_failure_not_a_missing_comet(inputs):
    root, manifest = inputs
    source = manifest["sources"]["comet-halley-daily"]
    (root / source["local_relative_path"]).write_bytes(b"changed")
    with pytest.raises(ValueError, match="comet_source_integrity_failed"):
        get_comets(root)


def test_historical_vector_orbit_is_not_extrapolated_before_or_after_window():
    for item in get_comets(ROOT)["objects"]:
        left, right = item["knots"][:2]
        with pytest.raises(ValueError, match="comet_interpolation_outside_knots"):
            hermite_position(left, right, left["jd_tdb"] - 1)
        with pytest.raises(ValueError, match="comet_interpolation_outside_knots"):
            hermite_position(left, right, right["jd_tdb"] + 1)


def test_ambiguous_or_wrong_target_and_reference_raw_responses_are_rejected():
    item = get_comets(ROOT)["objects"][0]
    source = next(source for source in item["sources"] if source["source_id"].endswith("-daily"))
    raw = (ROOT / source["local_relative_path"]).read_bytes()
    with pytest.raises(ValueError, match="comet_reference_contract_changed"):
        parse_vectors(raw, "67P/Churyumov-Gerasimenko")
    with pytest.raises(ValueError, match="comet_reference_contract_changed"):
        parse_vectors(raw.replace(b"Ecliptic of J2000.0", b"ICRF              "), "1P/Halley")


def test_comet_original_path_stays_inside_the_declared_source_folder(inputs):
    root, manifest = inputs
    manifest["sources"]["comet-halley-daily"]["local_relative_path"] = "data/manifests/comets.json"
    rewrite(root, manifest)
    with pytest.raises(ValueError, match="comet_source_path_escape"):
        get_comets(root)
