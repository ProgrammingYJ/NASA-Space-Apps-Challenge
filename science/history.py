"""Source-backed cosmic chronology, never a measured spatial reconstruction.

Only ``acquire`` accesses the network. Readers verify immutable local sources.
Some milestones use an explicitly editorial display anchor within a sourced era;
their selection must not be interpreted as a sharp, simultaneous cosmic boundary.
"""

from __future__ import annotations

import hashlib
import html
import json
import math
import re
from datetime import UTC, datetime
from pathlib import Path
from urllib.request import urlopen

MANIFEST = "data/manifests/cosmic_history.json"
RAW_ROOT = "data/reference/history"
ALGORITHM = "cosmic-chronology-v1"
REFERENCE_AGE_GYR = 13.8
SOURCES = {
    "nasa_early_universe": {
        "url": "https://science.nasa.gov/mission/webb/early-universe/",
        "label": "NASA Webb: Early Universe",
        "checks": ["13.8", "280 million"],
    },
    "esa_cosmic_eras": {
        "url": "https://www.esa.int/articles/about-us/directorates/science/cosmic-eras",
        "label": "ESA: Cosmic eras (2024-12-24)",
        "checks": ["380 000", "200 million", "two to three billion"],
    },
    "nasa_first_stars": {
        "url": "https://science.nasa.gov/mission/webb/science-overview/science-explainers/what-were-the-first-stars-like/",
        "label": "NASA Webb: What Were the First Stars Like?",
        "checks": ["100 million", "not sure exactly"],
    },
    "nasa_solar_system": {
        "url": "https://science.nasa.gov/solar-system/solar-system-facts/",
        "label": "NASA: Solar System Facts",
        "checks": ["4.6 billion"],
    },
}
LIMITATIONS = [
    "A conceptual chronology, not a measured spatial reconstruction, N-body simulation or map of ancient star/galaxy positions.",
    "Gyr means one billion years since the hot Big Bang; lookback is 13.8 minus age using an approximate present-age reference.",
    "Milestone anchors and broad era spans are approximate educational values, not confidence intervals, sharp global boundaries or probability estimates.",
    "Display-anchor selection identifies the most recent illustrative milestone; it does not assert that an era began or ended everywhere at that instant.",
    "Current catalog positions, the bounded 2026 solar ephemeris and original SPHEREx/TESS images are separate and must remain unchanged.",
    "No resolved first-star surface, original cosmic image, physical scene scale, individual trajectory or existence probability is synthesized by this dataset.",
]


def _plain(document: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]*>", " ", document)).split())


def _stage(stage_id, age, source_id, timing, *, span=None, notes=()):
    return {
        "stage_id": stage_id,
        "label_key": "history.stage." + stage_id,
        "age_gyr": age,
        "lookback_gyr": round(REFERENCE_AGE_GYR - age, 12),
        "age_range_gyr": span,
        "range_kind": "broad_sourced_era_or_bracket_not_confidence_interval" if span else None,
        "timing_status": timing,
        "source_id": source_id,
        "limitations": list(notes),
        "spatial_representation": "conceptual_illustration_only",
    }


