import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from api.storage import canonical, digest
from deploy.export_node_runtime import preserved_canonical_comparisons


class CanonicalComparisonExportTests(unittest.TestCase):
    def fixture(self, root):
        datasets = []
        for identifier in ["S01", "S02", "S10"]:
            raw = (identifier + "-immutable-fixture-input").encode()
            path = root / "data/raw" / identifier
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
            datasets.append({"id": identifier, "local_relative_path": path.relative_to(root).as_posix(), "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()})
        manifest_path = root / "data/manifests/datasets.json"
        manifest_path.parent.mkdir(parents=True)
        manifest_path.write_text(json.dumps({"files": datasets}))
        by_id = {record["id"]: record for record in datasets}
        result = {"object_id": "epsilon-indi-b", "algorithm_version": "spherex-native-v1", "number_with_original_spelling": 1.0,
                  "frames": [{"observation_id": identifier, "provenance": by_id[identifier], "calibration": by_id["S10"]} for identifier in ["S01", "S02"]]}
        result["result_id"] = "cmp_" + digest(result)[:24]
        raw = canonical(result)
        bundle = root / "data/node-runtime"
        comparison = bundle / "comparisons/S01_S02.json"
        comparison.parent.mkdir(parents=True)
        comparison.write_bytes(raw)
        sha = hashlib.sha256(raw).hexdigest()
        entry = {"path": "comparisons/S01_S02.json", "sha256": sha, "comparison_sha256": sha, "result_id": result["result_id"]}
        (bundle / "runtime_manifest.json").write_text(json.dumps({"comparisons": {"S01,S02": entry}}))
        return raw, {"S01,S02": (result["result_id"], sha)}

    def test_preserves_exact_original_bytes_including_float_spelling(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            raw, expected = self.fixture(root)
            with patch("deploy.export_node_runtime.CANONICAL_COMPARISONS", expected):
                self.assertEqual(preserved_canonical_comparisons(root), {"S01,S02": raw})
                self.assertIn(b'"number_with_original_spelling":1.0', raw)

    def test_current_inventory_cannot_rebind_a_protected_comparison_to_changed_inputs(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            _, expected = self.fixture(root)
            changed = root / "data/raw/S01"
            changed.write_bytes(b"changed")
            manifest = root / "data/manifests/datasets.json"
            value = json.loads(manifest.read_bytes())
            value["files"][0].update(bytes=7, sha256=hashlib.sha256(b"changed").hexdigest())
            manifest.write_text(json.dumps(value))
            with patch("deploy.export_node_runtime.CANONICAL_COMPARISONS", expected), self.assertRaisesRegex(ValueError, "source_integrity"):
                preserved_canonical_comparisons(root)

    def test_changing_payload_and_its_untrusted_manifest_hash_does_not_change_fixed_expectation(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            _, expected = self.fixture(root)
            path = root / "data/node-runtime/comparisons/S01_S02.json"
            value = json.loads(path.read_bytes())
            value["number_with_original_spelling"] = 2.0
            raw = canonical(value)
            path.write_bytes(raw)
            manifest = root / "data/node-runtime/runtime_manifest.json"
            record = json.loads(manifest.read_bytes())
            record["comparisons"]["S01,S02"].update(sha256=hashlib.sha256(raw).hexdigest(), comparison_sha256=hashlib.sha256(raw).hexdigest())
            manifest.write_text(json.dumps(record))
            with patch("deploy.export_node_runtime.CANONICAL_COMPARISONS", expected), self.assertRaisesRegex(ValueError, "identity_or_bytes_changed"):
                preserved_canonical_comparisons(root)


if __name__ == "__main__":
    unittest.main()
