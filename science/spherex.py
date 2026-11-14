"""Read immutable SPHEREx inputs and produce native display/quality products.

The marker is a catalog proper-motion prediction, never an image centroid.
No flux, detection, registered difference or measured motion is calculated here.
"""

from __future__ import annotations

import hashlib
import json
import re
import warnings
from pathlib import Path
from typing import Any

import astropy
import numpy as np
from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS
from erfa import ErfaWarning

SCHEMA_VERSION = "1.0"
ALGORITHM_VERSION = "spherex-native-v1"
OBJECT_ID = "epsilon-indi-b"
OBSERVATIONS = {"S01": "DR1", "S02": "QR3"}
MASK_POLICY_ID = "native-display-review-v1"
TARGET_SOURCE = {
    "ra_deg": (22 + 4 / 60 + 10.5951812451 / 3600) * 15,
    "dec_deg": -(56 + 46 / 60 + 58.239102418 / 3600),
    "epoch": "J2000",
    "frame": "ICRS",
    "pm_ra_cosdec_mas_yr": 3981.977,
    "pm_dec_mas_yr": -2466.832,
    "url": "https://simbad.cfa.harvard.edu/simbad/sim-id?Ident=eps+Indi+B&output.format=ASCII",
    "bibcode": "2020yCat.1350....0G",
    "verified_date": "2026-11-14",
}
LIMITATIONS = [
    "Native images are not registered; blink is a visual inspection only.",
    "The marker is a proper-motion prediction, not an image centroid or measured motion.",
    "Observer parallax, radial velocity and full covariance are not included.",
    "Epsilon Indi Ba/Bb is unresolved; source association, background, response, PSF and quantitative measurement remain unvalidated.",
    "IMAGE is L2 surface brightness in MJy/sr; ZODI has not been subtracted here.",
    "SOURCE is informational; flag counts overlap. OVERFLOW is not automatically full saturation.",
]


def _records(root: Path) -> dict[str, dict[str, Any]]:
    manifest = json.loads((root / "data/manifests/datasets.json").read_text(encoding="utf-8"))
    return {record["id"]: record for record in manifest["files"]}


def verify_source(root: Path, record: dict[str, Any]) -> Path:
    """Resolve only trusted manifest paths and verify every input before processing."""
    root = root.resolve()
    path = (root / record["local_relative_path"]).resolve()
    if not path.is_relative_to(root / "data"):
        raise ValueError("source_path_outside_data")
    if not path.is_file():
        raise ValueError("source_missing")
    if path.stat().st_size != record["bytes"]:
        raise ValueError("source_size_mismatch")
    with path.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    if digest != record["sha256"]:
        raise ValueError("source_hash_mismatch")
    return path


def _provenance(record: dict[str, Any]) -> dict[str, Any]:
    return {
        key: record.get(key)
        for key in ("id", "source_url", "sha256", "bytes", "local_relative_path", "retrieved_utc")
    }


def _alternate_wcs(header: fits.Header, hdul: fits.HDUList, key: str) -> WCS:
    # SIP belongs to the primary sky WCS. Astropy otherwise applies it to A/W too.
    alternate_header = header.copy()
    for card in list(alternate_header):
        if re.match(r"^(A|B|AP|BP)_(ORDER|\d+_\d+)$", card):
            del alternate_header[card]
    return WCS(alternate_header, key=key, fobj=hdul)


def predict_coordinate(date_avg: str, timesys: str) -> SkyCoord:
    source = SkyCoord(
        ra=TARGET_SOURCE["ra_deg"] * u.deg,
        dec=TARGET_SOURCE["dec_deg"] * u.deg,
        pm_ra_cosdec=TARGET_SOURCE["pm_ra_cosdec_mas_yr"] * u.mas / u.yr,
        pm_dec=TARGET_SOURCE["pm_dec_mas_yr"] * u.mas / u.yr,
        obstime=Time(TARGET_SOURCE["epoch"]),
        frame="icrs",
    )
    # ERFA reports missing distance for angular-only propagation. This omission is
    # recorded in every prediction, rather than treated as a measured zero RV.
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore", message='ERFA function "pmsafe".*distance overridden', category=ErfaWarning
        )
        return source.apply_space_motion(new_obstime=Time(date_avg, scale=timesys.lower()))


