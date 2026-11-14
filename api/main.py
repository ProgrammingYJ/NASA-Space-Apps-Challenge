import csv
import hashlib
import io
import os
import re
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
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

    app = FastAPI(title="Planet X · SPHEREx", version="0.6.0", lifespan=lifespan)

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
        from science.solar_system import DEFAULT_EPOCH
        from science.timeline import sample_timeline

        if epoch is not None:
            try:
                parsed = datetime.fromisoformat(epoch)
            except ValueError:
                raise HTTPException(422, "unsupported_model_epoch") from None
            if parsed.tzinfo is None:
                raise HTTPException(422, "unsupported_model_epoch")
        try:
            value = sample_timeline(ROOT, epoch or DEFAULT_EPOCH)
            orbits = get_orbits(ROOT, value["guide_reference_epoch"])
        except ValueError as exc:
            if str(exc) == "unsupported_timeline_epoch":
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

    @app.get("/api/v1/timeline")
    def timeline():
        from science.timeline import get_timeline

        return get_timeline(ROOT)

    @lru_cache(maxsize=1)
    def exoplanet_catalog():
        from science.exoplanets import load_catalog

        try:
            return load_catalog(ROOT)
        except FileNotFoundError:
            raise HTTPException(503, "catalog_unavailable") from None

    @app.get("/api/v1/catalog/exoplanets")
    def exoplanets():
        from science.exoplanets import index

        return index(exoplanet_catalog())

    @app.get("/api/v1/catalog/exoplanets/{object_id}")
    def exoplanet(object_id: str):
        from science.exoplanets import planet

        value = planet(exoplanet_catalog(), object_id)
        if value is None:
            raise HTTPException(404, "object_not_found")
        return value

    @lru_cache(maxsize=1)
    def extended_catalog():
        from science.extended_solar import get_extended_solar

        try:
            value = get_extended_solar(ROOT, include_vectors=False)
        except FileNotFoundError:
            raise HTTPException(503, "catalog_unavailable") from None
        value["source_manifest_sha256"] = hashlib.sha256(
            (ROOT / "data/manifests/extended_solar.json").read_bytes()
        ).hexdigest()
        value["display_algorithm_version"] = "extended-solar-parent-hermite-v1"
        return value

    @lru_cache(maxsize=16)
    def extended_parent_catalog(parent_id: str):
        from science.extended_solar import get_extended_solar

        value = get_extended_solar(ROOT, parent_id=parent_id)
        return {
            **value,
            "source_manifest_sha256": hashlib.sha256(
                (ROOT / "data/manifests/extended_solar.json").read_bytes()
            ).hexdigest(),
            "display_algorithm_version": "extended-solar-parent-hermite-v1",
        }

    @app.get("/api/v1/catalog/solar-system")
    def extended_solar(parent_id: str | None = None):
        from science.extended_solar import CATALOG_PARENTS

        if parent_id is not None and parent_id not in CATALOG_PARENTS:
            raise HTTPException(422, "unknown_extended_parent")
        if parent_id is not None:
            return extended_parent_catalog(parent_id)
        value = extended_catalog()
        return {
            **value,
            "objects": [
                {key: item for key, item in obj.items() if key != "knots"}
                for obj in value["objects"]
            ],
        }

    @lru_cache(maxsize=1)
    def appearance_catalog():
        from science.appearance import get_appearance

        try:
            return get_appearance(ROOT)
        except FileNotFoundError:
            raise HTTPException(503, "appearance_unavailable") from None

    @app.get("/api/v1/appearance")
    def appearance():
        return appearance_catalog()

    @app.get("/api/v1/cosmic-history")
    def cosmic_history():
        from science.history import get_cosmic_history
        from science.history_morphology import get_history_morphology

        try:
            return {
                **get_cosmic_history(ROOT),
                "morphology_reference": get_history_morphology(ROOT),
            }
        except (FileNotFoundError, ValueError):
            raise HTTPException(503, "history_source_unavailable") from None

    @app.get("/api/v1/cosmic-history/sample")
    def cosmic_history_sample(age_gyr: float = Query(0, ge=0, le=13.8, allow_inf_nan=False)):
        from science.history import sample_history

        return sample_history(ROOT, age_gyr)

    @app.get("/api/v1/cosmic-observations")
    def cosmic_observations():
        from science.history_observations import get_cosmic_observations

        try:
            return get_cosmic_observations(ROOT)
        except (FileNotFoundError, ValueError):
            raise HTTPException(503, "history_observation_unavailable") from None

    @app.get("/api/v1/catalog/galaxies")
    def galaxies():
        from science.galaxies import get_galaxies

        return get_galaxies(ROOT)

    @app.get("/api/v1/kuiper-belt")
    def kuiper_belt():
        from science.kuiper import get_kuiper_display

        return get_kuiper_display(ROOT)

    @app.get("/api/v1/long-term-model")
    def long_term_model():
        from science.long_term_model import get_long_term_model

        try:
            return get_long_term_model(ROOT)
        except (ValueError, FileNotFoundError):
            raise HTTPException(503, "simulation_source_unavailable") from None

    @app.get("/api/v1/long-term-simulation")
    def long_term_simulation(year: int, month: int = 1, day: int = 1, hour: float = 0):
        from science.long_term_model import sample_long_term

        try:
            return sample_long_term(ROOT, year, month, day, hour)
        except FileNotFoundError:
            raise HTTPException(503, "simulation_source_unavailable") from None
        except ValueError:
            raise HTTPException(422, "unsupported_simulation_date") from None

    @app.get("/api/v1/catalog/universe")
    def universe_catalog(galaxy_id: str | None = None, parent_id: str | None = None):
        from science.universe_catalog import get_universe_catalog

        try:
            return get_universe_catalog(ROOT, galaxy_id=galaxy_id, parent_id=parent_id)
        except FileNotFoundError:
            raise HTTPException(503, "universe_catalog_unavailable") from None
        except ValueError as exc:
            if str(exc) in {
                "unknown_universe_galaxy",
                "unknown_universe_parent",
                "universe_parent_galaxy_mismatch",
            }:
                raise HTTPException(422, "unsupported_catalog_selection") from None
            raise HTTPException(503, "universe_catalog_unavailable") from None

    def context_reasons(session):
        context = session.universe_context
        if context is None:
            return []
        from science.solar_system import DEFAULT_EPOCH, get_universe

        try:
            if context.timeline_algorithm_version:
                from science.timeline import sample_timeline

                sample_timeline(ROOT, context.model_epoch)
            else:
                get_universe(ROOT, context.model_epoch)
                if context.orbit_manifest_sha256 and datetime.fromisoformat(
                    context.model_epoch
                ) != datetime.fromisoformat(DEFAULT_EPOCH):
                    return ["orbit_guide_reference_changed"]
        except ValueError:
            return ["unsupported_model_epoch"]
        except FileNotFoundError:
            return ["universe_ephemeris_unavailable"]
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
        for expected, filename, reason in (
            (context.galaxy_manifest_sha256, "galaxies.json", "galaxy_sources_changed"),
            (context.appearance_manifest_sha256, "appearance.json", "appearance_sources_changed"),
            (
                context.extended_solar_manifest_sha256,
                "extended_solar.json",
                "extended_solar_sources_changed",
            ),
        ):
            path = ROOT / "data/manifests" / filename
            if expected and (
                not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected
            ):
                return [reason]
        # Verify the actual bytes without rebuilding the display's numerical
        # arrays or evicting its immutable cache on each save/import.
        from science.appearance import get_appearance
        from science.extended_solar import get_extended_solar

        for expected, reader, reason in (
            (
                context.appearance_manifest_sha256,
                lambda: get_appearance(ROOT),
                "appearance_data_unavailable",
            ),
            (
                context.extended_solar_manifest_sha256,
                lambda: get_extended_solar(ROOT, include_vectors=False),
                "extended_solar_data_unavailable",
            ),
        ):
            if expected:
                try:
                    reader()
                except (ValueError, FileNotFoundError, HTTPException):
                    return [reason]
        if context.galaxy_manifest_sha256:
            from science.galaxies import get_galaxies

            try:
                get_galaxies(ROOT)
            except (ValueError, FileNotFoundError):
                return ["galaxy_data_unavailable"]
        if context.simulation_context:
            from science.long_term_model import get_long_term_model

            try:
                model = get_long_term_model(ROOT)
            except (ValueError, FileNotFoundError):
                return ["simulation_data_unavailable"]
            if model["source_manifest_sha256"] != context.simulation_context.source_manifest_sha256:
                return ["simulation_model_changed"]
            from science.long_term_model import calendar_jd

            # Calendar-label arithmetic: no historical UTC/TDB conversion.
            jd = context.simulation_context.model_calendar_ms / 86400000 + 2440587.5
            low, high = model["coverage"]["min_date"], model["coverage"]["max_date"]
            if not calendar_jd(**low) <= jd <= calendar_jd(**high):
                return ["unsupported_simulation_date"]
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
        if (static / "textures").is_dir():
            app.mount("/textures", StaticFiles(directory=static / "textures"), name="textures")
        if (static / "observations").is_dir():
            app.mount(
                "/observations",
                StaticFiles(directory=static / "observations"),
                name="observation-images",
            )

        @app.get("/")
        def index():
            return FileResponse(static / "index.html")

    return app


app = create_app()
