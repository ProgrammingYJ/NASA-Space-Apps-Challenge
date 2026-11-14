import hashlib
import json
import struct
import zlib
from pathlib import Path

import pytest

from science.opal_conversion import convert_published_rgb_tiff, decode_published_rgb_tiff

ROOT = Path(__file__).resolve().parents[1]
PIXELS = bytes([255, 0, 0, 0, 255, 0, 0, 0, 0, 32, 64, 128])


def fixture(planar=2, *, compression=1, orientation=1):
    """Two rows with asymmetric channels and a retained black sample."""
    tags = {
        256: (4, [2]),
        257: (4, [2]),
        258: (3, [8, 8, 8]),
        259: (3, [compression]),
        262: (3, [2]),
        273: (4, [0] * (3 if planar == 2 else 1)),
        274: (3, [orientation]),
        277: (3, [3]),
        278: (4, [2]),
        279: (4, [4, 4, 4] if planar == 2 else [12]),
        284: (3, [planar]),
    }
    start = 8 + 2 + 12 * len(tags) + 4
    extra_size = sum(
        len(values) * (2 if kind == 3 else 4)
        for kind, values in tags.values()
        if len(values) * (2 if kind == 3 else 4) > 4
    )
    pixel_start = start + extra_size
    tags[273] = (4, [pixel_start + i * 4 for i in range(3)] if planar == 2 else [pixel_start])
    entries, extra = bytearray(), bytearray()
    for tag, (kind, values) in sorted(tags.items()):
        packed = struct.pack("<" + ("H" if kind == 3 else "I") * len(values), *values)
        value = (
            packed.ljust(4, b"\x00") if len(packed) <= 4 else struct.pack("<I", start + len(extra))
        )
        entries += struct.pack("<HHI", tag, kind, len(values)) + value
        if len(packed) > 4:
            extra += packed
    data = b"".join(PIXELS[channel::3] for channel in range(3)) if planar == 2 else PIXELS
    return (
        b"II"
        + struct.pack("<HIH", 42, 8, len(tags))
        + entries
        + struct.pack("<I", 0)
        + extra
        + data
    )


def decoded_zero_filter_png(raw):
    """Independently read the standard RGB8/zero-filter PNG encoding."""
    assert raw[:8] == b"\x89PNG\r\n\x1a\n"
    at, compressed, dimensions = 8, bytearray(), None
    while at < len(raw):
        size = struct.unpack_from(">I", raw, at)[0]
        kind, data = raw[at + 4 : at + 8], raw[at + 8 : at + 8 + size]
        assert (
            struct.unpack_from(">I", raw, at + 8 + size)[0] == zlib.crc32(kind + data) & 0xFFFFFFFF
        )
        if kind == b"IHDR":
            width, height, depth, color, compression, filtering, interlace = struct.unpack(
                ">IIBBBBB", data
            )
            assert (depth, color, compression, filtering, interlace) == (8, 2, 0, 0, 0)
            dimensions = (width, height)
        elif kind == b"IDAT":
            compressed += data
        at += 12 + size
    width, height = dimensions
    rows = zlib.decompress(compressed)
    stride = width * 3 + 1
    assert len(rows) == stride * height
    assert all(rows[i * stride] == 0 for i in range(height))
    return dimensions, b"".join(rows[i * stride + 1 : (i + 1) * stride] for i in range(height))


@pytest.mark.parametrize("planar", [1, 2])
def test_rgb_order_rows_and_original_black_pixels_survive_lossless_conversion(planar):
    raw = fixture(planar)
    width, height, decoded, _ = decode_published_rgb_tiff(raw)
    assert (width, height, decoded) == (2, 2, PIXELS)
    png, record = convert_published_rgb_tiff(raw)
    assert decoded_zero_filter_png(png) == ((2, 2), PIXELS)
    assert record["decoded_pixel_sha256"] == hashlib.sha256(PIXELS).hexdigest()


@pytest.mark.parametrize("options", [{"compression": 5}, {"orientation": 6}])
def test_unsupported_data_do_not_get_reinterpreted(options):
    with pytest.raises(ValueError, match="unsupported_opal_tiff_pixel_format"):
        decode_published_rgb_tiff(fixture(**options))
    with pytest.raises(ValueError):
        decode_published_rgb_tiff(fixture()[:-1])


@pytest.mark.parametrize("name", ["neptune", "uranus"])
def test_real_published_source_and_web_png_match_independent_pillow_pixel_validation(name):
    directory = ROOT / "data/reference/appearance/dev020"
    record = json.loads((directory / f"{name}-rgb-conversion.json").read_text(encoding="utf-8"))
    raw = (directory / f"{name}-rgb.tif").read_bytes()
    assert hashlib.sha256(raw).hexdigest() == record["source_sha256"]
    assert record["independent_pixel_validation"]["all_pixels_and_dimensions_equal"] is True
    width, height, pixels, metadata = decode_published_rgb_tiff(raw)
    assert (
        metadata["decoded_pixel_sha256"] == record["independent_pixel_validation"]["decoded_sha256"]
    )
    png = (ROOT / record["local_path"]).read_bytes()
    assert hashlib.sha256(png).hexdigest() == record["derived_sha256"]
    assert decoded_zero_filter_png(png) == ((width, height), pixels)
