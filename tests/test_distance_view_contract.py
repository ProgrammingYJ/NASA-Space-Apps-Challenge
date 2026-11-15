import copy
import unittest

from pydantic import ValidationError

from api.models import DistanceView, UniverseContext


class DistanceViewContractTests(unittest.TestCase):
    def context(self, **updates):
        return {
            "selected_object_id": "epsilon-indi-b",
            "model_epoch": "2026-11-14T00:00:00Z",
            "source_manifest_sha256": "a" * 64,
            "camera": {
                "position": [0, 65, 100],
                "target": [0, 0, 0],
                "representation_version": "solar-display-v1",
            },
            **updates,
        }

    def test_missing_distance_view_preserves_legacy_camera_interpretation(self):
        payload = self.context()
        before = copy.deepcopy(payload)
        context = UniverseContext.model_validate(payload)
        self.assertIsNone(context.distance_view)
        self.assertEqual(context.camera.position, (0, 65, 100))
        self.assertEqual(context.camera.representation_version, "solar-display-v1")
        self.assertEqual(payload, before)
        self.assertNotIn("distance_view", context.model_dump(exclude_unset=True))

    def test_explicit_linear_view_roundtrips_large_camera_and_origin_without_mutation(self):
        payload = self.context(
            distance_view={
                "algorithm_version": "parent-linear-distance-v1",
                "origin_object_id": "earth",
            },
            camera={
                "position": [10000000, 0, 25],
                "target": [10000000, 0, 0],
                "representation_version": "solar-display-v1",
            },
        )
        before = copy.deepcopy(payload)
        context = UniverseContext.model_validate(payload)
        restored = UniverseContext.model_validate_json(context.model_dump_json())
        self.assertEqual(restored.distance_view.origin_object_id, "earth")
        self.assertEqual(restored.camera.position, (10000000, 0, 25))
        self.assertEqual(payload, before)

    def test_only_an_explicit_linear_view_relaxes_camera_bounds(self):
        camera = {
            "position": [10000000, 0, 25],
            "target": [10000000, 0, 0],
            "representation_version": "solar-display-v1",
        }
        for view in [
            None,
            {"algorithm_version": "legacy-expanded-v1"},
            {"algorithm_version": "solar-overview-common-v2"},
        ]:
            with self.subTest(view=view), self.assertRaises(ValidationError):
                UniverseContext.model_validate(
                    self.context(camera=camera, distance_view=view)
                )

    def test_linear_origin_is_required_and_nonlocal_origins_are_rejected(self):
        for value in [
            {"algorithm_version": "parent-linear-distance-v1"},
            {"algorithm_version": "parent-linear-distance-v1", "origin_object_id": ""},
            {"algorithm_version": "parent-linear-distance-v1", "origin_object_id": " "},
            {"algorithm_version": "solar-overview-common-v2", "origin_object_id": "earth"},
            {"algorithm_version": "legacy-expanded-v1", "origin_object_id": "earth"},
            {"algorithm_version": "unknown"},
        ]:
            with self.subTest(value=value), self.assertRaises(ValidationError):
                DistanceView.model_validate(value)

    def test_local_cameras_still_reject_nonfinite_extreme_or_degenerate_values(self):
        view = {
            "algorithm_version": "parent-linear-distance-v1",
            "origin_object_id": "earth",
        }
        for position, target in [
            ([1e8, 0, 0], [0, 0, 0]),
            ([0, 0, 0], [1e8, 0, 0]),
            ([float("nan"), 0, 25], [0, 0, 0]),
            ([1, 0, 0], [1, 0, 0]),
        ]:
            with self.subTest(position=position), self.assertRaises(ValidationError):
                UniverseContext.model_validate(
                    self.context(
                        distance_view=view,
                        camera={
                            "position": position,
                            "target": target,
                            "representation_version": "solar-display-v1",
                        },
                    )
                )


if __name__ == "__main__":
    unittest.main()
