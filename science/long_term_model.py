"""JPL's bounded low-accuracy Keplerian planetary-position model.

This is a calculated heliocentric simulation, not an integrated ephemeris,
observation, backward reconstruction of the universe, or planet-lifetime model.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
from datetime import UTC, datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np
from astropy.time import Time

SOURCE_URL = "https://ssd.jpl.nasa.gov/planets/approx_pos.html"
MANIFEST = "data/manifests/long_term_model.json"
RAW_ROOT = "data/reference/long-term"
ALGORITHM = "jpl-kepler-long-term-v1"
ORDER = ["a", "e", "I", "L", "varpi", "Omega"]
BODIES = {
    "Mercury": ("mercury", "mercury", "1"),
    "Venus": ("venus", "venus", "2"),
    "EM Bary": ("earth", "earth-moon-barycenter", "3"),
    "Mars": ("mars", "mars", "4"),
    "Jupiter": ("jupiter", "jupiter", "5"),
    "Saturn": ("saturn", "saturn", "6"),
    "Uranus": ("uranus", "uranus", "7"),
    "Neptune": ("neptune", "neptune", "8"),
}
MIN_DATE = {"year": -2999, "month": 1, "day": 1}
MAX_DATE = {"year": 3000, "month": 1, "day": 1}
LIMITATIONS = [
    "Calculated lower-accuracy planetary positions from JPL's published fitted elements/rates; not fresh Horizons results or precision observations.",
    "The fit is not valid outside its declared range. This implementation conservatively supports astronomical -2999-01-01 through 3000-01-01, inclusive, in the proleptic Gregorian calendar.",
    "Astronomical year 0 is 1 BCE; year -2999 is 3000 BCE. Calendar labels are interpreted in TDB, not as historical UTC or a civil-calendar reconstruction.",
    "The Earth display identifier represents the Earth-Moon barycenter, not Earth's center. It must be labelled as such.",
    "The published current table omits Pluto; moons, extra dwarf planets, stars and exoplanets have no states in this model and are not frozen at unrelated epochs.",
    "Nominal source errors in longitude, latitude and range are scale estimates, not confidence intervals, guaranteed maximum errors or a covariance model.",
    "The long fit is used throughout the full range by default. Short-fit selection is explicit; automatic switching/blending between different fits is not claimed to be continuous.",
    "These fits do not model planet formation/destruction, billions of years of evolution, galaxy history, an observer's sky view, light time, or SPHEREx exposures.",
    "The existing 2026-11-13 through 2026-11-16 exact Horizons/Hermite scene and original observations remain separately preserved.",
]


class _SourceParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.pre = []
        self._pre = None
        self.tables = []
        self._table = None
        self._row = None
        self._cell = None

    def handle_starttag(self, tag, attrs):
        if tag == "pre":
            self._pre = []
        elif tag == "table":
            self._table = []
        elif tag == "tr" and self._table is not None:
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell = []

    def handle_data(self, data):
        if self._pre is not None:
            self._pre.append(data)
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag):
        if tag == "pre" and self._pre is not None:
            self.pre.append("".join(self._pre))
            self._pre = None
        elif tag in ("td", "th") and self._cell is not None:
            self._row.append(" ".join("".join(self._cell).split()))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            self._table.append(self._row)
            self._row = None
        elif tag == "table" and self._table is not None:
            self.tables.append(self._table)
            self._table = None


def parse_source(document: str) -> dict:
    parser = _SourceParser()
    parser.feed(document)
    elements = []
    extras = {}
    for block in parser.pre:
        lines = block.splitlines()
        found = {}
        for index, line in enumerate(lines):
            match = re.match(
                r"^\s*(Mercury|Venus|EM Bary|Mars|Jupiter|Saturn|Uranus|Neptune)\s+(.+)$", line
            )
            if not match:
                continue
            try:
                values = [float(x) for x in match.group(2).split()]
            except ValueError:
                # The source also includes the prose footer "EM Bary = ...".
                continue
            if len(values) == 6:
                rates = [float(x) for x in lines[index + 1].split()]
                if len(rates) != 6:
                    raise ValueError("jpl_element_rates_invalid")
                found[match.group(1)] = (values, rates)
            elif len(values) == 4:
                extras[match.group(1)] = dict(zip(["b", "c", "s", "f"], values, strict=True))
        if len(found) == 8:
            elements.append(found)
    if len(elements) != 2 or set(extras) != {"Jupiter", "Saturn", "Uranus", "Neptune"}:
        raise ValueError("jpl_approximate_tables_changed")
    errors = {}
    for table in parser.tables:
        for row in table:
            if len(row) == 7:
                name = row[0].replace("†", "").strip()
                if name in BODIES:
                    errors[name] = [float(v) for v in row[1:]]
    if set(errors) != set(BODIES):
        raise ValueError("jpl_nominal_error_table_changed")
    tables = {}
    for index, family in enumerate(["short", "long"]):
        objects = []
        for source_name, (object_id, model_body_id, reference_target) in BODIES.items():
            values, rates = elements[index][source_name]
            offset = 0 if family == "short" else 3
            err = errors[source_name][offset : offset + 3]
            objects.append(
                {
                    "object_id": object_id,
                    "model_body_id": model_body_id,
                    "name": "Earth-Moon Barycenter" if source_name == "EM Bary" else source_name,
                    "source_table_label": source_name,
                    "reference_target": reference_target,
                    "reference_target_kind": "Horizons planetary-system barycenter for independent comparison (1 through 8)",
                    "position_kind": "approximate_simulation",
                    "elements_j2000": values,
                    "rates_per_century": rates,
                    "additional_terms": extras.get(
                        source_name, {"b": 0.0, "c": 0.0, "s": 0.0, "f": 0.0}
                    )
                    if family == "long"
                    else {"b": 0.0, "c": 0.0, "s": 0.0, "f": 0.0},
                    "nominal_errors": dict(
                        zip(
                            ["longitude_arcsec", "latitude_arcsec", "distance_thousand_km"],
                            err,
                            strict=True,
                        )
                    ),
                    "position_identity": "Earth-Moon system barycenter, not Earth center"
                    if source_name == "EM Bary"
                    else "Approximate heliocentric representative of the named planet",
                }
            )
        tables[family] = {
            "source_table": "Table 1" if family == "short" else "Tables 2a and 2b",
            "coverage": {
                "min_date": {"year": 1800, "month": 1, "day": 1},
                "max_date": {"year": 2050, "month": 1, "day": 1},
            }
            if family == "short"
            else {"min_date": MIN_DATE, "max_date": MAX_DATE},
            "bodies": objects,
        }
    return tables


def calendar_jd(year: int, month: int = 1, day: int = 1, hour: float = 0) -> float:
    """Proleptic Gregorian astronomical calendar interpreted directly in TDB."""
    if (
        any(isinstance(v, bool) or not isinstance(v, int) for v in [year, month, day])
        or not -2999 <= year <= 3000
        or isinstance(hour, bool)
        or not isinstance(hour, (int, float))
        or not math.isfinite(hour)
        or not 0 <= hour < 24
    ):
        raise ValueError("invalid_long_term_calendar")
    try:
        time = Time({"year": year, "month": month, "day": day}, format="ymdhms", scale="tdb")
    except (ValueError, TypeError) as exc:
        raise ValueError("invalid_long_term_calendar") from exc
    # ERFA accepts overflowing day numbers; reject a normalized invalid date.
    back = time.ymdhms
    if (int(back.year), int(back.month), int(back.day)) != (year, month, day):
        raise ValueError("invalid_long_term_calendar")
    return float(time.jd) + hour / 24.0


def position_au(body: dict, jd_tdb: float) -> list[float]:
    """JPL component formula, with radians used only for trigonometry/Kepler."""
    T = (jd_tdb - 2451545.0) / 36525.0
    a, e, inc, longitude, peri, node = np.asarray(body["elements_j2000"]) + T * np.asarray(
        body["rates_per_century"]
    )
    extra = body["additional_terms"]
    M = (
        longitude
        - peri
        + extra["b"] * T * T
        + extra["c"] * math.cos(math.radians(extra["f"] * T))
        + extra["s"] * math.sin(math.radians(extra["f"] * T))
    )
    M = math.radians((M + 180.0) % 360.0 - 180.0)
    E = M + e * math.sin(M)
    for _ in range(30):
        delta = (M - E + e * math.sin(E)) / (1.0 - e * math.cos(E))
        E += delta
        if abs(delta) < 1e-14:
            break
    else:
        raise ValueError("long_term_kepler_not_converged")
    xp = a * (math.cos(E) - e)
    yp = a * math.sqrt(1 - e * e) * math.sin(E)
    w, O, I = map(math.radians, [peri - node, node, inc])
    P = [
        math.cos(w) * math.cos(O) - math.sin(w) * math.sin(O) * math.cos(I),
        math.cos(w) * math.sin(O) + math.sin(w) * math.cos(O) * math.cos(I),
        math.sin(w) * math.sin(I),
    ]
    Q = [
        -math.sin(w) * math.cos(O) - math.cos(w) * math.sin(O) * math.cos(I),
        -math.sin(w) * math.sin(O) + math.cos(w) * math.cos(O) * math.cos(I),
        math.cos(w) * math.sin(I),
    ]
    return [float(P[i] * xp + Q[i] * yp) for i in range(3)]


def acquire(root: Path) -> dict:
    root = Path(root).resolve()
    path = root / RAW_ROOT / "jpl_approximate_positions.html"
    sidecar = path.with_suffix(".source.json")
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() or sidecar.exists():
        raw = path.read_bytes()
        source = json.loads(sidecar.read_bytes())
        if source["sha256"] != hashlib.sha256(raw).hexdigest() or source["url"] != SOURCE_URL:
            raise ValueError("existing_long_term_source_changed")
    else:
        with urlopen(
            Request(SOURCE_URL, headers={"User-Agent": "SpaceApps-model-provenance/0.6"}),
            timeout=45,
        ) as response:
            raw = response.read(1_000_001)
            resolved_url = response.url
        if len(raw) > 1_000_000:
            raise ValueError("long_term_source_too_large")
        source = {
            "url": SOURCE_URL,
            "resolved_url": resolved_url,
            "local_relative_path": path.relative_to(root).as_posix(),
            "bytes": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest(),
            "retrieved_utc": datetime.now(UTC).isoformat(),
            "label": "NASA/JPL SSD Approximate Positions of the Planets",
        }
        path.write_bytes(raw)
        sidecar.write_text(json.dumps(source, indent=2) + "\n", encoding="utf-8")
    manifest = {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM,
        "created_utc": datetime.now(UTC).isoformat(),
        "source": source,
        "frame": "mean ecliptic and equinox of J2000",
        "center": "Sun (heliocentric)",
        "position_unit": "au",
        "time_scale": "TDB",
        "calendar": "proleptic_gregorian_astronomical_year",
        "coverage": {"min_date": MIN_DATE, "max_date": MAX_DATE},
        "default_table": "long",
        "element_order": ORDER,
        "element_units": ["au", "dimensionless", "deg", "deg", "deg", "deg"],
        "rate_interval": "Julian century (36525 TDB days)",
        "additional_term_units": {"b": "deg/century^2", "c": "deg", "s": "deg", "f": "deg/century"},
        "formula": {
            "T": "(JD_TDB - 2451545.0) / 36525",
            "element": "base + rate*T",
            "M_deg": "L - varpi + b*T*T + c*cos_deg(f*T) + s*sin_deg(f*T)",
            "kepler": "M_rad = E_rad - e*sin(E_rad)",
            "rotation": "JPL published component equations; equivalent active Rz(Omega) Rx(I) Rz(varpi-Omega)",
        },
        "tables": parse_source(raw.decode("utf-8")),
        "unsupported": [
            "Pluto",
            "Earth center",
            "Moon and all other satellites",
            "other dwarf planets and candidates",
            "stars",
            "exoplanets",
            "galaxies",
        ],
        "source_header_note": "The source preformatted header labels e with rad; eccentricity is treated as dimensionless in Kepler's equation. Original HTML is retained.",
        "license_note": "Public JPL explanatory numerical tables, attributed to the JPL SSD page; do not imply NASA/JPL endorsement or logo permission. The page attributes the 1992 source article to E.M. Standish and J.G. Williams and explicitly removes Pluto.",
        "limitations": LIMITATIONS,
    }
    target = root / MANIFEST
    temporary = target.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, target)
    return get_long_term_model(root)


def get_long_term_model(root: Path) -> dict:
    root = Path(root).resolve()
    raw = (root / MANIFEST).read_bytes()
    value = json.loads(raw)
    if value.get("schema_version") != "1.0" or value.get("algorithm_version") != ALGORITHM:
        raise ValueError("unsupported_long_term_model")
    if (
        value["element_order"] != ORDER
        or value["position_unit"] != "au"
        or value["time_scale"] != "TDB"
        or value["calendar"] != "proleptic_gregorian_astronomical_year"
        or value["frame"] != "mean ecliptic and equinox of J2000"
        or value["coverage"] != {"min_date": MIN_DATE, "max_date": MAX_DATE}
    ):
        raise ValueError("long_term_coordinate_contract_changed")
    source = value["source"]
    path = (root / source["local_relative_path"]).resolve()
    if not path.is_relative_to(root / RAW_ROOT) or source["url"] != SOURCE_URL:
        raise ValueError("invalid_long_term_source_path")
    source_raw = path.read_bytes()
    if (
        len(source_raw) != source["bytes"]
        or hashlib.sha256(source_raw).hexdigest() != source["sha256"]
    ):
        raise ValueError("long_term_source_integrity")
    if value["tables"] != parse_source(source_raw.decode("utf-8")):
        raise ValueError("long_term_coefficients_changed")
    value["source_manifest_sha256"] = hashlib.sha256(raw).hexdigest()
    return value


def sample_long_term(
    root: Path,
    year: int = 2026,
    month: int = 11,
    day: int = 14,
    hour: float = 0,
    table: str = "long",
) -> dict:
    model = get_long_term_model(root)
    if table not in model["tables"]:
        raise ValueError("unsupported_long_term_table")
    jd = calendar_jd(year, month, day, hour)
    fit = model["tables"][table]
    bounds = fit["coverage"]
    if not calendar_jd(**bounds["min_date"]) <= jd <= calendar_jd(**bounds["max_date"]):
        raise ValueError("long_term_epoch_out_of_range")
    return {
        "algorithm_version": ALGORITHM,
        "source_manifest_sha256": model["source_manifest_sha256"],
        "calendar_date": {"year": year, "month": month, "day": day, "hour": hour},
        "jd_tdb": jd,
        "table": table,
        "position_kind": "approximate_simulation",
        "coordinate_frame": model["frame"],
        "center": model["center"],
        "time_scale": model["time_scale"],
        "calendar": model["calendar"],
        "position_unit": model["position_unit"],
        "objects": [
            {
                "object_id": v["object_id"],
                "model_body_id": v["model_body_id"],
                "name": v["name"],
                "position_au": position_au(v, jd),
                "position_kind": "approximate_simulation",
                "position_identity": v["position_identity"],
                "nominal_errors": v["nominal_errors"],
            }
            for v in fit["bodies"]
        ],
        "unsupported": model["unsupported"],
        "limitations": model["limitations"],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--acquire", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    value = acquire(root) if args.acquire else get_long_term_model(root)
    print(
        json.dumps(
            {
                "bodies": len(value["tables"]["long"]["bodies"]),
                "sha256": value["source_manifest_sha256"],
            }
        )
    )
