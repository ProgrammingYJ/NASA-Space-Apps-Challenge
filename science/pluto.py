"""Native Pluto observations tied to a preserved JPL/SPHEREx observer ephemeris.

This path supplies actual L2 pixels and predicted directions. It does not fit
centroids, register frames, measure flux or establish motion of an image source.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import astropy
import numpy as np
from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS

from science.spherex import (
    MASK_POLICY_ID,
    SCHEMA_VERSION,
    _alternate_wcs,
    _bilinear,
    _finite,
    _json_array,
    _provenance,
    _records,
    flag_definitions,
    quality_summary,
    verify_source,
)

ALGORITHM_VERSION = "pluto-native-v1"
OBJECT_ID = "pluto"
OBSERVATIONS = {"S12": "2026W40_1A_0373_4", "S14": "2026W40_2A_0244_1"}
CALIBRATION_ID = "L051"
EPHEMERIS_PATH = "data/manifests/pluto_ephemeris.json"
LIMITATIONS = [
    "Native images are not registered; blink is visual inspection only.",
    "The marker is a JPL Horizons prediction for the SPHEREx observer, not an image centroid.",
    "The SPHEREx observer trajectory uses concatenated Space-Track TLEs; its uncertainty is not quantified here.",
    "Reference-star registration, cross-position source association, blending and error models have not been validated; measured motion is not established.",
    "The two exposures have different local wavelengths and PSFs; quantitative photometric comparison is not validated.",
    "IMAGE is L2 surface brightness in MJy/sr; ZODI has not been subtracted here.",
    "SOURCE is informational, OUTLIER remains reviewable, and flag counts overlap.",
]


def _ephemeris(root: Path) -> tuple[dict[str, Any], dict[str, dict[str, Any]], str]:
    """Validate the preserved response and derive positions from its actual CSV rows."""
    path = root / EPHEMERIS_PATH
    if path.stat().st_size > 100_000:
        raise ValueError("ephemeris_snapshot_too_large")
    raw = path.read_bytes()
    snapshot = json.loads(raw)
    parsed_url = urlparse(snapshot["source_url"])
    parameters = parse_qs(parsed_url.query)
    if (
        parsed_url.scheme != "https"
        or parsed_url.netloc != "ssd.jpl.nasa.gov"
        or parsed_url.path != "/api/horizons.api"
        or parameters.get("COMMAND") != ["999"]
        or parameters.get("CENTER") != ["500@-163182"]
        or parameters.get("REF_SYSTEM") != ["ICRF"]
        or parameters.get("TIME_TYPE") != ["UT"]
        or parameters.get("QUANTITIES") != ["1,20,23"]
    ):
        raise ValueError("ephemeris_source_mismatch")
    for prefix in ("", "observer_"):
        response = snapshot[f"{prefix}response_text"]
        if (
            hashlib.sha256(response.encode("utf-8")).hexdigest()
            != snapshot[f"{prefix}response_sha256"]
        ):
            raise ValueError("ephemeris_response_hash_mismatch")
    response = json.loads(snapshot["response_text"])
    if "error" in response:
        raise ValueError("ephemeris_response_error")
    text = response["result"]
    if "Center body name: SPHEREx (spacecraft) (-163182)" not in text:
        raise ValueError("ephemeris_observer_mismatch")
    rows = list(csv.reader(io.StringIO(text.split("$$SOE")[1].split("$$EOE")[0].strip())))
    declared = snapshot["observations"]
    if len(rows) != 2 or {row["observation_id"] for row in declared} != set(OBSERVATIONS):
        raise ValueError("ephemeris_rows_mismatch")
    positions = {}
    for record, row in zip(declared, rows, strict=True):
        date = datetime.strptime(row[0].strip(), "%Y-%b-%d %H:%M:%S.%f").isoformat(
            timespec="milliseconds"
        )
        if date != record["date_avg"] or record["timesys"] != "UTC":
            raise ValueError("ephemeris_time_mismatch")
        if abs(Time(date, scale="utc").jd - float(record["jd_utc"])) > 1e-8:
            raise ValueError("ephemeris_jd_mismatch")
        ra, dec = float(row[3]), float(row[4])
        if not 0 <= ra < 360 or not -90 <= dec <= 90:
            raise ValueError("ephemeris_coordinate_out_of_bounds")
        if ra != record["ra_deg"] or dec != record["dec_deg"]:
            raise ValueError("ephemeris_coordinate_mismatch")
        positions[record["observation_id"]] = {
            **record,
            "ra_deg": ra,
            "dec_deg": dec,
            "observer_range_au": float(row[5]),
            "range_rate_km_s": float(row[6]),
            "solar_elongation_deg": float(row[7]),
        }
    return snapshot, positions, hashlib.sha256(raw).hexdigest()


def _read_frame(
    root: Path,
    record: dict[str, Any],
    calibration_record: dict[str, Any],
    calibration: fits.HDUList,
    ephemeris: dict[str, Any],
    position: dict[str, Any],
    cutout_size: int,
) -> dict[str, Any]:
    path = verify_source(root, record)
    calibration_check = ephemeris.get("calibration_verification", {})
    if (
        calibration_check.get("manifest_id") != calibration_record["id"]
        or calibration_check.get("sha256") != calibration_record["sha256"]
        or calibration_check.get("bytes") != calibration_record["bytes"]
    ):
        raise ValueError("datalink_calibration_mismatch")
    calibration_link = next(
        link for link in calibration_check["datalinks"] if link["observation_id"] == record["id"]
    )
    if (
        hashlib.sha256(calibration_link["response_text"].encode("utf-8")).hexdigest()
        != calibration_link["response_sha256"]
        or calibration_link["calibration_url"] != calibration_check["source_url"]
        or calibration_link["calibration_url"] not in calibration_link["response_text"]
    ):
        raise ValueError("datalink_response_mismatch")
    with fits.open(path, mode="readonly", memmap=False) as hdul:
        for name in ("IMAGE", "FLAGS", "VARIANCE", "ZODI", "EPSF", "WCS-WAVE"):
            if name not in hdul:
                raise ValueError("missing_required_hdu")
        header = hdul["IMAGE"].header
        if (
            str(header["OBSID"]).strip() != OBSERVATIONS[record["id"]]
            or str(header["DETECTOR"]).strip() != "3"
            or str(header["BUNIT"]).replace(" ", "") != "MJy/sr"
        ):
            raise ValueError("unexpected_observation_metadata")
        date_avg, timesys = str(header["DATE-AVG"]), str(header["TIMESYS"])
        if date_avg != position["date_avg"] or timesys != position["timesys"]:
            raise ValueError("ephemeris_observation_time_mismatch")
        if not isinstance(hdul["EPSF"], fits.BinTableHDU):
            raise TypeError("epsf_not_table")
        coordinate = SkyCoord(position["ra_deg"] * u.deg, position["dec_deg"] * u.deg)
        sky_wcs = WCS(header, fobj=hdul)
        x, y = (float(value) for value in sky_wcs.world_to_pixel(coordinate))
        detector_x, detector_y = (
            float(value) for value in _alternate_wcs(header, hdul, "A").all_pix2world(x, y, 0)
        )
        approximate_wave = _alternate_wcs(header, hdul, "W").all_pix2world(x, y, 0)
        if str(calibration["CWAVE"].header["DETECTOR"]).strip() != "3":
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
        return {
            "observation_id": record["id"],
            "metadata": {
                "object_name": "Pluto",
                "obs_id": str(header["OBSID"]).strip(),
                "release": "QR3",
                "detector": "D3",
                "pipeline_version": str(hdul[0].header["VERSION"]).strip(),
                "date_avg": date_avg,
                "timesys": timesys,
                "observer": "SPHEREx",
                "observer_id": "-163182",
                "observer_source": ephemeris["observer_source_url"],
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
                    "oversampling": {
                        "x": epsf.header.get("OVSMPX"),
                        "y": epsf.header.get("OVSMPY"),
                    },
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
            },
            "provenance": _provenance(record),
            "calibration": {
                **_provenance(calibration_record),
                "calibration_id": "cal-swcs-v5-2026-191",
                "datalink_source_url": calibration_link["calibration_url"],
                "datalink_observation_url": calibration_link["source_url"],
                "datalink_response_sha256": calibration_link["response_sha256"],
                "datalink_release": "DR1",
            },
            "prediction": {
                "ra_deg": float(coordinate.ra.deg),
                "dec_deg": float(coordinate.dec.deg),
                "x": x,
                "y": y,
                "detector_x": detector_x,
                "detector_y": detector_y,
                "kind": "observer_ephemeris_prediction",
                "source": {
                    "url": ephemeris["source_url"],
                    "epoch": date_avg,
                    "frame": "ICRF",
                    "object_name": "Pluto",
                    "target_id": "999",
                    "observer_id": "-163182",
                    "observer": "SPHEREx",
                    "time_scale": timesys,
                    "response_sha256": ephemeris["response_sha256"],
                    "retrieved_utc": ephemeris["retrieved_utc"],
                    "light_time": "Horizons astrometric observer quantity 1; down-leg light-time included",
                    "assumptions": ephemeris["limitations"],
                },
                "observer_range_au": position["observer_range_au"],
                "solar_elongation_deg": position["solar_elongation_deg"],
                "omitted": [
                    "observer_ephemeris_uncertainty",
                    "measured_centroid",
                    "registration",
                    "source_association",
                    "motion_validation",
                ],
            },
            "cutout": cutout,
            "quality": quality_summary(planes, (x, y), flag_definitions(hdul["FLAGS"].header)),
        }


def build_pluto_comparison(
    root: Path, observation_ids: list[str] | None = None, cutout_size: int = 81
) -> dict[str, Any]:
    root = Path(root)
    ids = observation_ids if observation_ids is not None else list(OBSERVATIONS)
    if not 1 <= len(ids) <= 2 or any(key not in OBSERVATIONS for key in ids):
        raise ValueError("unsupported_observation")
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate_observation")
    if not isinstance(cutout_size, int) or not 9 <= cutout_size <= 101 or cutout_size % 2 != 1:
        raise ValueError("invalid_cutout_size")
    snapshot, positions, snapshot_sha = _ephemeris(root)
    records = _records(root)
    calibration_record = records[CALIBRATION_ID]
    with fits.open(verify_source(root, calibration_record), mode="readonly", memmap=False) as cal:
        for name in ("CWAVE", "CBAND"):
            if str(cal[name].header["BUNIT"]).strip() != "um":
                raise ValueError("unexpected_calibration_unit")
        frames = [
            _read_frame(
                root, records[key], calibration_record, cal, snapshot, positions[key], cutout_size
            )
            for key in ids
        ]
    separation = None
    if len(frames) == 2:
        coordinates = SkyCoord(
            [frame["prediction"]["ra_deg"] for frame in frames] * u.deg,
            [frame["prediction"]["dec_deg"] for frame in frames] * u.deg,
        )
        separation = float(coordinates[0].separation(coordinates[1]).arcsec)
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
        "ephemeris_manifest_path": EPHEMERIS_PATH,
        "ephemeris_manifest_sha256": snapshot_sha,
        "predicted_displacement_arcsec": separation,
        "predicted_displacement_kind": "JPL SPHEREx-observer prediction; not measured image motion",
    }


def list_pluto_observations(root: Path) -> list[dict[str, Any]]:
    result = build_pluto_comparison(root, cutout_size=9)
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
