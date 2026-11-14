"""Scientific boundaries, true source units and offline reproducibility."""

import json
import math
import shutil
from pathlib import Path

import pytest

from science.planet_criteria import MANIFEST, clearing_diagnostic, get_planet_criteria

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def actual():
    return get_planet_criteria(ROOT)


@pytest.fixture
def inputs(tmp_path):
    data = json.loads((ROOT / MANIFEST).read_bytes())
    paths = [
        MANIFEST,
        *[entry["path"] for entry in data["dependencies"].values()],
        *[source["local_relative_path"] for source in data["sources"].values()],
    ]
    for relative in paths:
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, target)
    return tmp_path, data


def rewrite(root, data):
    (root / MANIFEST).write_text(json.dumps(data), encoding="utf-8")


def test_published_solar_shortcut_is_consistent_without_mixing_rounded_807():
    earth = clearing_diagnostic(1, 1)
    assert earth["minimum_mass_earth"] == 0.001239
    assert earth["pi"] == pytest.approx(807.1025020177562, rel=1e-14)
    assert earth["pi"] != 807
    assert earth["minimum_mass_earth"] * earth["pi"] == pytest.approx(1)
    # a=2^8 gives a^(9/8)=2^9, an independently exact exponent check.
    assert clearing_diagnostic(256)["minimum_mass_earth"] == pytest.approx(0.001239 * 512)


def test_theoretical_threshold_and_mass_changes_do_not_create_a_probability():
    below = clearing_diagnostic(1, 0.001239 / 2)
    above = clearing_diagnostic(1, 0.001239 * 2)
    assert below["model_classification"] == "below_model" and below["pi"] == 0.5
    assert above["model_classification"] == "meets_model" and above["pi"] == 2
    assert not any("probab" in key or "percent" in key for key in above)
    assert below["minimum_mass_earth"] == above["minimum_mass_earth"]


@pytest.mark.parametrize(
    "a,mass",
    [
        (0, 1),
        (-1, 1),
        (math.inf, 1),
        (math.nan, 1),
        (True, 1),
        ("1", 1),
        (1, 0),
        (1, -1),
        (1, math.nan),
        (1, math.inf),
        (1, True),
        (1e308, 1),
        (1e-250, 1e308),
    ],
)
def test_nonphysical_or_unserializable_inputs_are_rejected(a, mass):
    with pytest.raises(ValueError):
        clearing_diagnostic(a, mass)


def test_17_real_bodies_are_separate_from_iau_definition_and_model(actual):
    assert len(actual["objects"]) == 17
    assert actual["objects"]["earth"]["official_classification"] == "planet"
    assert actual["objects"]["eris"]["official_classification"] == "dwarf_planet"
    assert actual["objects"]["sedna"]["official_classification"] == "dwarf_candidate"
    assert actual["model"]["clearing_time_gyr"] == 10
    assert actual["model"]["host_mass_solar"] == 1
    assert actual["model"]["hill_zone_factor"] == pytest.approx(math.sqrt(12))
    assert any(
        "not an official IAU numeric test" in note for note in actual["model"]["limitations"]
    )


def test_jpl_planet_and_pluto_mass_column_units_are_not_conflated(actual):
    earth, pluto = actual["objects"]["earth"], actual["objects"]["pluto"]
    assert earth["mass"]["mass_kg"] == 5.97217e24
    assert earth["mass"]["original_column_power_of_ten"] == 24
    assert pluto["mass"]["original_column_power_of_ten"] == 18
    # Original JPL dwarf-planet table: 13024.6 in its separate 10^18 kg column.
    assert pluto["mass"]["mass_kg"] == 1.30246e22
    assert 0.002 < pluto["mass"]["earth_masses"] < 0.0023
    assert pluto["clearing"]["pi"] < 1 < earth["clearing"]["pi"]
    assert "Earth–Moon barycenter" in earth["mass"]["definition"]


def test_gm_ratio_and_literature_primary_mass_do_not_use_radius_density(actual):
    ceres = actual["objects"]["ceres"]["mass"]
    assert ceres["earth_masses"] == pytest.approx(62.6284 / 398600.435436)
    assert "gravitational constant cancels" in ceres["definition"]
    haumea = actual["objects"]["haumea"]["mass"]
    assert haumea["mass_kg"] == 4.006e21 and haumea["uncertainty_kg"] == 4e19
    assert "three-point-mass" in haumea["definition"]


