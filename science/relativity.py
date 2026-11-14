"""Bounded observer experiments, kept separate from fixed observations.

All shift factors mean wavelength_received / wavelength_emitted. The module
does not alter an observed image, infer a camera velocity, trace a cosmological
worldline, solve Kerr spacetime, or model a black-hole interior.
"""

from __future__ import annotations

import hashlib
import json
import math
from itertools import pairwise
from pathlib import Path
from urllib.parse import urlsplit

from astropy.cosmology import FlatLambdaCDM
from scipy.optimize import brentq

ALGORITHM = "bounded-observer-relativity-v1"
BLACK_HOLES_MANIFEST = "data/manifests/black_holes.json"
OBSERVER_MANIFEST = "data/manifests/observer_physics.json"
C_KM_S = 299792.458  # Exact SI speed of light, converted to km/s.
GM_SUN_KM3_S2 = 1.32712440041279419e11  # JPL DE440 adopted solar GM.
AU_KM = 149597870.7  # Exact IAU astronomical unit.
PC_AU = 648000 / math.pi  # Parsec definition, not 3.26-rounded light years.
MPC_AU = PC_AU * 1e6
H0_KM_S_MPC = 67.66
OMEGA_M = 0.3111
MAX_REDSHIFT = 20.0
COSMOLOGY = FlatLambdaCDM(H0=H0_KM_S_MPC, Om0=OMEGA_M, Tcmb0=0)
ALLOWED_HOSTS = {
    "www.nasa.gov",
    "science.nasa.gov",
    "ssd.jpl.nasa.gov",
    "www.esa.int",
    "www.cosmos.esa.int",
    "wiki.cosmos.esa.int",
    "www.eso.org",
    "cdn.eso.org",
    "arxiv.org",
    "ned.ipac.caltech.edu",
    "simbad.harvard.edu",
    "chandra.harvard.edu",
    "www.chandra.harvard.edu",
    "heasarc.gsfc.nasa.gov",
    "imagine.gsfc.nasa.gov",
    "esawebb.org",
}


