"""Independent SI arithmetic and explicit hypothesis/provenance boundaries."""

import hashlib
import json
import math
import shutil
from decimal import Decimal, localcontext
from pathlib import Path

import pytest

from science.mass_scenarios import (
    ALGORITHM,
    MANIFEST,
    calculate_mass_scenario,
    get_mass_scenarios,
)
from science.planet_criteria import get_planet_criteria

ROOT = Path(__file__).resolve().parents[1]
PI = Decimal("3.1415926535897932384626433832795028841971693993751")


@pytest.fixture(scope="module")
def actual():
    return get_mass_scenarios(ROOT)


@pytest.fixture
def inputs(tmp_path):
    paths = {MANIFEST}
    pending = [MANIFEST]
    while pending:
        manifest_path = pending.pop()
        data = json.loads((ROOT / manifest_path).read_bytes())
        paths.update(source["local_relative_path"] for source in data["sources"].values())
        for dependency in data.get("dependencies", {}).values():
            relative = dependency["path"]
            if relative not in paths:
                paths.add(relative)
                if relative.endswith(("planet_criteria.json", "small_body_appearance.json")):
                    pending.append(relative)
    for relative in paths:
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, target)
    return tmp_path, json.loads((ROOT / MANIFEST).read_bytes())


def test_si_conversion_and_cubic_radius_are_not_diameter_or_km_metres_mistakes():
    # A 1 km sphere has V=(4*pi/3)*10^9 m^3. A 1 g/cm^3 bulk
    # density is 1000 kg/m^3, so its mass is (4*pi/3)*10^12 kg.
    value = calculate_mass_scenario(1, 1000)
    assert value["volume_m3"] == pytest.approx(4188790204.78639098, rel=1e-15)
    assert value["mass_kg"] == pytest.approx(4188790204786.39098, rel=1e-15)
    assert calculate_mass_scenario(2, 1000)["mass_kg"] == value["mass_kg"] * 8
    assert calculate_mass_scenario(1, 2000)["mass_kg"] == value["mass_kg"] * 2
    assert value["clearing"] is None and value["mass_bounds"] is None


def test_actual_sedna_scenario_checked_with_decimal_si_and_margot(actual):
    scenario = actual["targets"]["sedna"]["analogue_scenarios"]["tethys"]
    with localcontext() as context:
        context.prec = 45
        expected = Decimal(984) * Decimal(4) / Decimal(3) * PI * Decimal(497500) ** 3
        assert scenario["mass_kg"] == pytest.approx(float(expected), rel=3e-16)
        mass_earth = expected / Decimal("5.97217e24")
        a = Decimal(str(actual["targets"]["sedna"]["semimajor_axis_au"]))
        minimum = Decimal("0.001239") * context.power(a, Decimal("1.125"))
        assert scenario["clearing"]["pi"] == pytest.approx(float(mass_earth / minimum), rel=1e-15)
    assert 5e20 < scenario["mass_kg"] < 5.2e20
    assert 0 < scenario["clearing"]["pi"] < 0.0001


def test_parameter_corners_preserve_asymmetric_size_offsets_without_claiming_ci():
    result = calculate_mass_scenario(
        455, 1000, radius_bounds_km=(435, 480), density_bounds_kg_m3=(900, 1200)
    )
    bounds = result["mass_bounds"]
    assert bounds["low_kg"] / result["mass_kg"] == pytest.approx(0.9 * (435 / 455) ** 3)
    assert bounds["high_kg"] / result["mass_kg"] == pytest.approx(1.2 * (480 / 455) ** 3)
    assert bounds["definition"] == "parameter_corner_range_not_confidence_interval"
    assert "confidence_level" not in bounds and "probability" not in result


def test_clearing_comparison_is_only_conditional_and_has_no_iau_reclassification():
    low = calculate_mass_scenario(500, 1000, semimajor_axis_au=1)
    high = calculate_mass_scenario(2000, 1000, semimajor_axis_au=1)
    assert low["clearing"]["model_classification"] == "below_model"
    assert high["clearing"]["model_classification"] == "meets_model"
    assert (
        low["clearing"]["minimum_mass_earth"] == high["clearing"]["minimum_mass_earth"] == 0.001239
    )
    assert low["status"] == high["status"] == "hypothesis"
    assert low["changes_official_classification"] is False
    assert low["replaces_measured_mass"] is False
    assert high["clearing"]["status"] == "conditional_hypothesis"


