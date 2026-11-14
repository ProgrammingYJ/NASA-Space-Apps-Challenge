"""Verified published appearance maps and sourced ring geometry for display only.

No image is synthesized, resampled, recolored or fetched by a website request.
The acquisition helper preserves the exact JPEG/PNG bytes returned by a fixed
official source URL. Texture longitude and spin are not a measured attitude.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import struct
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from astropy.time import Time

MANIFEST_PATH = "data/manifests/appearance.json"
ALGORITHM_VERSION = "appearance-v1"
PCK_PATH = "data/reference/appearance/pck00011.tpc"
PCK_URL = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc"
RING_EPOCH = "2026-11-14T00:00:00Z"
MAX_TEXTURE_BYTES = 40_000_000
OFFICIAL_HOSTS = {
    "assets.science.nasa.gov",
    "science.nasa.gov",
    "svs.gsfc.nasa.gov",
    "maps.jpl.nasa.gov",
    "archive.stsci.edu",
    "atmos.nmsu.edu",
    "astrogeology.usgs.gov",
    "astropedia.astrogeology.usgs.gov",
    "planetarymaps.usgs.gov",
    "pds-rings.seti.org",
    "naif.jpl.nasa.gov",
    "d9-wret.s3.us-west-2.amazonaws.com",
    "dawngis.dlr.de",
}


def ring_poles(root: Path, epoch: str = RING_EPOCH) -> dict:
    """IAU north poles in ICRF from the unmodified NAIF PCK, not a camera axis."""
    raw = (Path(root) / PCK_PATH).read_bytes()
    text = raw.decode("ascii")
    active = "\n".join(part.split("\\begintext", 1)[0] for part in text.split("\\begindata")[1:])

    def numbers(key):
        found = re.search(r"\b" + re.escape(key) + r"\s*=\s*\((.*?)\)", active, re.DOTALL)
        return [float(value.replace("D", "E")) for value in found.group(1).split()] if found else []

    jd = float(Time(epoch, scale="utc").tdb.jd)
    centuries = (jd - 2451545.0) / 36525.0
    result = {}
    for name, ident in (("jupiter", 599), ("saturn", 699), ("uranus", 799), ("neptune", 899)):
        ra = numbers(f"BODY{ident}_POLE_RA")
        dec = numbers(f"BODY{ident}_POLE_DEC")
        angles = numbers(f"BODY{ident // 100}_NUT_PREC_ANGLES")
        if len(ra) != 3 or len(dec) != 3 or len(angles) % 2:
            raise ValueError("invalid_ring_pole_constants")
        angle_rad = [
            math.radians(a + b * centuries) for a, b in zip(angles[::2], angles[1::2], strict=True)
        ]
        sine = numbers(f"BODY{ident}_NUT_PREC_RA")
        cosine = numbers(f"BODY{ident}_NUT_PREC_DEC")
        if max(len(sine), len(cosine)) > len(angle_rad):
            raise ValueError("invalid_ring_pole_angles")
        right_ascension = sum(value * centuries**power for power, value in enumerate(ra))
        declination = sum(value * centuries**power for power, value in enumerate(dec))
        right_ascension += sum(value * math.sin(angle_rad[i]) for i, value in enumerate(sine))
        declination += sum(value * math.cos(angle_rad[i]) for i, value in enumerate(cosine))
        result[name] = {
            "pole_icrs_deg": {"ra": right_ascension % 360, "dec": declination},
            "epoch": epoch,
            "epoch_tdb_jd": jd,
            "frame": "ICRF/J2000",
            "model": "NAIF pck00011 IAU pole polynomial and periodic terms; rings assumed equatorial",
            "source": {
                "url": PCK_URL,
                "label": "NASA/JPL NAIF pck00011.tpc (2022-12-27)",
                "local_path": PCK_PATH,
                "sha256": hashlib.sha256(raw).hexdigest(),
                "bytes": len(raw),
            },
            "limitations": [
                "Planet pole from the published IAU orientation model at the declared reference event, not a measured camera attitude.",
                "Individual eccentric, warped or inclined ring structures and their precession are not modeled.",
                "Texture longitude and spin phase remain illustrative; no texture-attitude registration is claimed.",
            ],
        }
    return result


def image_dimensions(raw: bytes) -> tuple[int, int]:
    """Read native JPEG/PNG dimensions without decoding or changing pixels."""
    if raw.startswith(b"\x89PNG\r\n\x1a\n") and raw[12:16] == b"IHDR" and len(raw) >= 24:
        width, height = struct.unpack(">II", raw[16:24])
    elif raw.startswith(b"\xff\xd8"):
        position = 2
        width = height = 0
        while position < len(raw):
            if raw[position] != 0xFF:
                raise ValueError("invalid_jpeg_marker")
            while position < len(raw) and raw[position] == 0xFF:
                position += 1
            if position >= len(raw):
                break
            marker = raw[position]
            position += 1
            if marker in (0xD8, 0xD9, 0x01) or 0xD0 <= marker <= 0xD7:
                continue
            if position + 2 > len(raw):
                break
            size = int.from_bytes(raw[position : position + 2], "big")
            if size < 2 or position + size > len(raw):
                raise ValueError("truncated_jpeg_segment")
            if marker in (
                0xC0,
                0xC1,
                0xC2,
                0xC3,
                0xC5,
                0xC6,
                0xC7,
                0xC9,
                0xCA,
                0xCB,
                0xCD,
                0xCE,
                0xCF,
            ):
                if size < 8:
                    raise ValueError("invalid_jpeg_frame")
                height = int.from_bytes(raw[position + 3 : position + 5], "big")
                width = int.from_bytes(raw[position + 5 : position + 7], "big")
                break
            position += size
    else:
        raise ValueError("texture_requires_published_jpeg_or_png")
    if width <= 0 or height <= 0:
        raise ValueError("invalid_texture_dimensions")
    return width, height


def acquire_texture(root: Path, object_id: str, file_url: str, record: dict) -> dict:
    """Explicit offline preparation only; preserve originals and validate TLS."""
    parsed = urlparse(file_url)
    if parsed.scheme != "https" or parsed.hostname not in OFFICIAL_HOSTS:
        raise ValueError("unapproved_appearance_source")
    if not object_id.replace("-", "").isalnum():
        raise ValueError("invalid_appearance_id")
    suffix = Path(parsed.path).suffix.lower()
    if suffix not in (".jpg", ".jpeg", ".png"):
        raise ValueError("texture_requires_published_jpeg_or_png")
    request = Request(
        file_url, headers={"User-Agent": "PlanetX-SpaceApps-2026/appearance-source-verification"}
    )
    with urlopen(request, timeout=45) as response:
        if urlparse(response.url).hostname not in OFFICIAL_HOSTS:
            raise ValueError("unapproved_appearance_redirect")
        raw = response.read(MAX_TEXTURE_BYTES + 1)
    if len(raw) > MAX_TEXTURE_BYTES:
        raise ValueError("texture_download_exceeds_limit")
    dimensions = image_dimensions(raw)
    filename = f"{object_id}-{hashlib.sha256(raw).hexdigest()[:12]}{suffix}"
    path = Path(root) / "web/public/textures" / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != raw:
            raise ValueError("immutable_texture_collision")
    else:
        with path.open("xb") as stream:
            stream.write(raw)
    return {
        **record,
        "texture_url": f"/textures/{filename}",
        "local_path": path.relative_to(root).as_posix(),
        "source": {**record["source"], "file_url": file_url},
        "sha256": hashlib.sha256(raw).hexdigest(),
        "bytes": len(raw),
        "pixel_dimensions": list(dimensions),
        "retrieved_utc": datetime.now(UTC).isoformat(),
        "processing": "Exact published file bytes; no local image edits, resizing or color transformations.",
    }


def get_appearance(root: Path) -> dict:
    root = Path(root)
    raw = (root / MANIFEST_PATH).read_bytes()
    value = json.loads(raw)
    if value["schema_version"] != "1.0" or value["algorithm_version"] != ALGORITHM_VERSION:
        raise ValueError("unsupported_appearance_version")
    for reference in value.get("reference_sources", []):
        relative = PurePosixPath(reference["local_path"])
        if (
            relative.is_absolute()
            or ".." in relative.parts
            or relative.parts[:3] != ("data", "reference", "appearance")
        ):
            raise ValueError("invalid_appearance_reference_path")
        data = root.joinpath(*relative.parts).read_bytes()
        if (
            len(data) != reference["bytes"]
            or hashlib.sha256(data).hexdigest() != reference["sha256"]
        ):
            raise ValueError("appearance_reference_integrity")
    for item in value["objects"].values():
        relative = PurePosixPath(item["local_path"])
        if (
            relative.is_absolute()
            or ".." in relative.parts
            or relative.parts[:3] != ("web", "public", "textures")
        ):
            raise ValueError("invalid_appearance_path")
        path = root.joinpath(*relative.parts)
        data = path.read_bytes()
        if len(data) != item["bytes"] or hashlib.sha256(data).hexdigest() != item["sha256"]:
            raise ValueError("appearance_asset_integrity")
        if list(image_dimensions(data)) != item["pixel_dimensions"]:
            raise ValueError("appearance_image_dimensions")
        if item["texture_url"] != f"/textures/{relative.name}":
            raise ValueError("appearance_url_mismatch")
        region = item.get("texture_region_px")
        if region:
            width, height = item["pixel_dimensions"]
            if (
                set(region) != {"x", "y", "width", "height"}
                or not all(isinstance(value, int) and value >= 0 for value in region.values())
                or region["width"] == 0
                or region["height"] == 0
                or region["x"] + region["width"] > width
                or region["y"] + region["height"] > height
            ):
                raise ValueError("appearance_region_bounds")
    for ring in value["rings"].values():
        if ring["units"] != "km" or not all(
            math.isfinite(v) for v in ring["pole_icrs_deg"].values()
        ):
            raise ValueError("invalid_ring_units_or_pole")
        for band in ring["bands_km"] + ring["gaps_km"]:
            if not 0 < band["inner_km"] < band["outer_km"]:
                raise ValueError("invalid_ring_radial_interval")
    return {**value, "source_manifest_sha256": hashlib.sha256(raw).hexdigest()}
