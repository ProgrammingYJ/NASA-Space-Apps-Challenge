"""Native NRAR strain-mode integrity and independently specified unit scaling."""

import hashlib
import json
from decimal import Decimal
from pathlib import Path

import numpy as np
import pytest

from science import numerical_relativity as nr

ROOT = Path(__file__).resolve().parents[1]
STAGED = "tmp/dev016-numerical_relativity.json"


@pytest.mark.parametrize(
    "mass,distance", [(0, 1), (-1, 1), (1, 0), (1, -1), (float("nan"), 1), (1, float("inf"))]
)
def test_scale_rejects_nonpositive_or_nonfinite_inputs(mass, distance):
    with pytest.raises(ValueError, match="positive_finite"):
        nr.mode_scale(mass, distance)


@pytest.mark.parametrize("value", [True, "60", None])
def test_scale_does_not_coerce_untyped_inputs(value):
    with pytest.raises(TypeError, match="positive_finite"):
        nr.mode_scale(value, 400)


def test_nominal_mass_conversion_independent_reference():
    # IAU 2015 B3 exact GM, SI exact c, and parsec=648000/pi au.
    # These published conversion factors are independent of the reader output.
    scale = nr.mode_scale(1, 1)
    assert scale["seconds_per_time_over_m"] == pytest.approx(4.9254909476412675e-6, rel=1e-14)
    assert nr.LENGTH_PER_SOLAR_MASS_M == pytest.approx(1476.6250380501249, rel=1e-14)
    assert nr.MPC_M == pytest.approx(3.085677581491367e22, rel=1e-14)
    assert scale["strain_per_rh22_over_m"] == pytest.approx(4.785415841587842e-20, rel=1e-12)
    assert scale["observer_projection_applied"] is False
    assert scale["cosmological_redshift_applied"] is False


def test_vacuum_unit_scaling_changes_only_time_and_inverse_distance_amplitude():
    base = nr.mode_scale(60, 400)
    mass = nr.mode_scale(120, 400)
    distance = nr.mode_scale(60, 800)
    assert mass["seconds_per_time_over_m"] == 2 * base["seconds_per_time_over_m"]
    assert mass["strain_per_rh22_over_m"] == 2 * base["strain_per_rh22_over_m"]
    assert distance["seconds_per_time_over_m"] == base["seconds_per_time_over_m"]
    assert distance["strain_per_rh22_over_m"] == base["strain_per_rh22_over_m"] / 2


@pytest.mark.parametrize(
    "samples,error",
    [
        ([[0, 1], [1, 2]], "shape"),
        ([[0, 1, 0]], "shape"),
        ([[0, 1, 0], [0, 2, 1]], "increasing"),
        ([[1, 1, 0], [0, 2, 1]], "increasing"),
        ([[0, 1, 0], [1, float("nan"), 1]], "nonfinite"),
    ],
)
def test_native_samples_cannot_silently_reorder_or_drop_invalid_rows(samples, error):
    with pytest.raises(ValueError, match=error):
        nr.validate_mode_samples(samples)


def test_extract_selects_exact_complex_strain_mode_and_keeps_native_times(tmp_path):
    h5py = pytest.importorskip("h5py")
    path = tmp_path / "fixture.h5"
    values = np.array([[0.125, 0.1, -0.03], [0.75, -0.2, 0.11], [4.25, -0.3, 0.21]])
    with h5py.File(path, "w") as handle:
        handle.create_dataset(nr.DATASET, data=values)
        handle.create_dataset("Extrapolated_N3.dir/Y_l2_m2.dat", data=values * 100)
    extracted, processor = nr.extract_h22(path)
    np.testing.assert_array_equal(extracted, values)
    assert processor["h5py_version"] == h5py.__version__


def test_extract_rejects_psi4_or_wrong_extrapolation_only_file(tmp_path):
    h5py = pytest.importorskip("h5py")
    path = tmp_path / "wrong.h5"
    with h5py.File(path, "w") as handle:
        handle.create_dataset("Extrapolated_N3.dir/Y_l2_m2.dat", data=[[0, 1, 1], [1, 1, 1]])
    with pytest.raises(ValueError, match="dataset_missing"):
        nr.extract_h22(path)


