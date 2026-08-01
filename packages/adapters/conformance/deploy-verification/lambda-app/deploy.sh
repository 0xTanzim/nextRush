#!/usr/bin/env bash
# Deploy the throwaway Lambda Function URL app for scheduled deploy verification
# (openspec/changes/harden-runtime-edge-serverless, task 10.1/10.2).
#
# Creates a real, temporary Lambda function + Function URL. Always paired with
# destroy.sh in the same job — nothing here is meant to persist.
#
# Requires (as environment/secrets, never hardcoded):
#   AWS_REGION           - target region, e.g. us-east-1
#   AWS credentials       - via the standard AWS SDK env vars / OIDC role, set up
#                           by the calling CI step (configure-aws-credentials)
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/lambda-app" && pwd)"
FUNCTION_NAME="nextrush-deploy-verify-${GITHUB_RUN_ID:-local}"
ROLE_ARN="${NEXTRUSH_DEPLOY_VERIFY_LAMBDA_ROLE_ARN:?set NEXTRUSH_DEPLOY_VERIFY_LAMBDA_ROLE_ARN}"
REGION="${AWS_REGION:?set AWS_REGION}"

echo "==> Bundling ${APP_DIR}"
WORKDIR="$(mktemp -d)"
cp "${APP_DIR}/handler.mjs" "${WORKDIR}/"
# Resolve the two runtime deps from the built workspace dist so the zip is self-contained.
node --input-type=module -e "
  import { mkdirSync, cpSync } from 'node:fs';
  import { join, dirname } from 'node:path';
  const root = process.argv[1];
  const out = process.argv[2];
  for (const pkg of ['@nextrush/core', '@nextrush/adapter-serverless', '@nextrush/errors', '@nextrush/types', '@nextrush/runtime', '@nextrush/adapter-edge', '@nextrush/stream']) {
    const src = join(root, 'node_modules', pkg);
    const dest = join(out, 'node_modules', pkg);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest, { recursive: true, dereference: true });
  }
" "$(cd "${APP_DIR}/../../../../.." && pwd)" "${WORKDIR}"

pushd "${WORKDIR}" >/dev/null
zip -qr function.zip .
popd >/dev/null

echo "==> Creating function ${FUNCTION_NAME} in ${REGION}"
aws lambda create-function \
  --region "${REGION}" \
  --function-name "${FUNCTION_NAME}" \
  --runtime nodejs22.x \
  --handler handler.handler \
  --role "${ROLE_ARN}" \
  --zip-file "fileb://${WORKDIR}/function.zip" \
  --timeout 10 \
  --tags "purpose=nextrush-deploy-verification,ephemeral=true"

aws lambda wait function-active --region "${REGION}" --function-name "${FUNCTION_NAME}"

echo "==> Creating Function URL"
FN_URL=$(aws lambda create-function-url-config \
  --region "${REGION}" \
  --function-name "${FUNCTION_NAME}" \
  --auth-type NONE \
  --query 'FunctionUrl' --output text)

aws lambda add-permission \
  --region "${REGION}" \
  --function-name "${FUNCTION_NAME}" \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal '*' \
  --function-url-auth-type NONE >/dev/null

echo "${FUNCTION_NAME}" > /tmp/nextrush-deploy-verify-lambda-name
echo "${FN_URL}" > /tmp/nextrush-deploy-verify-lambda-url
echo "==> Deployed: ${FN_URL}"
