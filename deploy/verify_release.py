"""Extract a ZIP into a new folder, verify hashes, then run its actual server."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import time
import zipfile
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from urllib.error import URLError
from urllib.request import Request, urlopen


def main(archive: Path, port: int, runtime_python: Path | None = None):
    root = Path(__file__).resolve().parents[1]
    (root / "tmp").mkdir(exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix="release-verify-", dir=root / "tmp"))
    target = temporary / "extracted"
    target.mkdir()
    with zipfile.ZipFile(archive) as bundle:
        names = bundle.namelist()
        assert len(names) == len({name.casefold() for name in names}), "case collision"
        for name in names:
            path = PurePosixPath(name)
            assert (
                not path.is_absolute()
                and ".." not in path.parts
                and "\\" not in name
                and ":" not in name
            )
            assert not any(
                part in {".git", ".venv", "node_modules", "__pycache__", "internal", "var"}
                for part in path.parts
            ), name
            assert path.name != ".env" and not path.suffix.lower() in {".pem", ".key", ".log"}
        bundle.extractall(target)
    manifest = json.loads((target / "release_manifest.json").read_text(encoding="utf-8"))
    for item in manifest["files"]:
        path = target / item["path"]
        assert path.stat().st_size == item["bytes"]
        with path.open("rb") as stream:
            assert hashlib.file_digest(stream, "sha256").hexdigest() == item["sha256"]
    assert len(names) == len(manifest["files"]) + 1
    for item in manifest["input_ids"]:
        assert (target / item["local_relative_path"]).is_file()
    if runtime_python:
        python = runtime_python.resolve()
    else:
        runtime = temporary / "runtime"
        subprocess.run([sys.executable, "-m", "venv", str(runtime)], check=True)
        python = runtime / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
        with (temporary / "install.log").open("w", encoding="utf-8") as output:
            subprocess.run(
                [
                    str(python),
                    "-X",
                    "utf8",
                    "-m",
                    "pip",
                    "install",
                    "-r",
                    str(target / "requirements.runtime.lock.txt"),
                ],
                stdout=output,
                stderr=subprocess.STDOUT,
                check=True,
            )
    environment = dict(os.environ, APP_STATE_DIR=str(target / "var"), PYTHONUTF8="1")
    log = (temporary / "server.log").open("w", encoding="utf-8")

    def launch():
        return subprocess.Popen(
            [
                str(python),
                "-X",
                "utf8",
                "-m",
                "uvicorn",
                "api.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
                "--workers",
                "1",
            ],
            cwd=target,
            env=environment,
            stdout=log,
            stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )

    base = f"http://127.0.0.1:{port}"

    def wait_ready(process):
        for _ in range(120):
            if process.poll() is not None:
                raise RuntimeError("extracted_server_exited")
            try:
                with urlopen(base + "/health/ready", timeout=1) as response:
                    if response.status == 200:
                        break
            except URLError:
                time.sleep(0.25)
        else:
            raise RuntimeError("extracted_server_not_ready")

    process = launch()
    try:
        wait_ready(process)
        smoke = subprocess.run(
            [str(python), "-X", "utf8", "tests/release_smoke.py", base],
            cwd=target,
            check=True,
            capture_output=True,
            encoding="utf-8",
        )
        smoke_result = json.loads(smoke.stdout)
        process.terminate()
        process.wait(timeout=15)
        process = launch()
        wait_ready(process)
        for evidence_key, result_key in (
            ("evidence_id", "result_id"),
            ("pluto_evidence_id", "pluto_result_id"),
        ):
            with urlopen(
                base + "/api/v1/evidence/" + smoke_result[evidence_key] + "/export", timeout=60
            ) as response:
                saved = json.load(response)
            request = Request(
                base + "/api/v1/evidence/import",
                data=json.dumps(saved).encode(),
                headers={"Content-Type": "application/json"},
            )
            with urlopen(request, timeout=60) as response:
                restored = json.load(response)
            assert restored["status"] == "restored"
            assert restored["comparison"]["result_id"] == smoke_result[result_key]
            assert restored["session"] == saved["session"]
            assert restored["judgment"] == saved["judgment"]
        report = {
            "checked_at": datetime.now(UTC).isoformat(),
            "status": "passed",
            "archive": archive.name,
            "extracted": target.relative_to(root).as_posix(),
            "manifest_files_verified": len(manifest["files"]),
            "fresh_runtime_install": "reused previously verified isolated runtime"
            if runtime_python
            else "passed",
            "windows_runtime": smoke_result,
            "server_restart_evidence_restore": "passed: same epsilon/pluto evidence and result IDs",
            "linux_container": "not_run",
            "public_service": "not_deployed",
        }
        archive.with_suffix(".verification.json").write_text(
            json.dumps(report, indent=2) + "\n", encoding="utf-8"
        )
        print(json.dumps(report))
    finally:
        process.terminate()
        process.wait(timeout=15)
        log.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("--port", type=int, default=8011)
    parser.add_argument("--runtime-python", type=Path)
    arguments = parser.parse_args()
    main(arguments.archive.resolve(), arguments.port, arguments.runtime_python)