def adopted_manifest():
    path = nr.MANIFEST if (ROOT / nr.MANIFEST).exists() else STAGED
    if not (ROOT / path).exists():
        pytest.skip("Adopted SXS raw/derived data not present in this checkout")
    return path


def test_actual_archive_hash_license_parameters_and_no_live_solver_claim():
    manifest = adopted_manifest()
    exported = nr.get_numerical_relativity(ROOT, manifest_path=manifest)
    assert exported["record_doi"] == "10.5281/zenodo.1215528"
    assert exported["rights"]["spdx"] == "CC-BY-4.0"
    assert exported["dataset"] == "Extrapolated_N2.dir/Y_l2_m2.dat"
    # Independent transcription of the two native relaxed masses in metadata.
    reference_ratio = Decimal("0.549802229834") / Decimal("0.450213771474")
    assert exported["reference_parameters"]["mass_ratio_m1_over_m2"] == pytest.approx(
        float(reference_ratio), rel=1e-14
    )
    assert exported["reference_parameters"]["dimensionless_spin1"][2] == 0.329976580046
    assert exported["reference_parameters"]["dimensionless_spin2"][2] == -0.43994832522
    assert exported["reference_parameters"]["eccentricity"] == 0.0008382
    assert exported["live_gr_solver"] is False
    assert exported["observed_detector_data"] is False
    assert exported["arbitrary_mass_ratio_or_spin_interpolation"] is False
    assert exported["gravitational_memory_added"] is False


def test_actual_json_samples_are_exact_raw_hdf5_values_without_decimation():
    h5py = pytest.importorskip("h5py")
    exported = nr.get_numerical_relativity(ROOT, manifest_path=adopted_manifest())
    with h5py.File(ROOT / nr.RAW, "r") as handle:
        native = handle["Extrapolated_N2.dir/Y_l2_m2.dat"][...]
    columns = exported["columns"]
    assert exported["sample_count"] == len(native)
    for index, key in enumerate(["time_over_m", "rh22_over_m_real", "rh22_over_m_imag"]):
        np.testing.assert_array_equal(columns[key], native[:, index])
    assert exported["time_range_over_m"] == [native[0, 0], native[-1, 0]]
    assert exported["data"]["downsampling"] is False
    assert exported["data"]["phase_rotation"] is False
    assert exported["data"]["normalization_change"] is False


def small_export_fixture(tmp_path):
    source = b"fixed trusted source bytes"
    raw = json.dumps(
        {
            "schema_version": "1.0",
            "algorithm_version": nr.ALGORITHM,
            "object_id": nr.OBJECT_ID,
            "dataset": nr.DATASET,
            "sample_count": 2,
            "columns": {
                "time_over_m": [0, 1],
                "rh22_over_m_real": [0.1, 0.2],
                "rh22_over_m_imag": [-0.1, 0.3],
            },
        }
    ).encode()
    (tmp_path / "raw").write_bytes(source)
    (tmp_path / "derived").write_bytes(raw)
    manifest = {
        "schema_version": "1.0",
        "algorithm_version": nr.ALGORITHM,
        "object_id": nr.OBJECT_ID,
        "dataset": nr.DATASET,
        "sample_count": 2,
        "rights": {"spdx": "CC-BY-4.0"},
        "sources": [
            {"path": "raw", "bytes": len(source), "sha256": hashlib.sha256(source).hexdigest()}
        ],
        "data": {
            "path": "derived",
            "bytes": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest(),
            "source_sha256": hashlib.sha256(source).hexdigest(),
        },
    }
    (tmp_path / "manifest").write_text(json.dumps(manifest))
    return manifest


@pytest.mark.parametrize("target", ["raw", "derived"])
def test_export_rejects_changed_input_or_derived_bytes(tmp_path, target):
    small_export_fixture(tmp_path)
    nr.get_numerical_relativity(tmp_path, manifest_path="manifest")
    with (tmp_path / target).open("ab") as handle:
        handle.write(b"tamper")
    with pytest.raises(ValueError, match="integrity_mismatch"):
        nr.get_numerical_relativity(tmp_path, manifest_path="manifest")


def test_export_rejects_path_escape_even_for_an_existing_source(tmp_path):
    manifest = small_export_fixture(tmp_path)
    manifest["sources"][0]["path"] = "../outside"
    (tmp_path / "manifest").write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match="outside_root"):
        nr.get_numerical_relativity(tmp_path, manifest_path="manifest")
