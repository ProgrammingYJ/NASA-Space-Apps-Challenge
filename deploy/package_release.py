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
DIRECTORIES = (
    "api",
    "science",
    "worker",
    "contracts",
    "deploy",
    "tests",
    "web/src",
    "web/tests",
    "web/dist",
)
FILES = (
    "README.md",
    "FSD.md",
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
    "docs/worklog.md",
    "docs/data_inventory.md",
    "docs/evidence_index.md",
    "docs/official_rules.md",
    "docs/design_references.md",
    "docs/ai_usage.md",
    "docs/ai_usage.json",
    "docs/decisions/ADR-001.md",
    "docs/decisions/ADR-002.md",
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


def prepare(built_at):
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
            and "__pycache__" not in path.parts
            and path.suffix not in (".pyc", ".log")
        )
    records = json.loads((ROOT / "data/manifests/datasets.json").read_text(encoding="utf-8"))[
        "files"
    ]
    inputs = [
        record for record in records if record["id"] in ("S01", "S02", "S10", "S12", "S14", "L051")
    ]
    for record in inputs:
        path = ROOT / record["local_relative_path"]
        assert path.stat().st_size == record["bytes"] and sha(path) == record["sha256"]
        paths.append(path)
    for path in paths:
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
    (stage / "licenses/index.json").write_text(
        json.dumps(license_index, indent=2) + "\n", encoding="utf-8"
    )
    manifest = {
        "release": version,
        "work_id": "DEV-003",
        "built_at": built_at,
        "base_commit": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip(),
        "working_tree_has_uncommitted_changes": True,
        "algorithm_versions": [
            "spherex-native-v1",
            "pluto-native-v1",
            "solar-display-v1",
            "osculating-kepler-guide-v1",
            "display-hermite-v1",
        ],
        "input_ids": [
            {key: record[key] for key in ("id", "local_relative_path", "sha256", "bytes")}
            for record in inputs
        ],
        "checks": {
            "python_pytest": "see worklog",
            "ruff": "see worklog",
            "frontend": "see worklog",
            "extracted_windows_smoke": "pending",
            "linux_container": "not run; engine unavailable",
            "public_service": "not deployed",
        },
        "files": [],
    }
    finalize(stage, manifest)
    return stage


def finalize(stage, manifest=None):
    manifest = manifest or json.loads((stage / "release_manifest.json").read_text(encoding="utf-8"))
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
    arguments = parser.parse_args()
    if arguments.finalize:
        print(json.dumps(finalize(arguments.finalize)))
    elif arguments.built_at:
        print(prepare(arguments.built_at))
    else:
        parser.error("--built-at or --finalize is required")
