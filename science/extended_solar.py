"""Acquire/read the complete current JPL moon catalog and bounded real vectors.

Mean elements provide names, IDs and a sampling-cadence hint only. Every rendered
state comes from its own Horizons geometric vector response; unavailable records
stay in the catalog with an explicit status. Runtime readers never use network.
"""

from __future__ import annotations

import csv
import hashlib
import html
import io
import json
import os
import re
import time
from collections import Counter
from datetime import UTC, datetime, timedelta
from itertools import pairwise
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

import numpy as np
from astropy.time import Time

from science.solar_system import EPOCHS, FRAME, HORIZONS_API
from science.timeline import hermite_state

MANIFEST = "data/manifests/extended_solar.json"
RAW_ROOT = "data/reference/solar-extension"
ELEMENTS_URL = "https://ssd.jpl.nasa.gov/sats/elem/"
RADII_URL = "https://ssd.jpl.nasa.gov/sats/phys_par/"
DISCOVERY_URL = "https://ssd.jpl.nasa.gov/sats/discovery.html"
DWARF_RADII_URL = "https://ssd.jpl.nasa.gov/planets/phys_par.html"
PARENTS = {
    "mercury": "199",
    "venus": "299",
    "earth": "399",
    "mars": "499",
    "jupiter": "599",
    "saturn": "699",
    "uranus": "799",
    "neptune": "899",
    "pluto": "999",
    "sun": "10",
}
DWARFS = [
    ("ceres", "Ceres", "1", "dwarf_planet"),
    ("haumea", "Haumea", "136108", "dwarf_planet"),
    ("makemake", "Makemake", "136472", "dwarf_planet"),
    ("eris", "Eris", "136199", "dwarf_planet"),
    ("sedna", "Sedna", "90377", "dwarf_candidate"),
    ("quaoar", "Quaoar", "50000", "dwarf_candidate"),
    ("orcus", "Orcus", "90482", "dwarf_candidate"),
    ("gonggong", "Gonggong", "225088", "dwarf_candidate"),
]
DWARF_MOON_SOURCES = {
    "haumea_moons": "https://science.nasa.gov/dwarf-planets/haumea/",
    "eris_moon": "https://science.nasa.gov/dwarf-planets/eris/",
    "makemake_moon": "https://science.nasa.gov/dwarf-planets/makemake/",
    "weywot": "https://arxiv.org/abs/1003.5911",
    "vanth": "https://arxiv.org/abs/1801.07221",
    "xiangliu": "https://arxiv.org/abs/2108.08553",
}
# These numerical target/primary IDs are verified from saved Horizons name
# responses, not inferred from the numbered small body's designation.
DWARF_MOONS = [
    ("hiiaka", "Hi'iaka", "haumea", "120136108", "920136108", "haumea_moons"),
    ("namaka", "Namaka", "haumea", "220136108", "920136108", "haumea_moons"),
    ("dysnomia", "Dysnomia", "eris", "120136199", "920136199", "eris_moon"),
    ("mk2", "MK 2", "makemake", None, None, "makemake_moon"),
    ("weywot", "Weywot", "quaoar", "120050000", "920050000", "weywot"),
    ("vanth", "Vanth", "orcus", "120090482", "920090482", "vanth"),
    ("xiangliu", "Xiangliu", "gonggong", None, None, "xiangliu"),
]
CATALOG_PARENTS = [*PARENTS, *(row[0] for row in DWARFS)]


def _plain(value):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", value)).split())


def parse_moon_catalog(document: str) -> list[dict]:
    table = re.search(r'<table id="sat_elem".*?</table>', document, re.DOTALL)
    if not table:
        raise ValueError("moon_catalog_table_missing")
    records = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", table.group(), re.DOTALL):
        cells = [_plain(cell) for cell in re.findall(r"<td[^>]*>(.*?)</td>", row, re.DOTALL)]
        if len(cells) != 20 or not cells[0].isdigit():
            continue
        parent = cells[1].lower()
        if parent not in PARENTS or not cells[3].isdigit():
            raise ValueError("unsupported_catalog_parent_or_id")
        try:
            period = abs(float(cells[13]))
        except ValueError:
            period = None
        records.append(
            {
                "object_id": "moon-" + cells[3],
                "name": cells[2],
                "kind": "moon",
                "parent_id": parent,
                "horizons_id": cells[3],
                "period_days": period,
                "period_source": {
                    "url": ELEMENTS_URL,
                    "definition": "Published mean period; cadence hint only, not an ephemeris computation",
                },
                "catalog_ephemeris_label": cells[4],
                "catalog_source_url": ELEMENTS_URL,
                "radius_km": None,
                "radius_source": None,
                "status": "catalog_only",
                "knots": [],
            }
        )
    # The current JPL table repeats Puck under two ephemeris solutions. Preserve
    # both source labels without counting one physical satellite twice.
    unique = {}
    for record in records:
        previous = unique.get(record["object_id"])
        if previous:
            if previous["name"] != record["name"] or previous["parent_id"] != record["parent_id"]:
                raise ValueError("catalog_id_conflict")
            previous.setdefault("alternate_catalog_ephemeris_labels", []).append(
                record["catalog_ephemeris_label"]
            )
        else:
            unique[record["object_id"]] = record
    records = list(unique.values())
    if not records:
        raise ValueError("invalid_moon_catalog")
    return records


