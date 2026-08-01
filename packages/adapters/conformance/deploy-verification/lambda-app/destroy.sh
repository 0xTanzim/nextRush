#!/usr/bin/env bash
# Tear down the throwaway Lambda deployed by deploy.sh. Always runs (even on
# smoke-test failure) so no billed resource survives the job — see the workflow's
# `if: always()` step.
set -euo pipefail

REGION="${AWS_REGION:?set AWS_REGION}"
NAME_FILE="/tmp/nextrush-deploy-verify-lambda-name"

if [[ ! -f "${NAME_FILE}" ]]; then
  echo "No deployed function recorded — nothing to destroy."
  exit 0
fi

FUNCTION_NAME="$(cat "${NAME_FILE}")"
echo "==> Deleting Function URL config for ${FUNCTION_NAME}"
aws lambda delete-function-url-config --region "${REGION}" --function-name "${FUNCTION_NAME}" || true

echo "==> Deleting function ${FUNCTION_NAME}"
aws lambda delete-function --region "${REGION}" --function-name "${FUNCTION_NAME}" || true

rm -f "${NAME_FILE}" /tmp/nextrush-deploy-verify-lambda-url
echo "==> Destroyed."
