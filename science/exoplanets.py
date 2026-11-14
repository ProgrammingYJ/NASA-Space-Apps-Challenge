"""Offline, dated inventory of every default confirmed-planet archive solution.

The catalog supplies published parameters, never measured surface maps or
instantaneous 3D orbital positions. Acquisition is an explicit development CLI.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import math
import re
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

CATALOG = "data/manifests/exoplanets.json"
RAW = "data/reference/catalog/exoplanets_ps_default.json"
ENDPOINT = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
DOC = "https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html"
COLUMNS = [
    "pl_name",
    "hostname",
    "sy_snum",
    "sy_pnum",
    "cb_flag",
    "pl_controv_flag",
    "discoverymethod",
    "disc_year",
    "disc_refname",
    "pl_refname",
    "ra",
    "dec",
    "sy_dist",
    "sy_disterr1",
    "sy_disterr2",
    "pl_orbper",
    "pl_orbpererr1",
    "pl_orbpererr2",
    "pl_orbsmax",
    "pl_orbsmaxerr1",
    "pl_orbsmaxerr2",
    "pl_orbeccen",
    "pl_orbincl",
    "pl_orblper",
    "pl_orbtper",
    "pl_rade",
    "pl_radeerr1",
    "pl_radeerr2",
    "pl_radelim",
    "pl_bmasse",
    "pl_bmasseerr1",
    "pl_bmasseerr2",
    "pl_bmassprov",
    "pl_bmasselim",
    "pl_eqt",
    "st_teff",
    "st_rad",
    "st_mass",
    "rowupdate",
]
LIMITATIONS = [
    "Every row returned by the dated PS default_flag=1 confirmed-planet query is included, including disputed confirmations identified by pl_controv_flag.",
    "These are literature/default archive solutions, with missing values retained as null; this is not a complete census of planets in the universe.",
    "No resolved exoplanet surface map is provided. Rendered surfaces, colors, clouds and lighting are illustrative, not observed geography.",
    "A reported semimajor axis may instead be projected separation for imaging/microlensing; do not treat it as an orbit without checking the paper.",
    "Mass provenance (Mass, M*sin(i), or derived Mass*sin(i)/sin(i)), upper/lower limits and uncertainties are retained.",
    "Sky coordinates and distance are catalog values, with catalog epoch and covariance not established here; no 2026 proper-motion propagation or verified instantaneous exoplanet position is claimed.",
    "Single default PS rows are used rather than mixing composite values from different papers. No existence/detection posterior is computed.",
]


def object_id(name: str) -> str:
    return "exo-" + hashlib.sha256(name.encode()).hexdigest()[:20]


def reference(value: str | None) -> dict | None:
    if not value:
        return None
    match = re.search(r"href\s*=\s*['\"](https?://[^'\"]+)['\"]", value, re.IGNORECASE)
    return {
        "label": html.unescape(re.sub("<[^>]+>", "", value)).strip(),
        "url": html.unescape(match.group(1)) if match else None,
    }


def validate_rows(rows: list) -> None:
    if not isinstance(rows, list) or not rows:
        raise ValueError("empty_exoplanet_catalog")
    names = set()
    for row in rows:
        if not isinstance(row, dict) or not set(COLUMNS).issubset(row):
            raise ValueError("exoplanet_columns_changed")
        name = row["pl_name"]
        if not isinstance(name, str) or not name or name in names:
            raise ValueError("duplicate_or_invalid_planet_name")
        names.add(name)
        for value in row.values():
            if isinstance(value, float) and not math.isfinite(value):
                raise ValueError("nonfinite_catalog_value")
        if row["ra"] is not None and not 0 <= row["ra"] < 360:
            raise ValueError("invalid_catalog_ra")
        if row["dec"] is not None and not -90 <= row["dec"] <= 90:
            raise ValueError("invalid_catalog_dec")


def acquire(root: Path) -> dict:
    target = root / CATALOG
    if target.exists() or (root / RAW).exists():
        raise FileExistsError("exoplanet_snapshot_already_exists")
    query = "select " + ",".join(COLUMNS) + " from ps where default_flag=1 order by pl_name"
    url = ENDPOINT + "?" + urlencode({"query": query, "format": "json"})
    with urlopen(url, timeout=60) as response:
        raw = response.read(32_000_001)
    if len(raw) > 32_000_000:
        raise ValueError("catalog_download_limit")
    rows = json.loads(raw)
    validate_rows(rows)
    raw_path = root / RAW
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    raw_path.write_bytes(raw)
    data = {
        "schema_version": "1.0",
        "catalog_version": "nasa-ps-default-v1",
        "retrieved_utc": datetime.now(UTC).isoformat(),
        "table": "ps",
        "query": query,
        "url": url,
        "documentation": DOC,
        "raw_relative_path": RAW,
        "raw_sha256": hashlib.sha256(raw).hexdigest(),
        "raw_bytes": len(raw),
        "planet_count": len(rows),
        "host_count": len({r["hostname"] for r in rows}),
        "limitations": LIMITATIONS,
        "records": rows,
    }
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(data, stream, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        stream.write("\n")
    return data


def load_catalog(root: Path) -> dict:
    root = root.resolve()
    data = json.loads((root / CATALOG).read_bytes())
    if data["schema_version"] != "1.0" or data["catalog_version"] not in (
        "nasa-ps-default-v1",
        "nasa-science-catalog-v1",
    ):
        raise ValueError("unsupported_exoplanet_catalog")
    if data.get("records_format") == "sparse_catalog_fields_v1":
        data["records"] = [dict.fromkeys(COLUMNS) | row for row in data["records"]]
    validate_rows(data["records"])
    if len(data["records"]) != data["planet_count"]:
        raise ValueError("incomplete_exoplanet_catalog")
    original_entries = {}
    for source in data.get("sources", []):
        path = (root / source["relative_path"]).resolve()
        if not path.is_relative_to(root / "data/reference/catalog"):
            raise ValueError("unsafe_catalog_path")
        raw = path.read_bytes()
        if len(raw) != source["bytes"] or hashlib.sha256(raw).hexdigest() != source["sha256"]:
            raise ValueError("catalog_source_integrity_mismatch")
        if path.name.startswith("exoplanet_"):
            original_entries.update({entry["id"]: entry for entry in json.loads(raw)})
    if data["catalog_version"] == "nasa-science-catalog-v1":
        for row in data["records"]:
            original = original_entries[row["nasa"]["id"]]
            row["nasa"]["description"] = html.unescape(
                re.sub("<[^>]+>", "", original["acf"].get("derived_description") or "")
            )
            row["nasa"]["original_fields"] = original["acf"]
    return data


def index(data: dict) -> dict:
    return {
        key: value
        for key, value in data.items()
        if key not in ("records", "raw_relative_path", "sources")
    } | {
        "objects": [
            {
                "object_id": object_id(row["pl_name"]),
                "name": row["pl_name"],
                "hostname": row["hostname"],
                "ra_deg": row["ra"],
                "dec_deg": row["dec"],
                "distance_pc": row["sy_dist"],
                "radius_earth": row["pl_rade"],
                "appearance_class": row.get("nasa", {}).get("appearance_class", "Unknown"),
                "discovery_year": row["disc_year"],
                "disputed": row["pl_controv_flag"] == 1,
            }
            for row in data["records"]
        ]
    }


def planet(data: dict, identifier: str) -> dict | None:
    row = next((row for row in data["records"] if object_id(row["pl_name"]) == identifier), None)
    if row is None:
        return None
    return {
        "object_id": identifier,
        "name": row["pl_name"],
        "hostname": row["hostname"],
        "parameters": row,
        "parameter_reference": reference(row["pl_refname"]),
        "discovery_reference": reference(row["disc_refname"]),
        "surface_status": "unresolved_illustration",
        "catalog_version": data["catalog_version"],
        "catalog_raw_sha256": data["raw_sha256"],
        "retrieved_utc": data["retrieved_utc"],
        "source_url": data["url"],
        "limitations": data["limitations"],
        "system_planets": [
            {
                "object_id": object_id(r["pl_name"]),
                "name": r["pl_name"],
                "semimajor_axis_au": r["pl_orbsmax"],
                "period_days": r["pl_orbper"],
                "radius_earth": r["pl_rade"],
                "eccentricity": r["pl_orbeccen"],
                "appearance_class": r.get("nasa", {}).get("appearance_class", "Unknown"),
            }
            for r in data["records"]
            if r["hostname"] == row["hostname"]
        ],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--acquire", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    value = acquire(root) if args.acquire else load_catalog(root)
    print(
        json.dumps(
            {
                key: value[key]
                for key in (
                    "planet_count",
                    "host_count",
                    "raw_sha256",
                    "raw_bytes",
                    "retrieved_utc",
                )
            }
        )
    )