def reconcile_discovery(records: list[dict], document: str) -> list[dict]:
    normalize = lambda value: re.sub(r"[^a-z0-9]", "", value.lower())
    # Explicitly retain the two published spelling differences as aliases.
    aliases = {"megaclite": "magaclite", "philophrosyne": "philophrosyn"}
    by_name = {(record["parent_id"], normalize(record["name"])): record for record in records}
    parent = None
    discovered = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", document, re.DOTALL):
        cells = [_plain(cell) for cell in re.findall(r"<td[^>]*>(.*?)</td>", row, re.DOTALL)]
        if len(cells) == 1 and "Satellites of" in cells[0]:
            parent = next(
                (candidate for candidate in PARENTS if candidate in cells[0].lower()), None
            )
        elif len(cells) == 6 and parent:
            name = cells[1] or cells[2]
            key = normalize(name)
            record = by_name.get((parent, key)) or by_name.get((parent, aliases.get(key, "")))
            if record:
                if record["name"] != name:
                    record["catalog_name"] = record["name"]
                    record["name"] = name
                record["discovery_designation"] = cells[2] or None
                record["discovery_source_url"] = DISCOVERY_URL
            else:
                record = {
                    "object_id": f"moon-{parent}-{key}",
                    "name": name,
                    "kind": "moon",
                    "parent_id": parent,
                    "horizons_id": None,
                    "query_name": name,
                    "period_days": None,
                    "radius_km": None,
                    "radius_source": None,
                    "status": "catalog_only",
                    "knots": [],
                    "catalog_source_url": DISCOVERY_URL,
                    "catalog_note": "Listed in discovery catalog but absent from mean-element ID table; query by exact source designation.",
                }
            discovered.append(record)
    declared = re.search(r"A total of (\d+) planetary satellites", document)
    if not declared or len(discovered) != int(declared.group(1)):
        raise ValueError("moon_discovery_count_mismatch")
    moon = next(record for record in records if record["horizons_id"] == "301")
    return [moon, *discovered]


def parse_radii(document: str, *, moon: bool) -> dict:
    radii = {}
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", document, re.DOTALL):
        cells = [_plain(cell) for cell in re.findall(r"<td[^>]*>(.*?)</td>", row, re.DOTALL)]
        if moon:
            if len(cells) != 6 or not cells[2].isdigit():
                continue
            numbers = cells[4].split()
            key = cells[2]
        else:
            if len(cells) < 3:
                continue
            key = cells[0].lower()
            numbers = cells[2].split()
        try:
            radius = float(numbers[0])
            uncertainty_match = re.search(r"±\s*([\d.]+)", cells[2]) if not moon else None
            uncertainty = (
                float(numbers[1])
                if moon
                else float(uncertainty_match.group(1))
                if uncertainty_match
                else None
            )
        except (ValueError, IndexError):
            continue
        radii[key] = {
            "value_km": radius,
            "uncertainty_km": uncertainty,
            "definition": "Mean radius of volume-equivalent sphere",
            "source_url": RADII_URL if moon else DWARF_RADII_URL,
            "original_cell": cells[4] if moon else cells[2],
        }
    return radii


def cadence_minutes(period_days: float | None) -> int:
    if period_days is None:
        return 60
    return 5 if period_days < 0.5 else 15 if period_days < 2 else 60


