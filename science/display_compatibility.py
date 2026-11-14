"""Verify the two audited display-dependency migrations without changing evidence.

Only the top-level dependencies object may differ. Actual scientific payload,
dates, source facts, body profiles, targets and model values remain identical.
The Node runtime has an independent standard-library implementation.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import struct
from pathlib import Path, PurePosixPath

MANIFEST = "data/manifests/display_dependency_compatibility.json"
ALGORITHM = "visual-dependency-payload-equivalence-v1"
CANONICAL = "typed-json-ieee754be-v1"
MAX_BYTES = 4_000_000
SHA = re.compile(r"[a-f0-9]{64}\Z")
FIELDS = {
    "small_body_appearance_manifest_sha256": "data/manifests/small_body_appearance.json",
    "mass_scenarios_manifest_sha256": "data/manifests/mass_scenarios.json",
}
DEPENDENCIES = {
    "small_body_appearance_manifest_sha256": {
        "extended_solar.json": "data/manifests/extended_solar.json",
        "appearance.json": "data/manifests/appearance.json",
    },
    "mass_scenarios_manifest_sha256": {
        "planet_criteria": "data/manifests/planet_criteria.json",
        "small_body_appearance": "data/manifests/small_body_appearance.json",
    },
}
CHANGED_DEPENDENCY = {
    "small_body_appearance_manifest_sha256": "appearance.json",
    "mass_scenarios_manifest_sha256": "small_body_appearance",
}


class DisplayCompatibilityError(ValueError):
    """The registered migration cannot be verified; never silently broaden it."""


def _require(condition, reason):
    if not condition:
        raise DisplayCompatibilityError(reason)


def _safe(root: Path, relative: str) -> Path:
    _require(isinstance(relative, str) and "\\" not in relative, "invalid_path")
    path = PurePosixPath(relative)
    _require(not path.is_absolute() and all(p not in ("", ".", "..") for p in path.parts), "invalid_path")
    base = root.resolve(strict=True)
    resolved = (base / relative).resolve(strict=True)
    _require(resolved.is_relative_to(base) and resolved != base, "escaped_path")
    return resolved


def _pairs(items):
    result = {}
    for key, value in items:
        _require(key not in result, "duplicate_json_key")
        result[key] = value
    return result


def _parse(raw: bytes):
    return json.loads(raw, object_pairs_hook=_pairs, parse_constant=lambda _: _require(False, "nonfinite_json"))


def _semantic(value):
    if value is None:
        return ["null"]
    if isinstance(value, bool):
        return ["boolean", value]
    if isinstance(value, str):
        return ["string", value]
    if isinstance(value, (int, float)):
        number = float(value)
        _require(math.isfinite(number), "nonfinite_payload")
        return ["number", struct.pack(">d", number).hex()]
    if isinstance(value, list):
        return ["array", [_semantic(item) for item in value]]
    _require(isinstance(value, dict), "unsupported_payload_value")
    return ["object", [[key, _semantic(value[key])] for key in sorted(value, key=lambda k: k.encode("utf-8"))]]


def semantic_canonical(value) -> bytes:
    return json.dumps(_semantic(value), ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")


def _payload(value):
    _require(isinstance(value, dict) and isinstance(value.get("dependencies"), dict), "missing_dependency_object")
    return {key: item for key, item in value.items() if key != "dependencies"}


def payload_canonical_sha256(value) -> str:
    return hashlib.sha256(semantic_canonical(_payload(value))).hexdigest()


def _read_record(root: Path, record: dict):
    _require(
        isinstance(record, dict)
        and isinstance(record.get("path"), str)
        and isinstance(record.get("sha256"), str)
        and SHA.fullmatch(record["sha256"])
        and type(record.get("bytes")) is int
        and 0 < record["bytes"] <= MAX_BYTES,
        "invalid_file_record",
    )
    path = _safe(root, record["path"])
    _require(path.is_file() and path.stat().st_size == record["bytes"], "file_size_mismatch")
    raw = path.read_bytes()
    _require(hashlib.sha256(raw).hexdigest() == record["sha256"], "file_hash_mismatch")
    return _parse(raw)


def _verify_dependencies(root: Path, field: str, old: dict, current: dict):
    expected = DEPENDENCIES[field]
    _require(old["dependencies"].keys() == expected.keys() == current["dependencies"].keys(), "dependency_set_changed")
    for name, relative in expected.items():
        before, after = old["dependencies"][name], current["dependencies"][name]
        _require(before.get("path") == relative == after.get("path"), "dependency_identity_changed")
        def identity(value):
            return {key: item for key, item in value.items() if key not in ("bytes", "sha256")}

        _require(semantic_canonical(identity(before)) == semantic_canonical(identity(after)), "dependency_nonreference_payload_changed")
        if name != CHANGED_DEPENDENCY[field]:
            _require(semantic_canonical(before) == semantic_canonical(after), "nonvisual_dependency_changed")
        _read_record(root, after)
    _require(semantic_canonical(old["dependencies"]) != semantic_canonical(current["dependencies"]), "dependency_update_absent")


def verified_migrations(root: Path) -> list[dict]:
    path = _safe(root, MANIFEST)
    _require(path.is_file() and 0 < path.stat().st_size <= MAX_BYTES, "manifest_size")
    manifest = _parse(path.read_bytes())
    _require(manifest.get("schema_version") == "1.0" and manifest.get("algorithm_version") == ALGORITHM and manifest.get("canonical_algorithm") == CANONICAL, "manifest_version")
    records = manifest.get("migrations")
    _require(manifest.get("allowed_changed_top_level_fields") == ["dependencies"] and isinstance(records, list) and len(records) == len(FIELDS), "migration_scope")
    seen, result = set(), []
    for record in records:
        field = record.get("field")
        _require(field in FIELDS and field not in seen, "migration_field")
        seen.add(field)
        before_sha, after_sha = record.get("from_sha256"), record.get("to_sha256")
        _require(isinstance(before_sha, str) and isinstance(after_sha, str) and SHA.fullmatch(before_sha) and SHA.fullmatch(after_sha) and before_sha != after_sha and isinstance(record.get("payload_canonical_sha256"), str) and SHA.fullmatch(record["payload_canonical_sha256"]), "migration_hashes")
        before, after = record.get("from", {}), record.get("to", {})
        _require(record.get("original_path") == FIELDS[field] and before.get("path") == f"data/reference/visual-manifest-history/{before_sha}.json" and before.get("sha256") == before_sha and after.get("path") == FIELDS[field] and after.get("sha256") == after_sha, "migration_paths")
        evidence = record.get("source_evidence", {})
        _require(isinstance(evidence.get("archive"), str) and "/" not in evidence["archive"] and "\\" not in evidence["archive"] and isinstance(evidence.get("archive_sha256"), str) and SHA.fullmatch(evidence["archive_sha256"]) and isinstance(evidence.get("release_manifest_sha256"), str) and SHA.fullmatch(evidence["release_manifest_sha256"]) and evidence.get("archive_member_path") == FIELDS[field] and evidence.get("archive_member_sha256") == before_sha, "original_member_evidence")
        _require(record.get("changed_top_level_fields") == ["dependencies"], "changed_fields")
        old, current = _read_record(root, before), _read_record(root, after)
        # Native Python deep equality is checked in addition to the shared binary64
        # canonical digest, so no source field is dropped by numeric formatting.
        _require(_payload(old) == _payload(current), "scientific_payload_changed")
        left, right = semantic_canonical(_payload(old)), semantic_canonical(_payload(current))
        _require(left == right and hashlib.sha256(left).hexdigest() == record["payload_canonical_sha256"], "scientific_payload_changed")
        _verify_dependencies(root, field, old, current)
        result.append({"field": field, "from_sha256": before_sha, "to_sha256": after_sha})
    return result


def resolve_display_compatibility(root: Path, field: str, from_sha256: str, to_sha256: str) -> dict | None:
    if field not in FIELDS or not isinstance(from_sha256, str) or not isinstance(to_sha256, str) or not SHA.fullmatch(from_sha256) or not SHA.fullmatch(to_sha256) or from_sha256 == to_sha256:
        return None
    return next((record for record in verified_migrations(root) if record["field"] == field and record["from_sha256"] == from_sha256 and record["to_sha256"] == to_sha256), None)
