"""Small official-source galaxy display catalog with rounded directions/distances.

J2000 fast-fact directions are copied numerically into an approximate ICRS display
field; no frame-realization precision, motion, ancient position or pose is inferred.
"""

from __future__ import annotations

import hashlib
import html
import json
import math
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from urllib.request import urlopen

from astropy import units as u
from astropy.coordinates import Angle

MANIFEST = "data/manifests/galaxies.json"
RAW_ROOT = "data/reference/galaxies"
ALGORITHM = "official-rounded-galaxy-context-v1"
NASA_PREFIX = (
    "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/"
)
SPECIFICATIONS = [
    {
        "id": "m31",
        "name": "Messier 31 (Andromeda)",
        "facts": "M31",
        "coordinate_url": "https://chandra.harvard.edu/photo/2025/m31/",
        "distance_url": None,
        "morphology": "spiral",
    },
    {
        "id": "m33",
        "name": "Messier 33 (Triangulum)",
        "facts": "M33",
        "coordinate_url": "https://chandra.cfa.harvard.edu/photo/2026/galaxies/index.html",
        "distance_url": NASA_PREFIX + "messier-33/",
        "morphology": "spiral",
    },
    {
        "id": "m81",
        "name": "Messier 81",
        "facts": "M81",
        "coordinate_url": "https://www.chandra.cfa.harvard.edu/photo/2008/m81/",
        "distance_url": NASA_PREFIX + "messier-81/",
        "morphology": "spiral",
    },
    {
        "id": "m87",
        "name": "Messier 87",
        "facts": "M87 Jet",
        "coordinate_url": "https://chandra.harvard.edu/photo/2026/m87/",
        "distance_url": NASA_PREFIX + "messier-87/",
        "morphology": "elliptical",
    },
]
SPECIFICATIONS += [
    {
        "id": "lmc",
        "name": "Large Magellanic Cloud",
        "facts": "LMC",
        "coordinate_url": "https://simbad.harvard.edu/simbad/sim-id?Ident=LMC",
        "distance_url": "https://science.nasa.gov/image-article/apod-2024-october-2-the-large-magellanic-cloud-galaxy/",
        "morphology": "irregular",
    },
    {
        "id": "smc",
        "name": "Small Magellanic Cloud",
        "facts": "Small Magellanic Cloud (SMC)",
        "coordinate_url": "https://chandra.harvard.edu/photo/2026/swift/",
        "distance_url": None,
        "morphology": "irregular",
    },
    {
        "id": "m51",
        "name": "Messier 51 (Whirlpool)",
        "facts": "Whirlpool Galaxy",
        "coordinate_url": "https://chandra.harvard.edu/photo/2002/0158/",
        "distance_url": NASA_PREFIX + "messier-51/",
        "morphology": "interacting",
    },
    {
        "id": "m104",
        "name": "Messier 104 (Sombrero)",
        "facts": "M104",
        "coordinate_url": "https://chandra.cfa.harvard.edu/photo/2026/galaxies/index.html",
        "distance_url": NASA_PREFIX + "messier-104/",
        "morphology": "spiral",
    },
    {
        "id": "centaurus-a",
        "name": "Centaurus A",
        "facts": "Centaurus A",
        "coordinate_url": "https://chandra.cfa.harvard.edu/photo/2026/galaxies/index.html",
        "distance_url": None,
        "morphology": "elliptical",
    },
]
MORPHOLOGY_SOURCES = {
    "m31_shape": "https://science.nasa.gov/missions/hubble/nasas-hubble-traces-hidden-history-of-andromeda-galaxy/",
    "m81_shape": "https://science.nasa.gov/missions/hubble/hubble-photographs-grand-design-spiral-galaxy-m81/",
    "m81_arms": "https://science.nasa.gov/wp-content/uploads/2023/04/hubble-litho-galaxy-ngc-3982.pdf",
    "smc_shape": "https://science.nasa.gov/photojournal/wises-view-of-a-wispy-cloud/",
}
LIMITATIONS = [
    "A small illustrative galaxy context catalog, not a complete galaxy census or a precision astrometric catalog.",
    "Most source coordinates are rounded J2000 equatorial fast-fact directions with unspecified frame realization, copied numerically as approximate ICRS without frame-bias conversion. LMC separately retains its explicitly ICRS epoch-J2000 SIMBAD reference; no direction is propagated to 2026.",
    "Distances are rounded public estimates from Earth; the original distance convention, uncertainty and covariance are not established here. Unit conversion adds no accuracy.",
    "No proper-motion propagation, individual stellar positions, full 3D galaxy orientation/size, current simultaneous physical pose or billions-of-years trajectory is reconstructed.",
    "Source-reported projected features and any stated inclination are separate from illustrative colors, point counts, missing angles, display sizes and unresolved geometry; no source observation image is copied into the renderer.",
    "This static nearby-galaxy context is separate from the conceptual cosmic chronology and the bounded 2026 solar ephemeris. SPHEREx observations remain unchanged.",
]


