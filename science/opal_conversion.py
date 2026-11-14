"""Losslessly re-encode the two published OPAL RGB preview rasters as PNG.

This deliberately narrow reader accepts only classic, uncompressed, top-left
8-bit RGB TIFFs. It does not stretch, recolor, resize, rotate, interpolate, or
fill missing areas. Unsupported TIFF encodings fail instead of being guessed.
Python's standard library is sufficient; Pillow is an independent optional
validation tool, not an application or conversion runtime dependency.
"""

from __future__ import annotations

import hashlib
import math
import struct
import zlib

MAX_BYTES = 32_000_000
ALGORITHM_VERSION = "opal-rgb-tiff-png-lossless-v1"


def decode_published_rgb_tiff(raw: bytes) -> tuple[int, int, bytes, dict]:
    """Decode the verified published RGB8 strip layout without color transforms."""
    if not 8 <= len(raw) <= MAX_BYTES or raw[:2] not in (b"II", b"MM"):
        raise ValueError("unsupported_opal_tiff_header")
    order = "<" if raw[:2] == b"II" else ">"

    def unpack(fmt: str, offset: int):
        size = struct.calcsize(order + fmt)
        if offset < 0 or offset + size > len(raw):
            raise ValueError("opal_tiff_out_of_bounds")
        return struct.unpack_from(order + fmt, raw, offset)

    if unpack("H", 2)[0] != 42:
        raise ValueError("unsupported_opal_tiff_version")
    directory = unpack("I", 4)[0]
    count = unpack("H", directory)[0]
    if not 1 <= count <= 256:
        raise ValueError("unsupported_opal_tiff_directory")
    tags: dict[int, tuple[int, ...]] = {}
    selected = {256, 257, 258, 259, 262, 273, 274, 277, 278, 279, 284, 34675}
    for index in range(count):
        entry = directory + 2 + index * 12
        tag, kind, length, pointer = unpack("HHII", entry)
        if tag not in selected:
            continue
        if tag in tags or kind not in (3, 4) or not 1 <= length <= 100_000:
            raise ValueError("unsupported_opal_tiff_tag")
        size = (2 if kind == 3 else 4) * length
        values = unpack(("H" if kind == 3 else "I") * length, entry + 8 if size <= 4 else pointer)
        tags[tag] = values
    if unpack("I", directory + 2 + count * 12)[0] != 0:
        raise ValueError("unsupported_opal_tiff_multiple_images")

    def scalar(tag: int, default=None):
        values = tags.get(tag, (default,))
        if len(values) != 1:
            raise ValueError("invalid_opal_tiff_scalar")
        return values[0]

    width, height = scalar(256), scalar(257)
    if not isinstance(width, int) or not isinstance(height, int) or min(width, height) <= 0:
        raise ValueError("invalid_opal_tiff_dimensions")
    if width * height * 3 > MAX_BYTES:
        raise ValueError("opal_decoded_raster_exceeds_limit")
    compression, photometric = scalar(259, 1), scalar(262)
    orientation, samples, planar = scalar(274, 1), scalar(277), scalar(284, 1)
    if (
        tags.get(258) != (8, 8, 8)
        or compression != 1
        or photometric != 2
        or orientation != 1
        or samples != 3
        or planar not in (1, 2)
        or 34675 in tags
    ):
        raise ValueError("unsupported_opal_tiff_pixel_format")
    rows = scalar(278, height)
    if not isinstance(rows, int) or rows < 1:
        raise ValueError("invalid_opal_tiff_rows_per_strip")
    per_plane = math.ceil(height / rows)
    offsets, lengths = tags.get(273, ()), tags.get(279, ())
    if len(offsets) != len(lengths) or len(offsets) != per_plane * (3 if planar == 2 else 1):
        raise ValueError("invalid_opal_tiff_strip_count")
    strips = []
    for index, (offset, length) in enumerate(zip(offsets, lengths, strict=True)):
        expected = (
            width * min(rows, height - (index % per_plane) * rows) * (3 if planar == 1 else 1)
        )
        if length != expected or offset < 0 or offset + length > len(raw):
            raise ValueError("invalid_opal_tiff_strip_extent")
        strips.append(raw[offset : offset + length])
    if planar == 1:
        pixels = b"".join(strips)
    else:
        raster = bytearray(width * height * 3)
        for channel in range(3):
            raster[channel::3] = b"".join(strips[channel * per_plane : (channel + 1) * per_plane])
        pixels = bytes(raster)
    return (
        width,
        height,
        pixels,
        {
            "bits_per_sample": [8, 8, 8],
            "photometric_interpretation": "RGB",
            "compression": "none",
            "planar_configuration": planar,
            "orientation": "top_left",
            "image_count": 1,
            "decoded_pixel_sha256": hashlib.sha256(pixels).hexdigest(),
        },
    )


def encode_rgb_png(width: int, height: int, pixels: bytes) -> bytes:
    """Encode exact top-left RGB8 rows; a zero filter changes no sample values."""
    if not isinstance(width, int) or not isinstance(height, int) or min(width, height) <= 0:
        raise ValueError("invalid_opal_png_dimensions")
    if width * height * 3 > MAX_BYTES or len(pixels) != width * height * 3:
        raise ValueError("invalid_opal_png_raster")

    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    stride = width * 3
    rows = b"".join(
        b"\x00" + pixels[start : start + stride] for start in range(0, len(pixels), stride)
    )
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(rows, 6))
        + chunk(b"IEND", b"")
    )


def convert_published_rgb_tiff(raw: bytes) -> tuple[bytes, dict]:
    width, height, pixels, metadata = decode_published_rgb_tiff(raw)
    png = encode_rgb_png(width, height, pixels)
    return png, {
        "algorithm_version": ALGORITHM_VERSION,
        "source_sha256": hashlib.sha256(raw).hexdigest(),
        "source_bytes": len(raw),
        "pixel_dimensions": [width, height],
        **metadata,
        "derived_sha256": hashlib.sha256(png).hexdigest(),
        "derived_bytes": len(png),
        "processing": "Lossless format conversion only: exact RGB8 samples and dimensions preserved. No color transform, resizing, interpolation, geometry change, or filling of unobserved pixels.",
        "software": {"python": "standard_library", "zlib": zlib.ZLIB_RUNTIME_VERSION},
    }
