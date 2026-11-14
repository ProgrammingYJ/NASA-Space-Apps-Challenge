"""Bounded display interpolation of original daily JPL state-vector snapshots.

Interpolation is a calculated scene representation. It changes neither archived
SPHEREx exposures nor their timestamps, and supplies no precision guarantee.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlencode

import numpy as np
from astropy.time import Time

from science.solar_system import (
    BODY_IDS,
    DEFAULT_EPOCH,
    EPHEMERIS_MANIFEST,
    EPOCHS,
    HORIZONS_API,
    JPL_OBLIQUITY_ARCSEC,
    _fetch,
    get_universe,
)

ALGORITHM_VERSION = "display-hermite-v1"
VALIDATION_MANIFEST = "data/manifests/timeline_validation.json"
AU_KM = 149597870.700
MIDPOINTS = [f"2026-11-{day}T12:00:00Z" for day in (13, 14, 15)]
LIMITATIONS = [
    "Calculated display motion uses bounded cubic Hermite interpolation of four original daily JPL position/velocity knots.",
    "Interpolation is not a fresh Horizons query, an observed image, an independent orbit integration, or a precision measurement.",
    "Only 2026-11-13 00:00 through 2026-11-16 00:00 UTC is supported; no extrapolation.",
    "TDB days are used for state interpolation; the interface displays UTC.",
    "Orbit guides remain instantaneous osculating ellipses at 2026-11-14 00:00 UTC, separately from moving model positions.",
    "Model time and the free camera do not change SPHEREx acquisition times or observers.",
    "Midpoint validation reports discrepancies at tested samples only, without a global accuracy bound.",
]


def _time(epoch: str) -> datetime:
    value = datetime.fromisoformat(epoch)
    if value.tzinfo is None:
        raise ValueError("timeline_requires_explicit_timezone")
    return value.astimezone(UTC)


def _epoch(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def hermite_state(
    p0, v0, p1, v1, fraction: float, interval_tdb_days: float
) -> tuple[np.ndarray, np.ndarray]:
    """Positions in AU, velocities in AU/TDB-day; no out-of-range extrapolation."""
    if (
        not np.isfinite(fraction)
        or not 0 <= fraction <= 1
        or not np.isfinite(interval_tdb_days)
        or interval_tdb_days <= 0
    ):
        raise ValueError("invalid_timeline_interval")
    p0, v0, p1, v1 = (np.asarray(value, dtype=float) for value in (p0, v0, p1, v1))
    if any(value.shape != (3,) or not np.isfinite(value).all() for value in (p0, v0, p1, v1)):
        raise ValueError("invalid_timeline_state")
    if fraction == 0:
        return p0.copy(), v0.copy()
    if fraction == 1:
        return p1.copy(), v1.copy()
    u, dt = fraction, interval_tdb_days
    position = (2 * u**3 - 3 * u**2 + 1) * p0 + (u**3 - 2 * u**2 + u) * dt * v0
    position += (-2 * u**3 + 3 * u**2) * p1 + (u**3 - u**2) * dt * v1
    velocity = (6 * u**2 - 6 * u) / dt * p0 + (3 * u**2 - 4 * u + 1) * v0
    velocity += (-6 * u**2 + 6 * u) / dt * p1 + (3 * u**2 - 2 * u) * v1
    return position, velocity


def _validation(root: Path) -> tuple[dict | None, str | None]:
    path = root / VALIDATION_MANIFEST
    if not path.is_file():
        return None, None
    raw = path.read_bytes()
    value = json.loads(raw)
    if value["algorithm_version"] != ALGORITHM_VERSION:
        raise ValueError("timeline_validation_version")
    if (
        value["source_manifest_sha256"]
        != hashlib.sha256((root / EPHEMERIS_MANIFEST).read_bytes()).hexdigest()
    ):
        raise ValueError("timeline_validation_sources_changed")
    return value["summary"], hashlib.sha256(raw).hexdigest()


def get_timeline(root: Path) -> dict:
    root = Path(root)
    knots = []
    for epoch in EPOCHS:
        scene = get_universe(root, epoch)
        states = {
            body["object_id"]: {
                "position_au": body["position_au"],
                "velocity_au_day": body["velocity_au_day"],
            }
            for body in scene["objects"]
            if body["object_id"] in BODY_IDS
        }
        marker = next(body for body in scene["objects"] if body["object_id"] == "epsilon-indi-b")
        knots.append(
            {
                "epoch": epoch,
                "tdb_jd": float(Time(epoch, scale="utc").tdb.jd),
                "states": states,
                "directions": {
                    "epsilon-indi-b": {
                        "direction_ecliptic": marker["direction_ecliptic"],
                        "direction_icrs_deg": marker["direction_icrs_deg"],
                    }
                },
            }
        )
    validation, validation_hash = _validation(root)
    return {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM_VERSION,
        "start_epoch": EPOCHS[0],
        "end_epoch": EPOCHS[-1],
        "default_epoch": DEFAULT_EPOCH,
        "time_coordinate": "TDB",
        "display_time_scale": "UTC",
        "units": {"position": "au", "velocity": "au/day"},
        "knots": knots,
        "source_manifest_sha256": hashlib.sha256(
            (root / EPHEMERIS_MANIFEST).read_bytes()
        ).hexdigest(),
        "guide_reference_epoch": DEFAULT_EPOCH,
        "validation": validation,
        "timeline_validation_sha256": validation_hash,
        "limitations": LIMITATIONS,
    }


def sample_timeline(root: Path, epoch: str, *, timeline: dict | None = None) -> dict:
    """Return an exact or explicitly interpolated scene, retaining original sources."""
    timeline = timeline if timeline is not None else get_timeline(root)
    value = _time(epoch)
    knots = timeline["knots"]
    dates = [_time(knot["epoch"]) for knot in knots]
    if not dates[0] <= value <= dates[-1]:
        raise ValueError("unsupported_timeline_epoch")
    epoch = _epoch(value)
    index = next(
        (i for i in range(len(dates) - 1) if dates[i] <= value <= dates[i + 1]), len(dates) - 2
    )
    left, right = knots[index], knots[index + 1]
    if value == dates[index]:
        fraction = 0.0
    elif value == dates[index + 1]:
        fraction = 1.0
    else:
        fraction = float(
            (Time(value, scale="utc").tdb.jd - left["tdb_jd"]) / (right["tdb_jd"] - left["tdb_jd"])
        )
    exact_epoch = left["epoch"] if fraction == 0 else right["epoch"] if fraction == 1 else None
    scene = get_universe(root, exact_epoch or DEFAULT_EPOCH)
    scene["epoch"] = epoch
    scene["position_sampling"] = "source_exact" if exact_epoch else "display_interpolation"
    scene["interpolation"] = {
        "method": "none" if exact_epoch else "cubic_hermite",
        "time_coordinate": "TDB",
        "algorithm_version": ALGORITHM_VERSION,
        "source_epochs": [left["epoch"], right["epoch"]],
        "fraction": fraction,
    }
    scene["guide_reference_epoch"] = DEFAULT_EPOCH
    scene["source_manifest_sha256"] = timeline["source_manifest_sha256"]
    scene["timeline_validation_sha256"] = timeline["timeline_validation_sha256"]
    scene["supported_time_range"] = {
        "start": timeline["start_epoch"],
        "end": timeline["end_epoch"],
        "extrapolation": False,
    }
    # Replace the baseline scene's exact-epoch-only limitation for this new,
    # explicitly versioned display mode. The original source manifest is intact.
    scene["limitations"] = [
        line
        for line in scene["limitations"]
        if not line.startswith("Only the four queried UTC epochs")
    ]
    scene["limitations"] += LIMITATIONS
    for body in scene["objects"]:
        object_id = body["object_id"]
        if object_id in BODY_IDS:
            a, b = left["states"][object_id], right["states"][object_id]
            position, velocity = hermite_state(
                a["position_au"],
                a["velocity_au_day"],
                b["position_au"],
                b["velocity_au_day"],
                fraction,
                right["tdb_jd"] - left["tdb_jd"],
            )
            body["position_au"], body["velocity_au_day"] = position.tolist(), velocity.tolist()
            body["position_kind"] = (
                "geometric_ephemeris_sample" if exact_epoch else "interpolated_ephemeris"
            )
            body["position_epoch_utc"] = epoch
            body["interpolation"] = scene["interpolation"]
        elif object_id == "epsilon-indi-b" and not exact_epoch:
            # Normalized angular interpolation of the same catalog direction,
            # preserving the distance-free layer. No 3D distance is introduced.
            start = np.asarray(left["directions"][object_id]["direction_ecliptic"])
            stop = np.asarray(right["directions"][object_id]["direction_ecliptic"])
            direction = (1 - fraction) * start + fraction * stop
            direction /= np.linalg.norm(direction)
            epsilon = np.deg2rad(JPL_OBLIQUITY_ARCSEC / 3600)
            x, y, z = direction
            equatorial = [
                x,
                y * np.cos(epsilon) - z * np.sin(epsilon),
                y * np.sin(epsilon) + z * np.cos(epsilon),
            ]
            body["direction_ecliptic"] = direction.tolist()
            body["direction_icrs_deg"] = {
                "ra": float(np.rad2deg(np.arctan2(equatorial[1], equatorial[0])) % 360),
                "dec": float(np.rad2deg(np.arcsin(equatorial[2]))),
            }
            body["direction_epoch_utc"] = epoch
            body["position_kind"] = "interpolated_catalog_direction"
    return scene


def acquire_validation(root: Path) -> dict:
    """Acquire separate official midpoint states; never invoked by the website."""
    target = Path(root) / VALIDATION_MANIFEST
    if target.exists():
        raise FileExistsError("timeline_validation_already_exists")
    timeline = get_timeline(root)
    samples = {epoch: sample_timeline(root, epoch, timeline=timeline) for epoch in MIDPOINTS}
    results = []
    for object_id, command in BODY_IDS.items():
        parameters = {
            "format": "json",
            "COMMAND": f"'{command}'",
            "OBJ_DATA": "'NO'",
            "MAKE_EPHEM": "'YES'",
            "EPHEM_TYPE": "'VECTORS'",
            "CENTER": "'500@10'",
            "TLIST_TYPE": "'JD'",
            "TLIST": "'"
            + " ".join(format(float(Time(epoch, scale="utc").jd), ".12f") for epoch in MIDPOINTS)
            + "'",
            "REF_PLANE": "'ECLIPTIC'",
            "REF_SYSTEM": "'ICRF'",
            "OUT_UNITS": "'AU-D'",
            "VEC_TABLE": "'2'",
            "VEC_CORR": "'NONE'",
            "CSV_FORMAT": "'YES'",
            "TIME_TYPE": "'UT'",
        }
        url = HORIZONS_API + "?" + urlencode(parameters)
        raw, retrieved = _fetch(url)
        response = json.loads(raw)
        if response.get("error"):
            raise ValueError("horizons_validation_error")
        text = response["result"]
        rows = list(csv.reader(io.StringIO(text.split("$$SOE", 1)[1].split("$$EOE", 1)[0].strip())))
        checks = []
        for epoch, row in zip(MIDPOINTS, rows, strict=True):
            actual_position = np.asarray([float(item) for item in row[2:5]])
            actual_velocity = np.asarray([float(item) for item in row[5:8]])
            body = next(
                body for body in samples[epoch]["objects"] if body["object_id"] == object_id
            )
            checks.append(
                {
                    "epoch": epoch,
                    "actual_position_au": actual_position.tolist(),
                    "actual_velocity_au_day": actual_velocity.tolist(),
                    "position_discrepancy_km": float(
                        np.linalg.norm(actual_position - body["position_au"]) * AU_KM
                    ),
                    "velocity_discrepancy_km_s": float(
                        np.linalg.norm(actual_velocity - body["velocity_au_day"]) * AU_KM / 86400
                    ),
                }
            )
        results.append(
            {
                "object_id": object_id,
                "checks": checks,
                "source": {
                    "url": url,
                    "parameters": parameters,
                    "retrieved_utc": retrieved,
                    "signature": response["signature"],
                    "response_bytes": len(raw),
                    "response_sha256": hashlib.sha256(raw).hexdigest(),
                    "raw_response_json": raw.decode("utf-8"),
                },
            }
        )
    value = {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM_VERSION,
        "created_utc": datetime.now(UTC).isoformat(),
        "source_manifest_sha256": timeline["source_manifest_sha256"],
        "results": results,
        "summary": {
            "method": "Separate Horizons geometric VECTORS/UT queries at three non-knot daily midpoints for each of nine bodies.",
            "sample_count": 27,
            "max_observed_midpoint_error_km": max(
                check["position_discrepancy_km"] for row in results for check in row["checks"]
            ),
            "scope": "Tested midpoint discrepancies only; not a global bound, positional uncertainty or independent dynamical ephemeris validation.",
        },
    }
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
    return value


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--validate", action="store_true")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    result = acquire_validation(args.root) if args.validate else get_timeline(args.root)
    print(
        json.dumps(
            result["summary"]
            if args.validate
            else {"algorithm_version": result["algorithm_version"], "knots": len(result["knots"])}
        )
    )