def _finite(value: Any) -> float | None:
    value = float(value)
    return value if np.isfinite(value) else None


def _json_array(array: np.ndarray) -> list[list[float | int | None]]:
    if np.issubdtype(array.dtype, np.integer):
        return array.tolist()
    return np.where(np.isfinite(array), array, None).tolist()


def _bilinear(array: np.ndarray, x: float, y: float) -> float | None:
    """Only float calibration arrays use interpolation; FLAGS always stay native."""
    x0, y0 = int(np.floor(x)), int(np.floor(y))
    if x0 < 0 or y0 < 0 or x0 + 1 >= array.shape[1] or y0 + 1 >= array.shape[0]:
        return None
    patch = np.asarray(array[y0 : y0 + 2, x0 : x0 + 2], dtype=np.float64)
    if not np.all(np.isfinite(patch)):
        return None
    dx, dy = x - x0, y - y0
    return float(
        patch[0, 0] * (1 - dx) * (1 - dy)
        + patch[0, 1] * dx * (1 - dy)
        + patch[1, 0] * (1 - dx) * dy
        + patch[1, 1] * dx * dy
    )


def flag_definitions(header: fits.Header) -> list[dict[str, Any]]:
    result = []
    for key in header:
        match = re.fullmatch(r"MSKN(\d{4})", key)
        if match:
            suffix = match.group(1)
            bit = int(suffix)
            value = int(header[f"MSKM{suffix}"])
            if value != 1 << bit:
                raise ValueError("invalid_flag_declaration")
            result.append(
                {
                    "name": str(header[key]).strip(),
                    "bit": bit,
                    "value": value,
                    "description": str(header.get(f"MSKD{suffix}", "")).strip(),
                }
            )
    if not result:
        raise ValueError("missing_flag_declarations")
    return sorted(result, key=lambda item: item["bit"])


def quality_summary(
    planes: dict[str, np.ndarray],
    center: tuple[float, float],
    definitions: list[dict[str, Any]],
    radius: float = 3,
) -> dict[str, Any]:
    x, y = center
    height, width = planes["IMAGE"].shape
    xx, yy = np.meshgrid(
        np.arange(int(np.floor(x - radius)), int(np.ceil(x + radius)) + 1),
        np.arange(int(np.floor(y - radius)), int(np.ceil(y + radius)) + 1),
    )
    circular = (xx - x) ** 2 + (yy - y) ** 2 <= radius**2
    in_bounds = (xx >= 0) & (xx < width) & (yy >= 0) & (yy < height)
    selected = circular & in_bounds
    xs, ys = xx[selected], yy[selected]
    flags = np.asarray(planes["FLAGS"][ys, xs], dtype=np.uint32)
    image, variance = planes["IMAGE"][ys, xs], planes["VARIANCE"][ys, xs]
    counts = {
        definition["name"]: int(np.count_nonzero(flags & definition["value"]))
        for definition in definitions
    }
    known = 0
    informational = 0
    for definition in definitions:
        known |= definition["value"]
        if definition["name"] in {"SOURCE", "FULLSAMPLE"}:
            informational |= definition["value"]
    # The display retains all finite pixels, including suspect pixels for review.
    # No quantitative mask is silently selected or used as measurement approval.
    nonfinite = ~np.isfinite(image)
    review = (flags & np.uint32((~informational) & 0xFFFFFFFF)) != 0
    review |= ~np.isfinite(variance) | (variance <= 0)
    unknown = flags & np.uint32((~known) & 0xFFFFFFFF)
    return {
        "radius_px": radius,
        "center": {"x": x, "y": y},
        "window_definition": "Integer native pixel centers within r<=3 of fractional prediction; origin0",
        "pixel_count": int(selected.sum()),
        "clipped_pixel_count": int((circular & ~in_bounds).sum()),
        "image_nonfinite": int(nonfinite.sum()),
        "variance_nonfinite": int(np.count_nonzero(~np.isfinite(variance))),
        "variance_nonpositive": int(np.count_nonzero(np.isfinite(variance) & (variance <= 0))),
        "flag_counts": counts,
        "flag_definitions": definitions,
        "undeclared_bit_pixels": int(np.count_nonzero(unknown)),
        "mask_policy_id": MASK_POLICY_ID,
        "display": {
            "retained": int(np.count_nonzero(~nonfinite)),
            "excluded": int(nonfinite.sum()),
            "review_required": int(np.count_nonzero(review & ~nonfinite)),
            "reason": "Finite original pixels retained; non-informational flags and invalid variance require review.",
        },
        "quantitative": {
            "status": "not_validated",
            "reason": "PSF, response, background, registration and error model unvalidated.",
        },
    }


