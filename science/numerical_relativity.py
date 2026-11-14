"""Verified replay of one archived SXS numerical-relativity strain mode.

This module extracts native NRAR h22 samples at build time. It does not solve
Einstein's equations, infer an observed signal, vary the simulation's mass ratio
or spins, or project the mode into a detector. Node reads its JSON export only.
"""

from __future__ import annotations

import hashlib
import json
import math
from datetime import UTC, datetime
from pathlib import Path

import numpy as np

MANIFEST = "data/manifests/numerical_relativity.json"
RAW_ROOT = "data/reference/numerical-relativity"
RAW = RAW_ROOT + "/sxs_bbh_0305_lev6_com.h5"
METADATA = RAW_ROOT + "/sxs_bbh_0305_lev6_metadata.json"
RECORD = RAW_ROOT + "/zenodo_1215528_record.json"
DERIVED = RAW_ROOT + "/sxs_bbh_0305_lev6_h22.json"
OBJECT_ID = "sxs-bbh-0305-lev6-n2-com-v1"
ALGORITHM = "sxs-nrar-h22-native-replay-v1"
DATASET = "Extrapolated_N2.dir/Y_l2_m2.dat"
DOI = "10.5281/zenodo.1215528"
SOURCE_URL = (
    "https://zenodo.org/api/records/1215528/files/"
    "SXS:BBH:0305/Lev6/rhOverM_Asymptotic_GeometricUnits_CoM.h5/content"
)
DOC_URL = "https://data.black-holes.org/waveforms/documentation.html"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"

# Exact nominal conversion parameters, not estimates of the actual solar mass.
# IAU 2015 Resolution B3; SI speed of light; IAU 2012 definition of the au.
C_M_S = 299_792_458.0
GM_SUN_NOMINAL_M3_S2 = 1.3271244e20
AU_M = 149_597_870_700.0
MPC_M = (648_000.0 / math.pi) * AU_M * 1e6
TIME_PER_SOLAR_MASS_S = GM_SUN_NOMINAL_M3_S2 / C_M_S**3
LENGTH_PER_SOLAR_MASS_M = GM_SUN_NOMINAL_M3_S2 / C_M_S**2

LIMITATIONS = [
    "One archived numerical-relativity simulation, not a live Einstein-equation solver.",
    "The mass ratio, dimensionless spins, eccentricity and initial conditions remain fixed.",
    "This is the complex spin-weight -2 (ell,m)=(2,2) mode only; it is not full observer or detector strain.",
    "No sky orientation, spin-weighted harmonic projection, other modes or detector response is inferred.",
    "The adopted archived 2018 v1 CoM-corrected strain does not receive the 2024 release's added-memory processing.",
    "No convergence or extrapolation uncertainty is estimated from this single resolution/order.",
    "All native samples are preserved, including possible initial junk radiation and late numerical noise.",
    "There is no cosmological redshift transformation. The user mass scale is a nominal observer-frame gravitational mass parameter.",
    "Distance scaling is the asymptotic inverse-distance mode scaling in flat propagation, not a cosmological luminosity-distance model.",
    "The waveform time is the catalogue's extrapolated proper/retarded time in units of total relaxed Christodoulou mass, not UTC.",
]


def _sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _path(root: Path, relative: str) -> Path:
    result = (root / relative).resolve()
    if not result.is_relative_to(root.resolve()):
        raise ValueError("nr_path_outside_root")
    return result


def _json(raw: bytes) -> dict:
    def reject(value: str):
        raise ValueError("nr_nonfinite_json_" + value)

    value = json.loads(raw, parse_constant=reject)
    if not isinstance(value, dict):
        raise TypeError("nr_invalid_json_object")
    return value


def _record(root: Path, relative: str, url: str, *, required: bool = True) -> dict:
    path = _path(root, relative)
    raw = path.read_bytes()
    return {
        "path": relative,
        "url": url,
        "sha256": _sha(raw),
        "bytes": len(raw),
        "retrieved_at_utc": datetime.fromtimestamp(path.stat().st_mtime, UTC).isoformat(),
        "required_on_server": required,
    }


def validate_mode_samples(value) -> np.ndarray:
    """Validate the actual three-column native strain-mode series."""
    values = np.asarray(value, dtype=np.float64)
    if values.ndim != 2 or values.shape[1] != 3 or values.shape[0] < 2:
        raise ValueError("nr_invalid_mode_shape")
    if not np.isfinite(values).all():
        raise ValueError("nr_nonfinite_mode_sample")
    if not np.all(np.diff(values[:, 0]) > 0):
        raise ValueError("nr_time_not_strictly_increasing")
    return values


