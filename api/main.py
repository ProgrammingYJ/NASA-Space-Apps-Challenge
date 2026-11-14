import csv
import hashlib
import io
import os
import re
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from api.models import ComparisonRequest, Evidence, EvidenceRequest
from api.service import Service, now
from api.storage import atomic_json, canonical, digest, read_json

ROOT = Path(__file__).resolve().parents[1]
OBJECTS = [
    {"object_id": "pluto", "name": "Pluto", "status": "available"},
    {"object_id": "epsilon-indi-b", "name": "ε Indi B", "status": "available"},
    {"object_id": "barnards-star", "name": "Barnard’s Star", "status": "unverified"},
    {"object_id": "wise0855", "name": "WISE0855", "status": "unverified"},
    {"object_id": "rw-aurigae", "name": "RW Aurigae", "status": "unverified"},
    {"object_id": "r-draconis", "name": "R Draconis", "status": "unverified"},
]
LEGACY = {
    "barnards-star": range(1, 7),
    "wise0855": range(23, 27),
    "rw-aurigae": [*range(13, 19), *range(27, 30)],
    "r-draconis": range(7, 13),
}


def create_app(state_dir: Path | None = None):
    @asynccontextmanager
    async def lifespan(app):
        app.state.service = Service(
            ROOT, state_dir or Path(os.getenv("APP_STATE_DIR", ROOT / "var"))
        )
        yield
        app.state.service.close()

    app = FastAPI(title="Planet X · SPHEREx", version="0.2.0", lifespan=lifespan)

    @app.middleware("http")
    async def bounds(request, call_next):
        request.state.request_id = uuid.uuid4().hex
        if request.method == "POST":
            if int(request.headers.get("content-length", "0")) > 8_000_000:
                return error(request, 413, "request_too_large")
            data = bytearray()
            async for chunk in request.stream():
                data.extend(chunk)
                if len(data) > 8_000_000:
                    return error(request, 413, "request_too_large")
            request._body = bytes(data)
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    def error(request, status, code):
        return JSONResponse(
            status_code=status,
            content={
                "code": code,
                "message_key": "errors." + code,
                "details": {},
                "request_id": getattr(request.state, "request_id", "unknown"),
            },
        )

    @app.exception_handler(HTTPException)
    async def http_error(request, exc):
        return error(request, exc.status_code, str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        return error(request, 422, "invalid_request")

    @app.exception_handler(ValueError)
    async def value_error(request, exc):
        return error(request, 409, "integrity_mismatch")

    def service(request):
        return request.app.state.service

    def get_result(request, result_id):
        if not re.fullmatch(r"cmp_[a-f0-9]{24}", result_id):
            raise HTTPException(404, "result_not_found")
        try:
            return service(request).comparison(result_id)
        except FileNotFoundError:
            raise HTTPException(404, "result_not_found") from None

    @app.get("/health/live")
    def live():
        return {"status": "live"}

    @app.get("/health/ready")
    def ready(request: Request):
        svc = service(request)
        probe = svc.state / (".probe_" + uuid.uuid4().hex)
        try:
            probe.write_bytes(b"ready")
            ok = probe.read_bytes() == b"ready"
        except OSError:
            ok = False
        finally:
            try:
                probe.unlink(missing_ok=True)
            except OSError:
                pass
        heartbeat_ok = svc.process.is_alive() and time.monotonic() - svc.heartbeat < 60
        return JSONResponse(
            status_code=200 if ok and heartbeat_ok else 503,
            content={
                "status": "ready" if ok and heartbeat_ok else "unavailable",
                "storage_writable": ok,
                "worker_alive": heartbeat_ok,
            },
        )

    @app.get("/api/v1/objects")
    def objects():
        return {"objects": OBJECTS}

    @app.get("/api/v1/universe")
    def universe(epoch: str | None = None):
        from science.orbits import get_orbits
        from science.solar_system import get_universe

        try:
            value = get_universe(ROOT, epoch)
            orbits = get_orbits(ROOT, value["epoch"])
        except ValueError as exc:
            if "epoch" in str(exc):
                raise HTTPException(422, "unsupported_model_epoch") from None
            raise
        value["source_manifest_sha256"] = hashlib.sha256(
            (ROOT / "data/manifests/solar_system_ephemeris.json").read_bytes()
        ).hexdigest()
        value["orbit_manifest_sha256"] = orbits["source_manifest_sha256"]
        value["orbit_algorithm_version"] = orbits["algorithm_version"]
        value["orbit_exclusions"] = orbits["exclusions"]
        for body in value["objects"]:
            if body["object_id"] in orbits["orbits"]:
                body["orbit"] = orbits["orbits"][body["object_id"]]
        return value

    def context_reasons(session):
        context = session.universe_context
        if context is None:
            return []
        from science.solar_system import get_universe

        try:
            get_universe(ROOT, context.model_epoch)
        except ValueError:
            return ["unsupported_model_epoch"]
        source = ROOT / "data/manifests/solar_system_ephemeris.json"
        if (
            context.source_manifest_sha256
            and hashlib.sha256(source.read_bytes()).hexdigest() != context.source_manifest_sha256
        ):
            return ["universe_ephemeris_changed"]
        if context.orbit_manifest_sha256:
            orbit_source = ROOT / "data/manifests/solar_system_orbits.json"
            if (
                not orbit_source.is_file()
                or hashlib.sha256(orbit_source.read_bytes()).hexdigest()
                != context.orbit_manifest_sha256
            ):
                return ["orbit_ephemeris_changed"]
        return []

    @app.get("/api/v1/observations")
    def observations(request: Request, object_id: str = "epsilon-indi-b"):
        if object_id == "pluto":
            svc = service(request)
            if svc.pluto_catalog is None:
                raise HTTPException(
                    503, "source_unavailable" if svc.pluto_catalog_error else "loading"
                )
            return {
                "object_id": object_id,
                "observations": svc.pluto_catalog,
                "status": "available",
                "next_cursor": None,
            }
        if object_id == "epsilon-indi-b":
            svc = service(request)
            if svc.catalog is None:
                raise HTTPException(503, "source_unavailable" if svc.catalog_error else "loading")
            return {
                "object_id": object_id,
                "observations": svc.catalog,
                "status": "available",
                "next_cursor": None,
            }
        if object_id not in LEGACY:
            if object_id in {
                "sun",
                "mercury",
                "venus",
                "earth",
                "mars",
                "jupiter",
                "saturn",
                "uranus",
                "neptune",
            }:
                return {
                    "object_id": object_id,
                    "observations": [],
                    "status": "not_selected_for_comparison",
                    "next_cursor": None,
                }
            raise HTTPException(404, "object_not_found")
        records = read_json(ROOT / "data/manifests/datasets.json")["files"]
        ids = {f"L{number:03d}" for number in LEGACY[object_id]}
        return {
            "object_id": object_id,
            "observations": [],
            "status": "unverified",
            "reason": "legacy_quality_not_validated",
            "available_sources": [
                {key: r.get(key) for key in ("id", "source_url", "sha256", "bytes", "planned_use")}
                for r in records
                if r["id"] in ids
            ],
            "next_cursor": None,
        }

    @app.post("/api/v1/comparison-jobs", status_code=202)
    def comparison(body: ComparisonRequest, request: Request):
        try:
            return service(request).submit(body.observation_ids)
        except RuntimeError as exc:
            raise HTTPException(503, str(exc)) from None

    @app.get("/api/v1/jobs/{job_id}")
    def job(job_id: str, request: Request):
        svc = service(request)
        with svc.guard:
            if job_id not in svc.jobs:
                raise HTTPException(404, "job_not_found")
            return dict(svc.jobs[job_id])

    @app.post("/api/v1/jobs/{job_id}/cancel")
    def cancel(job_id: str, request: Request):
        try:
            return service(request).cancel(job_id)
        except KeyError:
            raise HTTPException(404, "job_not_found") from None

    @app.get("/api/v1/comparisons/{result_id}/manifest")
    def manifest(result_id: str, request: Request):
        return get_result(request, result_id)

    @app.post("/api/v1/evidence", status_code=201)
    def save(body: EvidenceRequest, request: Request):
        if context_reasons(body.session):
            raise HTTPException(422, "invalid_universe_context")
        result = get_result(request, body.result_id)
        if [f["observation_id"] for f in result["frames"]] != body.session.observation_ids:
            raise HTTPException(409, "selection_mismatch")
        svc = service(request)
        if svc.verify_inputs(result):
            raise HTTPException(409, "source_integrity")
        evidence = Evidence(
            schema_version="1.0",
            evidence_id="ev_" + uuid.uuid4().hex,
            created_at=now(),
            result_id=body.result_id,
            session=body.session,
            judgment=body.judgment,
            comparison=result,
            comparison_sha256=digest(result),
            ai_assistance="Code assisted by Codex; observations are original SPHEREx data.",
        )
        value = evidence.model_dump(exclude_none=True)
        with svc.guard:
            atomic_json(svc.state / "evidence" / f"{evidence.evidence_id}.json", value)
        return value

    @app.get("/api/v1/evidence/{evidence_id}/export")
    def export(evidence_id: str, request: Request, format: str = "json"):
        if not re.fullmatch(r"ev_[a-f0-9]{32}", evidence_id):
            raise HTTPException(404, "evidence_not_found")
        try:
            value = read_json(service(request).state / "evidence" / f"{evidence_id}.json")
        except FileNotFoundError:
            raise HTTPException(404, "evidence_not_found") from None
        if format == "json":
            return Response(
                canonical(value),
                media_type="application/json",
                headers={"Content-Disposition": f'attachment; filename="{evidence_id}.json"'},
            )
        if format != "csv":
            raise HTTPException(422, "invalid_format")
        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(
            [
                "evidence_id",
                "result_id",
                "object_id",
                "observation_id",
                "comparison_sha256",
                "judgment",
                "frame_json",
            ]
        )
        # JSON quotes prevent spreadsheet formula evaluation of the user-authored field.
        for frame in value["comparison"]["frames"]:
            writer.writerow(
                [
                    evidence_id,
                    value["result_id"],
                    value["session"]["object_id"],
                    frame["observation_id"],
                    value["comparison_sha256"],
                    canonical(value["judgment"]).decode(),
                    canonical(frame).decode(),
                ]
            )
        return Response(
            output.getvalue().encode("utf-8-sig"),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{evidence_id}.csv"'},
        )

    @app.post("/api/v1/evidence/import")
    def restore(body: Evidence, request: Request):
        result = body.comparison
        reasons = []
        if digest(result) != body.comparison_sha256 or result.get("result_id") != body.result_id:
            raise HTTPException(409, "integrity_mismatch")
        try:
            local = get_result(request, body.result_id)
            if digest(local) != digest(result):
                reasons.append("result_changed")
        except HTTPException:
            reasons.append("result_missing")
        from science.spherex import ALGORITHM_VERSION

        expected_algorithm = ALGORITHM_VERSION
        if body.session.object_id == "pluto":
            from science.pluto import ALGORITHM_VERSION as PLUTO_ALGORITHM_VERSION

            expected_algorithm = PLUTO_ALGORITHM_VERSION
        if result.get("object_id") != body.session.object_id:
            raise HTTPException(409, "selection_mismatch")
        if result.get("algorithm_version") != expected_algorithm:
            reasons.append("algorithm_changed")
        if [
            f.get("observation_id") for f in result.get("frames", [])
        ] != body.session.observation_ids:
            raise HTTPException(409, "selection_mismatch")
        reasons.extend(service(request).verify_inputs(result))
        reasons.extend(context_reasons(body.session))
        return {
            "status": "recalculation_required" if reasons else "restored",
            "reasons": sorted(set(reasons)),
            "session": body.session.model_dump(exclude_none=True),
            "comparison": None if reasons else result,
            "judgment": body.judgment,
            "evidence_id": body.evidence_id,
        }

    static = ROOT / "web/dist"
    if static.is_dir():
        app.mount("/assets", StaticFiles(directory=static / "assets"), name="assets")

        @app.get("/")
        def index():
            return FileResponse(static / "index.html")

    return app


app = create_app()
