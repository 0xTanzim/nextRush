#!/usr/bin/env bash
# Smoke-test the deployed Azure Functions app (P2-6 / RFC-027). Not a
# behavior test — the conformance suite already covers that; this proves
# packaging + the v4 drop-in + platform wiring on the real service.
set -euo pipefail

URL_FILE="/tmp/nextrush-deploy-verify-azure-url"
if [[ ! -f "${URL_FILE}" ]]; then
  echo "No deployed Azure Function URL found — deploy.sh must run first." >&2
  exit 1
fi

URL="$(cat "${URL_FILE}")"
echo "==> Smoke-testing ${URL}"

for attempt in 1 2 3 4 5; do
  BODY="$(curl -sf "${URL}")" && break
  echo "attempt ${attempt} failed, retrying in 5s..."
  sleep 5
done

if [[ -z "${BODY:-}" ]]; then
  echo "Smoke test FAILED: no response after retries" >&2
  exit 1
fi

echo "Response: ${BODY}"

if ! echo "${BODY}" | grep -q '"ok":true'; then
  echo "Smoke test FAILED: unexpected response body" >&2
  exit 1
fi

if ! echo "${BODY}" | grep -q '"runtime":"azure"'; then
  echo "Smoke test FAILED: runtime field missing/wrong" >&2
  exit 1
fi

echo "==> Smoke test PASSED"