def acquire(root: Path) -> dict:
    """Acquire allowlisted small official documents and create a new manifest."""
    root = Path(root)
    if (root / MANIFEST).exists():
        raise FileExistsError("cosmic_history_manifest_exists")
    sources = {}
    for key, specification in SOURCES.items():
        relative = f"{RAW_ROOT}/{key}.html"
        path = root / relative
        metadata = path.with_suffix(".html.source.json")
        if path.exists():
            source = json.loads(metadata.read_text(encoding="utf-8"))
            raw = path.read_bytes()
            if (
                source["url"] != specification["url"]
                or hashlib.sha256(raw).hexdigest() != source["sha256"]
            ):
                raise ValueError("cosmic_history_immutable_source_conflict")
        else:
            with urlopen(specification["url"], timeout=30) as response:
                raw = response.read(2_000_001)
                final_url = response.url
            if len(raw) > 2_000_000:
                raise ValueError("cosmic_history_source_too_large")
            source = {
                "url": specification["url"],
                "resolved_url": final_url,
                "label": specification["label"],
                "local_relative_path": relative,
                "sha256": hashlib.sha256(raw).hexdigest(),
                "bytes": len(raw),
                "retrieved_utc": datetime.now(UTC).isoformat(),
            }
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("xb") as stream:
                stream.write(raw)
            metadata.write_text(json.dumps(source, indent=2) + "\n", encoding="utf-8", newline="\n")
        text = _plain(raw.decode("utf-8"))
        if not all(check in text for check in specification["checks"]):
            raise ValueError("cosmic_history_source_content_changed:" + key)
        sources[key] = source
    stages = [
        _stage(
            "hot_big_bang",
            0.0,
            "nasa_early_universe",
            "reference_origin_not_observed_instant",
            notes=[
                "The zero of this chronology is the hot Big Bang, not a claim about before inflation or a resolved view of time zero."
            ],
        ),
        _stage(
            "recombination",
            0.00038,
            "esa_cosmic_eras",
            "approximate_milestone",
            notes=[
                "About 380,000 years; transparency/CMB milestone, not a sharply measured universal transition time."
            ],
        ),
        _stage(
            "dark_ages",
            0.01,
            "esa_cosmic_eras",
            "editorial_anchor_within_sourced_era",
            span=[0.00038, 0.2],
            notes=[
                "10 million years is a display anchor inside the broad dark era, not its onset or duration measurement."
            ],
        ),
        _stage(
            "first_stars",
            0.1,
            "nasa_first_stars",
            "theoretical_earliest_approximation_exact_time_unknown",
            span=[0.1, 0.3],
            notes=[
                "100 million years is a theoretical early estimate. The 0.1–0.3 Gyr bracket combines this with NASA's observed-galaxy-before-300-Myr context; it is not a fitted uncertainty or a universal onset."
            ],
        ),
        _stage(
            "early_galaxies",
            0.28,
            "nasa_early_universe",
            "observed_early_galaxy_example_not_first_formation_time",
            notes=[
                "NASA describes MoM-z14 at about 280 million years; this example does not date the first galaxy's birth or assert a current earliest-record holder."
            ],
        ),
        _stage(
            "reionization",
            0.5,
            "esa_cosmic_eras",
            "editorial_anchor_within_sourced_era",
            span=[0.2, 1.0],
            notes=[
                "0.5 Gyr is a representative display anchor within the roughly 0.2–1 Gyr extended process; not a completion date."
            ],
        ),
        _stage(
            "galaxy_growth",
            1.0,
            "esa_cosmic_eras",
            "editorial_post_reionization_anchor",
            notes=[
                "A broad post-reionization galaxy-growth context, not a separate instantaneous event."
            ],
        ),
        _stage(
            "cosmic_noon",
            2.5,
            "esa_cosmic_eras",
            "editorial_anchor_within_sourced_era",
            span=[2.0, 3.0],
            notes=[
                "2.5 Gyr represents the broad star-formation peak era; different populations need not peak simultaneously."
            ],
        ),
        _stage(
            "solar_system",
            9.2,
            "nasa_solar_system",
            "derived_from_two_rounded_approximate_ages",
            notes=[
                "Approximate cosmic age 13.8 minus approximate Solar System age 4.6 gives 9.2 Gyr; not an absolute formation timestamp or ancient planetary ephemeris."
            ],
        ),
        _stage(
            "present",
            REFERENCE_AGE_GYR,
            "nasa_early_universe",
            "rounded_approximate_reference_age",
            notes=[
                "13.8 Gyr is the adopted rounded present-age reference; no new cosmological-parameter fit is performed."
            ],
        ),
    ]
    for stage in stages:
        stage["source"] = sources[stage["source_id"]]
        if stage["stage_id"] == "first_stars":
            stage["additional_sources"] = [sources["nasa_early_universe"]]
    manifest = {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM,
        "created_utc": datetime.now(UTC).isoformat(),
        "reference_age_gyr": REFERENCE_AGE_GYR,
        "reference_age_is_approximate": True,
        "reference_age_source": sources["nasa_early_universe"],
        "age_range_gyr": [0, REFERENCE_AGE_GYR],
        "age_unit": "Gyr_since_hot_Big_Bang",
        "selection_rule": "latest_display_milestone_at_or_before_age_not_a_sharp_physical_era_boundary",
        "stages": stages,
        "sources": sources,
        "limitations": LIMITATIONS,
        "source_conflicts": [
            {
                "source_ids": ["esa_cosmic_eras", "nasa_early_universe"],
                "issue": "ESA's introduction uses the older rounded 13.7 Gyr, while NASA states approximately 13.8 Gyr.",
                "adopted": "13.8 Gyr rounded NASA reference; source text is preserved unchanged.",
            },
            {
                "source_ids": ["nasa_early_universe", "esa_cosmic_eras"],
                "issue": "NASA's single educational page mentions both 380,000 years and a 240,000–300,000-year recombination range in separate sections.",
                "adopted": "Approximate 380,000-year transparency/CMB milestone from ESA; no source claim is silently edited into agreement.",
            },
        ],
    }
    target = root / MANIFEST
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(manifest, stream, indent=2, ensure_ascii=False, allow_nan=False)
        stream.write("\n")
    return manifest


