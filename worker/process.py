"""A pipe keeps computation and lifecycle reports separate from state files."""

import time
from pathlib import Path


def run(connection, root: str):
    from science.registered_observations import (
        build_registered_comparison,
        list_registered_observations,
        load_registry,
        resolve_registered_pair,
    )
    from science.spherex import build_comparison

    root_path = Path(root)
    registry_path = root_path / "data/manifests/observation_registry.json"

    try:
        registry = load_registry(root=root_path, registry_path=registry_path)
        for object_id in registry["objects"]:
            try:
                observations = list_registered_observations(object_id, root=root_path, registry_path=registry_path)
                connection.send({"kind": "registered_catalog", "object_id": object_id, "observations": observations})
            except Exception as exc:  # noqa: BLE001 -- isolate one source-catalogue failure
                connection.send({"kind": "registered_catalog_error", "object_id": object_id, "code": type(exc).__name__})
        while True:
            connection.send({"kind": "heartbeat", "at": time.time()})
            if not connection.poll(1):
                continue
            task = connection.recv()
            if task is None:
                return
            try:
                ids = task["observation_ids"]
                selection = resolve_registered_pair(ids, root=root_path, registry_path=registry_path, object_id=task.get("object_id"))
                if set(ids) == {"S12", "S14"}:
                    from science.pluto import build_pluto_comparison

                    result = build_pluto_comparison(root_path, ids)
                elif set(ids) == {"S01", "S02"}:
                    result = build_comparison(root_path, ids)
                else:
                    result = build_registered_comparison(ids, root=root_path, registry_path=registry_path, object_id=selection["object_id"], cutout_size=81)
                if result.get("object_id") != selection["object_id"] or result.get("algorithm_version") != selection["algorithm_version"]:
                    raise ValueError("registered_builder_selection_mismatch")
                connection.send(
                    {
                        "kind": "result",
                        "job_id": task["job_id"],
                        "attempt_id": task["attempt_id"],
                        "result": result,
                    }
                )
            except Exception as exc:  # noqa: BLE001 -- isolate failure of one scientific task
                # No absolute filesystem paths or private diagnostic text over HTTP.
                connection.send(
                    {
                        "kind": "error",
                        "job_id": task["job_id"],
                        "attempt_id": task["attempt_id"],
                        "code": type(exc).__name__,
                    }
                )
    except (EOFError, BrokenPipeError, OSError):
        return
    finally:
        connection.close()
