#!/usr/bin/env bash
# Deploy the throwaway Vercel Edge Function app for scheduled deploy
# verification (task group 5). Requires VERCEL_TOKEN as a CI secret — never
# hardcoded. Mirrors ../cloudflare-app/deploy.sh's structure.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/vercel-app" && pwd)"
PROJECT_NAME="nextrush-deploy-verify-${GITHUB_RUN_ID:-local}"

: "${VERCEL_TOKEN:?set VERCEL_TOKEN}"

pushd "${APP_DIR}" >/dev/null

# Link to a fresh, uniquely-named project (non-interactive: --yes accepts all
# defaults, --project names it so destroy.sh can remove exactly this project).
npx --yes vercel@latest link --token="${VERCEL_TOKEN}" --yes --project "${PROJECT_NAME}" >/dev/null

# Deploy to production (edge functions are only invocable on a real
# deployment, not a preview-gated one) and capture the returned URL.
DEPLOY_URL="$(npx --yes vercel@latest deploy --token="${VERCEL_TOKEN}" --yes --prod 2>&1 | tail -1)"

popd >/dev/null

echo "${PROJECT_NAME}" > /tmp/nextrush-deploy-verify-vercel-project
echo "${DEPLOY_URL}" > /tmp/nextrush-deploy-verify-vercel-url
echo "==> Deployed: ${DEPLOY_URL}"
