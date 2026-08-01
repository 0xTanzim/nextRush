#!/usr/bin/env bash
# Tear down the throwaway Worker deployed by deploy.sh (always runs).
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"
NAME_FILE="/tmp/nextrush-deploy-verify-worker-name"

if [[ ! -f "${NAME_FILE}" ]]; then
  echo "No deployed worker recorded — nothing to destroy."
  exit 0
fi

WORKER_NAME="$(cat "${NAME_FILE}")"
echo "==> Deleting worker ${WORKER_NAME}"
npx --yes wrangler@4 delete --name "${WORKER_NAME}" --force || true

rm -f "${NAME_FILE}" /tmp/nextrush-deploy-verify-worker-url
echo "==> Destroyed."
