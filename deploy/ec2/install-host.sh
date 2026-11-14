#!/usr/bin/env bash
# One-time setup on the user's NEW Ubuntu 24.04 amd64 EC2 instance.
set -euo pipefail
[[ ${EUID} -eq 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
source /etc/os-release
[[ ${ID} == ubuntu && ${VERSION_ID} == 24.04 && $(uname -m) == x86_64 ]] || {
  echo 'This script supports Ubuntu 24.04 amd64 only.' >&2; exit 1;
}
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl xz-utils unzip nginx

# Pin the official binary and digest; never execute a downloaded shell installer.
node_version=v24.22.3
node_archive=node-v24.22.3-linux-x64.tar.xz
node_sha256=4f2b175a6d53a5c617a80dba2676238a0688cef28c6da4eba35c7d844e66fcfb
node_target=/usr/local/lib/planet-x-node-v24.22.3
if [[ ! -x ${node_target}/bin/node ]]; then
  task_tmp=$(mktemp -d)
  trap 'rm -f -- "${task_tmp}/${node_archive}"; rmdir -- "${task_tmp}" 2>/dev/null || true' EXIT
  curl --fail --show-error --location --proto '=https' --tlsv1.2 --max-time 180 \
    "https://nodejs.org/dist/${node_version}/${node_archive}" -o "${task_tmp}/${node_archive}"
  printf '%s  %s\n' "${node_sha256}" "${task_tmp}/${node_archive}" | sha256sum --check --status
  install -d -m 0755 "${node_target}"
  tar --extract --xz --file "${task_tmp}/${node_archive}" --strip-components=1 --directory "${node_target}"
fi
[[ $("${node_target}/bin/node" --version) == "${node_version}" ]]
if [[ -e /usr/local/lib/planet-x-node && ! -L /usr/local/lib/planet-x-node ]]; then
  echo '/usr/local/lib/planet-x-node is an existing non-symlink; inspect manually.' >&2; exit 1
fi
ln -sfn "${node_target}" /usr/local/lib/planet-x-node
id planetx >/dev/null 2>&1 || useradd --system --home-dir /srv/planet-x --shell /usr/sbin/nologin planetx
install -d -m 0755 /srv/planet-x /srv/planet-x/releases
install -d -o planetx -g planetx -m 0750 /srv/planet-x/shared /srv/planet-x/shared/node
install -d -o root -g planetx -m 0750 /etc/planet-x
[[ -e /etc/planet-x/app.env ]] || install -o root -g planetx -m 0640 "${script_dir}/app.env.example" /etc/planet-x/app.env

# Refuse to overwrite configurations edited since a prior installation.
install_new_config() {
  local src=$1 dst=$2
  if [[ -e ${dst} ]] && ! cmp -s -- "${src}" "${dst}"; then
    echo "Existing configuration differs: ${dst}. Review it before replacing." >&2; exit 1
  fi
  install -o root -g root -m 0644 "${src}" "${dst}"
}
install_new_config "${script_dir}/planet-x.service" /etc/systemd/system/planet-x.service
install_new_config "${script_dir}/nginx.conf" /etc/nginx/sites-available/planet-x
if [[ -L /etc/nginx/sites-enabled/default ]]; then
  [[ $(readlink -f /etc/nginx/sites-enabled/default) == /etc/nginx/sites-available/default ]] || {
    echo 'Unexpected nginx default symlink; inspect manually.' >&2; exit 1;
  }
  unlink /etc/nginx/sites-enabled/default
fi
if [[ -e /etc/nginx/sites-enabled/planet-x && ! -L /etc/nginx/sites-enabled/planet-x ]]; then
  echo 'Existing nginx enabled config is not a symlink; inspect manually.' >&2; exit 1
fi
ln -sfn /etc/nginx/sites-available/planet-x /etc/nginx/sites-enabled/planet-x
nginx -t
systemctl daemon-reload
systemctl enable nginx
systemctl reload-or-restart nginx
echo 'Host prepared. App is not running yet. Extract and verify the complete release ZIP, then activate it.'
