"""Run against an extracted release's live API; no mocks or production writes."""

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
                    "playback_rate_hours_per_second": 24,
                    "playback_paused": True,
                    "follow_object_id": "pluto",
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
                "pluto_result_id": pluto["result_id"],
                "pluto_evidence_id": pluto_saved["evidence_id"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000")
