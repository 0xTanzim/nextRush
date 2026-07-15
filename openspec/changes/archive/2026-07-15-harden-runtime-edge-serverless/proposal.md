## Why

NextRush's runtime core is Web-Platform-only and edge-first *by construction*, but three gaps keep that promise unenforced and unproven, and block a credible serverless story:

1. **The adapter model is a convention, not a contract.** The runtime audit (`docs/audits/07-runtime-architecture.md`) tags the two-tier `ServerAdapter`/`FetchAdapter` model `[CURRENT/FORMALIZED]` — it works, but nothing typed *enforces* it. A new or edited adapter can silently widen `Context`, skip capability negotiation, or diverge in observable behavior with no compile-time or CI signal.
2. **"Edge-ready" is asserted, not proven.** The conformance suite runs under Node/vitest only. Per the production roadmap (`02`, R-1 / P0-1) and `07` (T003/T019/T021), no adapter is currently exercised on its real runtime, so edge parity is an unverified claim. Everything downstream (bundle budget, serverless) is unprovable until this is fixed — it is the roadmap's critical-path first domino.
3. **There is no classic-serverless adapter.** Lambda/GCF/Azure work only via a user-built bridge (`07` serverless section, `02` R-6 / P2-1 / T038). NextRush claims serverless-native but ships no `event → Request` bridge, container-reuse pattern, or cold-start proof.

The design review (`06`) confirms the runtime *architecture* is already the framework's strongest dimension (≈8.3/10) — so this change **hardens and proves** an already-sound design rather than redesigning it. Doing it before adoption freezes the adapter contract is far cheaper than after.

## What Changes

- **Formalize the two adapter contracts as enforced, typed interfaces.** Promote `ServerAdapter` and `FetchAdapter` (plus a shared `AdapterContextFactory`) from informal shapes to exported `@nextrush/types` contracts, each backed by a compile-time conformance guard. Retrofit the `node`, `bun`, `deno`, and `edge` adapters. **BREAKING** (adapter authors must satisfy the typed contract; batched into the planned major with a migration guide + codemod where mechanical).
- **Make capability negotiation the enforced seam.** Require capability decisions to branch on `RuntimeCapabilities` via `getRuntimeCapabilities()`; add a lint rule + test that forbids `runtime === 'x'` branching for capability decisions (platform-specific *optimizations* allowlisted). Unknown Web-standard runtimes must work via `probeCapabilities()` with zero code change.
- **Prove edge on real runtimes in CI.** Run the existing `adapter-conformance` suite on real `workerd`/miniflare and real Deno — executed in Docker containers and validated locally with `act` — not simulated under Node.
- **Budget the edge bundle.** Add a CI size gate asserting the minimal functional edge bundle (core + router + adapter-edge, reflect-metadata-free, `sideEffects:false`) stays under the tightest platform limit (Cloudflare Workers 1 MB) with a tighter internal target.
- **Ship `@nextrush/adapter-serverless` with a generic, adapter-scoped `EventMapper` registry.** A new `FetchAdapter`-shaped package (`createServerlessAdapter({ mappers, provider? })`) that separates the **execution model** (per-invocation, stateless, warm-instance reuse, timeout→504) from the **provider event format**. Event formats are generically-typed `EventMapper<Event, Result, Ctx>` plugins passed as an **immutable per-adapter list** — no global registry (a global one would be global mutable state, which `global-rules.instructions.md` §2 forbids). Built-ins for AWS API Gateway v1/v2, Lambda Function URL (streaming), GCF, and Azure are just mappers a user includes; a new platform (Oracle, Fly.io, OpenFaaS) is added by passing its mapper, with **zero adapter modification**. Selection is explicit-first: `provider` wins; `detect()` runs only when omitted. Layering: `Runtime Core → Adapter (execution model) → EventMapper (event format) → Platform`.
- **Expose minimal DX: per-provider one-liner handlers hide the internal architecture (three tiers).** The `EventMapper`/registry is *internal architecture*, not developer API — 95% of users deploy to a named platform, they do not "configure a mapper registry." So the serverless adapter's **primary** public surface is a per-provider Tier-1 handler that auto-configures everything:

  ```ts
  // Tier 1 — 95% of users, zero config, zero framework knowledge
  import { createLambdaHandler } from '@nextrush/adapter-serverless';
  export const handler = createLambdaHandler(app);
  // + createGoogleHandler(app) · createAzureHandler(app)
  // + createCloudflareHandler(app) already ships in @nextrush/adapter-edge
  ```

  - **Tier 1 (95%)**: `createLambdaHandler(app)` / `createGoogleHandler(app)` / `createAzureHandler(app)`. No `mappers`, no `provider`, no `EventMapper` — the handler wires the right mapper(s) internally (Lambda auto-detects Function URL vs API Gateway).
  - **Tier 2 (4%)**: the same handlers take an options object — `createLambdaHandler(app, { timeout: 5000, streaming: true })`. Tuning only; still no architecture exposed.
  - **Tier 3 (1%, runtime authors)**: `createServerlessAdapter({ mappers })` + the `EventMapper` interface stay exported but are marked **`@advanced` / "Runtime authors only"** in JSDoc + docs — the extension SDK for Oracle/Fly.io/OpenFaaS/internal platform teams, not application developers.

  **Architectural rule this establishes:** *internal complexity must never become user complexity.* The sophisticated internals (capability negotiation, adapter contracts, EventMappers, conformance/certification) stay; the public surface a normal user sees is `createLambdaHandler(app)` and nothing more — the Next.js/React discipline of hiding the engine.
