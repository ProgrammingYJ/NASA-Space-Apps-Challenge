"""Exercise the public 1000 AU release with actual local observations and no mocks."""

import hashlib
import json
import sys
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def call(base, path, body=None):
    data = json.dumps(body, ensure_ascii=False, allow_nan=False).encode() if body is not None else None
    with urlopen(Request(base + path, data=data, headers={"Content-Type": "application/json"}), timeout=60) as response:
        raw = response.read()
        return json.loads(raw) if response.headers.get_content_type() == "application/json" else raw


def main(base):
    root = Path(__file__).resolve().parents[1]
    bundle = json.loads((root / "data/node-runtime/runtime_manifest.json").read_text(encoding="utf-8"))
    sources = {item["id"]: item for item in json.loads((root / "data/manifests/datasets.json").read_text(encoding="utf-8"))["files"]}
    registry = None
    if bundle.get("observation_registry"):
        pin = bundle["observation_registry"]
        assert pin["path"] == "data/manifests/observation_registry.json"
        raw_registry = (root / pin["path"]).read_bytes()
        assert hashlib.sha256(raw_registry).hexdigest() == pin["sha256"]
        registry = json.loads(raw_registry)
    assert call(base, "/health/ready")["status"] == "ready"
    assert b"/assets/" in call(base, "/")
    runtime = call(base, "/api/v1/runtime")
    assert runtime["public_scope"] == "solar_system_1000au"
    for route in ["catalog/galaxies", "catalog/galaxy-atlas", "catalog/exoplanets", "catalog/universe", "black-holes", "observer-physics", "cosmic-observations", "physics/numerical-relativity"]:
        try:
            call(base, "/api/v1/" + route)
        except HTTPError as error:
            assert error.code == 410, route
        else:
            raise AssertionError("excluded API reopened: " + route)
    scene = call(base, "/api/v1/universe")
    timeline = call(base, "/api/v1/timeline")
    appearance = call(base, "/api/v1/appearance")
    extended = call(base, "/api/v1/catalog/solar-system")
    criteria = call(base, "/api/v1/planet-criteria")
    assert len(extended["objects"]) == 476
    assert len(criteria["objects"]) == 17
    assert criteria["objects"]["sedna"]["mass"]["earth_masses"] is None
    assert len(appearance["rings"]) == 4
    for entry in appearance["objects"].values():
        assert hashlib.sha256(call(base, entry["texture_url"])).hexdigest() == entry["sha256"]
    out = {"status": "passed", "scope": runtime["public_scope"], "surface_maps": len(appearance["objects"])}
    if registry is not None:
        targets = call(base, "/api/v1/objects")["objects"]
        assert {item["object_id"] for item in targets} == set(registry["objects"])
        for object_id, definition in registry["objects"].items():
            listing = call(base, "/api/v1/observations?object_id=" + object_id)
            entries = {key: value for key, value in registry["exposures"].items() if value["object_id"] == object_id and value["enabled"]}
            assert listing["object_id"] == object_id and listing["status"] == "available"
            assert listing["default_pair"] == definition["default_pair"]
            assert len(listing["observations"]) == len(entries)
            assert {item["observation_id"] for item in listing["observations"]} == set(entries)
            pairs = [pair for pair in registry["pairs"] if all(registry["exposures"][key]["object_id"] == object_id for key in pair)]
            assert sorted(map(tuple, listing["available_pairs"])) == sorted(map(tuple, pairs))
            for observation in listing["observations"]:
                entry = entries[observation["observation_id"]]
                source = sources[entry["source_id"]]
                assert observation["object_id"] == object_id
                for key in ("sha256", "bytes", "source_url"):
                    assert observation[key] == entry["source"][key] == source[key]
                for key in ("date_avg", "detector", "release", "timesys"):
                    assert observation[key] == entry[key]
            assert next(item for item in targets if item["object_id"] == object_id)["default_pair"] == definition["default_pair"]
        assert runtime["ordered_comparison_count"] == 2 * len({tuple(sorted(pair)) for pair in registry["pairs"]})
        out["registered_targets"] = len(registry["objects"])
        out["registered_unordered_pairs"] = len(registry["pairs"])
    for object_id, ids, key in [("epsilon-indi-b", ["S01", "S02"], ""), ("pluto", ["S12", "S14"], "pluto_")]:
        observations = call(base, "/api/v1/observations?object_id=" + object_id)
        if registry is None:
            assert [item["observation_id"] for item in observations["observations"]] == ids
        else:
            assert set(ids) <= {item["observation_id"] for item in observations["observations"]}
        job = call(base, "/api/v1/comparison-jobs", {"observation_ids": ids})
        for _ in range(160):
            job = call(base, "/api/v1/jobs/" + job["job_id"])
            if job["state"] not in ("queued", "running"):
                break
            time.sleep(0.1)
        assert job["state"] == "succeeded", job
        result = call(base, "/api/v1/comparisons/" + job["result_id"] + "/manifest")
        expected_id = "cmp_d88083664b6fd27592eb68c1" if object_id == "epsilon-indi-b" else "cmp_0d749ea3f9ec3a8da925dc44"
        assert job["result_id"] == result["result_id"] == expected_id
        assert result["object_id"] == object_id and [frame["observation_id"] for frame in result["frames"]] == ids
        for frame in result["frames"]:
            for field in ("provenance", "calibration"):
                source = sources[frame[field]["id"]]
                assert frame[field]["sha256"] == source["sha256"] and frame[field]["bytes"] == source["bytes"]
                assert frame[field]["source_url"] == source["source_url"]
        if object_id == "epsilon-indi-b":
            assert [frame["quality"]["pixel_count"] for frame in result["frames"]] == [29, 32]
        context = {"selected_object_id": object_id, "model_epoch": "2026-11-14T00:00:00Z", "source_manifest_sha256": scene["source_manifest_sha256"], "orbit_manifest_sha256": scene["orbit_manifest_sha256"], "timeline_algorithm_version": timeline["algorithm_version"], "show_orbits": True, "show_galaxies": False, "show_kuiper_belt": True, "panel_open": True}
        saved = call(base, "/api/v1/evidence", {"result_id": result["result_id"], "session": {"object_id": object_id, "observation_ids": ids, "active_frame": "B", "view_mode": "split", "contrast": 1.3, "locale": "ko", "universe_context": context}, "judgment": "1000 AU release: original quality and predictions; measured motion remains unverified."})
        exported = call(base, "/api/v1/evidence/" + saved["evidence_id"] + "/export")
        restored = call(base, "/api/v1/evidence/import", exported)
        assert restored["status"] == "restored" and restored["session"] == saved["session"]
        out[key + "evidence_id"] = saved["evidence_id"]
        out[key + "result_id"] = result["result_id"]
    presets = call(base, "/api/v1/planet-nine/presets")
    preset = presets["presets"][0]
    prediction = call(base, "/api/v1/planet-nine/predict", {"orbit": preset["orbit"], "start_jd_tdb": 2461312.5, "end_jd_tdb": 2461315.5, "samples": 8, "observer": "earth_moon_barycenter"})
    assert len(prediction["path"]) == 8 and not prediction["assumptions"]["measured_motion"]
    field = call(base, "/api/v1/planet-nine/gravity-field", {"position_au": [500, 0, 0], "jd_tdb": 2461312.5})
    assert field["direct_magnitude_m_s2"] > 0
    integrated = call(base, "/api/v1/planet-nine/integrate", {"orbit": preset["orbit"], "start_jd_tdb": 2461312.5, "duration_days": 8, "step_days": 1, "include_planets": True, "include_solar_gr_1pn": True})
    assert integrated["integrator"]["step_halving"]
    p9 = call(base, "/api/v1/planet-nine/evidence", {"orbit": preset["orbit"], "prediction": prediction, "coverage": None, "gravity": {"kind": "integration", "result": integrated}, "locale": "ko", "judgment": "Conditional prediction and gravity; no coverage query or detection claimed.", "source": {"preset_id": preset["id"], "row_index": preset["row_index"], "source_sha256": presets["source"]["sha256"]}})
    restored = call(base, "/api/v1/planet-nine/evidence/import", p9)
    assert restored["status"] == "restored"
    assert restored["evidence"] == p9
    out["p9_evidence_id"] = p9["evidence_id"]
    out["p9_source_sha256"] = presets["source"]["sha256"]
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return out


if __name__ == "__main__":
    main(sys.argv[1])
