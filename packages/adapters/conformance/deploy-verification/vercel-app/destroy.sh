#!/usr/bin/env bash
# Tear down the throwaway Vercel project deployed by deploy.sh. Always runs
# (even on smoke-test failure) so no project survives the job.
set -euo pipefail

: "${VERCEL_TOKEN:?set VERCEL_TOKEN}"
PROJECT_FILE="/tmp/nextrush-deploy-verify-vercel-project"

if [[ ! -f "${PROJECT_FILE}" ]]; then
  echo "No deployed project recorded — nothing to destroy."
  exit 0
fi

PROJECT_NAME="$(cat "${PROJECT_FILE}")"
echo "==> Removing Vercel project ${PROJECT_NAME}"
npx --yes vercel@latest project rm "${PROJECT_NAME}" --token="${VERCEL_TOKEN}" --yes || true

rm -f "${PROJECT_FILE}" /tmp/nextrush-deploy-verify-vercel-url
echo "==> Destroyed."
