"""IAU classification and a separately labelled Margot solar clearing model.

Acquisition is an explicit development command. Runtime reads authored facts,
checks their provenance, and never downloads an arbitrary user-supplied URL.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import io
import json
import math
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

MANIFEST = "data/manifests/planet_criteria.json"
REFERENCE_ROOT = "data/reference/planet-criteria"
ALGORITHM = "iau-margot-criteria-v1"
MODEL_ID = "margot-solar-10gyr-v1"
COEFFICIENT = 0.001239
EXPONENT = 9 / 8
MAJOR_IDS = ("mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune")
DWARF_IDS = ("pluto", "ceres", "haumea", "makemake", "eris")
SMALL_IDS = {
    "ceres": "1",
    "haumea": "136108",
    "makemake": "136472",
    "eris": "136199",
    "sedna": "90377",
    "quaoar": "50000",
    "orcus": "90482",
    "gonggong": "225088",
}
BODY_IDS = set(MAJOR_IDS) | set(DWARF_IDS) | set(SMALL_IDS)
ALLOWED_HOSTS = {
    "www.iau.org",
    "science.nasa.gov",
    "arxiv.org",
    "ssd-api.jpl.nasa.gov",
    "ssd.jpl.nasa.gov",
    "ntrs.nasa.gov",
}
DOCUMENTS = {
    "iau-2006": {
        "urls": [
            "https://www.iau.org/IAU/Iau/News/PR2006/iau-2006-general-assembly-resolution-votes.aspx"
        ],
        "label": "IAU adopted Solar-System planet definition, 24 August 2006",
        "tokens": ["hydrostatic equilibrium", "except satellites", "cleared the neighbourhood"],
        "facts": {
            "definition_scope": "Solar System, excluding satellites",
            "criteria": [
                "orbit the Sun",
                "self-gravity overcomes rigid-body forces, hydrostatic equilibrium nearly-round shape",
                "cleared orbital neighbourhood",
            ],
            "dwarf_planet": "First two criteria, not cleared, and not a satellite",
            "numeric_clearing_rule_in_resolution": False,
        },
    },
    "nasa-dwarfs": {
        "urls": ["https://science.nasa.gov/dwarf-planets/"],
        "label": "NASA Science current recognized dwarf-planet overview",
        "tokens": ["only recognized five", "Ceres", "Pluto", "Haumea", "Makemake", "Eris"],
        "facts": {
            "recognized_dwarf_planets": list(DWARF_IDS),
            "not_claimed_recognized": ["sedna", "quaoar", "orcus", "gonggong"],
        },
    },
    "margot-2015": {
        "urls": ["https://arxiv.org/html/1507.06300v4"],
        "label": "Margot (2015), AJ 150 185, doi:10.1088/0004-6256/150/6/185",
        "tokens": ["807", "circular orbit", "never completely clear"],
        "facts": {
            "metric": "Mass divided by model orbit-clearing mass",
            "dynamical_dominance_not_vacuum": True,
            "derivation": "Diffusive energy kicks for an idealized circular orbit",
            "main_sequence_lifetime_scaling": "The 2015 stellar-mass exponent 5/2 additionally assumes a host main-sequence lifetime relation; this implementation does not generalize that relation.",
        },
    },
    "margot-2024": {
        "urls": ["https://arxiv.org/html/2407.07590v1"],
        "label": "Margot, Gladman & Yang (2024), PSJ, doi:10.3847/PSJ/ad55f3, equations 3–5",
        "tokens": ["0.001239", "807", "10 billion years", "circular orbits", "eccentric orbits"],
        "facts": {
            "solar_10gyr_coefficient_earth_mass": COEFFICIENT,
            "semimajor_axis_exponent": EXPONENT,
            "time_gyr": 10,
            "hill_zone_factor": "2 sqrt(3)",
            "published_rounded_inverse_coefficient": 807,
            "adopted_pi_calculation": "mass / (0.001239 * a**(9/8)); do not mix independently rounded coefficient 807",
            "eccentricity_caveat": "Circular-orbit definitional model; no simple eccentric-orbit clearing expression",
            "omitted_effects": [
                "other planet perturbations",
                "dynamical friction",
                "gas drag",
                "disk tides",
            ],
            "is_official_iau_numeric_rule": False,
        },
    },
    "sbdb-documentation": {
        "urls": ["https://ssd-api.jpl.nasa.gov/doc/sbdb.html"],
        "label": "NASA/JPL Small-Body Database API documentation",
        "tokens": ["phys-par", "full-prec", "epoch", "sigma"],
        "facts": {
            "service": "JPL SBDB",
            "orbit": "Heliocentric osculating elements at each solution epoch, not current distance",
            "physical_GM": "Reported GM and literature reference retained; missing mass/GM not inferred from radius",
            "full_precision": True,
        },
    },
    "haumea-mass": {
        "urls": ["https://arxiv.org/html/0903.4213v1"],
        "label": "Ragozzine & Brown (2009), AJ 137 4766, Table 2, doi:10.1088/0004-6256/137/6/4766",
        "tokens": ["4.006", "0.040", "Haumea"],
        "facts": {
            "object_id": "haumea",
            "body_mass_kg": 4.006e21,
            "uncertainty_kg": 0.040e21,
            "definition": "Haumea primary mass from a resolved three-point-mass satellite-orbit fit; satellite masses are separate fit parameters.",
        },
    },
    "eris-system-mass": {
        "urls": ["https://ntrs.nasa.gov/api/citations/20210012932/downloads/21-49.pdf"],
        "label": "Holler et al. (2021), Icarus 355 114130, doi:10.1016/j.icarus.2020.114130",
        "tokens": ["1.6466", "0.0085", "system"],
        "facts": {
            "object_id": "eris",
            "system_mass_kg": 1.6466e22,
            "uncertainty_kg": 0.0085e22,
            "definition": "Combined Eris–Dysnomia system mass; not an independently separated Eris primary mass.",
        },
    },
    "gonggong-system-mass": {
        "urls": ["https://arxiv.org/html/1903.05439v1"],
        "label": "Kiss et al. (2019), Icarus, doi:10.1016/j.icarus.2019.03.013, section 3/Table 2",
        "tokens": ["1.75", "0.07", "system mass"],
        "facts": {
            "object_id": "gonggong",
            "system_mass_kg": 1.75e21,
            "uncertainty_kg": 0.07e21,
            "definition": "Combined Gonggong–Xiangliu system mass; the two-body satellite solution does not independently separate primary and satellite masses.",
        },
    },
    "quaoar-system-mass": {
        "urls": ["https://arxiv.org/html/2304.09237v1"],
        "label": "Pereira et al. (2023), A&A 673 L4, doi:10.1051/0004-6361/202346365, Table 3",
        "tokens": ["1.2", "0.05", "Quaoar"],
        "facts": {
            "object_id": "quaoar",
            "system_mass_kg": 1.20e21,
            "uncertainty_kg": 0.05e21,
            "definition": "Adopted dynamical mass from the Quaoar–Weywot binary orbit, used as a system-mass proxy, not a separated primary measurement.",
        },
    },
    "orcus-dynamical-ratio": {
        "urls": ["https://arxiv.org/html/2307.04848v1"],
        "label": "Brown & Butler (2023), PSJ, doi:10.3847/PSJ/ace52a, section 2.1/Table 2",
        "tokens": ["6.32", "0.16", "Vanth"],
        "facts": {
            "object_id": "orcus",
            "system_mass_kg": 6.32e20,
            "mass_ratio_satellite_primary": 0.16,
            "mass_ratio_minus": 0.01,
            "mass_ratio_plus": 0.02,
            "primary_mass_method": "M_Orcus = M_system/(1+M_Vanth/M_Orcus)",
            "definition": "Nominal primary mass derived from reported dynamical system mass and measured mass ratio; not a density/size estimate or a directly tabulated independent mass.",
        },
    },
}
MODEL_LIMITATIONS = [
    "The IAU 2006 resolution supplies a qualitative definition; this numeric clearing threshold is a research model, not an official IAU numeric test.",
    "The adopted published shortcut assumes a solar-mass host, a 10-billion-year clearing time and C=2 sqrt(3) Hill radii. This is not the current age of the Solar System.",
    "The expression is an idealized circular-orbit diffusive clearing model. Evaluating it at the semimajor axis of an eccentric orbit is a reference calculation, not a validated eccentric-orbit clearance requirement.",
    "Other planets, resonances, dynamical friction, gas drag, disk tides, migration and full N-body history are not solved.",
    "A clearing ability under a specified time horizon is not an observation that all neighbouring bodies are absent. Satellites, Trojan populations and orbit-crossing minor bodies can remain.",
    "The coefficient 0.001239 is adopted as published. Pi is calculated by direct division; the separately rounded published 807 coefficient is metadata only. Rounded general-form constants need not reproduce this shortcut to machine precision.",
    "Pi is dimensionless, not an existence probability, confidence percentage, measured clearing fraction or independent reclassification.",
]


def _hash(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _safe_url(url: str) -> None:
    parsed = urlsplit(url)
    if (
        parsed.scheme != "https"
        or parsed.hostname not in ALLOWED_HOSTS
        or parsed.username
        or parsed.password
    ):
        raise ValueError("invalid_planet_criteria_source_url")


def _path(root: Path, relative: str, category: str) -> Path:
    result = (root / relative).resolve()
    if not result.is_relative_to((root / REFERENCE_ROOT / category).resolve()):
        raise ValueError("planet_criteria_source_path_escape")
    return result


def _fetch(root: Path, key: str, urls: list[str]) -> tuple[bytes, dict]:
    destination = (
        root
        / REFERENCE_ROOT
        / "upstream"
        / (key + ".json" if key.startswith("sbdb-") else key + ".html")
    )
    sidecar = destination.with_suffix(destination.suffix + ".source.json")
    existing = [
        path
        for path in destination.parent.glob(key + ".*")
        if not path.name.endswith(".source.json")
    ]
    if existing:
        if len(existing) != 1:
            raise ValueError("duplicate_planet_criteria_source")
        destination = existing[0]
        sidecar = destination.with_suffix(destination.suffix + ".source.json")
        raw, source = destination.read_bytes(), json.loads(sidecar.read_bytes())
        if (
            source["url"] not in urls
            or len(raw) != source["bytes"]
            or _hash(raw) != source["sha256"]
        ):
            raise ValueError("existing_planet_criteria_source_changed")
        return raw, source
    attempts = []
    for url in urls:
        _safe_url(url)
        try:
            with urlopen(
                Request(url, headers={"User-Agent": "SpaceApps-planet-criteria/0.7"}), timeout=40
            ) as response:
                _safe_url(response.url)
                raw = response.read(4_000_001)
                resolved = response.url
            if not raw or len(raw) > 4_000_000:
                raise ValueError("planet_criteria_source_size")
            if raw.startswith(b"%PDF-"):
                destination = destination.with_suffix(".pdf")
                sidecar = destination.with_suffix(".pdf.source.json")
            source = {
                "url": url,
                "resolved_url": resolved,
                "local_relative_path": destination.relative_to(root).as_posix(),
                "bytes": len(raw),
                "sha256": _hash(raw),
                "retrieved_utc": datetime.now(UTC).isoformat(),
                "redistribution": "local_audit_only_not_runtime",
                "failed_url_attempts": attempts,
            }
            destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open("xb") as output:
                output.write(raw)
            sidecar.write_text(json.dumps(source, indent=2) + "\n", encoding="utf-8")
            return raw, source
        except (OSError, ValueError) as error:
            attempts.append(
                {"url": url, "error_type": type(error).__name__, "message": str(error)[:200]}
            )
    raise ValueError("planet_criteria_acquisition_failed:" + key + ":" + str(attempts))


def _fact(root: Path, key: str, facts: dict, upstream: dict, label: str) -> dict:
    snapshot = {
        "schema_version": "1.0",
        "kind": "authored_factual_source_extract",
        "facts": facts,
        "source_url": upstream["url"],
        "upstream_sha256": upstream["sha256"],
        "upstream_bytes": upstream["bytes"],
        "upstream_retrieved_utc": upstream["retrieved_utc"],
        "rights": "Project-authored factual values; no full paper prose, figures or images redistributed.",
    }
    if upstream.get("reused_from_manifest"):
        snapshot["upstream_acquisition_kind"] = (
            "unmodified_embedded_response_reused_not_new_download"
        )
        snapshot["reused_from_manifest"] = upstream["reused_from_manifest"]
    raw = (json.dumps(snapshot, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()
    path = root / REFERENCE_ROOT / "facts" / (key + ".json")
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_bytes() != raw:
        raise ValueError("existing_planet_criteria_fact_changed")
    path.write_bytes(raw)
    source = {
        "source_id": key,
        "url": upstream["url"],
        "label": label,
        "local_relative_path": path.relative_to(root).as_posix(),
        "bytes": len(raw),
        "sha256": _hash(raw),
        "retrieved_utc": upstream["retrieved_utc"],
        "upstream_sha256": upstream["sha256"],
        "upstream_bytes": upstream["bytes"],
        "upstream_original_local_only": upstream["local_relative_path"],
        "upstream_original_requirement": "optional_not_runtime",
    }
    if upstream.get("reused_from_manifest"):
        source["upstream_acquisition_kind"] = "unmodified_embedded_response_reused_not_new_download"
        source["reused_from_manifest"] = upstream["reused_from_manifest"]
    path.with_suffix(".source.json").write_text(
        json.dumps(source, indent=2) + "\n", encoding="utf-8"
    )
    return source


def clearing_diagnostic(semimajor_axis_au: float, mass_earth: float | None = None) -> dict:
    """Published solar shortcut, with unavailable mass retained as null."""
    if (
        not isinstance(semimajor_axis_au, (float, int))
        or isinstance(semimajor_axis_au, bool)
        or not math.isfinite(semimajor_axis_au)
        or semimajor_axis_au <= 0
    ):
        raise ValueError("invalid_criteria_semimajor_axis")
    if mass_earth is not None and (
        not isinstance(mass_earth, (float, int))
        or isinstance(mass_earth, bool)
        or not math.isfinite(mass_earth)
        or mass_earth <= 0
    ):
        raise ValueError("invalid_criteria_mass")
    try:
        minimum = COEFFICIENT * semimajor_axis_au**EXPONENT
    except OverflowError:
        raise ValueError("invalid_criteria_result") from None
    if not math.isfinite(minimum) or minimum <= 0:
        raise ValueError("invalid_criteria_result")
    pi = mass_earth / minimum if mass_earth is not None else None
    if pi is not None and not math.isfinite(pi):
        raise ValueError("invalid_criteria_result")
    return {
        "minimum_mass_earth": minimum,
        "pi": pi,
        "status": "mass_unknown" if pi is None else "computed",
        "model_classification": "unknown"
        if pi is None
        else "meets_model"
        if pi >= 1
        else "below_model",
    }


def _plain(value: str) -> str:
    return " ".join(html.unescape(re.sub("<[^>]+>", " ", value)).split())


def _source_text(raw: bytes) -> str:
    if raw.startswith(b"%PDF-"):
        from pypdf import PdfReader

        return " ".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(raw)).pages)
    return _plain(raw.decode("utf-8"))


def _major_facts(root: Path) -> tuple[dict, dict]:
    orbit_path = root / "data/manifests/solar_system_orbits.json"
    ephemeris_path = root / "data/manifests/solar_system_ephemeris.json"
    orbit_data, ephemeris_data = (
        json.loads(orbit_path.read_bytes()),
        json.loads(ephemeris_path.read_bytes()),
    )
    document = ephemeris_data["physical_parameters_source"]["raw_response_html"]
    mass_rows = {}
    for table in re.findall(r"<table.*?</table>", document, re.DOTALL):
        rows = re.findall(r"<tr.*?</tr>", table, re.DOTALL)
        if len(rows) < 3:
            continue
        header = [_plain(cell) for cell in re.findall(r"<t[dh]\b.*?</t[dh]>", rows[1], re.DOTALL)]
        unit = re.search(r"10\s*(\d+)\s*kg", header[3]) if len(header) > 3 else None
        if not unit:
            continue
        exponent = int(unit[1])
        for row in rows[2:]:
            cells = [_plain(cell) for cell in re.findall(r"<td.*?</td>", row, re.DOTALL)]
            if len(cells) > 3 and cells[0].lower() in set(MAJOR_IDS) | {"pluto"}:
                match = re.fullmatch(r"([\d.]+)\s*\[([^\]]+)\]\s*±\s*([\d.]+)", cells[3])
                if not match:
                    raise ValueError("planet_criteria_mass_table_changed")
                mass_rows[cells[0].lower()] = {
                    "mass_kg": float(match[1]) * 10**exponent,
                    "uncertainty_kg": float(match[3]) * 10**exponent,
                    "mass_column_power_of_ten": exponent,
                    "reference_key": match[2].strip(),
                    "original": cells[3],
                }
    if set(mass_rows) != set(MAJOR_IDS) | {"pluto"}:
        raise ValueError("planet_criteria_mass_table_incomplete")
    orbits = {}
    for body in orbit_data["bodies"]:
        sample = next(
            sample for sample in body["samples"] if sample["epoch_utc"] == "2026-11-14T00:00:00Z"
        )
        elements = sample["elements"]
        orbits[body["object_id"]] = {
            "semimajor_axis_au": elements["a_au"],
            "eccentricity": elements["e"],
            "perihelion_au": elements["periapsis_au"],
            "aphelion_au": elements["apoapsis_au"],
            "period_days": elements["period_days"],
            "epoch_tdb_jd": sample["epoch_jd_tdb"],
            "frame": orbit_data["coordinate_frame"],
            "center": orbit_data["center"],
            "source_time_scale": "TDB",
        }
    return {
        "mass_rows": mass_rows,
        "earth_mass_kg_reference": mass_rows["earth"]["mass_kg"],
        "orbits": orbits,
    }, {"orbit": orbit_path, "ephemeris": ephemeris_path}


def acquire(root: Path) -> dict:
    root = root.resolve()
    if (root / MANIFEST).exists():
        return get_planet_criteria(root)
    sources = {}
    with ThreadPoolExecutor(max_workers=2) as pool:
        originals = dict(
            zip(
                DOCUMENTS,
                pool.map(lambda pair: _fetch(root, pair[0], pair[1]["urls"]), DOCUMENTS.items()),
                strict=True,
            )
        )
    for key, specification in DOCUMENTS.items():
        raw, origin = originals[key]
        text = _source_text(raw)
        if any(token.lower() not in text.lower() for token in specification["tokens"]):
            raise ValueError("planet_criteria_claim_missing:" + key)
        sources[key] = _fact(root, key, specification["facts"], origin, specification["label"])
    # JPL SSD's API fair-use policy requires sequential requests.
    for identifier, number in SMALL_IDS.items():
        url = "https://ssd-api.jpl.nasa.gov/sbdb.api?" + urlencode(
            {"sstr": number, "phys-par": "true", "full-prec": "true"}
        )
        raw, origin = _fetch(root, "sbdb-" + identifier, [url])
        data = json.loads(raw)
        if (
            data.get("object", {}).get("spkid") != str(20_000_000 + int(number))
            or data["object"]["des"] != number
        ):
            raise ValueError("planet_criteria_sbdb_identity_changed:" + identifier)
        elements = {element["name"]: element for element in data["orbit"]["elements"]}
        physical = {parameter["name"]: parameter for parameter in data.get("phys_par", [])}
        facts = {
            "object_id": identifier,
            "object": data["object"],
            "orbit": data["orbit"],
            "physical_parameters": physical,
            "selected_elements": {key: elements[key] for key in ("a", "e", "q", "ad", "per")},
        }
        sources["sbdb-" + identifier] = _fact(
            root, "sbdb-" + identifier, facts, origin, "NASA/JPL SBDB " + data["object"]["fullname"]
        )
    major, paths = _major_facts(root)
    container = json.loads(paths["ephemeris"].read_bytes())["physical_parameters_source"]
    physical_raw = container["raw_response_html"].encode("utf-8")
    if (
        len(physical_raw) != container["response_bytes"]
        or _hash(physical_raw) != container["response_sha256"]
    ):
        raise ValueError("planet_criteria_embedded_physical_response_integrity")
    physical_path = root / REFERENCE_ROOT / "upstream/jpl-physical-table.html"
    if physical_path.exists():
        if physical_path.read_bytes() != physical_raw:
            raise ValueError("planet_criteria_physical_copy_changed")
    else:
        with physical_path.open("xb") as output:
            output.write(physical_raw)
    upstream = {
        "url": container["url"],
        "local_relative_path": physical_path.relative_to(root).as_posix(),
        "sha256": container["response_sha256"],
        "bytes": container["response_bytes"],
        "retrieved_utc": container["retrieved_utc"],
        "reused_from_manifest": {
            "path": "data/manifests/solar_system_ephemeris.json",
            "sha256": _hash(paths["ephemeris"].read_bytes()),
            "embedded_field": "physical_parameters_source.raw_response_html",
        },
        "redistribution": "local_audit_copy_only_not_runtime",
    }
    physical_path.with_suffix(".html.source.json").write_text(
        json.dumps(upstream, indent=2) + "\n", encoding="utf-8"
    )
    sources["major-inputs"] = _fact(
        root,
        "major-inputs",
        major,
        upstream,
        "Existing JPL physical mass table and heliocentric osculating-element snapshot",
    )
    manifest = {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM,
        "created_utc": datetime.now(UTC).isoformat(),
        "sources": sources,
        "dependencies": {
            name: {
                "path": path.relative_to(root).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": _hash(path.read_bytes()),
            }
            for name, path in paths.items()
        },
        "coverage": "17_existing_solar_system_bodies_not_a_complete_census",
        "model": {
            "id": MODEL_ID,
            "coefficient_earth_mass": COEFFICIENT,
            "semimajor_exponent": EXPONENT,
            "host_mass_solar": 1,
            "clearing_time_gyr": 10,
            "hill_zone_factor": 2 * math.sqrt(3),
            "formula": "m_clear/M_earth = 0.001239 (a/au)^(9/8)",
            "published_rounded_pi_coefficient": 807,
            "pi_computation": "mass_earth / minimum_mass_earth",
            "source": sources["margot-2024"],
            "additional_source": sources["margot-2015"],
            "limitations": MODEL_LIMITATIONS,
        },
        "release_rule": "Include facts/ and sidecars; upstream documents are local-only. Existing dependency manifests are required.",
    }
    manifest["objects"] = _objects(root, manifest)
    with (root / MANIFEST).open("x", encoding="utf-8", newline="\n") as output:
        json.dump(manifest, output, indent=2, ensure_ascii=False, allow_nan=False)
        output.write("\n")
    return get_planet_criteria(root)


def _objects(root: Path, data: dict) -> dict:
    sources = data["sources"]
    facts = {
        key: json.loads(_path(root, source["local_relative_path"], "facts").read_bytes())["facts"]
        for key, source in sources.items()
    }
    major = facts["major-inputs"]
    earth_mass = major["earth_mass_kg_reference"]
    physical_manifest = json.loads(
        (root / "data/manifests/solar_system_ephemeris.json").read_bytes()
    )
    earth_body = next(body for body in physical_manifest["bodies"] if body["object_id"] == "earth")
    earth_physical = json.loads(earth_body["ephemeris_source"]["raw_response_json"])["result"]
    earth_gm_match = re.search(r"GM,\s*km\^3/s\^2\s*=\s*([\d.]+)", earth_physical)
    if earth_gm_match is None:
        raise ValueError("planet_criteria_earth_gm_missing")
    earth_gm = float(earth_gm_match[1])
    original_orbits = json.loads((root / "data/manifests/solar_system_orbits.json").read_bytes())
    major_orbit_sources = {
        body["object_id"]: {
            "url": body["source"]["url"],
            "label": "JPL Horizons heliocentric geometric osculating elements",
            "sha256": body["source"]["response_sha256"],
            "bytes": body["source"]["response_bytes"],
            "retrieved_utc": body["source"]["retrieved_utc"],
            "dependency_manifest": "data/manifests/solar_system_orbits.json",
        }
        for body in original_orbits["bodies"]
    }
    result = {}
    for identifier in (*MAJOR_IDS, "pluto", *SMALL_IDS):
        classification = (
            "planet"
            if identifier in MAJOR_IDS
            else "dwarf_planet"
            if identifier in DWARF_IDS
            else "dwarf_candidate"
        )
        classification_source = (
            sources["iau-2006"] if classification == "planet" else sources["nasa-dwarfs"]
        )
        orbit = dict(major["orbits"][identifier]) if identifier in major["orbits"] else None
        if orbit is not None:
            orbit["source"] = major_orbit_sources[identifier]
        else:
            small = facts["sbdb-" + identifier]
            elements = small["selected_elements"]
            if (
                any(elements[key]["units"] != "au" for key in ("a", "q", "ad"))
                or elements["per"]["units"] != "d"
            ):
                raise ValueError("planet_criteria_orbit_units_changed")
            orbit = {
                "semimajor_axis_au": float(elements["a"]["value"]),
                "eccentricity": float(elements["e"]["value"]),
                "perihelion_au": float(elements["q"]["value"]),
                "aphelion_au": float(elements["ad"]["value"]),
                "period_days": float(elements["per"]["value"]),
                "epoch_tdb_jd": float(small["orbit"]["epoch"]),
                "frame": "JPL SBDB ecliptic/equinox " + small["orbit"]["equinox"],
                "center": "heliocentric osculating solution",
                "source_time_scale": "TDB",
                "source": sources["sbdb-" + identifier],
                "element_uncertainties": {key: elements[key]["sigma"] for key in elements},
            }
        a, e = orbit["semimajor_axis_au"], orbit["eccentricity"]
        if (
            not (a > 0 and 0 <= e < 1)
            or not math.isclose(orbit["perihelion_au"], a * (1 - e), rel_tol=1e-10)
            or not math.isclose(orbit["aphelion_au"], a * (1 + e), rel_tol=1e-10)
        ):
            raise ValueError("planet_criteria_orbit_geometry_inconsistent")
        mass = {
            "earth_masses": None,
            "status": "unknown",
            "source": None,
            "definition": "No separately adopted primary mass; not inferred from radius, assumed density or rendered shape.",
        }
        system_mass = None
        if identifier in major["mass_rows"]:
            row = major["mass_rows"][identifier]
            mass = {
                "earth_masses": row["mass_kg"] / earth_mass,
                "mass_kg": row["mass_kg"],
                "uncertainty_kg": row["uncertainty_kg"],
                "status": "measured_or_literature",
                "source": sources["major-inputs"],
                "definition": "JPL tabulated body mass; converted to Earth masses with the same table's Earth body mass, not the Earth–Moon barycenter.",
                "conversion_earth_mass_kg": earth_mass,
                "original_column_power_of_ten": row["mass_column_power_of_ten"],
            }
        elif identifier == "ceres":
            gm = facts["sbdb-ceres"]["physical_parameters"]["GM"]
            if gm["units"] != "km^3/s^2":
                raise ValueError("planet_criteria_gm_units_changed")
            mass = {
                "earth_masses": float(gm["value"]) / earth_gm,
                "status": "measured_or_literature",
                "source": sources["sbdb-ceres"],
                "definition": "Ratio of reported Ceres GM to Earth-body GM; gravitational constant cancels. No radius/density mass estimate.",
                "gm_km3_s2": float(gm["value"]),
                "gm_sigma_km3_s2": float(gm["sigma"]),
                "earth_gm_km3_s2": earth_gm,
                "earth_reference_source": sources["major-inputs"],
                "literature_reference": gm["ref"],
            }
        elif identifier == "haumea":
            primary = facts["haumea-mass"]
            mass = {
                "earth_masses": primary["body_mass_kg"] / earth_mass,
                "mass_kg": primary["body_mass_kg"],
                "uncertainty_kg": primary["uncertainty_kg"],
                "status": "measured_or_literature",
                "source": sources["haumea-mass"],
                "definition": primary["definition"],
                "conversion_earth_mass_kg": earth_mass,
            }
        system_key = {
            "eris": "eris-system-mass",
            "quaoar": "quaoar-system-mass",
            "gonggong": "gonggong-system-mass",
            "orcus": "orcus-dynamical-ratio",
        }.get(identifier)
        if system_key:
            system = facts[system_key]
            system_mass = {
                "earth_masses": system["system_mass_kg"] / earth_mass,
                "mass_kg": system["system_mass_kg"],
                "uncertainty_earth": system.get("uncertainty_kg") / earth_mass
                if system.get("uncertainty_kg") is not None
                else None,
                "definition": "combined_primary_satellite_system",
                "source": sources[system_key],
                "adopted_as_primary_mass": False,
                "limitations": [
                    system["definition"],
                    "Not silently substituted for a separately measured primary mass. A system nominal value is not a statistical upper confidence bound on primary mass.",
                ],
            }
        criteria = [
            {
                "id": "orbits_sun",
                "status": "met",
                "basis": "literature_model",
                "reason_key": "solar_orbit_catalogued",
                "source": orbit["source"],
            },
            {
                "id": "equilibrium_shape",
                "status": "met" if classification != "dwarf_candidate" else "unknown",
                "basis": "official_definition"
                if classification != "dwarf_candidate"
                else "insufficient_data",
                "reason_key": "official_classification_nearly_round"
                if classification != "dwarf_candidate"
                else "equilibrium_shape_unverified",
                "source": classification_source,
            },
            {
                "id": "orbital_dominance",
                "status": "met"
                if classification == "planet"
                else "not_met"
                if classification == "dwarf_planet"
                else "unknown",
                "basis": "official_definition"
                if classification != "dwarf_candidate"
                else "insufficient_data",
                "reason_key": "official_classification_dominant"
                if classification == "planet"
                else "official_classification_not_dominant"
                if classification == "dwarf_planet"
                else "dominance_unverified",
                "source": classification_source,
            },
        ]
        clearing = clearing_diagnostic(a, mass["earth_masses"])
        clearing.update(
            model_id=MODEL_ID,
            eccentricity_is_used_in_shortcut=False,
            evaluation_scope="circular_reference_at_catalogue_semimajor_axis_not_eccentric_clearing_solution",
            source=sources["margot-2024"],
        )
        if system_mass is not None:
            clearing["system_mass_proxy_pi"] = (
                system_mass["earth_masses"] / clearing["minimum_mass_earth"]
            )
            clearing["system_mass_proxy_status"] = (
                "all_nominal_system_mass_assigned_to_primary_not_a_confidence_upper_bound"
            )
        limitations = [
            "Official classification and its criterion rows are separate from the numeric Margot research diagnostic; changing an assumed mass never changes the official rows.",
            "The nearly-round criterion rows for recognized planets/dwarf planets follow the published classification, not a new measurement of hydrostatic equilibrium. A displayed sphere, radius or elongated ellipsoid alone cannot settle equilibrium.",
            "Osculating elements are frozen at their own source epoch and are not synchronized to the animation clock, a long-term N-body trajectory or the object's current solar distance.",
            "Source uncertainties are retained, but no joint covariance or propagated confidence interval for the model threshold/Pi is calculated.",
        ]
        if e >= 0.5:
            limitations.insert(
                0,
                "High eccentricity: the source orbit is far from the model's circular derivation. This value is only a circular reference at the same semimajor axis, not an actual eccentric clearing threshold.",
            )
        if identifier == "haumea":
            limitations.append(
                "Haumea's recognized dwarf-planet classification is retained. Its elongated occultation shape and disputed homogeneous-hydrostatic interpretation are not an automatic failure or independent proof of IAU criterion 2."
            )
        if mass["earth_masses"] is None:
            limitations.append(
                "No primary mass is adopted: Pi and the mass-based model classification remain unknown; no mass is created from size or assumed density."
            )
        result[identifier] = {
            "object_id": identifier,
            "name": identifier.title(),
            "official_classification": classification,
            "classification_source": classification_source,
            "criteria": criteria,
            "orbit": orbit,
            "mass": mass,
            "system_mass": system_mass,
            "clearing": clearing,
            "limitations": limitations,
        }
    return result


def get_planet_criteria(root: Path, object_id: str | None = None) -> dict:
    root = root.resolve()
    if object_id is not None and object_id not in BODY_IDS:
        raise ValueError("unknown_planet_criteria_object")
    raw = (root / MANIFEST).read_bytes()
    data = json.loads(raw)
    if (
        data["schema_version"] != "1.0"
        or data["algorithm_version"] != ALGORITHM
        or set(data["objects"]) != BODY_IDS
    ):
        raise ValueError("unsupported_planet_criteria_manifest")
    if data["coverage"] != "17_existing_solar_system_bodies_not_a_complete_census":
        raise ValueError("planet_criteria_scope_changed")
    expected_sources = (
        set(DOCUMENTS) | {"sbdb-" + identifier for identifier in SMALL_IDS} | {"major-inputs"}
    )
    if set(data["sources"]) != expected_sources:
        raise ValueError("planet_criteria_source_set_changed")
    for key, source in data["sources"].items():
        _safe_url(source["url"])
        if (
            source["source_id"] != key
            or source["local_relative_path"] != f"{REFERENCE_ROOT}/facts/{key}.json"
        ):
            raise ValueError("planet_criteria_source_path_escape")
        content = _path(root, source["local_relative_path"], "facts").read_bytes()
        if len(content) != source["bytes"] or _hash(content) != source["sha256"]:
            raise ValueError("planet_criteria_source_integrity_failed")
        snapshot = json.loads(content)
        if (
            snapshot["source_url"] != source["url"]
            or snapshot["upstream_sha256"] != source["upstream_sha256"]
            or snapshot["upstream_bytes"] != source["upstream_bytes"]
            or source["upstream_original_requirement"] != "optional_not_runtime"
        ):
            raise ValueError("planet_criteria_source_provenance_changed")
        if key in DOCUMENTS and (
            snapshot["facts"] != DOCUMENTS[key]["facts"]
            or source["url"] not in DOCUMENTS[key]["urls"]
        ):
            raise ValueError("planet_criteria_source_claim_changed")
        if key == "major-inputs" and snapshot["facts"] != _major_facts(root)[0]:
            raise ValueError("planet_criteria_existing_source_extraction_changed")
        if key == "major-inputs":
            physical = json.loads(
                (root / "data/manifests/solar_system_ephemeris.json").read_bytes()
            )["physical_parameters_source"]
            if (
                source["url"] != physical["url"]
                or source["upstream_sha256"] != physical["response_sha256"]
                or source["upstream_bytes"] != physical["response_bytes"]
            ):
                raise ValueError("planet_criteria_reused_original_provenance_changed")
        if key.startswith("sbdb-") and key != "sbdb-documentation":
            identifier = key.removeprefix("sbdb-")
            expected_url = "https://ssd-api.jpl.nasa.gov/sbdb.api?" + urlencode(
                {"sstr": SMALL_IDS[identifier], "phys-par": "true", "full-prec": "true"}
            )
            if (
                source["url"] != expected_url
                or snapshot["facts"]["object_id"] != identifier
                or snapshot["facts"]["object"]["des"] != SMALL_IDS[identifier]
            ):
                raise ValueError("planet_criteria_sbdb_identity_changed")
    if set(data["dependencies"]) != {"orbit", "ephemeris"}:
        raise ValueError("planet_criteria_dependencies_changed")
    for key, filename in (
        ("orbit", "solar_system_orbits.json"),
        ("ephemeris", "solar_system_ephemeris.json"),
    ):
        dependency = data["dependencies"][key]
        if dependency["path"] != "data/manifests/" + filename:
            raise ValueError("planet_criteria_dependency_path_changed")
        content = (root / dependency["path"]).read_bytes()
        if len(content) != dependency["bytes"] or _hash(content) != dependency["sha256"]:
            raise ValueError("planet_criteria_dependency_changed")
    expected_model = {
        "id": MODEL_ID,
        "coefficient_earth_mass": COEFFICIENT,
        "semimajor_exponent": EXPONENT,
        "host_mass_solar": 1,
        "clearing_time_gyr": 10,
        "hill_zone_factor": 2 * math.sqrt(3),
        "formula": "m_clear/M_earth = 0.001239 (a/au)^(9/8)",
        "published_rounded_pi_coefficient": 807,
        "pi_computation": "mass_earth / minimum_mass_earth",
        "source": data["sources"]["margot-2024"],
        "additional_source": data["sources"]["margot-2015"],
        "limitations": MODEL_LIMITATIONS,
    }
    if data["model"] != expected_model:
        raise ValueError("planet_criteria_model_changed")
    if data["objects"] != _objects(root, data):
        raise ValueError("planet_criteria_object_or_calculation_changed")
    return data | {
        "objects": {
            key: value
            for key, value in data["objects"].items()
            if object_id is None or key == object_id
        },
        "object_filter": object_id,
        "source_manifest_sha256": _hash(raw),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    options = parser.parse_args()
    print(json.dumps(acquire(options.root)))
