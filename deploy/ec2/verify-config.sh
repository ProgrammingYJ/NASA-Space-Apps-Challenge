#!/usr/bin/env bash
# Read-only syntax/configuration checks; does not install or start any service.
set -euo pipefail
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
bash -n "${script_dir}/install-host.sh"
bash -n "${script_dir}/activate-release.sh"
task_dir=$(mktemp -d /tmp/planet-x-nginx-check.XXXXXX)
trap 'rm -f -- "${task_dir}/nginx.conf" "${task_dir}/nginx.pid"; rmdir -- "${task_dir}" 2>/dev/null || true' EXIT
{
  printf 'pid %s/nginx.pid;\nerror_log stderr;\nevents {}\nhttp {\n access_log off;\n' "${task_dir}"
  cat "${script_dir}/nginx.conf"
  printf '\n}\n'
} > "${task_dir}/nginx.conf"
nginx -t -p "${task_dir}" -c "${task_dir}/nginx.conf"
printf 'Shell syntax and nginx isolated configuration: PASS\n'
