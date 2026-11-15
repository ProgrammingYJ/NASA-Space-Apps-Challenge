"""The adopted Solar/P9 and registered observation closure must be self-contained."""

import json
from pathlib import Path

from deploy.export_node_runtime import ACTIVE_MANIFESTS, _sources

ROOT = Path(__file__).resolve().parents[1]


def test_actual_dependency_closure_requires_only_adopted_science_inputs():
    sources = {record["path"]: record for record in _sources(ROOT)}
    for name in ACTIVE_MANIFESTS:
        assert sources["data/manifests/" + name]["runtime_required"] is True
    for relative in [
        "data/raw/legacy_public_originals/planet_nine_reference/reference_population.csv",
        "data/reference/legacy_public_originals/planet_nine_reference/README.TXT",
        "data/reference/outer-tno/sbdb_tno.json",
        "contracts/openapi.json",
        "contracts/planet-nine.schema.json",
    ]:
        assert sources[relative]["runtime_required"] is True
    excluded = (
        "data/reference/galaxy-atlas/",
        "data/reference/numerical-relativity/",
        "data/reference/galaxies/",
        "data/reference/history/",
        "data/reference/cosmic-",
        "data/reference/exoplanet-",
        "data/reference/extragalactic-",
        "data/reference/relativity/",
        "data/reference/comets/",
        "web/public/observations/",
    )
    assert not any(path.startswith(excluded) for path in sources)
    assert "data/manifests/node_runtime.json" not in sources
    required_fits = {
        path
        for path, value in sources.items()
        if value["runtime_required"] and path.endswith(".fits")
    }
    registry = json.loads((ROOT / "data/manifests/observation_registry.json").read_bytes())
    inventory = {record["id"]: record for record in json.loads((ROOT / "data/manifests/datasets.json").read_bytes())["files"]}
    enabled = [entry for entry in registry["exposures"].values() if entry["enabled"]]
    identifiers = {entry[key] for entry in enabled for key in ("source_id", "calibration_id")}
    expected_paths = {inventory[identifier]["local_relative_path"] for identifier in identifiers}
    assert required_fits == expected_paths
    assert sources["data/manifests/observation_registry.json"]["runtime_required"] is True
    for entry in enabled:
        for identifier_key, pin_key in [("source_id", "source"), ("calibration_id", "calibration_source")]:
            record = inventory[entry[identifier_key]]
            exported = sources[record["local_relative_path"]]
            assert exported["runtime_required"] is True
            assert (exported["sha256"], exported["bytes"]) == (entry[pin_key]["sha256"], entry[pin_key]["bytes"])
