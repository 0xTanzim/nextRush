#!/usr/bin/env bash
# Deploy the throwaway Cloudflare Worker for scheduled deploy verification
# (task 10.1/10.2). Requires CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID as
# CI secrets — never hardcoded.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/cloudflare-app" && pwd)"
WORKER_NAME="nextrush-deploy-verify-${GITHUB_RUN_ID:-local}"

: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"
: "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}"

pushd "${APP_DIR}" >/dev/null
npx --yes wrangler@4 deploy --name "${WORKER_NAME}" --compatibility-date 2026-01-01
WORKER_URL="https://${WORKER_NAME}.$(npx --yes wrangler@4 whoami 2>/dev/null | grep -oP '(?<=workers\.dev subdomain: )\S+' || echo "${CLOUDFLARE_ACCOUNT_ID}").workers.dev"
popd >/dev/null

echo "${WORKER_NAME}" > /tmp/nextrush-deploy-verify-worker-name
echo "${WORKER_URL}" > /tmp/nextrush-deploy-verify-worker-url
echo "==> Deployed: ${WORKER_URL}"