- **Verify the full platform chain, not just Request→Response.** Ship committed golden fixtures per provider (`fixtures/<provider>/event.json` + `expected-result.json`) exercising `Platform Event → EventMapper → app.callback() → Response → Platform Result`, run in CI.
- **Publish a runtime certification matrix + named capability profiles.** Derive a feature×runtime coverage matrix (Request, Streaming, AbortSignal, Cookies, Multipart, SSE, Compression, WebSockets, Shutdown, Timeouts) with a per-runtime score from the conformance suite, and expose named `CapabilityProfile`s (Node/Cloudflare/Lambda/Deno/…) derived from `capabilitiesFor()` for defaults + debugging — turning "supports X" into a precise, documented capability statement.
- **Add scheduled real-cloud deploy verification.** A nightly / pre-release `deploy → smoke test → destroy` workflow against real Lambda and Cloudflare, secret-gated and off the per-PR path — because emulators cannot catch platform packaging, cold-start, or IAM/route wiring failures.
- **Ship an Adapter Development Kit.** `nextrush generate adapter <name>` (extending the existing `@nextrush/dev` generator suite) scaffolds a contract-conformant adapter — `adapter.ts` with the `satisfies` guard, a `conformance.test.ts` wired to the shared conformance suite, `fixtures/`, README, and a CI snippet — so a third-party runtime starts *certifiable from day one*. The conformance suite becomes consumable by external authors via a testing-tier entrypoint.
- **Ratify with an ADR + docs.** Record the enforced two-tier contract as an ADR; document the edge-safe middleware subset; ship one verified deploy example per platform.

**Out of scope (explicit — deferred to follow-up changes):** the runtime hook bus (`07` ADR-R7 / `06` D-11), `AsyncLocalStorage` ambient context (T026), validated config (T035), and owning the DI container (T050/T033). Each is a runtime-architecture item but a *separate concern* from edge/serverless proof; folding them in would balloon scope and blast radius. Also deferred as their own future changes: **splitting `adapter-edge` into per-platform packages** (`adapter-cloudflare`/`-vercel`/`-netlify`) — a sound direction the `EventMapper`/capability seams keep additive — and **framework integrations** (`@nextrush/next`/`remix`/`astro`/`sveltekit`), which answer *"where can NextRush be embedded?"* rather than *"where can it run?"* and deserve a dedicated spec (recommended next major change). **Decided (not deferred): serverless ships as ONE package** (`@nextrush/adapter-serverless`) with per-provider *named exports*, not `@nextrush/aws-lambda`/`-google-functions`/`-azure-functions` — separate one-function packages aren't worth their per-package versioning/README/tests/changelog/release cost. Thin re-export packages are a v2+ escape hatch only if real demand appears.

