# Real-cloud deploy verification (task group 10)

Proves the built `@nextrush/adapter-serverless` and `@nextrush/adapter-edge` handlers actually
deploy and respond on the real platforms (AWS Lambda, Cloudflare Workers) — the conformance suite
(`../deno-runner`, `../workerd-runner`) proves *behavior* in an emulator; this proves *packaging,
IAM/permissions, and platform wiring*, which no emulator can catch.

This is **not a per-PR gate**. It runs on a schedule (nightly) and on-demand, via
`.github/workflows/deploy-verification.yml`, and is **skipped, not failed**, when the required
secrets are absent (forks, and any environment without the deploy credentials configured).

## What each app does

| Dir | Deploys | Smoke-tests | Destroys |
|---|---|---|---|
| `lambda-app/` | A real Lambda function + Function URL (`nodejs22.x`, `AuthType: NONE`) | `curl`s the Function URL, asserts `{"ok":true,"runtime":"lambda"}` | Deletes the Function URL config + function |
| `cloudflare-app/` | A real Cloudflare Worker via `wrangler deploy` | `curl`s the `*.workers.dev` URL, asserts `{"ok":true,"runtime":"cloudflare"}` | `wrangler delete` |

Every deployed resource is named `nextrush-deploy-verify-<run-id>` and tagged
`ephemeral=true` so a failed teardown is identifiable and cheap to clean up by hand.

## Required secrets (repository/environment secrets — never hardcoded)

| Secret | Used by |
|---|---|
| `AWS_DEPLOY_VERIFY_ROLE_ARN` | GitHub OIDC → AWS role assumed for the Lambda deploy/destroy steps |
| `NEXTRUSH_DEPLOY_VERIFY_LAMBDA_ROLE_ARN` | The Lambda execution role ARN passed to `create-function` |
| `CLOUDFLARE_API_TOKEN` | `wrangler deploy`/`delete` |
| `CLOUDFLARE_ACCOUNT_ID` | `wrangler deploy` |

The workflow checks for these before running any deploy step (see `check-secrets` job) and marks
itself skipped, not failed, when they're missing.

## Running the AWS side locally

```bash
export AWS_REGION=us-east-1
export NEXTRUSH_DEPLOY_VERIFY_LAMBDA_ROLE_ARN=arn:aws:iam::<account>:role/<role>
# assumes your local AWS credentials/profile already has lambda:* + iam:PassRole
pnpm --filter "@nextrush/adapter-serverless..." build
./lambda-app/deploy.sh
./lambda-app/smoke.sh
./lambda-app/destroy.sh   # always run, even after a failed smoke test
```

## Running the Cloudflare side locally

```bash
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
pnpm --filter "@nextrush/adapter-edge..." build
./cloudflare-app/deploy.sh
./cloudflare-app/smoke.sh
./cloudflare-app/destroy.sh
```

## Safety notes

- Both `destroy.sh` scripts are idempotent and safe to re-run (`|| true` on the delete calls).
- The CI workflow runs destroy in an `if: always()` step so a failed smoke test still tears the
  resource down.
- Nothing here touches a shared/named production resource — every run creates and destroys its
  own uniquely-named function/worker.
