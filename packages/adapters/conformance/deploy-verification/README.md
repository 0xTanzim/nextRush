# Real-cloud deploy verification (task group 10, extended by task group 5, P2-6/RFC-027)

Proves the built `@nextrush/adapter-serverless` and `@nextrush/adapter-edge` handlers actually
deploy and respond on the real platforms (AWS Lambda, Cloudflare Workers, Vercel Edge, Google
Cloud Functions, Azure Functions) — the conformance suite (`../deno-runner`, `../workerd-runner`,
`../bun-runner`) proves *behavior* in an emulator/real-runtime, not a full platform deploy; this
proves *packaging, IAM/permissions, and platform wiring*, which no emulator can catch.

This is **not a per-PR gate**. Lambda, Cloudflare, Vercel, and GCF run on a schedule (nightly)
and on-demand, via `.github/workflows/deploy-verification.yml`, and are **skipped, not failed**,
when the required
secrets are absent (forks, and any environment without the deploy credentials configured).

## What each app does

| Dir | Deploys | Smoke-tests | Destroys |
|---|---|---|---|
| `lambda-app/` | A real Lambda function + Function URL (`nodejs22.x`, `AuthType: NONE`) | `curl`s the Function URL, asserts `{"ok":true,"runtime":"lambda"}` | Deletes the Function URL config + function |
| `cloudflare-app/` | A real Cloudflare Worker via `wrangler deploy` | `curl`s the `*.workers.dev` URL, asserts `{"ok":true,"runtime":"cloudflare"}` | `wrangler delete` |
| `vercel-app/` | A real Vercel Edge Function via `vercel deploy --prod` | `curl`s the deployment URL's `/api` route, asserts `{"ok":true,"runtime":"vercel"}` | `vercel project rm` on the uniquely-named project |
| `gcf-app/` | A real Google Cloud Function (2nd gen, HTTP trigger, unauthenticated) via `gcloud functions deploy` | `curl`s the Cloud Run service URI, asserts `{"ok":true,"runtime":"gcf"}` | `gcloud functions delete` |
| `azure-app/` | A real Azure Functions app (Consumption plan, Linux, Node 22, v4 model, anonymous auth) via `az functionapp create` + zip deploy | `curl`s the `*.azurewebsites.net/api/api` route, asserts `{"ok":true,"runtime":"azure"}` | `az functionapp delete` |

Every deployed resource is named `nextrush-deploy-verify-<run-id>` and tagged
`ephemeral=true` so a failed teardown is identifiable and cheap to clean up by hand.

## Required secrets (repository/environment secrets — never hardcoded)

| Secret | Used by |
|---|---|
| `AWS_DEPLOY_VERIFY_ROLE_ARN` | GitHub OIDC → AWS role assumed for the Lambda deploy/destroy steps |
| `NEXTRUSH_DEPLOY_VERIFY_LAMBDA_ROLE_ARN` | The Lambda execution role ARN passed to `create-function` |
| `CLOUDFLARE_API_TOKEN` | `wrangler deploy`/`delete` |
| `CLOUDFLARE_ACCOUNT_ID` | `wrangler deploy` |
| `VERCEL_TOKEN` | `vercel deploy`/`project rm` (non-interactive CI auth per Vercel's own CLI docs) |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | GitHub OIDC → GCP workload identity federation for `gcloud` auth |
| `GCP_DEPLOY_VERIFY_SERVICE_ACCOUNT` | The GCP service account impersonated for deploy/destroy |
| `GCP_PROJECT_ID` | Target GCP project for `gcloud functions deploy`/`delete` |
| `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` | GitHub OIDC → Azure login (`azure/login`) for `az` CLI auth |
| `AZURE_RESOURCE_GROUP` | Target resource group for `az functionapp create`/`delete` |
| `AZURE_STORAGE_ACCOUNT` | Storage account backing the Consumption-plan Function App |

> [!WARNING]
> `azure-app/` is currently **scaffolded but not wired into `.github/workflows/deploy-verification.yml`**.
> Adding it to the live nightly schedule requires provisioning the four Azure secrets above (a
> real service principal / OIDC federation setup) and accepting that a new scheduled job
> provisions and tears down real, billable Azure resources on every run. That's an infrastructure
> decision with cost and credential implications outside this change's scope — wire it in
> deliberately, with those secrets configured, rather than assuming CI should pick it up
> automatically. Until then, Azure remains verified via the conformance suite's type/mapper
> tests (`mapper-guards.test.ts`, `azure-bridge.test.ts`) plus this local-only deploy path, not a
> scheduled real-cloud run like the other three platforms.

The workflow checks for these before running any deploy step (see `check-secrets` job) and marks
itself skipped, not failed, when they're missing — each platform's readiness (`aws_ready`,
`cloudflare_ready`, `vercel_ready`, `gcp_ready`) is independent, so a missing GCP secret only
skips `gcf-deploy-verify`, not the other three jobs.

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

## Running the Vercel side locally

```bash
export VERCEL_TOKEN=...
pnpm --filter "@nextrush/adapter-edge..." build
./vercel-app/deploy.sh
./vercel-app/smoke.sh
./vercel-app/destroy.sh
```

## Running the GCF side locally

Requires a local `gcloud` session already authenticated against a project you can deploy to
(`gcloud auth login` + `gcloud config set project <id>`), or a service account key.

```bash
export GCP_PROJECT_ID=<your-project>
pnpm --filter "@nextrush/adapter-serverless..." build
./gcf-app/deploy.sh
./gcf-app/smoke.sh
./gcf-app/destroy.sh
```

`gcf-app/` registers `createGoogleHandler` directly with `functions-framework`
(`functions.http('api', createGoogleHandler(app))`) — the RFC-027 true drop-in, no manual field
bridge. Verified against the mapper/bridge test suites (`google-bridge.test.ts`) before this app
was committed.

## Running the Azure side locally

Requires a local Azure CLI session already authenticated (`az login`) against a subscription you
can deploy to, plus an existing resource group and storage account.

```bash
export AZURE_RESOURCE_GROUP=<your-resource-group>
export AZURE_STORAGE_ACCOUNT=<your-storage-account>
pnpm --filter "@nextrush/adapter-serverless..." build
./azure-app/deploy.sh
./azure-app/smoke.sh
./azure-app/destroy.sh
```

`azure-app/` registers `createAzureHandler` directly with the v4 programming model
(`functions.http('api', { handler: createAzureHandler(app) })`) — the RFC-027 true drop-in, no
manual field bridge. Verified against the mapper/bridge test suites (`azure-bridge.test.ts`)
before this app was committed. See the warning above — this app is not yet wired into the
scheduled CI workflow.

## Safety notes

- Every `destroy.sh` script is idempotent and safe to re-run (`|| true` on the delete calls).
- The CI workflow runs destroy in an `if: always()` step so a failed smoke test still tears the
  resource down.
- Nothing here touches a shared/named production resource — every run creates and destroys its
  own uniquely-named function/worker.
