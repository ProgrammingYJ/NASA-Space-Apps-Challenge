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

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from api.models import ComparisonRequest, Evidence, EvidenceRequest, MassScenarioInput
from api.service import Service, now, outer_tno_context_reasons
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


def migrate_solar_session(session, appearance_hash=None, compatible_references=None):
    """Retain typed legacy input fields only for explicit partial restoration."""
    active = session.model_copy(deep=True)
    omitted = []
    groups = {
        "galaxies": ["galaxy_manifest_sha256", "show_galaxies"],
        "observer_physics": [
            "observer_physics_manifest_sha256",
            "observer_experiment",
            "observer_panel_open",
        ],
        "black_holes": ["black_holes_manifest_sha256", "selected_black_hole_id"],
    }
    if active.universe_context:
        changes = {}
        for feature, keys in groups.items():
            paths = [
                "universe_context." + key
                for key in keys
                if getattr(active.universe_context, key) not in (None, False)
            ]
            changes.update({key: False if key == "show_galaxies" else None for key in keys})
            if paths:
                omitted.append(
                    {
                        "feature": feature,
                        "paths": paths,
                        "reason": "feature_removed_from_1000au_scope",
                    }
                )
        if (
            appearance_hash
            and active.universe_context.appearance_manifest_sha256
            and active.universe_context.appearance_manifest_sha256 != appearance_hash
        ):
            changes["appearance_manifest_sha256"] = None
            omitted.append({
                "feature": "appearance",
                "paths": ["universe_context.appearance_manifest_sha256"],
                "reason": "visual_sources_updated_observation_preserved",
            })
        for item in compatible_references or []:
            field = item["field"]
            if field in {"small_body_appearance_manifest_sha256", "mass_scenarios_manifest_sha256"} and getattr(active.universe_context, field) == item["from_sha256"]:
                changes[field] = item["to_sha256"]
                omitted.append({
                    "feature": field.removesuffix("_manifest_sha256"),
                    "paths": ["universe_context." + field],
                    "reason": "display_dependency_refreshed_scientific_values_identical",
                })
        active.universe_context = active.universe_context.model_copy(update=changes)
    value = active.model_dump(exclude_none=True)
    if value.get("universe_context"):
        for keys in groups.values():
            for key in keys:
                value["universe_context"].pop(key, None)
    return active, value, omitted


