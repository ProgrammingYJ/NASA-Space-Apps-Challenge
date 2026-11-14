"""Actual Pluto inputs against independently recorded observer/WCS references."""

import hashlib
import json
from pathlib import Path

import pytest
from astropy.io import fits

from science.pluto import (
    EPHEMERIS_PATH,
    _ephemeris,
    build_pluto_comparison,
    list_pluto_observations,
)
from science.spherex import _json_array

ROOT = Path(__file__).resolve().parents[1]
DATA_AVAILABLE = (
    ROOT / "data/raw/current_official_2026-11-13/spherex/pluto_QR3_D3_2026W40_1A_0373_4_v17.fits"
).is_file()


@pytest.fixture(scope="module")
def actual_pluto():
    if not DATA_AVAILABLE:
        pytest.skip("Actual SPHEREx Pluto source volume is not mounted")
    return build_pluto_comparison(ROOT)


def test_actual_observer_prediction_matches_independent_plan_reference(actual_pluto):
    # v1.7 check sheet A records an independent pre-implementation Horizons/WCS check.
    # These reference coordinates are predictions, never a measured image centroid.
    references = {
        "S12": ((223.044867, 276.962553), "2026-09-29T16:33:19.251", 9, 4),
        "S14": ((209.936017, 161.381462), "2026-10-02T14:30:41.058", 11, 3),
    }
    assert actual_pluto["predicted_displacement_arcsec"] == pytest.approx(72.326969, abs=1e-6)
    assert actual_pluto["scientific_status"] == "association_insufficient"
    assert actual_pluto["layout"] == "native_unregistered"
    for frame in actual_pluto["frames"]:
        position, date_avg, source, outlier = references[frame["observation_id"]]
        prediction, metadata, quality = frame["prediction"], frame["metadata"], frame["quality"]
        assert (prediction["x"], prediction["y"]) == pytest.approx(position, abs=1e-6)
        assert metadata["date_avg"] == date_avg
        assert metadata["timesys"] == "UTC"
        assert metadata["observer_id"] == "-163182"
        assert prediction["kind"] == "observer_ephemeris_prediction"
        assert prediction["source"]["target_id"] == "999"
        assert prediction["source"]["observer_id"] == "-163182"
        assert prediction["source"]["epoch"] == date_avg
        assert "down-leg light-time" in prediction["source"]["light_time"]
        assert "TLE" in prediction["source"]["assumptions"][0]
        assert quality["flag_counts"]["SOURCE"] == source
        assert quality["flag_counts"]["OUTLIER"] == outlier
        assert quality["flag_counts"]["NONFUNC"] == 0
        assert quality["flag_counts"]["OVERFLOW"] == 0
        assert quality["clipped_pixel_count"] == 0
        assert quality["display"]["retained"] == quality["pixel_count"]
        assert quality["display"]["review_required"] == outlier
        assert quality["quantitative"]["status"] == "not_validated"


def test_actual_d3_schema_calibration_and_unmodified_pixels(actual_pluto):
    json.dumps(actual_pluto, allow_nan=False)
    for frame in actual_pluto["frames"]:
        metadata = frame["metadata"]
        assert metadata["pipeline_version"] == "7.0.5"
        assert metadata["release"] == "QR3"
        assert metadata["detector"] == "D3"
        assert metadata["epsf"]["rows"] == 451
        assert metadata["epsf"]["oversampling"] == {"x": 5, "y": 5}
        assert metadata["wcs"]["has_sip"]
        assert metadata["wcs"]["round_trip_error_px"] < 1e-6
        assert frame["calibration"]["id"] == "L051"
        assert "/spherex/dr1/spectral_wcs/" in frame["calibration"]["datalink_source_url"]
        assert frame["calibration"]["datalink_release"] == "DR1"
        assert frame["calibration"]["sha256"] == (
            "51750c8f948a30541d391e54930279aa067c62c398a7cc2679e592bc6044427a"
        )
        original_path = ROOT / frame["provenance"]["local_relative_path"]
        assert original_path.stat().st_size == frame["provenance"]["bytes"]
        with original_path.open("rb") as stream:
            assert (
                hashlib.file_digest(stream, "sha256").hexdigest() == frame["provenance"]["sha256"]
            )
        with fits.open(original_path, memmap=False) as hdul:
            crop = frame["cutout"]
            x0, y0 = crop["native_origin"]["x"], crop["native_origin"]["y"]
            for name in ("IMAGE", "FLAGS", "VARIANCE", "ZODI"):
                selected = hdul[name].data[y0 : y0 + crop["height"], x0 : x0 + crop["width"]]
                assert crop[name] == _json_array(selected)
            assert crop["resampling"] == "none"
            assert crop["zodi_subtracted"] is False
            assert crop["pixel_origin"] == 0
    # Old plan values use nearest native pixels; current display uses explicit bilinear CWAVE.
    assert actual_pluto["frames"][0]["metadata"]["wavelength_um"] == pytest.approx(
        2.313216, abs=3e-4
    )
    assert actual_pluto["frames"][1]["metadata"]["wavelength_um"] == pytest.approx(
        2.366850, abs=3e-4
    )


def test_preserved_ephemeris_response_integrity_and_observer(tmp_path):
    snapshot, positions, sha = _ephemeris(ROOT)
    assert set(positions) == {"S12", "S14"}
    assert sha == hashlib.sha256((ROOT / EPHEMERIS_PATH).read_bytes()).hexdigest()
    assert "Concatenated TLEs" in json.loads(snapshot["observer_response_text"])["result"]
    changed = dict(snapshot)
    changed["source_url"] = snapshot["source_url"].replace("500%40-163182", "500%40399")
    path = tmp_path / EPHEMERIS_PATH
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps(changed), encoding="utf-8")
    with pytest.raises(ValueError, match="ephemeris_source_mismatch"):
        _ephemeris(tmp_path)
    changed = dict(snapshot)
    changed["response_text"] += "altered"
    path.write_text(json.dumps(changed), encoding="utf-8")
    with pytest.raises(ValueError, match="ephemeris_response_hash_mismatch"):
        _ephemeris(tmp_path)


def test_actual_observation_choices_are_tied_to_real_dates(actual_pluto):
    listed = list_pluto_observations(ROOT)
    assert [row["observation_id"] for row in listed] == ["S12", "S14"]
    assert {row["date_avg"] for row in listed} == {
        frame["metadata"]["date_avg"] for frame in actual_pluto["frames"]
    }
    assert all(row["object_id"] == "pluto" for row in listed)
    assert all(row["wavelength_um"] is not None for row in listed)


@pytest.mark.parametrize(
    "ids,size,error",
    [
        (["S12", "S12"], 81, "duplicate_observation"),
        (["S12", "S01"], 81, "unsupported_observation"),
        (["https://example.com"], 81, "unsupported_observation"),
        (["S12"], 1000, "invalid_cutout_size"),
    ],
)
def test_pluto_allowlist_and_bounded_cutout(ids, size, error):
    with pytest.raises(ValueError, match=error):
        build_pluto_comparison(ROOT, ids, size)
