"""Actual CDS snapshot and unit/null/cluster/integrity contracts for the atlas."""

import csv
import hashlib
import json
import shutil
from pathlib import Path

import pytest

from science import galaxy_atlas as atlas

ROOT = Path(__file__).resolve().parents[1]
STAGED = atlas.MANIFEST if (ROOT / atlas.MANIFEST).is_file() else "tmp/dev016-galaxy_atlas.json"


def _fixture(*, ra_unit="deg", ra="10.6846", morphology="3.0", distance="0.79", cluster=False):
    units = [
        "",
        "",
        ra_unit,
        "deg",
        "",
        "mag",
        "mag",
        "arcmin",
        "arcmin",
        "arcmin",
        "arcmin",
        "",
        "",
        "deg",
        "mag",
        "mag",
        "Mpc",
        "Mpc",
    ]
    row = [
        "2557",
        "NGC0224",
        ra,
        "41.2687",
        morphology,
        "3.56",
        "0.30",
        "189.000",
        "60.852",
        "62.370",
        "21.391",
        "0.330",
        "0.039",
        "35.0",
        "-20.92",
        "0.30",
        distance,
        "0.08",
    ]
    lines = [
        "#Coosys\tJ2000:\teq_FK5 J2000",
        "#Name: VII/267/gwgc",
        "\t".join(atlas.NATIVE_COLUMNS),
        "\t".join(units),
        "\t".join("--------" for _ in units),
        "\t".join(row),
    ]
    if cluster:
        # The source paper notes that some MW globular clusters have PGC IDs.
        # Their ID alone must never promote them into the galaxy population.
        copy = [*row]
        copy[0:2] = ["6205", "MW cluster fixture"]
        copy[4] = "-9.0"
        lines.append("\t".join(copy))
    return ("\n".join(lines) + "\n").encode()


def test_export_degrees_are_not_mistaken_for_native_hours_and_hours_convert_once():
    degree = atlas.parse_vizier_tsv(_fixture())["rows"][0]
    hour = atlas.parse_vizier_tsv(_fixture(ra_unit="h", ra=str(10.6846 / 15)))["rows"][0]
    assert degree[2] == 10.6846
    assert hour[2] == pytest.approx(10.6846)
    assert degree[2] != pytest.approx(10.6846 * 15)
    assert degree[3] == 41.2687


def test_clusters_with_or_without_pgc_are_not_counted_as_galaxies_and_nulls_stay_null():
    parsed = atlas.parse_vizier_tsv(_fixture(cluster=True, morphology="", distance=""))
    assert parsed["source_record_count"] == 2
    assert len(parsed["rows"]) == 1
    assert parsed["excluded"][0]["pgc_string"] == "6205"
    assert parsed["excluded"][0]["reason"] == "TT_minus9_Milky_Way_globular_cluster"
    row = parsed["rows"][0]
    assert row[4] is None and row[16] is None
    record = atlas._object(row)
    assert record["morphology"] is None
    assert record["distance_mpc"] is None
    assert record["distance_status"] == "unavailable_direction_only"
    zero = atlas._object(atlas.parse_vizier_tsv(_fixture(distance="0"))["rows"][0])
    assert zero["distance_mpc"] is None and zero["distance_native_mpc"] == 0
    assert zero["surface_resolved"] is False
    assert zero["individual_stars_or_planets_inferred"] is False


@pytest.mark.parametrize(
    "before,after",
    [
        ("\tdeg\tdeg\t", "\trad\tdeg\t"),
        ("\tMpc\tMpc\n", "\tpc\tMpc\n"),
        ("10.6846", "NaN"),
        ("10.6846", "360.1"),
        ("eq_FK5 J2000", "unknown_frame"),
    ],
)
def test_changed_units_invalid_coordinates_and_unknown_frame_are_rejected(before, after):
    with pytest.raises(ValueError):
        atlas.parse_vizier_tsv(_fixture().decode().replace(before, after).encode())


def test_duplicate_source_identifier_is_rejected():
    raw = _fixture()
    duplicate = raw + raw.splitlines()[-1] + b"\n"
    with pytest.raises(ValueError, match="duplicate_pgc"):
        atlas.parse_vizier_tsv(duplicate)