def _source(root: Path, relative: str, url: str) -> tuple[bytes, dict]:
    path = root / relative
    metadata_path = path.with_suffix(path.suffix + ".source.json")
    if path.exists():
        if not metadata_path.exists():
            raise ValueError("existing_source_missing_metadata")
        source = json.loads(metadata_path.read_text(encoding="utf-8"))
        raw = path.read_bytes()
        if source["url"] != url or hashlib.sha256(raw).hexdigest() != source["sha256"]:
            raise ValueError("immutable_source_conflict")
        return raw, source
    if not (
        url.startswith(HORIZONS_API + "?")
        or url
        in {ELEMENTS_URL, RADII_URL, DISCOVERY_URL, DWARF_RADII_URL, *DWARF_MOON_SOURCES.values()}
    ):
        raise ValueError("source_origin_not_allowed")
    with urlopen(url, timeout=30) as response:
        raw = response.read(3_000_001)
    if len(raw) > 3_000_000:
        raise ValueError("source_too_large")
    source = {
        "url": url,
        "local_relative_path": relative,
        "bytes": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "retrieved_utc": datetime.now(UTC).isoformat(),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as stream:
        stream.write(raw)
    with metadata_path.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(source, stream, indent=2)
        stream.write("\n")
    return raw, source


def _save(root, manifest):
    path = root / MANIFEST
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    # Windows readers/virus scanners can briefly deny replacement of an open
    # file. Keep the last complete manifest visible and retry the atomic rename.
    for attempt in range(20):
        try:
            os.replace(temporary, path)
            break
        except PermissionError:
            if attempt == 19:
                raise
            time.sleep(0.05)


def _summary(manifest):
    moons = [obj for obj in manifest["objects"] if obj["kind"] == "moon"]
    counts = Counter(obj["parent_id"] for obj in moons)
    available_counts = Counter(obj["parent_id"] for obj in moons if obj["status"] == "available")
    return {
        "catalog_moons": len(moons),
        "catalog_moons_by_parent": {
            parent: counts[parent] for parent in CATALOG_PARENTS if parent != "sun"
        },
        "available_moons_by_parent": {
            parent: available_counts[parent] for parent in CATALOG_PARENTS if parent != "sun"
        },
        "available_moons": sum(obj["status"] == "available" for obj in moons),
        "status_counts": dict(Counter(obj["status"] for obj in manifest["objects"])),
        "available_objects": sum(obj["status"] == "available" for obj in manifest["objects"]),
        "raw_vector_bytes": sum(
            obj.get("source", {}).get("bytes", 0) for obj in manifest["objects"]
        ),
    }


def create_catalog(root: Path) -> dict:
    root = Path(root)
    if (root / MANIFEST).exists():
        raise FileExistsError("extended_catalog_already_exists")
    sources = {}
    documents = {}
    for key, url in (
        ("catalog", ELEMENTS_URL),
        ("radii", RADII_URL),
        ("discovery", DISCOVERY_URL),
        ("dwarf_radii", DWARF_RADII_URL),
    ):
        raw, source = _source(root, f"{RAW_ROOT}/{key}.html", url)
        sources[key] = source
        documents[key] = raw.decode("utf-8")
    objects = reconcile_discovery(parse_moon_catalog(documents["catalog"]), documents["discovery"])
    declared = re.search(r"A total of (\d+) planetary satellites", documents["discovery"])
    if not declared or len(objects) != int(declared.group(1)) + 1:
        raise ValueError("moon_catalog_discovery_count_mismatch")
    radii = parse_radii(documents["radii"], moon=True)
    for obj in objects:
        if obj["horizons_id"] in radii:
            obj["radius_source"] = radii[obj["horizons_id"]]
            obj["radius_km"] = obj["radius_source"]["value_km"]
    dwarf_radii = parse_radii(documents["dwarf_radii"], moon=False)
    for object_id, name, command, kind in DWARFS:
        radius = dwarf_radii.get(object_id)
        objects.append(
            {
                "object_id": object_id,
                "name": name,
                "kind": kind,
                "parent_id": "sun",
                "horizons_id": command + ";",
                "radius_km": radius["value_km"] if radius else None,
                "radius_source": radius,
                "period_days": None,
                "status": "catalog_only",
                "knots": [],
                "classification_source": "https://science.nasa.gov/dwarf-planets/"
                if kind == "dwarf_planet"
                else "Candidate classification; not asserted as an officially recognized dwarf planet",
            }
        )
    manifest = {
        "schema_version": "1.0",
        "dataset_id": "jpl-extended-solar-20261113-16",
        "created_utc": datetime.now(UTC).isoformat(),
        "source_time_scale": "UTC with TDB interpolation coordinates",
        "coordinate_frame": FRAME,
        "position_unit": "au",
        "velocity_unit": "au/day",
        "start_epoch": EPOCHS[0],
        "end_epoch": EPOCHS[-1],
        "sources": sources,
        "objects": objects,
        "acquisition_complete": False,
        "limitations": [
            "Catalog membership is separate from available current ephemerides.",
            "Mean elements/periods select sampling cadence only; positions require actual Horizons vectors.",
            "Moon coordinates are parent-body-relative geometric J2000 ecliptic vectors, not heliocentric coordinates.",
            "Missing radii remain null; any renderer fallback must be declared as a display size.",
            "Bounded Hermite display interpolation is not a precision ephemeris or an observation.",
        ],
    }
    manifest["summary"] = _summary(manifest)
    _save(root, manifest)
    return manifest


def _parse_vectors(text: str, obj: dict, cadence: int) -> list[dict]:
    if (
        "Reference frame : Ecliptic of J2000.0" not in text
        or "Output type     : GEOMETRIC cartesian states" not in text
        or "Output units    : AU-D" not in text
    ):
        raise ValueError("unsupported_vector_conventions")
    parent_center_id = obj.get("parent_horizons_center_id") or PARENTS[obj["parent_id"]]
    if not re.search(
        r"Center body name:\s+"
        + re.escape(obj["parent_id"].title())
        + r"(?: \(primary body\))?"
        + r" \("
        + parent_center_id
        + r"\)",
        text,
    ):
        raise ValueError("vector_parent_mismatch")
    target = re.search(r"Target body name:\s*([^\n]+)", text)
    command = obj.get("horizons_id")
    if not target:
        raise ValueError("vector_target_missing")
    if command and command.isdigit():
        if not re.search(r"\(" + command + r"\)", target.group(1)):
            raise ValueError("vector_target_mismatch")
    elif obj["name"].lower() not in target.group(1).lower():
        raise ValueError("vector_target_mismatch")
    block = text.split("$$SOE", 1)[1].split("$$EOE", 1)[0].strip()
    rows = list(csv.reader(io.StringIO(block)))
    dates, states = [], []
    for row in rows:
        date = datetime.strptime(row[1].strip(), "A.D. %Y-%b-%d %H:%M:%S.%f").replace(tzinfo=UTC)
        values = [float(value) for value in row[2:8]]
        if len(values) != 6 or not np.isfinite(values).all():
            raise ValueError("invalid_vector")
        dates.append(date)
        states.append(values)
    start, end = (datetime.fromisoformat(epoch) for epoch in (EPOCHS[0], EPOCHS[-1]))
    expected_count = 72 * 60 // cadence + 1
    if (
        len(dates) != expected_count
        or dates[0] != start
        or dates[-1] != end
        or any((b - a) != timedelta(minutes=cadence) for a, b in pairwise(dates))
    ):
        raise ValueError("incomplete_vector_times")
    times = Time(dates, scale="utc")
    return [
        {
            "epoch": date.isoformat().replace("+00:00", "Z"),
            "tdb_jd": float(jd),
            "position_au": values[:3],
            "velocity_au_day": values[3:],
        }
        for date, jd, values in zip(dates, times.tdb.jd, states, strict=True)
    ]


def acquire_vectors(root: Path, *, retry_failed: bool = False, limit: int | None = None) -> dict:
    root = Path(root)
    manifest = (
        json.loads((root / MANIFEST).read_text(encoding="utf-8"))
        if (root / MANIFEST).exists()
        else create_catalog(root)
    )
    attempted = 0
    # Named major satellites first, then the full table. Availability counts never
    # imply a radius/measurement or that every listed moon has source coverage.
    priority = {
        "moon-301",
        "moon-401",
        "moon-402",
        "moon-501",
        "moon-502",
        "moon-503",
        "moon-504",
        "moon-601",
        "moon-602",
        "moon-603",
        "moon-604",
        "moon-605",
        "moon-606",
        "moon-608",
        "moon-701",
        "moon-702",
        "moon-703",
        "moon-704",
        "moon-705",
        "moon-801",
        "moon-901",
    }
    order = sorted(
        manifest["objects"],
        key=lambda obj: (obj["object_id"] not in priority, obj["kind"] == "moon"),
    )
    for obj in order:
        if obj["status"] == "available" or (obj["status"] != "catalog_only" and not retry_failed):
            continue
        if limit is not None and attempted >= limit:
            break
        attempted += 1
        cadence = cadence_minutes(obj["period_days"])
        command = obj["horizons_id"] or obj["query_name"]
        parameters = {
            "format": "json",
            "COMMAND": "'" + command + "'",
            "OBJ_DATA": "'NO'",
            "MAKE_EPHEM": "'YES'",
            "EPHEM_TYPE": "'VECTORS'",
            "CENTER": "'500@" + PARENTS[obj["parent_id"]] + "'",
            "START_TIME": "'2026-11-13 00:00:00'",
            "STOP_TIME": "'2026-11-16 00:00:00'",
            "STEP_SIZE": f"'{cadence} min'",
            "REF_PLANE": "'ECLIPTIC'",
            "REF_SYSTEM": "'ICRF'",
            "OUT_UNITS": "'AU-D'",
            "VEC_TABLE": "'2'",
            "VEC_CORR": "'NONE'",
            "CSV_FORMAT": "'YES'",
            "VEC_LABELS": "'YES'",
            "TIME_TYPE": "'UT'",
            "TIME_DIGITS": "'FRACSEC'",
        }
        url = HORIZONS_API + "?" + urlencode(parameters)
        try:
            raw, source = _source(root, f"{RAW_ROOT}/vectors/{obj['object_id']}.json", url)
            obj["source"] = {**source, "parameters": parameters}
            response = json.loads(raw)
            obj["source"]["signature"] = response.get("signature")
            if response.get("error") or "$$SOE" not in response.get("result", ""):
                obj.update(
                    status="ephemeris_unavailable",
                    reason=response.get("error", response.get("result", ""))[:600],
                    knots=[],
                )
            else:
                knots = _parse_vectors(response["result"], obj, cadence)
                obj["knots"] = []  # Runtime reader hydrates immutable source vectors.
                obj.update(
                    status="available",
                    knot_count=len(knots),
                    cadence_minutes=cadence,
                    position_reference="parent_body_center",
                    interpolation="bounded cubic Hermite in TDB",
                )
                obj.pop("reason", None)
        except Exception as exc:  # noqa: BLE001 - record each unavailable source without inventing replacements
            obj.update(
                status="acquisition_failed",
                reason=type(exc).__name__ + ":" + str(exc)[:160],
                knots=[],
            )
        manifest["summary"] = _summary(manifest)
        manifest["updated_utc"] = datetime.now(UTC).isoformat()
        _save(root, manifest)
        print(
            json.dumps(
                {"object_id": obj["object_id"], "status": obj["status"], **manifest["summary"]}
            ),
            flush=True,
        )
    manifest["acquisition_complete"] = not any(
        obj["status"] == "catalog_only" for obj in manifest["objects"]
    )
    _save(root, manifest)
    return manifest


def get_extended_solar(root: Path, *, parent_id: str | None = None) -> dict:
    """Read acquired, manifest-verified local data only; no network access."""
    root = Path(root).resolve()
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    if manifest["schema_version"] != "1.0" or manifest["coordinate_frame"] != FRAME:
        raise ValueError("unsupported_extended_solar_schema")
    references = [
        *manifest["sources"].values(),
        *(obj["source"] for obj in manifest["objects"] if "source" in obj),
        *(ref for obj in manifest["objects"] for ref in obj.get("identity_sources", [])),
        *(
            obj["superseded_barycenter_source"]
            for obj in manifest["objects"]
            if "superseded_barycenter_source" in obj
        ),
        *(check["source"] for check in manifest.get("midpoint_validation", {}).get("checks", [])),
        *(check["source"] for check in manifest.get("tno_center_validation", {}).get("checks", [])),
    ]
    for source in references:
        path = (root / source["local_relative_path"]).resolve()
        if not path.is_relative_to(root / RAW_ROOT) or not path.is_file():
            raise ValueError("extended_source_missing_or_outside_root")
        raw = path.read_bytes()
        if len(raw) != source["bytes"] or hashlib.sha256(raw).hexdigest() != source["sha256"]:
            raise ValueError("extended_source_integrity")
    if parent_id is not None:
        if parent_id not in CATALOG_PARENTS:
            raise ValueError("unknown_extended_parent")
        manifest["objects"] = [obj for obj in manifest["objects"] if obj["parent_id"] == parent_id]
    for obj in manifest["objects"]:
        if obj["status"] == "available":
            response = json.loads(
                (root / obj["source"]["local_relative_path"]).read_text(encoding="utf-8")
            )
            obj["knots"] = _parse_vectors(response["result"], obj, obj["cadence_minutes"])
    return manifest


def compact_manifest(root: Path) -> dict:
    """Keep numerical source arrays in their immutable files, not duplicated here."""
    root = Path(root)
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    for obj in manifest["objects"]:
        if obj.get("knots"):
            obj["knot_count"] = len(obj["knots"])
            obj["knots"] = []
    manifest["summary"] = _summary(manifest)
    manifest["catalog_scope"] = (
        "461 JPL-listed planetary satellites including Pluto and Earth's Moon, plus seven literature/NASA-confirmed moons of Haumea, Eris, Makemake, Quaoar, Orcus and Gonggong. Catalog membership does not imply available 2026 ephemerides."
    )
    _save(root, manifest)
    return manifest


def add_dwarf_moons(root: Path) -> dict:
    """Add separately sourced TNO moons with primary-center-consistent states.

    All acquisitions precede the atomic manifest update. Pre-existing current
    system-barycenter vectors remain immutable, and are retained as explicitly
    superseded sources when a primary-body solution is adopted for composition.
    """
    root = Path(root)
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    if any(obj["object_id"] == "moon-hiiaka" for obj in manifest["objects"]):
        raise ValueError("dwarf_moons_already_registered")
    documents = {}
    for key, url in DWARF_MOON_SOURCES.items():
        raw, source = _source(root, f"{RAW_ROOT}/dwarf-moons/{key}.html", url)
        documents[key] = _plain(raw.decode("utf-8"))
        manifest["sources"][key] = source
    primary_ids = {}
    for slug, name, parent, target_id, primary_id, membership in DWARF_MOONS:
        # Confirm the cited text includes the member and parent before storing a
        # catalog assertion. MK 2's spaced nickname is the official NASA usage.
        if name.lower() not in documents[membership].lower():
            raise ValueError("dwarf_moon_membership_source_mismatch:" + slug)
        parameters = {"format": "json", "COMMAND": name, "OBJ_DATA": "YES", "MAKE_EPHEM": "NO"}
        raw, identity = _source(
            root,
            f"{RAW_ROOT}/identity/dwarf-moon-{slug}.json",
            HORIZONS_API + "?" + urlencode(parameters),
        )
        identity = {**identity, "parameters": parameters}
        text = json.loads(raw).get("result", "")
        if target_id and not (
            re.search(r"Satellite (?:I |II )?body:\s*" + target_id + r"\b", text)
            and "'" + primary_id + "' for PRIMARY body (" + parent.title() + ")" in text
        ):
            raise ValueError("dwarf_moon_identity_mismatch:" + slug)
        if not target_id and "No matches found" not in text:
            raise ValueError("unresolved_dwarf_moon_requires_review:" + slug)
        obj = {
            "object_id": "moon-" + slug,
            "name": name,
            "kind": "moon",
            "parent_id": parent,
            "horizons_id": target_id,
            "parent_horizons_center_id": primary_id,
            "period_days": None,
            "radius_km": None,
            "radius_source": None,
            "catalog_source_url": DWARF_MOON_SOURCES[membership],
            "catalog_membership": "NASA/published literature; separate from JPL's planetary-satellite discovery table",
            "identity_sources": [identity],
            "status": "catalog_only" if target_id else "ephemeris_unavailable",
            "knots": [],
            "solution_notes": [
                line.strip()
                for line in text.splitlines()
                if any(
                    marker in line
                    for marker in (
                        "# obs:",
                        "Soln.date:",
                        "Position uncertainty",
                        "Predictions outside",
                        "2006-2011 interval",
                        "2: source=",
                    )
                )
            ],
        }
        if not target_id:
            obj["source"] = identity
            obj["reason"] = (
                "No validated satellite ID found by the saved Horizons name lookup; no 2026 position or orbit generated. Published membership is retained."
            )
        else:
            _acquire_tno_vectors(root, obj, f"{RAW_ROOT}/vectors/moon-{slug}.json")
            primary_ids[parent] = primary_id
        manifest["objects"].append(obj)
    for parent, primary_id in primary_ids.items():
        obj = next(obj for obj in manifest["objects"] if obj["object_id"] == parent)
        obj["superseded_barycenter_source"] = obj["source"]
        obj["superseded_horizons_id"] = obj["horizons_id"]
        obj["horizons_id"] = primary_id
        _acquire_tno_vectors(root, obj, f"{RAW_ROOT}/vectors/{parent}-primary.json")
        if obj["status"] != "available":
            raise ValueError("tno_primary_source_unavailable:" + parent)
        obj["position_definition"] = (
            "Primary-body center from the same precomputed TNO satellite solution as its moons; supersedes the retained current small-body system-barycenter vector."
        )
        obj["solution_notes"] = next(
            moon["solution_notes"]
            for moon in manifest["objects"]
            if moon.get("parent_id") == parent
            and moon.get("parent_horizons_center_id") == primary_id
        )
    manifest["summary"] = _summary(manifest)
    manifest["updated_utc"] = datetime.now(UTC).isoformat()
    manifest["acquisition_complete"] = True
    manifest["catalog_scope"] = (
        "461 JPL planetary satellites including Earth's Moon plus seven separately NASA/literature-confirmed TNO moons; all records retain ephemeris availability."
    )
    manifest["limitations"].append(
        "The five available TNO-moon predictions use fixed precomputed satellite solutions with historical observation spans and source-reported uncertainties. These are predictions, not new observations; current 2026 accuracy is not established. Their parent-body centers use the same solutions, with earlier barycenter files retained."
    )
    _save(root, manifest)
    return manifest


def _acquire_tno_vectors(root: Path, obj: dict, relative: str):
    parameters = {
        "format": "json",
        "COMMAND": obj["horizons_id"],
        "OBJ_DATA": "YES",
        "MAKE_EPHEM": "YES",
        "EPHEM_TYPE": "VECTORS",
        "CENTER": "500@" + (obj.get("parent_horizons_center_id") or PARENTS[obj["parent_id"]]),
        "START_TIME": "2026-11-13 00:00:00",
        "STOP_TIME": "2026-11-16 00:00:00",
        "STEP_SIZE": "60 min",
        "REF_PLANE": "ECLIPTIC",
        "REF_SYSTEM": "ICRF",
        "OUT_UNITS": "AU-D",
        "VEC_TABLE": "2",
        "VEC_CORR": "NONE",
        "CSV_FORMAT": "YES",
        "VEC_LABELS": "YES",
        "TIME_TYPE": "UT",
        "TIME_DIGITS": "FRACSEC",
    }
    raw, source = _source(root, relative, HORIZONS_API + "?" + urlencode(parameters))
    response = json.loads(raw)
    obj["source"] = {**source, "parameters": parameters, "signature": response.get("signature")}
    if response.get("error") or "$$SOE" not in response.get("result", ""):
        obj.update(
            status="ephemeris_unavailable",
            reason=response.get("error", response.get("result", ""))[:600],
            knots=[],
        )
        return
    knots = _parse_vectors(response["result"], obj, 60)
    obj.update(
        status="available",
        knots=[],
        knot_count=len(knots),
        cadence_minutes=60,
        position_reference="parent_body_center",
        interpolation="bounded cubic Hermite in TDB",
    )
    obj.pop("reason", None)


def sample_object(obj: dict, epoch: str) -> dict | None:
    if obj["status"] != "available":
        return None
    value = datetime.fromisoformat(epoch)
    if value.tzinfo is None:
        raise ValueError("extended_time_requires_timezone")
    value = value.astimezone(UTC)
    knots = obj["knots"]
    times = [datetime.fromisoformat(knot["epoch"]) for knot in knots]
    if not times[0] <= value <= times[-1]:
        raise ValueError("extended_epoch_outside_range")
    index = min(
        len(knots) - 2,
        max(0, int((value - times[0]).total_seconds() // (obj["cadence_minutes"] * 60))),
    )
    a, b = knots[index : index + 2]
    fraction = (
        0.0
        if value == times[index]
        else 1.0
        if value == times[index + 1]
        else float((Time(value, scale="utc").tdb.jd - a["tdb_jd"]) / (b["tdb_jd"] - a["tdb_jd"]))
    )
    position, velocity = hermite_state(
        a["position_au"],
        a["velocity_au_day"],
        b["position_au"],
        b["velocity_au_day"],
        fraction,
        b["tdb_jd"] - a["tdb_jd"],
    )
    return {
        "object_id": obj["object_id"],
        "parent_id": obj["parent_id"],
        "epoch": value.isoformat().replace("+00:00", "Z"),
        "position_au": position.tolist(),
        "velocity_au_day": velocity.tolist(),
        "position_kind": "geometric_ephemeris_sample"
        if fraction in (0, 1)
        else "interpolated_ephemeris",
        "reference": "parent_body_center",
        "coordinate_frame": FRAME,
    }


def validate_tno_composition(root: Path) -> dict:
    """Compare primary+relative states with separate Sun-centered KM-S queries.

    This checks centers, units and sampled interpolation, not physical prediction
    accuracy or an error bound over the complete interval.
    """
    root = Path(root)
    manifest = get_extended_solar(root)
    by_id = {obj["object_id"]: obj for obj in manifest["objects"]}
    parameters = {"format": "json", "COMMAND": "'*'", "OBJ_DATA": "YES", "MAKE_EPHEM": "NO"}
    _, major_list = _source(
        root,
        f"{RAW_ROOT}/identity/major-body-list-quoted.json",
        HORIZONS_API + "?" + urlencode(parameters),
    )
    manifest["sources"]["horizons_major_bodies"] = {**major_list, "parameters": parameters}
    for object_id, queries in {
        "moon-mk2": [("mk2-quoted", "'MK 2'"), ("mk2-designation-quoted", "'S/2015 (136472) 1'")],
        "moon-xiangliu": [("xiangliu-designation-quoted", "'S/2007 (225088) 1'")],
    }.items():
        obj = by_id[object_id]
        for slug, command in queries:
            parameters = {
                "format": "json",
                "COMMAND": command,
                "OBJ_DATA": "YES",
                "MAKE_EPHEM": "NO",
            }
            raw, source = _source(
                root, f"{RAW_ROOT}/identity/{slug}.json", HORIZONS_API + "?" + urlencode(parameters)
            )
            if "No matches found" not in json.loads(raw).get("result", ""):
                raise ValueError("unavailable_tno_identity_requires_review")
            if not any(ref["sha256"] == source["sha256"] for ref in obj["identity_sources"]):
                obj["identity_sources"].append({**source, "parameters": parameters})
        obj["reason"] = (
            "No validated satellite ID in saved Horizons name/designation queries and major-body listing; no 2026 position or orbit generated. NASA/published catalog membership is retained."
        )
    epoch = "2026-11-14T00:30:00Z"
    checks = []
    for slug, _, parent, target_id, _, _ in DWARF_MOONS:
        if not target_id:
            continue
        parameters = {
            "format": "json",
            "COMMAND": target_id,
            "OBJ_DATA": "YES",
            "MAKE_EPHEM": "YES",
            "EPHEM_TYPE": "VECTORS",
            "CENTER": "500@10",
            "START_TIME": "2026-11-14 00:30:00",
            "STOP_TIME": "2026-11-14 00:31:00",
            "STEP_SIZE": "1 min",
            "REF_PLANE": "ECLIPTIC",
            "REF_SYSTEM": "ICRF",
            "OUT_UNITS": "KM-S",
            "VEC_TABLE": "2",
            "VEC_CORR": "NONE",
            "CSV_FORMAT": "YES",
            "VEC_LABELS": "YES",
            "TIME_TYPE": "UT",
            "TIME_DIGITS": "FRACSEC",
        }
        raw, source = _source(
            root,
            f"{RAW_ROOT}/validation/tno-{slug}-sun.json",
            HORIZONS_API + "?" + urlencode(parameters),
        )
        text = json.loads(raw).get("result", "")
        if not (
            "Output units    : KM-S" in text
            and re.search(r"Center body name:\s+Sun \(10\)", text)
            and re.search(r"Target body name:[^\n]+\(" + target_id + r"\)", text)
        ):
            raise ValueError("tno_validation_convention_mismatch")
        row = next(csv.reader(io.StringIO(text.split("$$SOE", 1)[1].split("$$EOE", 1)[0].strip())))
        actual = np.asarray([float(value) for value in row[2:8]])
        primary = sample_object(by_id[parent], epoch)
        relative = sample_object(by_id["moon-" + slug], epoch)
        position = (np.asarray(primary["position_au"]) + relative["position_au"]) * 149597870.700
        velocity = (
            (np.asarray(primary["velocity_au_day"]) + relative["velocity_au_day"])
            * 149597870.700
            / 86400
        )
        checks.append(
            {
                "object_id": "moon-" + slug,
                "parent_id": parent,
                "epoch": epoch,
                "source": {**source, "parameters": parameters},
                "actual_heliocentric_position_km": actual[:3].tolist(),
                "actual_heliocentric_velocity_km_s": actual[3:].tolist(),
                "position_discrepancy_km": float(np.linalg.norm(position - actual[:3])),
                "velocity_discrepancy_km_s": float(np.linalg.norm(velocity - actual[3:])),
            }
        )
    manifest["tno_center_validation"] = {
        "method": "Separately queried Sun-centered KM-S states compared with the sum of primary-body and primary-relative moon vectors, independently sampled at a non-knot UTC time.",
        "limitations": "Internal source/center/unit/interpolation consistency only, not independent dynamics, an observed position measurement, 2026 prediction accuracy, or a full-interval error bound.",
        "checks": checks,
        "max_sampled_position_discrepancy_km": max(
            check["position_discrepancy_km"] for check in checks
        ),
    }
    for obj in manifest["objects"]:
        obj["knots"] = []
    manifest["summary"] = _summary(manifest)
    _save(root, manifest)
    return manifest


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", action="store_true")
    parser.add_argument("--acquire", action="store_true")
    parser.add_argument("--dwarf-moons", action="store_true")
    parser.add_argument("--validate-tno", action="store_true")
    parser.add_argument("--retry-failed", action="store_true")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    value = (
        validate_tno_composition(args.root)
        if args.validate_tno
        else add_dwarf_moons(args.root)
        if args.dwarf_moons
        else create_catalog(args.root)
        if args.catalog
        else acquire_vectors(args.root, retry_failed=args.retry_failed, limit=args.limit)
        if args.acquire
        else get_extended_solar(args.root)
    )
    print(json.dumps(value["summary"]))
