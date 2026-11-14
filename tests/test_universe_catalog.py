"""Independent identity/coordinate and real-catalog hierarchy regressions."""

import json
import shutil
from pathlib import Path

import pytest

from science.universe_catalog import (
    EXTERNAL_GALAXIES,
    MANIFEST,
    MILKY_WAY,
    get_universe_catalog,
    host_id,
    parse_simbad,
)

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def copied_inputs(tmp_path):
    manifest = json.loads((ROOT / MANIFEST).read_bytes())
    paths = [MANIFEST]
    paths += [source["local_relative_path"] for source in manifest["sources"].values()]
    paths += [source["path"] for source in manifest["dependencies"].values()]
    for relative in paths:
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, target)
    return tmp_path, manifest


def rewrite(root, manifest):
    (root / MANIFEST).write_text(json.dumps(manifest), encoding="utf-8")


def test_curated_hierarchy_covers_actual_external_members_without_fabricated_planets():
    data = get_universe_catalog(ROOT)
    by_id = {item["object_id"]: item for item in data["objects"]}
    assert len(by_id) == len(data["objects"]) == 24
    assert {item["galaxy_id"] for item in by_id.values()} == {MILKY_WAY, *EXTERNAL_GALAXIES}
    assert not any(item["kind"] == "exoplanet" for item in by_id.values())
    assert {
        "neutron_star",
        "white_dwarf",
        "brown_dwarf_binary",
        "black_hole_binary",
        "globular_cluster",
        "emission_nebula",
        "young_star_cluster",
        "massive_star",
    }.issubset({item["kind"] for item in by_id.values()})
    assert by_id["epsilon-indi-b"]["existing_object_id"] == "epsilon-indi-b"
    assert by_id["member-lmc-r136a1"]["parent_id"] == "member-lmc-r136"
    assert by_id["member-lmc-r136"]["parent_id"] == "member-lmc-tarantula"
    for item in by_id.values():
        assert item["distance_pc"] is None
        assert item["image"] is None and item["appearance"] is None
    assert data["coverage"] == "curated_source_confirmed_examples_not_complete_census"


def test_g1_is_not_accidentally_placed_at_the_release_pages_m31_center():
    items = get_universe_catalog(ROOT, galaxy_id="galaxy-m31")["objects"]
    g1 = next(item for item in items if item["object_id"] == "member-m31-g1")
    position = g1["coordinate"]
    # Independently check the known sky region (00h32m / +39d35), not M31's 00h42m/+41d16.
    assert 8.19 < position["ra_deg"] < 8.20
    assert 39.57 < position["dec_deg"] < 39.59
    assert abs(position["ra_deg"] - 10.6847) > 2
    assert position["catalog_type"] == "GlC"
    assert position["frame"] == "ICRS" and position["epoch"] == "J2000"
    assert position["proper_motion_applied"] is False


def test_reference_centers_do_not_claim_individually_resolved_black_holes_or_nebular_shapes():
    data = get_universe_catalog(ROOT)
    by_id = {item["object_id"]: item for item in data["objects"]}
    for identifier in (
        "member-m81-nucleus",
        "member-m87-black-hole",
        "member-m51-nucleus",
        "member-m104-nucleus",
        "member-centaurus-a-nucleus",
    ):
        assert by_id[identifier]["coordinate"]["role"] == "host_nucleus_reference"
        assert by_id[identifier]["galaxy_relative_position_pc"] is None
    tarantula = by_id["member-lmc-tarantula"]
    assert tarantula["coordinate"]["catalog_identity"] == "RMC 136"
    assert tarantula["coordinate"]["role"] == "embedded_cluster_reference"
    assert tarantula["additional_sources"][0]["url"].endswith("/eso1030/")
    assert by_id["member-m51-ngc5195"]["kind"] == "companion_galaxy"


def test_parser_selects_icrs_not_fk4_and_handles_ra_hours_negative_declination():
    raw = b"""Object Reference  ---  Psr  ---  OID=@1234
Coordinates(FK4,ep=B1950,eq=1950): 00 00 00 +00 00 00
Coordinates(ICRS,ep=J2000,eq=2000): 06 00 00 -30 30 00 (Rad) A [0.1 0.1] 2020Reference
"""
    position = parse_simbad(raw)
    assert position["ra_deg"] == 90
    assert position["dec_deg"] == -30.5
    assert position["catalog_oid"] == "@1234"
    assert parse_simbad(b"Identifier not found in the database") is None
    assert parse_simbad(raw.replace(b"ICRS", b"FK5")) is None


def test_milky_way_hosts_join_all_original_rows_without_promoting_unverified_distances():
    catalog = get_universe_catalog(ROOT, galaxy_id=MILKY_WAY)
    hosts = [item for item in catalog["objects"] if item["kind"] == "exoplanet_host_system"]
    assert len(hosts) == len({item["object_id"] for item in hosts}) == 4862
    assert sum(item["catalog_reference"]["planet_count"] for item in hosts) == 6470
    assert all(item["distance_pc"] is None for item in hosts)
    assert any(
        item["catalog_reference"]["distance_value_unit_unverified"] is not None for item in hosts
    )
    trap = next(item for item in hosts if item["name"] == "TRAPPIST-1")
    assert trap["catalog_reference"]["planet_count"] == 7
    assert trap["existing_object_id"].startswith("exo-")
    assert trap["coordinate"]["epoch"] is None
    assert trap["coordinate"]["frame"] != "ICRS"