def test_parameter_range_can_cross_a_model_threshold_without_becoming_a_probability():
    crossing = calculate_mass_scenario(
        1000, 2000, density_bounds_kg_m3=(1000, 3000), semimajor_axis_au=1
    )
    clearing = crossing["clearing"]
    assert clearing["pi_bounds"]["low"] < 1 < clearing["pi_bounds"]["high"]
    assert clearing["parameter_range_classification"] == "straddles_model"
    threshold_density = clearing["required_density_for_model_kg_m3"]
    assert clearing["pi"] == pytest.approx(2000 / threshold_density)
    assert clearing["required_density_exceeds_operating_max"] is False
    assert clearing["pi_bounds"]["definition"] == "parameter_corner_range_not_confidence_interval"


@pytest.mark.parametrize(
    "radius,density,kwargs",
    [
        (0, 1000, {}),
        (-1, 1000, {}),
        (math.nan, 1000, {}),
        (math.inf, 1000, {}),
        (True, 1000, {}),
        ("1", 1000, {}),
        (10**400, 1000, {}),
        (1e200, 1000, {}),
        (1e-105, 1000, {}),
        (1, 0, {}),
        (1, -1, {}),
        (1, True, {}),
        (1, "1000", {}),
        (1, math.nan, {}),
        (1, math.inf, {}),
        (1, 99.99, {}),
        (1, 10000.1, {}),
        (1, 1000, {"radius_bounds_km": (2, 3)}),
        (1, 1000, {"radius_bounds_km": (1, 0.5)}),
        (1, 1000, {"radius_bounds_km": "12"}),
        (1, 1000, {"density_bounds_kg_m3": (1, 1000)}),
        (1, 1000, {"density_bounds_kg_m3": (1000, 10001)}),
        (1, 1000, {"semimajor_axis_au": 0}),
        (1, 1000, {"semimajor_axis_au": math.nan}),
    ],
)
def test_nonphysical_unserializable_or_unsupported_inputs_fail_explicitly(radius, density, kwargs):
    with pytest.raises(ValueError):
        calculate_mass_scenario(radius, density, **kwargs)


def test_named_bulk_density_analogues_keep_source_definitions_and_uncertainties(actual):
    analogues = actual["analogues"]
    assert set(analogues) == {"tethys", "dione", "rhea", "iapetus", "ariel", "umbriel"}
    tethys = analogues["tethys"]
    assert tethys["density_kg_m3"] == 984 and tethys["density_sigma_kg_m3"] == 3.3
    assert tethys["gm_km3_s2"] == 41.21353
    assert tethys["radius_km"] == 531.1
    assert tethys["radius_definition"] == "volume_equivalent_mean_radius"
    assert "derived_from_GM" in tethys["density_definition"]
    assert len({body["density_kg_m3"] for body in analogues.values()}) == 6
    assert all(
        body["source"]["provider"] == "NASA/JPL Solar System Dynamics"
        for body in analogues.values()
    )


def test_unknown_mass_targets_and_size_measurement_kinds_are_not_conflated(actual):
    assert set(actual["targets"]) == {"makemake", "eris", "sedna", "quaoar", "orcus", "gonggong"}
    sedna = actual["targets"]["sedna"]
    assert (sedna["radius_km"], sedna["radius_low_km"], sedna["radius_high_km"]) == (
        497.5,
        457.5,
        537.5,
    )
    assert "ESA Herschel" in sedna["radius_provenance"]["observation_provider"]
    assert sedna["radius_source"]["url"] == "https://arxiv.org/abs/1204.0899"
    assert sedna["high_eccentricity_circular_reference_warning"] is True
    assert (
        actual["targets"]["quaoar"]["radius_provenance"]["radius_kind"]
        == "projected_area_equivalent_radius"
    )
    assert "not a volume" in actual["targets"]["quaoar"]["radius_definition"]
    assert actual["targets"]["makemake"]["radius_low_km"] is None
    for body in actual["targets"].values():
        assert body["measured_primary_mass"]["earth_masses"] is None
        assert len(body["analogue_scenarios"]) == 6
        assert all(
            scenario["changes_official_classification"] is False
            for scenario in body["analogue_scenarios"].values()
        )


