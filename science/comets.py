"""Source-verified historical comet windows, not all-date orbit propagation."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import re
from datetime import UTC, datetime
from itertools import pairwise
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

MANIFEST = "data/manifests/comets.json"
RAW_ROOT = "data/reference/comets"
ALGORITHM = "historical-comets-v1"
COMET_COVERAGE = "four_selected_historical_comet_windows_not_all_dates_or_all_comets"
INTERPOLATION_TOLERANCE_AU = 1e-5
INTERPOLATION_SCOPE = (
    "separately_requested_same_solution_display_interpolation_check_not_orbit_accuracy_bound"
)
SPECIFICATIONS = (
    (
        "comet-halley",
        "Halley",
        "1P/Halley",
        "90000030;",
        "1P/Halley",
        "1986-01-01",
        "1986-05-01",
        "1000036",
    ),
    (
        "comet-hale-bopp",
        "Hale-Bopp",
        "C/1995 O1",
        "DES=1000132;",
        "Hale-Bopp (C/1995 O1)",
        "1997-02-01",
        "1997-06-01",
        None,
    ),
    (
        "comet-neowise",
        "NEOWISE",
        "C/2020 F3",
        "DES=1003667;",
        "NEOWISE (C/2020 F3)",
        "2020-05-01",
        "2020-09-01",
        None,
    ),
    (
        "comet-67p",
        "67P",
        "67P/Churyumov-Gerasimenko",
        "90000703;",
        "67P/Churyumov-Gerasimenko",
        "2015-06-01",
        "2015-10-01",
        "1000012",
    ),
)
LIMITATIONS = [
    "Positions are JPL Horizons geometric predictions for the recorded historical window, not measured comet photographs or newly measured positions.",
    "Times are TDB as declared by Horizons; source calendar labels are not UTC or local receiving times.",
    "Daily position/velocity knots support display interpolation only inside the supplied window; no extrapolation or billion-year comet history is provided.",
    "Coma/tail shape, length, color and nucleus size used by the UI are illustrations; these vector inputs do not measure them.",
    "A separately requested near-perihelion quarter-step checks interpolation against the same JPL solution; it is not an independent orbit-accuracy bound.",
]


def _hash(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _safe_url(url: str) -> None:
    parts = urlsplit(url)
    if (
        parts.scheme != "https"
        or parts.hostname != "ssd.jpl.nasa.gov"
        or parts.path != "/api/horizons.api"
        or parts.username
        or parts.password
    ):
        raise ValueError("invalid_comet_source_url")


def _source_path(root: Path, relative: str) -> Path:
    path = (root / relative).resolve()
    if not path.is_relative_to((root / RAW_ROOT).resolve()):
        raise ValueError("comet_source_path_escape")
    return path


def _fetch(root: Path, key: str, parameters: dict[str, str]) -> tuple[bytes, dict]:
    url = "https://ssd.jpl.nasa.gov/api/horizons.api?" + urlencode(parameters)
    _safe_url(url)
    path = root / RAW_ROOT / (key + ".json")
    sidecar = path.with_suffix(".source.json")
    if path.exists() or sidecar.exists():
        source, raw = json.loads(sidecar.read_bytes()), path.read_bytes()
        if source["url"] != url or len(raw) != source["bytes"] or _hash(raw) != source["sha256"]:
            raise ValueError("existing_comet_original_changed")
        return raw, source
    with urlopen(
        Request(url, headers={"User-Agent": "SpaceApps-historical-comets/1.0"}), timeout=45
    ) as response:
        _safe_url(response.url)
        raw = response.read(3_000_001)
        resolved = response.url
    if not raw or len(raw) > 3_000_000:
        raise ValueError("invalid_comet_source_size")
    source = {
        "source_id": key,
        "url": url,
        "resolved_url": resolved,
        "local_relative_path": path.relative_to(root).as_posix(),
        "bytes": len(raw),
        "sha256": _hash(raw),
        "retrieved_utc": datetime.now(UTC).isoformat(),
        "archive": "NASA/JPL Horizons API",
        "query_parameters": parameters,
        "redistribution": "NASA_JPL_ephemeris_response_with_source_credit",
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    sidecar.write_text(json.dumps(source, indent=2) + "\n", encoding="utf-8")
    return raw, source


def parse_vectors(raw: bytes, expected_target: str) -> tuple[list[dict], dict]:
    response = json.loads(raw)
    if (
        response.get("error")
        or response.get("signature", {}).get("source") != "NASA/JPL Horizons API"
    ):
        raise ValueError("invalid_comet_horizons_response")
    text = response.get("result", "")
    if "$$SOE" not in text or "$$EOE" not in text:
        raise ValueError("ambiguous_or_missing_comet_vectors")
    header = text.split("$$SOE", 1)[0]
    target = re.search(r"^Target body name:\s*(.*?)\s*\{source:\s*(.*?)\}", header, re.MULTILINE)
    if (
        not target
        or target.group(1).strip() != expected_target
        or not re.search(r"^Center body name:\s*Sun \(10\)", header, re.MULTILINE)
        or not re.search(r"^Output units\s*:\s*AU-D\s*$", header, re.MULTILINE)
        or not re.search(r"^Reference frame\s*:\s*Ecliptic of J2000.0\s*$", header, re.MULTILINE)
        or not re.search(r"^Output type\s*:\s*GEOMETRIC cartesian states\s*$", header, re.MULTILINE)
        or not re.search(r"^Start time\s*:.*\sTDB\s*$", header, re.MULTILINE)
        or not re.search(r"^Stop\s+time\s*:.*\sTDB\s*$", header, re.MULTILINE)
    ):
        raise ValueError("comet_reference_contract_changed")
    rows = csv.reader(io.StringIO(text.split("$$SOE", 1)[1].split("$$EOE", 1)[0]))
    knots = []
    for row in rows:
        if not row:
            continue
        row = [value.strip() for value in row]
        while row and not row[-1]:
            row.pop()
        if len(row) != 8:
            raise ValueError("invalid_comet_vector_columns")
        values = [float(row[index]) for index in [0, 2, 3, 4, 5, 6, 7]]
        if not all(math.isfinite(value) for value in values):
            raise ValueError("nonfinite_comet_vector")
        if knots and values[0] <= knots[-1]["jd_tdb"]:
            raise ValueError("nonincreasing_comet_times")
        knots.append(
            {
                "jd_tdb": values[0],
                "calendar_tdb": row[1],
                "position_au": values[1:4],
                "velocity_au_day": values[4:7],
            }
        )
    if not knots:
        raise ValueError("empty_comet_vectors")
    return knots, {"target_name": target.group(1).strip(), "solution": target.group(2).strip()}


def hermite_position(left: dict, right: dict, jd_tdb: float) -> list[float]:
    if not left["jd_tdb"] <= jd_tdb <= right["jd_tdb"]:
        raise ValueError("comet_interpolation_outside_knots")
    interval = right["jd_tdb"] - left["jd_tdb"]
    if interval <= 0:
        raise ValueError("invalid_comet_interval")
    t = (jd_tdb - left["jd_tdb"]) / interval
    return [
        (2 * t**3 - 3 * t**2 + 1) * left["position_au"][axis]
        + (t**3 - 2 * t**2 + t) * interval * left["velocity_au_day"][axis]
        + (-2 * t**3 + 3 * t**2) * right["position_au"][axis]
        + (t**3 - t**2) * interval * right["velocity_au_day"][axis]
        for axis in range(3)
    ]


def _vector_parameters(command: str, start: str, stop: str) -> dict[str, str]:
    return {
        "format": "json",
        "COMMAND": "'" + command + "'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'VECTORS'",
        "CENTER": "'500@10'",
        "START_TIME": "'" + start + "'",
        "STOP_TIME": "'" + stop + "'",
        "STEP_SIZE": "'1 d'",
        "OUT_UNITS": "'AU-D'",
        "REF_PLANE": "'ECLIPTIC'",
        "REF_SYSTEM": "'J2000'",
        "VEC_TABLE": "'2'",
        "CSV_FORMAT": "'YES'",
        "VEC_CORR": "'NONE'",
        "TIME_TYPE": "'TDB'",
    }


def acquire(root: Path, output: Path) -> dict:
    root = root.resolve()
    objects, sources = [], {}
    for object_id, name, designation, command, target, start, stop, lookup in SPECIFICATIONS:
        local_sources = []
        if lookup:
            raw, source = _fetch(
                root,
                object_id + "-identity",
                {"format": "json", "COMMAND": "'DES=" + lookup + ";'", "MAKE_EPHEM": "'NO'"},
            )
            text = json.loads(raw).get("result", "")
            if command.rstrip(";") not in text or lookup not in text:
                raise ValueError("comet_record_identity_changed")
            sources[source["source_id"]] = source
            local_sources.append(source)
        parameters = _vector_parameters(command, start, stop)
        raw, source = _fetch(root, object_id + "-daily", parameters)
        knots, solution = parse_vectors(raw, target)
        if len(knots) < 100 or any(
            right["jd_tdb"] - left["jd_tdb"] != 1 for left, right in pairwise(knots)
        ):
            raise ValueError("invalid_comet_daily_window")
        sources[source["source_id"]] = source
        local_sources.append(source)
        default = min(range(len(knots)), key=lambda index: math.hypot(*knots[index]["position_au"]))
        left_index = min(default, len(knots) - 2)
        quarter_jd = knots[left_index]["jd_tdb"] + 0.25
        quarter_parameters = {
            key: value
            for key, value in parameters.items()
            if key not in {"START_TIME", "STOP_TIME", "STEP_SIZE"}
        }
        quarter_parameters["TLIST"] = "'" + str(quarter_jd) + "'"
        quarter_raw, quarter_source = _fetch(root, object_id + "-quarter-check", quarter_parameters)
        quarter_knots, quarter_solution = parse_vectors(quarter_raw, target)
        if (
            len(quarter_knots) != 1
            or quarter_knots[0]["jd_tdb"] != quarter_jd
            or quarter_solution != solution
        ):
            raise ValueError("comet_quarter_reference_changed")
        error = math.dist(
            hermite_position(knots[left_index], knots[left_index + 1], quarter_jd),
            quarter_knots[0]["position_au"],
        )
        if error > INTERPOLATION_TOLERANCE_AU:
            raise ValueError("comet_display_interpolation_tolerance_failed")
        sources[quarter_source["source_id"]] = quarter_source
        local_sources.append(quarter_source)
        objects.append(
            {
                "object_id": object_id,
                "name": name,
                "designation": designation,
                "default_index": default,
                "frame": "J2000 ecliptic",
                "center": "Sun",
                "time_scale": "TDB",
                "knots": knots,
                "sources": local_sources,
                "solution": solution,
                "interpolation_check": {
                    "left_index": left_index,
                    "fraction": 0.25,
                    "source_id": quarter_source["source_id"],
                    "sample": quarter_knots[0],
                    "error_au": error,
                    "tolerance_au": INTERPOLATION_TOLERANCE_AU,
                    "scope": INTERPOLATION_SCOPE,
                },
                "limitations": LIMITATIONS,
            }
        )
    manifest = {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM,
        "created_utc": datetime.now(UTC).isoformat(),
        "coverage": COMET_COVERAGE,
        "objects": objects,
        "sources": sources,
        "limitations": LIMITATIONS,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )
    return get_comets(root, manifest_path=output)


def get_comets(root: Path, *, manifest_path: Path | None = None) -> dict:
    root = root.resolve()
    raw_manifest = (manifest_path or root / MANIFEST).read_bytes()
    manifest = json.loads(raw_manifest)
    if (
        manifest.get("schema_version") != "1.0"
        or manifest.get("algorithm_version") != ALGORITHM
        or manifest.get("coverage") != COMET_COVERAGE
        or manifest.get("limitations") != LIMITATIONS
    ):
        raise ValueError("unsupported_comet_manifest")
    if len(manifest.get("objects", [])) != len(SPECIFICATIONS):
        raise ValueError("comet_object_set_changed")
    originals = {}
    for key, source in manifest["sources"].items():
        _safe_url(source["url"])
        raw = _source_path(root, source["local_relative_path"]).read_bytes()
        if (
            key != source["source_id"]
            or len(raw) != source["bytes"]
            or _hash(raw) != source["sha256"]
        ):
            raise ValueError("comet_source_integrity_failed")
        if source["url"] != "https://ssd.jpl.nasa.gov/api/horizons.api?" + urlencode(
            source["query_parameters"]
        ):
            raise ValueError("comet_query_provenance_changed")
        originals[key] = raw
    used = set()
    for item, spec in zip(manifest["objects"], SPECIFICATIONS, strict=True):
        object_id, name, designation, command, target, start, stop, lookup = spec
        if any(
            item.get(key) != expected
            for key, expected in [
                ("object_id", object_id),
                ("name", name),
                ("designation", designation),
                ("frame", "J2000 ecliptic"),
                ("center", "Sun"),
                ("time_scale", "TDB"),
                ("limitations", LIMITATIONS),
            ]
        ):
            raise ValueError("comet_identity_or_reference_changed")
        expected_keys = {object_id + "-daily", object_id + "-quarter-check"} | (
            {object_id + "-identity"} if lookup else set()
        )
        if {source["source_id"] for source in item["sources"]} != expected_keys:
            raise ValueError("comet_object_source_set_changed")
        for source in item["sources"]:
            if source != manifest["sources"][source["source_id"]]:
                raise ValueError("comet_object_source_changed")
        used |= expected_keys
        daily_source = manifest["sources"][object_id + "-daily"]
        expected_parameters = _vector_parameters(command, start, stop)
        if daily_source["query_parameters"] != expected_parameters:
            raise ValueError("comet_record_selection_changed")
        knots, solution = parse_vectors(originals[object_id + "-daily"], target)
        if (
            item["knots"] != knots
            or item["solution"] != solution
            or len(knots) < 100
            or any(right["jd_tdb"] - left["jd_tdb"] != 1 for left, right in pairwise(knots))
        ):
            raise ValueError("comet_vectors_changed")
        default = min(range(len(knots)), key=lambda index: math.hypot(*knots[index]["position_au"]))
        if item["default_index"] != default:
            raise ValueError("comet_default_index_changed")
        quarter, quarter_solution = parse_vectors(originals[object_id + "-quarter-check"], target)
        check = item["interpolation_check"]
        left = min(default, len(knots) - 2)
        expected_jd = knots[left]["jd_tdb"] + 0.25
        quarter_parameters = {
            key: value
            for key, value in expected_parameters.items()
            if key not in {"START_TIME", "STOP_TIME", "STEP_SIZE"}
        } | {"TLIST": "'" + str(expected_jd) + "'"}
        if (
            manifest["sources"][object_id + "-quarter-check"]["query_parameters"]
            != quarter_parameters
        ):
            raise ValueError("comet_query_provenance_changed")
        if lookup:
            identity_source = manifest["sources"][object_id + "-identity"]
            identity_parameters = {
                "format": "json",
                "COMMAND": "'DES=" + lookup + ";'",
                "MAKE_EPHEM": "'NO'",
            }
            identity_text = json.loads(originals[object_id + "-identity"]).get("result", "")
            if (
                identity_source["query_parameters"] != identity_parameters
                or command.rstrip(";") not in identity_text
                or lookup not in identity_text
            ):
                raise ValueError("comet_record_identity_changed")
        if (
            len(quarter) != 1
            or quarter[0]["jd_tdb"] != expected_jd
            or quarter_solution != solution
            or check["sample"] != quarter[0]
            or check["left_index"] != left
            or check["fraction"] != 0.25
            or check["source_id"] != object_id + "-quarter-check"
            or check["tolerance_au"] != INTERPOLATION_TOLERANCE_AU
            or check["scope"] != INTERPOLATION_SCOPE
        ):
            raise ValueError("comet_interpolation_reference_changed")
        error = math.dist(
            hermite_position(knots[left], knots[left + 1], expected_jd), quarter[0]["position_au"]
        )
        if check["error_au"] != error or error > INTERPOLATION_TOLERANCE_AU:
            raise ValueError("comet_display_interpolation_tolerance_failed")
    if used != set(manifest["sources"]):
        raise ValueError("comet_source_set_changed")
    return manifest | {"source_manifest_sha256": _hash(raw_manifest)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    result = acquire(arguments.root, arguments.output)
    print(
        json.dumps(
            {
                "objects": len(result["objects"]),
                "sources": len(result["sources"]),
                "knots": {item["object_id"]: len(item["knots"]) for item in result["objects"]},
            }
        )
    )
