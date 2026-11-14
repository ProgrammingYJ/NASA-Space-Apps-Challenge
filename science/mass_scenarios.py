"""Explicit radius/density hypotheses; never replace adopted dynamical masses.

The six icy moons supply measured, source-specific *bulk* densities. Copying a
density to a different body is a user hypothesis, not a measurement or a claim
that ice-rich bodies have equal composition, porosity or internal compression.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import io
import json
import math
import re
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from science.planet_criteria import clearing_diagnostic, get_planet_criteria
from science.small_body_appearance import get_small_body_appearance

MANIFEST = "data/manifests/mass_scenarios.json"
REFERENCE_ROOT = "data/reference/mass-scenarios"
ALGORITHM = "spherical-density-hypothesis-v1"
EARTH_MASS_KG = 5.97217e24
DENSITY_MIN = 100
DENSITY_MAX = 10000
TARGET_IDS = {"makemake", "eris", "sedna", "quaoar", "orcus", "gonggong"}
ANALOGUES = {
    "tethys": ("603", 41.21353, 0.00031, 531.10, 0.60, 0.9840, 0.0033, "SAT441"),
    "dione": ("604", 73.11607, 0.00005, 561.40, 0.40, 1.4781, 0.0032, "SAT441"),
    "rhea": ("605", 153.94175, 0.00041, 763.50, 0.60, 1.2372, 0.0029, "SAT441"),
    "iapetus": ("608", 120.51511, 0.00242, 734.30, 2.80, 1.0887, 0.0125, "SAT441"),
    "ariel": ("701", 83.5, 1.4, 578.9, 0.6, 1.539, 0.026, "URA111"),
    "umbriel": ("702", 85.1, 1.9, 584.7, 2.8, 1.523, 0.041, "URA111"),
}
LIMITATIONS = [
    "Every computed mass is a conditional radius/density hypothesis, not a separately measured primary mass; the original mass, IAU criteria and official classification are unchanged.",
    "Similar size or an icy surface does not establish equal bulk density: rock/ice composition, internal porosity, thermal history and gravitational compression can differ.",
    "The six moons are named, size-comparable examples, not a statistically representative population, a calibrated density prior, or an exhaustive search of possible densities.",
    "A spherical volume is assumed. Thermal-model size, projected occultation area, a rendered sphere and hydrostatic equilibrium are different concepts.",
    "Source plus/minus offsets used as parameter endpoints do not become a confidence interval for this different body's mass; no joint covariance or probability is computed.",
    "The density input interval 100 to 10000 kg/m^3 is an interface/model operating range, not a universal physical bound or a measured density interval for any target.",
    "The optional Margot comparison remains the fixed circular solar 10 Gyr reference at the source semimajor axis; especially for Sedna it is not a validated eccentric-orbit clearing requirement.",
    "Meeting a conditional numeric clearing model alone neither establishes hydrostatic equilibrium nor changes an IAU classification or supplies a planet-existence probability.",
]
SOURCES = {
    "jpl-icy-moons": {
        "url": "https://ssd.jpl.nasa.gov/sats/phys_par/",
        "label": "NASA/JPL SSD planetary satellite physical parameters, six named icy moons",
        "provider": "NASA/JPL Solar System Dynamics",
        "publication_host": "ssd.jpl.nasa.gov",
        "extension": ".html",
    },
    "density-interpretation": {
        "url": "https://ntrs.nasa.gov/api/citations/20240002686/downloads/CukLongTermEvolSaturnSys.pdf",
        "label": "Cuk et al., Long-Term Evolution of the Saturnian System, NASA NTRS 20240002686, section 6",
        "provider": "NASA Technical Reports Server; qualitative physical interpretation only",
        "publication_host": "ntrs.nasa.gov",
        "extension": ".pdf",
    },
}
RADIUS_PROVENANCE = {
    "sedna": {
        "observation_provider": "ESA Herschel/PACS; European-led instruments with NASA participation",
        "original_publication_host": "arxiv.org (author manuscript of A&A 541 L6, 2012)",
        "radius_kind": "thermal_model_effective_radius",
        "volume_assumption": "Use half the thermal-model diameter as the radius of an assumed sphere; no resolved three-dimensional shape.",
    },
    "makemake": {
        "observation_provider": "NASA Science factual summary of the adopted approximate diameter",
        "original_publication_host": "science.nasa.gov",
        "radius_kind": "approximate_summary_radius",
        "volume_assumption": "Use half the approximate summary diameter as a spherical hypothesis; the source quotes no adopted uncertainty.",
    },
    "eris": {
        "observation_provider": "ESO report of the Sicardy et al. 2010 stellar-occultation campaign",
        "original_publication_host": "www.eso.org",
        "radius_kind": "occultation_nearly_spherical_limb_radius",
        "volume_assumption": "Use half the near-spherical occultation diameter as an assumed spherical volume; not a new full 3D shape reconstruction.",
    },
    "quaoar": {
        "observation_provider": "2022 occultation campaign in Hawaii, continental USA and Mexico; Gemini North, CFHT and partner observatories",
        "original_publication_host": "arxiv.org (author manuscript of A&A 673 L4, 2023)",
        "radius_kind": "projected_area_equivalent_radius",
        "volume_assumption": "The measured radius is projected-area equivalent. Using it as a volume radius adds an explicit spherical assumption; projection/3D-shape systematics are not in the +/-2 km endpoint range.",
    },
    "orcus": {
        "observation_provider": "ESO/NSF/NINS ALMA, NASA Spitzer and ESA Herschel thermal measurements",
        "original_publication_host": "arxiv.org (author manuscript of Brown and Butler 2018, AJ)",
        "radius_kind": "resolved_system_thermal_model_radius",
        "volume_assumption": "Use the adopted primary thermal-model diameter in a spherical hypothesis; emissivity and thermal-model assumptions remain.",
    },
    "gonggong": {
        "observation_provider": "ESA Herschel thermal observations and NASA/ESA Hubble satellite observations in Kiss et al. 2019",
        "original_publication_host": "arxiv.org (author manuscript of Kiss et al. 2019, Icarus)",
        "radius_kind": "conditional_thermal_model_sphere_radius",
        "volume_assumption": "The adopted size already assumes a spherical thermal model and an equatorial satellite orbit; it does not measure spherical shape.",
    },
}


def _hash(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _positive(value: float, label: str) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        # All invalid scenario inputs share the API's scientific ValueError contract.
        raise ValueError("invalid_mass_scenario_" + label)  # noqa: TRY004
    try:
        result = float(value)
    except (ValueError, OverflowError):
        raise ValueError("invalid_mass_scenario_" + label) from None
    if not math.isfinite(result) or result <= 0:
        raise ValueError("invalid_mass_scenario_" + label)
    return result


def _density(value: float) -> float:
    result = _positive(value, "density")
    if not DENSITY_MIN <= result <= DENSITY_MAX:
        raise ValueError("mass_scenario_density_outside_operating_range")
    return result


def _bounds(value: float, bounds, validator, label: str) -> tuple[float, float]:
    if bounds is None:
        return value, value
    if not isinstance(bounds, (tuple, list)) or len(bounds) != 2:
        raise ValueError("invalid_mass_scenario_" + label + "_bounds")
    low, high = (validator(endpoint) for endpoint in bounds)
    if not low <= value <= high:
        raise ValueError("invalid_mass_scenario_" + label + "_bounds")
    return low, high


def calculate_mass_scenario(
    radius_km: float,
    density_kg_m3: float,
    *,
    radius_bounds_km: tuple[float, float] | None = None,
    density_bounds_kg_m3: tuple[float, float] | None = None,
    semimajor_axis_au: float | None = None,
) -> dict:
    """M=rho*4*pi*R^3/3 in SI, with monotonic parameter-corner endpoints.

    Endpoint ranges are arithmetic sensitivity ranges, never a target's measured
    mass uncertainty or a confidence interval. The optional clearing comparison
    uses the already adopted fixed circular solar research model.
    """
    radius = _positive(radius_km, "radius")
    density = _density(density_kg_m3)
    low_r, high_r = _bounds(
        radius, radius_bounds_km, lambda value: _positive(value, "radius"), "radius"
    )
    low_d, high_d = _bounds(density, density_bounds_kg_m3, _density, "density")
    try:
        volume = 4 * math.pi / 3 * (radius * 1000) ** 3
        mass = density * volume
        low_mass = low_d * (4 * math.pi / 3) * (low_r * 1000) ** 3
        high_mass = high_d * (4 * math.pi / 3) * (high_r * 1000) ** 3
    except OverflowError:
        raise ValueError("invalid_mass_scenario_result") from None
    if any(
        not math.isfinite(value) or value <= 0
        for value in (
            volume,
            mass,
            low_mass,
            high_mass,
            mass / EARTH_MASS_KG,
            low_mass / EARTH_MASS_KG,
            high_mass / EARTH_MASS_KG,
        )
    ):
        raise ValueError("invalid_mass_scenario_result")
    result = {
        "status": "hypothesis",
        "algorithm_version": ALGORITHM,
        "radius_km": radius,
        "density_kg_m3": density,
        "volume_shape": "assumed_sphere",
        "volume_m3": volume,
        "mass_kg": mass,
        "mass_earth": mass / EARTH_MASS_KG,
        "earth_mass_kg": EARTH_MASS_KG,
        "mass_bounds": None,
        "clearing": None,
        "replaces_measured_mass": False,
        "changes_official_classification": False,
    }
    if radius_bounds_km is not None or density_bounds_kg_m3 is not None:
        result["mass_bounds"] = {
            "low_kg": low_mass,
            "high_kg": high_mass,
            "low_earth": low_mass / EARTH_MASS_KG,
            "high_earth": high_mass / EARTH_MASS_KG,
            "radius_low_km": low_r,
            "radius_high_km": high_r,
            "density_low_kg_m3": low_d,
            "density_high_kg_m3": high_d,
            "definition": "parameter_corner_range_not_confidence_interval",
        }
    if semimajor_axis_au is not None:
        clearing = clearing_diagnostic(semimajor_axis_au, result["mass_earth"])
        required_density = clearing["minimum_mass_earth"] * EARTH_MASS_KG / volume
        if not math.isfinite(required_density) or required_density <= 0:
            raise ValueError("invalid_mass_scenario_result")
        result["clearing"] = clearing | {
            "status": "conditional_hypothesis",
            "semimajor_axis_au": semimajor_axis_au,
            "required_density_kg_m3_at_this_assumed_radius": required_density,
            "required_density_for_model_kg_m3": required_density,
            "required_density_exceeds_operating_max": required_density > DENSITY_MAX,
            "pi_bounds": None,
            "parameter_range_classification": None,
            "evaluation_scope": "circular_solar_10gyr_reference_not_eccentric_clearing_solution",
        }
        if result["mass_bounds"] is not None:
            low_pi = result["mass_bounds"]["low_earth"] / clearing["minimum_mass_earth"]
            high_pi = result["mass_bounds"]["high_earth"] / clearing["minimum_mass_earth"]
            if not all(math.isfinite(value) and value > 0 for value in (low_pi, high_pi)):
                raise ValueError("invalid_mass_scenario_result")
            result["clearing"]["pi_bounds"] = {
                "low": low_pi,
                "high": high_pi,
                "definition": "parameter_corner_range_not_confidence_interval",
            }
            result["clearing"]["parameter_range_classification"] = (
                "below_model"
                if high_pi < 1
                else "meets_model"
                if low_pi >= 1
                else "straddles_model"
            )
    return result


def _plain(value: str) -> str:
    return " ".join(html.unescape(re.sub("<[^>]+>", " ", value)).split())


def _moon_facts(raw: bytes) -> dict:
    document = raw.decode("utf-8")
    plain = _plain(document)
    for token in ("km", "g/cm", "equivalent volume", "derived from the specified", "GM"):
        if token not in plain:
            raise ValueError("mass_scenario_jpl_table_definition_changed")
    selected = {}
    for row in re.findall(r"<tr\b.*?</tr>", document, re.DOTALL):
        # JPL's valid HTML omits some optional closing </td> tags.
        cells = [
            _plain(cell) for cell in re.findall(r"<td\b[^>]*>(.*?)(?=<td\b|</tr>)", row, re.DOTALL)
        ]
        if len(cells) != 12 or cells[1].lower() not in ANALOGUES:
            continue
        identifier = cells[1].lower()
        code, gm, gm_sigma, radius, radius_sigma, density, density_sigma, ephemeris = ANALOGUES[
            identifier
        ]
        if cells[2] != code or cells[5] != ephemeris or cells[8] != "1" or cells[11] != "*":
            raise ValueError("mass_scenario_moon_identity_or_reference_changed")
        actual = [float(cells[index]) for index in (3, 4, 6, 7, 9, 10)]
        if actual != [gm, gm_sigma, radius, radius_sigma, density, density_sigma]:
            raise ValueError("mass_scenario_adopted_moon_values_changed")
        selected[identifier] = {
            "object_id": "moon-" + code,
            "name": cells[1],
            "parent_name": cells[0],
            "radius_km": radius,
            "radius_sigma_km": radius_sigma,
            "radius_definition": "volume_equivalent_mean_radius",
            "density_kg_m3": density * 1000,
            "density_sigma_kg_m3": density_sigma * 1000,
            "original_density_g_cm3": density,
            "original_density_sigma_g_cm3": density_sigma,
            "density_definition": "bulk_density_derived_from_GM_and_volume_equivalent_mean_radius",
            "gm_km3_s2": gm,
            "gm_sigma_km3_s2": gm_sigma,
            "gm_ephemeris": ephemeris,
            "radius_reference": "Archinal et al. 2018, Celestial Mechanics 130:22, IAU cartographic report 2015",
            "original_cells": cells,
        }
    if set(selected) != set(ANALOGUES):
        raise ValueError("mass_scenario_missing_moon_rows")
    return {
        "analogue_selection": "six_named_icy_moons_of_similar_size_order_not_a_calibrated_density_prior",
        "mean_radius_definition": "Radius of sphere with equivalent satellite volume",
        "density_definition": "JPL derived bulk density from GM and equivalent-volume radius; not an independently observed compositional density",
        "reported_sigma": "Source-reported sigma values retained; not propagated as a joint target-mass confidence interval",
        "analogues": selected,
    }


def _interpretation_facts() -> dict:
    return {
        "use": "Qualitative limitations only; no numeric density or mass adopted from this review",
        "section": "6 Interior evolution of moons, printed page 35 / PDF page 35",
        "facts": [
            "Bulk-density interpretation involves the relative amounts of ices and silicate rock or refractory material.",
            "Porosity in smaller moons and compression in larger moons affect density/composition interpretation.",
            "Thermal and differentiation histories differ among moons; similar radius does not establish identical bulk density.",
        ],
    }


def _safe_url(url: str) -> None:
    parsed = urlsplit(url)
    if (
        parsed.scheme != "https"
        or parsed.hostname not in {"ssd.jpl.nasa.gov", "ntrs.nasa.gov"}
        or parsed.username
        or parsed.password
    ):
        raise ValueError("invalid_mass_scenario_source_url")


def _write(path: Path, raw: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != raw:
            raise ValueError("existing_mass_scenario_file_changed:" + path.name)
        return
    with path.open("xb") as output:
        output.write(raw)


def _json(value: dict) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n").encode("utf-8")


def _fetch(root: Path, key: str) -> tuple[bytes, dict]:
    specification = SOURCES[key]
    path = root / REFERENCE_ROOT / "upstream" / (key + specification["extension"])
    sidecar = path.with_suffix(path.suffix + ".source.json")
    if path.exists():
        raw = path.read_bytes()
        metadata = json.loads(sidecar.read_bytes())
        if (
            metadata["url"] != specification["url"]
            or metadata["sha256"] != _hash(raw)
            or metadata["bytes"] != len(raw)
        ):
            raise ValueError("existing_mass_scenario_upstream_changed")
        return raw, metadata
    _safe_url(specification["url"])
    with urlopen(
        Request(specification["url"], headers={"User-Agent": "SpaceApps-mass-scenarios/0.8"}),
        timeout=45,
    ) as response:
        _safe_url(response.url)
        raw = response.read(12_000_001)
        resolved = response.url
    if not raw or len(raw) > 12_000_000:
        raise ValueError("invalid_mass_scenario_source_size")
    metadata = {
        "url": specification["url"],
        "resolved_url": resolved,
        "bytes": len(raw),
        "sha256": _hash(raw),
        "local_relative_path": path.relative_to(root).as_posix(),
        "retrieved_utc": datetime.now(UTC).isoformat(),
        "provider": specification["provider"],
        "publication_host": specification["publication_host"],
        "redistribution": "local_audit_only_not_runtime",
    }
    _write(path, raw)
    _write(sidecar, _json(metadata))
    return raw, metadata


def _dependencies(root: Path) -> dict:
    result = {}
    for key, name in (
        ("planet_criteria", "planet_criteria"),
        ("small_body_appearance", "small_body_appearance"),
    ):
        path = "data/manifests/" + name + ".json"
        raw = (root / path).read_bytes()
        result[key] = {
            "path": path,
            "bytes": len(raw),
            "sha256": _hash(raw),
            "use": "immutable existing adopted source and calculation dependency",
        }
    return result


def _model(criteria: dict) -> dict:
    if criteria["objects"]["earth"]["mass"]["mass_kg"] != EARTH_MASS_KG:
        raise ValueError("mass_scenario_earth_mass_reference_changed")
    return {
        "id": ALGORITHM,
        "volume_shape": "assumed_sphere",
        "formula": "M[kg] = density[kg/m^3] * (4*pi/3) * (radius[km]*1000)^3",
        "earth_mass_kg": EARTH_MASS_KG,
        "earth_mass_source": criteria["objects"]["earth"]["mass"]["source"],
        "density_input_min_kg_m3": DENSITY_MIN,
        "density_input_max_kg_m3": DENSITY_MAX,
        "density_input_range_kind": "interface_operating_range_not_universal_physical_bounds",
        "clearing_model": criteria["model"],
        "uncertainty_kind": "parameter_corner_range_not_confidence_interval",
    }


def _targets(criteria: dict, appearance: dict, analogues: dict) -> dict:
    result = {}
    for identifier in sorted(TARGET_IDS):
        body = criteria["objects"][identifier]
        profile = appearance["profiles"][identifier]
        if body["mass"]["earth_masses"] is not None:
            raise ValueError("mass_scenario_target_has_adopted_primary_mass")
        radius = profile["reference_radius_km"]
        uncertainty = profile["reference_radius_uncertainty_km"]
        low = radius - uncertainty["minus_km"] if uncertainty is not None else None
        high = radius + uncertainty["plus_km"] if uncertainty is not None else None
        scenarios = {}
        for key, analogue in analogues.items():
            density, sigma = analogue["density_kg_m3"], analogue["density_sigma_kg_m3"]
            scenarios[key] = calculate_mass_scenario(
                radius,
                density,
                radius_bounds_km=(low, high) if low is not None else None,
                density_bounds_kg_m3=(density - sigma, density + sigma),
                semimajor_axis_au=body["orbit"]["semimajor_axis_au"],
            )
        result[identifier] = {
            "object_id": identifier,
            "name": body["name"],
            "official_classification": body["official_classification"],
            "radius_km": radius,
            "radius_low_km": low,
            "radius_high_km": high,
            "radius_definition": profile["reference_radius_definition"],
            "radius_uncertainty_status": "source_offsets_used_as_parameter_endpoints_not_joint_probability"
            if uncertainty
            else "not_quoted_in_adopted_source",
            "radius_source": profile["reference_radius_source"],
            "radius_provenance": RADIUS_PROVENANCE[identifier],
            "semimajor_axis_au": body["orbit"]["semimajor_axis_au"],
            "eccentricity": body["orbit"]["eccentricity"],
            "orbit_epoch_tdb_jd": body["orbit"]["epoch_tdb_jd"],
            "orbit_source": body["orbit"]["source"],
            "measured_primary_mass": body["mass"],
            "published_system_mass": body["system_mass"],
            "adopted_criteria": body["criteria"],
            "analogue_scenarios": scenarios,
            "volume_assumption": RADIUS_PROVENANCE[identifier]["volume_assumption"],
            "high_eccentricity_circular_reference_warning": body["orbit"]["eccentricity"] >= 0.5,
        }
    return result


def _summary(targets: dict) -> dict:
    envelopes = {}
    for identifier, body in targets.items():
        ranges = [
            scenario["clearing"]["pi_bounds"] for scenario in body["analogue_scenarios"].values()
        ]
        low, high = min(value["low"] for value in ranges), max(value["high"] for value in ranges)
        envelopes[identifier] = {
            "pi_low": low,
            "pi_high": high,
            "can_meet_model_within_source_parameter_corners": high >= 1,
        }
    return {
        "target_count": len(targets),
        "analogue_count": len(ANALOGUES),
        "scenario_count": sum(len(body["analogue_scenarios"]) for body in targets.values()),
        "conditional_target_count_meets_model_range": sum(
            value["can_meet_model_within_source_parameter_corners"] for value in envelopes.values()
        ),
        "range_definition": "Envelope of six named source moon bulk densities +/- their reported sigma and each adopted target radius's quoted offsets, used only as arithmetic parameter corners; missing radius uncertainty is held at the nominal radius. Not a joint confidence interval, physical density bound, likelihood or exhaustive census.",
        "source_analogue_parameter_corner_envelopes": envelopes,
    }


def acquire(root: Path) -> dict:
    root = root.resolve()
    if (root / MANIFEST).exists():
        return get_mass_scenarios(root)
    criteria, appearance = get_planet_criteria(root), get_small_body_appearance(root)
    sources, facts = {}, {}
    for key, specification in SOURCES.items():
        raw, upstream = _fetch(root, key)
        if key == "jpl-icy-moons":
            extracted = _moon_facts(raw)
        else:
            # PDF parser is acquisition-only, never a runtime requirement.
            from pypdf import PdfReader

            text = " ".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(raw)).pages)
            if any(
                token not in text
                for token in ("porosity", "compression", "Interior evolution", "silicate")
            ):
                raise ValueError("mass_scenario_interpretation_source_changed")
            extracted = _interpretation_facts()
        snapshot = {
            "schema_version": "1.0",
            "kind": "authored_factual_source_extract",
            "source_url": upstream["url"],
            "upstream_sha256": upstream["sha256"],
            "upstream_bytes": upstream["bytes"],
            "upstream_retrieved_utc": upstream["retrieved_utc"],
            "facts": extracted,
            "rights": "Project-authored scientific facts; original publication prose, figures and images remain local audit material, not distributed runtime data.",
        }
        content = _json(snapshot)
        path = root / REFERENCE_ROOT / "facts" / (key + ".json")
        source = {
            "source_id": key,
            "url": specification["url"],
            "label": specification["label"],
            "provider": specification["provider"],
            "publication_host": specification["publication_host"],
            "local_relative_path": path.relative_to(root).as_posix(),
            "bytes": len(content),
            "sha256": _hash(content),
            "retrieved_utc": upstream["retrieved_utc"],
            "upstream_sha256": upstream["sha256"],
            "upstream_bytes": upstream["bytes"],
            "upstream_original_local_only": upstream["local_relative_path"],
            "upstream_original_requirement": "optional_not_runtime",
            "redistribution": "authored_factual_extract_only",
        }
        _write(path, content)
        _write(path.with_suffix(".source.json"), _json(source))
        sources[key], facts[key] = source, extracted
    analogues = {
        key: value | {"source": sources["jpl-icy-moons"]}
        for key, value in facts["jpl-icy-moons"]["analogues"].items()
    }
    targets = _targets(criteria, appearance, analogues)
    manifest = {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM,
        "created_utc": datetime.now(UTC).isoformat(),
        "model": _model(criteria),
        "sources": sources,
        "dependencies": _dependencies(root),
        "analogues": analogues,
        "targets": targets,
        "summary": _summary(targets),
        "limitations": LIMITATIONS,
        "source_selection_policy": "New analogue inputs use NASA/JPL and qualitative NASA NTRS references; previously adopted radius facts retain their observatory/provider and publication-host identity. No new Chinese-agency data or archive is adopted; author nationality is not inferred or filtered.",
        "coverage": "six_existing_bodies_without_adopted_separate_primary_mass_not_a_planet_likelihood_ranking",
        "rights": "Project-authored factual snapshots and calculations; full upstream publications are local audit only.",
    }
    _write(root / MANIFEST, _json(manifest))
    return get_mass_scenarios(root)


def get_mass_scenarios(root: Path) -> dict:
    root = root.resolve()
    raw = (root / MANIFEST).read_bytes()
    data = json.loads(raw)
    if data["schema_version"] != "1.0" or data["algorithm_version"] != ALGORITHM:
        raise ValueError("unsupported_mass_scenario_manifest")
    if data["dependencies"] != _dependencies(root):
        raise ValueError("mass_scenario_dependency_changed")
    if set(data["sources"]) != set(SOURCES):
        raise ValueError("mass_scenario_source_set_changed")
    facts = {}
    for key, source in data["sources"].items():
        specification = SOURCES[key]
        relative = f"{REFERENCE_ROOT}/facts/{key}.json"
        if source["local_relative_path"] != relative or not (
            root / relative
        ).resolve().is_relative_to((root / REFERENCE_ROOT / "facts").resolve()):
            raise ValueError("mass_scenario_source_path_escape")
        content = (root / relative).read_bytes()
        if len(content) != source["bytes"] or _hash(content) != source["sha256"]:
            raise ValueError("mass_scenario_source_integrity_failed")
        snapshot = json.loads(content)
        if (
            source["url"] != specification["url"]
            or snapshot["source_url"] != specification["url"]
            or source["source_id"] != key
            or source["provider"] != specification["provider"]
            or source["publication_host"] != specification["publication_host"]
            or source["upstream_original_requirement"] != "optional_not_runtime"
            or snapshot["upstream_sha256"] != source["upstream_sha256"]
            or snapshot["upstream_bytes"] != source["upstream_bytes"]
        ):
            raise ValueError("mass_scenario_source_provenance_changed")
        facts[key] = snapshot["facts"]
    # Validate frozen factual rows independently of the cached target scenarios.
    for key, row in facts["jpl-icy-moons"]["analogues"].items():
        code, gm, gm_sigma, radius, radius_sigma, density, density_sigma, ephemeris = ANALOGUES[key]
        if (
            row["object_id"],
            row["gm_km3_s2"],
            row["gm_sigma_km3_s2"],
            row["radius_km"],
            row["radius_sigma_km"],
            row["density_kg_m3"],
            row["density_sigma_kg_m3"],
            row["gm_ephemeris"],
        ) != (
            "moon-" + code,
            gm,
            gm_sigma,
            radius,
            radius_sigma,
            density * 1000,
            density_sigma * 1000,
            ephemeris,
        ):
            raise ValueError("mass_scenario_moon_facts_changed")
    if (
        set(facts["jpl-icy-moons"]["analogues"]) != set(ANALOGUES)
        or facts["density-interpretation"] != _interpretation_facts()
    ):
        raise ValueError("mass_scenario_adopted_facts_changed")
    criteria, appearance = get_planet_criteria(root), get_small_body_appearance(root)
    analogues = {
        key: value | {"source": data["sources"]["jpl-icy-moons"]}
        for key, value in facts["jpl-icy-moons"]["analogues"].items()
    }
    if (
        data["model"] != _model(criteria)
        or data["analogues"] != analogues
        or data["targets"] != _targets(criteria, appearance, analogues)
        or data["summary"] != _summary(data["targets"])
        or data["limitations"] != LIMITATIONS
    ):
        raise ValueError("mass_scenario_model_or_target_changed")
    return data | {"source_manifest_sha256": _hash(raw)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    options = parser.parse_args()
    result = acquire(options.root)
    print(
        json.dumps(
            {
                "sources": len(result["sources"]),
                "analogues": len(result["analogues"]),
                "targets": len(result["targets"]),
                "source_manifest_sha256": result["source_manifest_sha256"],
            }
        )
    )