def get_cosmic_history(root: Path) -> dict:
    """Read source-verified local chronology; never access the network."""
    root = Path(root).resolve()
    path = root / MANIFEST
    raw_manifest = path.read_bytes()
    manifest = json.loads(raw_manifest)
    if manifest.get("schema_version") != "1.0" or manifest.get("algorithm_version") != ALGORITHM:
        raise ValueError("unsupported_cosmic_history_schema")
    if manifest.get("reference_age_gyr") != REFERENCE_AGE_GYR or manifest.get("age_range_gyr") != [
        0,
        REFERENCE_AGE_GYR,
    ]:
        raise ValueError("unsupported_cosmic_reference_age")
    for key, source in manifest["sources"].items():
        if key not in SOURCES or source["url"] != SOURCES[key]["url"]:
            raise ValueError("unsupported_cosmic_source")
        source_path = (root / source["local_relative_path"]).resolve()
        if not source_path.is_relative_to(root / RAW_ROOT) or not source_path.is_file():
            raise ValueError("cosmic_source_missing_or_outside_root")
        raw = source_path.read_bytes()
        if len(raw) != source["bytes"] or hashlib.sha256(raw).hexdigest() != source["sha256"]:
            raise ValueError("cosmic_source_integrity")
    ages = [stage["age_gyr"] for stage in manifest["stages"]]
    if ages != sorted(set(ages)) or ages[0] != 0 or ages[-1] != REFERENCE_AGE_GYR:
        raise ValueError("cosmic_milestone_order")
    for stage in manifest["stages"]:
        if stage["source"] != manifest["sources"][stage["source_id"]] or stage[
            "lookback_gyr"
        ] != round(REFERENCE_AGE_GYR - stage["age_gyr"], 12):
            raise ValueError("cosmic_stage_source_or_age_mismatch")
    manifest["source_manifest_sha256"] = hashlib.sha256(raw_manifest).hexdigest()
    return manifest


def sample_history(root: Path, age_gyr: float) -> dict:
    """Select an illustrative milestone in the bounded, approximate chronology."""
    if (
        isinstance(age_gyr, bool)
        or not isinstance(age_gyr, (int, float))
        or not math.isfinite(age_gyr)
        or not 0 <= age_gyr <= REFERENCE_AGE_GYR
    ):
        raise ValueError("cosmic_age_outside_range")
    history = get_cosmic_history(root)
    stage = next(stage for stage in reversed(history["stages"]) if age_gyr >= stage["age_gyr"])
    return {
        **stage,
        "stage_anchor_age_gyr": stage["age_gyr"],
        "age_gyr": age_gyr,
        "lookback_gyr": round(REFERENCE_AGE_GYR - age_gyr, 12),
        "reference_age_gyr": REFERENCE_AGE_GYR,
        "algorithm_version": ALGORITHM,
        "source_manifest_sha256": history["source_manifest_sha256"],
        "limitations": [*LIMITATIONS, *stage["limitations"]],
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--acquire", action="store_true")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    result = acquire(args.root) if args.acquire else get_cosmic_history(args.root)
    print(
        json.dumps(
            {
                "stages": len(result["stages"]),
                "sources": len(result["sources"]),
                "reference_age_gyr": result["reference_age_gyr"],
            }
        )
    )