def test_actual_source_snapshot_excludes_150_clusters_and_keeps_53162_real_identifiers():
    parsed = atlas.parse_vizier_tsv((ROOT / atlas.RAW).read_bytes())
    assert parsed["source_record_count"] == 53312
    assert len(parsed["rows"]) == len({row[0] for row in parsed["rows"]}) == 53162
    assert len(parsed["excluded"]) == 150
    assert all(row[4] != -9 for row in parsed["rows"])
    assert parsed["source_units"]["RAJ2000"] == "deg"
    assert parsed["source_units"]["Dist"] == "Mpc"
    # Independent direct TSV lookup against the service's printed values.
    lines = [
        line
        for line in (ROOT / atlas.RAW).read_text().splitlines()
        if line.strip() and not line.startswith("#")
    ]
    raw_rows = csv.DictReader(lines[3:], fieldnames=lines[0].split("\t"), delimiter="\t")
    source_m31 = next(row for row in raw_rows if row["PGC"].strip() == "2557")
    m31 = next(row for row in parsed["rows"] if row[0] == "2557")
    assert m31[1] == source_m31["Name"].strip() == "NGC0224"
    assert m31[2] == float(source_m31["RAJ2000"]) == 10.6846
    assert m31[16] == float(source_m31["Dist"]) == 0.79
    assert m31[17] == float(source_m31["e_Dist"]) == 0.08


def test_actual_pagination_aliases_marker_columns_and_curated_links_preserve_source_semantics():
    page = atlas.get_galaxy_atlas(ROOT, limit=2, manifest_path=STAGED)
    assert page["record_count"] == page["spatial_count"] == 53162
    assert page["direction_only_count"] == 0
    assert page["next_cursor"] == "2" and len(page["objects"]) == 2
    assert [row["pgc_string"] for row in page["objects"]] == ["2", "4"]
    next_page = atlas.get_galaxy_atlas(
        ROOT, cursor=page["next_cursor"], limit=2, manifest_path=STAGED
    )
    assert not {row["object_id"] for row in page["objects"]} & {
        row["object_id"] for row in next_page["objects"]
    }
    m31 = atlas.get_galaxy_atlas(ROOT, query="Andromeda", manifest_path=STAGED)["objects"]
    assert len(m31) == 1 and m31[0]["existing_object_id"] == "galaxy-m31"
    assert (
        atlas.get_galaxy_atlas(ROOT, query="NGC224", manifest_path=STAGED)["objects"][0][
            "object_id"
        ]
        == "gwgc-pgc-2557"
    )
    record = atlas.get_galaxy_atlas_object(ROOT, "gwgc-pgc-2557", manifest_path=STAGED)
    assert record["ra_deg"] == 10.6846 and record["distance_mpc"] == 0.79
    assert record["distance_error_mpc"] == 0.08 and record["b_mag"] == 3.56
    assert record["major_arcmin"] == 189 and record["position_angle_deg"] == 35
    assert record["coordinate_reference"] == "FK5 J2000 catalogue reference"
    markers = atlas.get_galaxy_atlas_markers(ROOT, manifest_path=STAGED)
    assert markers["marker_count"] == 53162 and len(markers["curated_matches"]) == 9
    assert all(len(values) == 53162 for values in markers["columns"].values())
    assert all(value > 0 for value in markers["columns"]["distance_mpc"])
    assert sum(value is None for value in markers["columns"]["morphology_code"]) == 27547
    assert min(markers["columns"]["distance_mpc"]) == 0.01
    assert max(markers["columns"]["distance_mpc"]) == 124.07
    assert markers["coverage"]["records_above_nominal_100_mpc"] == 9
    assert markers["coverage"]["selected_date_propagation"] is False
    assert markers["rights"]["spdx"] is None
    json.dumps(markers, allow_nan=False)


@pytest.mark.parametrize(
    "arguments",
    [
        {"limit": 0},
        {"limit": True},
        {"limit": 201},
        {"cursor": "-1"},
        {"cursor": "1.5"},
        {"query": "x" * 201},
    ],
)
def test_pagination_does_not_accept_unbounded_or_invalid_input(arguments):
    with pytest.raises(ValueError):
        atlas.get_galaxy_atlas(ROOT, manifest_path=STAGED, **arguments)


@pytest.mark.parametrize("which", ["source", "data"])
def test_immutable_input_and_compact_bytes_are_verified_before_serving(tmp_path, which):
    manifest = json.loads((ROOT / STAGED).read_bytes())
    target = tmp_path / "data/manifests/galaxy_atlas.json"
    target.parent.mkdir(parents=True)
    for key in ("source", "data"):
        record = manifest[key]
        path = tmp_path / record["local_relative_path"]
        path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / record["local_relative_path"], path)
    changed = tmp_path / manifest[which]["local_relative_path"]
    with changed.open("ab") as stream:
        stream.write(b" ")
    target.write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match="integrity_mismatch"):
        atlas.get_galaxy_atlas(tmp_path)
    assert hashlib.sha256(changed.read_bytes()).hexdigest() != manifest[which]["sha256"]
