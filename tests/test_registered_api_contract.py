import unittest
from unittest.mock import patch

from pydantic import ValidationError

from api.models import ComparisonRequest, Session
from api.service import Service


class RegisteredAPIContractTests(unittest.TestCase):
    def test_request_shape_accepts_registry_identifiers_without_a_two_target_literal(self):
        request = ComparisonRequest(observation_ids=["L001", "L005"])
        session = Session(object_id="barnards-star", observation_ids=request.observation_ids)
        self.assertEqual(session.observation_ids, ["L001", "L005"])

    def test_shape_rejects_duplicate_and_cache_key_or_path_injection(self):
        for ids in [["L001", "L001"], ["../S01", "S02"], ["S01,S02", "S14"], ["", "S01"]]:
            with self.subTest(ids=ids), self.assertRaises(ValidationError):
                ComparisonRequest(observation_ids=ids)

    def test_service_rejects_unregistered_selection_before_creating_a_job(self):
        service = object.__new__(Service)
        with patch.object(service, "resolve_pair", side_effect=ValueError("unregistered_pair")) as resolver:
            with self.assertRaises(ValueError):
                service.submit(["L001", "not-registered"])
            resolver.assert_called_once_with(["L001", "not-registered"])
        self.assertFalse(hasattr(service, "jobs"))

    def test_protected_original_source_closure_is_independent_of_the_new_registry(self):
        service = object.__new__(Service)
        for target, algorithm, ids, calibration in [
            ("epsilon-indi-b", "spherex-native-v1", ["S01", "S02"], "S10"),
            ("pluto", "pluto-native-v1", ["S14", "S12"], "L051"),
        ]:
            comparison = {"object_id": target, "algorithm_version": algorithm,
                          "frames": [{"observation_id": identifier, "provenance": {"id": identifier, "sha256": "a" * 64}, "calibration": {"id": calibration, "sha256": "b" * 64}} for identifier in ids]}
            with self.subTest(target=target), patch.object(service, "resolve_pair", side_effect=AssertionError("legacy must not load registry")):
                self.assertEqual({ref["id"] for ref in service._source_refs(comparison)}, {*ids, calibration})
            comparison["frames"][0]["observation_id"] = "L001"
            with self.assertRaisesRegex(ValueError, "legacy_comparison_selection_mismatch"):
                service._source_refs(comparison)
            comparison["frames"][0]["observation_id"] = ids[0]
            comparison["object_id"] = "wrong-object"
            with self.assertRaisesRegex(ValueError, "legacy_comparison_selection_mismatch"):
                service._source_refs(comparison)


if __name__ == "__main__":
    unittest.main()
