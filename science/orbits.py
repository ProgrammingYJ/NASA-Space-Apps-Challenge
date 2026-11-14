"""Source-backed instantaneous osculating ellipse guides for nine orbiters.

The closed line is a two-body geometric guide at one epoch. It is not the body's
integrated trajectory over a full orbital period and does not change its state.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlencode

import numpy as np
from astropy.time import Time

from science.solar_system import (
    BODY_IDS,
    DEFAULT_EPOCH,
    EPOCHS,
    FRAME,
    HORIZONS_API,
    _fetch,
    get_universe,
)

ORBIT_MANIFEST = "data/manifests/solar_system_orbits.json"
ALGORITHM_VERSION = "osculating-kepler-guide-v1"
POINT_COUNT = 257
STATE_MATCH_TOLERANCE_AU = 1e-9
LIMITATIONS = [
    "Instantaneous heliocentric osculating Kepler ellipse at the selected epoch; a visual orbital guide.",
    "The closed line is not a full-period integrated many-body trajectory or a prediction of future positions.",
    "Physical vectors and source states are unchanged; display distance compression also applies to each line point.",
    "Planet-center orbital elements include their local system motion and can vary between epochs.",
]


def _hash(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def parse_elements(result: str, object_id: str, command: str) -> tuple[float, list[dict]]:
    if not re.search(rf"Target body name:\s+{object_id.title()} \({command}\)", result):
        raise ValueError("orbit_target_mismatch")
    if (
        not re.search(r"Center body name:\s+Sun \(10\)", result)
        or "Reference frame : Ecliptic of J2000.0" not in result
        or "Output type     : GEOMETRIC osculating elements" not in result
        or "Output units    : AU-D, deg, Julian Day Number (Tp)" not in result
    ):
        raise ValueError("unsupported_orbit_conventions")
    gm_match = re.search(r"Keplerian GM\s*:\s*([\d.Ee+\-]+) au\^3/d\^2", result)
    if not gm_match:
        raise ValueError("orbit_gm_missing")
    gm = float(gm_match.group(1))
    block = result.split("$$SOE", 1)[1].split("$$EOE", 1)[0].strip()
    rows = list(csv.reader(io.StringIO(block)))
    if len(rows) != len(EPOCHS):
        raise ValueError("orbit_epoch_count")
    samples = []
    for epoch, row in zip(EPOCHS, rows, strict=True):
        expected_jd = float(Time(epoch, scale="utc").tdb.jd)
        jd_tdb = float(row[0])
        if abs(expected_jd - jd_tdb) > 1e-9:
            raise ValueError("orbit_epoch_mismatch")
        elements = {
            "e": float(row[2]),
            "periapsis_au": float(row[3]),
            "inclination_deg": float(row[4]),
            "node_deg": float(row[5]),
            "argument_periapsis_deg": float(row[6]),
            "periapsis_jd_tdb": float(row[7]),
            "mean_motion_deg_day": float(row[8]),
            "mean_anomaly_deg": float(row[9]),
            "true_anomaly_deg": float(row[10]),
            "a_au": float(row[11]),
            "apoapsis_au": float(row[12]),
            "period_days": float(row[13]),
        }
        if (
            not all(np.isfinite(value) for value in elements.values())
            or not 0 <= elements["e"] < 1
            or elements["a_au"] <= 0
        ):
            raise ValueError("unsupported_nonelliptic_orbit")
        if (
            not np.isclose(
                elements["periapsis_au"],
                elements["a_au"] * (1 - elements["e"]),
                atol=1e-10,
                rtol=1e-12,
            )
            or not np.isclose(
                elements["apoapsis_au"],
                elements["a_au"] * (1 + elements["e"]),
                atol=1e-10,
                rtol=1e-12,
            )
            or not np.isclose(
                elements["period_days"], 2 * np.pi * np.sqrt(elements["a_au"] ** 3 / gm), rtol=1e-11
            )
        ):
            raise ValueError("inconsistent_kepler_elements")
        samples.append({"epoch_utc": epoch, "epoch_jd_tdb": jd_tdb, "elements": elements})
    return gm, samples


def ellipse_points(elements: dict, point_count: int = POINT_COUNT) -> np.ndarray:
    """Column-vector Rz(node) Rx(i) Rz(periapsis), with Sun at one focus."""
    if point_count < 9 or point_count > 1025:
        raise ValueError("unsupported_orbit_point_count")
    a, eccentricity = elements["a_au"], elements["e"]
    if not np.isfinite(a) or not np.isfinite(eccentricity) or a <= 0 or not 0 <= eccentricity < 1:
        raise ValueError("unsupported_nonelliptic_orbit")
    inclination, node, periapsis, anomaly = np.deg2rad(
        [
            elements[key]
            for key in ("inclination_deg", "node_deg", "argument_periapsis_deg", "true_anomaly_deg")
        ]
    )
    if not np.isfinite([inclination, node, periapsis, anomaly]).all():
        raise ValueError("invalid_orbit_angles")
    eccentric_anomaly = np.arctan2(
        np.sqrt(1 - eccentricity**2) * np.sin(anomaly), eccentricity + np.cos(anomaly)
    )
    phase = eccentric_anomaly + np.linspace(0, 2 * np.pi, point_count)
    planar = np.vstack(
        (
            a * (np.cos(phase) - eccentricity),
            a * np.sqrt(1 - eccentricity**2) * np.sin(phase),
            np.zeros(point_count),
        )
    )
    cn, sn, ci, si, cp, sp = (
        np.cos(node),
        np.sin(node),
        np.cos(inclination),
        np.sin(inclination),
        np.cos(periapsis),
        np.sin(periapsis),
    )
    rotate_node = np.array([[cn, -sn, 0], [sn, cn, 0], [0, 0, 1]])
    rotate_inclination = np.array([[1, 0, 0], [0, ci, -si], [0, si, ci]])
    rotate_periapsis = np.array([[cp, -sp, 0], [sp, cp, 0], [0, 0, 1]])
    points = (rotate_node @ rotate_inclination @ rotate_periapsis @ planar).T
    points[-1] = points[0]  # Exact closure after floating-point rotations.
    return points


def acquire_manifest(root: Path) -> dict:
    target = Path(root) / ORBIT_MANIFEST
    if target.exists():
        raise FileExistsError("orbit_manifest_already_exists")
    jd_values = [format(float(Time(epoch, scale="utc").tdb.jd), ".12f") for epoch in EPOCHS]
    bodies = []
    for object_id, command in BODY_IDS.items():
        parameters = {
            "format": "json",
            "COMMAND": f"'{command}'",
            "OBJ_DATA": "'NO'",
            "MAKE_EPHEM": "'YES'",
            "EPHEM_TYPE": "'ELEMENTS'",
            "CENTER": "'500@10'",
            "TLIST": "'" + " ".join(jd_values) + "'",
            "TLIST_TYPE": "'JD'",
            "REF_PLANE": "'ECLIPTIC'",
            "REF_SYSTEM": "'ICRF'",
            "OUT_UNITS": "'AU-D'",
            "CSV_FORMAT": "'YES'",
            "ELEM_LABELS": "'YES'",
            "TIME_TYPE": "'TDB'",
            "TP_TYPE": "'ABSOLUTE'",
        }
        url = HORIZONS_API + "?" + urlencode(parameters)
        raw, retrieved = _fetch(url)
        response = json.loads(raw)
        if response.get("error"):
            raise ValueError("horizons_orbit_error")
        gm, samples = parse_elements(response["result"], object_id, command)
        source_match = re.search(r"Target body name:.*?\{source:\s*([^}]+)\}", response["result"])
        bodies.append(
            {
                "object_id": object_id,
                "horizons_id": command,
                "keplerian_gm_au3_day2": gm,
                "samples": samples,
                "source": {
                    "url": url,
                    "parameters": parameters,
                    "retrieved_utc": retrieved,
                    "response_sha256": _hash(raw),
                    "response_bytes": len(raw),
                    "raw_response_json": raw.decode("utf-8"),
                    "signature": response["signature"],
                    "target_source": source_match.group(1) if source_match else None,
                },
            }
        )
    manifest = {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM_VERSION,
        "dataset_id": "jpl-horizons-osculating-guides-20261113-16",
        "created_utc": datetime.now(UTC).isoformat(),
        "coordinate_frame": FRAME,
        "center": "Sun (10)",
        "position_unit": "au",
        "source_time_scale": "TDB",
        "scene_time_scale": "UTC",
        "scene_epochs_utc": EPOCHS,
        "time_conversion": "Astropy Time(scene UTC).tdb.jd; ELEMENTS input/output uses TDB only.",
        "gm_convention": "Use the Keplerian GM returned for each Horizons target/center; do not substitute a radius-derived mass.",
        "point_count": POINT_COUNT,
        "bodies": bodies,
        "limitations": LIMITATIONS,
        "sources": {
            "api_documentation": "https://ssd-api.jpl.nasa.gov/doc/horizons.html",
            "element_definitions": "https://ssd.jpl.nasa.gov/horizons/manual.html#osculating-orbital-elements-table",
            "gm_constants": "https://ssd.jpl.nasa.gov/ftp/xfr/gm_Horizons.pck",
        },
    }
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(manifest, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
    return manifest


def get_orbits(root: Path, epoch: str | None = None) -> dict:
    path = Path(root) / ORBIT_MANIFEST
    raw_manifest = path.read_bytes()
    manifest = json.loads(raw_manifest)
    epoch = epoch or DEFAULT_EPOCH
    if epoch not in EPOCHS:
        raise ValueError("unsupported_orbit_epoch")
    if (
        manifest["schema_version"] != "1.0"
        or manifest["algorithm_version"] != ALGORITHM_VERSION
        or manifest["coordinate_frame"] != FRAME
        or manifest["center"] != "Sun (10)"
        or manifest["source_time_scale"] != "TDB"
        or manifest["position_unit"] != "au"
        or manifest["scene_epochs_utc"] != EPOCHS
        or manifest["point_count"] != POINT_COUNT
    ):
        raise ValueError("unsupported_orbit_schema")
    if {body["object_id"] for body in manifest["bodies"]} != set(BODY_IDS) or len(
        manifest["bodies"]
    ) != len(BODY_IDS):
        raise ValueError("incomplete_orbit_bodies")
    scene = get_universe(root, epoch)
    states = {
        body["object_id"]: body for body in scene["objects"] if body["kind"] == "solar_system"
    }
    orbits = {}
    for body in manifest["bodies"]:
        source = body["source"]
        raw = source["raw_response_json"].encode("utf-8")
        if len(raw) != source["response_bytes"] or _hash(raw) != source["response_sha256"]:
            raise ValueError("orbit_source_integrity")
        gm, samples = parse_elements(
            json.loads(raw)["result"], body["object_id"], BODY_IDS[body["object_id"]]
        )
        if samples != body["samples"] or gm != body["keplerian_gm_au3_day2"]:
            raise ValueError("orbit_derived_values_mismatch")
        sample = next(sample for sample in samples if sample["epoch_utc"] == epoch)
        points = ellipse_points(sample["elements"])
        residual_au = float(
            np.linalg.norm(points[0] - np.asarray(states[body["object_id"]]["position_au"]))
        )
        # Independent VECTORS/UT snapshots and ELEMENTS/TDB use separate time
        # conversion paths. Bound their consistency; do not call this precision.
        # 1e-9 AU is a conservative consistency bound (~150 m), allowing the
        # source JD decimal print quantization and distinct UT/TDB conversions.
        # This is not a positional uncertainty or scientific detection threshold.
        if not np.isfinite(residual_au) or residual_au > STATE_MATCH_TOLERANCE_AU:
            raise ValueError("orbit_state_mismatch")
        orbits[body["object_id"]] = {
            "kind": "osculating_kepler_guide",
            "epoch": epoch,
            "epoch_tdb_jd": sample["epoch_jd_tdb"],
            "points_au": points.tolist(),
            "closed": True,
            "center": "Sun (10)",
            "coordinate_frame": FRAME,
            "units": "au",
            "elements": sample["elements"],
            "keplerian_gm_au3_day2": gm,
            "state_check_residual_au": residual_au,
            "source": {
                "url": source["url"],
                "label": f"JPL Horizons / {source['target_source']} osculating elements",
                "response_sha256": source["response_sha256"],
                "retrieved_utc": source["retrieved_utc"],
            },
            "limitations": LIMITATIONS,
        }
    return {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM_VERSION,
        "epoch": epoch,
        "orbits": orbits,
        "source_manifest_sha256": _hash(raw_manifest),
        "exclusions": {
            "sun": "The Sun is the defined heliocentric coordinate origin.",
            "epsilon-indi-b": "Catalog direction only; no solar orbit or physical scene distance supplied.",
        },
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--acquire", action="store_true")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    if args.acquire:
        data = acquire_manifest(args.root)
        print(json.dumps({"dataset_id": data["dataset_id"], "body_count": len(data["bodies"])}))
    else:
        data = get_orbits(args.root)
        print(
            json.dumps(
                {
                    "epoch": data["epoch"],
                    "body_count": len(data["orbits"]),
                    "maximum_state_residual_au": max(
                        orbit["state_check_residual_au"] for orbit in data["orbits"].values()
                    ),
                }
            )
        )
