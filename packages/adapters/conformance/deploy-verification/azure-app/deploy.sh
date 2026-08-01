#!/usr/bin/env bash
# Deploy the throwaway Azure Functions app for scheduled deploy verification
# (P2-6 / RFC-027). Requires an Azure service principal / OIDC session (via
# azure/login in CI, or a local `az login`) plus AZURE_RESOURCE_GROUP and
# AZURE_STORAGE_ACCOUNT. Mirrors ../gcf-app/deploy.sh's structure — a real,
# temporary Function App, deployed and later destroyed.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FUNCTION_APP_NAME="nextrush-deploy-verify-${GITHUB_RUN_ID:-local}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:?set AZURE_RESOURCE_GROUP}"
STORAGE_ACCOUNT="${AZURE_STORAGE_ACCOUNT:?set AZURE_STORAGE_ACCOUNT}"
REGION="${AZURE_REGION:-eastus}"

echo "==> Creating Function App ${FUNCTION_APP_NAME} (resource group ${RESOURCE_GROUP}, region ${REGION})"
az functionapp create \
  --name "${FUNCTION_APP_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --storage-account "${STORAGE_ACCOUNT}" \
  --consumption-plan-location "${REGION}" \
  --runtime node \
  --runtime-version 22 \
  --functions-version 4 \
  --os-type Linux \
  --tags purpose=nextrush-deploy-verification ephemeral=true

echo "==> Publishing ${APP_DIR}"
(
  cd "${APP_DIR}"
  npm install --omit=dev
  zip -r -q /tmp/nextrush-deploy-verify-azure.zip .
)
az functionapp deployment source config-zip \
  --name "${FUNCTION_APP_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --src /tmp/nextrush-deploy-verify-azure.zip

FN_URL="https://${FUNCTION_APP_NAME}.azurewebsites.net/api/api"

echo "${FUNCTION_APP_NAME}" > /tmp/nextrush-deploy-verify-azure-name
echo "${FN_URL}" > /tmp/nextrush-deploy-verify-azure-url
echo "==> Deployed: ${FN_URL}"