def _plain(document: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]*>", " ", document)).split())


def parse_fast_facts(document: str, object_label: str) -> dict:
    text = _plain(document)
    matches = list(
        re.finditer(r"Fast Facts for\s+" + re.escape(object_label) + r"(?:\s*:|\s+Credit)", text)
    )
    if not matches:
        raise ValueError("galaxy_fast_facts_missing")
    # Facts may appear more than once in accessible markup. Read the actual
    # following facts block, not an unrelated galaxy earlier in a gallery.
    for match in matches:
        block = text[match.end() :].split("Fast Facts for", 1)[0]
        coordinates = re.search(
            r"Coordinates\s*\(J2000\)\s*:?\s*RA\s*:?\s*(\d+)h\s*(\d+)m\s*([\d.]+)s\s*\|?\s*Dec\s*:?\s*([+-])(\d+)[°º]\s*(\d+)[′´']\s*([\d.]+)[″\"]",
            block,
        )
        distance = re.search(
            r"Distance Estimate\s*:?\s*(?:About\s+)?([\d,.]+)\s+(million\s+)?light[- ]years",
            block,
            re.IGNORECASE,
        )
        if coordinates and distance:
            h, m, s, sign, d, dm, ds = coordinates.groups()
            if (
                int(h) >= 24
                or int(m) >= 60
                or float(s) >= 60
                or int(d) > 90
                or int(dm) >= 60
                or float(ds) >= 60
            ):
                raise ValueError("invalid_source_galaxy_coordinates")
            ra = Angle(f"{h}h{m}m{s}s").to_value(u.deg)
            dec = Angle(f"{sign}{d}d{dm}m{ds}s").to_value(u.deg)
            return {
                "ra": float(ra),
                "dec": float(dec),
                "ra_sexagesimal": f"{h}h {m}m {s}s",
                "dec_sexagesimal": f"{sign}{d}d {dm}m {ds}s",
                "original_coordinate_text": coordinates.group(0),
                "coordinate_reference": "J2000 equatorial; exact realization unspecified",
                "distance_million_ly": float(distance.group(1).replace(",", ""))
                / (1 if distance.group(2) else 1_000_000),
                "distance_original_text": distance.group(0),
            }
    raise ValueError("galaxy_coordinate_or_distance_missing")


def parse_nasa_distance(document: str) -> tuple[float, str]:
    match = re.search(
        r"\bDistance\s+(?:About\s+)?([\d.]+)\s+million light[- ]years",
        _plain(document),
        re.IGNORECASE,
    )
    if not match:
        raise ValueError("nasa_galaxy_distance_missing")
    return float(match.group(1)), match.group(0)