def create_app(state_dir: Path | None = None):
    @asynccontextmanager
    async def lifespan(app):
        app.state.service = Service(
            ROOT, state_dir or Path(os.getenv("APP_STATE_DIR", ROOT / "var"))
        )
        yield
        app.state.service.close()

    app = FastAPI(title="Planet X · SPHEREx", version="0.16.0", lifespan=lifespan)

    @app.middleware("http")
    async def bounds(request, call_next):
        request.state.request_id = uuid.uuid4().hex
        if re.match(
            r"^/api/v1/(?:black-holes|observer-physics|cosmic-history|cosmic-observations|physics|catalog/(?:galaxies|galaxy-atlas|exoplanets|exoplanet-observations|extragalactic-planets|universe|comets))(?:/|$)",
            request.url.path,
        ):
            return error(request, 410, "outside_1000au_scope")
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

    @app.get("/api/v1/runtime")
    def runtime_capabilities(request: Request):
        registry = service(request).registry()
        return {
            "schema_version": "1.0",
            "runtime": "python",
            "observation_processing": "runtime_fits_or_verified_cache",
            "supported_observation_pairs": registry["pairs"],
            "ordered_comparison_count": len(registry["pairs"]) * 2,
            "arbitrary_fits_inputs": False,
        }

    @app.get("/api/v1/objects")
    def objects(request: Request):
        return {"objects": service(request).registered_objects()}

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

    @app.get("/api/v1/small-body-appearance")
    def small_body_appearance():
        from science.small_body_appearance import get_small_body_appearance

        try:
            return get_small_body_appearance(ROOT)
        except (ValueError, FileNotFoundError):
            raise HTTPException(503, "small_body_appearance_unavailable") from None

    @app.get("/api/v1/planet-criteria")
    def planet_criteria(object_id: str | None = None):
        from science.planet_criteria import get_planet_criteria

        try:
            return get_planet_criteria(ROOT, object_id=object_id)
        except FileNotFoundError:
            raise HTTPException(503, "planet_criteria_unavailable") from None
        except ValueError as error:
            if str(error) == "unknown_planet_criteria_object":
                raise HTTPException(422, "unsupported_planet_criteria_object") from None
            raise HTTPException(503, "planet_criteria_unavailable") from None

    def mass_scenario_source():
        from science.mass_scenarios import get_mass_scenarios

        try:
            return get_mass_scenarios(ROOT)
        except (ValueError, FileNotFoundError):
            raise HTTPException(503, "mass_scenario_source_unavailable") from None

    def evaluate_mass_scenario(body: MassScenarioInput, source: dict):
        from science.mass_scenarios import calculate_mass_scenario

        target = source["targets"][body.target_id]
        density_bounds = None
        if body.analogue_id is not None:
            analogue = source["analogues"][body.analogue_id]
            if not abs(body.density_kg_m3 - analogue["density_kg_m3"]) < 1e-8:
                raise ValueError("analogue_density_mismatch")
            sigma = analogue.get("density_sigma_kg_m3")
            if body.include_source_ranges and sigma is not None:
                density_bounds = [body.density_kg_m3 - sigma, body.density_kg_m3 + sigma]
        radius_bounds = None
        if body.include_source_ranges and target.get("radius_low_km") is not None:
            radius_bounds = [target["radius_low_km"], target["radius_high_km"]]
        return calculate_mass_scenario(
            target["radius_km"],
            body.density_kg_m3,
            radius_bounds_km=radius_bounds,
            density_bounds_kg_m3=density_bounds,
            semimajor_axis_au=target["semimajor_axis_au"],
        )

    @app.get("/api/v1/mass-scenarios")
    def mass_scenarios():
        return mass_scenario_source()

    @app.post("/api/v1/mass-scenarios/calculate")
    def mass_scenario_calculate(body: MassScenarioInput):
        source = mass_scenario_source()
        try:
            result = evaluate_mass_scenario(body, source)
        except ValueError:
            raise HTTPException(422, "invalid_mass_scenario") from None
        return {
            **result,
            "inputs": body.model_dump(),
            "source_manifest_sha256": source["source_manifest_sha256"],
        }

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
        except ValueError as exc:
            if str(exc) in {
                "invalid_long_term_calendar",
                "long_term_epoch_out_of_range",
                "unsupported_long_term_table",
            }:
                raise HTTPException(422, "unsupported_simulation_date") from None
            raise HTTPException(503, "simulation_source_unavailable") from None

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
            (
                context.mass_scenarios_manifest_sha256,
                "mass_scenarios.json",
                "mass_scenario_sources_changed",
            ),
            (
                context.planet_criteria_manifest_sha256,
                "planet_criteria.json",
                "planet_criteria_sources_changed",
            ),
            (context.appearance_manifest_sha256, "appearance.json", "appearance_sources_changed"),
            (
                context.small_body_appearance_manifest_sha256,
                "small_body_appearance.json",
                "small_body_appearance_sources_changed",
            ),
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
        native_tno_reasons = outer_tno_context_reasons(context, ROOT)
        if native_tno_reasons:
            return native_tno_reasons
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
        if context.small_body_appearance_manifest_sha256:
            from science.small_body_appearance import get_small_body_appearance

            try:
                get_small_body_appearance(ROOT)
            except (ValueError, FileNotFoundError):
                return ["small_body_appearance_data_unavailable"]
        if context.planet_criteria_manifest_sha256:
            from science.planet_criteria import get_planet_criteria

            try:
                get_planet_criteria(ROOT)
            except (ValueError, FileNotFoundError):
                return ["planet_criteria_data_unavailable"]
        if context.mass_scenarios_manifest_sha256:
            try:
                source = mass_scenario_source()
                if context.mass_scenario is not None:
                    evaluate_mass_scenario(context.mass_scenario, source)
            except (ValueError, FileNotFoundError, HTTPException):
                return ["mass_scenario_data_unavailable"]
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
        svc = service(request)
        registry = svc.registry()
        target = registry["objects"].get(object_id)
        if target is not None:
            if object_id not in svc.catalogues:
                raise HTTPException(503, "source_unavailable" if object_id in svc.catalogue_errors else "loading")
            return {
                "object_id": object_id,
                "observations": svc.catalogues[object_id],
                "status": "available",
                "default_pair": target["default_pair"],
                "available_pairs": [ids for ids in registry["pairs"] if registry["exposures"][ids[0]]["object_id"] == object_id],
                "next_cursor": None,
            }
        if any(obj["object_id"] == object_id for obj in universe()["objects"]) or any(obj["object_id"] == object_id for obj in extended_catalog()["objects"]):
            return {"object_id": object_id, "observations": [], "status": "no_linked_observations", "next_cursor": None}
        raise HTTPException(404, "object_not_found")

    @app.post("/api/v1/comparison-jobs", status_code=202)
    def comparison(body: ComparisonRequest, request: Request):
        try:
            return service(request).submit(body.observation_ids)
        except ValueError:
            raise HTTPException(422, "invalid_request") from None
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
        try:
            service(request).resolve_pair(body.session.observation_ids, body.session.object_id)
        except ValueError:
            raise HTTPException(422, "invalid_request") from None
        active, session_value, omitted = migrate_solar_session(body.session)
        if omitted:
            raise HTTPException(422, "removed_context_requires_import")
        if context_reasons(active):
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
        value["session"] = session_value
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
        try:
            selection = service(request).resolve_pair(body.session.observation_ids, body.session.object_id)
        except ValueError:
            raise HTTPException(409, "selection_mismatch") from None
        expected_algorithm = selection["algorithm_version"]
        if result.get("object_id") != body.session.object_id:
            raise HTTPException(409, "selection_mismatch")
        if result.get("algorithm_version") != expected_algorithm:
            reasons.append("algorithm_changed")
        if [
            f.get("observation_id") for f in result.get("frames", [])
        ] != body.session.observation_ids:
            raise HTTPException(409, "selection_mismatch")
        reasons.extend(service(request).verify_inputs(result))
        appearance_path = ROOT / "data/manifests/appearance.json"
        appearance_hash = None
        if appearance_path.is_file():
            try:
                from science.appearance import get_appearance

                get_appearance(ROOT)
                appearance_hash = hashlib.sha256(appearance_path.read_bytes()).hexdigest()
            except (ValueError, FileNotFoundError):
                pass
        compatible_references = []
        if body.session.universe_context:
            from science.display_compatibility import resolve_display_compatibility

            for field, name in [("small_body_appearance_manifest_sha256", "small_body_appearance.json"), ("mass_scenarios_manifest_sha256", "mass_scenarios.json")]:
                previous_hash = getattr(body.session.universe_context, field)
                current_path = ROOT / "data/manifests" / name
                current_hash = hashlib.sha256(current_path.read_bytes()).hexdigest() if current_path.is_file() else None
                if previous_hash and current_hash and previous_hash != current_hash:
                    verified = resolve_display_compatibility(ROOT, field, previous_hash, current_hash)
                    if verified:
                        compatible_references.append(verified)
        active, session_value, omitted = migrate_solar_session(body.session, appearance_hash, compatible_references)
        reasons.extend(context_reasons(active))
        return {
            "response_schema_version": "1.1",
            "status": "recalculation_required"
            if reasons
            else "partially_restored"
            if omitted
            else "restored",
            "restoration_scope": "observation_and_solar_system",
            "migration_policy": "solar-scope-context-v1",
            "omitted_contexts": omitted,
            "reasons": sorted(set(reasons)),
            "session": session_value,
            "comparison": None if reasons else result,
            "judgment": body.judgment,
            "evidence_id": body.evidence_id,
        }

    static = ROOT / "web/dist"
    if static.is_dir():
        app.mount("/assets", StaticFiles(directory=static / "assets"), name="assets")
        if (static / "textures").is_dir():
            app.mount("/textures", StaticFiles(directory=static / "textures"), name="textures")
        if (static / "brand").is_dir():
            app.mount("/brand", StaticFiles(directory=static / "brand"), name="brand")

        @app.get("/")
        def index():
            return FileResponse(static / "index.html")

    return app


app = create_app()
