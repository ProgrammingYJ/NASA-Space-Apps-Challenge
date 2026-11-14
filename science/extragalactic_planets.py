"""Dated literature evidence for extragalactic planet candidates and populations.

No record is a confirmed individual planet. Coordinates identify a host/event or
background-quasar sightline, never a resolved planet or an orbit solution.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

from science.universe_catalog import EXTERNAL_GALAXIES, MILKY_WAY, parse_simbad

MANIFEST = "data/manifests/extragalactic_planets.json"
RAW_ROOT = "data/reference/extragalactic-planets"
ALGORITHM = "extragalactic-evidence-v1"
COVERAGE = "adopted_literature_cases_not_complete_census"
ALLOWED_HOSTS = {
    "arxiv.org",
    "www.nasa.gov",
    "www.esa.int",
    "chandra.harvard.edu",
    "simbad.harvard.edu",
    "simbad.cds.unistra.fr",
}

# These are manually reviewed scientific facts, not copied article text or figures.
# The source documents are retained locally for audit, but are not licensed by us
# for redistribution. The authored factual snapshots below are the runtime inputs.
REFERENCES = {
    "m51-paper": {
        "url": "https://arxiv.org/html/2009.08987v1",
        "label": "Di Stefano et al. (2020 preprint; 2021 Nature Astronomy paper)",
        "facts": {
            "candidate": "M51-ULS-1b",
            "method": "X-ray transit",
            "host": "M51-ULS-1 X-ray binary in M51",
            "radius_description": "Saturn-scale under the transit interpretation",
            "host_ra_hms": [13, 29, 43.30],
            "host_dec_dms": [47, 11, 34.7],
            "coordinate_frame_in_adopted_caption": "not explicitly specified",
            "resolved_planet_surface": False,
            "confirmed_planet": False,
        },
        "required_tokens": ["M51", "13:29:43.30", "47:11:34.7", "candidate"],
    },
    "m51-chandra": {
        "url": "https://chandra.harvard.edu/photo/2021/m51/",
        "label": "NASA/CXC Chandra release, 25 October 2021",
        "facts": {
            "status": "possible planet candidate",
            "observatory": "Chandra",
            "surface_image_adopted": False,
        },
        "required_tokens": ["candidate", "70 years"],
    },
    "m31-original": {
        "url": "https://arxiv.org/html/astro-ph/0310457v1",
        "label": "An et al. (2004), ApJ 601, 845",
        "facts": {
            "event": "PA-99-N2",
            "method": "binary microlensing",
            "mass_ratio_order": 0.01,
            "alternative": "Lens mass and location allow nonplanetary companions; binary fit is not a confirmed planet.",
        },
        "required_tokens": ["PA-99-N2", "binary lens", "brown dwarf"],
    },
    "m31-planet-model": {
        "url": "https://arxiv.org/html/0906.1050v1",
        "label": "Ingrosso et al. (2009), MNRAS 399, 219, Figure 12",
        "facts": {
            "event": "PA-99-N2",
            "model": "W1",
            "companion_to_host_mass_ratio": 0.0122,
            "assumed_lens_mass_solar": 0.5,
            "conditional_companion_mass_jupiter": 6.34,
            "einstein_time_days": 132.3,
            "projected_separation_einstein_radii": 1.84,
            "mass_is_direct_measurement": False,
        },
        "required_tokens": ["PA-99-N2", "6.34", "132.3", "1.84"],
    },
    "population-2018": {
        "url": "https://arxiv.org/abs/1802.00049",
        "label": "Dai & Guerras (2018), ApJL 853, L27",
        "facts": {
            "system": "RX J1131-1231",
            "foreground_lens_redshift": 0.295,
            "method": "quasar Fe K-alpha microlensing population inference",
            "mass_description": "Moon-to-Jupiter mass unbound lenses",
            "individually_identified_planets": 0,
        },
        "required_tokens": ["microlensing", "0.295", "Moon", "Jupiter"],
    },
    "population-2019": {
        "url": "https://arxiv.org/abs/1909.11610",
        "label": "Bhatiani, Dai & Guerras (2019), ApJ, doi:10.3847/1538-4357/ab46ac",
        "facts": {
            "systems": {"Q J0158-4325": 0.317, "SDSS J1004+4112": 0.68},
            "method": "quasar Fe K-alpha microlensing population inference",
            "modeled_mass_range_solar": [1e-8, 1e-3],
            "alternatives": ["free-floating planets", "primordial black holes"],
            "individually_identified_planets": 0,
        },
        "required_tokens": ["0.317", "0.68", "primordial black holes", "Moon"],
    },
    "status-context-2026": {
        "url": "https://arxiv.org/abs/2608.13895",
        "label": "Sun et al. (2026), arXiv:2608.13895; author-reported accepted MNRAS paper",
        "facts": {
            "topic": "possible accreted-origin planet-candidate hosts currently in the Milky Way",
            "external_galaxy_planet_confirmation": False,
            "census_limitation": "A dated research abstract is context, not an exhaustive current catalog query.",
        },
        "required_tokens": ["currently residing in the Milky Way", "unvalidated", "2026"],
    },
}

CASE_SPECIFICATIONS = [
    {
        "object_id": "candidate-m51-uls-1-b",
        "name": "M51-ULS-1 b",
        "galaxy_id": "galaxy-m51",
        "galaxy_name": "M51",
        "status": "candidate",
        "source_key": "m51-paper",
        "additional_source_keys": ["m51-chandra"],
        "coordinate_key": "simbad-m51",
        "coordinate_role": "host_xray_source",
        "publication_year": 2021,
        "method": "xray_transit",
        "host_system": "M51-ULS-1: compact object and massive stellar companion",
        "summary": "A temporary X-ray eclipse was interpreted as a Saturn-scale transiting companion candidate.",
        "limitations": [
            "The planetary interpretation is unconfirmed; a single event does not establish a complete orbit.",
            "The adopted direction belongs to the X-ray host, not an independently resolved planet.",
            "No measured planet surface, depth, current position or complete orbit is available.",
        ],
        "parameters": [],
    },
    {
        "object_id": "candidate-m31-pa-99-n2",
        "name": "PA-99-N2 planetary-lens interpretation",
        "galaxy_id": "galaxy-m31",
        "galaxy_name": "M31",
        "status": "candidate",
        "source_key": "m31-planet-model",
        "additional_source_keys": ["m31-original"],
        "coordinate_key": "simbad-m31",
        "coordinate_role": "microlensing_source_sightline",
        "publication_year": 2009,
        "method": "pixel_microlensing",
        "host_system": "Unresolved binary-lens interpretation of the PA-99-N2 event toward M31",
        "summary": "A binary-lens anomaly permits a planetary companion under an assumed M31 disk-lens mass.",
        "limitations": [
            "The 6.34 Jupiter-mass value assumes a 0.5 solar-mass disk lens; it is not a directly measured mass.",
            "The lens mass/location are degenerate; nonplanetary companions remain possible.",
            "The event-source direction does not resolve the lens companion, its depth, orbit or surface.",
        ],
        "parameters": [
            {
                "key": "mass_ratio",
                "label": "Companion/host mass ratio (model W1)",
                "value": 0.0122,
                "range": None,
                "unit": "1",
                "qualifier": "conditional_binary_lens_model",
            },
            {
                "key": "assumed_host_mass",
                "label": "Assumed disk-lens host mass",
                "value": 0.5,
                "range": None,
                "unit": "solar_mass",
                "qualifier": "assumed_model_input",
            },
            {
                "key": "conditional_companion_mass",
                "label": "Companion mass for that assumed lens",
                "value": 6.34,
                "range": None,
                "unit": "jupiter_mass",
                "qualifier": "conditional_not_direct_measurement",
            },
            {
                "key": "einstein_time",
                "label": "Einstein crossing timescale (model W1)",
                "value": 132.3,
                "range": None,
                "unit": "day",
                "qualifier": "microlensing_timescale_not_orbital_period",
            },
            {
                "key": "projected_lens_separation",
                "label": "Projected lens separation (model W1)",
                "value": 1.84,
                "range": None,
                "unit": "einstein_radius",
                "qualifier": "projected_model_parameter_not_3d_orbit",
            },
        ],
    },
]
for _identifier, _name, _redshift, _source, _year, _coordinate_key, _structure in [
    (
        "population-rxj1131-lens",
        "RX J1131-1231 foreground-lens evidence",
        0.295,
        "population-2018",
        2018,
        "simbad-rxj1131",
        "foreground galaxy",
    ),
    (
        "population-qj0158-lens",
        "Q J0158-4325 foreground-lens evidence",
        0.317,
        "population-2019",
        2019,
        "simbad-qj0158",
        "foreground galaxy",
    ),
    (
        "population-sdss-j1004-lens",
        "SDSS J1004+4112 foreground-lens evidence",
        0.68,
        "population-2019",
        2019,
        "simbad-sdss-j1004",
        "foreground galaxy cluster",
    ),
]:
    CASE_SPECIFICATIONS.append(
        {
            "object_id": _identifier,
            "name": _name,
            "galaxy_id": None,
            "galaxy_name": _structure,
            "status": "population_inference",
            "source_key": _source,
            "additional_source_keys": [],
            "coordinate_key": _coordinate_key,
            "coordinate_role": "background_quasar_sightline",
            "publication_year": _year,
            "method": "quasar_microlensing_population",
            "host_system": _structure,
            "summary": "Quasar X-ray line shifts constrain a modeled population of unbound planet-mass lenses.",
            "limitations": [
                "This is population-level evidence, not a list of individually identified planets.",
                "Planet-mass lenses can have different physical origins; the 2019 analysis includes primordial black holes as an alternative.",
                "The direction belongs to the background quasar; the quoted redshift belongs to the foreground lens.",
                "Individual masses, planet counts, surfaces, depths, orbits and current positions are not measured.",
            ],
            "parameters": [
                {
                    "key": "foreground_lens_redshift",
                    "label": "Foreground-lens redshift",
                    "value": _redshift,
                    "range": None,
                    "unit": "1",
                    "qualifier": "foreground_lens_not_background_quasar",
                }
            ]
            + (
                [
                    {
                        "key": "modeled_mass_range",
                        "label": "Modeled planet-mass lens range",
                        "value": None,
                        "range": [1e-8, 1e-3],
                        "unit": "solar_mass",
                        "qualifier": "population_model_not_individual_measurements",
                    }
                ]
                if _year == 2019
                else []
            ),
        }
    )

COORDINATE_QUERIES = {
    "simbad-m51": "M51 ULS-1",
    "simbad-m31": "PA 99-N2",
    "simbad-rxj1131": "RX J1131-1231",
    "simbad-qj0158": "Q J0158-4325",
    "simbad-sdss-j1004": "SDSS J1004+4112",
}


def _hash(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _safe_url(url: str) -> None:
    parts = urlsplit(url)
    if parts.scheme != "https" or parts.hostname not in ALLOWED_HOSTS or parts.username:
        raise ValueError("invalid_extragalactic_source_url")


def _path(root: Path, relative: str) -> Path:
    path = (root / relative).resolve()
    if not path.is_relative_to((root / RAW_ROOT / "facts").resolve()):
        raise ValueError("extragalactic_source_path_escape")
    return path


def _fetch(root: Path, key: str, url: str) -> tuple[bytes, dict]:
    _safe_url(url)
    path = root / RAW_ROOT / "upstream" / (key + ".txt")
    sidecar = path.with_suffix(".source.json")
    if path.exists() or sidecar.exists():
        info = json.loads(sidecar.read_bytes())
        raw = path.read_bytes()
        if info["url"] != url or len(raw) != info["bytes"] or _hash(raw) != info["sha256"]:
            raise ValueError("existing_extragalactic_original_changed")
        return raw, info
    with urlopen(
        Request(url, headers={"User-Agent": "SpaceApps-literature-evidence/0.6"}), timeout=45
    ) as response:
        _safe_url(response.url)
        raw, resolved = response.read(3_000_001), response.url
    if not raw or len(raw) > 3_000_000:
        raise ValueError("invalid_extragalactic_source_size")
    info = {
        "url": url,
        "resolved_url": resolved,
        "bytes": len(raw),
        "sha256": _hash(raw),
        "retrieved_utc": datetime.now(UTC).isoformat(),
        "local_relative_path": path.relative_to(root).as_posix(),
        "redistribution": "local_reference_only_not_in_public_release",
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    sidecar.write_text(json.dumps(info, indent=2) + "\n", encoding="utf-8")
    return raw, info


def acquire(root: Path) -> dict:
    """Acquire normal-TLS originals and create original authored factual snapshots."""
    root = root.resolve()
    requests = {key: spec["url"] for key, spec in REFERENCES.items()}
    requests |= {
        key: "https://simbad.harvard.edu/simbad/sim-id?"
        + urlencode({"Ident": query, "output.format": "ASCII"})
        for key, query in COORDINATE_QUERIES.items()
    }
    with ThreadPoolExecutor(max_workers=2) as pool:
        originals = dict(
            zip(requests, pool.map(lambda item: _fetch(root, *item), requests.items()), strict=True)
        )
    sources = {}
    coordinates = {}
    for key, (raw, upstream) in originals.items():
        if key in REFERENCES:
            spec = REFERENCES[key]
            # Verify against the actual retrieved document before authoring a snapshot.
            text = raw.decode("utf-8").lower()
            if any(token.lower() not in text for token in spec["required_tokens"]):
                raise ValueError("extragalactic_claim_missing_from_source:" + key)
            facts, label = spec["facts"], spec["label"]
        else:
            coordinates[key] = parse_simbad(raw)
            facts, label = (
                {"parsed_coordinate": coordinates[key], "query": COORDINATE_QUERIES[key]},
                "SIMBAD ICRS catalog direction reference",
            )
        snapshot = {
            "schema_version": "1.0",
            "kind": "authored_factual_source_extract",
            "source_url": upstream["url"],
            "upstream_sha256": upstream["sha256"],
            "upstream_bytes": upstream["bytes"],
            "upstream_retrieved_utc": upstream["retrieved_utc"],
            "facts": facts,
            "rights": "Project-authored facts and catalog values; no article prose or figures redistributed.",
        }
        content = (
            json.dumps(snapshot, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
        ).encode("utf-8")
        path = root / RAW_ROOT / "facts" / (key + ".json")
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists() and path.read_bytes() != content:
            raise ValueError("existing_extragalactic_snapshot_changed:" + key)
        path.write_bytes(content)
        source = {
            "source_id": key,
            "url": upstream["url"],
            "label": label,
            "resolved_url": upstream["resolved_url"],
            "local_relative_path": path.relative_to(root).as_posix(),
            "bytes": len(content),
            "sha256": _hash(content),
            "retrieved_utc": upstream["retrieved_utc"],
            "upstream_sha256": upstream["sha256"],
            "upstream_bytes": upstream["bytes"],
            "redistribution": "authored_factual_extract_only",
            "upstream_original_local_only": upstream["local_relative_path"],
            "upstream_original_requirement": "optional_not_runtime",
        }
        path.with_suffix(".source.json").write_text(
            json.dumps(source, indent=2) + "\n", encoding="utf-8"
        )
        sources[key] = source
    objects = []
    for spec in CASE_SPECIFICATIONS:
        source = sources[spec["source_key"]]
        coordinate = coordinates[spec["coordinate_key"]]
        if coordinate:
            coordinate = coordinate | {
                "source": sources[spec["coordinate_key"]],
                "role": spec["coordinate_role"],
            }
        objects.append(
            {
                key: value
                for key, value in spec.items()
                if not key.endswith("_key")
                and not key.endswith("_keys")
                and key != "coordinate_role"
            }
            | {
                "parent_id": spec["galaxy_id"],
                "source": source,
                "additional_sources": [sources[key] for key in spec["additional_source_keys"]],
                "coordinate": coordinate,
                "confirmed": False,
                "kind": "extragalactic_planet_candidate"
                if spec["status"] == "candidate"
                else "planet_mass_population_evidence",
                "distance_pc": None,
                "galaxy_relative_position_pc": None,
                "image": None,
                "appearance": None,
                "orbit": None,
                "resolved_surface": None,
                "individually_identified_planets": 0,
                "parameters": [
                    parameter | {"source_id": spec["source_key"], "source": source}
                    for parameter in spec["parameters"]
                ],
            }
        )
    archive_path = root / "data/manifests/exoplanets.json"
    archive_raw = archive_path.read_bytes()
    archive = json.loads(archive_raw)
    planets = archive["records"]
    aliases = {"m51-uls-1b", "m51-uls-1 b", "pa-99-n2", "pa-99-n2 b"}
    matches = [p["pl_name"] for p in planets if p["pl_name"].lower() in aliases]
    manifest = {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM,
        "created_utc": datetime.now(UTC).isoformat(),
        "coverage": COVERAGE,
        "objects": [],
        "confirmed_objects": [],
        "reviewed_unconfirmed_evidence": objects,
        "sources": sources,
        "summary_counts": {"candidates": 2, "confirmed": 0, "population_studies": 3},
        "catalog_audit": {
            "path": "data/manifests/exoplanets.json",
            "sha256": _hash(archive_raw),
            "bytes": len(archive_raw),
            "rows": len(planets),
            "candidate_alias_matches": matches,
            "limitation": "Exact-name audit of the adopted confirmed archive snapshot; no galaxy-membership column and no exhaustive universe census.",
        },
        "status_context_source": sources["status-context-2026"],
        "release_rule": "Package facts/ authored factual extracts and sidecars only; upstream/ originals are not redistributed.",
    }
    (root / MANIFEST).write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8"
    )
    return get_extragalactic_planets(root)


def get_extragalactic_planets(root: Path, *, galaxy_id: str | None = None) -> dict:
    root = root.resolve()
    if galaxy_id is not None and galaxy_id not in [MILKY_WAY, *EXTERNAL_GALAXIES]:
        raise ValueError("unknown_extragalactic_galaxy")
    raw_manifest = (root / MANIFEST).read_bytes()
    data = json.loads(raw_manifest)
    if (
        data["schema_version"] != "1.0"
        or data["algorithm_version"] != ALGORITHM
        or data["coverage"] != COVERAGE
    ):
        raise ValueError("unsupported_extragalactic_manifest")
    expected_sources = set(REFERENCES) | set(COORDINATE_QUERIES)
    if set(data["sources"]) != expected_sources:
        raise ValueError("extragalactic_source_set_changed")
    snapshots = {}
    for key, source in data["sources"].items():
        _safe_url(source["url"])
        expected_url = (
            REFERENCES[key]["url"]
            if key in REFERENCES
            else (
                "https://simbad.harvard.edu/simbad/sim-id?"
                + urlencode({"Ident": COORDINATE_QUERIES[key], "output.format": "ASCII"})
            )
        )
        if (
            source["source_id"] != key
            or source["url"] != expected_url
            or source["upstream_original_requirement"] != "optional_not_runtime"
        ):
            raise ValueError("extragalactic_source_provenance_changed")
        content = _path(root, source["local_relative_path"]).read_bytes()
        if len(content) != source["bytes"] or _hash(content) != source["sha256"]:
            raise ValueError("extragalactic_source_integrity_failed")
        snap = json.loads(content)
        if (
            snap["source_url"] != source["url"]
            or snap["upstream_sha256"] != source["upstream_sha256"]
            or snap["upstream_bytes"] != source["upstream_bytes"]
        ):
            raise ValueError("extragalactic_source_provenance_changed")
        if key in REFERENCES and (
            source["url"] != REFERENCES[key]["url"] or snap["facts"] != REFERENCES[key]["facts"]
        ):
            raise ValueError("extragalactic_source_claim_changed")
        if key in COORDINATE_QUERIES:
            coordinate = snap["facts"]["parsed_coordinate"]
            if snap["facts"]["query"] != COORDINATE_QUERIES[key]:
                raise ValueError("extragalactic_coordinate_query_changed")
            if coordinate:
                reference = (
                    f"Object {coordinate['catalog_identity']} --- {coordinate['catalog_type']} --- OID={coordinate['catalog_oid']}\n"
                    + coordinate["native_coordinate_line"]
                    + "\n"
                ).encode("utf-8")
                if parse_simbad(reference) != coordinate:
                    raise ValueError("extragalactic_coordinate_parse_changed")
        snapshots[key] = snap
    if data["objects"] or data["confirmed_objects"]:
        raise ValueError("extragalactic_unconfirmed_object_promotion")
    if len(data["reviewed_unconfirmed_evidence"]) != len(CASE_SPECIFICATIONS):
        raise ValueError("extragalactic_case_set_changed")
    for item, spec in zip(data["reviewed_unconfirmed_evidence"], CASE_SPECIFICATIONS, strict=True):
        for key, value in spec.items():
            if key.endswith(("_key", "_keys")) or key == "coordinate_role":
                continue
            actual = item[key]
            if key == "parameters":
                actual = [
                    {k: v for k, v in p.items() if k not in ("source", "source_id")} for p in actual
                ]
            if actual != value:
                raise ValueError("extragalactic_case_claim_changed")
        source = data["sources"][spec["source_key"]]
        if (
            item["source"] != source
            or item["additional_sources"]
            != [data["sources"][k] for k in spec["additional_source_keys"]]
            or any(
                p["source"] != source or p["source_id"] != spec["source_key"]
                for p in item["parameters"]
            )
        ):
            raise ValueError("extragalactic_case_source_changed")
        if item["confirmed"] is not False or item["individually_identified_planets"] != 0:
            raise ValueError("extragalactic_confirmation_promotion")
        if any(
            item[k] is not None
            for k in [
                "distance_pc",
                "galaxy_relative_position_pc",
                "image",
                "appearance",
                "orbit",
                "resolved_surface",
            ]
        ):
            raise ValueError("extragalactic_unsourced_geometry")
        kind = (
            "extragalactic_planet_candidate"
            if spec["status"] == "candidate"
            else "planet_mass_population_evidence"
        )
        if item["kind"] != kind or item["parent_id"] != spec["galaxy_id"]:
            raise ValueError("extragalactic_case_hierarchy_changed")
        coordinate = snapshots[spec["coordinate_key"]]["facts"]["parsed_coordinate"]
        expected = (
            coordinate
            | {"source": data["sources"][spec["coordinate_key"]], "role": spec["coordinate_role"]}
            if coordinate
            else None
        )
        if item["coordinate"] != expected:
            raise ValueError("extragalactic_coordinate_changed")
        if coordinate and (
            coordinate["frame"] != "ICRS"
            or coordinate["epoch"] != "J2000"
            or not all(math.isfinite(coordinate[k]) for k in ["ra_deg", "dec_deg"])
        ):
            raise ValueError("invalid_extragalactic_coordinate")
    if data["summary_counts"] != {"candidates": 2, "confirmed": 0, "population_studies": 3}:
        raise ValueError("extragalactic_count_changed")
    audit = data["catalog_audit"]
    if audit["path"] != "data/manifests/exoplanets.json":
        raise ValueError("extragalactic_catalog_dependency_changed")
    archive_raw = (root / audit["path"]).read_bytes()
    if len(archive_raw) != audit["bytes"] or _hash(archive_raw) != audit["sha256"]:
        raise ValueError("extragalactic_catalog_dependency_changed")
    records = json.loads(archive_raw)["records"]
    aliases = {"m51-uls-1b", "m51-uls-1 b", "pa-99-n2", "pa-99-n2 b"}
    matches = [record["pl_name"] for record in records if record["pl_name"].lower() in aliases]
    if audit["rows"] != len(records) or audit["candidate_alias_matches"] != matches:
        raise ValueError("extragalactic_catalog_audit_changed")
    if data["status_context_source"] != data["sources"]["status-context-2026"]:
        raise ValueError("extragalactic_status_source_changed")
    return data | {
        "reviewed_unconfirmed_evidence": [
            item
            for item in data["reviewed_unconfirmed_evidence"]
            if galaxy_id is None or item["galaxy_id"] == galaxy_id
        ],
        "source_manifest_sha256": _hash(raw_manifest),
        "galaxy_filter": galaxy_id,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    arguments = parser.parse_args()
    result = acquire(arguments.root)
    print(
        json.dumps(
            {
                "counts": result["summary_counts"],
                "sources": len(result["sources"]),
                "coordinates": {
                    item["object_id"]: bool(item["coordinate"])
                    for item in result["reviewed_unconfirmed_evidence"]
                },
            }
        )
    )
