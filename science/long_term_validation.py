"""Acquire bounded independent Horizons reference samples for the JPL fit.

Sample discrepancies are descriptive and are not a global error guarantee.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import numpy as np

from science.long_term_model import calendar_jd, get_long_term_model, position_au

MANIFEST = "data/manifests/long_term_validation.json"
AU_KM = 149597870.700
DATES = [(-1000, 1, 1), (2000, 1, 1), (2026, 11, 14), (2500, 1, 1)]


def parse_reference(raw: bytes, target: str) -> list[dict]:
    result = json.loads(raw)["result"]
    returned = re.search(r"Target body name:.*\((\d+)\)", result)
    # Horizons canonicalizes the satellite-free Mercury/Venus barycenters to
    # 199/299 even when requested with the documented barycenter aliases 1/2.
    accepted = {"1": {"1", "199"}, "2": {"2", "299"}}.get(target, {target})
    if returned is None or returned.group(1) not in accepted:
        raise ValueError("long_term_reference_target_mismatch")
    if "Center body name: Sun (10)" not in result or "Ecliptic of J2000.0" not in result:
        raise ValueError("long_term_reference_frame_mismatch")
    rows = csv.reader(io.StringIO(result.split("$$SOE")[1].split("$$EOE")[0].strip()))
    return [
        {"jd_tdb": float(row[0]), "position_au": [float(v) for v in row[2:5]]}
        for row in rows
        if row
    ]


def _discrepancy(predicted, reference):
    p, r = np.asarray(predicted), np.asarray(reference)
    longitude = math.atan2(p[1], p[0]) - math.atan2(r[1], r[0])
    longitude = (longitude + math.pi) % (2 * math.pi) - math.pi
    latitude = math.atan2(p[2], math.hypot(p[0], p[1])) - math.atan2(r[2], math.hypot(r[0], r[1]))
    return {
        "longitude_error_arcsec": abs(math.degrees(longitude)) * 3600,
        "latitude_error_arcsec": abs(math.degrees(latitude)) * 3600,
        "distance_error_km": abs(float(np.linalg.norm(p) - np.linalg.norm(r))) * AU_KM,
        "vector_error_km": float(np.linalg.norm(p - r)) * AU_KM,
    }


def acquire(root: Path) -> dict:
    root = Path(root).resolve()
    model = get_long_term_model(root)
    jds = [calendar_jd(*date) for date in DATES]
    results = []
    for body in model["tables"]["long"]["bodies"]:
        parameters = {
            "format": "json",
            "COMMAND": body["reference_target"],
            "OBJ_DATA": "NO",
            "MAKE_EPHEM": "YES",
            "EPHEM_TYPE": "VECTORS",
            "CENTER": "500@10",
            "TLIST": " ".join(f"{jd:.9f}" for jd in jds),
            "TLIST_TYPE": "JD",
            "TIME_TYPE": "TDB",
            "REF_PLANE": "ECLIPTIC",
            "REF_SYSTEM": "ICRF",
            "OUT_UNITS": "AU-D",
            "VEC_TABLE": "2",
            "VEC_CORR": "NONE",
            "CSV_FORMAT": "YES",
            "VEC_LABELS": "YES",
        }
        query = "https://ssd.jpl.nasa.gov/api/horizons.api?" + urlencode(parameters)
        path = root / "data/reference/long-term/validation" / (body["object_id"] + ".json")
        sidecar = path.with_suffix(".source.json")
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists() or sidecar.exists():
            raw = path.read_bytes()
            source = json.loads(sidecar.read_bytes())
            if source["url"] != query or hashlib.sha256(raw).hexdigest() != source["sha256"]:
                raise ValueError("existing_long_term_validation_changed")
        else:
            with urlopen(
                Request(query, headers={"User-Agent": "SpaceApps-model-validation/0.6"}), timeout=45
            ) as response:
                raw = response.read(200_001)
            if len(raw) > 200_000:
                raise ValueError("long_term_validation_too_large")
            source = {
                "url": query,
                "parameters": parameters,
                "local_relative_path": path.relative_to(root).as_posix(),
                "bytes": len(raw),
                "sha256": hashlib.sha256(raw).hexdigest(),
                "retrieved_utc": datetime.now(UTC).isoformat(),
            }
            path.write_bytes(raw)
            sidecar.write_text(json.dumps(source, indent=2) + "\n", encoding="utf-8")
        references = parse_reference(raw, body["reference_target"])
        if len(references) != len(DATES):
            raise ValueError("long_term_reference_count_invalid")
        checks = []
        for date, jd, reference in zip(DATES, jds, references, strict=True):
            if reference["jd_tdb"] != jd:
                raise ValueError("long_term_reference_epoch_mismatch")
            fits = {}
            for family in ["long", "short"]:
                if family == "short" and not 1800 <= date[0] < 2050:
                    continue
                row = next(
                    v
                    for v in model["tables"][family]["bodies"]
                    if v["object_id"] == body["object_id"]
                )
                p = position_au(row, jd)
                fits[family] = {"position_au": p, **_discrepancy(p, reference["position_au"])}
            checks.append(
                {
                    "date_tdb": dict(zip(["year", "month", "day"], date, strict=True)),
                    **reference,
                    "fits": fits,
                }
            )
        results.append(
            {
                "object_id": body["object_id"],
                "model_body_id": body["model_body_id"],
                "reference_target": body["reference_target"],
                "source": source,
                "checks": checks,
            }
        )
    summary = {}
    for family in ["long", "short"]:
        checks = [
            check["fits"][family]
            for row in results
            for check in row["checks"]
            if family in check["fits"]
        ]
        summary[family] = {
            "sample_count": len(checks),
            **{
                key: max(v[key] for v in checks)
                for key in [
                    "longitude_error_arcsec",
                    "latitude_error_arcsec",
                    "distance_error_km",
                    "vector_error_km",
                ]
            },
        }
    value = {
        "schema_version": "1.0",
        "algorithm_version": "jpl-kepler-long-term-v1",
        "created_utc": datetime.now(UTC).isoformat(),
        "model_manifest_sha256": model["source_manifest_sha256"],
        "reference_frame": "Heliocentric geometric J2000 ecliptic, ICRF system; planetary-system barycenters 1 through 8",
        "reference_time_scale": "TDB",
        "reference_position_unit": "au",
        "results": results,
        "summary": summary,
        "limitations": [
            "These are finite reference samples at four declared epochs, not a global accuracy bound or an uncertainty/covariance model.",
            "Horizons references are planetary-system barycenters, including the Earth-Moon barycenter; they are not satellite or surface centers.",
            "The comparison checks implementation signs, time, frame and the size of approximation discrepancies. It does not turn a fitted Kepler model into an integrated ephemeris.",
            "Discrete JDTDB values define the reference epochs. Horizons' printed ancient calendar labels use its mixed Julian/Gregorian default and are not parsed as the model's proleptic Gregorian input dates.",
        ],
    }
    target = root / MANIFEST
    temporary = target.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, target)
    return value


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--acquire", action="store_true", required=True)
    parser.parse_args()
    result = acquire(Path(__file__).resolve().parents[1])
    print(json.dumps(result["summary"]))
