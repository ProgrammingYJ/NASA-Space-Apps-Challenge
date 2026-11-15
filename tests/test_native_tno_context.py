"""Optional display source pins must not reinterpret old observation evidence."""

import hashlib
import json

import pytest
from pydantic import ValidationError

from api.models import UniverseContext
from api.service import outer_tno_context_reasons


def context(**changes):
    return UniverseContext(
        selected_object_id="pluto",
        model_epoch="2026-11-14T00:00:00Z",
        source_manifest_sha256="a" * 64,
        **changes,
    )


def test_optional_native_source_and_runtime_pins_preserve_legacy_and_reject_changes(
    tmp_path, monkeypatch
):
    import api.service

    legacy = context()
    assert outer_tno_context_reasons(legacy, tmp_path) == []  # No TNO read for old evidence.
    path = tmp_path / "data/manifests/outer_tno.json"
    path.parent.mkdir(parents=True)
    raw = json.dumps(
        {
            "schema_version": "1.0",
            "algorithm_version": "jpl-sbdb-tno-two-body-v1",
            "coordinate_frame": "heliocentric_IAU76_80_ecliptic_J2000",
            "time_scale": "TDB",
        }
    ).encode()
    path.write_bytes(raw)
    pinned = context(
        outer_tno_manifest_sha256=hashlib.sha256(raw).hexdigest(),
        native_tno_simulation_algorithm_version="jpl-sbdb-tno-two-body-v2",
    )
    before = pinned.model_dump()
    assert outer_tno_context_reasons(pinned, tmp_path) == []
    assert pinned.model_dump() == before
    assert outer_tno_context_reasons(
        pinned.model_copy(update={"outer_tno_manifest_sha256": "f" * 64}), tmp_path
    ) == ["outer_tno_sources_changed"]
    monkeypatch.setattr(api.service, "NATIVE_TNO_SIMULATION_ALGORITHM", "future-runtime-version")
    assert outer_tno_context_reasons(pinned, tmp_path) == ["native_tno_algorithm_changed"]
    assert outer_tno_context_reasons(legacy, tmp_path) == []
    path.unlink()
    assert outer_tno_context_reasons(pinned, tmp_path) == ["outer_tno_data_unavailable"]


def test_new_pin_fields_round_trip_as_optional_strict_values():
    legacy = context().model_dump(exclude_none=True)
    assert "outer_tno_manifest_sha256" not in legacy
    assert "native_tno_simulation_algorithm_version" not in legacy
    pinned = context(
        outer_tno_manifest_sha256="b" * 64,
        native_tno_simulation_algorithm_version="jpl-sbdb-tno-two-body-v2",
    )
    assert UniverseContext.model_validate_json(pinned.model_dump_json()) == pinned
    for changes in (
        {"outer_tno_manifest_sha256": "not-a-sha"},
        {"native_tno_simulation_algorithm_version": "jpl-sbdb-tno-two-body-v1"},
    ):
        with pytest.raises(ValidationError):
            context(**changes)