def _read_frame(
    root: Path,
    record: dict[str, Any],
    calibration_record: dict[str, Any],
    calibration: fits.HDUList,
    cutout_size: int,
) -> dict[str, Any]:
    path = verify_source(root, record)
    with fits.open(path, mode="readonly", memmap=False) as hdul:
        for name in ("IMAGE", "FLAGS", "VARIANCE", "ZODI", "EPSF", "WCS-WAVE"):
            if name not in hdul:
                raise ValueError("missing_required_hdu")
        header = hdul["IMAGE"].header
        if str(header["BUNIT"]).replace(" ", "") != "MJy/sr":
            raise ValueError("unexpected_image_unit")
        if not isinstance(hdul["EPSF"], fits.BinTableHDU):
            raise ValueError("epsf_not_table")  # noqa: TRY004 - invalid file schema, not a Python argument type
        date_avg, timesys = str(header["DATE-AVG"]), str(header["TIMESYS"])
        coordinate = predict_coordinate(date_avg, timesys)
        sky_wcs = WCS(header, fobj=hdul)
        x, y = (float(value) for value in sky_wcs.world_to_pixel(coordinate))
        detector_x, detector_y = (
            float(value) for value in _alternate_wcs(header, hdul, "A").all_pix2world(x, y, 0)
        )
        approximate_wave = _alternate_wcs(header, hdul, "W").all_pix2world(x, y, 0)
        if str(calibration["CWAVE"].header["DETECTOR"]).strip() != str(header["DETECTOR"]).strip():
            raise ValueError("calibration_detector_mismatch")
        wave = _bilinear(calibration["CWAVE"].data, detector_x, detector_y)
        bandwidth = _bilinear(calibration["CBAND"].data, detector_x, detector_y)
        planes = {name: hdul[name].data for name in ("IMAGE", "FLAGS", "VARIANCE", "ZODI")}
        if any(plane.shape != planes["IMAGE"].shape for plane in planes.values()):
            raise ValueError("plane_shape_mismatch")
        height, width = planes["IMAGE"].shape
        if not 0 <= x < width or not 0 <= y < height:
            raise ValueError("prediction_outside_image")
        center_x, center_y = int(np.floor(x + 0.5)), int(np.floor(y + 0.5))
        half = cutout_size // 2
        x0, x1 = max(0, center_x - half), min(width, center_x + half + 1)
        y0, y1 = max(0, center_y - half), min(height, center_y + half + 1)
        cutout = {name: _json_array(plane[y0:y1, x0:x1]) for name, plane in planes.items()}
        cutout.update(
            {
                "width": x1 - x0,
                "height": y1 - y0,
                "native_origin": {"x": x0, "y": y0},
                "array_order": "yx",
                "pixel_origin": 0,
                "requested_size": cutout_size,
                "clipped_pixel_count": cutout_size**2 - (x1 - x0) * (y1 - y0),
                "resampling": "none",
                "zodi_subtracted": False,
            }
        )
        epsf = hdul["EPSF"]
        round_trip = sky_wcs.world_to_pixel(sky_wcs.pixel_to_world(x, y))
        metadata = {
            "obs_id": str(header["OBSID"]).strip(),
            "release": OBSERVATIONS[record["id"]],
            "detector": f"D{header['DETECTOR']}",
            "pipeline_version": str(hdul[0].header["VERSION"]).strip(),
            "date_avg": date_avg,
            "timesys": timesys,
            "observer": "SPHEREx",
            "observer_id": None,
            "observer_source": "IRSA SPHEREx archive product",
            "unit": str(header["BUNIT"]).strip(),
            "variance_unit": str(hdul["VARIANCE"].header["BUNIT"]).strip(),
            "wavelength_um": wave,
            "bandwidth_um": bandwidth,
            "wavelength_method": "SWCS v5 CWAVE/CBAND bilinear at predicted active detector coordinates; no sky SIP applied",
            "approximate_embedded_wcs_wavelength_um": _finite(approximate_wave[0]),
            "approximate_embedded_wcs_bandwidth_um": _finite(approximate_wave[1]),
            "epsf": {
                "rows": len(epsf.data),
                "columns": list(epsf.columns.names),
                "oversampling": {"x": epsf.header.get("OVSMPX"), "y": epsf.header.get("OVSMPY")},
                "zone_columns": [
                    name
                    for name in ("BINX", "BINY", "XCENTER", "YCENTER", "XWIDTH", "YWIDTH")
                    if name in epsf.columns.names
                ],
            },
            "hdus": [
                {
                    "name": hdu.name,
                    "shape": list(hdu.shape) if hasattr(hdu, "shape") else None,
                    "type": hdu.__class__.__name__,
                }
                for hdu in hdul
            ],
            "wcs": {
                "origin": 0,
                "ctype": list(sky_wcs.wcs.ctype),
                "has_sip": sky_wcs.sip is not None,
                "round_trip_error_px": float(
                    np.hypot(float(round_trip[0]) - x, float(round_trip[1]) - y)
                ),
                "native_shape_yx": [height, width],
                "alternate_sip_applied": False,
            },
        }
        prediction = {
            "ra_deg": float(coordinate.ra.deg),
            "dec_deg": float(coordinate.dec.deg),
            "x": x,
            "y": y,
            "kind": "proper_motion_prediction",
            "source": TARGET_SOURCE.copy(),
            "detector_x": detector_x,
            "detector_y": detector_y,
            "omitted": ["observer_parallax", "radial_velocity", "full_covariance"],
        }
        return {
            "observation_id": record["id"],
            "metadata": metadata,
            "provenance": _provenance(record),
            "calibration": {
                **_provenance(calibration_record),
                "calibration_id": "cal-swcs-v5-2026-191",
            },
            "prediction": prediction,
            "cutout": cutout,
            "quality": quality_summary(planes, (x, y), flag_definitions(hdul["FLAGS"].header)),
        }


