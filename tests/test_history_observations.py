"""Observed-case ages, unchanged images, rights and offline integrity boundaries."""

from __future__ import annotations

import hashlib
import html
import json
import re
import shutil
from pathlib import Path

import pytest

from science import history_observations as observations

ROOT = Path(__file__).resolve().parents[1]


def text_from_source(value):
    raw = (ROOT / value["local_relative_path"]).read_text(encoding="utf-8")
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", raw))).lower()


@pytest.fixture
def copied(tmp_path):
    value = json.loads((ROOT / observations.MANIFEST).read_bytes())
    paths = [observations.MANIFEST]
    paths += [s["local_relative_path"] for s in value["sources"].values()]
    paths += [c["image"]["local_path"] for c in value["objects"]]
    for relative in paths:
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, target)
    return tmp_path


def test_actual_five_image_cases_have_no_synthetic_population():
    value = observations.get_cosmic_observations(ROOT)
    assert len(value["objects"]) == 5
    assert value["algorithm_version"] == "cosmic-observation-viewer-v1"
    assert not value["age_interpolation_available"]
    assert (
        value["source_manifest_sha256"]
        == hashlib.sha256((ROOT / observations.MANIFEST).read_bytes()).hexdigest()
    )
    assert all(c["image"]["kind"] == "published_observation_composite" for c in value["objects"])
    assert all(not c["image"]["artist_concept"] for c in value["objects"])
    assert all(not c["image"]["bytes_modified_locally"] for c in value["objects"])
    assert not any(k in value for k in ["seeds", "population", "node_count", "positions"])
    json.dumps(value, allow_nan=False)


@pytest.mark.parametrize(
    ("identifier", "age", "span", "age_phrase"),
    [
        ("cosmic_gems_clusters", 0.46, None, "460 million"),
        ("firefly_sparkle_assembly", 0.6, None, "600 million"),
        ("ceers_projected_shapes", None, [0.6, 6.0], "600 million to 6 billion"),
        ("rebels25_rotating_disc", 0.7, None, "700 million"),
        ("zs7_ongoing_merger", 0.74, None, "740 million"),
    ],
)
def test_case_ages_independently_match_preserved_publication(identifier, age, span, age_phrase):
    cases = {c["id"]: c for c in observations.get_cosmic_observations(ROOT)["objects"]}
    case = cases[identifier]
    assert case["approx_age_gyr"] == age
    assert case["sample_age_range_gyr"] == span
    assert age_phrase in text_from_source(case["source"])
    assert "later_coexisting_morphologies" not in cases


def test_photo_processing_and_licensing_are_not_silently_interchangeable():
    value = observations.get_cosmic_observations(ROOT)
    cases = {c["id"]: c for c in value["objects"]}
    gems = cases["cosmic_gems_clusters"]
    assert "two distinct lensed galaxies" in " ".join(gems["image"]["processing"])
    assert "two distinct lensed galaxies" in text_from_source(gems["image"]["image_page_source"])
    firefly = cases["firefly_sparkle_assembly"]
    assert "not the separate artist" in " ".join(firefly["image"]["processing"])
    assert "01J4A44SME50MYJ4QVW1AWQW5V" in firefly["image"]["source_url"]
    assert "01J6AFVDP7867TQD8TTBARG2B0" not in firefly["image"]["source_url"]
    rebels = cases["rebels25_rotating_disc"]
    assert "velocity map" in " ".join(rebels["image"]["processing"])
    assert "more observations" in text_from_source(rebels["source"])
    for case in value["objects"]:
        rights = case["image"]["license"]
        if case["source_id"].startswith("nasa_"):
            assert rights["spdx_id"] is None
            assert "educational or informational" in text_from_source(rights["policy_source"])
        else:
            assert rights["spdx_id"] == "CC-BY-4.0"
            assert "attribution 4.0" in text_from_source(rights["policy_source"])
        assert case["image"]["credit"]
        assert rights["requirements"]


def test_image_files_are_bounded_actual_published_jpeg_or_png():
    for case in observations.get_cosmic_observations(ROOT)["objects"]:
        image = case["image"]
        raw = (ROOT / image["local_path"]).read_bytes()
        assert 0 < len(raw) <= 8_000_000
        assert raw.startswith((b"\xff\xd8", b"\x89PNG\r\n\x1a\n"))
        assert min(image["pixel_dimensions"]) >= 400
        assert image["url"].startswith("/observations/cosmic/")


def test_offline_reader_does_not_fetch(monkeypatch):
    def forbidden(*_args, **_kwargs):
        raise AssertionError("Unexpected runtime network request")

    monkeypatch.setattr(observations, "urlopen", forbidden)
    assert len(observations.get_cosmic_observations(ROOT)["objects"]) == 5


@pytest.mark.parametrize(
    "change",
    [
        "missing_image",
        "image_bytes",
        "source_bytes",
        "image_path",
        "age",
        "artist",
        "kind",
        "credit",
        "policy",
        "source_url",
    ],
)
def test_missing_or_changed_sources_images_or_scientific_contract_fail(copied, change):
    path = copied / observations.MANIFEST
    value = json.loads(path.read_bytes())
    case = value["objects"][0]
    image = case["image"]
    target = copied / image["local_path"]
    if change == "missing_image":
        target.unlink()
    elif change == "image_bytes":
        target.write_bytes(target.read_bytes() + b" ")
    elif change == "source_bytes":
        source = copied / case["source"]["local_relative_path"]
        source.write_bytes(source.read_bytes() + b" ")
    elif change == "image_path":
        image["local_path"] = "../outside.png"
    elif change == "age":
        case["approx_age_gyr"] = 0.28
    elif change == "artist":
        image["artist_concept"] = True
    elif change == "kind":
        image["kind"] = "artist_illustration"
    elif change == "credit":
        image["credit"] = "NASA"
    elif change == "policy":
        image["license"]["policy_source"] = case["source"]
    elif change == "source_url":
        value["sources"][case["source_id"]]["url"] = "https://example.com/untrusted"
    path.write_text(json.dumps(value), encoding="utf-8")
    with pytest.raises((ValueError, FileNotFoundError)):
        observations.get_cosmic_observations(copied)


def test_old_chronology_and_conceptual_metadata_are_preserved():
    expected = {
        "cosmic_history.json": "bf947edd0a0859466d594b4e968997a70cd51511dd78fbccf6653b042f65b03f",
        "cosmic_morphology.json": "a86e63995732bb6c6f5006c74bb4d6d683f90fefecb917a15638982ce184fea0",
    }
    for name, sha in expected.items():
        assert hashlib.sha256((ROOT / "data/manifests" / name).read_bytes()).hexdigest() == sha
