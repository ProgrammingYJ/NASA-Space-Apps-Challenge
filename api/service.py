from __future__ import annotations

import hashlib
import multiprocessing as mp
import threading
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path

import psutil

from api.storage import InstanceLock, atomic_json, digest, read_json
from worker.process import run


def now():
    return datetime.now(UTC).isoformat()


class Service:
    def __init__(self, root: Path, state: Path):
        self.root, self.state = root, state
        self.guard = threading.RLock()
        self.lock = InstanceLock(state / "api.lock")
        self.jobs = {}
        self.stopping = threading.Event()
        self.active = None
        self.heartbeat = 0
        self.catalog = None
        self.pluto_catalog = None
        self.pluto_catalog_error = None
        self.catalog_error = None
        # An abandoned worker must be confirmed stopped before jobs become interrupted.
        worker_record = state / "worker.json"
        if worker_record.exists():
            old = read_json(worker_record)
            try:
                process = psutil.Process(old["pid"])
                if abs(process.create_time() - old["created"]) < 0.01:
                    if "multiprocessing.spawn" not in " ".join(process.cmdline()):
                        raise RuntimeError("Previous worker identity is uncertain")
                    process.terminate()
                    process.wait(timeout=10)
            except psutil.NoSuchProcess:
                pass
        for path in (state / "jobs").glob("*.json"):
            job = read_json(path)
            if job["state"] in ("queued", "running"):
                job.update(state="interrupted", stage="restart", updated_at=now())
                atomic_json(path, job)
            self.jobs[job["job_id"]] = job
        context = mp.get_context("spawn")
        self.connection, child = context.Pipe()
        self.process = context.Process(target=run, args=(child, str(root)), daemon=True)
        self.process.start()
        child.close()
        atomic_json(
            worker_record,
            {"pid": self.process.pid, "created": psutil.Process(self.process.pid).create_time()},
        )
        self.thread = threading.Thread(target=self._poll, daemon=True)
        self.thread.start()

    def _save(self, job):
        job["updated_at"] = now()
        atomic_json(self.state / "jobs" / f"{job['job_id']}.json", job)

    def submit(self, ids):
        with self.guard:
            if not self.process.is_alive():
                raise RuntimeError("worker_unavailable")
            if sum(j["state"] in ("queued", "running") for j in self.jobs.values()) >= 8:
                raise RuntimeError("queue_full")
            job_id = "job_" + uuid.uuid4().hex
            job = {
                "schema_version": "1.0",
                "job_id": job_id,
                "attempt_id": uuid.uuid4().hex,
                "observation_ids": ids,
                "object_id": "pluto" if set(ids) == {"S12", "S14"} else "epsilon-indi-b",
                "state": "queued",
                "stage": "waiting",
                "progress": 0,
                "created_at": now(),
                "result_id": None,
                "error": None,
                "cancel_requested": False,
            }
            self.jobs[job_id] = job
            self._save(job)
            return dict(job)

    def cancel(self, job_id):
        with self.guard:
            job = self.jobs[job_id]
            if job["state"] in ("queued", "running"):
                job["cancel_requested"] = True
                if job["state"] == "queued":
                    job.update(state="cancelled", stage="cancelled")
                self._save(job)
            return dict(job)

    def _poll(self):
        while not self.stopping.is_set():
            try:
                if self.connection.poll(0.1):
                    message = self.connection.recv()
                    with self.guard:
                        self.heartbeat = time.monotonic()
                        if message["kind"] == "catalog":
                            self.catalog = message["observations"]
                        elif message["kind"] == "catalog_error":
                            self.catalog_error = message["code"]
                        elif message["kind"] == "pluto_catalog":
                            self.pluto_catalog = message["observations"]
                        elif message["kind"] == "pluto_catalog_error":
                            self.pluto_catalog_error = message["code"]
                        elif message["kind"] != "heartbeat":
                            job = self.jobs.get(message["job_id"])
                            if (
                                job
                                and self.active == job["job_id"]
                                and job["attempt_id"] == message["attempt_id"]
                                and job["state"] == "running"
                            ):
                                if job["cancel_requested"]:
                                    job.update(state="cancelled", stage="cancelled")
                                elif message["kind"] == "error":
                                    job.update(
                                        state="failed",
                                        stage="failed",
                                        error={
                                            "code": message["code"],
                                            "message_key": "errors.processing",
                                            "details": {},
                                            "request_id": job["job_id"],
                                        },
                                    )
                                else:
                                    result = message["result"]
                                    if (
                                        result.get("object_id")
                                        != job.get("object_id", "epsilon-indi-b")
                                        or [f["observation_id"] for f in result["frames"]]
                                        != job["observation_ids"]
                                    ):
                                        raise ValueError("worker_selection_mismatch")
                                    result_id = "cmp_" + digest(result)[:24]
                                    result["result_id"] = result_id
                                    target = self.state / "comparisons" / f"{result_id}.json"
                                    atomic_json(target, result)
                                    if digest(read_json(target)) != digest(result):
                                        raise RuntimeError("result_integrity")
                                    job.update(
                                        state="succeeded",
                                        stage="complete",
                                        progress=1,
                                        result_id=result_id,
                                    )
                                self._save(job)
                                self.active = None
                with self.guard:
                    if not self.process.is_alive():
                        for job in self.jobs.values():
                            if job["state"] in ("queued", "running"):
                                job.update(state="interrupted", stage="worker_stopped")
                                self._save(job)
                        return
                    if self.active is None:
                        job = next((j for j in self.jobs.values() if j["state"] == "queued"), None)
                        if job:
                            job.update(state="running", stage="reading_fits", progress=0.1)
                            self._save(job)
                            self.active = job["job_id"]
                            self.connection.send(job)
            except (EOFError, BrokenPipeError, OSError):
                with self.guard:
                    for job in self.jobs.values():
                        if job["state"] in ("running", "queued"):
                            job.update(state="interrupted", stage="worker_connection_lost")
                            self._save(job)
                return
            except (ValueError, KeyError, TypeError, RuntimeError):
                with self.guard:
                    if self.active:
                        job = self.jobs[self.active]
                        job.update(
                            state="failed",
                            stage="result_rejected",
                            error={
                                "code": "result_rejected",
                                "message_key": "errors.processing",
                                "details": {},
                                "request_id": self.active,
                            },
                        )
                        self._save(job)
                        self.active = None

    def comparison(self, result_id):
        path = self.state / "comparisons" / f"{result_id}.json"
        result = read_json(path)
        content = {key: value for key, value in result.items() if key != "result_id"}
        if "cmp_" + digest(content)[:24] != result_id:
            raise ValueError("result_integrity")
        return result

    def verify_inputs(self, comparison):
        """Check each observation/calibration actually used, from immutable manifest records."""
        records = read_json(self.root / "data/manifests/datasets.json")["files"]
        by_id = {r["id"]: r for r in records}
        reasons = []
        if comparison.get("object_id") == "pluto":
            ephemeris = self.root / "data/manifests/pluto_ephemeris.json"
            if comparison.get("ephemeris_manifest_path") != "data/manifests/pluto_ephemeris.json":
                reasons.append("ephemeris_reference_changed")
            elif not ephemeris.is_file():
                reasons.append("ephemeris_missing")
            elif hashlib.sha256(ephemeris.read_bytes()).hexdigest() != comparison.get(
                "ephemeris_manifest_sha256"
            ):
                reasons.append("ephemeris_changed")
        # All result provenance references must agree with current manifest AND actual bytes.
        for ref in self._source_refs(comparison):
            record = by_id.get(ref["id"])
            if not record or record["sha256"] != ref["sha256"]:
                reasons.append("source_manifest_changed")
                continue
            path = (self.root / record["local_relative_path"]).resolve()
            if not path.is_relative_to(self.root.resolve()) or not path.is_file():
                reasons.append("source_missing")
                continue
            actual = hashlib.sha256()
            with path.open("rb") as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b""):
                    actual.update(block)
            if actual.hexdigest() != ref["sha256"] or path.stat().st_size != record["bytes"]:
                reasons.append("source_integrity")
        return sorted(set(reasons))

    def _source_refs(self, comparison):
        found = {}
        for frame in comparison.get("frames", []):
            for key in ("provenance", "calibration"):
                ref = frame.get(key, {})
                if not isinstance(ref.get("sha256"), str) or not isinstance(ref.get("id"), str):
                    raise ValueError("missing_provenance")  # noqa: TRY004 -- malformed scientific contract
                if ref["id"] in found and found[ref["id"]]["sha256"] != ref["sha256"]:
                    raise ValueError("conflicting_provenance")
                found[ref["id"]] = {"id": ref["id"], "sha256": ref["sha256"]}
        required = (
            {"S12", "S14", "L051"}
            if comparison.get("object_id") == "pluto"
            else {"S01", "S02", "S10"}
        )
        if set(found) != required:
            raise ValueError("missing_provenance")
        return found.values()

    def close(self):
        self.stopping.set()
        self.thread.join(timeout=2)
        try:
            self.connection.send(None)
        except (EOFError, BrokenPipeError, OSError):
            pass
        self.process.join(timeout=3)
        if self.process.is_alive():
            self.process.terminate()
            self.process.join(timeout=5)
        with self.guard:
            for job in self.jobs.values():
                if job["state"] in ("queued", "running"):
                    job.update(state="interrupted", stage="shutdown")
                    self._save(job)
        self.connection.close()
        self.lock.close()
