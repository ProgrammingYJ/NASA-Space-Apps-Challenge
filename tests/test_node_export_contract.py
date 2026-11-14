"""The adopted source dependency closure must produce a self-contained ZIP."""

from pathlib import Path

from deploy.export_node_runtime import _sources

ROOT = Path(__file__).resolve().parents[1]


def test_actual_dependency_closure_keeps_held_paper_optional_and_scientific_inputs_required():
    sources = {record["path"]: record for record in _sources(ROOT)}
    audit = "data/reference/galaxy-atlas/upstream/white2011.html"
    assert sources[audit]["runtime_required"] is False
    assert sources[audit + ".source.json"]["runtime_required"] is False
    for relative in [
        "data/reference/galaxy-atlas/gwgc_vizier.tsv",
        "data/reference/galaxy-atlas/gwgc_galaxies.compact.json",
        "data/reference/numerical-relativity/sxs_bbh_0305_lev6_com.h5",
        "data/reference/numerical-relativity/sxs_bbh_0305_lev6_h22.json",
        "data/manifests/galaxy_atlas.json",
        "data/manifests/numerical_relativity.json",
        "contracts/openapi.json",
    ]:
        assert sources[relative]["runtime_required"] is True
