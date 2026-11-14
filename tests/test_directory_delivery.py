"""Small delivery-mode fixtures; no real build, ZIP, Node server or SSH runs."""

from __future__ import annotations

import hashlib
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

from deploy import package_release as package
from deploy import verify_node_release as verifier


class DirectoryDeliveryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="planetx-directory-test-")
        self.root = Path(self.temporary.name).resolve()
        self.assertTrue(self.root.is_relative_to(Path(tempfile.gettempdir()).resolve()))

    def tearDown(self):
        self.temporary.cleanup()

    def write(self, name, value):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(value if isinstance(value, bytes) else json.dumps(value).encode())
        return path

    def test_directory_finalize_never_constructs_a_zip_and_records_exact_payload(self):
        stage = self.root / "release"
        stage.mkdir()
        self.write("release/app.js", b"source fixture\n")
        with patch.object(package.zipfile, "ZipFile", side_effect=AssertionError("ZIP forbidden")):
            result = package.finalize(stage, {"delivery_format": "directory", "release": "test"})
        manifest = stage / "release_manifest.json"
        record = json.loads(manifest.read_bytes())["files"][0]
        self.assertEqual(record["sha256"], hashlib.sha256(b"source fixture\n").hexdigest())
        self.assertEqual(result["directory_manifest_sha256"], package.sha(manifest))
        self.assertEqual(result["directory_bytes"], record["bytes"] + manifest.stat().st_size)
        self.assertEqual(result["file_count"], 2)
        self.assertTrue((self.root / "release.directory.sha256.json").is_file())
        self.assertFalse(list(self.root.rglob("*.zip")))
        self.assertNotIn("archive_checksum_report", json.loads(manifest.read_bytes()))

    def test_prepare_defaults_to_directory_and_accepts_verified_non_git_provenance(self):
        self.write("pyproject.toml", b'[project]\nversion="test"\n')
        app = self.write("app.js", b"source fixture\n")
        self.write("web/package-lock.json", {"packages": {}})
        self.write("data/manifests/datasets.json", {"files": []})
        self.write("data/node-runtime/runtime_manifest.json", {"public_scope": "solar_system_1000au", "source_files": []})
        transfer = self.write("deploy/source-transfer.json", {"files": [{"path": "app.js", "bytes": app.stat().st_size, "sha256": package.sha(app)}]})
        proof = {"base_commit": "1" * 40, "working_tree_has_uncommitted_changes": True, "source_transfer_manifest_sha256": package.sha(transfer)}
        files = ("app.js", "pyproject.toml", "web/package-lock.json", "data/manifests/datasets.json", "data/node-runtime/runtime_manifest.json")
        with (
            patch.object(package, "ROOT", self.root),
            patch.object(package, "FILES", files),
            patch.object(package, "DIRECTORIES", ()),
            patch.object(package, "runtime_dependencies", return_value={}),
            patch.object(package.zipfile, "ZipFile", side_effect=AssertionError("ZIP forbidden")),
        ):
            stage = package.prepare("2026-11-15T09:00:00+09:00", proof)
        manifest = json.loads((stage / "release_manifest.json").read_bytes())
        self.assertEqual(manifest["delivery_format"], "directory")
        self.assertEqual(manifest["source_transfer_manifest_sha256"], package.sha(transfer))
        self.assertEqual(manifest["base_commit"], proof["base_commit"])
        self.assertTrue((stage / "licenses/index.json").is_file())
        self.assertIn("clean_directory_smoke", manifest["checks"])
        self.assertNotIn("extracted_windows_smoke", manifest["checks"])
        self.assertFalse(list(self.root.rglob("*.zip")))
        app.write_bytes(b"changed source\n")
        with self.assertRaisesRegex(ValueError, "build_source_file_integrity"):
            package.source_revision(self.root, proof)

    def test_checked_copy_preserves_source_and_uses_a_separate_empty_target(self):
        source = self.root / "source"
        self.write("source/release_manifest.json", {"release": "test"})
        original = self.write("source/assets/sample.bin", b"\x00\x01source")
        target = self.root / "copy"
        target.mkdir()
        self.assertEqual(verifier.copy_directory_checked(source, target), {"release_manifest.json", "assets/sample.bin"})
        self.assertEqual(original.read_bytes(), (target / "assets/sample.bin").read_bytes())
        nested = source / "nested"
        nested.mkdir()
        with self.assertRaisesRegex(verifier.VerificationError, "separate_empty_target"):
            verifier.copy_directory_checked(source, nested)
        with self.assertRaisesRegex(verifier.VerificationError, "separate_empty_target"):
            verifier.copy_directory_checked(source, target)

    def test_private_paths_and_key_material_are_rejected_in_directory_mode(self):
        for name, payload, error in [
            (".env", b"fixture", "excluded_environment_secret"),
            ("var/state.json", b"{}", "excluded_private_directory"),
            ("source.txt", b"-----BEGIN PRIVATE KEY-----\nfixture\n", "private_key_material_in_directory"),
        ]:
            with self.subTest(name=name):
                index = len(list(self.root.iterdir()))
                source = self.root / str(index)
                self.write(f"{index}/{name}", payload)
                target = self.root / (str(index) + "-copy")
                target.mkdir()
                with self.assertRaisesRegex(verifier.VerificationError, error):
                    verifier.copy_directory_checked(source, target)

    def test_directory_main_uses_payload_core_and_never_claims_archive_verification(self):
        source = self.root / "source"
        manifest = self.write("source/release_manifest.json", {"release": "test"})
        repository = self.root / "verifier-repo"
        repository.mkdir()
        seen = []

        def payload(target, names):
            seen.append((target, names))
            self.assertNotEqual(target, source)
            return {"release": "test", "files": []}, {}, {}

        with (
            patch.object(verifier, "__file__", str(repository / "deploy/verify_node_release.py")),
            patch.object(verifier, "verify_payload", side_effect=payload),
            patch.object(verifier.shutil, "which", return_value=None),
            patch.object(verifier, "extract_checked", side_effect=AssertionError("ZIP extraction forbidden")),
            redirect_stdout(io.StringIO()),
        ):
            report = verifier.main(directory=source)
        self.assertEqual(len(seen), 1)
        self.assertEqual(report["failure_code"], "Node_executable_not_found")
        self.assertEqual(report["directory_manifest_sha256"], verifier.sha(manifest))
        self.assertEqual(report["input_directory"], str(source))
        self.assertTrue(Path(report["clean_copy"]).is_dir())
        self.assertFalse({"archive", "archive_sha256", "archive_bytes", "extracted"}.intersection(report))
        self.assertIn("no ZIP creation or extraction", report["input_semantics"])
        self.assertFalse(list(self.root.rglob("*.zip")))


if __name__ == "__main__":
    unittest.main()
