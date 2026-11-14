#!/usr/bin/env bash
# Activate an already extracted, verified complete ZIP; preserve shared state.
set -euo pipefail
[[ ${EUID} -eq 0 && $# -eq 1 ]] || { echo 'Usage: sudo bash activate-release.sh /srv/planet-x/releases/RELEASE' >&2; exit 1; }
release=$(realpath -e -- "$1")
[[ ${release} == /srv/planet-x/releases/* && ${release} != /srv/planet-x/releases/ ]] || { echo 'Release must be beneath /srv/planet-x/releases.' >&2; exit 1; }
[[ -f ${release}/app.js && -f ${release}/release_manifest.json ]] || { echo 'Incomplete release.' >&2; exit 1; }
node=/usr/local/lib/planet-x-node/bin/node
# Validate switch targets and application-user access before stopping the old app.
for target in /srv/planet-x/current /srv/planet-x/current.next; do
  if [[ ( -e ${target} || -L ${target} ) && ! -L ${target} ]]; then
    printf 'Switch path must be a symlink or absent: %s\n' "${target}" >&2; exit 1
  fi
done
runuser -u planetx -- "${node}" "${release}/deploy/ec2/verify-manifest.cjs" "${release}"
(cd -- "${release}" && runuser -u planetx -- "${node}" app.js --verify-sources)
# Only the dedicated service writes state. Stop the old writer before switching.
previous=''
if [[ -L /srv/planet-x/current ]]; then previous=$(readlink -f /srv/planet-x/current); fi
systemctl stop planet-x.service
ln -sfn "${release}" /srv/planet-x/current.next
mv -Tf /srv/planet-x/current.next /srv/planet-x/current
systemctl enable planet-x.service
systemctl start planet-x.service
for ((attempt=0; attempt<45; attempt++)); do
  if curl --fail --silent --max-time 5 http://127.0.0.1:3002/health/ready; then
    printf '\nActivated %s\nPrevious release: %s\n' "${release}" "${previous:-none}"
    exit 0
  fi
  sleep 2
done
echo 'Readiness failed. Inspect journalctl -u planet-x. Shared state was preserved.' >&2
printf 'Previous release: %s\n' "${previous:-none}" >&2
exit 1