def test_sedna_minimum_uses_semimajor_axis_not_perihelion_aphelion_or_radius(actual):
    sedna = actual["objects"]["sedna"]
    orbit = sedna["orbit"]
    assert orbit["eccentricity"] > 0.8
    assert orbit["perihelion_au"] < 100 < orbit["semimajor_axis_au"] < orbit["aphelion_au"]
    assert (orbit["perihelion_au"] + orbit["aphelion_au"]) / 2 == pytest.approx(
        orbit["semimajor_axis_au"]
    )
    assert sedna["clearing"]["minimum_mass_earth"] == pytest.approx(
        0.001239 * math.exp(9 / 8 * math.log(orbit["semimajor_axis_au"]))
    )
    assert sedna["mass"]["earth_masses"] is None and sedna["clearing"]["pi"] is None
    assert [row["status"] for row in sedna["criteria"]] == ["met", "unknown", "unknown"]
    assert sedna["clearing"]["eccentricity_is_used_in_shortcut"] is False
    assert any("High eccentricity" in note for note in sedna["limitations"])


@pytest.mark.parametrize("identifier", ["eris", "quaoar", "orcus", "gonggong"])
def test_system_mass_is_never_silently_promoted_to_primary_mass_or_measured_pi(actual, identifier):
    body = actual["objects"][identifier]
    assert body["mass"]["earth_masses"] is None and body["clearing"]["pi"] is None
    assert body["system_mass"]["adopted_as_primary_mass"] is False
    assert body["system_mass"]["definition"] == "combined_primary_satellite_system"
    assert body["clearing"]["system_mass_proxy_status"].endswith("not_a_confidence_upper_bound")


def test_official_roundness_is_classification_not_a_new_shape_measurement(actual):
    eris, haumea = actual["objects"]["eris"], actual["objects"]["haumea"]
    assert [row["status"] for row in eris["criteria"]] == ["met", "met", "not_met"]
    assert haumea["criteria"][1]["basis"] == "official_definition"
    assert any("not an automatic failure" in note for note in haumea["limitations"])


def test_runtime_requires_only_authored_facts_and_existing_dependencies(inputs):
    root, _ = inputs
    assert not (root / "data/reference/planet-criteria/upstream").exists()
    assert len(get_planet_criteria(root)["objects"]) == 17


def test_corrupted_source_is_not_treated_as_unknown_mass_or_empty_collection(inputs):
    root, data = inputs
    source = data["sources"]["sbdb-sedna"]
    (root / source["local_relative_path"]).write_bytes(b"corrupt")
    with pytest.raises(ValueError, match="source_integrity_failed"):
        get_planet_criteria(root)


def test_source_paths_stay_inside_packaged_fact_root(inputs):
    root, data = inputs
    data["sources"]["margot-2024"]["local_relative_path"] = "../../private.txt"
    rewrite(root, data)
    with pytest.raises(ValueError, match="source_path_escape"):
        get_planet_criteria(root)


def test_criterion_mass_or_algorithm_cannot_be_rewritten_without_recalculation(inputs):
    root, data = inputs
    data["objects"]["sedna"]["mass"]["earth_masses"] = 1
    rewrite(root, data)
    with pytest.raises(ValueError, match="object_or_calculation_changed"):
        get_planet_criteria(root)


def test_fixed_published_model_cannot_be_replaced_with_mixed_rounded_constants(inputs):
    root, data = inputs
    data["model"]["coefficient_earth_mass"] = 1 / 807
    rewrite(root, data)
    with pytest.raises(ValueError, match="model_changed"):
        get_planet_criteria(root)


@pytest.mark.parametrize("identifier", ["moon-301", "exo-abc", "../sedna", "sun"])
def test_solar_taxonomy_is_not_automatically_applied_to_satellites_exoplanets_or_the_sun(
    identifier,
):
    with pytest.raises(ValueError, match="unknown_planet_criteria_object"):
        get_planet_criteria(ROOT, identifier)
