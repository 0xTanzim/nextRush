#!/usr/bin/env bash
# Tear down the throwaway Function App deployed by deploy.sh. Always runs
# (even on smoke-test failure) so no billed resource survives the job.
set -euo pipefail

RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:?set AZURE_RESOURCE_GROUP}"
NAME_FILE="/tmp/nextrush-deploy-verify-azure-name"

if [[ ! -f "${NAME_FILE}" ]]; then
  echo "No deployed Function App recorded — nothing to destroy."
  exit 0
fi

FUNCTION_APP_NAME="$(cat "${NAME_FILE}")"
echo "==> Deleting Function App ${FUNCTION_APP_NAME}"
az functionapp delete \
  --name "${FUNCTION_APP_NAME}" \
  --resource-group "${RESOURCE_GROUP}" || true

rm -f "${NAME_FILE}" /tmp/nextrush-deploy-verify-azure-url /tmp/nextrush-deploy-verify-azure.zip
echo "==> Destroyed."
