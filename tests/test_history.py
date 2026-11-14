"""Official chronology anchors, provenance and no-spatial-claim safeguards."""

import copy
import json
import shutil
from pathlib import Path

import pytest

from science import history

ROOT = Path(__file__).resolve().parents[1]


def test_published_anchors_and_era_spans_are_preserved():
    actual = history.get_cosmic_history(ROOT)
    by_id = {stage["stage_id"]: stage for stage in actual["stages"]}
    assert len(by_id) == len(actual["stages"]) == 10
    assert actual["reference_age_gyr"] == 13.8
    assert actual["reference_age_is_approximate"] is True
    assert by_id["recombination"]["age_gyr"] * 1e9 == pytest.approx(380_000)
    assert by_id["reionization"]["age_range_gyr"] == [0.2, 1.0]
    assert by_id["cosmic_noon"]["age_range_gyr"] == [2.0, 3.0]
    assert by_id["solar_system"]["age_gyr"] == pytest.approx(13.8 - 4.6)
    assert by_id["solar_system"]["lookback_gyr"] == 4.6
    # Verify these numerical references also occur in the actual source text,
    # rather than deriving expected chronology from the implementation output.
    esa = history._plain(
        (ROOT / actual["sources"]["esa_cosmic_eras"]["local_relative_path"]).read_text(
            encoding="utf-8"
        )
    )
    nasa = history._plain(
        (ROOT / actual["sources"]["nasa_early_universe"]["local_relative_path"]).read_text(
            encoding="utf-8"
        )
    )
    assert "380 000" in esa and "200 million" in esa and "two to three billion" in esa
    assert "13.8" in nasa and "280 million" in nasa


def test_display_anchors_are_not_fabricated_precision_or_uncertainty():
    actual = history.get_cosmic_history(ROOT)
    by_id = {stage["stage_id"]: stage for stage in actual["stages"]}
    for key in ("dark_ages", "reionization", "cosmic_noon"):
        stage = by_id[key]
        assert stage["timing_status"] == "editorial_anchor_within_sourced_era"
        assert stage["age_range_gyr"][0] <= stage["age_gyr"] <= stage["age_range_gyr"][1]
        assert "not_confidence_interval" in stage["range_kind"]
    assert "exact_time_unknown" in by_id["first_stars"]["timing_status"]
    assert "not_first_formation_time" in by_id["early_galaxies"]["timing_status"]
    assert all(
        stage["spatial_representation"] == "conceptual_illustration_only"
        for stage in actual["stages"]
    )
    assert not any(
        key in stage
        for stage in actual["stages"]
        for key in ("position_au", "ra", "dec", "probability")
    )
    assert "not a measured spatial reconstruction" in " ".join(actual["limitations"])
    assert len(actual["source_conflicts"]) == 2


def test_local_reader_and_sampling_never_access_network(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("Runtime network access")

    monkeypatch.setattr(history, "urlopen", forbidden)
    actual = history.get_cosmic_history(ROOT)
    assert len(actual["sources"]) == 4
    assert len(actual["source_manifest_sha256"]) == 64
    json.dumps(actual, allow_nan=False)
    for age, expected in [
        (0, "hot_big_bang"),
        (0.00038, "recombination"),
        (0.05, "dark_ages"),
        (0.2, "first_stars"),
        (0.28, "early_galaxies"),
        (0.8, "reionization"),
        (1.5, "galaxy_growth"),
        (2.5, "cosmic_noon"),
        (9.2, "solar_system"),
        (13.8, "present"),
    ]:
        sampled = history.sample_history(ROOT, age)
        assert sampled["stage_id"] == expected
        assert sampled["age_gyr"] == age
        assert sampled["lookback_gyr"] == pytest.approx(13.8 - age)
        assert sampled["reference_age_gyr"] == 13.8
        assert sampled["stage_anchor_age_gyr"] <= age
        json.dumps(sampled, allow_nan=False)


@pytest.mark.parametrize("invalid", [-1, 13.8000001, float("nan"), float("inf"), True, "4.6", None])
def test_no_extrapolation_or_nonfinite_ages(invalid):
    with pytest.raises(ValueError, match="cosmic_age_outside_range"):
        history.sample_history(ROOT, invalid)


def _copied_dataset(tmp_path):
    manifest = history.get_cosmic_history(ROOT)
    shutil.copytree(ROOT / history.RAW_ROOT, tmp_path / history.RAW_ROOT)
    path = tmp_path / history.MANIFEST
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps(manifest), encoding="utf-8")
    return manifest, path


def test_original_corruption_is_rejected(tmp_path):
    manifest, _ = _copied_dataset(tmp_path)
    path = tmp_path / manifest["sources"]["nasa_solar_system"]["local_relative_path"]
    path.write_bytes(path.read_bytes() + b"modified")
    with pytest.raises(ValueError, match="cosmic_source_integrity"):
        history.get_cosmic_history(tmp_path)


def test_source_path_escape_and_schema_change_are_rejected(tmp_path):
    manifest, path = _copied_dataset(tmp_path)
    broken = copy.deepcopy(manifest)
    broken["sources"]["nasa_solar_system"]["local_relative_path"] = "../outside.html"
    path.write_text(json.dumps(broken), encoding="utf-8")
    with pytest.raises(ValueError, match="cosmic_source_missing_or_outside_root"):
        history.get_cosmic_history(tmp_path)
    broken = {**manifest, "schema_version": "unknown"}
    path.write_text(json.dumps(broken), encoding="utf-8")
    with pytest.raises(ValueError, match="unsupported_cosmic_history_schema"):
        history.get_cosmic_history(tmp_path)
