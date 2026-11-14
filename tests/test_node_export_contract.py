"""The adopted Solar/P9 source closure must produce a self-contained ZIP."""

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
    required_fits = [
        path
        for path, value in sources.items()
        if value["runtime_required"] and path.endswith(".fits")
    ]
    assert len(required_fits) == 6
