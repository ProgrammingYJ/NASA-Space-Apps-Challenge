"""Source-backed appearance constraints for eight existing small bodies.

Palette RGB is illustrative. Unresolved topography is not manufactured. Original
papers/pages are local audit material; runtime uses authored factual snapshots.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import io
import json
import math
import re
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

MANIFEST = "data/manifests/small_body_appearance.json"
REFERENCE_ROOT = "data/reference/small-body-appearance"
ALGORITHM = "sourced-small-body-appearance-v1"
BODY_IDS = {"ceres", "haumea", "makemake", "eris", "sedna", "quaoar", "orcus", "gonggong"}
ALLOWED_HOSTS = {
    "arxiv.org",
    "science.nasa.gov",
    "www.jpl.nasa.gov",
    "www.eso.org",
    "apod.nasa.gov",
    "www.aanda.org",
    "perso.utinam.cnrs.fr",
}

# Short project-authored facts, not reproduced paper prose, figures or textures.
SOURCE_SPECIFICATIONS = {
    "ceres-maps": {
        "urls": ["https://arxiv.org/abs/1701.08550"],
        "label": "Schroder et al. (2017), Dawn FC resolved Ceres spectrophotometry",
        "facts": {
            "object_id": "ceres",
            "surface_resolved": True,
            "data_product": "Dawn framing-camera global albedo and color maps",
            "existing_project_map_policy": "Preserve the already adopted Ceres map.",
        },
        "tokens": ["Ceres", "Dawn", "global maps", "albedo"],
    },
    "sedna-color": {
        "urls": [
            "https://www.jpl.nasa.gov/news/most-distant-object-in-solar-system-discovered/",
            "https://apod.nasa.gov/apod/ap040316.html",
        ],
        "label": "NASA/JPL and APOD Sedna color summaries, March 2004",
        "facts": {
            "object_id": "sedna",
            "qualitative_color": "reddish",
            "adoption": "Color description only; historic size/ranking claims are not adopted.",
        },
        "tokens": ["Sedna", "red"],
    },
    "sedna-size": {
        "urls": ["https://arxiv.org/abs/1204.0899"],
        "label": "Pal et al. (2012), A&A 541 L6, doi:10.1051/0004-6361/201218874",
        "facts": {
            "object_id": "sedna",
            "diameter_km": 995,
            "diameter_uncertainty_km": 80,
            "geometric_albedo": 0.32,
            "geometric_albedo_uncertainty": 0.06,
            "method": "Herschel thermophysical-model estimate",
        },
        "tokens": ["Sedna", "995", "80", "thermophysical"],
    },
    "haumea-occultation": {
        "urls": ["https://arxiv.org/pdf/2006.03113"],
        "label": "Ortiz et al. (2017), Nature 550 219, doi:10.1038/nature24051",
        "facts": {
            "object_id": "haumea",
            "occultation_date": "2017-01-21",
            "semiaxes_km_abc": [1161, 852, 513],
            "main_text_semiaxis_uncertainties_km": [30, 4, 16],
            "methods_b_uncertainty_km": 2,
            "reported_volume_equivalent_diameter_km": 1595,
            "reported_diameter_uncertainty_km": 11,
            "shape_condition": "Triaxial occultation/light-curve model neglecting ring light.",
            "geometric_albedo": 0.51,
            "geometric_albedo_uncertainty": 0.02,
            "ring_radius_km": 2287,
            "ring_radius_minus_km": 45,
            "ring_radius_plus_km": 75,
            "ring_width_km": 70,
            "ring_pole_j2000_deg": [285.1, -10.6],
            "ring_pole_uncertainties_deg": [0.5, 1.2],
        },
        "tokens": ["1161", "852", "513", "2287", "0.51"],
    },
    "makemake-nasa": {
        "urls": ["https://science.nasa.gov/dwarf-planets/makemake/"],
        "label": "NASA Science Makemake facts",
        "facts": {
            "object_id": "makemake",
            "qualitative_color": "reddish-brownish",
            "approximate_diameter_km": 1430,
            "surface_detail": "not resolved",
        },
        "tokens": ["Makemake", "reddish-brownish", "1430"],
    },
    "eris-occultation": {
        "urls": ["https://www.eso.org/public/news/eso1142/"],
        "label": "ESO 26 October 2011, Sicardy et al. Nature occultation results",
        "facts": {
            "object_id": "eris",
            "diameter_km": 2326,
            "diameter_uncertainty_km": 12,
            "visible_geometric_albedo": 0.96,
            "limb_description": "close to spherical",
            "adoption": "Bright palette represents high albedo; RGB is not measured.",
        },
        "tokens": ["Eris", "2326", "0.96", "close to spherical"],
    },
    "orcus-color": {
        "urls": [
            "https://www.aanda.org/articles/aa/pdf/2008/07/aa9079-07.pdf",
            "https://perso.utinam.cnrs.fr/~aguilbert/docs/barucci08.pdf",
        ],
        "label": "Barucci et al. (2008), A&A 479 L13, doi:10.1051/0004-6361:20079079",
        "facts": {
            "object_id": "orcus",
            "qualitative_visible_color": "neutral",
            "spectral_evidence": "Nearly flat visible spectrum; crystalline water ice in near infrared.",
        },
        "tokens": ["Orcus", "neutral color", "water ice"],
    },
    "orcus-size": {
        "urls": ["https://arxiv.org/html/1801.07221v2"],
        "label": "Brown & Butler (2018), AJ, doi:10.3847/1538-3881/aad9f2",
        "facts": {
            "object_id": "orcus",
            "diameter_km": 910,
            "diameter_minus_km": 40,
            "diameter_plus_km": 50,
            "method": "Resolved ALMA system thermal radiometry with emissivity/model assumptions",
        },
        "tokens": ["Orcus", "910", "475", "0.685"],
    },
    "gonggong-quaoar-color": {
        "urls": ["https://arxiv.org/abs/1108.1418"],
        "label": "Brown, Burgasser & Fraser (2011), ApJL, doi:10.1088/2041-8205/738/2/L26",
        "facts": {
            "object_ids": ["gonggong", "quaoar"],
            "qualitative_optical_color": "red",
            "spectral_evidence": "Water-ice absorption with red optical colors.",
            "adoption": "Irradiated-methane explanation was a hypothesis, not a resolved surface map.",
        },
        "tokens": ["2007 OR10", "reddest", "Quaoar", "red coloring"],
    },
    "gonggong-size": {
        "urls": ["https://arxiv.org/abs/1903.05439"],
        "label": "Kiss et al. (2019), Icarus, doi:10.1016/j.icarus.2019.03.013",
        "facts": {
            "object_id": "gonggong",
            "diameter_km": 1230,
            "diameter_uncertainty_km": 50,
            "condition": "Spherical thermophysical model with satellite orbit in primary equatorial plane.",
            "shape_measured": False,
        },
        "tokens": ["1230", "50", "spherical", "equatorial plane"],
    },
    "quaoar-occultation-2023": {
        "urls": ["https://arxiv.org/html/2304.09237v1"],
        "label": "Pereira et al. (2023), A&A 673 L4, doi:10.1051/0004-6361/202346365",
        "facts": {
            "object_id": "quaoar",
            "occultation_date": "2022-08-09",
            "area_equivalent_radius_km": 543,
            "radius_uncertainty_km": 2,
            "old_q1r_radius_km": 4057.2,
            "old_q1r_uncertainty_km": 5.8,
            "old_q2r_radius_km": 2520,
            "old_q2r_uncertainty_km": 20,
            "radius_definition": "Instantaneous projected area-equivalent radius, not a volume radius.",
        },
        "tokens": ["Quaoar", "543", "2520", "4057"],
    },
    "quaoar-rings-2025": {
        "urls": ["https://arxiv.org/html/2506.07898v1"],
        "label": "Proudfoot et al. (2025), PSJ, doi:10.3847/PSJ/addd02, Table 2",
        "facts": {
            "object_id": "quaoar",
            "q1r_radius_km": 4096,
            "q1r_uncertainty_km": 10,
            "q2r_radius_km": 2529,
            "q2r_uncertainty_km": 12,
            "ring_pole_j2000_deg": [259.5, 55.0],
            "pole_uncertainties_deg": [0.2, 0.2],
            "model": "Simultaneous circular fixed-pole Q1R+Q2R fit, excluding possible ingress Q2R.",
            "caveat": "Systematic pole/radius differences from earlier fits; azimuthal ring variations.",
            "third_ring": "Not adopted; the paper favors an outlier over a confirmed new ring.",
        },
        "tokens": ["4096", "2529", "259.5", "55.0", "systematic"],
    },
}

COMMON_LIMITATIONS = [
    "RGB is a project display palette guided by qualitative observations, not calibrated true color.",
    "No random crater map, geographic texture, local ice distribution or current rotational phase is supplied.",
    "Unknown three-dimensional shape remains null; a display sphere is an explicit assumption.",
    "Literature size estimates and their assumptions do not replace existing JPL catalog radii or ephemerides.",
]


def _hash(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _safe_url(url: str) -> None:
    parts = urlsplit(url)
    if (
        parts.scheme != "https"
        or parts.hostname not in ALLOWED_HOSTS
        or parts.username
        or parts.password
    ):
        raise ValueError("invalid_small_body_source_url")


def _path(root: Path, relative: str, *, facts_only: bool = True) -> Path:
    base = root / REFERENCE_ROOT / "facts" if facts_only else root / REFERENCE_ROOT
    path = (root / relative).resolve()
    if not path.is_relative_to(base.resolve()):
        raise ValueError("small_body_source_path_escape")
    return path


def _source_text(raw: bytes) -> str:
    if raw.startswith(b"%PDF-"):
        # Optional acquisition-only dependency; runtime never needs the papers.
        from pypdf import PdfReader

        text = " ".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(raw)).pages)
    else:
        text = html.unescape(re.sub("<[^>]+>", " ", raw.decode("utf-8")))
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text)).replace(",", "")


def _fetch(root: Path, key: str, specification: dict) -> tuple[bytes, dict]:
    existing = list((root / REFERENCE_ROOT / "upstream").glob(key + ".*"))
    originals = [path for path in existing if not path.name.endswith(".source.json")]
    if originals:
        if len(originals) != 1:
            raise ValueError("duplicate_small_body_original")
        path = originals[0]
        info = json.loads(path.with_suffix(path.suffix + ".source.json").read_bytes())
        raw = path.read_bytes()
        if (
            info["url"] not in specification["urls"]
            or len(raw) != info["bytes"]
            or _hash(raw) != info["sha256"]
        ):
            raise ValueError("existing_small_body_original_changed")
        return raw, info
    if existing:
        raise ValueError("orphan_small_body_original_metadata")
    attempts = []
    for url in specification["urls"]:
        _safe_url(url)
        try:
            with urlopen(
                Request(url, headers={"User-Agent": "SpaceApps-small-body-facts/0.7"}), timeout=45
            ) as response:
                _safe_url(response.url)
                raw, resolved = response.read(5_000_001), response.url
            if not raw or len(raw) > 5_000_000:
                raise ValueError("invalid_small_body_source_size")
            suffix = ".pdf" if raw.startswith(b"%PDF-") else ".html"
            path = root / REFERENCE_ROOT / "upstream" / (key + suffix)
            info = {
                "url": url,
                "resolved_url": resolved,
                "local_relative_path": path.relative_to(root).as_posix(),
                "bytes": len(raw),
                "sha256": _hash(raw),
                "retrieved_utc": datetime.now(UTC).isoformat(),
                "redistribution": "local_reference_only_not_in_public_release",
                "failed_url_attempts": attempts,
            }
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
            path.with_suffix(path.suffix + ".source.json").write_text(
                json.dumps(info, indent=2) + "\n", encoding="utf-8"
            )
            return raw, info
        except (OSError, ValueError) as exc:
            attempts.append(
                {"url": url, "error_type": type(exc).__name__, "message": str(exc)[:250]}
            )
    raise ValueError("small_body_source_acquisition_failed:" + key + ":" + str(attempts))


def _profiles(sources: dict) -> dict:
    def profile(identifier: str, color: str, evidence: str, source_key: str) -> dict:
        return {
            "object_id": identifier,
            "color_hex": color,
            "color_evidence": evidence,
            "palette_status": "illustrative_not_calibrated_RGB",
            "color_source": sources[source_key],
            "shape_axis_ratios": None,
            "shape_status": "unmeasured_3d_shape_display_sphere_assumed",
            "shape_source": None,
            "reference_radius_km": None,
            "reference_radius_definition": None,
            "reference_radius_uncertainty_km": None,
            "reference_radius_source": None,
            "rings": [],
            "source": sources[source_key],
            "limitations": list(COMMON_LIMITATIONS),
            "surface_resolved": False,
            "preserve_existing_map": False,
            "procedural_surface": False,
        }

    def radius(
        item: dict,
        value: float,
        definition: str,
        source_key: str,
        minus: float | None = None,
        plus: float | None = None,
    ) -> None:
        item.update(
            reference_radius_km=value,
            reference_radius_definition=definition,
            reference_radius_source=sources[source_key],
            reference_radius_uncertainty_km={"minus_km": minus, "plus_km": plus}
            if minus is not None
            else None,
        )

    result = {
        "ceres": profile(
            "ceres",
            "#888780",
            "Dawn resolved albedo/color maps exist; keep the adopted map, not this palette.",
            "ceres-maps",
        ),
        "haumea": profile(
            "haumea",
            "#d8d8d2",
            "Visible geometric albedo 0.51 +/- 0.02 supports a bright display; the neutral RGB hue is unmeasured.",
            "haumea-occultation",
        ),
        "makemake": profile(
            "makemake",
            "#a77b63",
            "NASA describes a reddish-brownish unresolved surface.",
            "makemake-nasa",
        ),
        "eris": profile(
            "eris",
            "#e4e3df",
            "The occultation study gives visible geometric albedo about 0.96; the bright neutral palette is illustrative.",
            "eris-occultation",
        ),
        "sedna": profile(
            "sedna",
            "#a55e49",
            "Sedna has an observed reddish color; this RGB shade is not a measured spectrum-to-color conversion.",
            "sedna-color",
        ),
        "quaoar": profile(
            "quaoar",
            "#9d6b56",
            "Published optical observations describe red coloring, with water-ice spectral absorption.",
            "gonggong-quaoar-color",
        ),
        "orcus": profile(
            "orcus",
            "#a7aaa8",
            "The visible spectrum is nearly flat/neutral; near-infrared spectra show crystalline water ice.",
            "orcus-color",
        ),
        "gonggong": profile(
            "gonggong",
            "#a7624c",
            "2007 OR10/Gonggong is optically very red; the physical origin and local surface are not mapped here.",
            "gonggong-quaoar-color",
        ),
    }
    result["ceres"].update(
        surface_resolved=True,
        preserve_existing_map=True,
        shape_status="existing_resolved_map_preserved",
    )
    haumea = result["haumea"]
    haumea.update(
        shape_axis_ratios=[1, 852 / 1161, 513 / 1161],
        shape_status="published_occultation_lightcurve_triaxial_model",
        shape_source=sources["haumea-occultation"],
    )
    radius(
        haumea,
        round(math.cbrt(1161 * 852 * 513), 2),
        "Geometric mean of the adopted 1161/852/513 km semiaxes; nominal derived value, not an independent measurement.",
        "haumea-occultation",
        5.5,
        5.5,
    )
    haumea["limitations"] += [
        "The adopted triaxial model uses occultation plus light curve and neglects ring-light contribution; it is not a resolved shape mesh.",
        "The paper reports b uncertainty 4 km in its main text and 2 km in Methods; the factual snapshot retains both.",
        "The reported volume-equivalent diameter is 1595 +/- 11 km; ring-light alternatives change it, so the reference radius is model dependent.",
    ]
    haumea["rings"] = [
        {
            "ring_id": "haumea-ring",
            "name": "Haumea ring",
            "center_radius_km": 2287,
            "radius_uncertainty_km": {"minus_km": 45, "plus_km": 75},
            "width_km": 70,
            "width_status": "published_occultation_model_nominal_width",
            "pole_j2000_deg": {
                "ra": 285.1,
                "dec": -10.6,
                "ra_uncertainty": 0.5,
                "dec_uncertainty": 1.2,
            },
            "source": sources["haumea-occultation"],
            "limitations": [
                "Preferred circular-ring pole solution 1 from the 2017 event.",
                "A screen-width centerline does not represent measured ring width, opacity, color or individual particles.",
            ],
        }
    ]
    radius(
        result["makemake"],
        715,
        "Half NASA's approximate 1430 km diameter; no uncertainty quoted.",
        "makemake-nasa",
    )
    radius(
        result["eris"],
        1163,
        "Half the 2010-occultation diameter 2326 +/- 12 km.",
        "eris-occultation",
        6,
        6,
    )
    result["eris"]["limitations"].append(
        "The occultation limb is close to spherical, but no resolved geographic surface or full axis solution is supplied."
    )
    radius(
        result["sedna"],
        497.5,
        "Half the Herschel thermophysical diameter 995 +/- 80 km; not a resolved limb measurement.",
        "sedna-size",
        40,
        40,
    )
    radius(
        result["quaoar"],
        543,
        "Projected area-equivalent radius at the 2022-08-09 occultation, not a volume-equivalent sphere radius.",
        "quaoar-occultation-2023",
        2,
        2,
    )
    result["quaoar"]["limitations"] += [
        "The area-equivalent reference radius is epoch/projection dependent and is used only to scale a disclosed display sphere.",
        "The 2025 circular fixed-pole ring fit differs systematically from the 2023 solution; this is not measured ring motion.",
        "Three-dimensional shape and current rotational orientation are not adopted; a recent unreviewed shape model is not promoted.",
    ]
    for ring_id, value, uncertainty in [("Q1R", 4096, 10), ("Q2R", 2529, 12)]:
        result["quaoar"]["rings"].append(
            {
                "ring_id": ring_id.lower(),
                "name": ring_id,
                "center_radius_km": value,
                "radius_uncertainty_km": {"minus_km": uncertainty, "plus_km": uncertainty},
                "width_km": None,
                "width_status": "azimuthally_variable_not_one_adopted_uniform_width",
                "pole_j2000_deg": {
                    "ra": 259.5,
                    "dec": 55.0,
                    "ra_uncertainty": 0.2,
                    "dec_uncertainty": 0.2,
                },
                "source": sources["quaoar-rings-2025"],
                "limitations": [
                    "Simultaneous circular fixed-pole Q1R+Q2R fit to observations through 2024; possible ingress Q2R excluded.",
                    "Azimuthal variations and systematic geometry differences are present; a uniform centerline is illustrative.",
                    "No confirmed third ring is included; line thickness/color/opacity and particles are not measured here.",
                ],
            }
        )
    radius(
        result["orcus"],
        455,
        "Half the resolved-system thermal-radiometry diameter 910 (-40,+50) km.",
        "orcus-size",
        20,
        25,
    )
    radius(
        result["gonggong"],
        615,
        "Half the 1230 +/- 50 km thermophysical diameter, assuming a sphere and equatorial satellite orbit.",
        "gonggong-size",
        25,
        25,
    )
    result["gonggong"]["limitations"].append(
        "The radius comes from an assumed spherical thermophysical model; it does not measure spherical shape."
    )
    return result


def acquire(root: Path) -> dict:
    root = root.resolve()
    if (root / MANIFEST).exists():
        return get_small_body_appearance(root)
    with ThreadPoolExecutor(max_workers=2) as pool:
        originals = dict(
            zip(
                SOURCE_SPECIFICATIONS,
                pool.map(lambda item: _fetch(root, *item), SOURCE_SPECIFICATIONS.items()),
                strict=True,
            )
        )
    sources = {}
    for key, specification in SOURCE_SPECIFICATIONS.items():
        raw, upstream = originals[key]
        text = _source_text(raw).lower()
        if any(token.lower().replace(",", "") not in text for token in specification["tokens"]):
            raise ValueError("small_body_claim_missing_from_source:" + key)
        snapshot = {
            "schema_version": "1.0",
            "kind": "authored_factual_source_extract",
            "source_url": upstream["url"],
            "upstream_sha256": upstream["sha256"],
            "upstream_bytes": upstream["bytes"],
            "upstream_retrieved_utc": upstream["retrieved_utc"],
            "facts": specification["facts"],
            "rights": "Project-authored scientific facts; no paper prose, figures, maps or textures redistributed.",
        }
        content = (
            json.dumps(snapshot, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
        ).encode("utf-8")
        path = root / REFERENCE_ROOT / "facts" / (key + ".json")
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists() and path.read_bytes() != content:
            raise ValueError("existing_small_body_facts_changed:" + key)
        path.write_bytes(content)
        source = {
            "source_id": key,
            "url": upstream["url"],
            "label": specification["label"],
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
        path.with_suffix(".source.json").write_text(
            json.dumps(source, indent=2) + "\n", encoding="utf-8"
        )
        sources[key] = source
    dependencies = {}
    for name in ["extended_solar.json", "appearance.json"]:
        relative = "data/manifests/" + name
        raw = (root / relative).read_bytes()
        dependencies[name] = {"path": relative, "bytes": len(raw), "sha256": _hash(raw)}
    manifest = {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM,
        "created_utc": datetime.now(UTC).isoformat(),
        "coverage": "eight_existing_objects_not_all_small_bodies",
        "profiles": _profiles(sources),
        "sources": sources,
        "dependencies": dependencies,
        "limitations": COMMON_LIMITATIONS,
        "release_rule": "Include facts/ and sidecars; upstream/ originals and sidecars are local-only and not required at runtime.",
    }
    (root / MANIFEST).write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8"
    )
    return get_small_body_appearance(root)


def get_small_body_appearance(root: Path) -> dict:
    root = root.resolve()
    raw = (root / MANIFEST).read_bytes()
    data = json.loads(raw)
    if data["schema_version"] != "1.0" or data["algorithm_version"] != ALGORITHM:
        raise ValueError("unsupported_small_body_appearance")
    if set(data["sources"]) != set(SOURCE_SPECIFICATIONS) or set(data["profiles"]) != BODY_IDS:
        raise ValueError("small_body_appearance_source_or_object_set_changed")
    for key, source in data["sources"].items():
        _safe_url(source["url"])
        if source["url"] not in SOURCE_SPECIFICATIONS[key]["urls"]:
            raise ValueError("small_body_source_url_changed")
        content = _path(root, source["local_relative_path"]).read_bytes()
        if len(content) != source["bytes"] or _hash(content) != source["sha256"]:
            raise ValueError("small_body_source_integrity_failed")
        snapshot = json.loads(content)
        if (
            snapshot["source_url"] != source["url"]
            or snapshot["facts"] != SOURCE_SPECIFICATIONS[key]["facts"]
            or snapshot["upstream_sha256"] != source["upstream_sha256"]
            or snapshot["upstream_bytes"] != source["upstream_bytes"]
        ):
            raise ValueError("small_body_source_claim_or_provenance_changed")
    if data["profiles"] != _profiles(data["sources"]):
        raise ValueError("small_body_appearance_claim_changed")
    if set(data["dependencies"]) != {"extended_solar.json", "appearance.json"}:
        raise ValueError("small_body_appearance_dependencies_changed")
    for name, dependency in data["dependencies"].items():
        if dependency["path"] != "data/manifests/" + name:
            raise ValueError("small_body_appearance_dependency_path_changed")
        content = (root / dependency["path"]).read_bytes()
        if len(content) != dependency["bytes"] or _hash(content) != dependency["sha256"]:
            raise ValueError("small_body_appearance_dependency_changed")
    return data | {"source_manifest_sha256": _hash(raw)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    result = acquire(parser.parse_args().root)
    print(
        json.dumps(
            {
                "profiles": len(result["profiles"]),
                "sources": len(result["sources"]),
                "rings": sum(len(profile["rings"]) for profile in result["profiles"].values()),
                "source_manifest_sha256": result["source_manifest_sha256"],
            }
        )
    )
