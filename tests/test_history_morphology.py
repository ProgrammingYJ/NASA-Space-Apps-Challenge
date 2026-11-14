"""Real source/age/interpretation guards for conceptual morphology references."""

from __future__ import annotations

import hashlib
import html
import json
import re
import shutil
from pathlib import Path

import pytest

from science import history_morphology as morphology

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def local_sources(tmp_path):
    manifest_path = ROOT / morphology.MANIFEST
    target = tmp_path / morphology.MANIFEST
    target.parent.mkdir(parents=True)
    shutil.copyfile(manifest_path, target)
    manifest = json.loads(manifest_path.read_bytes())
    for source in manifest["sources"].values():
        dest = tmp_path / source["local_relative_path"]
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / source["local_relative_path"], dest)
    return tmp_path


def write_manifest(root, value):
    (root / morphology.MANIFEST).write_text(json.dumps(value), encoding="utf-8")


def test_actual_sources_and_conceptual_contract():
    value = morphology.get_history_morphology(ROOT)
    assert len(value["examples"]) == len(value["sources"]) == 6
    assert (
        value["source_manifest_sha256"]
        == hashlib.sha256((ROOT / morphology.MANIFEST).read_bytes()).hexdigest()
    )
    assert not value["visual_policy"]["morphology_fractions_available"]
    assert not value["visual_policy"]["source_age_is_first_appearance_date"]
    assert not value["visual_policy"]["all_nodes_share_one_evolution_track"]
    assert not value["visual_policy"]["early_disc_bar_and_arms_confirmed"]
    assert len(value["image_review"]["observations"]) == 5


@pytest.mark.parametrize(
    ("source_id", "phrases"),
    [
        ("esa_cosmic_gems", ["460 million", "lensing", "clusters"]),
        ("nasa_firefly_sparkle", ["600 million", "companions", "can't predict"]),
        ("nasa_ceers_shapes", ["600 million to 6 billion", "elongated", "sphere"]),
        ("eso_rebels25", ["700 million", "rotating", "more observations"]),
        ("nasa_galaxies_over_time", ["spiral and elliptical", "clumpy", "present day"]),
        ("esa_zs7_merger", ["740 million", "ongoing merger", "zs7"]),
    ],
)
def test_source_text_independently_supports_adopted_context(source_id, phrases):
    manifest = json.loads((ROOT / morphology.MANIFEST).read_bytes())
    raw = (ROOT / manifest["sources"][source_id]["local_relative_path"]).read_text(encoding="utf-8")
    text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", raw))).lower()
    text = text.replace("\u2019", "'")
    assert all(phrase in text for phrase in phrases)


def test_example_age_scopes_are_not_a_single_evolution_track():
    examples = {v["id"]: v for v in morphology.get_history_morphology(ROOT)["examples"]}
    assert examples["cosmic_gems_clusters"]["approx_age_gyr"] == 0.46
    assert examples["firefly_sparkle_assembly"]["approx_age_gyr"] == 0.6
    assert examples["rebels25_rotating_disc"]["approx_age_gyr"] == 0.7
    ceers = examples["ceers_projected_shapes"]
    assert ceers["approx_age_gyr"] is None
    assert ceers["sample_age_range_gyr"] == [0.6, 6.0]
    assert examples["later_coexisting_morphologies"]["approx_age_gyr"] is None
    assert "small_disk" in examples["rebels25_rotating_disc"]["visual_families"]
    assert "disturbed_pair" not in examples["firefly_sparkle_assembly"]["visual_families"]
    assert "disturbed_pair" in examples["zs7_ongoing_merger"]["visual_families"]
    assert examples["zs7_ongoing_merger"]["approx_age_gyr"] == 0.74
    assert "not measured" in " ".join(examples["firefly_sparkle_assembly"]["limitations"])


def test_reader_has_no_runtime_network(monkeypatch):
    def forbidden(*_args, **_kwargs):
        raise AssertionError("runtime network request")

    monkeypatch.setattr(morphology, "urlopen", forbidden)
    assert morphology.get_history_morphology(ROOT)["algorithm_version"] == morphology.ALGORITHM


@pytest.mark.parametrize(
    "change", ["missing", "bytes", "path", "url", "version", "age", "family", "source"]
)
def test_corruption_and_invalid_contract_rejected(local_sources, change):
    path = local_sources / morphology.MANIFEST
    value = json.loads(path.read_bytes())
    source = value["sources"]["esa_cosmic_gems"]
    raw_path = local_sources / source["local_relative_path"]
    if change == "missing":
        raw_path.unlink()
    elif change == "bytes":
        raw_path.write_bytes(raw_path.read_bytes() + b" ")
    elif change == "path":
        source["local_relative_path"] = "../outside.html"
    elif change == "url":
        source["url"] = "https://example.com/untrusted"
    elif change == "version":
        value["algorithm_version"] = "unsupported"
    elif change == "age":
        value["examples"][0]["approx_age_gyr"] = float("nan")
    elif change == "family":
        value["examples"][0]["visual_families"] = ["measured_three_armed_early_spiral"]
    elif change == "source":
        value["examples"][0]["source"] = {}
    write_manifest(local_sources, value)
    with pytest.raises((ValueError, FileNotFoundError)):
        morphology.get_history_morphology(local_sources)


def test_original_chronology_remains_unchanged():
    assert hashlib.sha256(
        (ROOT / "data/manifests/cosmic_history.json").read_bytes()
    ).hexdigest() == ("bf947edd0a0859466d594b4e968997a70cd51511dd78fbccf6653b042f65b03f")
