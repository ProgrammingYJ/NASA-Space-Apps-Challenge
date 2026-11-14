"""Source-backed galaxy/member hierarchy, preserving unknown depth and appearance.

This is a curated navigator plus references to existing catalogs, not an exhaustive
census or a measured three-dimensional reconstruction of other galaxies.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

from science.exoplanets import load_catalog
from science.exoplanets import object_id as planet_id

MANIFEST = "data/manifests/universe_catalog.json"
RAW_ROOT = "data/reference/universe-catalog"
ALGORITHM = "sourced-universe-hierarchy-v1"
MILKY_WAY = "galaxy-milky-way"
ALLOWED_HOSTS = {
    "science.nasa.gov",
    "www.nasa.gov",
    "chandra.harvard.edu",
    "www.chandra.harvard.edu",
    "www.eso.org",
    "simbad.harvard.edu",
}
EXTERNAL_GALAXIES = [
    "galaxy-m31",
    "galaxy-m33",
    "galaxy-m81",
    "galaxy-m87",
    "galaxy-lmc",
    "galaxy-smc",
    "galaxy-m51",
    "galaxy-m104",
    "galaxy-centaurus-a",
]


def _spec(identifier, name, kind, galaxy, query, url, claim, *, parent=None, role="object"):
    return {
        "object_id": identifier,
        "name": name,
        "kind": kind,
        "galaxy_id": galaxy,
        "parent_id": parent or galaxy,
        "simbad_query": query,
        "source_url": url,
        "membership_evidence": claim,
        "coordinate_role": role,
    }


# Identity and membership are taken from the linked primary release. SIMBAD is a
# separate coordinate reference; release-page image centers are not member positions.
SPECIFICATIONS = [
    _spec(
        "member-m31-g1",
        "Mayall II (G1)",
        "globular_cluster",
        "galaxy-m31",
        "Mayall II",
        "https://science.nasa.gov/asset/hubble/globular-cluster-mayall-ii-in-the-neighboring-andromeda-galaxy-m31/",
        "G1 is a globular cluster orbiting the Andromeda galaxy. The release-page object coordinates refer to M31 and are not adopted for G1.",
    ),
    _spec(
        "member-m33-ngc604",
        "NGC 604",
        "emission_nebula",
        "galaxy-m33",
        "NGC 604",
        "https://www.nasa.gov/image-article/ngc-604/",
        "NGC 604 is a star-forming region within Messier 33.",
    ),
    _spec(
        "member-m33-x7",
        "M33 X-7",
        "black_hole_binary",
        "galaxy-m33",
        "M33 X-7",
        "https://chandra.harvard.edu/photo/2007/m33x7/",
        "An eclipsing binary in M33 contains a stellar-mass black hole and a massive companion star. The main release graphic is an illustration and is not adopted as an observed surface.",
    ),
    _spec(
        "member-m81-nucleus",
        "M81 nuclear black hole",
        "supermassive_black_hole",
        "galaxy-m81",
        "M81",
        "https://chandra.harvard.edu/photo/2008/m81/",
        "The M81 nucleus contains a feeding supermassive black hole. The SIMBAD direction refers to the host's active nucleus, not an independently resolved black-hole centroid.",
        role="host_nucleus_reference",
    ),
    _spec(
        "member-m87-black-hole",
        "M87*",
        "supermassive_black_hole",
        "galaxy-m87",
        "M87*",
        "https://www.eso.org/public/news/eso1907/",
        "Event Horizon Telescope observations resolve emission and a shadow associated with M87's central supermassive black hole. The SIMBAD AGN direction is a nuclear reference, not the EHT image registration.",
        role="host_nucleus_reference",
    ),
    _spec(
        "member-lmc-tarantula",
        "Tarantula Nebula (30 Doradus)",
        "emission_nebula",
        "galaxy-lmc",
        "30 Dor",
        "https://science.nasa.gov/missions/hubble/hubbles-bubbles-in-the-tarantula-nebula/",
        "The Tarantula Nebula is a star-forming region in the Large Magellanic Cloud. SIMBAD's 30 Dor alias resolves the embedded R136 cluster: that cluster direction is an explicit reference, not the nebula's measured geometric centroid.",
        role="embedded_cluster_reference",
    ),
    _spec(
        "member-lmc-r136",
        "R136",
        "young_star_cluster",
        "galaxy-lmc",
        "RMC 136",
        "https://www.eso.org/public/news/eso1030/",
        "The R136 young cluster lies within the Tarantula Nebula in the Large Magellanic Cloud.",
        parent="member-lmc-tarantula",
    ),
    _spec(
        "member-lmc-r136a1",
        "R136a1",
        "massive_star",
        "galaxy-lmc",
        "RMC 136a1",
        "https://www.eso.org/public/news/eso1030/",
        "R136a1 is an individually identified massive star in the R136 cluster. The dated release's mass record is not adopted as a current mass measurement.",
        parent="member-lmc-r136",
    ),
    _spec(
        "member-lmc-sn1987a",
        "SN 1987A remnant",
        "supernova_remnant",
        "galaxy-lmc",
        "SN 1987A",
        "https://www.chandra.harvard.edu/deadstar/sn1987a.html",
        "The remnant of SN 1987A is in the Large Magellanic Cloud. A linked simulated 3D print is not adopted as a measured 3D surface.",
    ),
    _spec(
        "member-smc-ngc346",
        "NGC 346",
        "young_star_cluster",
        "galaxy-smc",
        "NGC 346",
        "https://science.nasa.gov/centers-and-facilities/goddard/hubble-captures-unique-ultraviolet-view-of-a-spectacular-star-cluster/",
        "NGC 346 is a young cluster embedded in the SMC's N66 nebula.",
    ),
    _spec(
        "member-smc-ngc602",
        "NGC 602",
        "young_star_cluster",
        "galaxy-smc",
        "NGC 602",
        "https://science.nasa.gov/3d-resources/ngc602/",
        "NGC 602 is a young star cluster in the Small Magellanic Cloud. The resource's 3D model is not used as a measured depth map.",
    ),
    _spec(
        "member-m51-nucleus",
        "NGC 5194 nuclear black hole",
        "supermassive_black_hole",
        "galaxy-m51",
        "M51",
        "https://chandra.harvard.edu/photo/2002/0158/",
        "The central regions of NGC 5194 and NGC 5195 host supermassive black holes; the adopted M51 coordinate is only the host's nuclear direction reference.",
        role="host_nucleus_reference",
    ),
    _spec(
        "member-m51-ngc5195",
        "NGC 5195",
        "companion_galaxy",
        "galaxy-m51",
        "NGC 5195",
        "https://www.chandra.harvard.edu/photo/2016/ngc5195/",
        "NGC 5195 is the interacting companion in the M51 pair, not a star or planet inside NGC 5194.",
    ),
    _spec(
        "member-m104-nucleus",
        "M104 nuclear black hole",
        "supermassive_black_hole",
        "galaxy-m104",
        "M104",
        "https://science.nasa.gov/missions/hubble/hubble-provides-new-view-of-galactic-favorite/",
        "The Sombrero Galaxy contains a central supermassive black hole; only the host nucleus direction is adopted, not a resolved black-hole surface or a selected mass solution.",
        role="host_nucleus_reference",
    ),
    _spec(
        "member-centaurus-a-nucleus",
        "Centaurus A nuclear black hole",
        "supermassive_black_hole",
        "galaxy-centaurus-a",
        "Cen A",
        "https://www.chandra.harvard.edu/photo/2023/cena/index.html",
        "Centaurus A hosts a central supermassive black hole and high-energy jets. The host's nuclear direction is a reference, not a resolved black-hole position solution.",
        role="host_nucleus_reference",
    ),
    _spec(
        "member-mw-sagittarius-a",
        "Sagittarius A*",
        "supermassive_black_hole",
        MILKY_WAY,
        "Sgr A*",
        "https://science.nasa.gov/missions/webb/webb-reveals-rapid-fire-light-show-from-milky-ways-central-black-hole/",
        "Sagittarius A* is the central supermassive black hole of the Milky Way. The release's artist concept is not used as an observation.",
    ),
    _spec(
        "member-mw-orion",
        "Orion Nebula (M42)",
        "emission_nebula",
        MILKY_WAY,
        "M42",
        "https://science.nasa.gov/asset/hubble/hubbles-sharpest-view-of-the-orion-nebula/",
        "The Orion Nebula is a nearby Milky Way star-forming region containing the Trapezium and young stars.",
    ),
    _spec(
        "member-mw-trapezium",
        "Trapezium cluster",
        "young_star_cluster",
        MILKY_WAY,
        "NAME Trapezium Cluster",
        "https://science.nasa.gov/missions/hubble/chaos-at-the-heart-of-orion/",
        "The Trapezium grouping lies in the Orion Nebula.",
        parent="member-mw-orion",
    ),
    _spec(
        "member-mw-crab",
        "Crab Nebula",
        "supernova_remnant",
        MILKY_WAY,
        "M1",
        "https://chandra.harvard.edu/press/crabfact.html",
        "The Crab Nebula is a Galactic supernova remnant energized by its central pulsar.",
    ),
    _spec(
        "member-mw-crab-pulsar",
        "Crab pulsar",
        "neutron_star",
        MILKY_WAY,
        "PSR B0531+21",
        "https://chandra.harvard.edu/press/crabfact.html",
        "The Crab pulsar is a rotating neutron star inside the Crab Nebula.",
        parent="member-mw-crab",
    ),
    _spec(
        "member-mw-sirius",
        "Sirius A",
        "star",
        MILKY_WAY,
        "Sirius A",
        "https://science.nasa.gov/missions/hubble/measuring-a-white-dwarf-star/",
        "Sirius A has the white-dwarf companion Sirius B; their separate catalog directions are not a propagated binary orbit.",
    ),
    _spec(
        "member-mw-sirius-b",
        "Sirius B",
        "white_dwarf",
        MILKY_WAY,
        "Sirius B",
        "https://science.nasa.gov/missions/hubble/measuring-a-white-dwarf-star/",
        "Sirius B is the white-dwarf companion of Sirius A.",
        parent="member-mw-sirius",
    ),
    _spec(
        "epsilon-indi-b",
        "Epsilon Indi B (Ba/Bb)",
        "brown_dwarf_binary",
        MILKY_WAY,
        "eps Indi B",
        "https://www.eso.org/sci/activities/vltsv/visirsv/sterzik.html",
        "Epsilon Indi Ba/Bb is a brown-dwarf binary. The SPHEREx workbench keeps the existing unresolved B prediction/observation ID; no component orbit is inferred.",
    ),
]


def host_id(name: str) -> str:
    return "host-" + hashlib.sha256(name.encode("utf-8")).hexdigest()[:20]


def _hash(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _safe_url(url: str) -> None:
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_HOSTS or parsed.username:
        raise ValueError("universe_source_url_invalid")


def _fetch(root: Path, key: str, url: str) -> dict:
    _safe_url(url)
    path = root / RAW_ROOT / (key + ".txt" if key.startswith("simbad-") else key + ".html")
    sidecar = path.with_suffix(path.suffix + ".source.json")
    if path.exists() or sidecar.exists():
        value = json.loads(sidecar.read_bytes())
        if value["url"] != url:
            # Keep an earlier unsuccessful/ambiguous query immutable on disk.
            return _fetch(root, key + "-" + _hash(url.encode())[:10], url)
        raw = path.read_bytes()
        if value["url"] != url or len(raw) != value["bytes"] or _hash(raw) != value["sha256"]:
            raise ValueError("existing_universe_source_changed")
        return value | {
            "label": "SIMBAD ICRS catalog reference"
            if key.startswith("simbad-")
            else "Official object membership release"
        }
    with urlopen(
        Request(url, headers={"User-Agent": "SpaceApps-source-hierarchy/0.6"}), timeout=40
    ) as response:
        _safe_url(response.url)
        raw = response.read(2_000_001)
        resolved = response.url
    if not raw or len(raw) > 2_000_000:
        raise ValueError("universe_source_size_invalid")
    path.parent.mkdir(parents=True, exist_ok=True)
    value = {
        "url": url,
        "resolved_url": resolved,
        "local_relative_path": path.relative_to(root).as_posix(),
        "bytes": len(raw),
        "sha256": _hash(raw),
        "retrieved_utc": datetime.now(UTC).isoformat(),
    }
    path.write_bytes(raw)
    sidecar.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    return value | {
        "label": "SIMBAD ICRS catalog reference"
        if key.startswith("simbad-")
        else "Official object membership release"
    }


def parse_simbad(raw: bytes) -> dict | None:
    """Adopt only the explicitly labelled ICRS J2000 coordinate line, not FK4/Gal."""
    text = raw.decode("utf-8")
    identity = re.search(r"^Object (.+?)\s+---\s+(\S+)\s+---\s+OID=(@\d+)", text, re.MULTILINE)
    position = re.search(
        r"^Coordinates\(ICRS,ep=J2000,eq=2000\):\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([+-])(\d+)\s+(\d+)\s+([\d.]+)([^\n]*)",
        text,
        re.MULTILINE,
    )
    if not identity or not position:
        return None
    h, m, s, sign, d, dm, ds, detail = position.groups()
    ra = 15 * (int(h) + int(m) / 60 + float(s) / 3600)
    dec = (int(d) + int(dm) / 60 + float(ds) / 3600) * (-1 if sign == "-" else 1)
    if not (0 <= ra < 360 and -90 <= dec <= 90):
        raise ValueError("invalid_universe_coordinate")
    return {
        "ra_deg": ra,
        "dec_deg": dec,
        "frame": "ICRS",
        "epoch": "J2000",
        "catalog_identity": identity[1].strip(),
        "catalog_type": identity[2],
        "catalog_oid": identity[3],
        "native_coordinate_line": position[0],
        "coordinate_reference_detail": detail.strip(),
        "proper_motion_applied": False,
        "covariance_available": False,
    }


def acquire(root: Path) -> dict:
    root = root.resolve()
    requests = {}
    release_keys = {}
    for index, spec in enumerate(SPECIFICATIONS):
        key = "member-release-" + str(index).zfill(2)
        # Duplicate article URLs are one immutable input, not independent evidence.
        key = next((k for k, value in requests.items() if value == spec["source_url"]), key)
        release_keys[spec["object_id"]] = key
        requests[key] = spec["source_url"]
        query = {"Ident": spec["simbad_query"], "output.format": "ASCII"}
        requests["simbad-" + spec["object_id"]] = (
            "https://simbad.harvard.edu/simbad/sim-id?" + urlencode(query)
        )
    with ThreadPoolExecutor(max_workers=4) as pool:
        sources = dict(
            zip(requests, pool.map(lambda kv: _fetch(root, *kv), requests.items()), strict=True)
        )
    objects = []
    for spec in SPECIFICATIONS:
        source = sources[release_keys[spec["object_id"]]]
        coordinate_source = sources["simbad-" + spec["object_id"]]
        coordinate = parse_simbad((root / coordinate_source["local_relative_path"]).read_bytes())
        if coordinate:
            coordinate["source"] = coordinate_source
            coordinate["role"] = spec["coordinate_role"]
        objects.append(
            {key: value for key, value in spec.items() if key not in ("simbad_query", "source_url")}
            | {
                "source": source,
                "coordinate": coordinate,
                "additional_sources": [sources[release_keys["member-lmc-r136"]]]
                if spec["object_id"] == "member-lmc-tarantula"
                else [],
                "distance_pc": None,
                "distance_status": "not_adopted",
                "galaxy_relative_position_pc": None,
                "position_kind": "catalog_direction" if coordinate else "unavailable",
                "image": None,
                "image_page_url": source["url"],
                "appearance": None,
                "existing_object_id": "epsilon-indi-b"
                if spec["object_id"] == "epsilon-indi-b"
                else None,
                "limitations": [
                    "This direction is a dated catalog reference, not a 2026 proper-motion/orbit solution or a galaxy-centered 3D position.",
                    "Marker type, size and color are symbols; no observed surface, physical radius or intrinsic outline is supplied.",
                    "Missing distance, depth, morphology and image fields remain null; image pages may contain separately identified illustrations.",
                ],
            }
        )
    dependencies = {}
    for name in ("exoplanets", "galaxies", "solar_system_ephemeris", "extended_solar"):
        path = "data/manifests/" + name + ".json"
        raw = (root / path).read_bytes()
        dependencies[name] = {"path": path, "sha256": _hash(raw), "bytes": len(raw)}
    manifest = {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM,
        "created_utc": datetime.now(UTC).isoformat(),
        "objects": objects,
        "sources": sources,
        "dependencies": dependencies,
        "galaxy_ids": [MILKY_WAY, *EXTERNAL_GALAXIES],
        "coverage": "curated_source_confirmed_examples_not_complete_census",
        "limitations": [
            "Selected confirmed members and associated systems are examples, not all objects or all object classes in every galaxy.",
            "No confirmed extragalactic planet or brown dwarf is fabricated. Membership does not supply an orbital path or depth.",
            "The M51 companion is associated with the interacting pair, not embedded inside the primary galaxy.",
            "Existing NASA exoplanet hosts are catalog-context references with unpropagated directions and unverified distance units retained separately.",
        ],
    }
    path = root / MANIFEST
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    os.replace(temporary, path)
    return get_universe_catalog(root)


def _manifest(root: Path) -> tuple[dict, str]:
    raw = (root / MANIFEST).read_bytes()
    value = json.loads(raw)
    if value["schema_version"] != "1.0" or value["algorithm_version"] != ALGORITHM:
        raise ValueError("universe_catalog_version_invalid")
    expected_urls = {spec["source_url"] for spec in SPECIFICATIONS}
    for source in value["sources"].values():
        _safe_url(source["url"])
        _safe_url(source["resolved_url"])
        path = (root / source["local_relative_path"]).resolve()
        if not path.is_relative_to(root / RAW_ROOT):
            raise ValueError("universe_catalog_source_path_invalid")
        source_raw = path.read_bytes()
        if len(source_raw) != source["bytes"] or _hash(source_raw) != source["sha256"]:
            raise ValueError("universe_catalog_source_integrity")
    if not expected_urls.issubset({source["url"] for source in value["sources"].values()}):
        raise ValueError("universe_catalog_membership_source_missing")
    if len(value["objects"]) != len(SPECIFICATIONS) or {
        v["object_id"] for v in value["objects"]
    } != {v["object_id"] for v in SPECIFICATIONS}:
        raise ValueError("universe_catalog_identity_invalid")
    specifications = {v["object_id"]: v for v in SPECIFICATIONS}
    for item in value["objects"]:
        spec = specifications[item["object_id"]]
        if (
            any(
                item[k] != spec[k]
                for k in ("kind", "galaxy_id", "parent_id", "membership_evidence")
            )
            or item["source"]["url"] != spec["source_url"]
            or item["source"] not in value["sources"].values()
        ):
            raise ValueError("universe_catalog_membership_changed")
        if any(
            item[k] is not None
            for k in ("distance_pc", "galaxy_relative_position_pc", "image", "appearance")
        ):
            raise ValueError("universe_catalog_unsourced_geometry")
        coordinate = item["coordinate"]
        if coordinate is not None:
            source = value["sources"].get("simbad-" + item["object_id"])
            if source != coordinate["source"]:
                raise ValueError("universe_catalog_coordinate_source_invalid")
            actual = parse_simbad((root / source["local_relative_path"]).read_bytes())
            if (
                not actual
                or any(coordinate[k] != actual[k] for k in actual)
                or coordinate["role"] != spec["coordinate_role"]
            ):
                raise ValueError("universe_catalog_coordinate_changed")
    if set(value["dependencies"]) != {
        "exoplanets",
        "galaxies",
        "solar_system_ephemeris",
        "extended_solar",
    }:
        raise ValueError("universe_catalog_dependency_missing")
    for name, dependency in value["dependencies"].items():
        if dependency["path"] != "data/manifests/" + name + ".json":
            raise ValueError("universe_catalog_dependency_path_invalid")
        path = (root / dependency["path"]).resolve()
        if not path.is_relative_to(root / "data/manifests"):
            raise ValueError("universe_catalog_dependency_path_invalid")
        dep_raw = path.read_bytes()
        if len(dep_raw) != dependency["bytes"] or _hash(dep_raw) != dependency["sha256"]:
            raise ValueError("universe_catalog_dependency_changed")
    return value, _hash(raw)


def _hosts(catalog: dict) -> list[dict]:
    grouped = {}
    for row in catalog["records"]:
        grouped.setdefault(row["hostname"], []).append(row)
    output = []
    for name, rows in grouped.items():
        row = rows[0]
        coordinates = {
            (v["ra"], v["dec"]) for v in rows if v["ra"] is not None and v["dec"] is not None
        }
        coordinate = None
        if len(coordinates) == 1:
            ra, dec = next(iter(coordinates))
            if all(math.isfinite(x) for x in (ra, dec)):
                coordinate = {
                    "ra_deg": ra,
                    "dec_deg": dec,
                    "frame": "catalog_equatorial_unverified_realization",
                    "epoch": None,
                    "proper_motion_applied": False,
                    "role": "host_catalog_reference",
                }
        first = planet_id(row["pl_name"])
        output.append(
            {
                "object_id": host_id(name),
                "name": name,
                "kind": "exoplanet_host_system",
                "galaxy_id": MILKY_WAY,
                "parent_id": MILKY_WAY,
                "coordinate": coordinate,
                "position_kind": "catalog_direction" if coordinate else "unavailable",
                "distance_pc": None,
                "distance_status": "source_unit_unverified",
                "galaxy_relative_position_pc": None,
                "source": {
                    "url": row.get("nasa", {}).get("star_url") or catalog["url"],
                    "label": "NASA Science host catalog",
                },
                "catalog_reference": {
                    "catalog": "existing_exoplanets",
                    "first_planet_object_id": first,
                    "planet_count": len(rows),
                    "hostname": name,
                    "distance_value_unit_unverified": row.get("nasa", {}).get(
                        "distance_value_unit_unverified"
                    ),
                },
                "existing_object_id": first,
                "image": None,
                "appearance": None,
                "limitations": [
                    "Host sky direction only; catalog frame/epoch/covariance and distance unit were not independently established here.",
                    "A host may contain multiple stars; planet count is not a count of resolved host-star components.",
                ],
            }
        )
    return output


def get_universe_catalog(
    root: Path, galaxy_id: str | None = None, parent_id: str | None = None
) -> dict:
    root = root.resolve()
    manifest, digest = _manifest(root)
    if galaxy_id is not None and galaxy_id not in manifest["galaxy_ids"]:
        raise ValueError("unknown_universe_galaxy")
    if parent_id is not None:
        known_parents = {
            "solar-system",
            *manifest["galaxy_ids"],
            *(item["object_id"] for item in manifest["objects"]),
        }
        if parent_id.startswith("host-"):
            if not re.fullmatch(r"host-[0-9a-f]{20}", parent_id):
                raise ValueError("unknown_universe_parent")
            if galaxy_id not in (None, MILKY_WAY):
                raise ValueError("universe_parent_galaxy_mismatch")
        elif parent_id not in known_parents:
            raise ValueError("unknown_universe_parent")
        else:
            parent_galaxy = (
                parent_id
                if parent_id in manifest["galaxy_ids"]
                else MILKY_WAY
                if parent_id == "solar-system"
                else next(
                    item["galaxy_id"]
                    for item in manifest["objects"]
                    if item["object_id"] == parent_id
                )
            )
            if galaxy_id is not None and galaxy_id != parent_galaxy:
                raise ValueError("universe_parent_galaxy_mismatch")
    objects = manifest["objects"]
    objects = [item for item in objects if galaxy_id is None or item["galaxy_id"] == galaxy_id]
    solar = {
        "object_id": "solar-system",
        "name": "Solar System",
        "kind": "planetary_system",
        "galaxy_id": MILKY_WAY,
        "parent_id": MILKY_WAY,
        "coordinate": None,
        "distance_pc": None,
        "position_kind": "existing_ephemeris_reference",
        "existing_object_id": "sun",
        "source": {
            "url": "https://ssd.jpl.nasa.gov/horizons/",
            "label": "Existing JPL Solar System viewer",
        },
        "catalog_reference": {
            "catalog": "existing_solar_system",
            "source": manifest["dependencies"]["solar_system_ephemeris"],
            "extension": manifest["dependencies"]["extended_solar"],
        },
        "image": None,
        "appearance": None,
        "limitations": [
            "The observer is inside this system. A single external sky direction for the Solar System is not fabricated."
        ],
    }
    if galaxy_id in (None, MILKY_WAY):
        objects = [solar, *objects]
    if (
        galaxy_id == MILKY_WAY
        or parent_id == MILKY_WAY
        or (parent_id and parent_id.startswith("host-"))
    ):
        catalog = load_catalog(root)
        hosts = _hosts(catalog)
        if parent_id and parent_id.startswith("host-"):
            host = next((item for item in hosts if item["object_id"] == parent_id), None)
            if host is None:
                raise ValueError("unknown_universe_parent")
            objects = [
                {
                    "object_id": planet_id(row["pl_name"]),
                    "name": row["pl_name"],
                    "kind": "exoplanet",
                    "parent_id": parent_id,
                    "galaxy_id": MILKY_WAY,
                    "existing_object_id": planet_id(row["pl_name"]),
                    "coordinate": None,
                    "distance_pc": None,
                    "position_kind": "existing_catalog_reference",
                    "source": {
                        "url": row.get("nasa", {}).get("url") or catalog["url"],
                        "label": "NASA Science planet catalog",
                    },
                    "catalog_reference": {
                        "catalog": "existing_exoplanets",
                        "hostname": row["hostname"],
                    },
                    "image": None,
                    "appearance": None,
                    "limitations": [
                        "Planet selection opens the existing catalog system. No independently resolved planet sky direction or measured surface is supplied."
                    ],
                }
                for row in catalog["records"]
                if row["hostname"] == host["name"]
            ]
        else:
            objects = [*objects, *hosts]
    if parent_id is not None:
        objects = [item for item in objects if item["parent_id"] == parent_id]
    exo_meta = json.loads((root / manifest["dependencies"]["exoplanets"]["path"]).read_bytes())
    return {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM,
        "source_manifest_sha256": digest,
        "galaxy_ids": manifest["galaxy_ids"],
        "galaxy_id": galaxy_id,
        "parent_id": parent_id,
        "objects": objects,
        "coverage": manifest["coverage"],
        "limitations": manifest["limitations"],
        "external_catalogs": {
            "exoplanets": manifest["dependencies"]["exoplanets"]
            | {"host_count": exo_meta["host_count"], "planet_count": exo_meta["planet_count"]},
            "solar_system": solar["catalog_reference"],
            "galaxies": manifest["dependencies"]["galaxies"],
        },
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--acquire", action="store_true")
    arguments = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    result = acquire(root) if arguments.acquire else get_universe_catalog(root)
    print(
        json.dumps({"objects": len(result["objects"]), "sha256": result["source_manifest_sha256"]})
    )
