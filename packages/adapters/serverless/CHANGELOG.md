# @nextrush/adapter-serverless

## 1.0.1

### Patch Changes

- [`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Prepare the NextRush v4 ecosystem patch release with updates across core, routing, adapters, middleware, utilities, OpenAPI, testing, development tooling, and the create-nextrush scaffolder.

- Updated dependencies [[`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8)]:
  - @nextrush/adapter-edge@1.0.1
  - @nextrush/runtime@4.0.2
  - @nextrush/errors@4.0.2
  - @nextrush/stream@1.0.2
  - @nextrush/types@4.0.2
  - @nextrush/core@4.0.2

## 1.0.0

### Patch Changes

- [`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Consolidated patch release across all NextRush public packages.

- Updated dependencies [[`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9)]:
  - @nextrush/adapter-edge@1.0.0
  - @nextrush/core@4.0.0
  - @nextrush/errors@4.0.0
  - @nextrush/runtime@4.0.0
  - @nextrush/stream@1.0.0
  - @nextrush/types@4.0.0

## 1.0.0-beta.1

### Patch Changes

- Consolidated patch release across all NextRush public packages.

- Updated dependencies []:
  - @nextrush/adapter-edge@1.0.0-beta.2
  - @nextrush/core@4.0.0-beta.2
  - @nextrush/errors@4.0.0-beta.2
  - @nextrush/runtime@4.0.0-beta.2
  - @nextrush/stream@1.0.0-beta.2
  - @nextrush/types@4.0.0-beta.2

## 1.0.0-beta.0

### Minor Changes

- bec1c1d: New package: `@nextrush/adapter-serverless`.

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

### Patch Changes

- Updated dependencies [2820a4c]
- Updated dependencies [eee4462]
- Updated dependencies [793d596]
- Updated dependencies [838367f]
  - @nextrush/types@4.0.0-beta.0
  - @nextrush/adapter-edge@2.0.0-beta.0
  - @nextrush/core@4.0.0-beta.0
  - @nextrush/runtime@4.0.0-beta.0
  - @nextrush/errors@4.0.0-beta.0
  - @nextrush/stream@4.0.0-beta.0
