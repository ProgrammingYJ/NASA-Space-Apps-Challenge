"""Analytic invariants, provenance integrity and invalid-domain regressions."""

import hashlib
import json
import math
import shutil
from decimal import Decimal, localcontext
from pathlib import Path

import pytest

from science.relativity import (
    BLACK_HOLES_MANIFEST,
    MPC_AU,
    OBSERVER_MANIFEST,
    comoving_distance_mpc,
    display_to_physical_au,
    get_black_holes,
    get_observer_physics,
    physical_au_to_display,
    radial_doppler_factor,
    redshift_at_residual_comoving_distance,
    residual_distance_mpc,
    schwarzschild_scales,
    shifted_wavelength_nm,
    static_schwarzschild_factor,
)

ROOT = Path(__file__).resolve().parents[1]


def test_sr_analytic_sign_reciprocity_and_zero():
    assert radial_doppler_factor(0) == 1
    assert radial_doppler_factor(0.6) == pytest.approx(2)
    assert radial_doppler_factor(-0.6) == pytest.approx(0.5)
    for beta in [0.01, 0.3, 0.8, 0.99]:
        assert radial_doppler_factor(beta) * radial_doppler_factor(-beta) == pytest.approx(1)
    assert shifted_wavelength_nm(500, doppler_factor=radial_doppler_factor(-0.6)) == pytest.approx(
        250
    )


@pytest.mark.parametrize("beta", [-1, 1, 1.01, -1.01, math.nan, math.inf, True, "0"])
def test_sr_rejects_invalid_or_luminal_beta(beta):
    with pytest.raises(ValueError):
        radial_doppler_factor(beta)


def test_static_gravitational_exact_analytic_factors():
    # At r=2rs the static lapse is 1/sqrt(2); reverse paths are reciprocal.
    assert static_schwarzschild_factor(10, 20, None) == pytest.approx(math.sqrt(2))
    assert static_schwarzschild_factor(10, None, 20) == pytest.approx(1 / math.sqrt(2))
    assert static_schwarzschild_factor(10, 20, 20) == 1
    assert static_schwarzschild_factor(10, None, None) == 1
    assert static_schwarzschild_factor(10, 20, 100) * static_schwarzschild_factor(
        10, 100, 20
    ) == pytest.approx(1)


@pytest.mark.parametrize(
    "emitter,observer",
    [(10, None), (9, None), (0, None), (None, 10), (None, -1), (math.inf, None), (math.nan, None)],
)
def test_static_observers_not_at_or_inside_horizon(emitter, observer):
    with pytest.raises(ValueError):
        static_schwarzschild_factor(10, emitter, observer)


def test_solar_scale_independent_decimal_si_units():
    with localcontext() as context:
        context.prec = 50
        # Independent SI calculation from the source solar GM, convert m to km.
        expected = float(
            Decimal(2) * Decimal("1.32712440041279419e20") / Decimal(299792458) ** 2 / Decimal(1000)
        )
    solar = schwarzschild_scales(1)
    assert solar["schwarzschild_radius_km"] == pytest.approx(expected, rel=1e-14)
    assert 2.95 < expected < 2.96
    assert solar["photon_sphere_radius_km"] == pytest.approx(1.5 * expected)
    assert solar["distant_shadow_impact_radius_km"] == pytest.approx(
        3 * math.sqrt(3) * expected / 2
    )
    assert schwarzschild_scales(1e6)["schwarzschild_radius_km"] == pytest.approx(expected * 1e6)


@pytest.mark.parametrize("mass", [0, -1, math.nan, math.inf, 1e308, True])
def test_black_hole_scale_rejects_invalid_or_overflow(mass):
    with pytest.raises(ValueError):
        schwarzschild_scales(mass)


def test_wavelength_fixed_z_and_incremental_experiment_factors():
    # Existing M31 blueshift is never forced to positive cosmological z.
    assert shifted_wavelength_nm(500, -0.000991) == pytest.approx(499.5045)
    assert shifted_wavelength_nm(500, 1, doppler_factor=2, gravitational_factor=0.5) == 1000
    for args in [(0, 0), (-1, 0), (500, -1), (math.inf, 0), (500, math.nan)]:
        with pytest.raises(ValueError):
            shifted_wavelength_nm(*args)
    with pytest.raises(ValueError):
        shifted_wavelength_nm(1e308, 20, doppler_factor=2)
    with pytest.raises(ValueError):
        shifted_wavelength_nm(1, 0, gravitational_factor=0)


def test_camera_axis_mapping_known_one_au_and_roundtrip():
    length = 18 * math.log(2)
    assert physical_au_to_display((1, 0, 0)) == pytest.approx((length, 0, 0))
    assert physical_au_to_display((0, 1, 0)) == pytest.approx((0, 0, -length))
    assert physical_au_to_display((0, 0, 1)) == pytest.approx((0, length, 0))
    for position in [(0, 0, 0), (1e-12, 0, 0), (1, 2, 3), (-1e12, 2e11, -3e10)]:
        assert display_to_physical_au(physical_au_to_display(position)) == pytest.approx(
            position, rel=1e-12, abs=1e-20
        )
    assert residual_distance_mpc((MPC_AU, 0, 0), (0, 0, 0)) == pytest.approx(1)
    assert residual_distance_mpc((0, 0, 0), (0, 0, 0)) == 0


def test_camera_rejects_nonfinite_and_overflow():
    for point in [(math.nan, 0, 0), (math.inf, 0, 0), (13000, 0, 0), (True, 0, 0)]:
        with pytest.raises(ValueError):
            display_to_physical_au(point)
    with pytest.raises(ValueError):
        residual_distance_mpc((1e308, 0, 0), (-1e308, 0, 0))


