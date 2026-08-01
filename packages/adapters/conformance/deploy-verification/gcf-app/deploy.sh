#!/usr/bin/env bash
# Deploy the throwaway GCF app for scheduled deploy verification (task group
# 5). Requires GCP credentials (via google-github-actions/auth in CI, or a
# local `gcloud auth` session) and GCP_PROJECT_ID. Mirrors ../lambda-app/deploy.sh's
# structure — a real, temporary Cloud Function, deployed and later destroyed.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/gcf-app" && pwd)"
FUNCTION_NAME="nextrush-deploy-verify-${GITHUB_RUN_ID:-local}"
REGION="${GCP_REGION:-us-central1}"
PROJECT_ID="${GCP_PROJECT_ID:?set GCP_PROJECT_ID}"

echo "==> Deploying ${FUNCTION_NAME} to GCF (project ${PROJECT_ID}, region ${REGION})"
gcloud functions deploy "${FUNCTION_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --runtime=nodejs22 \
  --source="${APP_DIR}" \
  --entry-point=api \
  --trigger-http \
  --allow-unauthenticated \
  --gen2 \
  --timeout=10s \
  --labels="purpose=nextrush-deploy-verification,ephemeral=true"

FN_URL="$(gcloud functions describe "${FUNCTION_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --gen2 \
  --format='value(serviceConfig.uri)')"

echo "${FUNCTION_NAME}" > /tmp/nextrush-deploy-verify-gcf-name
echo "${FN_URL}" > /tmp/nextrush-deploy-verify-gcf-url
echo "==> Deployed: ${FN_URL}"
