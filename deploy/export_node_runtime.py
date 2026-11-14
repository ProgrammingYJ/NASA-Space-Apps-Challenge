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
from datetime import UTC, datetime
from importlib.metadata import version
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from api.storage import canonical, digest

SCHEMA_VERSION = "1.0"
ALGORITHM_VERSION = "python-built-node-snapshot-v1"
RUNTIME_INPUT_IDS = {"S01", "S02", "S10", "S12", "S14", "L051", "L046", "L047"}
ACTIVE_MANIFESTS = (
    "datasets.json",
    "solar_system_ephemeris.json",
    "pluto_ephemeris.json",
    "solar_system_orbits.json",
    "timeline_validation.json",
    "appearance.json",
    "small_body_appearance.json",
    "planet_criteria.json",
    "mass_scenarios.json",
    "extended_solar.json",
    "long_term_model.json",
    "long_term_validation.json",
    "object_names.json",
    "kuiper_display.json",
    "planet_nine_scope.json",
    "outer_tno.json",
    "display_dependency_compatibility.json",
)
CORE_OBJECTS = [
    {"object_id": "pluto", "name": "Pluto", "status": "available"},
    {"object_id": "epsilon-indi-b", "name": "\u03b5 Indi B", "status": "available"},
    {"object_id": "barnards-star", "name": "Barnard's Star", "status": "unverified"},
    {"object_id": "wise0855", "name": "WISE0855", "status": "unverified"},
    {"object_id": "rw-aurigae", "name": "RW Aurigae", "status": "unverified"},
    {"object_id": "r-draconis", "name": "R Draconis", "status": "unverified"},
]