def test_cosmology_inverse_small_distance_zero_and_boundary():
    assert redshift_at_residual_comoving_distance(0) == 0
    # Analytic local Hubble limit: z ~ H0 D/c, without empirical bound-system claim.
    small = redshift_at_residual_comoving_distance(1e-6)
    assert small == pytest.approx(67.66 * 1e-6 / 299792.458, rel=1e-6)
    for z in [0.000001, 0.01, 0.5, 2, 10, 20]:
        assert redshift_at_residual_comoving_distance(comoving_distance_mpc(z)) == pytest.approx(
            z, rel=1e-9
        )
    for distance in [-1, math.inf, math.nan, comoving_distance_mpc(20) + 1]:
        with pytest.raises(ValueError):
            redshift_at_residual_comoving_distance(distance)


@pytest.fixture
def standalone(tmp_path):
    # Only deployable facts, dependency manifests and actual images; no raw papers.
    paths = {BLACK_HOLES_MANIFEST, OBSERVER_MANIFEST}
    for manifest in [BLACK_HOLES_MANIFEST, OBSERVER_MANIFEST]:
        value = json.loads((ROOT / manifest).read_bytes())
        paths.update(source["local_relative_path"] for source in value["sources"].values())
        paths.update(dep["local_relative_path"] for dep in value["dependencies"])
        paths.update(
            obj["image"]["local_relative_path"]
            for obj in value.get("objects", {}).values()
            if obj.get("image")
        )
    for relative in paths:
        destination = tmp_path / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, destination)
    return tmp_path


def test_real_catalogue_standalone_without_upstream(standalone):
    blackholes = get_black_holes(standalone)
    assert blackholes["coverage"] == {
        "black_holes": 11,
        "with_adopted_mass": 9,
        "with_observation_image": 2,
        "complete_census": False,
    }
    assert blackholes["objects"]["black-hole-gaia-bh1"]["mass_solar"] == 9.27
    assert blackholes["objects"]["member-m104-nucleus"]["mass_solar"] is None
    assert blackholes["objects"]["black-hole-gaia-bh3"]["coordinate"]["frame"] == "ICRS"
    assert all(
        obj["spin_dimensionless"] is None and not obj["surface_resolved"]
        for obj in blackholes["objects"].values()
    )
    physics = get_observer_physics(standalone)
    assert physics["source_redshifts"]["galaxy-m31"]["measured_redshift"] == -0.000991
    assert physics["source_redshifts"]["rebels25_rotating_disc"]["measured_redshift"] == 7.31
    assert physics["source_redshifts"]["cosmic_gems_clusters"]["measured_redshift"] is None
    assert len(physics["cosmology"]["inverse_distance_table"]) == 2049


def test_source_hash_and_path_containment(standalone):
    path = standalone / BLACK_HOLES_MANIFEST
    value = json.loads(path.read_bytes())
    source = next(iter(value["sources"].values()))
    raw = (standalone / source["local_relative_path"]).read_bytes()
    moved = standalone / "data/reference/relativity/other.json"
    moved.write_bytes(raw)
    source["local_relative_path"] = "data/reference/relativity/facts/../other.json"
    source["sha256"] = hashlib.sha256(raw).hexdigest()
    source["bytes"] = len(raw)
    path.write_text(json.dumps(value), encoding="utf-8")
    with pytest.raises(ValueError, match="source_missing"):
        get_black_holes(standalone)


def test_tampered_facts_are_rejected(standalone):
    value = json.loads((standalone / BLACK_HOLES_MANIFEST).read_bytes())
    source = next(iter(value["sources"].values()))
    path = standalone / source["local_relative_path"]
    path.write_bytes(path.read_bytes() + b" ")
    with pytest.raises(ValueError, match="hash_mismatch"):
        get_black_holes(standalone)


def test_monotonic_but_false_cosmology_table_is_rejected(standalone):
    path = standalone / OBSERVER_MANIFEST
    value = json.loads(path.read_bytes())
    value["cosmology"]["inverse_distance_table"][1500]["comoving_distance_mpc"] += 0.001
    path.write_text(json.dumps(value), encoding="utf-8")
    with pytest.raises(ValueError, match="values_mismatch"):
        get_observer_physics(standalone)


def test_changed_mass_without_recalculation_is_rejected(standalone):
    path = standalone / BLACK_HOLES_MANIFEST
    value = json.loads(path.read_bytes())
    value["objects"]["black-hole-cygnus-x1"]["mass_solar"] = 200
    path.write_text(json.dumps(value), encoding="utf-8")
    with pytest.raises(ValueError, match="mass_facts_mismatch"):
        get_black_holes(standalone)


def test_missing_actual_image_is_rejected(standalone):
    value = json.loads((standalone / BLACK_HOLES_MANIFEST).read_bytes())
    image = value["objects"]["member-m87-black-hole"]["image"]
    (standalone / image["local_relative_path"]).unlink()
    with pytest.raises(ValueError, match="source_missing"):
        get_black_holes(standalone)


def test_nonfinite_json_is_rejected_before_public_response(standalone):
    path = standalone / OBSERVER_MANIFEST
    value = json.loads(path.read_bytes())
    value["source_redshifts"]["galaxy-m31"]["measured_redshift"] = math.nan
    path.write_text(json.dumps(value), encoding="utf-8")
    with pytest.raises(ValueError, match="nonfinite_constant"):
        get_observer_physics(standalone)


def test_nonallowlisted_distribution_provider_is_rejected(standalone):
    path = standalone / OBSERVER_MANIFEST
    value = json.loads(path.read_bytes())
    next(iter(value["sources"].values()))["url"] = "https://archive.example.cn/data"
    path.write_text(json.dumps(value), encoding="utf-8")
    with pytest.raises(ValueError, match="provider_invalid"):
        get_observer_physics(standalone)