## Capabilities

### New Capabilities
- `runtime-adapter-contract`: The typed, enforced `ServerAdapter`/`FetchAdapter` two-tier contract, the shared `Context` factory shape, the compile-time conformance guard, and the observable-parity requirements every adapter must satisfy.
- `runtime-capability-negotiation`: The requirement that runtime-varying behavior is decided by negotiated `RuntimeCapabilities` (never by runtime identity), including graceful degradation, explicit refusal, unknown-runtime probing, and named `CapabilityProfile`s per runtime.
- `serverless-adapter`: The `@nextrush/adapter-serverless` behaviors — a **tiered public API** (Tier 1: per-provider one-liner handlers `createLambdaHandler`/`createGoogleHandler`/`createAzureHandler` that hide all internals; Tier 2: an options object for `timeout`/`streaming`; Tier 3: `createServerlessAdapter` + `EventMapper`, marked runtime-authors-only) over the execution model (per-invocation, stateless, timeout→504, warm-instance container reuse) and a generic, adapter-scoped `EventMapper<Event, Result, Ctx>` registry (immutable per-adapter list, no globals; built-ins for APIGW v1/v2, Lambda Function URL streaming, GCF, Azure; explicit-over-detect selection), plus committed full-chain platform integration fixtures.
- `runtime-proof-harness`: The CI proof requirements — real-runtime conformance execution (workerd/Deno via Docker/`act`), the edge bundle-size budget gate, a conformance-derived runtime certification matrix, and scheduled real-cloud deploy verification (deploy→smoke→destroy).
- `adapter-development-kit`: The `nextrush generate adapter` scaffolder (in `@nextrush/dev`) that emits a contract-conformant adapter wired to the shared conformance suite, plus the testing-tier conformance entrypoint that lets external authors certify their own adapter.

### Modified Capabilities
<!-- None. No existing openspec/specs/ capability changes its requirements; existing specs are docs-authoring-standards and getting-started-content only. -->

## Impact

- **Packages (new):** `@nextrush/adapter-serverless`.
- **Packages (modified):** `@nextrush/types` (new adapter + context-factory contracts, generic `EventMapper`), `@nextrush/adapter-node`/`-bun`/`-deno`/`-edge` (satisfy typed contract + conformance guard), `@nextrush/runtime` (capability-negotiation seam + named `CapabilityProfile`s), `@nextrush/adapter-conformance` (add serverless target; run on real runtimes; expose a testing-tier entrypoint for external authors), `@nextrush/dev` (new `generate adapter` command), meta `nextrush` (export surface).
- **Public API:** new exported adapter contract types (frozen-surface candidates → require repo-wide surface snapshot update + changeset); new `@nextrush/adapter-serverless` public surface (RFC-gated per repo rules).
- **CI:** new Docker-based jobs for workerd/miniflare + Deno conformance; bundle-size gate; cold-start benchmark job; a conformance-derived runtime certification matrix; and a **scheduled (nightly/pre-release), secret-gated** real-cloud `deploy→smoke→destroy` job (Lambda + Cloudflare) that is skipped-not-failed when credentials are absent. Per-PR jobs remain locally reproducible via `act`.
- **Test fixtures:** committed `packages/adapters/serverless/fixtures/<provider>/{event.json,expected-result.json}` full-chain golden fixtures, exercised in CI and doubling as provider documentation.
- **Docs:** new ADR (enforced two-tier contract); edge-safe middleware subset guide; per-platform serverless deploy examples.
- **Dependencies:** dev-only additions (miniflare/workerd, provider event fixtures); zero new runtime dependencies (Web-Crypto/Web-Streams only, preserving the edge budget).
- **Runtime targets touched:** Node, Bun, Deno, Cloudflare/Vercel/Netlify edge, and (new) AWS Lambda/APIGW, GCF, Azure Functions.