def extract_h22(path: Path) -> tuple[np.ndarray, dict]:
    """Use h5py only during an explicitly requested build-time extraction."""
    import h5py

    with h5py.File(path, "r") as handle:
        if DATASET not in handle:
            raise ValueError("nr_required_strain_dataset_missing")
        dataset = handle[DATASET]
        values = validate_mode_samples(dataset[...])
        if values.shape[0] > 1_000_000:
            raise ValueError("nr_unexpected_sample_count")
        attributes = {}
        for name, value in handle.attrs.items():
            if isinstance(value, (bytes, str)):
                attributes[name] = value.decode("utf-8") if isinstance(value, bytes) else value
        return values, {"h5py_version": h5py.__version__, "root_text_attributes": attributes}


def mode_scale(mass_total_msun: float, distance_mpc: float) -> dict:
    """Vacuum-GR unit scaling for a fixed asymptotic h22 mode, not a new run."""
    for value in (mass_total_msun, distance_mpc):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise TypeError("nr_scale_requires_positive_finite_number")
        if not math.isfinite(value) or value <= 0:
            raise ValueError("nr_scale_requires_positive_finite_number")
    return {
        "mass_total_msun": mass_total_msun,
        "distance_mpc": distance_mpc,
        "seconds_per_time_over_m": TIME_PER_SOLAR_MASS_S * mass_total_msun,
        "strain_per_rh22_over_m": LENGTH_PER_SOLAR_MASS_M
        * mass_total_msun
        / (distance_mpc * MPC_M),
        "observer_projection_applied": False,
        "cosmological_redshift_applied": False,
    }