def _finite(value: float, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(name + "_invalid")  # noqa: TRY004 - one public numerical-domain error contract
    if not math.isfinite(value):
        raise ValueError(name + "_invalid")
    return float(value)


def radial_doppler_factor(beta: float) -> float:
    """SR radial wavelength factor; receding positive, approaching negative."""
    beta = _finite(beta, "beta")
    if not -1 < beta < 1:
        raise ValueError("beta_must_be_subluminal")
    return math.exp(math.atanh(beta))


def schwarzschild_scales(mass_solar: float) -> dict:
    """Nonrotating model lengths, not measured surfaces or an observed spin."""
    mass = _finite(mass_solar, "mass_solar")
    if mass <= 0:
        raise ValueError("mass_solar_must_be_positive")
    rs = (2 * GM_SUN_KM3_S2 / C_KM_S**2) * mass
    photon = 1.5 * rs
    shadow = 1.5 * math.sqrt(3) * rs
    if not all(math.isfinite(value) and value > 0 for value in (rs, photon, shadow)):
        raise ValueError("black_hole_scale_overflow")
    return {
        "schwarzschild_radius_km": rs,
        "photon_sphere_radius_km": photon,
        "distant_shadow_impact_radius_km": shadow,
        "spin_assumed": 0,
        "model": "Schwarzschild_nonrotating_uncharged_isolated",
    }


def static_schwarzschild_factor(
    schwarzschild_radius_km: float,
    emitter_radius_km: float | None,
    observer_radius_km: float | None,
) -> float:
    """Static-observer wavelength factor; None denotes infinity, not unknown.

    Both finite Schwarzschild areal radii must be strictly outside the horizon.
    This excludes freely falling observers and rotating/accreting spacetimes.
    """
    rs = _finite(schwarzschild_radius_km, "schwarzschild_radius_km")
    if rs <= 0:
        raise ValueError("schwarzschild_radius_must_be_positive")

    def lapse_squared(radius: float | None) -> float:
        if radius is None:
            return 1.0
        r = _finite(radius, "static_radius_km")
        if r <= rs:
            raise ValueError("static_observer_requires_radius_outside_horizon")
        return (r - rs) / r

    return math.sqrt(lapse_squared(observer_radius_km) / lapse_squared(emitter_radius_km))


def shifted_wavelength_nm(
    emitted_nm: float,
    redshift: float = 0,
    *,
    doppler_factor: float = 1,
    gravitational_factor: float = 1,
) -> float:
    """Compose explicitly supplied factors, without assigning them to data.

    An observed source z may already contain Doppler/gravitational contributions.
    Extra factors are a chosen incremental experiment, not a decomposition or a
    correction inferred from that source. Cosmological-model z replaces the
    fixed observed z in its separate branch; never multiply both as independent.
    """
    emitted = _finite(emitted_nm, "emitted_nm")
    z = _finite(redshift, "redshift")
    doppler = _finite(doppler_factor, "doppler_factor")
    gravity = _finite(gravitational_factor, "gravitational_factor")
    if emitted <= 0 or z <= -1 or doppler <= 0 or gravity <= 0:
        raise ValueError("wavelength_factor_domain_invalid")
    value = emitted * (1 + z) * doppler * gravity
    if not math.isfinite(value) or value <= 0:
        raise ValueError("wavelength_overflow_or_underflow")
    return value


def comoving_distance_mpc(redshift: float) -> float:
    z = _finite(redshift, "redshift")
    if not 0 <= z <= MAX_REDSHIFT:
        raise ValueError("cosmological_redshift_outside_model_domain")
    return float(COSMOLOGY.comoving_distance(z).value)


def redshift_at_residual_comoving_distance(distance_mpc: float) -> float:
    """Inverse fixed flat matter+Lambda reference, not a moving worldline.

    The two positions are treated as a simultaneous present-epoch Euclidean
    comoving slice. A different comoving observer receives different photons at
    different source emission times. No actual image, measured z, source motion,
    travel time, peculiar velocity or bound-system Hubble flow is reconstructed.
    """
    distance = _finite(distance_mpc, "distance_mpc")
    maximum = comoving_distance_mpc(MAX_REDSHIFT)
    if distance < 0 or distance > maximum:
        raise ValueError("distance_outside_cosmological_model_domain")
    if distance == 0:
        return 0.0
    if distance == maximum:
        return MAX_REDSHIFT
    return float(
        brentq(
            lambda z: comoving_distance_mpc(z) - distance, 0, MAX_REDSHIFT, xtol=1e-14, rtol=1e-13
        )
    )


def physical_au_to_display(position_au: tuple[float, float, float]) -> tuple[float, float, float]:
    """Existing radial compression and [x,z,-y] display convention only."""
    if len(position_au) != 3:
        raise ValueError("position_requires_three_coordinates")
    x, y, z = (_finite(value, "position_au") for value in position_au)
    radius = math.hypot(x, y, z)
    if not math.isfinite(radius):
        raise ValueError("position_radius_overflow")
    if radius == 0:
        return (0.0, 0.0, 0.0)
    compressed = 18 * math.log1p(radius)
    return (x / radius * compressed, z / radius * compressed, -y / radius * compressed)


def display_to_physical_au(position: tuple[float, float, float]) -> tuple[float, float, float]:
    """Hypothetical camera interpretation; not inverse enlarged moons/radii."""
    if len(position) != 3:
        raise ValueError("position_requires_three_coordinates")
    x, y, z = (_finite(value, "display_position") for value in position)
    radius = math.hypot(x, y, z)
    if radius == 0:
        return (0.0, 0.0, 0.0)
    if not math.isfinite(radius) or radius / 18 > math.log(
        float.fromhex("0x1.fffffffffffffp+1023")
    ):
        raise ValueError("physical_camera_distance_overflow")
    physical = math.expm1(radius / 18)
    result = (x / radius * physical, -z / radius * physical, y / radius * physical)
    if not all(math.isfinite(value) for value in result):
        raise ValueError("physical_camera_distance_overflow")
    return result


def residual_distance_mpc(
    source_au: tuple[float, float, float], observer_au: tuple[float, float, float]
) -> float:
    if len(source_au) != 3 or len(observer_au) != 3:
        raise ValueError("position_requires_three_coordinates")
    delta = [
        _finite(s, "source_au") - _finite(o, "observer_au")
        for s, o in zip(source_au, observer_au, strict=True)
    ]
    distance = math.hypot(*delta) / MPC_AU
    if not math.isfinite(distance):
        raise ValueError("residual_distance_overflow")
    return distance


def _sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _reject_nonfinite_constant(_value: str) -> None:
    raise ValueError("relativity_json_nonfinite_constant")


def _json(raw: bytes) -> dict:
    return json.loads(raw, parse_constant=_reject_nonfinite_constant)


def _verified(root: Path, record: dict, prefix: str) -> bytes:
    value = record.get("local_relative_path")
    if not isinstance(value, str) or not value.startswith(prefix) or "\\" in value:
        raise ValueError("relativity_source_path_invalid")
    path = (root / value).resolve()
    allowed = (root / prefix).resolve()
    if not allowed.is_relative_to(root) or not path.is_relative_to(allowed) or not path.is_file():
        raise ValueError("relativity_source_missing")
    raw = path.read_bytes()
    if len(raw) != record.get("bytes") or _sha(raw) != record.get("sha256"):
        raise ValueError("relativity_source_hash_mismatch")
    return raw


def _load(root: Path, relative: str) -> dict:
    root = root.resolve()
    raw = (root / relative).read_bytes()
    value = _json(raw)
    if value.get("algorithm_version") != ALGORITHM or value.get("schema_version") != "1.0":
        raise ValueError("relativity_manifest_version_invalid")
    for source in value["sources"].values():
        url = urlsplit(source["url"])
        if (
            url.scheme != "https"
            or url.hostname not in ALLOWED_HOSTS
            or url.username
            or url.password
        ):
            raise ValueError("relativity_source_provider_invalid")
        facts = _json(_verified(root, source, "data/reference/relativity/facts/"))
        if facts["source_id"] != source["source_id"] or facts["source_url"] != source["url"]:
            raise ValueError("relativity_source_identity_mismatch")
    for dependency in value.get("dependencies", []):
        _verified(root, dependency, "data/manifests/")
    value["source_manifest_sha256"] = _sha(raw)
    return value


def get_black_holes(root: Path) -> dict:
    value = _load(root, BLACK_HOLES_MANIFEST)
    for identifier, obj in value["objects"].items():
        if (
            obj["object_id"] != identifier
            or obj["classification_status"] != "source_identified_black_hole"
        ):
            raise ValueError("black_hole_identity_invalid")
        mass = obj["mass_solar"]
        if mass is not None:
            mass_source = obj["mass_source"]
            if mass_source != value["sources"].get(mass_source["source_id"]):
                raise ValueError("black_hole_mass_source_mismatch")
            facts = _json(
                _verified(root.resolve(), mass_source, "data/reference/relativity/facts/")
            )["facts"]
            adopted_mass = next(
                (
                    facts[key]
                    for key in (
                        "mass_solar",
                        "mass_solar_approximate",
                        "mass_solar_approximate_adopted",
                    )
                    if key in facts
                ),
                None,
            )
            if mass != adopted_mass:
                raise ValueError("black_hole_mass_facts_mismatch")
        expected = None if mass is None else schwarzschild_scales(mass)
        if obj["nonrotating_model"] != expected:
            raise ValueError("black_hole_derived_scales_mismatch")
        if obj["spin_dimensionless"] is not None or obj["surface_resolved"]:
            raise ValueError("black_hole_unestablished_measurement")
        image = obj.get("image")
        if image:
            _verified(root.resolve(), image, "web/public/observations/black-holes/")
            if (
                image["artist_concept"]
                or image["bytes_modified_locally"]
                or image["surface_resolved"]
            ):
                raise ValueError("black_hole_image_status_invalid")
    return value


def get_observer_physics(root: Path) -> dict:
    value = _load(root, OBSERVER_MANIFEST)
    for observation in value["source_redshifts"].values():
        z = observation["measured_redshift"]
        if z is not None and _finite(z, "source_redshift") <= -1:
            raise ValueError("source_redshift_domain_invalid")
    model = value["cosmology"]
    if (
        model["h0_km_s_mpc"] != H0_KM_S_MPC
        or model["omega_m"] != OMEGA_M
        or model["omega_lambda"] != 0.6889
        or model["tcmb_k"] != 0
        or model["radiation_neutrino_evolution_included"] is not False
    ):
        raise ValueError("observer_cosmology_parameters_mismatch")
    if model["redshift_domain"] != [0, MAX_REDSHIFT]:
        raise ValueError("observer_cosmology_domain_mismatch")
    table = model["inverse_distance_table"]
    if (
        len(table) != 2049
        or table[0] != {"z": 0.0, "comoving_distance_mpc": 0.0}
        or table[-1]["z"] != MAX_REDSHIFT
    ):
        raise ValueError("observer_cosmology_table_invalid")
    for previous, current in pairwise(table):
        if not (
            previous["z"] < current["z"]
            and previous["comoving_distance_mpc"] < current["comoving_distance_mpc"]
        ):
            raise ValueError("observer_cosmology_table_not_monotonic")
    expected = COSMOLOGY.comoving_distance([row["z"] for row in table]).value
    if any(
        not math.isclose(
            row["comoving_distance_mpc"], float(distance), rel_tol=1e-12, abs_tol=1e-12
        )
        for row, distance in zip(table, expected, strict=True)
    ):
        raise ValueError("observer_cosmology_table_values_mismatch")
    return value
