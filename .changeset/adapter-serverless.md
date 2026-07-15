---
"@nextrush/adapter-serverless": minor
---

New package: `@nextrush/adapter-serverless`.

Brings classic serverless (AWS Lambda / API Gateway, Google Cloud Functions, Azure Functions)
onto the shared `Context` pipeline. The execution model (per-invocation, stateless, warm
`ready()` reuse, per-invocation timeout→504) is shared with the edge adapter; the provider event
format is a generic, adapter-scoped `EventMapper<Event, Result, Ctx>` supplied as an immutable
per-adapter list (no global mutable registry). A new platform is a new mapper — the adapter never
grows a provider `switch`.

**Minimal DX (tiered public API):**

- **Tier 1** — per-provider one-liners: `createLambdaHandler(app)` (Function URL + API Gateway
  v1/v2, auto-detected), `createGoogleHandler(app)`, `createAzureHandler(app)`, and
  `createLambdaStreamingHandler(app)` for true Function URL response streaming
  (`awslambda.streamifyResponse`). Cloudflare's `createCloudflareHandler` ships in
  `@nextrush/adapter-edge`.
- **Tier 2** — the same handlers accept `{ timeout }`.
- **Tier 3 (runtime authors)** — `createServerlessAdapter({ mappers })` + the `EventMapper`
  interface, marked `@advanced`, for adding an unsupported platform (Oracle/Fly.io/OpenFaaS).

Built-in mappers: `lambda-function-url`, `apigw-v2`, `apigw-v1`, `gcf`, `azure` — with base64
bodies, multi-value headers/query, and Set-Cookie handling. Committed golden fixtures exercise the
full `event → mapper → app → mapper → result` chain per provider, and the adapter is a first-class
target in the cross-adapter conformance suite. Ratified in RFC-NEXTRUSH-ADAPTER-SERVERLESS and
ADR-0007.
