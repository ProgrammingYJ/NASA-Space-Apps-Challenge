"""Unmodified public direct-imaging releases for three confirmed catalog planets.

These are processed telescope images, not raw detector frames or surface maps.
Only the explicitly reviewed observation/collage assets are admissible.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from science.exoplanets import object_id as planet_id

MANIFEST = "data/manifests/exoplanet_observations.json"
REFERENCE_ROOT = "data/reference/exoplanet-observations"
IMAGE_ROOT = "web/public/observations/exoplanets"
ALGORITHM = "published-exoplanet-observations-v1"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
ALLOWED_HOSTS = {
    "www.eso.org",
    "cdn.eso.org",
    "esawebb.org",
    "cdn.esawebb.org",
    "science.nasa.gov",
    "arxiv.org",
}

SPECIFICATIONS = [
    {
        "observation_id": "hip65426b-jwst-2022",
        "object_id": "exo-27e52bc5e4a85faba3a2",
        "planet_name": "HIP 65426 b",
        "source_key": "hip65426b-esawebb",
        "page_url": "https://esawebb.org/images/HIP-65426b/",
        "image_source_url": "https://cdn.esawebb.org/archives/images/large/HIP-65426b.jpg",
        "title": "HIP 65426 b: JWST infrared observation collage",
        "publication_date": "2022-09-01",
        "source_asset_type": "Collage",
        "credit": "NASA/ESA/CSA, A Carter (UCSC), the ERS 1386 team, and A. Pagan (STScI)",
        "license_source_key": "esawebb-rights",
        "instruments": ["JWST/NIRCam", "JWST/MIRI"],
        "wavelengths_um": [3.00, 4.44, 11.4, 15.5],
        "observation_dates": ["2022-07-17", "2022-07-30"],
        "processing": [
            "Four infrared-filter views are displayed with assigned colors.",
            "Coronagraphy and image processing suppress the host star; white star symbols mark its location.",
            "NIRCam bar-shaped features are optical artifacts, not additional objects.",
        ],
        "limitations": [
            "The planet is an unresolved light source; these blobs do not resolve a planetary surface.",
            "Assigned infrared colors do not show human-eye surface colors.",
            "The 2022 release was preliminary; the observation paper is separately linked as Carter et al., doi:10.3847/2041-8213/acd93e.",
        ],
        "additional_source_keys": ["hip65426b-nasa-metadata", "hip65426b-paper"],
        "required_tokens": ["HIP 65426 b", "Collage", "coronagraph", "artifacts", "A Carter"],
    },
    {
        "observation_id": "beta-pic-b-sphere-2018",
        "object_id": "exo-b3de4ed79fcf6cd22853",
        "planet_name": "Beta Pictoris b",
        "source_key": "beta-pic-b-eso",
        "page_url": "https://www.eso.org/public/images/potw1846a/",
        "image_source_url": "https://cdn.eso.org/images/large/potw1846a.jpg",
        "title": "Beta Pictoris b: VLT/SPHERE observation sequence collage",
        "publication_date": "2018-11-12",
        "source_asset_type": "Collage",
        "credit": "ESO/Lagrange/SPHERE consortium.",
        "license_source_key": "eso-rights",
        "instruments": ["VLT/SPHERE"],
        "wavelengths_um": [2.11, 1.593, 2.251, 1.667],
        "observation_dates": [],
        "processing": [
            "Published collage combines a sequence of direct observations with the bright stellar glow blocked.",
            "The source release describes monitoring in late 2014-2016 and a later reappearance in 2018.",
            "Listed wavelengths are the release-page filter metadata for the sequence, not a per-frame calibration.",
        ],
        "limitations": [
            "The sequence resolves the planet from its host star, not details across the planet's surface.",
            "The apparent passage across the stellar halo is not a measured transit across the star.",
            "The published collage is not a current-position ephemeris or an interactive orbital solution.",
        ],
        "additional_source_keys": [],
        "required_tokens": [
            "Beta Pictoris b",
            "Collage",
            "SPHERE",
            "does not in fact quite transit",
            "ESO/Lagrange/SPHERE consortium.",
        ],
    },
    {
        "observation_id": "hr8799c-naco-2010",
        "object_id": "exo-037ff94cfb7621193437",
        "planet_name": "HR 8799 c",
        "source_key": "hr8799c-eso",
        "page_url": "https://www.eso.org/public/images/eso1002b/",
        "image_source_url": "https://cdn.eso.org/images/large/eso1002b.jpg",
        "title": "HR 8799 c: annotated VLT/NACO observation",
        "publication_date": "2010-01-13",
        "source_asset_type": "Observation",
        "credit": "ESO/M. Janson",
        "license_source_key": "eso-rights",
        "instruments": ["VLT/NACO"],
        "wavelengths_um": [],
        "observation_dates": [],
        "processing": [
            "Near-infrared adaptive-optics observation with the planetary signal marked in the published image.",
            "The host-star image contains diffraction artifacts that must not be identified as extra planets.",
        ],
        "limitations": [
            "The companion is detected separately from the star but its surface is unresolved.",
            "This is a dated processed image, not a raw calibrated exposure or a present-day position.",
            "The release's historic three-planet description is not adopted as the system's current planet count.",
        ],
        "additional_source_keys": ["hr8799c-paper-context"],
        "required_tokens": ["Observation", "NACO", "diffraction", "ESO/M. Janson"],
    },
]

EXTRA_SOURCES = {
    "eso-rights": {
        "url": "https://www.eso.org/public/copyright/",
        "label": "ESO public media usage conditions",
        "facts": {
            "license": "CC BY 4.0",
            "full_visible_credit_required": True,
            "active_source_link_required": True,
            "changes_must_be_indicated": True,
            "endorsement_not_granted": True,
            "logos_not_covered": True,
        },
        "required_tokens": ["Attribution 4.0", "credit", "endorsement"],
    },
    "esawebb-rights": {
        "url": "https://esawebb.org/copyright/",
        "label": "ESA/Webb public media usage conditions",
        "facts": {
            "license": "CC BY 4.0",
            "full_visible_credit_required": True,
            "active_source_link_required": True,
            "significant_changes_should_be_indicated": True,
            "endorsement_not_granted": True,
            "logos_not_covered": True,
        },
        "required_tokens": ["Attribution 4.0", "credit", "endorsement"],
    },
    "hip65426b-nasa-metadata": {
        "url": "https://science.nasa.gov/asset/webb/image-of-exoplanet-hip-65426-b-in-near-and-mid-infrared/",
        "label": "NASA JWST image observation metadata",
        "facts": {
            "planet_name": "HIP 65426 b",
            "observation_dates": ["2022-07-17", "2022-07-30"],
            "filters": ["F300M", "F444W", "F1140C", "F1550C"],
            "proposal": "1386",
        },
        "required_tokens": ["17 July 2022", "30 July 2022", "F300M", "1386"],
    },
    "hip65426b-paper": {
        "url": "https://arxiv.org/abs/2208.14990",
        "label": "Carter et al., JWST ERS direct observations of HIP 65426 b",
        "facts": {
            "doi": "10.3847/2041-8213/acd93e",
            "arxiv": "2208.14990",
            "method": "coronagraphic direct imaging",
            "surface_resolved": False,
        },
        "required_tokens": ["coronagraphic", "HIP 65426 b", "10.3847/2041-8213/acd93e"],
    },
    "hr8799c-paper-context": {
        "url": "https://www.eso.org/public/news/eso1002/",
        "label": "ESO release linked to Janson et al., ApJ 710 L35 (2010)",
        "facts": {
            "paper": "Spatially resolved spectroscopy of the exoplanet HR 8799 c",
            "bibcode": "2010ApJ...710L..35J",
            "instrument": "NACO",
        },
        "required_tokens": ["HR 8799 c", "Janson", "2010ApJ...710L..35J"],
    },
}


def _hash(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _safe_url(url: str) -> None:
    parts = urlsplit(url)
    if parts.scheme != "https" or parts.hostname not in ALLOWED_HOSTS or parts.username:
        raise ValueError("invalid_exoplanet_observation_url")


def _safe_path(root: Path, relative: str, base: str) -> Path:
    path = (root / relative).resolve()
    if not path.is_relative_to((root / base).resolve()):
        raise ValueError("exoplanet_observation_path_escape")
    return path


def _fetch(root: Path, relative: str, url: str, *, local_only: bool) -> tuple[bytes, dict]:
    _safe_url(url)
    path = root / relative
    sidecar = path.with_suffix(path.suffix + ".source.json")
    if path.exists() or sidecar.exists():
        source = json.loads(sidecar.read_bytes())
        raw = path.read_bytes()
        if source["url"] != url or source["bytes"] != len(raw) or source["sha256"] != _hash(raw):
            raise ValueError("existing_exoplanet_observation_changed")
        return raw, source
    with urlopen(
        Request(url, headers={"User-Agent": "SpaceApps-published-observations/0.6"}), timeout=45
    ) as response:
        _safe_url(response.url)
        raw, resolved = response.read(5_000_001), response.url
    if not raw or len(raw) > 5_000_000:
        raise ValueError("invalid_exoplanet_observation_size")
    source = {
        "url": url,
        "resolved_url": resolved,
        "local_relative_path": relative,
        "bytes": len(raw),
        "sha256": _hash(raw),
        "retrieved_utc": datetime.now(UTC).isoformat(),
        "redistribution": "local_reference_only_not_in_public_release"
        if local_only
        else "CC-BY-4.0_published_asset_unmodified",
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    sidecar.write_text(json.dumps(source, indent=2) + "\n", encoding="utf-8")
    return raw, source


def jpeg_dimensions(raw: bytes) -> tuple[int, int]:
    """Check JPEG framing and read SOF dimensions without modifying image bytes."""
    if not raw.startswith(b"\xff\xd8") or not raw.endswith(b"\xff\xd9"):
        raise ValueError("invalid_exoplanet_observation_jpeg")
    cursor = 2
    while cursor + 4 < len(raw):
        if raw[cursor] != 255:
            raise ValueError("invalid_exoplanet_observation_jpeg")
        while raw[cursor] == 255:
            cursor += 1
        marker = raw[cursor]
        cursor += 1
        size = int.from_bytes(raw[cursor : cursor + 2], "big")
        if size < 2 or cursor + size > len(raw):
            raise ValueError("invalid_exoplanet_observation_jpeg")
        if marker in (192, 193, 194):
            height = int.from_bytes(raw[cursor + 3 : cursor + 5], "big")
            width = int.from_bytes(raw[cursor + 5 : cursor + 7], "big")
            if not (10 <= width <= 10000 and 10 <= height <= 10000):
                raise ValueError("invalid_exoplanet_observation_dimensions")
            return width, height
        cursor += size
    raise ValueError("missing_exoplanet_observation_dimensions")


def _public_spec(spec: dict) -> dict:
    return {
        key: value
        for key, value in spec.items()
        if key
        not in {
            "required_tokens",
            "source_key",
            "license_source_key",
            "additional_source_keys",
            "page_url",
        }
    }


def acquire(root: Path) -> dict:
    root = root.resolve()
    requests = {
        spec["source_key"]: {
            "url": spec["page_url"],
            "label": spec["title"],
            "facts": _public_spec(spec),
            "required_tokens": spec["required_tokens"],
        }
        for spec in SPECIFICATIONS
    } | EXTRA_SOURCES
    with ThreadPoolExecutor(max_workers=2) as pool:
        originals = dict(
            zip(
                requests,
                pool.map(
                    lambda item: _fetch(
                        root,
                        f"{REFERENCE_ROOT}/upstream/{item[0]}.html",
                        item[1]["url"],
                        local_only=True,
                    ),
                    requests.items(),
                ),
                strict=True,
            )
        )
    sources = {}
    for key, spec in requests.items():
        raw, original = originals[key]
        text = html.unescape(re.sub("<[^>]+>", " ", raw.decode("utf-8")))
        text = re.sub(r"\s+", " ", text)
        if any(token.lower() not in text.lower() for token in spec["required_tokens"]):
            raise ValueError("exoplanet_observation_claim_missing:" + key)
        snapshot = {
            "schema_version": "1.0",
            "kind": "authored_factual_source_extract",
            "facts": spec["facts"],
            "source_url": original["url"],
            "upstream_sha256": original["sha256"],
            "upstream_bytes": original["bytes"],
            "upstream_retrieved_utc": original["retrieved_utc"],
            "upstream_original_requirement": "optional_not_runtime",
        }
        content = (
            json.dumps(snapshot, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
        ).encode("utf-8")
        relative = f"{REFERENCE_ROOT}/facts/{key}.json"
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists() and path.read_bytes() != content:
            raise ValueError("existing_exoplanet_observation_facts_changed")
        path.write_bytes(content)
        source = {
            "source_id": key,
            "url": original["url"],
            "label": spec["label"],
            "local_relative_path": relative,
            "bytes": len(content),
            "sha256": _hash(content),
            "retrieved_utc": original["retrieved_utc"],
            "upstream_sha256": original["sha256"],
            "upstream_bytes": original["bytes"],
            "upstream_original_local_only": original["local_relative_path"],
            "upstream_original_requirement": "optional_not_runtime",
        }
        path.with_suffix(".source.json").write_text(
            json.dumps(source, indent=2) + "\n", encoding="utf-8"
        )
        sources[key] = source
    observations = []
    for spec in SPECIFICATIONS:
        relative = f"{IMAGE_ROOT}/{spec['observation_id']}.jpg"
        raw, image_source = _fetch(root, relative, spec["image_source_url"], local_only=False)
        width, height = jpeg_dimensions(raw)
        if spec["image_source_url"] not in originals[spec["source_key"]][0].decode("utf-8"):
            raise ValueError("exoplanet_observation_image_not_linked")
        observations.append(
            _public_spec(spec)
            | {
                "kind": "processed_direct_imaging",
                "surface_resolved": False,
                "image_alt": spec["title"]
                + ". Processed telescope signal; planetary surface unresolved.",
                "image_url": "/observations/exoplanets/" + Path(relative).name,
                "local_relative_path": relative,
                "bytes": len(raw),
                "sha256": _hash(raw),
                "width": width,
                "height": height,
                "retrieved_utc": image_source["retrieved_utc"],
                "asset_source": image_source,
                "source": sources[spec["source_key"]],
                "additional_sources": [sources[key] for key in spec["additional_source_keys"]],
                "license": {
                    "name": "CC BY 4.0",
                    "url": LICENSE_URL,
                    "source": sources[spec["license_source_key"]],
                },
                "project_modifications": "none; the published JPEG bytes are served unchanged",
            }
        )
    archive_path = "data/manifests/exoplanets.json"
    archive_raw = (root / archive_path).read_bytes()
    manifest = {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM,
        "created_utc": datetime.now(UTC).isoformat(),
        "coverage": "three_adopted_confirmed_planet_observation_releases_not_complete_census",
        "observations": observations,
        "sources": sources,
        "confirmed_catalog_dependency": {
            "path": archive_path,
            "sha256": _hash(archive_raw),
            "bytes": len(archive_raw),
        },
        "release_rule": "Include facts/, published images and sidecars; exclude upstream/ source-page copies.",
    }
    (root / MANIFEST).write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8"
    )
    return get_exoplanet_observations(root)


def get_exoplanet_observations(root: Path, *, object_id: str | None = None) -> dict:
    root = root.resolve()
    if object_id is not None and not re.fullmatch(r"exo-[0-9a-f]{20}", object_id):
        raise ValueError("invalid_exoplanet_observation_object_id")
    raw = (root / MANIFEST).read_bytes()
    data = json.loads(raw)
    if data["schema_version"] != "1.0" or data["algorithm_version"] != ALGORITHM:
        raise ValueError("unsupported_exoplanet_observation_manifest")
    dependency = data["confirmed_catalog_dependency"]
    if dependency["path"] != "data/manifests/exoplanets.json":
        raise ValueError("exoplanet_observation_dependency_changed")
    archive_raw = (root / dependency["path"]).read_bytes()
    if len(archive_raw) != dependency["bytes"] or _hash(archive_raw) != dependency["sha256"]:
        raise ValueError("exoplanet_observation_dependency_changed")
    catalog = {
        planet_id(record["pl_name"]): record for record in json.loads(archive_raw)["records"]
    }
    if object_id is not None and object_id not in catalog:
        raise ValueError("unknown_exoplanet_observation_object_id")
    expected_sources = {
        spec["source_key"]: {"url": spec["page_url"], "facts": _public_spec(spec)}
        for spec in SPECIFICATIONS
    } | EXTRA_SOURCES
    if set(data["sources"]) != set(expected_sources) or len(data["observations"]) != len(
        SPECIFICATIONS
    ):
        raise ValueError("exoplanet_observation_source_set_changed")
    for key, source in data["sources"].items():
        _safe_url(source["url"])
        content = _safe_path(
            root, source["local_relative_path"], REFERENCE_ROOT + "/facts"
        ).read_bytes()
        if len(content) != source["bytes"] or _hash(content) != source["sha256"]:
            raise ValueError("exoplanet_observation_source_integrity_failed")
        snap = json.loads(content)
        if (
            source["source_id"] != key
            or source["url"] != expected_sources[key]["url"]
            or snap["source_url"] != source["url"]
            or snap["facts"] != expected_sources[key]["facts"]
            or snap["upstream_sha256"] != source["upstream_sha256"]
            or snap["upstream_bytes"] != source["upstream_bytes"]
            or source["upstream_original_requirement"] != "optional_not_runtime"
        ):
            raise ValueError("exoplanet_observation_source_claim_changed")
    for item, spec in zip(data["observations"], SPECIFICATIONS, strict=True):
        if any(item[key] != value for key, value in _public_spec(spec).items()):
            raise ValueError("exoplanet_observation_claim_changed")
        if item["kind"] != "processed_direct_imaging" or item["surface_resolved"] is not False:
            raise ValueError("exoplanet_observation_surface_claim_changed")
        if (
            item["image_alt"]
            != spec["title"] + ". Processed telescope signal; planetary surface unresolved."
        ):
            raise ValueError("exoplanet_observation_alt_changed")
        if (
            item["object_id"] not in catalog
            or catalog[item["object_id"]]["pl_name"] != item["planet_name"]
            or catalog[item["object_id"]].get("pl_controv_flag") == 1
        ):
            raise ValueError("exoplanet_observation_catalog_identity_changed")
        if item["source"] != data["sources"][spec["source_key"]] or item["additional_sources"] != [
            data["sources"][key] for key in spec["additional_source_keys"]
        ]:
            raise ValueError("exoplanet_observation_source_changed")
        if item["license"] != {
            "name": "CC BY 4.0",
            "url": LICENSE_URL,
            "source": data["sources"][spec["license_source_key"]],
        }:
            raise ValueError("exoplanet_observation_license_changed")
        path = _safe_path(root, item["local_relative_path"], IMAGE_ROOT)
        expected_path = f"{IMAGE_ROOT}/{spec['observation_id']}.jpg"
        if (
            item["local_relative_path"] != expected_path
            or item["image_url"] != "/observations/exoplanets/" + path.name
        ):
            raise ValueError("exoplanet_observation_asset_path_changed")
        content = path.read_bytes()
        if len(content) != item["bytes"] or _hash(content) != item["sha256"]:
            raise ValueError("exoplanet_observation_image_integrity_failed")
        if jpeg_dimensions(content) != (item["width"], item["height"]):
            raise ValueError("exoplanet_observation_dimensions_changed")
        if (
            item["asset_source"]["url"] != spec["image_source_url"]
            or item["asset_source"]["sha256"] != item["sha256"]
            or item["asset_source"]["bytes"] != item["bytes"]
        ):
            raise ValueError("exoplanet_observation_asset_provenance_changed")
    return data | {
        "observations": [
            item
            for item in data["observations"]
            if object_id is None or item["object_id"] == object_id
        ],
        "object_filter": object_id,
        "source_manifest_sha256": _hash(raw),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    result = acquire(args.root)
    print(
        json.dumps(
            {
                "images": len(result["observations"]),
                "sources": len(result["sources"]),
                "bytes": sum(item["bytes"] for item in result["observations"]),
            }
        )
    )
