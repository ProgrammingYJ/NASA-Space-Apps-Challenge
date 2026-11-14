"""Sourced main Kuiper Belt bounds and separate illustrative renderer choices."""

from __future__ import annotations

import hashlib
import html
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from urllib.request import urlopen

MANIFEST = "data/manifests/kuiper_display.json"
RAW = "data/reference/kuiper/nasa_kuiper_facts.html"
SOURCE_URL = "https://science.nasa.gov/solar-system/kuiper-belt/facts/"
VERSION = "kuiper-region-v1"


def acquire(root: Path) -> dict:
    root = Path(root)
    if (root / MANIFEST).exists() or (root / RAW).exists():
        raise FileExistsError("kuiper_source_or_manifest_exists")
    with urlopen(SOURCE_URL, timeout=30) as response:
        raw = response.read(2_000_001)
        resolved_url = response.url
    if len(raw) > 2_000_000:
        raise ValueError("kuiper_source_too_large")
    text = " ".join(html.unescape(re.sub(r"<[^>]*>", " ", raw.decode("utf-8"))).split())
    if not all(value in text for value in ("about 30 AU", "around 50 AU", "1,000 AU")):
        raise ValueError("kuiper_source_bounds_changed")
    source = {
        "url": SOURCE_URL,
        "resolved_url": resolved_url,
        "label": "NASA: Kuiper Belt Facts, Size and Distance",
        "local_relative_path": RAW,
        "bytes": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "retrieved_utc": datetime.now(UTC).isoformat(),
    }
    path = root / RAW
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as stream:
        stream.write(raw)
    path.with_suffix(".html.source.json").write_text(
        json.dumps(source, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    manifest = {
        "schema_version": "1.0",
        "algorithm_version": VERSION,
        "display_version": VERSION,
        "created_utc": datetime.now(UTC).isoformat(),
        "range_au": [30, 50],
        "center": "sun",
        "range_kind": "approximate_inner_main_Kuiper_region_not_all_trans_Neptunian_space",
        "source": source,
        "separate_scattered_disk_reference": {
            "outer_reach_au_approximately": 1000,
            "rendered_by_this_annulus": False,
        },
        "renderer_assumptions": {
            "representation": "seeded_explanatory_annulus",
            "seed": 1949030,
            "point_count": 650,
            "height_range_au": [-0.6, 0.6],
            "points_are_catalog_objects": False,
            "distribution_is_measured_density": False,
            "height_is_measured_thickness": False,
        },
        "limitations": [
            "NASA's approximately 30–50 AU bounds describe the inner/main region; the scattered disk and detached populations extend beyond it.",
            "650 seeded points, vertical height ±0.6 AU, planar geometry, colors, opacity and display compression are explanatory choices, not observed objects, population counts, density, orbital inclinations or measured thickness.",
            "Actual known objects use their own separate ephemeris/catalog records; a seeded point must not be selected as an observed KBO or counted as an independent observation.",
            "Visibility on/off changes only the explanatory layer; it does not alter physical membership, actual observations, catalog positions or scientific judgments.",
            "No evolution over billions of years, orbit determination or existence/detection probability is inferred from this annulus.",
        ],
    }
    target = root / MANIFEST
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(manifest, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
    return manifest


def get_kuiper_display(root: Path) -> dict:
    """Read the immutable local source and metadata without network access."""
    root = Path(root).resolve()
    raw_manifest = (root / MANIFEST).read_bytes()
    manifest = json.loads(raw_manifest)
    if (
        manifest.get("schema_version") != "1.0"
        or manifest.get("algorithm_version") != VERSION
        or manifest.get("display_version") != VERSION
        or manifest.get("range_au") != [30, 50]
    ):
        raise ValueError("unsupported_kuiper_schema")
    source = manifest["source"]
    path = (root / source["local_relative_path"]).resolve()
    if (
        source["url"] != SOURCE_URL
        or not path.is_relative_to(root / "data/reference/kuiper")
        or not path.is_file()
    ):
        raise ValueError("kuiper_source_missing_or_outside_root")
    raw = path.read_bytes()
    if len(raw) != source["bytes"] or hashlib.sha256(raw).hexdigest() != source["sha256"]:
        raise ValueError("kuiper_source_integrity")
    manifest["source_manifest_sha256"] = hashlib.sha256(raw_manifest).hexdigest()
    return manifest


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--acquire", action="store_true")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    result = acquire(args.root) if args.acquire else get_kuiper_display(args.root)
    print(json.dumps({"range_au": result["range_au"], "version": result["display_version"]}))
