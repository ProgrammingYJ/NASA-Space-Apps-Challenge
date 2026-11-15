"""Prepare a private source overlay for an isolated build, without copying live state.

The current delivery is a verified release directory (no new ZIP). This TAR is
only an internal build input over the already verified immutable base release.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import tarfile
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GENERATED = {"data/manifests/node_runtime.json", "requirements.runtime.lock.txt", "deploy/source-transfer.json", "deploy/remote-source-provenance.json"}
DIRECTORIES = ("node", "api", "science", "worker", "contracts", "deploy", "tests", "web/src", "web/tests")


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def prepare(base_stage: Path, destination: Path):
    from deploy.package_release import FILES

    base = json.loads((base_stage / "release_manifest.json").read_bytes())
    original_paths = {row["path"] for row in base["files"]}
    paths = {ROOT / name for name in FILES}
    for directory in DIRECTORIES:
        paths.update((ROOT / directory).rglob("*"))
    for directory in ("data/reference/outer-tno/r029-r031-20261115", "data/reference/appearance/dev020", "data/reference/visual-manifest-history", "data/reference/spherex-registry/dev025", "data/reference/mcp/dev025", "data/reference/spherex-extended-20261115", "data/reference/document-fonts"):
        paths.update((ROOT / directory).rglob("*"))
    runtime = json.loads((ROOT / "data/node-runtime/runtime_manifest.json").read_bytes())
    paths.update(ROOT / row["path"] for row in runtime["source_files"] if not row["runtime_required"])
    paths.update(p for p in (ROOT / "web/public").rglob("*") if p.is_file() and p.relative_to(ROOT).as_posix() not in original_paths)
    chosen = []
    for path in sorted(paths):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT).as_posix()
        if relative in GENERATED or any(part in {"__pycache__", "node_modules", "internal", ".git"} for part in path.relative_to(ROOT).parts) or path.suffix in {".pyc", ".log", ".tmp", ".part"}:
            continue
        if path.is_symlink() or not path.resolve().is_relative_to(ROOT):
            raise ValueError("unsafe_source_path")
        chosen.append({"path": relative, "bytes": path.stat().st_size, "sha256": digest(path)})
    manifest = {"schema_version": "source-transfer-v1", "created_utc": datetime.now(UTC).isoformat(), "base_release": base["release"], "base_release_archive": base_stage.name + ".zip", "files": chosen}
    target = ROOT / "deploy/source-transfer.json"
    target.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    proof = {"base_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(), "working_tree_has_uncommitted_changes": bool(subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT, text=True).strip()), "source_transfer_manifest_sha256": digest(target)}
    proof_path = ROOT / "deploy/remote-source-provenance.json"
    proof_path.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(destination, "w") as output:
        for row in chosen:
            output.add(ROOT / row["path"], arcname=row["path"], recursive=False)
        output.add(target, arcname="deploy/source-transfer.json", recursive=False)
        output.add(proof_path, arcname="deploy/remote-source-provenance.json", recursive=False)
    return {"archive": str(destination), "bytes": destination.stat().st_size, "sha256": digest(destination), "files": len(chosen), "source_transfer_manifest_sha256": proof["source_transfer_manifest_sha256"]}


if __name__ == "__main__":
    print(json.dumps(prepare(ROOT / "artifacts/NASA_SPACE_APPS_CHALLENGE_v0.12.1_20261115_044329KST", ROOT / "var/qa/dev020/source-transfer.tar")))