def file_digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def _sources(root: Path) -> list[dict]:
    """Collect only the adopted Solar/P9 source closure.

    Original acquisition manifests remain byte-identical historical inventories;
    only the selected four observations, two calibrations and P9 population are
    executable inputs. Excluded feature files stay outside the active closure.
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
            if origin == "datasets.json" and "id" in value:
                if value["id"] not in RUNTIME_INPUT_IDS:
                    return
                required = True
            for key, hash_key in path_keys.items():
                path = value.get(key)
                if isinstance(path, str) and path.startswith(("data/", "web/")):
                    local_only = key == "upstream_original_local_only" or (
                        origin == "planet_nine_scope.json"
                        and value.get("required_on_server") is False
                        and path.startswith("data/reference/planet-nine/upstream/")
                    )
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

    for name in ACTIVE_MANIFESTS:
        path = root / "data/manifests" / name
        add(path.relative_to(root).as_posix(), True, "canonical_scientific_manifest")
        walk(json.loads(path.read_bytes()), path.name)
    # Include source sidecars for adopted files, with their same required/optional role.
    for relative, record in list(records.items()):
        path = root / relative
        sidecar = path.with_suffix(path.suffix + ".source.json")
        if sidecar.is_file():
            add(sidecar.relative_to(root).as_posix(), record["runtime_required"], "source_sidecar")
    for path in sorted((root / "web/public").rglob("*")):
        if path.is_file() and path.relative_to(root / "web/public").parts[0] in {
            "textures",
            "brand",
        }:
            add(path.relative_to(root).as_posix(), True, "published_static_asset_or_metadata")
    add("data/reference/outer-tno/r029-r031-20261115/jpl-tno-identity-bulk.json", True, "selected_TNO_exact_identity_facts")
    add("data/reference/outer-tno/r029-r031-20261115/jpl-tno-identity-bulk.source.json", True, "selected_TNO_identity_provenance")
    add("data/reference/outer-tno/r029-r031-20261115/audit-index.json", False, "MCP_metadata_audit_not_new_observations")
    add("contracts/openapi.json", True, "Node_strict_input_validation_schema")
    add("contracts/planet-nine.schema.json", True, "Planet_Nine_hypothesis_contract")
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

    from science.appearance import get_appearance
    from science.extended_solar import CATALOG_PARENTS, get_extended_solar
    from science.kuiper import get_kuiper_display
    from science.long_term_model import get_long_term_model, sample_long_term
    from science.mass_scenarios import get_mass_scenarios
    from science.orbits import get_orbits
    from science.planet_criteria import get_planet_criteria
    from science.pluto import build_pluto_comparison, list_pluto_observations
    from science.small_body_appearance import get_small_body_appearance
    from science.solar_system import DEFAULT_EPOCH
    from science.spherex import build_comparison, list_observations
    from science.timeline import get_timeline, sample_timeline

    def solar_scene(epoch=DEFAULT_EPOCH):
        value = sample_timeline(root, epoch)
        orbits = get_orbits(root, value["guide_reference_epoch"])
        value.update(
            source_manifest_sha256=file_digest(root / "data/manifests/solar_system_ephemeris.json"),
            orbit_manifest_sha256=orbits["source_manifest_sha256"],
            orbit_algorithm_version=orbits["algorithm_version"],
            orbit_exclusions=orbits["exclusions"],
        )
        for body in value["objects"]:
            if body["object_id"] in orbits["orbits"]:
                body["orbit"] = orbits["orbits"][body["object_id"]]
        return value

    def emit_snapshot(key, value, endpoint, query=None):
        relative = "snapshots/" + key + ".json"
        emit(relative, value)
        snapshots[key] = relative
        routes[key] = {"method": "GET", "path": endpoint, "query": query or {}}
        print("snapshot", key, flush=True)
        return value

    def extended_snapshot(parent_id=None):
        value = get_extended_solar(root, parent_id=parent_id, include_vectors=parent_id is not None)
        return {
            **value,
            "source_manifest_sha256": file_digest(root / "data/manifests/extended_solar.json"),
            "display_algorithm_version": "extended-solar-parent-hermite-v1",
        }

    getters = {
        "objects": (lambda: {"objects": CORE_OBJECTS}, "/api/v1/objects"),
        "universe": (solar_scene, "/api/v1/universe"),
        "timeline": (lambda: get_timeline(root), "/api/v1/timeline"),
        "appearance": (lambda: get_appearance(root), "/api/v1/appearance"),
        "small_body_appearance": (
            lambda: get_small_body_appearance(root),
            "/api/v1/small-body-appearance",
        ),
        "planet_criteria": (lambda: get_planet_criteria(root), "/api/v1/planet-criteria"),
        "mass_scenarios": (lambda: get_mass_scenarios(root), "/api/v1/mass-scenarios"),
        "long_term_model": (lambda: get_long_term_model(root), "/api/v1/long-term-model"),
        "kuiper_belt": (lambda: get_kuiper_display(root), "/api/v1/kuiper-belt"),
        "solar_system": (
            lambda: extended_snapshot(),
            "/api/v1/catalog/solar-system",
        ),
    }
    for key, (getter, endpoint) in getters.items():
        emit_snapshot(key, getter(), endpoint)
    for parent in CATALOG_PARENTS:
        emit_snapshot(
            "solar_parent_" + parent,
            extended_snapshot(parent),
            "/api/v1/catalog/solar-system",
            {"parent_id": parent},
        )

    parity = {"universe": [], "long_term": []}
    for epoch in [
        "2026-11-13T00:00:00Z",
        "2026-11-13T12:00:00Z",
        "2026-11-14T00:00:00Z",
        "2026-11-14T06:30:45Z",
        "2026-11-15T12:00:00Z",
        "2026-11-16T00:00:00Z",
    ]:
        parity["universe"].append({"request": {"epoch": epoch}, "response": solar_scene(epoch)})
    for query in [
        {"year": -2999},
        {"year": -1, "month": 12, "day": 31, "hour": 23.5},
        {"year": 0, "month": 2, "day": 29},
        {"year": 1582, "month": 10, "day": 10},
        {"year": 2000},
        {"year": 2026, "month": 11, "day": 14, "hour": 12.25},
        {"year": 3000},
    ]:
        # Public API defaults are January 1, while the lower-level reader's
        # defaults are November 14. Preserve the API contract in parity cases.
        parameters = {"month": 1, "day": 1, "hour": 0, **query}
        parity["long_term"].append({"request": query, "response": sample_long_term(root, **parameters)})
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

    legacy_ids = {
        "barnards-star": range(1, 7),
        "wise0855": range(23, 27),
        "rw-aurigae": [*range(13, 19), *range(27, 30)],
        "r-draconis": range(7, 13),
    }
    inventory = json.loads((root / "data/manifests/datasets.json").read_bytes())["files"]
    for obj in CORE_OBJECTS:
        identifier = obj["object_id"]
        if identifier in {"pluto", "epsilon-indi-b"}:
            reader = list_pluto_observations if identifier == "pluto" else list_observations
            value = {
                "object_id": identifier,
                "observations": reader(root),
                "status": "available",
                "next_cursor": None,
            }
        else:
            ids = {f"L{number:03d}" for number in legacy_ids[identifier]}
            value = {
                "object_id": identifier,
                "observations": [],
                "status": "unverified",
                "reason": "legacy_quality_not_validated",
                "available_sources": [
                    {
                        key: record.get(key)
                        for key in ("id", "source_url", "sha256", "bytes", "planned_use")
                    }
                    for record in inventory
                    if record["id"] in ids
                ],
                "next_cursor": None,
            }
        emit_snapshot(
            "observations_" + identifier, value, "/api/v1/observations", {"object_id": identifier}
        )

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
        "public_scope": "solar_system_1000au",
        "scope_migration_policy": "solar-scope-context-v1",
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
        },
        "verification": {
            "source_files_before_after_match": True,
            "generated_files_sha_verified": True,
            "fresh_comparison_calculations": 4,
            "comparison_full_canonical_sha_verified": True,
            "active_manifest_allowlist": list(ACTIVE_MANIFESTS),
            "excluded_feature_snapshots": False,
        },
        "limitations": [
            "This is a build-time result cache. Node comparison requests verify original source and exported-file hashes, then retrieve a fixed precomputed result; they do not run Astropy/FITS analysis on demand.",
            "Only the existing S01/S02 and S12/S14 pair selections, either order, are available for comparison. No arbitrary coordinates, new exposures, alternative mask/cutout sizes or unsupported quantitative measurements are fabricated.",
            "Null fields, scientific statuses, source provenance and all original calculation limitations remain unchanged. A successful cache lookup is not a new observation, discovery, or validated motion measurement.",
            "Runtime formulas for time interpolation, long-term approximations and mass hypotheses require separate JavaScript implementation/parity validation. Exported Python samples are reference cases, not whole-domain proof.",
            "Only adopted Solar/P9 source files are in this active dependency closure. Historical acquisition metadata is preserved without requiring excluded feature files. Required source records must remain byte-identical; a matching declared dist asset may substitute for its public copy.",
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
