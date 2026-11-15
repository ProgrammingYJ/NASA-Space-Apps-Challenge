from __future__ import annotations

import hashlib
import json
import multiprocessing as mp
import threading
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path

import psutil

from api.storage import InstanceLock, atomic_json, digest, read_json
from worker.process import run

NATIVE_TNO_SIMULATION_ALGORITHM = "jpl-sbdb-tno-two-body-v2"


def outer_tno_context_reasons(context, root: Path):
    """Check optional native TNO display pins without recalculating any orbit.

    The stored source manifest is v1; the adopted runtime two-body propagator is
    v2. Missing fields deliberately retain the previous restoration behaviour.
    """
    expected = context.outer_tno_manifest_sha256
    algorithm = context.native_tno_simulation_algorithm_version
    if expected is None and algorithm is None:
        return []
    try:
        raw = (root / "data/manifests/outer_tno.json").read_bytes()
    except OSError:
        return ["outer_tno_data_unavailable"]
    if expected is not None and hashlib.sha256(raw).hexdigest() != expected:
        return ["outer_tno_sources_changed"]
    try:
        source = json.loads(raw)
        if (
            source.get("schema_version") != "1.0"
            or source.get("algorithm_version") != "jpl-sbdb-tno-two-body-v1"
            or source.get("time_scale") != "TDB"
            or source.get("coordinate_frame") != "heliocentric_IAU76_80_ecliptic_J2000"
        ):
            return ["outer_tno_data_unavailable"]
    except (ValueError, AttributeError):
        return ["outer_tno_data_unavailable"]
    if algorithm is not None and algorithm != NATIVE_TNO_SIMULATION_ALGORITHM:
        return ["native_tno_algorithm_changed"]
    return []


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
        self.catalogues = {}
        self.catalogue_errors = {}
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

    def registry(self):
        from science.registered_observations import load_registry

        return load_registry(root=self.root, registry_path=self.root / "data/manifests/observation_registry.json")

    def resolve_pair(self, ids, object_id=None):
        from science.registered_observations import resolve_registered_pair

        return resolve_registered_pair(ids, root=self.root, registry_path=self.root / "data/manifests/observation_registry.json", object_id=object_id)

    def registered_objects(self):
        registry = self.registry()
        return [{"object_id": key, "name": value["name"], "status": "available", "default_pair": value["default_pair"],
                 "observation_ids": [identifier for identifier, entry in registry["exposures"].items() if entry["object_id"] == key and entry.get("enabled") is True]}
                for key, value in registry["objects"].items()]

    def submit(self, ids):
        selection = self.resolve_pair(ids)
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
                "object_id": selection["object_id"],
                "algorithm_version": selection["algorithm_version"],
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
                        if message["kind"] == "registered_catalog":
                            self.catalogues[message["object_id"]] = message["observations"]
                            if message["object_id"] == "epsilon-indi-b":
                                self.catalog = message["observations"]
                            elif message["object_id"] == "pluto":
                                self.pluto_catalog = message["observations"]
                        elif message["kind"] == "registered_catalog_error":
                            self.catalogue_errors[message["object_id"]] = message["code"]
                        elif message["kind"] == "catalog":
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
        if comparison.get("algorithm_version") == "spherex-registered-native-v1":
            registry = self.root / "data/manifests/observation_registry.json"
            if comparison.get("registry_manifest_path") != "data/manifests/observation_registry.json":
                reasons.append("observation_registry_reference_changed")
            elif not registry.is_file():
                reasons.append("observation_registry_missing")
            elif hashlib.sha256(registry.read_bytes()).hexdigest() != comparison.get("registry_manifest_sha256"):
                reasons.append("observation_registry_changed")
            from science.spherex import verify_source

            for reference in comparison.get("prediction_source_refs", []):
                try:
                    verify_source(self.root, reference)
                except (ValueError, OSError, KeyError, TypeError):
                    reasons.append("prediction_source_integrity")
        if comparison.get("object_id") == "pluto" and comparison.get("algorithm_version") == "pluto-native-v1":
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
        ids = [frame["observation_id"] for frame in comparison.get("frames", [])]
        algorithm = comparison.get("algorithm_version")
        if algorithm in {"spherex-native-v1", "pluto-native-v1"}:
            # The four immutable original results predate the registry. Their
            # exact algorithm/object/order tuple defines their independent closure.
            epsilon = algorithm == "spherex-native-v1"
            target = "epsilon-indi-b" if epsilon else "pluto"
            pair = {"S01", "S02"} if epsilon else {"S12", "S14"}
            if comparison.get("object_id") != target or len(ids) != 2 or set(ids) != pair:
                raise ValueError("legacy_comparison_selection_mismatch")
            required = pair | ({"S10"} if epsilon else {"L051"})
        else:
            selection = self.resolve_pair(ids, comparison.get("object_id"))
            if algorithm == "spherex-registered-native-v1" and selection["algorithm_version"] != algorithm:
                raise ValueError("registered_comparison_algorithm_mismatch")
            required = set(selection["source_ids"]) | set(selection["calibration_ids"])
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
