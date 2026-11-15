"""Publish Credits metadata only when the PDF matches the current source and version."""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def expected_metadata(root: Path = ROOT, updated_at: str | None = None) -> dict:
    version = json.loads((root / "package.json").read_bytes())["version"]
    record = json.loads((root / "data/manifests/data_spec_pdf.json").read_bytes())
    source = root / "Data_Spec.md"
    pdf = root / "web/public/downloads/PlanetX_Data_Spec.pdf"
    if record["version"] != version:
        raise ValueError("data_spec_pdf_version_mismatch")
    for path, key in [(source, "source_sha256"), (pdf, "pdf_sha256")]:
        if hashlib.sha256(path.read_bytes()).hexdigest() != record[key]:
            raise ValueError("stale_data_spec_pdf:" + path.name)
    pdf_stamp = datetime.fromisoformat(record["built_at"])
    release_stamp = datetime.fromisoformat(updated_at or record["built_at"])
    if pdf_stamp.tzinfo is None or release_stamp.tzinfo is None:
        raise ValueError("release_metadata_timezone_required")
    if release_stamp < pdf_stamp:
        raise ValueError("release_metadata_predates_pdf")
    metadata = {"version": version, "updated_at": updated_at or record["built_at"],
                "data_spec_url": "/downloads/PlanetX_Data_Spec.pdf",
                "data_spec_sha256": record["pdf_sha256"],
                "data_spec_source_sha256": record["source_sha256"]}
    return metadata


def validate(root: Path = ROOT) -> dict:
    actual = json.loads((root / "web/src/generated/releaseMetadata.json").read_bytes())
    expected = expected_metadata(root, actual.get("updated_at"))
    if actual != expected:
        raise ValueError("stale_credits_release_metadata")
    return expected


def generate(root: Path = ROOT, updated_at: str | None = None) -> dict:
    path = root / "web/src/generated/releaseMetadata.json"
    if updated_at is None and path.exists():
        try:
            updated_at = validate(root)["updated_at"]
        except ValueError:
            pass  # A newly generated PDF gets its own timestamp until release freeze.
    metadata = expected_metadata(root, updated_at)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes((json.dumps(metadata, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    return metadata


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--updated-at", help="Actual release source-freeze ISO timestamp, with timezone")
    args = parser.parse_args()
    print(json.dumps(generate(updated_at=args.updated_at)))
