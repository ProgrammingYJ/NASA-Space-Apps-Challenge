"""A pipe keeps computation and lifecycle reports separate from state files."""

import time
from pathlib import Path


def run(connection, root: str):
    from science.spherex import build_comparison, list_observations

    try:
        try:
            connection.send({"kind": "catalog", "observations": list_observations(Path(root))})
        except Exception as exc:  # noqa: BLE001 -- preserve worker for actionable job failure
            connection.send({"kind": "catalog_error", "code": type(exc).__name__})
        try:
            from science.pluto import list_pluto_observations

            connection.send(
                {"kind": "pluto_catalog", "observations": list_pluto_observations(Path(root))}
            )
        except Exception as exc:  # noqa: BLE001 -- preserve existing epsilon route
            connection.send({"kind": "pluto_catalog_error", "code": type(exc).__name__})
        while True:
            connection.send({"kind": "heartbeat", "at": time.time()})
            if not connection.poll(1):
                continue
            task = connection.recv()
            if task is None:
                return
            try:
                if task.get("object_id") == "pluto":
                    from science.pluto import build_pluto_comparison

                    result = build_pluto_comparison(Path(root), task["observation_ids"])
                else:
                    result = build_comparison(Path(root), task["observation_ids"])
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
