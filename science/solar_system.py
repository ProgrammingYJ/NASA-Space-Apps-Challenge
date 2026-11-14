"""Bounded, offline solar-system scene from original JPL Horizons snapshots.

Only four actually queried UTC epochs are selectable. Camera/display scaling is
the renderer's responsibility; these positions remain geometric heliocentric AU.
"""

from __future__ import annotations

import csv
import hashlib
import html
import io
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import urlopen

import numpy as np
from astropy.time import Time

from science.spherex import TARGET_SOURCE, predict_coordinate

HORIZONS_API = "https://ssd.jpl.nasa.gov/api/horizons.api"
PHYSICAL_PARAMETERS = "https://ssd.jpl.nasa.gov/planets/phys_par.html"
EPHEMERIS_MANIFEST = "data/manifests/solar_system_ephemeris.json"
BODY_IDS = {
    "mercury": "199",
    "venus": "299",
    "earth": "399",
    "mars": "499",
    "jupiter": "599",
    "saturn": "699",
    "uranus": "799",
    "neptune": "899",
    "pluto": "999",
}
EPOCHS = [f"2026-11-{day}T00:00:00Z" for day in (13, 14, 15, 16)]
DEFAULT_EPOCH = "2026-11-14T00:00:00Z"
FRAME = "Ecliptic of J2000.0"
JPL_OBLIQUITY_ARCSEC = 84381.448
JPL_FRAME_SOURCE = (
    "https://ssd.jpl.nasa.gov/horizons/manual.html#ecliptic-of-standard-epoch-j2000-or-b1950"
)


def _sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _parse_samples(result: str) -> list[dict[str, Any]]:
    if "Reference frame : Ecliptic of J2000.0" not in result:
        raise ValueError("unexpected_ephemeris_frame")
    if not re.search(r"Center body name:\s+Sun \(10\)", result):
        raise ValueError("unexpected_ephemeris_center")
    if (
        "Output type     : GEOMETRIC cartesian states" not in result
        or "Output units    : AU-D" not in result
    ):
        raise ValueError("unexpected_ephemeris_units_or_corrections")
    block = result.split("$$SOE", 1)[1].split("$$EOE", 1)[0].strip()
    samples = []
    for row in csv.reader(io.StringIO(block)):
        if not row:
            continue
        epoch = datetime.strptime(row[1].strip(), "A.D. %Y-%b-%d %H:%M:%S.%f").replace(tzinfo=UTC)
        epoch_utc = epoch.isoformat().replace("+00:00", "Z")
        values = [float(value) for value in row[2:8]]
        if len(values) != 6 or not np.all(np.isfinite(values)):
            raise ValueError("invalid_ephemeris_vector")
        if abs(float(row[0]) - float(Time(epoch, scale="utc").jd)) > 1e-8:
            raise ValueError("ephemeris_time_mismatch")
        samples.append(
            {
                "epoch_utc": epoch_utc,
                "jd_utc": float(row[0]),
                "position_au": values[:3],
                "velocity_au_day": values[3:],
            }
        )
    if [sample["epoch_utc"] for sample in samples] != EPOCHS:
        raise ValueError("unexpected_ephemeris_epochs")
    return samples


def _physical_radii(document: str) -> dict[str, dict[str, Any]]:
    radii = {}
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", document, re.DOTALL | re.IGNORECASE):
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.DOTALL | re.IGNORECASE)
        if len(cells) < 3:
            continue
        plain = [
            " ".join(html.unescape(re.sub(r"<[^>]+>", " ", cell)).split()) for cell in cells[:3]
        ]
        object_id = plain[0].lower()
        if object_id not in BODY_IDS:
            continue
        match = re.fullmatch(r"([\d.]+)\s*\[([^\]]+)\]\s*±\s*([\d.]+)", plain[2])
        if not match:
            raise ValueError("unsupported_physical_radius_row")
        radii[object_id] = {
            "value_km": float(match.group(1)),
            "uncertainty_km": float(match.group(3)),
            "reference_key": match.group(2),
            "definition": "Mean Radius (volume-equivalent), km",
            "source_url": PHYSICAL_PARAMETERS,
        }
    if set(radii) != set(BODY_IDS):
        raise ValueError("physical_radii_incomplete")
    return radii


