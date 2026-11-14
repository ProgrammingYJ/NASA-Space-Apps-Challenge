"""Read-only MCP protocol smoke; developer tools are isolated from the app.

Run with .tools/mcp/pds-venv/Scripts/python.exe on Windows after installing
the pinned development tools described in docs/reviews/2026-11-15_mcp_review.md.
No credentials are read from project configuration or sent by this script.
"""
import asyncio
import datetime
import hashlib
import json
import os
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parents[2]
LOCAL = ROOT / ".tools/mcp"
OUT = ROOT / "var/qa/dev018/mcp"


async def check(name, command, args, tool, arguments, extra_env=None):
    result = {
        "server": name,
        "started_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "tool": tool,
        "arguments": arguments,
        "status": "failed",
        "adoption": "development protocol check only; not a product observation",
    }
    # Supply the minimum OS environment, avoiding inheritance of API keys.
    env = {k: os.environ[k] for k in ("PATH", "SystemRoot", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA") if k in os.environ}
    env.update(extra_env or {})
    params = StdioServerParameters(command=str(command), args=list(map(str, args)), env=env, cwd=str(ROOT))
    try:
        async with asyncio.timeout(55):
            with (OUT / f"{name}.stderr.txt").open("w", encoding="utf-8") as errors:
                async with stdio_client(params, errlog=errors) as (read, write):
                    async with ClientSession(read, write) as session:
                        initialized = await session.initialize()
                        result["initialize"] = initialized.model_dump(mode="json", exclude_none=True)
                        listed = await session.list_tools()
                        result["tools_list"] = listed.model_dump(mode="json", exclude_none=True)
                        response = await session.call_tool(tool, arguments)
                        result["response"] = response.model_dump(mode="json", exclude_none=True)
                        result["status"] = "tool_error" if getattr(response, "is_error", getattr(response, "isError", False)) else "protocol_call_completed"
    except BaseException as error:
        result["error"] = repr(error)
    result["finished_at_utc"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    data = (json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    path = OUT / f"{name}.json"
    path.write_bytes(data)
    print(json.dumps({"server": name, "status": result["status"], "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "tools": [x["name"] for x in result.get("tools_list", {}).get("tools", [])], "error": result.get("error")}), flush=True)


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    node = LOCAL / "node-v24.22.3-win-x64/node.exe"
    modules = LOCAL / "node-tools/node_modules"
    await asyncio.gather(
        check("pipeworx", node, [modules / "@pipeworx/mcp-horizons-nasa/bin/cli.js"], "vectors", {"command": "999", "center": "500@10", "start_time": "2026-11-14", "stop_time": "2026-11-15", "step_size": "1d"}, {"PIPEWORX_TIMEOUT_MS": "30000"}),
        check("pds", LOCAL / "pds-venv/Scripts/python.exe", ["-m", "pds_mcp_server"], "search_targets", {"keywords": "Sedna", "limit": 3}),
        check("astronomy", node, [modules / "@cyanheads/astronomy-mcp-server/dist/index.js"], "astronomy_get_sky_position", {"body": "pluto", "time": "2026-11-14T00:00:00Z", "latitude": 37.5665, "longitude": 126.978}, {"MCP_TRANSPORT_TYPE": "stdio", "MCP_LOG_LEVEL": "warning", "OTEL_ENABLED": "false", "ASTRONOMY_ENABLE_HORIZONS": "false", "ASTRONOMY_ENABLE_SATELLITES": "false"}),
    )


if __name__ == "__main__":
    asyncio.run(main())