def stage(root: Path, target: str = "tmp/dev016-numerical_relativity.json") -> dict:
    """Build a staged, hash-linked canonical manifest without overwriting it."""
    destination = _path(root, target)
    if destination.exists() or _path(root, DERIVED).exists():
        raise FileExistsError("nr_stage_output_already_exists")
    record = _json(_path(root, RECORD).read_bytes())
    if (
        record.get("doi") != DOI
        or record.get("metadata", {}).get("license", {}).get("id") != "cc-by-4.0"
    ):
        raise ValueError("nr_record_doi_or_license_mismatch")
    metadata = _json(_path(root, METADATA).read_bytes())
    if "SXS:BBH:0305" not in metadata.get("alternative_names", []):
        raise ValueError("nr_simulation_metadata_mismatch")
    raw = _path(root, RAW).read_bytes()
    if len(raw) != 76_110_573 or hashlib.md5(raw).hexdigest() != "287f9cf45c3fede8db7154fcd9ffd51c":
        raise ValueError("nr_archive_raw_checksum_mismatch")
    values, processor = extract_h22(_path(root, RAW))
    peak_index = int(np.argmax(np.hypot(values[:, 1], values[:, 2])))
    derived = {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM,
        "object_id": OBJECT_ID,
        "dataset": DATASET,
        "sample_count": len(values),
        "columns": {
            "time_over_m": values[:, 0].tolist(),
            "rh22_over_m_real": values[:, 1].tolist(),
            "rh22_over_m_imag": values[:, 2].tolist(),
        },
    }
    derived_raw = (json.dumps(derived, separators=(",", ":"), allow_nan=False) + "\n").encode()
    derived_path = _path(root, DERIVED)
    derived_path.write_bytes(derived_raw)
    source = _record(root, RAW, SOURCE_URL)
    document = {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM,
        "object_id": OBJECT_ID,
        "name": "SXS:BBH:0305 · Lev6 · N2 · CoM · archived v1",
        "simulation_id": "SXS:BBH:0305",
        "record_doi": DOI,
        "record_version": "v1 (2018-04-09)",
        "dataset": DATASET,
        "quantity": "complex_h22_strain_mode_scaled_by_r_over_total_mass",
        "spin_weight": -2,
        "ell": 2,
        "m": 2,
        "extrapolation_order": 2,
        "resolution": "Lev6",
        "center_of_mass_corrected": True,
        "gravitational_memory_added": False,
        "frame": "SXS archived CoM-corrected spin-weighted spherical-harmonic mode frame; no observer projection",
        "time_coordinate": "catalogue extrapolated proper/retarded time divided by total relaxed Christodoulou mass",
        "unit_system": "geometrized G=c=1; total relaxed Christodoulou mass scaled out",
        "sample_count": len(values),
        "time_range_over_m": [float(values[0, 0]), float(values[-1, 0])],
        "peak_h22_sample_index": peak_index,
        "peak_h22_time_over_m": float(values[peak_index, 0]),
        "reference_parameters": {
            "simulation_name": metadata["simulation_name"],
            "mass_ratio_m1_over_m2": metadata["relaxed_mass1"] / metadata["relaxed_mass2"],
            "relaxed_mass1_code_units": metadata["relaxed_mass1"],
            "relaxed_mass2_code_units": metadata["relaxed_mass2"],
            "dimensionless_spin1": metadata["relaxed_dimensionless_spin1"],
            "dimensionless_spin2": metadata["relaxed_dimensionless_spin2"],
            "eccentricity": metadata["relaxed_eccentricity"],
            "relaxation_measurement_time_code_units": metadata["relaxed_measurement_time"],
            "number_of_orbits": metadata["number_of_orbits"],
            "remnant_mass_code_units": metadata["remnant_mass"],
            "remnant_dimensionless_spin": metadata["remnant_dimensionless_spin"],
        },
        "scaling": {
            "c_m_s": C_M_S,
            "gm_sun_nominal_m3_s2": GM_SUN_NOMINAL_M3_S2,
            "mpc_m": MPC_M,
            "seconds_per_solar_mass": TIME_PER_SOLAR_MASS_S,
            "metres_per_solar_mass": LENGTH_PER_SOLAR_MASS_M,
            "time_formula": "t_s=(t/M)*GM_sun_nominal/c^3*mass_total_msun",
            "mode_formula": "h22=(rh22/M)*GM_sun_nominal/c^2*mass_total_msun/(distance_mpc*mpc_m)",
            "mass_interpretation": "observer-frame nominal solar gravitational-mass parameter; no redshift mapping",
            "constants_source": "https://www.iau.org/static/resolutions/IAU2015_English.pdf",
        },
        "sources": [
            source,
            _record(
                root,
                METADATA,
                "https://zenodo.org/api/records/1215528/files/SXS:BBH:0305/Lev6/metadata.json/content",
            ),
            _record(root, RECORD, "https://zenodo.org/api/records/1215528"),
        ],
        "data": {
            "path": DERIVED,
            "sha256": _sha(derived_raw),
            "bytes": len(derived_raw),
            "source_sha256": source["sha256"],
            "processor": processor,
            "transforms": [
                "select exact native N2 CoM h22 dataset",
                "serialize three columns to lossless round-trip JSON numbers",
            ],
            "downsampling": False,
            "phase_rotation": False,
            "time_shift": False,
            "normalization_change": False,
        },
        "rights": {
            "spdx": "CC-BY-4.0",
            "license_url": LICENSE_URL,
            "copyright": "SXS data creators listed in Zenodo record 1215528",
            "attribution": "Kidder, L.; Pfeiffer, H.; Scheel, M.; Boyle, M.; Hemberger, D.; Lovelace, G.; Szilagyi, B. (2018). Binary black-hole simulation SXS:BBH:0305 (v1). Zenodo. https://doi.org/10.5281/zenodo.1215528. CC BY 4.0. Native h22 mode extracted by this project; no physical recalculation.",
            "simulation_bibtex_keys": metadata["simulation_bibtex_keys"],
        },
        "format_documentation_url": DOC_URL,
        "limitations": LIMITATIONS,
        "live_gr_solver": False,
        "observed_detector_data": False,
        "arbitrary_mass_ratio_or_spin_interpolation": False,
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(document, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )
    return document


def get_numerical_relativity(root: Path, *, manifest_path: str = MANIFEST) -> dict:
    """Verify all adopted inputs and return the immutable Node export payload."""
    manifest_raw = _path(root, manifest_path).read_bytes()
    manifest = _json(manifest_raw)
    if manifest.get("schema_version") != "1.0" or manifest.get("algorithm_version") != ALGORITHM:
        raise ValueError("nr_manifest_version_mismatch")
    if manifest.get("object_id") != OBJECT_ID or manifest.get("dataset") != DATASET:
        raise ValueError("nr_manifest_dataset_mismatch")
    if manifest.get("rights", {}).get("spdx") != "CC-BY-4.0":
        raise ValueError("nr_manifest_license_mismatch")
    for item in [*manifest["sources"], manifest["data"]]:
        raw = _path(root, item["path"]).read_bytes()
        if len(raw) != item["bytes"] or _sha(raw) != item["sha256"]:
            raise ValueError("nr_source_or_derived_integrity_mismatch")
    if manifest["data"]["source_sha256"] != manifest["sources"][0]["sha256"]:
        raise ValueError("nr_source_link_mismatch")
    derived = _json(_path(root, manifest["data"]["path"]).read_bytes())
    if (
        derived.get("object_id") != OBJECT_ID
        or derived.get("dataset") != DATASET
        or derived.get("algorithm_version") != ALGORITHM
    ):
        raise ValueError("nr_derived_identity_mismatch")
    columns = derived["columns"]
    if set(columns) != {"time_over_m", "rh22_over_m_real", "rh22_over_m_imag"}:
        raise ValueError("nr_derived_columns_mismatch")
    sizes = {len(value) for value in columns.values()}
    if (
        sizes != {manifest["sample_count"]}
        or derived.get("sample_count") != manifest["sample_count"]
    ):
        raise ValueError("nr_derived_count_mismatch")
    validate_mode_samples(
        np.column_stack(
            [columns[key] for key in ("time_over_m", "rh22_over_m_real", "rh22_over_m_imag")]
        )
    )
    return {**manifest, "source_manifest_sha256": _sha(manifest_raw), "columns": columns}


export_numerical_relativity = get_numerical_relativity
