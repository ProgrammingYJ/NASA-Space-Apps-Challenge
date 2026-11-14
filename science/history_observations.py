"""Five preserved observation-image cases with published approximate cosmic ages.

This reader supplies neither synthetic galaxies nor an interpolated universe.
Images are unchanged published observation products, not raw detector exposures.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from urllib.request import Request, urlopen

from science.appearance import image_dimensions
from science.history_morphology import SOURCES as MORPHOLOGY_SOURCES

MANIFEST = "data/manifests/cosmic_observations.json"
RAW_ROOT = "data/reference/cosmic-observations"
IMAGE_ROOT = "web/public/observations/cosmic"
ALGORITHM = "cosmic-observation-viewer-v1"
POLICIES = {
    "nasa_media_policy": (
        "https://www.nasa.gov/nasa-brand-center/images-and-media/",
        "NASA Images and Media Usage Guidelines",
    ),
    "esawebb_media_policy": (
        "https://esawebb.org/copyright/",
        "ESA/Webb image, video and text usage conditions",
    ),
    "eso_media_policy": (
        "https://www.eso.org/public/outreach/copyright/",
        "ESO image, video and text usage conditions",
    ),
    "cosmic_gems_image_page": (
        "https://esawebb.org/images/weic2418c/",
        "ESA/Webb: Cosmic Gems observation collage and credit",
    ),
    "zs7_image_page": (
        "https://esawebb.org/images/weic2413b/",
        "ESA/Webb: ZS7 NIRCam observation collage and credit",
    ),
    "rebels25_image_page": (
        "https://www.eso.org/public/images/eso2415b/",
        "ESO/ALMA: REBELS-25 gas intensity and velocity collage",
    ),
}
CASES = [
    {
        "id": "cosmic_gems_clusters",
        "name": "Cosmic Gems arc (SPT0615-JD1)",
        "source_id": "esa_cosmic_gems",
        "approx_age_gyr": 0.46,
        "sample_age_range_gyr": None,
        "age_scope": "Published approximate cosmic age of the observed system, not its star-cluster age",
        "filename": "cosmic-gems-weic2418c.jpg",
        "image_source_url": "https://cdn.esawebb.org/archives/images/screen/weic2418c.jpg",
        "image_page_id": "cosmic_gems_image_page",
        "image_page_url": "https://esawebb.org/images/weic2418c/",
        "instrument": "JWST/NIRCam",
        "credit": "ESA/Webb, NASA & CSA, L. Bradley (STScI), A. Adamo (Stockholm University) and the Cosmic Spring collaboration",
        "policy_id": "esawebb_media_policy",
        "caption": "Observed JWST field and enlarged Cosmic Gems region. Compact star clusters are resolved through strong gravitational lensing.",
        "processing": [
            "Published near-infrared observation composite with inset, assigned display colors and source-side image processing.",
            "Strong foreground lensing magnifies and stretches the light. The close-up contains two distinct lensed galaxies; the arcs are not intrinsic three-dimensional galaxy outlines.",
        ],
        "limitations": [
            "Five clusters in this specific observation are not five separate galaxies or a universal cluster count.",
            "The published approximate cosmic age is not a precise model-independent timestamp.",
        ],
    },
    {
        "id": "firefly_sparkle_assembly",
        "name": "Firefly Sparkle and companions",
        "source_id": "nasa_firefly_sparkle",
        "approx_age_gyr": 0.6,
        "sample_age_range_gyr": None,
        "age_scope": "Published approximate cosmic age of the observed galaxy",
        "filename": "firefly-sparkle-nircam.png",
        "image_source_url": "https://assets.science.nasa.gov/dynamicimage/assets/science/missions/webb/science/2024/12/STScI-01J4A44SME50MYJ4QVW1AWQW5V.png?w=900&h=448&fit=clip",
        "image_page_id": None,
        "image_page_url": "https://science.nasa.gov/missions/webb/found-first-actively-forming-galaxy-as-lightweight-as-young-milky-way/",
        "instrument": "JWST/NIRCam",
        "credit": "NASA, ESA, CSA, STScI, Chris Willott (National Research Council Canada), Lamiya Mowla (Wellesley College), Kartheik Iyer (Columbia University)",
        "policy_id": "nasa_media_policy",
        "caption": "Actual NIRCam observation with an enlarged, labelled Firefly Sparkle region and two nearby companions.",
        "processing": [
            "Published near-infrared color composite, field/inset layout and annotations; light is strongly magnified and distorted by foreground gravitational lensing.",
            "This is the observation image, not the separate artist's reconstruction shown elsewhere in the article.",
        ],
        "limitations": [
            "The lensed line of luminous clusters is not an unmodified intrinsic galaxy outline.",
            "Nearby companions do not specify a measured future merger trajectory or final morphology.",
        ],
    },
    {
        "id": "ceers_projected_shapes",
        "name": "CEERS projected galaxy-shape examples",
        "source_id": "nasa_ceers_shapes",
        "approx_age_gyr": None,
        "sample_age_range_gyr": [0.6, 6.0],
        "age_scope": "Published broad cosmic-age range of the study sample; the six pictured cutouts are not assigned one shared or individually resolved age here",
        "filename": "ceers-observed-shape-cutouts.png",
        "image_source_url": "https://assets.science.nasa.gov/dynamicimage/assets/science/missions/webb/science/2024/01/STScI-01HHZ8T813KV44MSB91ZGM102C.png?w=900&h=600&fit=clip",
        "image_page_id": None,
        "image_page_url": "https://science.nasa.gov/missions/webb/webb-shows-many-early-galaxies-looked-like-pool-noodles-surfboards/",
        "instrument": "JWST/NIRCam",
        "credit": "NASA, ESA, CSA, STScI, Steve Finkelstein (UT Austin), Micaela Bagley (UT Austin), Rebecca Larson (UT Austin)",
        "policy_id": "nasa_media_policy",
        "caption": "Six actual CEERS galaxy cutouts, grouped by their observed elongated, disk-like and spherical projected appearances.",
        "processing": [
            "Published near-infrared color-image cutouts arranged and labelled by the source team.",
            "These are observation cutouts, not the separate four-shape three-dimensional illustration in the source article.",
        ],
        "limitations": [
            "The 0.6 to 6 Gyr range belongs to the study sample; it is not one cosmic epoch for the entire collage.",
            "Apparent two-dimensional shape is distinct from inferred intrinsic three-dimensional geometry.",
            "No frequency, fraction or evolution probability is calculated from these six display examples.",
        ],
    },
    {
        "id": "rebels25_rotating_disc",
        "name": "REBELS-25 gas distribution and motion",
        "source_id": "eso_rebels25",
        "approx_age_gyr": 0.7,
        "sample_age_range_gyr": None,
        "age_scope": "Published approximate cosmic age of the observed rotating-disc system",
        "filename": "rebels25-alma-gas-velocity.jpg",
        "image_source_url": "https://cdn.eso.org/images/large/eso2415b.jpg",
        "image_page_id": "rebels25_image_page",
        "image_page_url": "https://www.eso.org/public/images/eso2415b/",
        "instrument": "ALMA",
        "credit": "ALMA (ESO/NAOJ/NRAO)/L. Rowland et al.",
        "policy_id": "eso_media_policy",
        "caption": "Actual ALMA maps: gas distribution at left and line-of-sight gas motion at right, supporting a strongly rotating early disc.",
        "processing": [
            "Published side-by-side scientific data maps with assigned colors; the right panel is a velocity map, not natural-color starlight.",
            "Blue and red in the velocity map encode motion toward and away from the observer.",
        ],
        "limitations": [
            "This is not a visible-light photograph or a resolved stellar surface map.",
            "A central bar and spiral arms were tentative hints in the release, not adopted confirmed structures.",
        ],
    },
    {
        "id": "zs7_ongoing_merger",
        "name": "ZS7 galaxy merger system",
        "source_id": "esa_zs7_merger",
        "approx_age_gyr": 0.74,
        "sample_age_range_gyr": None,
        "age_scope": "Published approximate cosmic age of the observed interacting system",
        "filename": "zs7-primer-nircam.jpg",
        "image_source_url": "https://cdn.esawebb.org/archives/images/screen/weic2413b.jpg",
        "image_page_id": "zs7_image_page",
        "image_page_url": "https://esawebb.org/images/weic2413b/",
        "instrument": "JWST/NIRCam; interpretation also uses NIRSpec spectroscopy",
        "credit": "ESA/Webb, NASA, CSA, J. Dunlop, D. Magee, P. G. P\u00e9rez-Gonz\u00e1lez, H. \u00dcbler, R. Maiolino, et. al",
        "policy_id": "esawebb_media_policy",
        "caption": "Actual NIRCam field and zoom sequence locating ZS7, a system with evidence for an ongoing galaxy merger.",
        "processing": [
            "Published observed-image zoom collage. The close-up uses orange and dark red to display emission associated with ionized hydrogen and oxygen.",
            "The merger interpretation combines imaging with NIRSpec spectral evidence; shape alone is insufficient.",
        ],
        "limitations": [
            "No completed black-hole coalescence or gravitational-wave event is directly imaged here.",
            "The image is not a time sequence, reconstructed orbit, or simulated past trajectory.",
        ],
    },
]
LIMITATIONS = [
    "Only five published observational cases are displayed. No synthetic galaxy population, coordinates, growth animation or interpolated past sky is supplied.",
    "Cosmic ages are source-published approximate interpretations of the epoch when the light was emitted; they are not camera capture dates, galaxy ages or exact model-independent timestamps.",
    "CEERS has a study-sample age range, not a single epoch or independently adopted age for every displayed cutout.",
    "Images are published processed observation products, including color mapping, annotations, collages, lensing or scientific data maps; they are not raw detector exposures or natural-color views.",
    "A case's cosmic age refers to its target system or explicitly stated sample; other foreground and background objects in a field collage do not share that age.",
    "The historical chronology and conceptual morphology references remain preserved separately and do not create additional observed cases.",
    "Selecting a case changes the displayed observation and its published context; it does not generate an image at an arbitrary requested epoch.",
]


def _fetch(
    root: Path, url: str, path: Path, label: str, limit: int, sidecar: Path | None = None
) -> dict:
    sidecar = sidecar or path.with_name(path.name + ".source.json")
    if path.exists() or sidecar.exists():
        raw = path.read_bytes()
        value = json.loads(sidecar.read_bytes())
        if (
            value["url"] != url
            or value["bytes"] != len(raw)
            or value["sha256"] != hashlib.sha256(raw).hexdigest()
        ):
            raise ValueError("existing_cosmic_observation_source_changed")
        return value
    request = Request(url, headers={"User-Agent": "SpaceApps-observed-case-provenance/0.5"})
    with urlopen(request, timeout=45) as response:
        raw = response.read(limit + 1)
        resolved_url = response.url
    if len(raw) > limit:
        raise ValueError("cosmic_observation_source_too_large")
    path.parent.mkdir(parents=True, exist_ok=True)
    value = {
        "url": url,
        "resolved_url": resolved_url,
        "label": label,
        "local_relative_path": path.relative_to(root).as_posix(),
        "bytes": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "retrieved_utc": datetime.now(UTC).isoformat(),
    }
    path.write_bytes(raw)
    sidecar.parent.mkdir(parents=True, exist_ok=True)
    sidecar.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return value


def acquire(root: Path) -> dict:
    """Explicit allowlisted acquisition, preserving existing source/manifest bytes."""
    root = Path(root).resolve()
    prior = json.loads((root / "data/manifests/cosmic_morphology.json").read_bytes())
    sources = {case["source_id"]: prior["sources"][case["source_id"]] for case in CASES}
    for key, (url, label) in POLICIES.items():
        path = root / RAW_ROOT / (key + ".html")
        source = _fetch(root, url, path, label, 2_000_000)
        source["local_relative_path"] = path.relative_to(root).as_posix()
        sources[key] = source
    objects = []
    for specification in CASES:
        spec = dict(specification)
        path = root / IMAGE_ROOT / spec.pop("filename")
        original = _fetch(
            root,
            spec.pop("image_source_url"),
            path,
            spec["name"] + " published observation",
            8_000_000,
            root / RAW_ROOT / (path.name + ".source.json"),
        )
        page_id = spec.pop("image_page_id")
        page_source = sources[page_id] if page_id else sources[spec["source_id"]]
        policy_id = spec.pop("policy_id")
        is_nasa = policy_id == "nasa_media_policy"
        spec["source"] = sources[spec["source_id"]]
        spec["image"] = {
            "url": "/observations/cosmic/" + path.name,
            "local_path": path.relative_to(root).as_posix(),
            "source_url": original["url"],
            "resolved_source_url": original["resolved_url"],
            "sha256": original["sha256"],
            "bytes": original["bytes"],
            "retrieved_utc": original["retrieved_utc"],
            "pixel_dimensions": list(image_dimensions(path.read_bytes())),
            "kind": "published_observation_composite",
            "artist_concept": False,
            "bytes_modified_locally": False,
            "image_page_source": page_source,
            "credit": spec.pop("credit"),
            "processing": spec.pop("processing"),
            "license": {
                "label": "NASA Images and Media Usage Guidelines (educational/informational use)"
                if is_nasa
                else "Creative Commons Attribution 4.0 International",
                "spdx_id": None if is_nasa else "CC-BY-4.0",
                "url": sources[policy_id]["url"],
                "policy_source": sources[policy_id],
                "no_asset_specific_copyright_restriction_observed": True,
                "requirements": [
                    "Show the complete source credit clearly beside the image and retain active source links.",
                    "Do not imply institutional endorsement; institutional logos are not licensed by these image terms.",
                    "Published file bytes are unchanged locally; source-side color mapping, layout and annotations are disclosed.",
                ],
            },
        }
        objects.append(spec)
    manifest = {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM,
        "created_utc": datetime.now(UTC).isoformat(),
        "age_unit": "published_approximate_Gyr_since_hot_Big_Bang",
        "age_interpolation_available": False,
        "objects": objects,
        "sources": sources,
        "reference_reuse": {
            "immutable_article_root": "data/reference/cosmic-morphology",
            "reused_article_count": 5,
            "new_image_and_usage_document_root": RAW_ROOT,
            "old_chronology_and_morphology_manifests_modified": False,
        },
        "limitations": LIMITATIONS,
    }
    path = root / MANIFEST
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    os.replace(temporary, path)
    return get_cosmic_observations(root)


def get_cosmic_observations(root: Path) -> dict:
    """Verify local article, usage-policy and image bytes; no runtime network."""
    root = Path(root).resolve()
    raw_manifest = (root / MANIFEST).read_bytes()
    manifest = json.loads(raw_manifest)
    if manifest.get("schema_version") != "1.0" or manifest.get("algorithm_version") != ALGORITHM:
        raise ValueError("unsupported_cosmic_observation_version")
    expected_source_urls = {key: value[0] for key, value in POLICIES.items()} | {
        case["source_id"]: MORPHOLOGY_SOURCES[case["source_id"]][0] for case in CASES
    }
    if set(manifest["sources"]) != set(expected_source_urls):
        raise ValueError("cosmic_observation_reference_missing")
    for key, source in manifest["sources"].items():
        path = (root / source["local_relative_path"]).resolve()
        if source["url"] != expected_source_urls[key] or not any(
            path.is_relative_to(root / prefix)
            for prefix in [RAW_ROOT, "data/reference/cosmic-morphology"]
        ):
            raise ValueError("cosmic_observation_reference_path_invalid")
        raw = path.read_bytes()
        if len(raw) != source["bytes"] or hashlib.sha256(raw).hexdigest() != source["sha256"]:
            raise ValueError("cosmic_observation_reference_integrity")
    objects = manifest["objects"]
    if {v["id"] for v in objects} != {v["id"] for v in CASES} or len(objects) != 5:
        raise ValueError("cosmic_observation_case_invalid")
    expected = {case["id"]: case for case in CASES}
    for case in objects:
        spec = expected[case["id"]]
        if (
            case["approx_age_gyr"] != spec["approx_age_gyr"]
            or case["sample_age_range_gyr"] != spec["sample_age_range_gyr"]
        ):
            raise ValueError("cosmic_observation_age_changed")
        if case["source"] != manifest["sources"].get(case["source_id"]):
            raise ValueError("cosmic_observation_case_source_invalid")
        image = case["image"]
        path = (root / image["local_path"]).resolve()
        if (
            not path.is_relative_to(root / IMAGE_ROOT)
            or path.name != spec["filename"]
            or image["url"] != "/observations/cosmic/" + path.name
        ):
            raise ValueError("cosmic_observation_image_path_invalid")
        raw = path.read_bytes()
        if (
            image["source_url"] != spec["image_source_url"]
            or len(raw) != image["bytes"]
            or hashlib.sha256(raw).hexdigest() != image["sha256"]
        ):
            raise ValueError("cosmic_observation_image_integrity")
        if (
            list(image_dimensions(raw)) != image["pixel_dimensions"]
            or image["kind"] != "published_observation_composite"
            or image["artist_concept"]
            or image["bytes_modified_locally"]
        ):
            raise ValueError("cosmic_observation_image_kind_invalid")
        page_key = spec["image_page_id"] or spec["source_id"]
        if (
            image["credit"] != spec["credit"]
            or image["license"]["policy_source"] != manifest["sources"][spec["policy_id"]]
            or image["image_page_source"] != manifest["sources"][page_key]
        ):
            raise ValueError("cosmic_observation_image_credit_invalid")
    manifest["source_manifest_sha256"] = hashlib.sha256(raw_manifest).hexdigest()
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--acquire", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    value = acquire(root) if args.acquire else get_cosmic_observations(root)
    print(json.dumps({"objects": len(value["objects"]), "sha256": value["source_manifest_sha256"]}))
