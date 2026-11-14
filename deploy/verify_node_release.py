"""Verify an exact ZIP and its Node-only server from a fresh extraction.

Python is the development verifier/client, not a hosting dependency. The server
command is exclusively an absolute Node executable plus app.js, with PATH set
to the Node executable's directory. No Python environment is installed and no
scientific reader is imported by this verifier. Extracted files and logs are
preserved on success and failure; only processes created here are stopped.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
import shutil
import socket
import stat
import subprocess
import sys
import tempfile
import time
import traceback
import zipfile
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from urllib.error import URLError
from urllib.request import Request, urlopen

ACTIVE_INPUTS = {"S01", "S02", "S10", "S12", "S14", "L051", "L046"}
LOCAL_ONLY_GROUPS = {
    "extragalactic-planets",
    "exoplanet-observations",
    "small-body-appearance",
    "planet-criteria",
    "mass-scenarios",
    "relativity",
    "galaxy-atlas",
}
SHA256 = re.compile(r"[a-f0-9]{64}\Z")
EXCLUDED_PARTS = {
    ".git",
    ".venv",
    "node_modules",
    "__pycache__",
    "internal",
    "var",
    "tmp",
    "artifacts",
    ".cache",
    ".pytest_cache",
    ".ruff_cache",
    ".codex",
}


class VerificationError(RuntimeError):
    """A short diagnostic code; detailed diagnostics belong in retained logs."""


def require(condition: bool, code: str):
    if not condition:
        raise VerificationError(code)


def sha(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def canonical(value) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")


def relative_path(name: str) -> PurePosixPath:
    require(isinstance(name, str) and bool(name) and "\x00" not in name, "invalid_archive_path")
    path = PurePosixPath(name)
    require(
        not path.is_absolute()
        and ".." not in path.parts
        and "\\" not in name
        and ":" not in name
        and name.rstrip("/") == path.as_posix(),
        "unsafe_archive_path",
    )
    reserved = {
        "con",
        "prn",
        "aux",
        "nul",
        *("com" + str(i) for i in range(1, 10)),
        *("lpt" + str(i) for i in range(1, 10)),
    }
    require(
        all(
            part not in {"", ".", ".."}
            and part.rstrip(" .") == part
            and part.split(".")[0].casefold() not in reserved
            for part in path.parts
        ),
        "nonportable_archive_path",
    )
    return path


def within(root: Path, name: str) -> Path:
    relative_path(name)
    path = (root / name).resolve()
    require(path.is_relative_to(root), "path_outside_verification_root")
    return path


def archive_policy(path: PurePosixPath):
    parts = tuple(part.casefold() for part in path.parts)
    require(not any(part in EXCLUDED_PARTS for part in parts), "excluded_private_directory")
    basename = path.name.casefold()
    require(
        not (basename == ".env" or basename.startswith(".env.") and basename != ".env.example"),
        "excluded_environment_secret",
    )
    require(
        path.suffix.casefold() not in {".pem", ".key", ".p12", ".pfx", ".jks", ".keystore", ".log"}
        and basename
        not in {"credentials.json", "service-account.json", "cookies.txt", "id_rsa", "id_ed25519"},
        "excluded_secret_or_log",
    )
    if len(parts) >= 4 and parts[:2] == ("data", "reference"):
        require(
            not (parts[2] in LOCAL_ONLY_GROUPS and parts[3] == "upstream"),
            "local_only_publisher_original_in_archive",
        )


def verify_record(root: Path, record: dict, path_key: str = "path") -> Path:
    require(
        isinstance(record.get("bytes"), int)
        and not isinstance(record["bytes"], bool)
        and record["bytes"] >= 0
        and isinstance(record.get("sha256"), str)
        and bool(SHA256.fullmatch(record["sha256"])),
        "invalid_file_integrity_record",
    )
    path = within(root, record[path_key])
    require(path.is_file() and not path.is_symlink(), "manifest_file_missing")
    require(
        path.stat().st_size == record["bytes"] and sha(path) == record["sha256"],
        "manifest_file_hash_or_size_mismatch",
    )
    return path


def extract_checked(archive: Path, target: Path) -> set[str]:
    with zipfile.ZipFile(archive) as bundle:
        entries = bundle.infolist()
        names = [entry.filename.rstrip("/") for entry in entries]
        require(
            len(names) == len({name.casefold() for name in names}),
            "archive_case_or_duplicate_collision",
        )
        require(
            len(entries) <= 100000 and sum(e.file_size for e in entries) <= 8 * 1024**3,
            "archive_resource_bound_exceeded",
        )
        prefixes = {}
        for entry in entries:
            relative_path(entry.orig_filename)
            path = relative_path(entry.filename)
            for depth in range(1, len(path.parts) + 1):
                prefix = "/".join(path.parts[:depth])
                folded = prefix.casefold()
                require(prefixes.get(folded, prefix) == prefix, "archive_directory_case_collision")
                prefixes[folded] = prefix
            archive_policy(path)
            mode = entry.external_attr >> 16
            kind = stat.S_IFMT(mode)
            require(
                not stat.S_ISLNK(mode)
                and kind in {0, stat.S_IFREG, stat.S_IFDIR}
                and not entry.external_attr & 0x400,
                "archive_symlink_or_special_file",
            )
            require(not entry.flag_bits & 1, "encrypted_archive_not_supported")
        file_names = set()
        for entry in entries:
            destination = within(target, entry.filename.rstrip("/"))
            if entry.is_dir():
                destination.mkdir(parents=True, exist_ok=True)
                continue
            destination.parent.mkdir(parents=True, exist_ok=True)
            with bundle.open(entry) as source, destination.open("xb") as output:
                shutil.copyfileobj(source, output, length=1024 * 1024)
            file_names.add(entry.filename)
            if (
                destination.suffix.casefold()
                in {".json", ".txt", ".md", ".yaml", ".yml", ".toml", ".py", ".js", ".sh", ".ps1"}
                and entry.file_size <= 2_000_000
            ):
                require(
                    not re.search(
                        rb"(?m)^-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----\r?$",
                        destination.read_bytes(),
                    ),
                    "private_key_material_in_archive",
                )
    return file_names


def verify_payload(target: Path, archive_files: set[str]) -> tuple[dict, dict, dict]:
    release = json.loads((target / "release_manifest.json").read_bytes())
    require(
        release.get("runtime", {}).get("entrypoint") == "app.js"
        and release["runtime"].get("python_required_on_server") is False,
        "release_not_declared_Node_only",
    )
    listed = [item["path"] for item in release["files"]]
    require(len(listed) == len({p.casefold() for p in listed}), "release_manifest_duplicate_paths")
    require(
        set(listed) == archive_files - {"release_manifest.json"},
        "release_manifest_coverage_mismatch",
    )
    for record in release["files"]:
        verify_record(target, record)
    inputs = release["input_ids"]
    require(
        len(inputs) == 7 and {record["id"] for record in inputs} == ACTIVE_INPUTS,
        "active_observation_calibration_population_input_scope_mismatch",
    )
    for record in inputs:
        verify_record(target, record, "local_relative_path")
    raw = (target / "data/node-runtime/runtime_manifest.json").read_bytes()
    require(
        raw == (target / "data/manifests/node_runtime.json").read_bytes(),
        "node_runtime_canonical_copy_mismatch",
    )
    runtime = json.loads(raw)
    require(runtime.get("public_scope") == "solar_system_1000au", "active_export_scope_missing")
    excluded = re.compile(
        r"^(?:data/(?:reference/(?:catalog|history|cosmic-|universe-catalog|galaxies|extragalactic-|exoplanet-|relativity|comets|galaxy-atlas|numerical-relativity)|manifests/(?:comets|galaxy_atlas|numerical_relativity|exoplanets|extragalactic_planets|exoplanet_observations|black_holes|observer_physics|cosmic_history|cosmic_morphology|cosmic_observations|universe_catalog|galaxies)\.json)|science/(?:comets|exoplanets|exoplanet_observations|extragalactic_planets|nasa_catalog|galaxies|galaxy_atlas|history|history_morphology|history_observations|universe_catalog|relativity|numerical_relativity)\.py|node/galaxy-atlas\.js|web/(?:public|dist)/observations/)"
    )
    require(
        not any(excluded.search(name) for name in archive_files),
        "excluded_feature_implementation_packaged",
    )
    require(
        not any(excluded.search(item["path"]) for item in runtime["source_files"]),
        "excluded_feature_source_dependency",
    )
    removed_snapshots = {
        "black_holes",
        "observer_physics",
        "cosmic_history",
        "cosmic_observations",
        "galaxies",
        "exoplanets",
        "universe_catalog",
        "exoplanet_observations",
        "extragalactic_planets",
        "comets",
        "galaxy_atlas",
        "galaxy_atlas_markers",
        "numerical_relativity",
        "exoplanet_details",
        "universe_host_children",
    }
    require(
        not removed_snapshots.intersection(runtime["snapshots"]),
        "excluded_feature_snapshot_packaged",
    )
    require(
        runtime["schema_version"] == "1.0"
        and runtime["algorithm_version"] == "python-built-node-snapshot-v1",
        "unsupported_Node_runtime_manifest",
    )
    bundle = target / "data/node-runtime"
    listed = [record["path"] for record in runtime["files"]]
    require(len(listed) == len(set(listed)), "runtime_duplicate_paths")
    actual = {p.relative_to(bundle).as_posix() for p in bundle.rglob("*") if p.is_file()}
    require(set(listed) == actual - {"runtime_manifest.json"}, "runtime_manifest_coverage_mismatch")
    for record in runtime["files"]:
        verify_record(bundle, record)
    required = optional_present = optional_absent = 0
    for record in runtime["source_files"]:
        require(
            not record["path"].startswith("data/node-runtime/")
            and record["path"] != "data/manifests/node_runtime.json",
            "runtime_self_reference",
        )
        require(isinstance(record["runtime_required"], bool), "invalid_runtime_required_flag")
        source = within(target, record["path"])
        is_local_only = (
            "/upstream/" in record["path"] and record["path"].split("/")[2] in LOCAL_ONLY_GROUPS
        )
        require(
            not is_local_only or not record["runtime_required"],
            "publisher_original_made_runtime_required",
        )
        selected = record
        if not source.is_file() and record.get("serving_copy_path"):
            selected = {**record, "path": record["serving_copy_path"]}
            source = within(target, selected["path"])
        if source.is_file():
            verify_record(target, selected)
            required += record["runtime_required"]
            optional_present += not record["runtime_required"]
        else:
            require(not record["runtime_required"], "required_Node_source_missing")
            optional_absent += 1
    source_by_path = {item["path"]: item for item in runtime["source_files"]}
    for record in inputs:
        expected = source_by_path.get(record["local_relative_path"])
        require(
            expected is not None
            and expected["runtime_required"]
            and expected["bytes"] == record["bytes"]
            and expected["sha256"] == record["sha256"],
            "release_runtime_FITS_provenance_mismatch",
        )
    require(
        set(runtime["comparisons"]) == {"S01,S02", "S02,S01", "S12,S14", "S14,S12"},
        "comparison_cache_selection_mismatch",
    )
    for key, record in runtime["comparisons"].items():
        path = verify_record(bundle, record)
        content = path.read_bytes()
        value = json.loads(content)
        body = {name: item for name, item in value.items() if name != "result_id"}
        require(
            content == canonical(value)
            and hashlib.sha256(content).hexdigest() == record["comparison_sha256"]
            and hashlib.sha256(canonical(body)).hexdigest() == record["content_sha256"]
            and value["result_id"] == record["result_id"] == "cmp_" + record["content_sha256"][:24]
            and key == ",".join(frame["observation_id"] for frame in value["frames"]),
            "comparison_cache_canonical_identity_mismatch",
        )
    return (
        release,
        runtime,
        {
            "required_sources_verified": required,
            "optional_sources_present_verified": optional_present,
            "optional_sources_not_deployed": optional_absent,
            "runtime_manifest_sha256": hashlib.sha256(raw).hexdigest(),
        },
    )


def server_environment(node: Path, target: Path, port: int) -> tuple[dict, dict]:
    allowed = {
        "SYSTEMROOT",
        "WINDIR",
        "SYSTEMDRIVE",
        "COMSPEC",
        "TEMP",
        "TMP",
        "PATHEXT",
        "LANG",
        "LC_ALL",
        "TZ",
    }
    environment = {key: value for key, value in os.environ.items() if key.upper() in allowed}
    environment.update(
        PATH=str(node.parent),
        APP_HOST="127.0.0.1",
        PORT=str(port),
        APP_STATE_DIR=str(target / "var/node"),
        NODE_ENV="production",
        NoDefaultCurrentDirectoryInExePath="1",
    )
    lookup = {
        name: shutil.which(name, path=environment["PATH"])
        for name in ("python", "python3", "python.exe", "python3.exe", "py", "py.exe", "uvicorn")
    }
    require(not any(lookup.values()), "Python_interpreter_resolvable_on_closed_server_PATH")
    return environment, lookup


def call(base: str, path: str, body=None) -> tuple[bytes, dict]:
    data = (
        json.dumps(body, ensure_ascii=False, allow_nan=False).encode("utf-8")
        if body is not None
        else None
    )
    request = Request(base + path, data=data, headers={"Content-Type": "application/json"})
    with urlopen(request, timeout=60) as response:
        raw = response.read()
    return raw, json.loads(raw)


def raw_member(raw: bytes, wanted: str) -> bytes:
    text = raw.decode("utf-8")
    decoder = json.JSONDecoder()
    position = text.index("{") + 1
    while True:
        while text[position].isspace() or text[position] == ",":
            position += 1
        require(text[position] != "}", "missing_evidence_comparison_member")
        key, position = decoder.raw_decode(text, position)
        while text[position].isspace():
            position += 1
        require(text[position] == ":", "invalid_evidence_JSON_member")
        position += 1
        while text[position].isspace():
            position += 1
        begin = position
        _value, position = decoder.raw_decode(text, position)
        if key == wanted:
            return text[begin:position].encode("utf-8")


def stop_owned(process: subprocess.Popen | None):
    if process is None or process.poll() is not None:
        return
    try:
        process.terminate()
    except ProcessLookupError:
        process.wait(timeout=15)
        return
    try:
        process.wait(timeout=15)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=15)


def main(
    archive: Path,
    port: int = 8011,
    node_executable: Path | None = None,
    use_default_port: bool = False,
) -> dict:
    repository = Path(__file__).resolve().parents[1]
    (repository / "tmp").mkdir(exist_ok=True)
    temporary = Path(
        tempfile.mkdtemp(prefix="node-release-verify-", dir=repository / "tmp")
    ).resolve()
    target = temporary / "extracted"
    target.mkdir()
    archive = archive.resolve()
    report_path = archive.with_suffix(".verification.json")
    report = {
        "checked_at": datetime.now(UTC).isoformat(),
        "status": "failed",
        "archive": archive.name,
        "extracted": str(target),
        "logs": str(temporary),
        "development_verifier": {
            "runtime": "Python standard library",
            "executable": sys.executable,
            "role": "ZIP/hash orchestration and HTTP test client only; not the server",
        },
        "server_python_required": False,
        "linux_container": "not_run",
        "public_service": "not_deployed",
    }
    process = None
    logs = []
    stage = "archive_validation"
    try:
        require(
            archive.is_file() and archive.suffix.lower() == ".zip" and 1 <= port <= 65535,
            "invalid_verification_arguments",
        )
        report["archive_bytes"] = archive.stat().st_size
        report["archive_sha256"] = sha(archive)
        checksum_path = archive.with_suffix(".zip.sha256.json")
        if checksum_path.is_file():
            supplied = json.loads(checksum_path.read_bytes())
            require(
                supplied["filename"] == archive.name
                and supplied["bytes"] == report["archive_bytes"]
                and supplied["sha256"] == report["archive_sha256"],
                "supplied_archive_checksum_mismatch",
            )
        archive_files = extract_checked(archive, target)
        release, runtime, integrity = verify_payload(target, archive_files)
        report.update(
            release=release["release"],
            release_base_commit=release.get("base_commit"),
            manifest_files_verified=len(release["files"]),
            runtime_integrity=integrity,
            archive_policy="path/case/symlink/special-file/private-path/environment/key-header/local-only exclusions passed",
        )
        stage = "Node_runtime_validation"
        selected = node_executable or (Path(shutil.which("node")) if shutil.which("node") else None)
        require(selected is not None, "Node_executable_not_found")
        node = selected.resolve()
        require(
            node.is_file() and node.name.casefold() == ("node.exe" if os.name == "nt" else "node"),
            "invalid_Node_executable",
        )
        environment, lookup = server_environment(node, target, port)
        if use_default_port:
            require(port == release["runtime"].get("default_http_port"), "default_port_mismatch")
            environment.pop("PORT")
        with (
            (temporary / "node-version.stdout.log").open("wb") as stdout,
            (temporary / "node-version.stderr.log").open("wb") as stderr,
        ):
            version_probe = subprocess.run(
                [str(node), "--version"],
                cwd=target,
                env=environment,
                stdout=stdout,
                stderr=stderr,
                timeout=15,
                check=False,
            )
        require(version_probe.returncode == 0, "Node_version_probe_failed")
        version = (temporary / "node-version.stdout.log").read_text(encoding="utf-8").strip()
        match = re.fullmatch(r"v(\d+)\.(\d+)\.(\d+)", version)
        require(
            match is not None and tuple(map(int, match.groups())) >= (22, 17, 0),
            "Node_version_below_release_requirement",
        )
        server_sources = [
            target / "app.js",
            *(p for p in (target / "node").glob("*.js") if not p.name.endswith(".test.js")),
        ]
        require(
            not any(
                re.search(r"(?:node:)?child_process", p.read_text(encoding="utf-8"))
                for p in server_sources
            ),
            "server_source_uses_child_process_review_required",
        )
        require(
            "node:worker_threads" in (target / "node/sources.js").read_text(encoding="utf-8"),
            "Node_source_worker_thread_missing",
        )
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", port))
        base = f"http://127.0.0.1:{port}"
        pids = []

        def launch():
            output = (temporary / f"server-{len(pids) + 1}.log").open("wb")
            logs.append(output)
            child = subprocess.Popen(
                [str(node), "app.js"],
                cwd=target,
                env=environment,
                stdout=output,
                stderr=subprocess.STDOUT,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            pids.append(child.pid)
            return child

        def wait_ready(child):
            deadline = time.monotonic() + 120
            while time.monotonic() < deadline:
                require(child.poll() is None, "extracted_Node_server_exited")
                try:
                    with urlopen(base + "/health/ready", timeout=2) as response:
                        value = json.load(response)
                    if value.get("status") == "ready":
                        require(
                            value.get("runtime") == "node"
                            and value.get("worker_alive") is True
                            and value.get("source_bundle_verified") is True,
                            "Node_worker_or_bundle_not_verified",
                        )
                        return value
                except (URLError, TimeoutError, OSError):
                    pass
                time.sleep(0.25)
            raise VerificationError("extracted_Node_server_not_ready")

        process = launch()
        ready_before = wait_ready(process)
        _, runtime_response = call(base, "/api/v1/runtime")
        require(
            runtime_response.get("runtime") == "node"
            and runtime_response.get("observation_processing") == "verified_build_cache"
            and runtime_response.get("arbitrary_fits_inputs") is False
            and runtime_response.get("snapshot_exported_utc") == runtime["exported_utc"],
            "Node_runtime_disclosure_mismatch",
        )
        scoped = runtime_response.get("public_scope") == "solar_system_1000au"
        require(scoped, "release_public_scope_mismatch")
        if scoped:
            from urllib.error import HTTPError

            for route in [
                "catalog/galaxies",
                "catalog/galaxy-atlas",
                "catalog/exoplanets",
                "catalog/universe",
                "black-holes",
                "observer-physics",
                "cosmic-observations",
                "cosmic-history",
                "catalog/comets",
                "physics/numerical-relativity",
            ]:
                try:
                    call(base, "/api/v1/" + route)
                except HTTPError as exc:
                    require(exc.code == 410, "removed_public_API_not_gated")
                else:
                    require(False, "removed_public_API_reopened")
            _, presets = call(base, "/api/v1/planet-nine/presets")
            require(
                len(presets["presets"]) == 3 and presets["source"]["epoch_discrepancy"],
                "P9_source_contract_mismatch",
            )
            report["solar_scope_checks"] = {
                "radius_au": 1000,
                "P9_source_sha256": presets["source"]["sha256"],
                "removed_API_status": 410,
            }
        stage = "extracted_release_HTTP_smoke"
        with (
            (temporary / "smoke.stdout.json").open("wb") as stdout,
            (temporary / "smoke.stderr.log").open("wb") as stderr,
        ):
            helper = subprocess.run(
                [sys.executable, "-X", "utf8", "tests/solar_scope_smoke.py", base],
                cwd=target,
                env={**environment, "PYTHONUTF8": "1"},
                stdout=stdout,
                stderr=stderr,
                timeout=600,
                check=False,
            )
        require(helper.returncode == 0, "extracted_Node_release_smoke_failed")
        smoke = json.loads((temporary / "smoke.stdout.json").read_bytes())
        require(smoke["status"] == "passed", "extracted_Node_release_smoke_not_passed")
        evidence = []
        comparison_wire = {}
        for evidence_key, result_key in [
            ("evidence_id", "result_id"),
            ("pluto_evidence_id", "pluto_result_id"),
        ]:
            raw, saved = call(base, "/api/v1/evidence/" + smoke[evidence_key] + "/export")
            require(saved["result_id"] == smoke[result_key], "smoke_evidence_result_mismatch")
            evidence.append((raw, saved))
            record = runtime["comparisons"][",".join(saved["session"]["observation_ids"])]
            embedded_hash = hashlib.sha256(raw_member(raw, "comparison")).hexdigest()
            require(
                embedded_hash == record["comparison_sha256"] == saved["comparison_sha256"],
                "evidence_raw_comparison_hash_mismatch",
            )
            wire, comparison = call(base, "/api/v1/comparisons/" + saved["result_id"] + "/manifest")
            require(comparison == saved["comparison"], "comparison_wire_semantic_mismatch")
            comparison_wire[saved["result_id"]] = {
                "cache_and_evidence_raw_sha256": embedded_hash,
                "HTTP_JSON_wire_sha256": hashlib.sha256(wire).hexdigest(),
                "semantic_equality": True,
            }
        rich_session = copy.deepcopy(evidence[0][1]["session"])
        context = copy.deepcopy(evidence[1][1]["session"]["universe_context"])
        context.update(
            selected_object_id="epsilon-indi-b",
            follow_object_id="epsilon-indi-b",
            camera={
                "position": [120, 80, 100],
                "target": [0, 0, 0],
                "representation_version": "solar-display-v1",
            },
        )
        if "mass_scenario" in context:
            context["mass_scenario"]["density_kg_m3"] = 2200
        rich_session["universe_context"] = context
        _, rich = call(
            base,
            "/api/v1/evidence",
            {
                "result_id": smoke["result_id"],
                "session": rich_session,
                "judgment": "Node-only release verification: source quality retained; association/motion unconfirmed.",
            },
        )
        raw_rich, rich = call(base, "/api/v1/evidence/" + rich["evidence_id"] + "/export")
        require(
            hashlib.sha256(raw_member(raw_rich, "comparison")).hexdigest()
            == runtime["comparisons"]["S01,S02"]["comparison_sha256"],
            "rich_evidence_raw_comparison_hash_mismatch",
        )
        evidence.append((raw_rich, rich))
        state = target / "var/node"
        for raw, saved in evidence:
            require(
                (state / "evidence" / (saved["evidence_id"] + ".json")).read_bytes() == raw,
                "evidence_not_in_extracted_Node_state",
            )
        p9_before_raw, p9_before = (
            call(base, "/api/v1/planet-nine/evidence/" + smoke["p9_evidence_id"] + "/export")
            if scoped
            else (None, None)
        )
        stage = "Node_process_and_worker_restart_restore"
        stop_owned(process)
        process = launch()
        ready_after = wait_ready(process)
        _, runtime_after = call(base, "/api/v1/runtime")
        require(runtime_after == runtime_response, "runtime_bundle_changed_across_Node_restart")
        if scoped:
            p9_after_raw, p9_after = call(
                base, "/api/v1/planet-nine/evidence/" + smoke["p9_evidence_id"] + "/export"
            )
            require(
                p9_after_raw == p9_before_raw and p9_after == p9_before,
                "P9_evidence_changed_across_restart",
            )
            _, p9_restored = call(base, "/api/v1/planet-nine/evidence/import", p9_before)
            require(
                p9_restored["status"] == "restored" and p9_restored["evidence"] == p9_before,
                "P9_restart_restore_mismatch",
            )
            report["p9_restart_restore"] = {
                "evidence_id": smoke["p9_evidence_id"],
                "same_export_bytes": True,
                "gravity_recomputed": True,
            }
        restorations = []
        for before_raw, before in evidence:
            after_raw, saved = call(base, "/api/v1/evidence/" + before["evidence_id"] + "/export")
            require(
                after_raw == before_raw and saved == before, "evidence_changed_across_Node_restart"
            )
            _, restored = call(base, "/api/v1/evidence/import", saved)
            require(
                restored["status"] == "restored"
                and restored["evidence_id"] == saved["evidence_id"]
                and restored["comparison"]["result_id"] == saved["result_id"]
                and restored["comparison"] == saved["comparison"]
                and restored["session"] == saved["session"]
                and restored["judgment"] == saved["judgment"],
                "Node_restart_evidence_restore_mismatch",
            )
            restorations.append(
                {
                    "evidence_id": saved["evidence_id"],
                    "result_id": saved["result_id"],
                    "same_export_bytes_session_judgment": True,
                    "camera_and_mass_assumptions_present": bool(
                        saved["session"].get("universe_context")
                    ),
                }
            )
        require(pids[0] != pids[1] and process.poll() is None, "Node_process_restart_not_observed")
        report.update(
            status="passed",
            stage="complete",
            node_runtime=smoke,
            server={
                "engine": "Node.js",
                "version": version,
                "executable": str(node),
                "argv": [str(node), "app.js"],
                "PATH": environment["PATH"],
                "PORT": environment.get("PORT"),
                "APP_PORT": environment.get("APP_PORT"),
                "actual_http_port": port,
                "startup_port_source": "code_default" if use_default_port else "PORT_environment",
                "APP_STATE_DIR": str(state),
                "owned_process_ids": pids,
                "worker_model": "node:worker_threads, verified through actual health/source responses",
                "Python_interpreters_resolvable_on_PATH": lookup,
                "source_child_process_import_scan": "none",
                "stop_method": "only owned Popen process; Windows terminate is abrupt process/thread termination"
                if os.name == "nt"
                else "only owned Popen process SIGTERM; kill only on timeout",
            },
            runtime_disclosure=runtime_response,
            health_before_restart=ready_before,
            health_after_restart=ready_after,
            runtime_disclosure_after_restart=runtime_after,
            server_restart_evidence_restore=restorations,
            actual_comparison_raw_hashes=comparison_wire,
            comparison_hash_scope="Evidence comparison_sha256 covers the preserved Python-canonical build-cache bytes. HTTP JSON serialization may have a different raw SHA while preserving the same parsed values.",
            hosting_scope="Node-only server verified under closed PATH; Python executed only as this development verifier and the packaged standard-library HTTP smoke client. This is not an OS sandbox or proof that Python is uninstalled.",
        )
    except Exception as error:  # noqa: BLE001 -- retain diagnostics and a machine-readable failed report
        (temporary / "failure.log").write_text(traceback.format_exc(), encoding="utf-8")
        report.update(
            status="failed",
            stage=stage,
            failure_code=str(error)
            if isinstance(error, VerificationError)
            else "unexpected_verifier_failure",
            exception_type=type(error).__name__,
        )
    finally:
        try:
            stop_owned(process)
        except (OSError, subprocess.TimeoutExpired):
            (temporary / "cleanup-failure.log").write_text(traceback.format_exc(), encoding="utf-8")
            report.update(status="failed", failure_code="owned_Node_process_cleanup_failed")
        for output in logs:
            output.close()
        report["completed_at"] = datetime.now(UTC).isoformat()
        try:
            if report_path.is_file():
                shutil.copyfile(report_path, temporary / "previous-verification.json")
            report_path.write_text(
                json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
        except OSError:
            report.update(status="failed", failure_code="external_verification_report_write_failed")
            report_path = temporary / "verification.json"
            report_path.write_text(
                json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
        print(
            json.dumps(
                {
                    "status": report["status"],
                    "report": str(report_path),
                    "logs": str(temporary),
                    "failure_code": report.get("failure_code"),
                },
                ensure_ascii=True,
            )
        )
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--port", type=int, default=8011)
    parser.add_argument("--use-default-port", action="store_true")
    parser.add_argument("--node", "--node-executable", dest="node_executable", type=Path)
    arguments = parser.parse_args()
    result = main(
        arguments.archive, arguments.port, arguments.node_executable, arguments.use_default_port
    )
    raise SystemExit(0 if result["status"] == "passed" else 1)
