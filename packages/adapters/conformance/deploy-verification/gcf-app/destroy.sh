#!/usr/bin/env bash
# Tear down the throwaway GCF function deployed by deploy.sh. Always runs
# (even on smoke-test failure) so no billed resource survives the job.
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-us-central1}"
NAME_FILE="/tmp/nextrush-deploy-verify-gcf-name"

if [[ ! -f "${NAME_FILE}" ]]; then
  echo "No deployed function recorded — nothing to destroy."
  exit 0
fi

FUNCTION_NAME="$(cat "${NAME_FILE}")"
echo "==> Deleting GCF function ${FUNCTION_NAME}"
gcloud functions delete "${FUNCTION_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --gen2 \
  --quiet || true

rm -f "${NAME_FILE}" /tmp/nextrush-deploy-verify-gcf-url
echo "==> Destroyed."
