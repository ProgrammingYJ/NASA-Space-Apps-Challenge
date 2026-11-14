"""Independent Python-reference checks of the actual Python-free Node server."""

import json
import os
import re
import shutil
import subprocess
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import pytest

from science.long_term_model import sample_long_term
from science.mass_scenarios import calculate_mass_scenario, get_mass_scenarios
from science.timeline import sample_timeline

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def node_api(tmp_path_factory):
    executable = shutil.which("node")
    if not executable or not (ROOT / "data/node-runtime/runtime_manifest.json").is_file():
        pytest.skip("Node and the verified build bundle are needed for this independent parity run")
    state = tmp_path_factory.mktemp("node-parity")
    environment = dict(os.environ, APP_STATE_DIR=str(state), PORT="0")
    # A Python-free PATH proves the server does not delegate science requests to Python.
    environment["PATH"] = str(Path(executable).resolve().parent)
    with (state / "node-output.txt").open("w", encoding="utf-8") as log:
        process = subprocess.Popen(
            [executable, str(ROOT / "app.js")],
            cwd=ROOT,
            env=environment,
            stdout=log,
            stderr=subprocess.STDOUT,
        )
        try:
            deadline = time.monotonic() + 45
            while time.monotonic() < deadline:
                assert process.poll() is None, (state / "node-output.txt").read_text()
                match = re.search(
                    r"listening on port (\d+)", (state / "node-output.txt").read_text()
                )
                if match:
                    base = "http://127.0.0.1:" + match[1]
                    try:
                        with urlopen(base + "/health/ready", timeout=2) as response:
                            if response.status == 200:
                                break
                    except (URLError, TimeoutError):
                        pass
                time.sleep(0.1)
            else:
                pytest.fail("Actual Node process did not become ready")

            def request(path, body=None):
                encoded = None if body is None else json.dumps(body).encode()
                with urlopen(
                    Request(
                        base + "/api/v1" + path,
                        data=encoded,
                        headers={"Content-Type": "application/json"},
                    ),
                    timeout=30,
                ) as response:
                    return json.load(response)

            assert request("/runtime")["runtime"] == "node"
            assert request("/runtime")["observation_processing"] == "verified_build_cache"
            yield request
        finally:
            process.terminate()
            process.wait(timeout=15)


@pytest.fixture(scope="module")
def mass_sources():
    return get_mass_scenarios(ROOT)


@pytest.mark.parametrize("target_id", ["sedna", "eris", "makemake", "quaoar", "orcus", "gonggong"])
@pytest.mark.parametrize("density", [100, 1234.56789, 2000, 10000])
@pytest.mark.parametrize("ranges", [False, True])
def test_node_general_mass_inputs_match_python_not_just_saved_scenarios(
    node_api, mass_sources, target_id, density, ranges
):
    target = mass_sources["targets"][target_id]
    result = node_api(
        "/mass-scenarios/calculate",
        {"target_id": target_id, "density_kg_m3": density, "include_source_ranges": ranges},
    )
    radius_bounds = (
        (target["radius_low_km"], target["radius_high_km"])
        if ranges and target["radius_low_km"] is not None
        else None
    )
    reference = calculate_mass_scenario(
        target["radius_km"],
        density,
        radius_bounds_km=radius_bounds,
        semimajor_axis_au=target["semimajor_axis_au"],
    )
    for key in ["mass_kg", "mass_earth", "volume_m3"]:
        assert result[key] == pytest.approx(reference[key], rel=3e-14)
    assert result["clearing"]["pi"] == pytest.approx(reference["clearing"]["pi"], rel=3e-14)
    assert result["mass_bounds"] == reference["mass_bounds"] or result[
        "mass_bounds"
    ] == pytest.approx(reference["mass_bounds"])
    assert result["replaces_measured_mass"] is False
    assert result["changes_official_classification"] is False
    assert result["source_manifest_sha256"] == mass_sources["source_manifest_sha256"]


@pytest.mark.parametrize(
    "year,month,day,hour",
    [
        (-2999, 1, 1, 0),
        (-1, 12, 31, 23.5),
        (0, 2, 29, 12),
        (99, 3, 2, 6.25),
        (1800, 7, 13, 0.5),
        (2026, 11, 14, 0),
        (2500, 6, 14, 6.25),
        (3000, 1, 1, 0),
    ],
)
def test_node_bce_zero_future_arbitrary_calendar_matches_python(node_api, year, month, day, hour):
    result = node_api(f"/long-term-simulation?year={year}&month={month}&day={day}&hour={hour}")
    reference = sample_long_term(ROOT, year, month, day, hour)
    assert result["jd_tdb"] == reference["jd_tdb"]
    assert result["calendar_date"] == reference["calendar_date"]
    assert result["coordinate_frame"] == reference["coordinate_frame"]
    assert result["source_manifest_sha256"] == reference["source_manifest_sha256"]
    assert [body["object_id"] for body in result["objects"]] == [
        body["object_id"] for body in reference["objects"]
    ]
    for actual, expected in zip(result["objects"], reference["objects"], strict=True):
        assert actual["position_au"] == pytest.approx(expected["position_au"], rel=3e-13, abs=3e-13)


@pytest.mark.parametrize(
    "epoch",
    [
        "2026-11-13T00:00:00Z",
        "2026-11-13T07:12:34Z",
        "2026-11-14T00:00:00Z",
        "2026-11-14T12:00:00Z",
        "2026-11-15T19:30:01Z",
        "2026-11-16T00:00:00Z",
    ],
)
def test_node_display_interpolation_and_source_knots_match_reference(node_api, epoch):
    result = node_api("/universe?epoch=" + epoch)
    reference = sample_timeline(ROOT, epoch)
    assert result["position_sampling"] == reference["position_sampling"]
    for actual, expected in zip(result["objects"], reference["objects"], strict=True):
        assert actual["object_id"] == expected["object_id"]
        if "position_au" in expected:
            # Node uses the declared saved-UTC/TDB linear map, as the browser does.
            # This tolerance is 30 m, far below the separately recorded sampled
            # display interpolation discrepancy; it is not a precision ephemeris claim.
            assert actual["position_au"] == pytest.approx(expected["position_au"], rel=0, abs=2e-10)
            if result["position_sampling"] == "source_exact":
                assert actual["position_au"] == expected["position_au"]


@pytest.mark.parametrize(
    "path",
    [
        "/universe?epoch=2026-11-13T24:00:00Z",
        "/long-term-simulation?year=0&month=2&day=30",
        "/long-term-simulation?year=3000&month=1&day=2",
        "/long-term-simulation?year=0.5",
        "/long-term-simulation?year=",
    ],
)
def test_node_rejects_invalid_calendar_inputs(node_api, path):
    with pytest.raises(HTTPError) as error:
        node_api(path)
    assert error.value.code == 422