def _acquire_source(
    root: Path, key: str, url: str, label: str, extension=".html"
) -> tuple[str, dict]:
    allowed = (
        {spec["coordinate_url"] for spec in SPECIFICATIONS}
        | {spec["distance_url"] for spec in SPECIFICATIONS if spec["distance_url"]}
        | set(MORPHOLOGY_SOURCES.values())
    )
    if url not in allowed:
        raise ValueError("galaxy_source_url_not_allowed")
    relative = f"{RAW_ROOT}/{key}{extension}"
    path = root / relative
    metadata = path.with_suffix(path.suffix + ".source.json")
    if path.exists():
        raw = path.read_bytes()
        source = json.loads(metadata.read_text(encoding="utf-8"))
        if (
            source["url"] != url
            or source["sha256"] != hashlib.sha256(raw).hexdigest()
            or source["bytes"] != len(raw)
        ):
            raise ValueError("immutable_galaxy_source_conflict")
    else:
        limit = 3_000_000 if extension == ".pdf" else 2_000_000
        with urlopen(url, timeout=30) as response:
            raw = response.read(limit + 1)
            resolved_url = response.url
        if len(raw) > limit:
            raise ValueError("galaxy_source_too_large")
        source = {
            "url": url,
            "resolved_url": resolved_url,
            "label": label,
            "local_relative_path": relative,
            "sha256": hashlib.sha256(raw).hexdigest(),
            "bytes": len(raw),
            "retrieved_utc": datetime.now(UTC).isoformat(),
            "acquisition_client": "Python urllib; default TLS chain/hostname validation",
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("xb") as stream:
            stream.write(raw)
        metadata.write_text(json.dumps(source, indent=2) + "\n", encoding="utf-8", newline="\n")
    return "" if raw.startswith(b"%PDF") else raw.decode("utf-8"), source


def acquire(root: Path) -> dict:
    root = Path(root)
    if (root / MANIFEST).exists():
        raise FileExistsError("galaxy_manifest_exists")
    objects, sources = [], {}
    for specification in SPECIFICATIONS[:4]:
        object_id = specification["id"]
        document, coordinate_source = _acquire_source(
            root,
            object_id + "_coordinates",
            specification["coordinate_url"],
            "NASA Chandra/CXC: " + specification["facts"] + " Fast Facts",
        )
        sources[object_id + "_coordinates"] = coordinate_source
        facts = parse_fast_facts(document, specification["facts"])
        distance_value, distance_text = (
            facts["distance_million_ly"],
            facts["distance_original_text"],
        )
        distance_source = coordinate_source
        morphology_source = coordinate_source
        if specification["distance_url"]:
            nasa_document, distance_source = _acquire_source(
                root,
                object_id + "_nasa",
                specification["distance_url"],
                "NASA Hubble Messier catalog: " + object_id.upper(),
            )
            distance_value, distance_text = parse_nasa_distance(nasa_document)
            sources[object_id + "_nasa"] = distance_source
            if specification["morphology"] + " galaxy" not in _plain(nasa_document).lower():
                raise ValueError("galaxy_morphology_source_mismatch")
            morphology_source = distance_source
        distance_ly = distance_value * 1_000_000
        record = {
            "object_id": "galaxy-" + object_id,
            "name": specification["name"],
            "kind": "galaxy",
            "direction_icrs_deg": {"ra": facts["ra"], "dec": facts["dec"]},
            "direction_kind": "approximate_display_copy_of_rounded_J2000_fast_fact_direction",
            "native_coordinates": {
                key: facts[key]
                for key in (
                    "ra_sexagesimal",
                    "dec_sexagesimal",
                    "original_coordinate_text",
                    "coordinate_reference",
                )
            },
            "distance_ly": distance_ly,
            "distance_mpc": float((distance_ly * u.lyr).to_value(u.Mpc)),
            "distance_kind": "rounded_public_distance_estimate_from_Earth",
            "distance_original_text": distance_text,
            "distance_uncertainty": None,
            "source": coordinate_source,
            "coordinate_source": coordinate_source,
            "distance_source": distance_source,
            "morphology": specification["morphology"],
            "morphology_source": morphology_source,
            "limitations": list(LIMITATIONS),
        }
        if facts["distance_million_ly"] != distance_value:
            record["source_difference"] = {
                "coordinate_page_distance_million_ly": facts["distance_million_ly"],
                "adopted_nasa_distance_million_ly": distance_value,
                "reason": "Different rounded public estimates are retained separately; no averaging or precision claim.",
                "other_source": coordinate_source,
            }
        objects.append(record)
    manifest = {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM,
        "created_utc": datetime.now(UTC).isoformat(),
        "objects": objects,
        "sources": sources,
        "limitations": LIMITATIONS,
        "coordinate_policy": "Native rounded J2000 equatorial values treated as approximate ICRS for display; no frame-bias or epoch propagation",
        "distance_unit_conversion": "Astropy units: source rounded million light-years to light-years and Mpc; no cosmological-distance reinterpretation",
        "images_downloaded": False,
    }
    target = root / MANIFEST
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(manifest, stream, indent=2, allow_nan=False)
        stream.write("\n")
    return extend_observed_morphologies(root)


def extend_observed_morphologies(root: Path) -> dict:
    """Add five verified objects and nine source-backed appearance guides.

    Old directions/distances and every original response remain unchanged. The
    prior four-object derived catalog is kept as a separate immutable snapshot.
    """
    root = Path(root)
    manifest_path = root / MANIFEST
    old_raw = manifest_path.read_bytes()
    manifest = get_galaxies(root)
    if len(manifest["objects"]) != 4:
        raise ValueError("galaxy_morphologies_already_extended")
    manifest.pop("source_manifest_sha256", None)
    sources = manifest["sources"]
    documents = {}
    for key, url in MORPHOLOGY_SOURCES.items():
        document, source = _acquire_source(
            root, key, url, key, ".pdf" if url.endswith(".pdf") else ".html"
        )
        labels = {
            "m31_shape": "NASA Hubble: Andromeda's observed 77-degree inclination and dust lanes",
            "m81_shape": "NASA Hubble: grand-design spiral M81",
            "m81_arms": "NASA Hubble lithograph: Cosmic Pinwheels (two long M81 arms)",
            "smc_shape": "NASA WISE: Small Magellanic Cloud irregular morphology",
        }
        sources[key] = {**source, "label": labels[key]}
        documents[key] = _plain(document)
    if (
        "77 degrees" not in documents["m31_shape"]
        or "irregular" not in documents["smc_shape"].lower()
    ):
        raise ValueError("galaxy_shape_source_changed")
    for specification in SPECIFICATIONS[4:]:
        object_id = specification["id"]
        # The same full 2026 gallery is already a preserved source for M33.
        if object_id in {"m104", "centaurus-a"}:
            coordinate_source = sources["m33_coordinates"]
            document = (root / coordinate_source["local_relative_path"]).read_text(encoding="utf-8")
        else:
            document, coordinate_source = _acquire_source(
                root,
                object_id + "_coordinates",
                specification["coordinate_url"],
                "SIMBAD Harvard: LMC ICRS catalog direction"
                if object_id == "lmc"
                else "NASA Chandra/CXC: " + specification["facts"] + " Fast Facts",
            )
            sources[object_id + "_coordinates"] = coordinate_source
        if object_id == "lmc":
            plain = _plain(document)
            match = re.search(
                r"ICRS coord\.\s*\(ep=J2000\)\s*:?\s*(\d+)\s+(\d+)\s+([\d.]+)\s+([+-]\d+)\s+(\d+)\s+([\d.]+)",
                plain,
            )
            if not match or "2003A&A...412...45P" not in plain:
                raise ValueError("lmc_catalog_direction_missing")
            h, m, s, d, dm, ds = match.groups()
            facts = {
                "ra": float(Angle(f"{h}h{m}m{s}s").degree),
                "dec": float(Angle(f"{d}d{dm}m{ds}s").degree),
                "ra_sexagesimal": f"{h}h {m}m {s}s",
                "dec_sexagesimal": f"{d}d {dm}m {ds}s",
                "original_coordinate_text": match.group(0),
                "coordinate_reference": "ICRS epoch J2000 from SIMBAD; optical quality D; bibcode 2003A&A...412...45P",
                "distance_million_ly": 0.16,
                "distance_original_text": "NASA approximate distance 160,000 light years",
            }
        else:
            facts = parse_fast_facts(document, specification["facts"])
        distance_value, distance_text = (
            facts["distance_million_ly"],
            facts["distance_original_text"],
        )
        distance_source = coordinate_source
        if specification["distance_url"]:
            nasa, distance_source = _acquire_source(
                root,
                object_id + "_nasa",
                specification["distance_url"],
                "NASA: " + specification["name"],
            )
            sources[object_id + "_nasa"] = distance_source
            if object_id == "lmc":
                plain = _plain(nasa)
                if (
                    "160,000" not in plain
                    or "single spiral arm" not in plain
                    or "central bar" not in plain
                ):
                    raise ValueError("lmc_distance_or_shape_source_changed")
                distance_value, distance_text = (
                    0.16,
                    "NASA approximate distance 160,000 light years",
                )
            else:
                distance_value, distance_text = parse_nasa_distance(nasa)
        distance_ly = distance_value * 1_000_000
        record = {
            "object_id": "galaxy-" + object_id,
            "name": specification["name"],
            "kind": "galaxy",
            "direction_icrs_deg": {"ra": facts["ra"], "dec": facts["dec"]},
            "direction_kind": "catalog_ICRS_epJ2000_not_propagated"
            if object_id == "lmc"
            else "approximate_display_copy_of_rounded_J2000_fast_fact_direction",
            "native_coordinates": {
                key: facts[key]
                for key in (
                    "ra_sexagesimal",
                    "dec_sexagesimal",
                    "original_coordinate_text",
                    "coordinate_reference",
                )
            },
            "distance_ly": distance_ly,
            "distance_mpc": float((distance_ly * u.lyr).to_value(u.Mpc)),
            "distance_kind": "rounded_public_distance_estimate_from_Earth",
            "distance_original_text": distance_text,
            "distance_uncertainty": None,
            "source": coordinate_source,
            "coordinate_source": coordinate_source,
            "distance_source": distance_source,
            "morphology": specification["morphology"],
            "morphology_source": distance_source,
            "limitations": list(LIMITATIONS),
        }
        if facts["distance_million_ly"] != distance_value:
            record["source_difference"] = {
                "coordinate_page_distance_million_ly": facts["distance_million_ly"],
                "adopted_nasa_distance_million_ly": distance_value,
                "reason": "Different rounded source estimates retained separately, without averaging.",
                "other_source": coordinate_source,
            }
        manifest["objects"].append(record)
    shapes = {
        "m31": (
            "inclined_spiral",
            "m31_shape",
            ["Strongly inclined stellar disk", "Central bulge and dark dust lanes"],
            77,
            None,
            None,
        ),
        "m33": (
            "flocculent_spiral",
            "m33_coordinates",
            ["Many wispy faint spiral arms", "Patchy bright star-forming regions"],
            None,
            None,
            None,
        ),
        "m81": (
            "grand_design_spiral",
            "m81_arms",
            ["Two long well-defined spiral arms", "Bright central stellar bulge"],
            None,
            2,
            None,
        ),
        "m87": (
            "elliptical_jet",
            "m87_nasa",
            [
                "Smooth giant elliptical stellar envelope",
                "Central energetic jet; not a spiral disk",
            ],
            None,
            0,
            None,
        ),
        "lmc": (
            "irregular_barred",
            "lmc_nasa",
            ["Prominent central bar", "One asymmetric spiral arm", "Clumpy star-forming regions"],
            None,
            1,
            True,
        ),
        "smc": (
            "irregular_cloud",
            "smc_shape",
            [
                "Irregular asymmetric stellar and dust distribution",
                "Clumpy star-forming regions rather than ordered spiral arms",
            ],
            None,
            None,
            None,
        ),
        "m51": (
            "interacting_pair",
            "m51_nasa",
            [
                "Spiral disk interacting with smaller NGC 5195",
                "Bridge-like connection and tidally affected spiral structure",
            ],
            None,
            None,
            None,
        ),
        "m104": (
            "edge_on_dust_disk",
            "m104_nasa",
            ["Nearly edge-on disk", "Large bright spheroidal bulge", "Dark equatorial dust lane"],
            None,
            None,
            None,
        ),
        "centaurus-a": (
            "dust_lane_elliptical",
            "m33_coordinates",
            ["Giant elliptical host crossed by a thick dust lane", "Energetic central jet"],
            None,
            0,
            None,
        ),
    }
    for obj in manifest["objects"]:
        slug = obj["object_id"].removeprefix("galaxy-")
        renderer, source_id, features, inclination, arms, bar = shapes[slug]
        source = sources[source_id]
        extras = [obj["coordinate_source"]] if slug in {"m51", "centaurus-a", "m33"} else []
        obj["appearance"] = {
            "renderer": renderer,
            "source": source,
            "additional_sources": extras,
            "observed_features": features,
            "inclination_deg": inclination,
            "position_angle_deg": None,
            "arms": arms,
            "barred": bar,
            "inclination_source": source if inclination is not None else None,
            "arm_count_source": source if arms is not None else None,
            "orientation_status": "source_projected_appearance"
            if inclination is not None
            else "illustrative_assumption",
            "orientation_scope": "Only explicitly sourced projected inclination is measured; unprovided sky position angle, pole and 3D orientation remain assumptions.",
            "display_assumptions": [
                "Renderer geometry, point counts, colors, scales, thickness, arm pitch/width and star positions are explanatory choices, not a photometric or resolved stellar reconstruction.",
                "Missing inclination/position-angle values remain null; an illustrative default is not a catalog measurement.",
                "No physical motion, spin period, ancient pose or dynamical evolution is inferred from these shape guides.",
            ],
        }
        if slug == "lmc":
            obj["appearance"]["classification_note"] = (
                "Magellanic barred/asymmetric morphology; the irregular_barred renderer is descriptive, not an assertion that the galaxy has no spiral arm."
            )
        if slug == "m51":
            obj["appearance"]["companion"] = {
                "name": "NGC 5195",
                "source": obj["coordinate_source"],
                "projected_separation_arcmin": None,
                "position_angle_deg": None,
                "display_offset_is_assumed": True,
            }
        if slug == "m33":
            obj["appearance"]["classification_note"] = (
                "flocculent_spiral is a renderer style chosen for the source-described many wispy arms; it is not an asserted NASA numerical or morphological classification."
            )
        obj["limitations"] = list(LIMITATIONS)
        obj["image_source"] = {
            "url": obj["distance_source"]["url"]
            if slug in {"lmc", "m51", "m104"}
            else obj["coordinate_source"]["url"],
            "label": "Official observed-image reference page; linked, not copied into the renderer",
        }
    previous_path = root / RAW_ROOT / "catalog_before_morphology_v1.json"
    if previous_path.exists() and previous_path.read_bytes() != old_raw:
        raise ValueError("previous_galaxy_catalog_snapshot_conflict")
    if not previous_path.exists():
        previous_path.write_bytes(old_raw)
    manifest["superseded_catalog"] = {
        "local_relative_path": previous_path.relative_to(root).as_posix(),
        "sha256": hashlib.sha256(old_raw).hexdigest(),
        "bytes": len(old_raw),
        "reason": "Original four-object derived catalog retained; its source response bytes and four directions/distances are unchanged.",
    }
    manifest["morphology_algorithm_version"] = "observed-morphology-guide-v1"
    manifest["updated_utc"] = datetime.now(UTC).isoformat()
    manifest["limitations"].append(
        "Projected observed features guide nine distinct illustrative geometries. Missing inclinations/sky position angles remain null; qualitative edge-on/bar/dust-lane descriptions are not fabricated numeric measurements."
    )
    temporary = manifest_path.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(manifest, indent=2, allow_nan=False) + "\n", encoding="utf-8", newline="\n"
    )
    os.replace(temporary, manifest_path)
    return manifest


