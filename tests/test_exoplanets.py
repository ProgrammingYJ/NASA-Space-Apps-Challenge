"""Complete official public inventory, original-source identity and safe display."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import create_app
from science.exoplanets import CATALOG, index, load_catalog, object_id, planet, validate_rows

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def catalog():
    return load_catalog(ROOT)


def test_all_public_pages_and_canonical_names_account_for_every_entry(catalog):
    sources = [s for s in catalog["sources"] if "/exoplanet?" in s["url"]]
    originals = [
        entry
        for source in sources
        for entry in json.loads((ROOT / source["relative_path"]).read_bytes())
    ]
    assert len(originals) == sources[0]["collection_total"] == catalog["planet_count"] == 6470
    assert len({row["pl_name"] for row in catalog["records"]}) == 6470
    by_id = {entry["id"]: entry for entry in originals}
    for row in catalog["records"]:
        entry = by_id[row["nasa"]["id"]]
        assert row["pl_name"] == entry["acf"]["display_name"]
        assert row["pl_orbper"] == (entry["acf"].get("pl_orbper") or None)
        assert row["nasa"]["mass_display"] == entry["acf"].get("planet_mass")
    # Four blank titles and four injected debug titles in the public source
    # cannot displace the archive's actual display_name identity.
    assert sum(not entry["title"]["rendered"] for entry in originals) == 4
    assert sum("Debug:" in entry["title"]["rendered"] for entry in originals) == 4
    assert not any("Debug:" in row["pl_name"] for row in catalog["records"])


def test_index_is_complete_without_inventing_distances_or_surface_maps(catalog):
    value = index(catalog)
    assert len(value["objects"]) == 6470
    assert len({o["object_id"] for o in value["objects"]}) == 6470
    assert all(o["distance_pc"] is None for o in value["objects"])
    assert all(0 <= o["ra_deg"] < 360 and -90 <= o["dec_deg"] <= 90 for o in value["objects"])
    assert "sources" not in value and "raw_relative_path" not in value
    assert object_id("TRAPPIST-1 e") == object_id("TRAPPIST-1 e")
    assert object_id("TRAPPIST-1 e") != object_id("TRAPPIST-1 f")


def test_system_members_and_reported_values_keep_illustration_scope(catalog):
    value = planet(catalog, object_id("TRAPPIST-1 e"))
    assert value["surface_status"] == "unresolved_illustration"
    assert len(value["system_planets"]) == 7
    assert {row["name"] for row in value["system_planets"]} == {
        f"TRAPPIST-1 {letter}" for letter in "bcdefgh"
    }
    assert value["parameters"]["pl_orbper"] == 6.101013
    assert value["parameters"]["pl_orbpererr1"] is None
    assert value["parameters"]["sy_dist"] is None
    assert planet(catalog, "not-a-catalog-id") is None
    assert all("hypothesis" not in key for key in value)


def test_sparse_missing_fields_are_null_and_estimate_labels_survive(catalog):
    assert any(r["nasa"]["radius_estimated"] for r in catalog["records"])
    for row in catalog["records"]:
        if row["nasa"]["radius_estimated"]:
            assert "estimate" in row["nasa"]["radius_display"].lower()
        assert row["pl_bmasse"] is None  # Do not silently convert mixed source mass strings.
    damaged = [{**catalog["records"][0], "pl_orbper": float("nan")}]
    with pytest.raises(ValueError, match="nonfinite"):
        validate_rows(damaged)


def test_source_path_cannot_escape_the_catalog_root(tmp_path):
    data = json.loads((ROOT / CATALOG).read_bytes())
    data["sources"][0]["relative_path"] = "../../outside.json"
    target = tmp_path / CATALOG
    target.parent.mkdir(parents=True)
    target.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ValueError, match="unsafe_catalog_path"):
        load_catalog(tmp_path)


def test_actual_catalog_api_keeps_every_entry_and_unknown_ids_are_404(tmp_path):
    with TestClient(create_app(tmp_path)) as client:
        response = client.get("/api/v1/catalog/exoplanets")
        assert response.status_code == 200
        value = response.json()
        assert len(value["objects"]) == value["planet_count"] == 6470
        detail = client.get("/api/v1/catalog/exoplanets/" + object_id("WASP-4 b"))
        assert detail.status_code == 200
        assert detail.json()["name"] == "WASP-4 b"
        assert detail.json()["surface_status"] == "unresolved_illustration"
        assert client.get("/api/v1/catalog/exoplanets/unknown").status_code == 404
