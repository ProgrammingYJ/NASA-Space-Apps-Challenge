"""Offline, source-backed morphology examples for a conceptual cosmic scene.

These are heterogeneous observed examples, not a population synthesis, a set of
evolution tracks, or a measured age-to-morphology probability distribution.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from datetime import UTC, datetime
from pathlib import Path
from urllib.request import Request, urlopen

MANIFEST = "data/manifests/cosmic_morphology.json"
RAW_ROOT = "data/reference/cosmic-morphology"
ALGORITHM = "cosmic-morphology-reference-v1"
SOURCES = {
    "nasa_galaxies_over_time": (
        "https://science.nasa.gov/mission/webb/galaxies-over-time/",
        "NASA Webb: Galaxies Over Time",
    ),
    "nasa_ceers_shapes": (
        "https://science.nasa.gov/missions/webb/webb-shows-many-early-galaxies-looked-like-pool-noodles-surfboards/",
        "NASA Webb: CEERS distant-galaxy shape diversity (2024)",
    ),
    "esa_cosmic_gems": (
        "https://esawebb.org/news/weic2418/",
        "ESA/Webb: Star clusters in the Cosmic Gems arc (2024)",
    ),
    "nasa_firefly_sparkle": (
        "https://science.nasa.gov/missions/webb/found-first-actively-forming-galaxy-as-lightweight-as-young-milky-way/",
        "NASA Webb: Firefly Sparkle and companions (2024)",
    ),
    "eso_rebels25": (
        "https://www.eso.org/public/news/eso2415/",
        "ESO/ALMA: REBELS-25 rotating disc (2024)",
    ),
    "esa_zs7_merger": (
        "https://esawebb.org/news/weic2413/",
        "ESA/Webb: ZS7 ongoing galaxy merger evidence (2024)",
    ),
}
FAMILIES = {
    "clumpy",
    "compact",
    "small_disk",
    "disturbed_pair",
    "diffuse_irregular",
    "elongated",
    "disk",
    "spheroid",
    "irregular",
    "disturbed",
}
IMAGE_REVIEW = {
    "reviewed_at_utc": "2026-11-14T06:04:54+00:00",
    "scope": "Five published observation collages directly inspected; not only article alt text. Temporary review copies are not application assets.",
    "observations": [
        {
            "source_id": "nasa_ceers_shapes",
            "url": "https://assets.science.nasa.gov/dynamicimage/assets/science/missions/webb/science/2024/01/STScI-01HHZ8T813KV44MSB91ZGM102C.png?w=900&h=600&fit=clip",
            "credit": "NASA, ESA, CSA, STScI, Steve Finkelstein, Micaela Bagley, Rebecca Larson",
            "kind": "JWST NIRCam observed cutouts; projected appearances and sample ages differ",
        },
        {
            "source_id": "esa_cosmic_gems",
            "url": "https://esawebb.org/media/archives/images/medium/weic2418c.jpg",
            "credit": "ESA/Webb, NASA & CSA, L. Bradley, A. Adamo and the Cosmic Spring collaboration",
            "kind": "Lensed observation collage; stretched/mirrored light does not imply an intrinsic arc",
        },
        {
            "source_id": "nasa_firefly_sparkle",
            "url": "https://assets.science.nasa.gov/dynamicimage/assets/science/missions/webb/science/2024/12/STScI-01J4A44SME50MYJ4QVW1AWQW5V.png?w=900&h=448&fit=clip",
            "credit": "NASA, ESA, CSA, STScI, Chris Willott, Lamiya Mowla, Kartheik Iyer",
            "kind": "Actual lensed NIRCam observation with companions; not the separate artist concept",
        },
        {
            "source_id": "eso_rebels25",
            "url": "https://cdn.eso.org/images/large/eso2415b.jpg",
            "credit": "ALMA (ESO/NAOJ/NRAO)/L. Rowland et al.",
            "kind": "Gas emission and line-of-sight velocity map; not a visible-light stellar map",
        },
        {
            "source_id": "esa_zs7_merger",
            "url": "https://esawebb.org/media/archives/images/medium/weic2413b.jpg",
            "credit": "ESA/Webb, NASA, CSA, J. Dunlop and collaborators; individual image-page credits apply",
            "kind": "NIRCam observation zoom sequence; merger interpretation also uses NIRSpec spectroscopy, not shape alone",
        },
    ],
}
LIMITATIONS = [
    "Observed examples illustrate diversity; they are not a census or an age-dependent morphology fraction.",
    "A source's approximate observation age is not a first-appearance date, a universal transition, or the age of every galaxy in an illustrative scene.",
    "The scene's 35 nodes, seeds, family assignments, colors, sizes and individual morph timings are display assumptions, not measured objects or evolutionary tracks.",
    "Projected light, observing wavelength, resolution and gravitational lensing affect observed shapes; a lensed arc is not the intrinsic shape of a galaxy.",
    "Early rotating discs exist; REBELS-25's proposed bar and spiral arms require further confirmation and are not adopted as measured structures.",
    "Nearby spirals, spheroids, irregular and interacting galaxies coexist; no single final shape or deterministic evolution is prescribed.",
    "Original chronology stages, current catalog coordinates, JPL model time and SPHEREx observations remain unchanged.",
    "Reference observation pages are linked; the renderer is a conceptual code illustration, not a copied observation or a reconstruction of the past sky.",
]


def _examples(sources: dict) -> list[dict]:
    examples = [
        {
            "id": "cosmic_gems_clusters",
            "name": "Cosmic Gems arc (SPT0615-JD1)",
            "approx_age_gyr": 0.46,
            "sample_age_range_gyr": None,
            "age_scope": "Approximate cosmic age of this strongly lensed observed system",
            "source_id": "esa_cosmic_gems",
            "observed_features": [
                "Dense, compact star-forming clusters are resolved inside a young galaxy.",
                "The observed chain and mirrored image are altered by strong gravitational lensing.",
            ],
            "visual_families": ["clumpy", "compact"],
            "image_reference": "https://esawebb.org/images/weic2418c/",
            "limitations": [
                "The five detected clusters are specific to this observation, not a required number in each conceptual galaxy.",
                "Do not render the stretched arc or mirrored copies as the intrinsic galaxy structure.",
            ],
        },
        {
            "id": "firefly_sparkle_assembly",
            "name": "Firefly Sparkle and companions",
            "approx_age_gyr": 0.6,
            "sample_age_range_gyr": None,
            "age_scope": "Approximate cosmic age of the observed galaxy",
            "source_id": "nasa_firefly_sparkle",
            "observed_features": [
                "Compact luminous star clusters lie within diffuse, asymmetric galactic light.",
                "Nearby companions may influence later assembly; the eventual shape cannot be predicted from this example.",
            ],
            "visual_families": ["clumpy", "compact", "diffuse_irregular"],
            "image_reference": "https://science.nasa.gov/missions/webb/found-first-actively-forming-galaxy-as-lightweight-as-young-milky-way/",
            "limitations": [
                "The lensed observation and the separately labelled artist reconstruction are distinct products.",
                "Companions are observed; a merger trajectory, tidal distortion and deterministic future morphology are not measured here.",
            ],
        },
        {
            "id": "ceers_projected_shapes",
            "name": "CEERS observed projected shape examples",
            "approx_age_gyr": None,
            "sample_age_range_gyr": [0.6, 6.0],
            "age_scope": "Broad cosmic-age range of the study sample, not an individual age for every pictured object",
            "source_id": "nasa_ceers_shapes",
            "observed_features": [
                "Elongated, flattened, disk-like and compact spherical appearances occur within the study sample.",
                "Apparent two-dimensional shape and model-inferred three-dimensional geometry are different quantities.",
            ],
            "visual_families": ["elongated", "compact", "small_disk", "spheroid"],
            "image_reference": "https://science.nasa.gov/missions/webb/webb-shows-many-early-galaxies-looked-like-pool-noodles-surfboards/",
            "limitations": [
                "Published sample fractions are not used as scene family probabilities or universal population fractions.",
                "The sample range does not date the beginning of disk or spheroid formation.",
            ],
        },
        {
            "id": "rebels25_rotating_disc",
            "name": "REBELS-25",
            "approx_age_gyr": 0.7,
            "sample_age_range_gyr": None,
            "age_scope": "Approximate cosmic age of this observed rotating-disc example",
            "source_id": "eso_rebels25",
            "observed_features": [
                "ALMA gas kinematics establish an early strongly rotating disc.",
                "Suggested bar and spiral structure are tentative and require more observations.",
            ],
            "visual_families": ["small_disk"],
            "image_reference": "https://www.eso.org/public/images/eso2415b/",
            "limitations": [
                "A gas intensity/velocity map is not an optical stellar surface map.",
                "The conceptual early disc has no source-claimed measured bar or grand-design spiral arms.",
                "This exceptional observed system does not establish that all galaxies have orderly discs at this age.",
            ],
        },
        {
            "id": "zs7_ongoing_merger",
            "name": "ZS7 galaxy merger system",
            "approx_age_gyr": 0.74,
            "sample_age_range_gyr": None,
            "age_scope": "Approximate cosmic age of this observed interacting system",
            "source_id": "esa_zs7_merger",
            "observed_features": [
                "JWST imaging and spectroscopy provide evidence for an ongoing merger of two galaxies hosting massive black holes.",
                "The system provides an early example of assembly through galaxy interactions.",
            ],
            "visual_families": ["disturbed_pair", "disturbed"],
            "image_reference": "https://esawebb.org/images/weic2413b/",
            "limitations": [
                "The scene's pair separation, tidal geometry and motion are illustrative, not fits to this system.",
                "This is evidence for ongoing galaxy assembly, not a direct observation of completed black-hole coalescence or gravitational waves.",
            ],
        },
        {
            "id": "later_coexisting_morphologies",
            "name": "Later galaxy assembly and coexisting forms",
            "approx_age_gyr": None,
            "sample_age_range_gyr": None,
            "age_scope": "Broad qualitative evolution context, not a dated transition or exclusive late-time population",
            "source_id": "nasa_galaxies_over_time",
            "observed_features": [
                "Modern spiral and elliptical systems developed through varied assembly histories.",
                "Irregular, clumpy and interacting systems continue to exist; merging and assembly also occur today.",
            ],
            "visual_families": ["disk", "spheroid", "irregular", "disturbed"],
            "image_reference": "https://science.nasa.gov/mission/webb/galaxies-over-time/",
            "limitations": [
                "Later conceptual families overlap rather than all replacing early forms on one date.",
                "No present-day catalog galaxy is identified as the future descendant of a scene node.",
            ],
        },
    ]
    for example in examples:
        example["source"] = sources[example["source_id"]]
    return examples


def acquire(root: Path) -> dict:
    """Explicit acquisition only; normal certificate/hostname validation retained."""
    root = Path(root).resolve()
    directory = root / RAW_ROOT
    directory.mkdir(parents=True, exist_ok=True)
    sources = {}
    for key, (url, label) in SOURCES.items():
        path = directory / (key + ".html")
        sidecar = directory / (key + ".source.json")
        if path.exists() or sidecar.exists():
            record = json.loads(sidecar.read_bytes())
            raw = path.read_bytes()
            if record["url"] != url or record["sha256"] != hashlib.sha256(raw).hexdigest():
                raise ValueError("existing_cosmic_morphology_source_changed")
        else:
            request = Request(url, headers={"User-Agent": "SpaceApps-source-provenance/0.5"})
            with urlopen(request, timeout=45) as response:
                raw = response.read(2_000_001)
                resolved_url = response.url
            if len(raw) > 2_000_000 or b"<html" not in raw.lower():
                raise ValueError("cosmic_morphology_source_invalid")
            record = {
                "url": url,
                "resolved_url": resolved_url,
                "label": label,
                "local_relative_path": path.relative_to(root).as_posix(),
                "bytes": len(raw),
                "sha256": hashlib.sha256(raw).hexdigest(),
                "retrieved_utc": datetime.now(UTC).isoformat(),
            }
            path.write_bytes(raw)
            sidecar.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
        sources[key] = record
    manifest = {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM,
        "created_utc": datetime.now(UTC).isoformat(),
        "age_unit": "Gyr_since_hot_Big_Bang",
        "reference_age_gyr": 13.8,
        "examples": _examples(sources),
        "sources": sources,
        "image_review": IMAGE_REVIEW,
        "visual_policy": {
            "scene_population_is_observed": False,
            "morphology_fractions_available": False,
            "transition_times_are_display_assumptions": True,
            "all_nodes_share_one_evolution_track": False,
            "source_age_is_first_appearance_date": False,
            "early_disc_example_age_gyr": 0.7,
            "early_disc_bar_and_arms_confirmed": False,
            "early_disk_display_before_example": "Not adopted by this conservative visual guide; this is not a physical exclusion at earlier ages.",
            "chronology_stage_ids_and_ages_unchanged": True,
            "observed_images_copied_into_app_assets": False,
        },
        "limitations": LIMITATIONS,
    }
    target = root / MANIFEST
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, target)
    return get_history_morphology(root)


def get_history_morphology(root: Path) -> dict:
    """Read local validated references. This function never accesses the network."""
    root = Path(root).resolve()
    raw_manifest = (root / MANIFEST).read_bytes()
    manifest = json.loads(raw_manifest)
    if manifest.get("schema_version") != "1.0" or manifest.get("algorithm_version") != ALGORITHM:
        raise ValueError("unsupported_cosmic_morphology_version")
    if set(manifest["sources"]) != set(SOURCES):
        raise ValueError("cosmic_morphology_sources_missing")
    for key, source in manifest["sources"].items():
        path = (root / source["local_relative_path"]).resolve()
        if source["url"] != SOURCES[key][0] or not path.is_relative_to(root / RAW_ROOT):
            raise ValueError("cosmic_morphology_source_not_allowlisted")
        raw = path.read_bytes()
        if len(raw) != source["bytes"] or hashlib.sha256(raw).hexdigest() != source["sha256"]:
            raise ValueError("cosmic_morphology_source_integrity")
    examples = manifest["examples"]
    if len(examples) != 6 or len({example["id"] for example in examples}) != 6:
        raise ValueError("cosmic_morphology_examples_invalid")
    for example in examples:
        if example["source"] != manifest["sources"].get(example["source_id"]):
            raise ValueError("cosmic_morphology_example_source_mismatch")
        if not set(example["visual_families"]) <= FAMILIES:
            raise ValueError("cosmic_morphology_family_invalid")
        ages = [example["approx_age_gyr"]] if example["approx_age_gyr"] is not None else []
        span = example["sample_age_range_gyr"]
        if span is not None:
            if len(span) != 2 or span[0] > span[1]:
                raise ValueError("cosmic_morphology_age_invalid")
            ages += span
        if any(
            not isinstance(a, (int, float)) or not math.isfinite(a) or not 0 <= a <= 13.8
            for a in ages
        ):
            raise ValueError("cosmic_morphology_age_invalid")
    manifest["source_manifest_sha256"] = hashlib.sha256(raw_manifest).hexdigest()
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--acquire", action="store_true")
    args = parser.parse_args()
    repository = Path(__file__).resolve().parents[1]
    result = acquire(repository) if args.acquire else get_history_morphology(repository)
    print(
        json.dumps(
            {"examples": len(result["examples"]), "sha256": result["source_manifest_sha256"]}
        )
    )