def test_scenarios_preserve_frozen_mass_and_classification_dependencies(actual):
    before = (ROOT / "data/manifests/planet_criteria.json").read_bytes()
    criteria = get_planet_criteria(ROOT)
    for identifier, body in actual["targets"].items():
        assert body["adopted_criteria"] == criteria["objects"][identifier]["criteria"]
        assert body["published_system_mass"] == criteria["objects"][identifier]["system_mass"]
    calculate_mass_scenario(497.5, 10000, semimajor_axis_au=1)
    assert (ROOT / "data/manifests/planet_criteria.json").read_bytes() == before
    assert criteria["objects"]["sedna"]["clearing"]["pi"] is None


def test_all_default_analogue_scenarios_fall_below_model_without_a_likelihood_ranking(actual):
    assert "not_a_planet_likelihood_ranking" in actual["coverage"]
    for body in actual["targets"].values():
        assert all(
            value["clearing"]["model_classification"] == "below_model"
            for value in body["analogue_scenarios"].values()
        )
    assert actual["algorithm_version"] == ALGORITHM
    assert actual["summary"]["conditional_target_count_meets_model_range"] == 0
    assert actual["summary"]["scenario_count"] == 36
    assert all(
        value["pi_high"] < 1
        for value in actual["summary"]["source_analogue_parameter_corner_envelopes"].values()
    )
    assert (
        actual["targets"]["sedna"]["analogue_scenarios"]["tethys"]["clearing"][
            "required_density_exceeds_operating_max"
        ]
        is True
    )
    assert (
        actual["model"]["density_input_range_kind"]
        == "interface_operating_range_not_universal_physical_bounds"
    )


def test_runtime_has_no_pdf_or_original_publication_requirement(inputs):
    root, _ = inputs
    assert not (root / "data/reference/mass-scenarios/upstream").exists()
    assert len(get_mass_scenarios(root)["targets"]) == 6


def test_source_corruption_is_an_error_not_an_estimated_measurement(inputs):
    root, data = inputs
    (root / data["sources"]["jpl-icy-moons"]["local_relative_path"]).write_bytes(b"wrong source")
    with pytest.raises(ValueError, match="source_integrity_failed"):
        get_mass_scenarios(root)


def test_dependency_changes_require_revalidation(inputs):
    root, _ = inputs
    path = root / "data/manifests/planet_criteria.json"
    path.write_bytes(path.read_bytes() + b" ")
    with pytest.raises(ValueError, match="dependency_changed"):
        get_mass_scenarios(root)


def test_source_paths_cannot_escape_the_fixed_fact_root(inputs):
    root, data = inputs
    data["sources"]["jpl-icy-moons"]["local_relative_path"] = "../../private.txt"
    (root / MANIFEST).write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ValueError, match="source_path_escape"):
        get_mass_scenarios(root)


def test_source_density_cannot_be_promoted_to_a_changed_fact_even_with_a_new_hash(inputs):
    root, data = inputs
    source = data["sources"]["jpl-icy-moons"]
    path = root / source["local_relative_path"]
    facts = json.loads(path.read_bytes())
    facts["facts"]["analogues"]["tethys"]["density_kg_m3"] = 5000
    raw = json.dumps(facts).encode()
    path.write_bytes(raw)
    source["sha256"], source["bytes"] = hashlib.sha256(raw).hexdigest(), len(raw)
    (root / MANIFEST).write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ValueError, match="moon_facts_changed"):
        get_mass_scenarios(root)


def test_cached_result_cannot_silently_replace_an_unknown_mass(inputs):
    root, data = inputs
    data["targets"]["sedna"]["measured_primary_mass"]["earth_masses"] = 1
    (root / MANIFEST).write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ValueError, match="model_or_target_changed"):
        get_mass_scenarios(root)