def _fetch(url: str, maximum: int = 200_000) -> tuple[bytes, str]:
    """Acquisition only; fixed official origins, bounded size/time, normal TLS."""
    if not (url.startswith(HORIZONS_API + "?") or url == PHYSICAL_PARAMETERS):
        raise ValueError("unsupported_source_url")
    with urlopen(url, timeout=30) as response:
        raw = response.read(maximum + 1)
    if len(raw) > maximum:
        raise ValueError("source_response_too_large")
    return raw, datetime.now(UTC).isoformat()


def acquire_manifest(root: Path) -> dict[str, Any]:
    """Explicit developer acquisition; never called by the website request path.

    Requests are sequential to respect JPL SSD's API fair-use guidance. Original
    bounded responses are preserved in this small, separate source manifest.
    """
    target = Path(root) / EPHEMERIS_MANIFEST
    if target.exists():
        raise FileExistsError("ephemeris_manifest_already_exists")
    raw_physical, physical_retrieved = _fetch(PHYSICAL_PARAMETERS)
    physical_document = raw_physical.decode("utf-8")
    radii = _physical_radii(physical_document)
    bodies = []
    for object_id, command in BODY_IDS.items():
        parameters = {
            "format": "json",
            "COMMAND": f"'{command}'",
            "OBJ_DATA": "'YES'",
            "MAKE_EPHEM": "'YES'",
            "EPHEM_TYPE": "'VECTORS'",
            "CENTER": "'500@10'",
            "START_TIME": "'2026-11-13 00:00:00'",
            "STOP_TIME": "'2026-11-16 00:00:00'",
            "STEP_SIZE": "'1 d'",
            "REF_PLANE": "'ECLIPTIC'",
            "REF_SYSTEM": "'ICRF'",
            "OUT_UNITS": "'AU-D'",
            "VEC_TABLE": "'2'",
            "VEC_CORR": "'NONE'",
            "CSV_FORMAT": "'YES'",
            "VEC_LABELS": "'YES'",
            "TIME_TYPE": "'UT'",
            "TIME_DIGITS": "'FRACSEC'",
        }
        url = HORIZONS_API + "?" + urlencode(parameters)
        raw, retrieved = _fetch(url)
        response = json.loads(raw)
        if "error" in response:
            raise ValueError("horizons_returned_error")
        result = response["result"]
        if not re.search(rf"Target body name:\s+{object_id.title()} \({command}\)", result):
            raise ValueError("horizons_target_mismatch")
        target_source = re.search(r"Target body name:.*?\{source:\s*([^}]+)\}", result)
        center_source = re.search(r"Center body name:.*?\{source:\s*([^}]+)\}", result)
        bodies.append(
            {
                "object_id": object_id,
                "horizons_id": command,
                "name": object_id.title(),
                "body_class": "dwarf_planet" if object_id == "pluto" else "planet",
                "radius": radii[object_id],
                "samples": _parse_samples(result),
                "ephemeris_source": {
                    "url": url,
                    "parameters": parameters,
                    "retrieved_utc": retrieved,
                    "response_sha256": _sha256(raw),
                    "response_bytes": len(raw),
                    "raw_response_json": raw.decode("utf-8"),
                    "signature": response["signature"],
                    "target_source": target_source.group(1) if target_source else None,
                    "center_source": center_source.group(1) if center_source else None,
                },
            }
        )
    manifest = {
        "schema_version": "1.0",
        "dataset_id": "jpl-horizons-solar-system-20261113-16",
        "created_utc": datetime.now(UTC).isoformat(),
        "coordinate_frame": FRAME,
        "center": {"horizons_id": "10", "name": "Sun", "site": "BODY CENTER", "command": "500@10"},
        "time_scale": "UTC",
        "horizons_time_type": "UT (UTC after 1962)",
        "vector_corrections": "NONE (geometric)",
        "position_unit": "au",
        "velocity_unit": "au/day",
        "sample_epochs_utc": EPOCHS,
        "default_epoch_utc": DEFAULT_EPOCH,
        "interpolation": "none; exact queried samples only",
        "physical_parameters_source": {
            "url": PHYSICAL_PARAMETERS,
            "retrieved_utc": physical_retrieved,
            "response_sha256": _sha256(raw_physical),
            "response_bytes": len(raw_physical),
            "raw_response_html": physical_document,
        },
        "bodies": bodies,
        "scope": "Scene ephemeris snapshots; separate from 102 SPHEREx/input inventory files and observer-specific exposure predictions.",
        "license_note": "JPL SSD public numerical output with source attribution; no NASA/JPL logo or endorsement implied.",
        "sources": {
            "api_documentation": "https://ssd-api.jpl.nasa.gov/doc/horizons.html",
            "manual": "https://ssd.jpl.nasa.gov/horizons/manual.html",
        },
    }
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(manifest, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
    return manifest


def get_universe(root: Path, epoch: str | None = None) -> dict[str, Any]:
    """Return exact source states and one separate distance-free catalog marker."""
    manifest = json.loads((Path(root) / EPHEMERIS_MANIFEST).read_text(encoding="utf-8"))
    if manifest["schema_version"] != "1.0" or manifest["coordinate_frame"] != FRAME:
        raise ValueError("unsupported_scene_schema")
    if (
        manifest["center"]
        != {"horizons_id": "10", "name": "Sun", "site": "BODY CENTER", "command": "500@10"}
        or manifest["time_scale"] != "UTC"
        or manifest["vector_corrections"] != "NONE (geometric)"
        or manifest["position_unit"] != "au"
        or manifest["velocity_unit"] != "au/day"
        or manifest["sample_epochs_utc"] != EPOCHS
    ):
        raise ValueError("unsupported_scene_conventions")
    if {body["object_id"] for body in manifest["bodies"]} != set(BODY_IDS) or len(
        manifest["bodies"]
    ) != len(BODY_IDS):
        raise ValueError("incomplete_scene_bodies")
    epoch = epoch or manifest["default_epoch_utc"]
    if epoch not in manifest["sample_epochs_utc"]:
        raise ValueError("unsupported_scene_epoch")
    physical_source = manifest["physical_parameters_source"]
    physical_raw = physical_source["raw_response_html"].encode("utf-8")
    if _sha256(physical_raw) != physical_source["response_sha256"]:
        raise ValueError("physical_source_integrity")
    radii = _physical_radii(physical_source["raw_response_html"])
    objects = []
    for body in manifest["bodies"]:
        source = body["ephemeris_source"]
        raw = source["raw_response_json"].encode("utf-8")
        if _sha256(raw) != source["response_sha256"]:
            raise ValueError("ephemeris_source_integrity")
        response = json.loads(raw)
        command = BODY_IDS[body["object_id"]]
        if (
            body["horizons_id"] != command
            or body["name"] != body["object_id"].title()
            or not re.search(
                rf"Target body name:\s+{body['name']} \({command}\)", response["result"]
            )
        ):
            raise ValueError("ephemeris_target_mismatch")
        samples = _parse_samples(response["result"])
        if samples != body["samples"] or radii[body["object_id"]] != body["radius"]:
            raise ValueError("ephemeris_derived_values_mismatch")
        sample = next(sample for sample in samples if sample["epoch_utc"] == epoch)
        objects.append(
            {
                "object_id": body["object_id"],
                "name": body["name"],
                "kind": "solar_system",
                "body_class": body["body_class"],
                "horizons_id": body["horizons_id"],
                "position_au": sample["position_au"],
                "velocity_au_day": sample["velocity_au_day"],
                "position_kind": "geometric_ephemeris_sample",
                "radius_km": body["radius"]["value_km"],
                "radius_source": body["radius"],
                "source": {
                    "url": source["url"],
                    "label": f"JPL Horizons / {source['target_source']}",
                    "response_sha256": source["response_sha256"],
                    "retrieved_utc": source["retrieved_utc"],
                    "api_signature": source["signature"],
                },
            }
        )
    earth_source = next(
        body["ephemeris_source"] for body in manifest["bodies"] if body["object_id"] == "earth"
    )
    center_radii = re.search(
        r"Center radii\s*:\s*([\d.]+),\s*([\d.]+),\s*([\d.]+) km",
        json.loads(earth_source["raw_response_json"])["result"],
    )
    if not center_radii or len(set(center_radii.groups())) != 1:
        raise ValueError("unsupported_sun_radius")
    objects.insert(
        0,
        {
            "object_id": "sun",
            "name": "Sun",
            "kind": "solar_system",
            "body_class": "star",
            "horizons_id": "10",
            "position_au": [0.0, 0.0, 0.0],
            "velocity_au_day": [0.0, 0.0, 0.0],
            "position_kind": "defined_coordinate_origin",
            "radius_km": float(center_radii.group(1)),
            "radius_source": {
                "source_url": earth_source["url"],
                "definition": "Horizons Sun center radii; spherical reference",
                "uncertainty_km": None,
            },
            "source": {"url": earth_source["url"], "label": "JPL Horizons Sun body-center origin"},
        },
    )
    coordinate = predict_coordinate(epoch.removesuffix("Z"), "UTC")
    # Match Horizons' exact IAU76/80 J2000 ecliptic definition, rather than mixing
    # its fixed obliquity with another convention's mean ecliptic/frame bias.
    # Rotate the unit angular direction without inventing a physical distance.
    ra, dec = coordinate.ra.rad, coordinate.dec.rad
    icrs_direction = np.array([np.cos(dec) * np.cos(ra), np.cos(dec) * np.sin(ra), np.sin(dec)])
    epsilon = np.deg2rad(JPL_OBLIQUITY_ARCSEC / 3600)
    rotation = np.array(
        [[1, 0, 0], [0, np.cos(epsilon), np.sin(epsilon)], [0, -np.sin(epsilon), np.cos(epsilon)]]
    )
    direction = rotation @ icrs_direction
    direction = direction / np.linalg.norm(direction)
    objects.append(
        {
            "object_id": "epsilon-indi-b",
            "name": "ε Indi B",
            "kind": "direction",
            "body_class": "unresolved_brown_dwarf_binary",
            "direction_icrs_deg": {
                "ra": float(coordinate.ra.deg),
                "dec": float(coordinate.dec.deg),
            },
            "direction_ecliptic": direction.tolist(),
            "direction_epoch_utc": epoch,
            "distance_au": None,
            "radius_km": None,
            "position_kind": "catalog_proper_motion_direction",
            "coordinate_frame": "ICRS catalog propagated to epoch, rotated to Horizons IAU76/80 J2000 ecliptic",
            "frame_rotation": {
                "obliquity_arcsec": JPL_OBLIQUITY_ARCSEC,
                "source_url": JPL_FRAME_SOURCE,
            },
            "source": {
                "url": TARGET_SOURCE["url"],
                "label": f"SIMBAD / {TARGET_SOURCE['bibcode']}",
            },
            "omitted": ["observer_parallax", "radial_velocity", "full_covariance"],
            "distance_status": "not_used; direction layer has no physical scene distance",
        }
    )
    return {
        "schema_version": "1.0",
        "dataset_id": manifest["dataset_id"],
        "epoch": epoch,
        "coordinate_frame": FRAME,
        "center": manifest["center"],
        "time_scale": "UTC",
        "units": {"position": "au", "velocity": "au/day", "radius": "km"},
        "available_epochs": manifest["sample_epochs_utc"],
        "objects": objects,
        "source": {
            "url": "https://ssd.jpl.nasa.gov/horizons/",
            "label": "NASA/JPL Horizons geometric ephemerides",
        },
        "limitations": [
            "Only the four queried UTC epochs are supported; no interpolation or extrapolation.",
            "Heliocentric geometric states use J2000 ecliptic axes; no light-time or aberration correction.",
            "The free camera is not the SPHEREx observer; model epoch does not change an exposure's DATE-AVG.",
            "Planet appearances, displayed sizes and any distance compression are visual representations, not measured images.",
            "The Epsilon Indi B marker is a direction layer; its rendering radius is not a physical distance.",
            "These scene states are separate from observer-specific predictions used on SPHEREx exposures.",
        ],
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--acquire",
        action="store_true",
        help="Acquire a new bounded official source manifest; refuses overwrite",
    )
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    if args.acquire:
        acquired = acquire_manifest(args.root)
        print(
            json.dumps(
                {
                    "dataset_id": acquired["dataset_id"],
                    "body_count": len(acquired["bodies"]),
                    "epochs": EPOCHS,
                }
            )
        )
    else:
        print(json.dumps(get_universe(args.root), ensure_ascii=False, indent=2, allow_nan=False))