def build_comparison(
    root: Path, observation_ids: list[str] | None = None, cutout_size: int = 81
) -> dict[str, Any]:
    """Build a provenance-complete native comparison from selected immutable inputs."""
    observation_ids = observation_ids if observation_ids is not None else ["S01", "S02"]
    if not 1 <= len(observation_ids) <= 2 or any(
        key not in OBSERVATIONS for key in observation_ids
    ):
        raise ValueError("unsupported_observation")
    if len(set(observation_ids)) != len(observation_ids):
        raise ValueError("duplicate_observation")
    if (
        not isinstance(cutout_size, int)
        or cutout_size < 9
        or cutout_size > 101
        or cutout_size % 2 != 1
    ):
        raise ValueError("invalid_cutout_size")
    records = _records(Path(root))
    calibration_record = records["S10"]
    calibration_path = verify_source(Path(root), calibration_record)
    with fits.open(calibration_path, mode="readonly", memmap=False) as calibration:
        for name in ("CWAVE", "CBAND"):
            if str(calibration[name].header["BUNIT"]).strip() != "um":
                raise ValueError("unexpected_calibration_unit")
        frames = [
            _read_frame(Path(root), records[key], calibration_record, calibration, cutout_size)
            for key in observation_ids
        ]
    return {
        "schema_version": SCHEMA_VERSION,
        "algorithm_version": ALGORITHM_VERSION,
        "object_id": OBJECT_ID,
        "frames": frames,
        "scientific_status": "association_insufficient",
        "layout": "native_unregistered",
        "mask_policy_id": MASK_POLICY_ID,
        "limitations": LIMITATIONS.copy(),
        "software": {"astropy": astropy.__version__, "numpy": np.__version__},
    }


def list_observations(root: Path) -> list[dict[str, Any]]:
    result = build_comparison(root, cutout_size=9)
    return [
        {
            "id": frame["observation_id"],
            "observation_id": frame["observation_id"],
            "object_id": OBJECT_ID,
            **{
                key: frame["metadata"][key]
                for key in (
                    "obs_id",
                    "release",
                    "detector",
                    "date_avg",
                    "timesys",
                    "unit",
                    "wavelength_um",
                    "bandwidth_um",
                )
            },
            **{key: frame["provenance"][key] for key in ("sha256", "bytes", "source_url")},
        }
        for frame in result["frames"]
    ]
