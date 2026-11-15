"""Allowlisted release packaging; never includes a live persistent volume."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import tomllib
import zipfile
from datetime import datetime, timedelta, timezone
from importlib import metadata
from pathlib import Path

from packaging.requirements import Requirement
from packaging.utils import canonicalize_name

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = {"fastapi", "uvicorn", "pydantic", "astropy", "numpy", "scipy", "python-dotenv", "psutil"}
LEGACY_DEPLOYMENT_FILES = {"deploy/verify_release.py", "deploy/README.python.md"}
DIRECTORIES = (
    "api",
    "node",
    "data/node-runtime",
    "data/reference/outer-tno/r029-r031-20261115",
    "data/reference/spherex-registry/dev025",
    "data/reference/spherex-extended-20261115",
    "data/reference/mcp/dev025",
    "data/reference/document-fonts",
    "science",
    "worker",
    "contracts",
    "deploy",
    "tests",
    "web/src",
    "web/tests",
    "web/dist",
    "web/public",
)

FILES = (
    "app.js",
    "package.json",
    "package-lock.json",
    "data/manifests/node_runtime.json",
    "data/manifests/data_spec_pdf.json",
    "requirements.pdf.lock.txt",
    "docs/qa/dev025_pdf_verification.json",
    "data/manifests/planet_nine_scope.json",
    "data/manifests/outer_tno.json",
    "data/manifests/display_dependency_compatibility.json",
    "data/reference/outer-tno/r029-r031-20261115/audit-index.json",
    "data/reference/outer-tno/r029-r031-20261115/reference-sources.json",
    "data/reference/outer-tno/r029-r031-20261115/summary.json",
    "deploy/requirements.appearance-validation.lock.txt",
    "data/reference/outer-tno/dev019-interpretation/source.json",
    "data/manifests/mcp_tools.json",
    "data/manifests/representative_appearance.json",
    "data/reference/mcp/dev018/astronomy.json",
    "data/reference/mcp/dev018/pipeworx.json",
    "data/reference/mcp/dev018/pds.json",
    "data/reference/mcp/dev018/direct-jpl-vectors.json",
    "data/reference/mcp/dev018/direct-comparison.json",
    "data/reference/mcp/dev018/native-pds.json",
    "data/reference/mcp/dev018/native-astronomy.json",
    "data/reference/mcp/dev018/native-horizons.json",
    "tools/mcp/package.json",
    "tools/mcp/package-lock.json",
    "tools/mcp/requirements.windows.lock.txt",
    "tools/mcp/smoke.py",
    "docs/reviews/2026-11-15_mcp_review.md",
    "docs/reviews/2026-11-15_planet-nine_sources.md",
    "data/reference/legacy_public_originals/planet_nine_reference/overview_map.pro",
    "data/raw/legacy_public_originals/planet_nine_reference/reference_population.csv",
    "data/reference/legacy_public_originals/planet_nine_reference/README.TXT",
    "docs/decisions/ADR-004.md",
    "README.md",
    "TODO.md",
    "FSD.md",
    "Data_Spec.md",
    "AGENTS.md",
    "SKILLS.md",
    "START_HERE_PROMPT.md",
    "THIRD_PARTY_NOTICES.md",
    ".env.example",
    ".dockerignore",
    ".editorconfig",
    ".gitattributes",
    "pyproject.toml",
    "requirements.lock.txt",
    "requirements.runtime.lock.txt",
    "web/package.json",
    "web/package-lock.json",
    "web/index.html",
    "web/tsconfig.json",
    "web/vite.config.ts",
    "web/playwright.config.ts",
    "data/manifests/datasets.json",
    "data/manifests/solar_system_ephemeris.json",
    "data/manifests/pluto_ephemeris.json",
    "data/manifests/solar_system_orbits.json",
    "data/manifests/timeline_validation.json",
    "data/manifests/appearance.json",
    "data/manifests/small_body_appearance.json",
    "data/manifests/planet_criteria.json",
    "data/manifests/mass_scenarios.json",
    "data/manifests/approximate_mass.json",
    "data/manifests/observation_registry.json",
    "data/manifests/epsilon_indi_b_detail.json",
    "data/reference/epsilon-indi-b/research-20261115/fact_extract.json",
    "data/reference/epsilon-indi-b/research-20261115/geminiann04016a.jpg",
    "data/reference/epsilon-indi-b/research-20261115/geminiann04016a.jpg.source.json",
    "data/reference/epsilon-indi-b/research-20261115/geminiann04016a.xmp.xml",
    "data/manifests/extended_solar.json",
    "data/manifests/long_term_model.json",
    "data/manifests/long_term_validation.json",
    "data/manifests/object_names.json",
    "data/manifests/kuiper_display.json",
    "docs/worklog.md",
    "docs/data_inventory.md",
    "docs/evidence_index.md",
    "docs/official_rules.md",
    "docs/design_references.md",
    "docs/ai_usage.md",
    "docs/ai_usage.json",
    "docs/qa/dev018_local_verification.json",
    "docs/qa/dev019_local_verification.json",
    "docs/qa/ops020_migration_verification.json",
    "docs/qa/dev020_local_verification.json",
    "docs/qa/dev020_platform_parity.json",
    "docs/qa/dev021_local_verification.json",
    "docs/qa/dev023_local_verification.json",
    "docs/qa/dev024_local_verification.json",
    "docs/releases/v0.15.0.json",
    "docs/releases/v0.15.1.json",
    "data/reference/appearance/dev022/uranus-vtad.glb",
    "data/reference/appearance/dev022/uranus-vtad.source.json",
    "data/reference/appearance/dev022/uranus-vtad-extraction.json",
    "data/reference/appearance/dev022/neptune-vtad.glb",
    "data/reference/appearance/dev022/neptune-vtad.source.json",
    "data/reference/appearance/dev022/neptune-vtad-extraction.json",

    "docs/decisions/ADR-001.md",
    "docs/decisions/ADR-002.md",
    "docs/decisions/ADR-003.md",
)


def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def runtime_dependencies():
    pending, found = list(RUNTIME), {}
    while pending:
        name = canonicalize_name(pending.pop())
        if name in found:
            continue
        dist = metadata.distribution(name)
        found[name] = dist
        for dependency in dist.requires or []:
            requirement = Requirement(dependency)
            if requirement.marker is None or requirement.marker.evaluate({"extra": ""}):
                pending.append(requirement.name)
    return found


def source_revision(root, proof=None):
    """Explicit source transfer provenance for isolated non-Git build hosts."""
    if proof is None:
        return {
            "base_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip(),
            "working_tree_has_uncommitted_changes": bool(subprocess.check_output(["git", "status", "--porcelain"], cwd=root, text=True).strip()),
        }
    import re

    if (
        not isinstance(proof, dict)
        or not re.fullmatch(r"[a-f0-9]{40}", str(proof.get("base_commit", "")))
        or type(proof.get("working_tree_has_uncommitted_changes")) is not bool
        or not re.fullmatch(r"[a-f0-9]{64}", str(proof.get("source_transfer_manifest_sha256", "")))
    ):
        raise ValueError("invalid_build_source_provenance")
    transfer = root / "deploy/source-transfer.json"
    if not transfer.is_file() or sha(transfer) != proof["source_transfer_manifest_sha256"]:
        raise ValueError("build_source_transfer_integrity")
    for record in json.loads(transfer.read_bytes())["files"]:
        candidate = (root / record["path"]).resolve()
        if not candidate.is_relative_to(root.resolve()) or not candidate.is_file() or candidate.stat().st_size != record["bytes"] or sha(candidate) != record["sha256"]:
            raise ValueError("build_source_file_integrity")
    return {key: proof[key] for key in ("base_commit", "working_tree_has_uncommitted_changes", "source_transfer_manifest_sha256")}


def prepare(built_at, source_provenance=None, delivery_format="directory"):
    if delivery_format not in {"directory", "zip"}:
        raise ValueError("unsupported_delivery_format")
    version = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))["project"][
        "version"
    ]
    timestamp = datetime.fromisoformat(built_at).astimezone(timezone(timedelta(hours=9)))
    name = f"NASA_SPACE_APPS_CHALLENGE_v{version}_{timestamp:%Y%m%d_%H%M%S}KST"
    stage = ROOT / "artifacts" / name
    stage.mkdir(parents=True, exist_ok=False)
    runtime = runtime_dependencies()
    (ROOT / "requirements.runtime.lock.txt").write_text(
        "\n".join(f"{name}=={dist.version}" for name, dist in sorted(runtime.items())) + "\n",
        encoding="utf-8",
    )
    paths = [ROOT / value for value in FILES]
    for directory in DIRECTORIES:
        paths.extend(
            path
            for path in (ROOT / directory).rglob("*")
            if path.is_file()
            and path.relative_to(ROOT).as_posix() not in LEGACY_DEPLOYMENT_FILES
            and not path.relative_to(ROOT)
            .as_posix()
            .startswith(("web/public/observations/", "web/dist/observations/"))
            and "__pycache__" not in path.parts
            and "upstream" not in path.parts
            and path.suffix not in (".pyc", ".log", ".part", ".tmp")
        )
    runtime_manifest = json.loads((ROOT / "data/node-runtime/runtime_manifest.json").read_bytes())
    if runtime_manifest.get("public_scope") != "solar_system_1000au":
        raise ValueError("release_requires_fresh_active_scope_export")
    for source in runtime_manifest["source_files"]:
        if not source["runtime_required"]:
            continue
        path = (ROOT / source["path"]).resolve()
        if not path.is_relative_to(ROOT) or not path.is_file():
            raise ValueError("release_source_missing_or_unsafe")
        if path.stat().st_size != source["bytes"] or sha(path) != source["sha256"]:
            raise ValueError("release_source_integrity")
        paths.append(path)
    records = json.loads((ROOT / "data/manifests/datasets.json").read_text(encoding="utf-8"))[
        "files"
    ]
    inputs = [
        record
        for record in records
        if record["id"] in ("S01", "S02", "S10", "S12", "S14", "L051", "L046")
    ]
    for path in sorted(set(paths)):
        target = stage / path.relative_to(ROOT)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
    license_index = []
    for name, dist in sorted(runtime.items()):
        copied = []
        for relative in dist.files or []:
            if ".dist-info" not in str(relative) or not any(
                part.lower() == "licenses"
                or part.lower().startswith(("license", "copying", "notice"))
                for part in relative.parts
            ):
                continue
            source = Path(dist.locate_file(relative))
            if source.is_file():
                dest = stage / "licenses/python" / name / Path(*relative.parts[1:])
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, dest)
                copied.append(dest.relative_to(stage).as_posix())
        license_index.append(
            {
                "ecosystem": "python",
                "package": name,
                "version": dist.version,
                "license": dist.metadata.get("License-Expression") or dist.metadata.get("License"),
                "files": copied,
            }
        )
    package_lock = json.loads((ROOT / "web/package-lock.json").read_text(encoding="utf-8"))
    for relative, info in package_lock["packages"].items():
        if not relative or info.get("dev"):
            continue
        directory = ROOT / "web" / relative
        copied = []
        for source in directory.iterdir():
            if source.is_file() and source.name.lower().startswith(
                ("license", "notice", "copying")
            ):
                dest = (
                    stage
                    / "licenses/javascript"
                    / relative.removeprefix("node_modules/")
                    / source.name
                )
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, dest)
                copied.append(dest.relative_to(stage).as_posix())
        license_index.append(
            {
                "ecosystem": "javascript",
                "package": relative.removeprefix("node_modules/"),
                "version": info["version"],
                "license": info.get("license"),
                "files": copied,
            }
        )
    (stage / "licenses").mkdir(parents=True, exist_ok=True)
    (stage / "licenses/index.json").write_text(
        json.dumps(license_index, indent=2) + "\n", encoding="utf-8"
    )
    manifest = {
        "delivery_format": delivery_format,
        "release": version,
        "work_id": "DEV-025",
        "work_ids": [
            "DEV-009",
            "DEV-010",
            "DEV-011",
            "DEV-012",
            "OPS-013",
            "OPS-014",
            "DEV-015",
            "DEV-016",
            "DEV-017",
            "DEV-018",
            "DEV-019",
            "OPS-020",
            "DEV-020",
            "DEV-021",
            "DEV-022",
            "DEV-023",
            "DEV-024",
            "DEV-025",
        ],
        "built_at": built_at,
        **source_revision(ROOT, source_provenance),
        "runtime": {
            "engine": "Node.js >=22.17.0",
            "entrypoint": "app.js",
            "start_command": "node app.js",
            "default_http_port": 3002,
            "python_required_on_server": False,
            "science_results": "actual Python FITS calculations verified and cached at build time",
        },
        "algorithm_versions": [
            "python-built-node-snapshot-v1",
            "jpl-sbdb-tno-two-body-v2",
            "jpl-tno-factual-description-v1",
            "parent-relative-osculating-kepler-v1",
            "rgb-zero-channel-buffer6-display-caution-v2",
            "nasa-vtad-ice-giants-v1",
            "tno-source-aei-exploratory-v1",
            "solar-zero-fill-display-v1",
            "solar-overview-common-v2",
            "parent-linear-distance-v1",
            "source-size-or-H-albedo-density-mass-v1",
            "visual-dependency-payload-equivalence-v1",
            "p9-kepler-sky-v1",
            "solar-system-1000au-scope-v1",
            "solar-prescribed-planets-rk4-v1",
            "p9-coverage-1",
            "planet-nine-evidence-1",
            "spherex-native-v1",
            "pluto-native-v1",
            "solar-display-v1",
            "osculating-kepler-guide-v1",
            "display-hermite-v1",
            "appearance-v1",
            "extended-solar-parent-hermite-v1",
            "jpl-kepler-long-term-v1",
            "localized-object-names-v1",
            "kuiper-region-v1",
            "sourced-small-body-appearance-v1",
            "iau-margot-criteria-v1",
            "spherical-density-hypothesis-v1",
        ],
        "scope_migration_policy": "solar-scope-context-v1",
        "excluded_implementations_in_archive": False,
        "public_scope": "solar_system_1000au",
        "removed_features": [
            "galaxies",
            "galaxy_atlas",
            "exoplanets",
            "cosmic_history",
            "black_holes",
            "observer_physics",
            "physics_lab",
            "historical_comets",
        ],
        "external_verification_report": name + ".verification.json",
        "input_ids": [
            {key: record[key] for key in ("id", "local_relative_path", "sha256", "bytes")}
            for record in inputs
        ],
        "checks": {
            "python_pytest": "see worklog",
            "ruff": "see worklog",
            "frontend": "see worklog",
            "extracted_windows_smoke": "not run by packaging; final exact-archive result is in external_verification_report",
            "linux_container": "not run; engine unavailable",
            "public_service": "not deployed",
        },
        "files": [],
    }
    if delivery_format == "directory":
        manifest["external_verification_report"] = name + ".directory.verification.json"
        manifest["directory_checksum_report"] = name + ".directory.sha256.json"
        manifest["checks"]["clean_directory_smoke"] = (
            "not run by preparation; fresh-copy Node-only result is in external_verification_report"
        )
        del manifest["checks"]["extracted_windows_smoke"]
        manifest["checks"]["linux_container"] = "not run by preparation"
    else:
        manifest["archive_checksum_report"] = name + ".zip.sha256.json"
    finalize(stage, manifest, delivery_format=delivery_format)
    return stage


def finalize(stage, manifest=None, delivery_format=None):
    manifest = manifest or json.loads((stage / "release_manifest.json").read_text(encoding="utf-8"))
    delivery_format = delivery_format or manifest.get("delivery_format", "zip")
    if delivery_format not in {"directory", "zip"}:
        raise ValueError("unsupported_delivery_format")
    manifest["delivery_format"] = delivery_format
    if delivery_format == "directory":
        manifest.pop("archive_checksum_report", None)
        manifest["directory_checksum_report"] = stage.name + ".directory.sha256.json"
        manifest["external_verification_report"] = stage.name + ".directory.verification.json"
    manifest["files"] = [
        {
            "path": path.relative_to(stage).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha(path),
        }
        for path in sorted(stage.rglob("*"))
        if path.is_file() and path.name != "release_manifest.json"
    ]
    (stage / "release_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    if delivery_format == "directory":
        summary = {
            "delivery_format": "directory",
            "directory": stage.name,
            "directory_manifest_sha256": sha(stage / "release_manifest.json"),
            "file_count": len(manifest["files"]) + 1,
            "payload_bytes": sum(record["bytes"] for record in manifest["files"]),
            "directory_bytes": sum(record["bytes"] for record in manifest["files"])
            + (stage / "release_manifest.json").stat().st_size,
        }
        (stage.parent / (stage.name + ".directory.sha256.json")).write_text(
            json.dumps(summary, indent=2) + "\n", encoding="utf-8"
        )
        return summary
    archive = stage.parent / (stage.name + ".zip")
    with zipfile.ZipFile(
        archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=3
    ) as zipfile_handle:
        for path in sorted(stage.rglob("*")):
            if path.is_file():
                zipfile_handle.write(path, path.relative_to(stage).as_posix())
    summary = {
        "filename": archive.name,
        "bytes": archive.stat().st_size,
        "sha256": sha(archive),
        "file_count": len(manifest["files"]) + 1,
    }
    archive.with_suffix(".zip.sha256.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--built-at")
    parser.add_argument("--finalize", type=Path)
    parser.add_argument("--delivery-format", choices=("directory", "zip"))
    parser.add_argument("--source-provenance", type=Path)
    arguments = parser.parse_args()
    if arguments.finalize:
        print(json.dumps(finalize(arguments.finalize, delivery_format=arguments.delivery_format)))
    elif arguments.built_at:
        proof = json.loads(arguments.source_provenance.read_bytes()) if arguments.source_provenance else None
        print(prepare(arguments.built_at, proof, delivery_format=arguments.delivery_format or "directory"))
    else:
        parser.error("--built-at or --finalize is required")