def test_host_drilldown_retains_existing_planet_ids_without_inventing_resolved_positions():
    data = get_universe_catalog(ROOT, parent_id=host_id("TRAPPIST-1"))
    assert {item["name"] for item in data["objects"]} == {
        "TRAPPIST-1 b",
        "TRAPPIST-1 c",
        "TRAPPIST-1 d",
        "TRAPPIST-1 e",
        "TRAPPIST-1 f",
        "TRAPPIST-1 g",
        "TRAPPIST-1 h",
    }
    for item in data["objects"]:
        assert item["object_id"] == item["existing_object_id"]
        assert item["coordinate"] is None
        assert item["parent_id"] == host_id("TRAPPIST-1")


@pytest.mark.parametrize("galaxy", ["../../secret", "galaxy-unknown"])
def test_unknown_galaxy_is_rejected(galaxy):
    with pytest.raises(ValueError, match="unknown_universe_galaxy"):
        get_universe_catalog(ROOT, galaxy_id=galaxy)


def test_nested_members_remain_accessible_by_parent():
    data = get_universe_catalog(ROOT, galaxy_id="galaxy-lmc", parent_id="member-lmc-r136")
    assert [item["name"] for item in data["objects"]] == ["R136a1"]


@pytest.mark.parametrize("parent", ["host-../../file", "not-a-catalog-parent"])
def test_unknown_or_malformed_parent_is_rejected_before_loading_host_data(parent):
    with pytest.raises(ValueError, match="unknown_universe_parent"):
        get_universe_catalog(ROOT, parent_id=parent)


def test_milky_way_host_cannot_be_returned_for_an_external_galaxy():
    with pytest.raises(ValueError, match="parent_galaxy_mismatch"):
        get_universe_catalog(ROOT, galaxy_id="galaxy-m31", parent_id=host_id("TRAPPIST-1"))


def test_galaxy_parent_only_query_exposes_hosts_and_rejects_conflicting_galaxy():
    data = get_universe_catalog(ROOT, parent_id=MILKY_WAY)
    hosts = [item for item in data["objects"] if item["kind"] == "exoplanet_host_system"]
    assert len(hosts) == 4862
    assert all(item["parent_id"] == MILKY_WAY for item in data["objects"])
    with pytest.raises(ValueError, match="parent_galaxy_mismatch"):
        get_universe_catalog(ROOT, galaxy_id="galaxy-m31", parent_id=MILKY_WAY)


def test_source_missing_and_changed_do_not_fall_back_to_a_generated_position(copied_inputs):
    root, manifest = copied_inputs
    source = root / manifest["sources"]["simbad-member-m31-g1"]["local_relative_path"]
    source.write_bytes(source.read_bytes() + b"tampered")
    with pytest.raises(ValueError, match="source_integrity"):
        get_universe_catalog(root)
    source.unlink()
    with pytest.raises(FileNotFoundError):
        get_universe_catalog(root)


def test_source_path_escape_is_rejected_before_read(copied_inputs):
    root, manifest = copied_inputs
    manifest["sources"]["simbad-member-m31-g1"]["local_relative_path"] = "../outside.txt"
    rewrite(root, manifest)
    with pytest.raises(ValueError, match="source_path_invalid"):
        get_universe_catalog(root)


def test_new_synthetic_depth_or_surface_cannot_be_silently_accepted(copied_inputs):
    root, manifest = copied_inputs
    manifest["objects"][0]["galaxy_relative_position_pc"] = [1, 2, 3]
    rewrite(root, manifest)
    with pytest.raises(ValueError, match="unsourced_geometry"):
        get_universe_catalog(root)


def test_shared_catalog_manifest_change_requires_rebuild_of_join(copied_inputs):
    root, manifest = copied_inputs
    dependency = root / manifest["dependencies"]["exoplanets"]["path"]
    dependency.write_bytes(dependency.read_bytes() + b" ")
    with pytest.raises(ValueError, match="dependency_changed"):
        get_universe_catalog(root)


def test_parent_membership_cannot_be_reassigned_to_a_different_galaxy(copied_inputs):
    root, manifest = copied_inputs
    manifest["objects"][0]["galaxy_id"] = "galaxy-m87"
    rewrite(root, manifest)
    with pytest.raises(ValueError, match="membership_changed"):
        get_universe_catalog(root)


def test_coordinate_edit_cannot_hide_behind_a_valid_original_source_hash(copied_inputs):
    root, manifest = copied_inputs
    manifest["objects"][0]["coordinate"]["ra_deg"] = 10.6847
    rewrite(root, manifest)
    with pytest.raises(ValueError, match="coordinate_changed"):
        get_universe_catalog(root)