def get_galaxies(root: Path) -> dict:
    """Read and verify bounded local sources, with no runtime network calls."""
    root = Path(root).resolve()
    raw = (root / MANIFEST).read_bytes()
    manifest = json.loads(raw)
    if manifest.get("schema_version") != "1.0" or manifest.get("algorithm_version") != ALGORITHM:
        raise ValueError("unsupported_galaxy_schema")
    allowed = (
        {spec["coordinate_url"] for spec in SPECIFICATIONS}
        | {spec["distance_url"] for spec in SPECIFICATIONS if spec["distance_url"]}
        | set(MORPHOLOGY_SOURCES.values())
    )
    for source in manifest["sources"].values():
        path = (root / source["local_relative_path"]).resolve()
        if (
            not path.is_relative_to(root / RAW_ROOT)
            or not path.is_file()
            or source["url"] not in allowed
        ):
            raise ValueError("galaxy_source_missing_or_outside_root")
        content = path.read_bytes()
        if (
            len(content) != source["bytes"]
            or hashlib.sha256(content).hexdigest() != source["sha256"]
        ):
            raise ValueError("galaxy_source_integrity")
    ids = {obj["object_id"] for obj in manifest["objects"]}
    if len(manifest["objects"]) != len(ids) or ids not in (
        {"galaxy-" + spec["id"] for spec in SPECIFICATIONS[:4]},
        {"galaxy-" + spec["id"] for spec in SPECIFICATIONS},
    ):
        raise ValueError("galaxy_catalog_membership_mismatch")
    for obj in manifest["objects"]:
        direction = obj["direction_icrs_deg"]
        if not (
            0 <= direction["ra"] < 360
            and -90 <= direction["dec"] <= 90
            and math.isfinite(obj["distance_ly"])
            and obj["distance_ly"] > 0
        ):
            raise ValueError("galaxy_coordinate_or_distance_invalid")
        if not math.isclose(
            obj["distance_mpc"], (obj["distance_ly"] * u.lyr).to_value(u.Mpc), rel_tol=1e-14
        ):
            raise ValueError("galaxy_unit_conversion_mismatch")
        for key in ("coordinate_source", "distance_source", "morphology_source", "source"):
            if obj[key] not in manifest["sources"].values():
                raise ValueError("galaxy_object_source_mismatch")
        if "appearance" in obj:
            appearance = obj["appearance"]
            if appearance["source"] not in manifest["sources"].values():
                raise ValueError("galaxy_shape_source_mismatch")
            for key in ("inclination_deg", "position_angle_deg"):
                value = appearance[key]
                if value is not None and (
                    not math.isfinite(value)
                    or not 0 <= value <= (90 if key == "inclination_deg" else 360)
                ):
                    raise ValueError("galaxy_shape_angle_invalid")
            if (
                appearance["inclination_deg"] is not None
                and appearance["inclination_source"] != appearance["source"]
            ):
                raise ValueError("galaxy_inclination_source_missing")
    previous = manifest.get("superseded_catalog")
    if previous:
        path = (root / previous["local_relative_path"]).resolve()
        if not path.is_relative_to(root / RAW_ROOT) or not path.is_file():
            raise ValueError("previous_galaxy_catalog_missing")
        content = path.read_bytes()
        if (
            len(content) != previous["bytes"]
            or hashlib.sha256(content).hexdigest() != previous["sha256"]
        ):
            raise ValueError("previous_galaxy_catalog_integrity")
    manifest["source_manifest_sha256"] = hashlib.sha256(raw).hexdigest()
    return manifest


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--acquire", action="store_true")
    parser.add_argument("--extend-morphology", action="store_true")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    result = (
        extend_observed_morphologies(args.root)
        if args.extend_morphology
        else acquire(args.root)
        if args.acquire
        else get_galaxies(args.root)
    )
    print(json.dumps({"objects": len(result["objects"]), "sources": len(result["sources"])}))
