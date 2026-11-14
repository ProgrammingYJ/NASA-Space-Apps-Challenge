"""Run against an extracted release's live API; no mocks or production writes."""

import hashlib
import json
import sys
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def call(base, path, body=None):
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    request = Request(base + path, data=data, headers={"Content-Type": "application/json"})
    with urlopen(request, timeout=60) as response:
        content = response.read()
        return (
            json.loads(content)
            if response.headers.get_content_type() == "application/json"
            else content
        )


def main(base):
    assert call(base, "/health/live")["status"] == "live"
    for _ in range(40):
        try:
            assert call(base, "/health/ready")["status"] == "ready"
            break
        except HTTPError:
            time.sleep(0.25)
    else:
        raise RuntimeError("Release never became ready")
    observations = call(base, "/api/v1/observations")["observations"]
    assert [item["observation_id"] for item in observations] == ["S01", "S02"]
    assert b"/assets/" in call(base, "/")
    job = call(base, "/api/v1/comparison-jobs", {"observation_ids": ["S01", "S02"]})
    for _ in range(160):
        job = call(base, "/api/v1/jobs/" + job["job_id"])
        if job["state"] not in ("queued", "running"):
            break
        time.sleep(0.25)
    assert job["state"] == "succeeded", job
    result = call(base, "/api/v1/comparisons/" + job["result_id"] + "/manifest")
    assert [frame["quality"]["pixel_count"] for frame in result["frames"]] == [29, 32]
    saved = call(
        base,
        "/api/v1/evidence",
        {
            "result_id": result["result_id"],
            "session": {
                "object_id": "epsilon-indi-b",
                "observation_ids": ["S01", "S02"],
                "active_frame": "B",
                "view_mode": "split",
                "contrast": 1.3,
                "locale": "ko",
            },
            "judgment": "Release smoke: 원본 품질 확인, 천체 연관/운동 검증 보류.",
        },
    )
    exported = call(base, "/api/v1/evidence/" + saved["evidence_id"] + "/export")
    restored = call(base, "/api/v1/evidence/import", exported)
    assert restored["status"] == "restored"
    assert restored["comparison"] == result
    assert restored["session"] == saved["session"]
    assert restored["judgment"] == saved["judgment"]
    scene = call(base, "/api/v1/universe")
    assert len(scene["objects"]) == 11 and len(scene["available_epochs"]) == 4
    assert scene["coordinate_frame"] and scene["source_manifest_sha256"]
    assert len([body for body in scene["objects"] if body.get("orbit")]) == 9
    assert scene["orbit_manifest_sha256"]
    timeline = call(base, "/api/v1/timeline")
    assert timeline["algorithm_version"] == "display-hermite-v1"
    assert len(timeline["knots"]) == 4
    assert timeline["validation"]["sample_count"] == 27
    moving_scene = call(base, "/api/v1/universe?epoch=2026-11-14T12:00:00Z")
    assert moving_scene["position_sampling"] == "display_interpolation"
    assert moving_scene["source_manifest_sha256"] == scene["source_manifest_sha256"]
    assert all(
        body["orbit"]["epoch"] == timeline["guide_reference_epoch"]
        for body in moving_scene["objects"]
        if body.get("orbit")
    )
    appearance = call(base, "/api/v1/appearance")
    assert len(appearance["objects"]) >= 31 and len(appearance["rings"]) == 4
    assert "saturn" in appearance["objects"] and "moon-301" in appearance["objects"]
    for entry in appearance["objects"].values():
        image = call(base, entry["texture_url"])
        assert hashlib.sha256(image).hexdigest() == entry["sha256"]
    extended = call(base, "/api/v1/catalog/solar-system")
    assert len(extended["objects"]) == 476
    assert sum(obj["kind"] == "moon" for obj in extended["objects"]) == 468
    assert sum(obj["status"] == "available" for obj in extended["objects"]) == 471
    for parent in ("haumea", "eris", "quaoar", "orcus", "makemake", "gonggong"):
        subset = call(base, "/api/v1/catalog/solar-system?parent_id=" + parent)
        assert all(obj["parent_id"] == parent for obj in subset["objects"])
    exoplanets = call(base, "/api/v1/catalog/exoplanets")
    assert len(exoplanets["objects"]) == exoplanets["planet_count"] == 6470
    selected = next(obj for obj in exoplanets["objects"] if obj["name"] == "TRAPPIST-1 e")
    exoplanet = call(base, "/api/v1/catalog/exoplanets/" + selected["object_id"])
    assert exoplanet["surface_status"] == "unresolved_illustration"
    assert len(exoplanet["system_planets"]) == 7
    history = call(base, "/api/v1/cosmic-history")
    assert len(history["stages"]) == 10 and history["reference_age_gyr"] == 13.8
    assert len(history["morphology_reference"]["examples"]) == 6
    assert history["morphology_reference"]["algorithm_version"] == "cosmic-morphology-reference-v1"
    assert not history["morphology_reference"]["visual_policy"]["morphology_fractions_available"]
    sample = call(base, "/api/v1/cosmic-history/sample?age_gyr=9.2")
    assert sample["stage_id"] == "solar_system" and sample["lookback_gyr"] == 4.6
    observed_history = call(base, "/api/v1/cosmic-observations")
    assert observed_history["algorithm_version"] == "cosmic-observation-viewer-v1"
    assert len(observed_history["objects"]) == 5
    for case in observed_history["objects"]:
        assert (
            hashlib.sha256(call(base, case["image"]["url"])).hexdigest() == case["image"]["sha256"]
        )
        assert case["image"]["kind"] == "published_observation_composite"
        assert case["image"]["credit"] and case["image"]["license"]
    galaxies = call(base, "/api/v1/catalog/galaxies")
    assert len(galaxies["objects"]) == 9
    assert all(obj["distance_mpc"] > 0 for obj in galaxies["objects"])
    morphology = {obj["object_id"]: obj["appearance"] for obj in galaxies["objects"]}
    assert morphology["galaxy-m87"]["renderer"] == "elliptical_jet"
    assert morphology["galaxy-m31"]["inclination_deg"] == 77
    kuiper = call(base, "/api/v1/kuiper-belt")
    assert kuiper["range_au"] == [30, 50]
    model = call(base, "/api/v1/long-term-model")
    assert model["algorithm_version"] == "jpl-kepler-long-term-v1"
    assert len(model["tables"]["long"]["bodies"]) == 8
    for year in (-2999, 0, 99, 2500, 3000):
        simulation = call(base, f"/api/v1/long-term-simulation?year={year}")
        assert simulation["position_kind"] == "approximate_simulation"
        assert len(simulation["objects"]) == 8
        assert (
            next(v for v in simulation["objects"] if v["object_id"] == "earth")["model_body_id"]
            == "earth-moon-barycenter"
        )
    hierarchy = call(base, "/api/v1/catalog/universe")
    assert len(hierarchy["objects"]) == 24
    members = call(base, "/api/v1/catalog/universe?galaxy_id=galaxy-milky-way")
    assert len(members["objects"]) == 4871
    host = next(v for v in members["objects"] if v["name"] == "TRAPPIST-1")
    host_children = call(base, "/api/v1/catalog/universe?parent_id=" + host["object_id"])
    assert len(host_children["objects"]) == 7
    pluto_job = call(base, "/api/v1/comparison-jobs", {"observation_ids": ["S12", "S14"]})
    for _ in range(160):
        pluto_job = call(base, "/api/v1/jobs/" + pluto_job["job_id"])
        if pluto_job["state"] not in ("queued", "running"):
            break
        time.sleep(0.25)
    assert pluto_job["state"] == "succeeded", pluto_job
    pluto = call(base, "/api/v1/comparisons/" + pluto_job["result_id"] + "/manifest")
    assert pluto["object_id"] == "pluto"
    assert pluto["frames"][0]["metadata"]["epsf"]["rows"] == 451
    pluto_saved = call(
        base,
        "/api/v1/evidence",
        {
            "result_id": pluto["result_id"],
            "session": {
                "object_id": "pluto",
                "observation_ids": ["S12", "S14"],
                "universe_context": {
                    "selected_object_id": "pluto",
                    "model_epoch": moving_scene["epoch"],
                    "panel_open": True,
                    "source_manifest_sha256": scene["source_manifest_sha256"],
                    "orbit_manifest_sha256": scene["orbit_manifest_sha256"],
                    "show_orbits": False,
                    "timeline_algorithm_version": timeline["algorithm_version"],
                    "playback_rate_hours_per_second": 72,
                    "playback_paused": True,
                    "follow_object_id": "pluto",
                    "appearance_manifest_sha256": appearance["source_manifest_sha256"],
                    "extended_solar_manifest_sha256": extended["source_manifest_sha256"],
                    "galaxy_manifest_sha256": galaxies["source_manifest_sha256"],
                    "show_kuiper_belt": False,
                    "show_galaxies": True,
                    "kuiper_display_version": "kuiper-region-v1",
                    "simulation_context": {
                        "algorithm_version": "jpl-kepler-long-term-v1",
                        "source_manifest_sha256": model["source_manifest_sha256"],
                        "model_calendar_ms": -62167219200000,
                        "playback_rate_hours_per_second": 876600,
                        "playback_paused": True,
                    },
                    "camera": {
                        "position": [0, 95, 150],
                        "target": [0, 0, 0],
                        "representation_version": "solar-display-v1",
                    },
                },
            },
            "judgment": "Pluto: actual original pixels and observer prediction; motion not measured.",
        },
    )
    pluto_restore = call(base, "/api/v1/evidence/import", pluto_saved)
    assert pluto_restore["status"] == "restored"
    assert pluto_restore["session"] == pluto_saved["session"]
    assert pluto_restore["comparison"] == pluto
    print(
        json.dumps(
            {
                "status": "passed",
                "result_id": result["result_id"],
                "evidence_id": saved["evidence_id"],
                "quality_pixels": [29, 32],
                "scene_object_count": len(scene["objects"]),
                "timeline_midpoint": moving_scene["epoch"],
                "timeline_validation_samples": timeline["validation"]["sample_count"],
                "appearance_maps": len(appearance["objects"]),
                "solar_extension_objects": len(extended["objects"]),
                "exoplanets": len(exoplanets["objects"]),
                "legacy_history_milestones": len(history["stages"]),
                "history_morphology_examples": len(history["morphology_reference"]["examples"]),
                "simulation_model_bodies": len(model["tables"]["long"]["bodies"]),
                "simulation_dates_tested": [-2999, 0, 99, 2500, 3000],
                "curated_hierarchy_objects": len(hierarchy["objects"]),
                "milky_way_entries": len(members["objects"]),
                "trappist_planets": len(host_children["objects"]),
                "observed_history_cases": len(observed_history["objects"]),
                "galaxies": len(galaxies["objects"]),
                "kuiper_range_au": kuiper["range_au"],
                "pluto_result_id": pluto["result_id"],
                "pluto_evidence_id": pluto_saved["evidence_id"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000")
