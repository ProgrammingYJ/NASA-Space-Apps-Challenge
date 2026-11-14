"""Build source-bound JSON for a Node-only host; Python is build-time only.

This exporter runs the existing scientific readers and FITS calculations. It
never downloads, edits source manifests, copies an old comparison cache, or
turns an unverified legacy target into a valid measurement. The exported FITS
comparison cache supports exactly the current two observation pairs, in both
orders, with the existing fixed 81-pixel request behavior.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import uuid
from collections import defaultdict
from datetime import UTC, datetime
from importlib.metadata import version
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from api.storage import canonical, digest

SCHEMA_VERSION = "1.0"
ALGORITHM_VERSION = "python-built-node-snapshot-v1"
RUNTIME_INPUT_IDS = {"S01", "S02", "S10", "S12", "S14", "L051"}


def file_digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def _sources(root: Path) -> list[dict]:
    """Collect a deduplicated dependency closure, preserving optional originals.

    A local-only paper is optional unless another original reader independently
    requires that same file. The original six active FITS are mandatory; the
    remaining acquisition inventory is recorded as held, not executable input.
    Public assets may be verified against their identical dist serving copy.
    """
    records: dict[str, dict] = {}

    def add(path: str, required: bool, reason: str, expected=None, size=None):
        if not path.startswith(
            ("data/", "web/", "contracts/", "science/", "api/", "deploy/", "worker/")
        ):
            return
        if path.startswith("data/node-runtime/"):
            return
        candidate = (root / path).resolve()
        if not candidate.is_relative_to(root) or not candidate.is_file():
            raise ValueError("export_source_missing_or_unsafe:" + path)
        if path not in records:
            records[path] = {
                "path": path,
                "bytes": candidate.stat().st_size,
                "sha256": file_digest(candidate),
                "runtime_required": required,
                "roles": [reason],
            }
        else:
            records[path]["runtime_required"] |= required
            if reason not in records[path]["roles"]:
                records[path]["roles"].append(reason)
        record = records[path]
        if expected and expected != record["sha256"]:
            raise ValueError("export_source_sha_mismatch:" + path)
        if size is not None and size != record["bytes"]:
            raise ValueError("export_source_bytes_mismatch:" + path)
        if path.startswith("web/public/"):
            serving = "web/dist/" + path.removeprefix("web/public/")
            if (root / serving).is_file():
                if file_digest(root / serving) != record["sha256"]:
                    raise ValueError("export_public_serving_copy_mismatch:" + path)
                record["serving_copy_path"] = serving

    path_keys = {
        "local_relative_path": "sha256",
        "local_path": "sha256",
        "relative_path": "sha256",
        "path": "sha256",
        "catalog_path": "catalog_sha256",
        "helper_path": "helper_sha256",
        "upstream_original_local_only": "upstream_sha256",
    }

    def walk(value, origin: str, inherited_required: bool = True):
        if isinstance(value, dict):
            required = inherited_required
            if origin in {"datasets.json", "drive_sources.json"} and "id" in value:
                required = value["id"] in RUNTIME_INPUT_IDS
            for key, hash_key in path_keys.items():
                path = value.get(key)
                if isinstance(path, str) and path.startswith(("data/", "web/")):
                    local_only = key == "upstream_original_local_only"
                    add(
                        path,
                        required and not local_only,
                        "local_reference_only" if local_only else "manifest_reference:" + origin,
                        value.get(hash_key),
                        value.get("upstream_bytes")
                        if local_only
                        else None
                        if key in {"catalog_path", "helper_path"}
                        else value.get("bytes"),
                    )
            for child in value.values():
                walk(child, origin, required)
        elif isinstance(value, list):
            for child in value:
                walk(child, origin, inherited_required)

    for path in sorted((root / "data/manifests").glob("*.json")):
        if path.name == "node_runtime.json":
            continue  # The derived export manifest must not hash itself or an older export.
        required = path.name not in {"drive_sources.json", "solar_system_source_candidates.json"}
        add(
            path.relative_to(root).as_posix(),
            required,
            "canonical_scientific_manifest"
            if required
            else "held_acquisition_or_candidate_bookkeeping",
        )
        walk(json.loads(path.read_bytes()), path.name, required)
    # Include source sidecars for adopted files, with their same required/optional role.
    for relative, record in list(records.items()):
        path = root / relative
        sidecar = path.with_suffix(path.suffix + ".source.json")
        if sidecar.is_file():
            add(sidecar.relative_to(root).as_posix(), record["runtime_required"], "source_sidecar")
    for path in sorted((root / "web/public").rglob("*")):
        if path.is_file():
            add(path.relative_to(root).as_posix(), True, "published_static_asset_or_metadata")
    add("contracts/openapi.json", True, "Node_strict_input_validation_schema")
    for path in [
        *sorted((root / "science").glob("*.py")),
        root / "api/models.py",
        root / "api/storage.py",
        root / "api/main.py",
        root / "worker/process.py",
        root / "deploy/export_node_runtime.py",
    ]:
        add(path.relative_to(root).as_posix(), False, "build_algorithm_source_not_Node_dependency")
    return [records[key] for key in sorted(records)]


def verify_export(root: Path) -> dict:
    """Offline strong verification, also usable from an extracted release folder."""
    root = root.resolve()
    directory = root / "data/node-runtime"
    raw = (directory / "runtime_manifest.json").read_bytes()
    manifest = json.loads(raw)
    if (
        manifest.get("schema_version") != SCHEMA_VERSION
        or manifest.get("algorithm_version") != ALGORITHM_VERSION
    ):
        raise ValueError("unsupported_node_export_schema")
    canonical_copy = root / "data/manifests/node_runtime.json"
    if canonical_copy.read_bytes() != raw:
        raise ValueError("node_export_canonical_copy_mismatch")
    paths = [record["path"] for record in manifest["files"]]
    if len(set(paths)) != len(paths):
        raise ValueError("node_export_duplicate_generated_path")
    for record in manifest["files"]:
        path = (directory / record["path"]).resolve()
        if not path.is_relative_to(directory) or not path.is_file():
            raise ValueError("node_export_generated_path_missing_or_unsafe")
        raw_file = path.read_bytes()
        if (
            len(raw_file) != record["bytes"]
            or hashlib.sha256(raw_file).hexdigest() != record["sha256"]
            or canonical(json.loads(raw_file)) != raw_file
        ):
            raise ValueError("node_export_generated_integrity_or_canonical_error")
    checked = 0
    missing_optional = 0
    for record in manifest["source_files"]:
        if (
            record["path"].startswith("data/node-runtime/")
            or record["path"] == "data/manifests/node_runtime.json"
        ):
            raise ValueError("node_export_self_dependency")
        path = (root / record["path"]).resolve()
        if not path.is_relative_to(root):
            raise ValueError("node_export_source_path_unsafe")
        if not path.is_file() and record.get("serving_copy_path"):
            path = (root / record["serving_copy_path"]).resolve()
        if not path.is_relative_to(root):
            raise ValueError("node_export_source_path_unsafe")
        if not path.is_file():
            if record["runtime_required"]:
                raise ValueError("node_export_required_source_missing:" + record["path"])
            missing_optional += 1
            continue
        if path.stat().st_size != record["bytes"] or file_digest(path) != record["sha256"]:
            raise ValueError("node_export_source_integrity:" + record["path"])
        checked += 1
    for key, record in manifest["comparisons"].items():
        value = json.loads((directory / record["path"]).read_bytes())
        content = {name: item for name, item in value.items() if name != "result_id"}
        if (
            digest(content) != record["content_sha256"]
            or digest(value) != record["comparison_sha256"]
            or value["result_id"] != record["result_id"]
            or value["result_id"] != "cmp_" + digest(content)[:24]
            or key != ",".join(frame["observation_id"] for frame in value["frames"])
        ):
            raise ValueError("node_export_comparison_identity_or_order_mismatch")
    return {
        "manifest_sha256": hashlib.sha256(raw).hexdigest(),
        "generated_files_verified": len(paths),
        "source_files_verified": checked,
        "optional_sources_not_deployed": missing_optional,
        "comparison_canonical_hashes_verified": len(manifest["comparisons"]),
    }


def export(root: Path) -> dict:
    root = root.resolve()
    started = datetime.now(UTC).isoformat()
    started_clock = time.monotonic()
    source_files = _sources(root)
    print("source inventory verified", len(source_files), flush=True)
    staging = (root / "var/node-runtime-builds" / uuid.uuid4().hex).resolve()
    if not staging.is_relative_to(root):
        raise ValueError("export_staging_outside_workspace")
    staging.mkdir(parents=True)
    files = []
    snapshots = {}
    routes = {}
    comparisons = {}

    def emit(relative: str, value) -> dict:
        path = staging / relative
        if not path.resolve().is_relative_to(staging):
            raise ValueError("export_output_path_unsafe")
        raw = canonical(value)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("xb") as stream:
            stream.write(raw)
        record = {
            "path": relative,
            "local_relative_path": "data/node-runtime/" + relative,
            "bytes": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest(),
        }
        files.append(record)
        return record

    from fastapi import Request

    import api.main as api_main
    from science.exoplanets import load_catalog, object_id, planet
    from science.extended_solar import CATALOG_PARENTS
    from science.pluto import build_pluto_comparison, list_pluto_observations
    from science.spherex import build_comparison, list_observations
    from science.universe_catalog import MILKY_WAY, host_id

    api_main.ROOT = root
    app = api_main.create_app()
    endpoints = {route.path: route.endpoint for route in app.routes if hasattr(route, "endpoint")}

    def get(key: str, path: str, **query):
        value = endpoints[path](**query)
        relative = "snapshots/" + key + ".json"
        emit(relative, value)
        snapshots[key] = relative
        routes[key] = {"method": "GET", "path": path, "query": query}
        return value

    fixed = {
        "objects": "/api/v1/objects",
        "universe": "/api/v1/universe",
        "timeline": "/api/v1/timeline",
        "appearance": "/api/v1/appearance",
        "small_body_appearance": "/api/v1/small-body-appearance",
        "planet_criteria": "/api/v1/planet-criteria",
        "mass_scenarios": "/api/v1/mass-scenarios",
        "black_holes": "/api/v1/black-holes",
        "observer_physics": "/api/v1/observer-physics",
        "cosmic_history": "/api/v1/cosmic-history",
        "cosmic_observations": "/api/v1/cosmic-observations",
        "long_term_model": "/api/v1/long-term-model",
        "galaxies": "/api/v1/catalog/galaxies",
        "kuiper_belt": "/api/v1/kuiper-belt",
        "solar_system": "/api/v1/catalog/solar-system",
        "exoplanets": "/api/v1/catalog/exoplanets",
        "universe_catalog": "/api/v1/catalog/universe",
        "exoplanet_observations": "/api/v1/catalog/exoplanet-observations",
        "extragalactic_planets": "/api/v1/catalog/extragalactic-planets",
    }
    values = {}
    for key, path in fixed.items():
        values[key] = get(key, path)
        print("snapshot", key, flush=True)
    for parent in CATALOG_PARENTS:
        get("solar_parent_" + parent, fixed["solar_system"], parent_id=parent)
    universe = values["universe_catalog"]
    for galaxy in universe["galaxy_ids"]:
        values["universe_catalog_galaxy_" + galaxy] = get(
            "universe_catalog_galaxy_" + galaxy, fixed["universe_catalog"], galaxy_id=galaxy
        )
    for parent in [
        "solar-system",
        *universe["galaxy_ids"],
        *(obj["object_id"] for obj in universe["objects"] if obj["object_id"] != "solar-system"),
    ]:
        get("universe_catalog_parent_" + parent, fixed["universe_catalog"], parent_id=parent)

    catalog = load_catalog(root)
    grouped = defaultdict(list)
    for row in catalog["records"]:
        grouped[row["hostname"]].append(row)
    details = {}
    children = {}
    for hostname, rows in grouped.items():
        subset = {**catalog, "records": rows}
        parent = host_id(hostname)
        children[parent] = []
        for row in rows:
            identifier = object_id(row["pl_name"])
            details[identifier] = planet(subset, identifier)
            children[parent].append(
                {
                    "object_id": identifier,
                    "name": row["pl_name"],
                    "kind": "exoplanet",
                    "parent_id": parent,
                    "galaxy_id": MILKY_WAY,
                    "existing_object_id": identifier,
                    "coordinate": None,
                    "distance_pc": None,
                    "position_kind": "existing_catalog_reference",
                    "source": {
                        "url": row.get("nasa", {}).get("url") or catalog["url"],
                        "label": "NASA Science planet catalog",
                    },
                    "catalog_reference": {"catalog": "existing_exoplanets", "hostname": hostname},
                    "image": None,
                    "appearance": None,
                    "limitations": [
                        "Planet selection opens the existing catalog system. No independently resolved planet sky direction or measured surface is supplied."
                    ],
                }
            )
    # The optimization changes only search scope; every host row is retained.
    detail_samples = [next(iter(details)), list(details)[len(details) // 2], list(details)[-1]]
    for identifier in detail_samples:
        if details[identifier] != planet(catalog, identifier):
            raise ValueError("export_planet_projection_parity_failed")
    for parent in list(children)[:2] + list(children)[-1:]:
        actual = endpoints[fixed["universe_catalog"]](parent_id=parent)
        if actual["objects"] != children[parent]:
            raise ValueError("export_host_children_parity_failed")
    for key, value in [("exoplanet_details", details), ("universe_host_children", children)]:
        relative = "snapshots/" + key + ".json"
        emit(relative, value)
        snapshots[key] = relative
    print("exoplanet details and host children", len(details), len(children), flush=True)

    parity = {"universe": [], "long_term": [], "history": []}
    for epoch in [
        "2026-11-13T00:00:00Z",
        "2026-11-13T12:00:00Z",
        "2026-11-14T00:00:00Z",
        "2026-11-14T06:30:45Z",
        "2026-11-15T12:00:00Z",
        "2026-11-16T00:00:00Z",
    ]:
        parity["universe"].append(
            {"request": {"epoch": epoch}, "response": endpoints[fixed["universe"]](epoch=epoch)}
        )
    for query in [
        {"year": -2999},
        {"year": -1, "month": 12, "day": 31, "hour": 23.5},
        {"year": 0, "month": 2, "day": 29},
        {"year": 1582, "month": 10, "day": 10},
        {"year": 2000},
        {"year": 2026, "month": 11, "day": 14, "hour": 12.25},
        {"year": 3000},
    ]:
        parity["long_term"].append(
            {"request": query, "response": endpoints["/api/v1/long-term-simulation"](**query)}
        )
    for age in [0, 0.00038, 0.1, 0.46, 1, 5, 13.8]:
        parity["history"].append(
            {
                "request": {"age_gyr": age},
                "response": endpoints["/api/v1/cosmic-history/sample"](age_gyr=age),
            }
        )
    record = emit("snapshots/python_parity_samples.json", parity)
    snapshots["python_parity_samples"] = record["path"]

    for ids, builder in [
        (["S01", "S02"], build_comparison),
        (["S02", "S01"], build_comparison),
        (["S12", "S14"], build_pluto_comparison),
        (["S14", "S12"], build_pluto_comparison),
    ]:
        print("fresh FITS calculation", ",".join(ids), flush=True)
        result = builder(root, ids, cutout_size=81)
        content_hash = digest(result)
        result["result_id"] = "cmp_" + content_hash[:24]
        record = emit("comparisons/" + "_".join(ids) + ".json", result)
        comparisons[",".join(ids)] = {
            **record,
            "object_id": result["object_id"],
            "observation_ids": ids,
            "cutout_size": 81,
            "result_id": result["result_id"],
            "content_sha256": content_hash,
            "comparison_sha256": digest(result),
            "schema_version": result["schema_version"],
            "algorithm_version": result["algorithm_version"],
            "calculation_origin": "fresh_python_source_FITS_build_not_Node_request_recalculation",
        }
        if record["sha256"] != digest(result):
            raise ValueError("export_comparison_canonical_digest_mismatch")

    app.state.service = SimpleNamespace(
        catalog=list_observations(root),
        pluto_catalog=list_pluto_observations(root),
        catalog_error=False,
        pluto_catalog_error=False,
    )
    request = Request({"type": "http", "app": app})
    observation_ids = [obj["object_id"] for obj in api_main.OBJECTS] + [
        "sun",
        "mercury",
        "venus",
        "earth",
        "mars",
        "jupiter",
        "saturn",
        "uranus",
        "neptune",
    ]
    for object_name in observation_ids:
        get(
            "observations_" + object_name,
            "/api/v1/observations",
            request=request,
            object_id=object_name,
        )
        # Request objects are execution adapters, never serialized into route metadata.
        routes["observations_" + object_name]["query"].pop("request", None)

    # Rehash every original dependency after computation; never publish mixed-source output.
    for record in source_files:
        path = root / record["path"]
        if path.stat().st_size != record["bytes"] or file_digest(path) != record["sha256"]:
            raise ValueError("export_source_changed_during_build:" + record["path"])
    for record in files:
        if file_digest(staging / record["path"]) != record["sha256"]:
            raise ValueError("export_generated_file_integrity")
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "algorithm_version": ALGORITHM_VERSION,
        "export_started_utc": started,
        "exported_utc": datetime.now(UTC).isoformat(),
        "files": files,
        "source_files": source_files,
        "snapshots": snapshots,
        "routes": routes,
        "comparisons": comparisons,
        "runtime_mode": "node_only_with_disclosed_Python_build_calculation_snapshots",
        "software": {
            "python": sys.version.split()[0],
            "astropy": version("astropy"),
            "numpy": version("numpy"),
            "scipy": version("scipy"),
        },
        "selection_contract": {
            "comparison_pairs": [["S01", "S02"], ["S12", "S14"]],
            "comparison_cutout_size": 81,
            "extended_parent_ids": CATALOG_PARENTS,
            "galaxy_ids": universe["galaxy_ids"],
            "universe_host_count": len(children),
            "exoplanet_count": len(details),
            "universe_curated_parent_ids": [
                "solar-system",
                *universe["galaxy_ids"],
                *(
                    obj["object_id"]
                    for obj in universe["objects"]
                    if obj["object_id"] != "solar-system"
                ),
            ],
        },
        "verification": {
            "source_files_before_after_match": True,
            "generated_files_sha_verified": True,
            "fresh_comparison_calculations": 4,
            "comparison_full_canonical_sha_verified": True,
            "planet_optimized_projection_parity_samples": detail_samples,
            "host_children_actual_getter_parity_samples": list(children)[:2] + list(children)[-1:],
        },
        "limitations": [
            "This is a build-time result cache. Node comparison requests verify original source and exported-file hashes, then retrieve a fixed precomputed result; they do not run Astropy/FITS analysis on demand.",
            "Only the existing S01/S02 and S12/S14 pair selections, either order, are available for comparison. No arbitrary coordinates, new exposures, alternative mask/cutout sizes or unsupported quantitative measurements are fabricated.",
            "Null fields, scientific statuses, source provenance and all original calculation limitations remain unchanged. A successful cache lookup is not a new observation, discovery, or validated motion measurement.",
            "Runtime formulas for time interpolation, long-term approximations and mass hypotheses require separate JavaScript implementation/parity validation. Exported Python samples are reference cases, not whole-domain proof.",
            "Local-only upstream documents and held legacy acquisitions are inventoried but optional for Node hosting. Required source records must remain byte-identical; a matching declared dist asset may substitute for its public copy.",
        ],
    }
    (staging / "runtime_manifest.json").write_bytes(canonical(manifest))
    destination = root / "data/node-runtime"
    if destination.resolve() != root / "data/node-runtime":
        raise ValueError("export_destination_unsafe")
    if destination.exists():
        archive = (root / "var/node-runtime-exports" / uuid.uuid4().hex).resolve()
        if not archive.is_relative_to(root):
            raise ValueError("export_archive_outside_workspace")
        archive.parent.mkdir(parents=True, exist_ok=True)
        os.replace(destination, archive)
    os.replace(staging, destination)
    canonical_path = root / "data/manifests/node_runtime.json"
    temporary = canonical_path.with_name(".node_runtime." + uuid.uuid4().hex + ".tmp")
    temporary.write_bytes((destination / "runtime_manifest.json").read_bytes())
    os.replace(temporary, canonical_path)
    independent_check = verify_export(root)
    summary = {
        "directory": str(destination),
        "manifest_bytes": (destination / "runtime_manifest.json").stat().st_size,
        "manifest_sha256": file_digest(destination / "runtime_manifest.json"),
        "generated_files": len(files),
        "generated_bytes": sum(record["bytes"] for record in files),
        "source_files": len(source_files),
        "required_source_files": sum(r["runtime_required"] for r in source_files),
        "comparisons": comparisons,
        "elapsed_seconds": round(time.monotonic() - started_clock, 3),
        "post_publish_strong_verification": independent_check,
    }
    print(json.dumps(summary, ensure_ascii=True, indent=2), flush=True)
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--verify-only", action="store_true")
    arguments = parser.parse_args()
    if arguments.verify_only:
        print(json.dumps(verify_export(arguments.root), indent=2))
    else:
        export(arguments.root)
