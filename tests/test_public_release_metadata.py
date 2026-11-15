import hashlib
import json

import pytest

from deploy.update_release_metadata import generate, validate


def test_pdf_and_source_changes_cannot_silently_leave_stale_credits(tmp_path):
    for directory in ["data/manifests", "web/public/downloads"]:
        (tmp_path / directory).mkdir(parents=True)
    source = tmp_path / "Data_Spec.md"
    pdf = tmp_path / "web/public/downloads/PlanetX_Data_Spec.pdf"
    source.write_text("# 정확한 데이터 목록", encoding="utf-8")
    pdf.write_bytes(b"%PDF-1.7\nverified fixture")
    (tmp_path / "package.json").write_text('{"version":"0.16.0"}')
    record = {"version": "0.16.0", "built_at": "2026-11-15T01:50:00Z",
              "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
              "pdf_sha256": hashlib.sha256(pdf.read_bytes()).hexdigest()}
    (tmp_path / "data/manifests/data_spec_pdf.json").write_text(json.dumps(record))
    expected = generate(tmp_path)
    assert validate(tmp_path) == expected
    publication = generate(tmp_path, updated_at="2026-11-15T03:00:00Z")
    assert publication["updated_at"] == "2026-11-15T03:00:00Z"
    assert generate(tmp_path) == validate(tmp_path) == publication
    with pytest.raises(ValueError, match="release_metadata_predates_pdf"):
        generate(tmp_path, updated_at="2026-11-14T03:00:00Z")
    source.write_text("new data inventory", encoding="utf-8")
    with pytest.raises(ValueError, match="stale_data_spec_pdf"):
        validate(tmp_path)
    source.write_text("# 정확한 데이터 목록", encoding="utf-8")
    pdf.write_bytes(b"%PDF-changed")
    with pytest.raises(ValueError, match="stale_data_spec_pdf"):
        validate(tmp_path)
