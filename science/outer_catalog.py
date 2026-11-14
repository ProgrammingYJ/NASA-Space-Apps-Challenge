"""Build an immutable JPL SBDB TNO catalogue snapshot; never a runtime dependency.

Run `.venv/Scripts/python.exe -m science.outer_catalog --fetch` once to acquire
the official bounded query, then omit --fetch to reproduce the derived manifest.
The original response is preserved byte-for-byte, including nullable fields.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

FIELDS = [
    "spkid", "pdes", "full_name", "name", "class", "epoch", "equinox",
    "a", "e", "q", "ad", "i", "om", "w", "ma", "n", "per",
    "orbit_id", "condition_code", "data_arc", "first_obs", "last_obs",
    "n_obs_used", "rms", "sigma_a", "sigma_e", "sigma_i", "sigma_om",
    "sigma_w", "sigma_ma", "source", "two_body", "pe_used", "sb_used",
    "H", "diameter", "diameter_sigma", "GM", "density", "rot_per", "albedo",
]
PARAMETERS = {"sb-class": "TNO", "fields": ",".join(FIELDS), "full-prec": "true", "sort": "spkid"}
BASE = "https://ssd-api.jpl.nasa.gov/sbdb_query.api"
RAW_PATH = "data/reference/outer-tno/sbdb_tno.json"
META_PATH = "data/reference/outer-tno/sbdb_tno.request.json"
MANIFEST_PATH = "data/manifests/outer_tno.json"
VERSION = "jpl-sbdb-tno-two-body-v1"
AU_M, DAY_S = 149597870700, 86400
MU_SUN = 1.32712440041279419e20 * DAY_S**2 / AU_M**3
REFERENCE_JD = 2461358.500800726
KNOWN = {"sedna": "sedna", "eris": "eris", "haumea": "haumea", "makemake": "makemake", "quaoar": "quaoar", "orcus": "orcus", "gonggong": "gonggong", "pluto": "pluto"}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def number(value: object) -> float | None:
    if value is None or value == "":
        return None
    try:
        result = float(value)
    except (ValueError, TypeError):
        return None
    return result if math.isfinite(result) else None


def state(orbit: dict, jd: float) -> list[float]:
    """Solar point-mass Kepler state from heliocentric osculating elements."""
    a, e = orbit["a_au"], orbit["e"]
    motion = math.sqrt(MU_SUN / a**3)
    mean = (math.radians(orbit["M_deg"]) + motion * (jd - orbit["epoch_jd_tdb"]) + math.pi) % (2 * math.pi) - math.pi
    low, high, anomaly = -math.pi, math.pi, mean
    for _ in range(80):
        residual = anomaly - e * math.sin(anomaly) - mean
        if abs(residual) < 2e-15:
            break
        if residual > 0:
            high = anomaly
        else:
            low = anomaly
        candidate = anomaly - residual / (1 - e * math.cos(anomaly))
        anomaly = candidate if low < candidate < high else (low + high) / 2
    if abs(anomaly - e * math.sin(anomaly) - mean) > 1e-12:
        raise ValueError("outer_kepler_convergence")
    x, y = a * (math.cos(anomaly) - e), a * math.sqrt(1 - e**2) * math.sin(anomaly)
    w, node, inc = (math.radians(orbit[key]) for key in ["omega_deg", "Omega_deg", "i_deg"])
    return [
        (math.cos(w) * math.cos(node) - math.sin(w) * math.sin(node) * math.cos(inc)) * x + (-math.sin(w) * math.cos(node) - math.cos(w) * math.sin(node) * math.cos(inc)) * y,
        (math.cos(w) * math.sin(node) + math.sin(w) * math.cos(node) * math.cos(inc)) * x + (-math.sin(w) * math.sin(node) + math.cos(w) * math.cos(node) * math.cos(inc)) * y,
        math.sin(w) * math.sin(inc) * x + math.cos(w) * math.sin(inc) * y,
    ]


def normalize(source: dict) -> dict:
    source = {**source, "spkid": str(source["spkid"]), "pdes": str(source["pdes"])}
    values = {key: number(source[key]) for key in ["a", "e", "q", "ad", "i", "om", "w", "ma", "epoch"]}
    valid = all(values[key] is not None for key in ["a", "e", "i", "om", "w", "ma", "epoch"])
    valid = valid and values["a"] > 0 and 0 <= values["e"] < 1 and 0 <= values["i"] <= 180 and source["equinox"] == "J2000"
    orbit = None
    if valid:
        orbit = {"a_au": values["a"], "e": values["e"], "i_deg": values["i"], "Omega_deg": values["om"], "omega_deg": values["w"], "M_deg": values["ma"], "epoch_jd_tdb": values["epoch"]}
    name = (source["name"] or "").strip()
    diameter = number(source["diameter"])
    position = state(orbit, REFERENCE_JD) if orbit else None
    return {
        "object_id": "sbdb-" + source["spkid"], "spkid": source["spkid"], "pdes": source["pdes"], "name": source["full_name"].strip(), "iau_name": name or None,
        "known_object_id": KNOWN.get(name.lower()), "kind": "catalogued_trans_neptunian_object", "catalog_class": source["class"],
        "orbit": orbit, "orbit_status": "osculating_two_body_approximation" if valid else "unsupported_or_missing_elements",
        "semimajor_axis_au": values["a"], "perihelion_au": values["q"], "aphelion_au": values["ad"],
        "reference_jd_tdb": REFERENCE_JD, "reference_position_au": position, "reference_radius_au": math.hypot(*position) if position else None,
        "reference_within_1000_au": math.hypot(*position) <= 1000 if position else None,
        "physical": {"diameter_km": diameter, "radius_km": diameter / 2 if diameter is not None and diameter > 0 else None,
                     "diameter_sigma_km": number(source["diameter_sigma"]), "gm_km3_s2": number(source["GM"]), "mass_kg": None,
                     "density_g_cm3": number(source["density"]), "rotation_period_h": number(source["rot_per"]), "albedo": number(source["albedo"]),
                     "resolved_surface_available": False, "surface_assumption": "unresolved_marker_not_invented_terrain", "resolved_satellites": None},
        "quality": {"condition_code": source["condition_code"], "data_arc_days": number(source["data_arc"]), "first_observation": source["first_obs"], "last_observation": source["last_obs"],
                    "observations_used": number(source["n_obs_used"]), "rms": number(source["rms"]), "orbit_solution_id": source["orbit_id"], "orbit_source": source["source"],
                    "source_two_body_fit_flag": source["two_body"], "one_sigma_elements": {key: number(source[key]) for key in ["sigma_a", "sigma_e", "sigma_i", "sigma_om", "sigma_w", "sigma_ma"]},
                    "covariance": None, "propagated_position_uncertainty": None},
        "source_fields": source, "source_url": "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=" + source["spkid"],
    }


def build(root: Path, fetch: bool = False) -> dict:
    original, metadata = root / RAW_PATH, root / META_PATH
    if fetch:
        if original.exists() or metadata.exists():
            raise ValueError("original_snapshot_exists_use_separate_version_for_new_acquisition")
        url = BASE + "?" + urlencode(PARAMETERS)
        request = Request(url, headers={"User-Agent": "PlanetX-SPHEREx/0.13 scientific catalogue snapshot", "Accept": "application/json"})
        with urlopen(request, timeout=60) as response:
            raw = response.read(25_000_001)
            if len(raw) > 25_000_000:
                raise ValueError("sbdb_response_too_large")
            headers = {key: response.headers.get(key) for key in ["Content-Type", "Date", "ETag", "Last-Modified"]}
        data = json.loads(raw)
        if data.get("fields") != FIELDS or int(data.get("count", -1)) != len(data.get("data", [])):
            raise ValueError("sbdb_incomplete_or_changed_schema")
        original.parent.mkdir(parents=True, exist_ok=True)
        with original.open("xb") as stream:
            stream.write(raw)
        metadata.write_text(json.dumps({"url": url, "parameters": PARAMETERS, "retrieved_utc": datetime.now(UTC).isoformat(), "headers": headers, "sha256": digest(raw), "bytes": len(raw)}, indent=2) + "\n", encoding="utf-8")
    raw, meta = original.read_bytes(), json.loads(metadata.read_text(encoding="utf-8"))
    if digest(raw) != meta["sha256"] or len(raw) != meta["bytes"]:
        raise ValueError("sbdb_original_integrity")
    data = json.loads(raw)
    if data.get("fields") != FIELDS or int(data["count"]) != len(data["data"]):
        raise ValueError("sbdb_incomplete_or_changed_schema")
    objects = [normalize(dict(zip(FIELDS, row, strict=True))) for row in data["data"]]
    if len({obj["object_id"] for obj in objects}) != len(objects) or any(obj["catalog_class"] != "TNO" for obj in objects):
        raise ValueError("sbdb_identity_or_filter_mismatch")
    result = {
        "schema_version": "1.0", "algorithm_version": VERSION, "created_utc": datetime.now(UTC).isoformat(),
        "source": {"url": meta["url"], "local_relative_path": RAW_PATH, "sha256": meta["sha256"], "bytes": meta["bytes"], "retrieved_utc": meta["retrieved_utc"],
                   "request_metadata": {"local_relative_path": META_PATH, "sha256": digest(metadata.read_bytes()), "bytes": metadata.stat().st_size}, "api_signature": data["signature"]},
        "selection": {"query_parameters": PARAMETERS, "definition": "JPL SBDB orbit class TNO (a > 30.1 AU); all returned rows, no pagination or quality exclusion", "reported_count": int(data["count"]), "retained_count": len(objects), "complete_response": True,
                      "usable_orbit_count": sum(obj["orbit"] is not None for obj in objects), "reference_within_1000_au_count": sum(obj["reference_within_1000_au"] is True for obj in objects)},
        "coordinate_frame": "heliocentric_IAU76_80_ecliptic_J2000", "time_scale": "TDB", "position_unit": "au", "reference_jd_tdb": REFERENCE_JD,
        "reference_epoch_utc_label": "2026-11-14T00:00:00Z", "solar_gm_m3_s2": 1.32712440041279419e20,
        "objects": objects,
        "limitations": [
            "A dated snapshot of JPL SBDB class TNO, not all material, all small bodies, or undiscovered bodies inside 1000 AU. Class TNO is based on semimajor axis, not instantaneous distance.",
            "Displayed positions use each object's published heliocentric J2000 osculating elements in a solar point-mass two-body approximation. They are calculations, not fresh Horizons precision states or measured current positions.",
            "a, q, Q and calculated instantaneous heliocentric r are separate quantities. The 1000 AU distance filter is applied at the selected model date, not to a or to the full orbit.",
            "Orbital-element uncertainties, short arcs and old epochs are retained. Missing covariance prevents a verified propagated position-uncertainty ellipse or long-term precision claim.",
            "Unknown mass, radius, spin, surface structure and satellites remain null. Missing properties are not estimated from a visually drawn marker.",
            "The catalogue does not integrate mutual TNO gravity, planets, nongravitational forces or Galactic perturbations, and does not refit or confirm Planet Nine.",
            "Known bodies already supported by the higher-detail solar catalogue retain that catalogue's surface/orbit data; optional known_object_id enables duplicate suppression.",
        ],
        "rights": "NASA/JPL public scientific API data; attribute JPL SSD and preserve source conditions. No NASA logo or endorsement permission is implied.",
        "references": [{"url": "https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html", "role": "field_units_time_scale_equinox"}, {"url": "https://ssd-api.jpl.nasa.gov/doc/sbdb_filter.html", "role": "orbit_class_TNO_definition"}, {"url": "https://ssd.jpl.nasa.gov/astro_par.html", "role": "solar_GM_AU_day_constants"}],
    }
    validation_path = root / "data/reference/outer-tno/validation.json"
    if validation_path.exists():
        validation_raw = validation_path.read_bytes()
        validation = json.loads(validation_raw)
        if validation.get("source_snapshot_sha256") != meta["sha256"]:
            raise ValueError("outer_validation_source_changed")
        for source in validation["sources"]:
            saved = (root / source["local_relative_path"]).read_bytes()
            if digest(saved) != source["sha256"] or len(saved) != source["bytes"]:
                raise ValueError("outer_validation_integrity")
        result["validation"] = {**validation, "manifest_record": {"local_relative_path": "data/reference/outer-tno/validation.json", "sha256": digest(validation_raw), "bytes": len(validation_raw)}}
    destination = root / MANIFEST_PATH
    destination.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
    return {"manifest": MANIFEST_PATH, "manifest_sha256": digest(destination.read_bytes()), "manifest_bytes": destination.stat().st_size, "source_sha256": meta["sha256"], "selection": result["selection"]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fetch", action="store_true")
    args = parser.parse_args()
    print(json.dumps(build(Path(__file__).resolve().parents[1], args.fetch), ensure_ascii=False))
