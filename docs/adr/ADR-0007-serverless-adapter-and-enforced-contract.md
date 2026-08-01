# ADR-0007 — Enforced Adapter Contract & Serverless Execution/Event-Format Separation

- **Status:** Accepted
- **Date:** 2026-07
- **Addresses:** OpenSpec change `harden-runtime-edge-serverless`; runtime audit `docs/audits/07-runtime-architecture.md` (Adapter model `[CURRENT/FORMALIZED]`, Serverless Runtime)
- **RFCs:** `docs/RFC/runtime-adapters/013-adapter-contract.md`, `docs/RFC/runtime-adapters/014-adapter-serverless.md`

## Context

The two-tier adapter model (`ServerAdapter` for long-lived servers, `FetchAdapter` for
request/response runtimes) worked but was a convention, not a contract — nothing typed stopped a
new or edited adapter from widening `Context`, skipping capability negotiation, or diverging in
observable behavior. Separately, classic serverless (Lambda/GCF/Azure) had no adapter: users
hand-built an `event → Request` bridge. Both gaps block a credible, provable runtime-platform
story, and freezing the contract *before* adoption is far cheaper than after.

## Decision

### 1. The two adapter contracts are typed and enforced

`ServerAdapter`, `FetchAdapter`, and a shared `AdapterContextFactory<Args, Ctx>` are exported
from `@nextrush/types`. Every adapter carries a compile-time conformance guard (a `satisfies`-style
assignment) so a drift in its handler shape or context-factory return type **stops compiling**.
The `node`, `bun`, `deno`, and `edge` adapters were retrofitted. The `AdapterContextFactory`
addition is additive; the existing contracts are unchanged.

### 2. Capability negotiation is the enforced seam

Runtime-varying behavior is decided by negotiated `RuntimeCapabilities`
(`getRuntimeCapabilities()`), never by runtime identity. A lint rule
(`no-runtime-identity-capability`) forbids `runtime === 'x'` capability branches, with an explicit
`// capability-exempt:` allowlist for genuine platform optimizations. Named `CapabilityProfile`s
(Node/Bun/Deno/Cloudflare/Lambda) are derived from `capabilitiesFor()` for defaults and docs.

### 3. Serverless separates the execution model from the event format

`@nextrush/adapter-serverless` splits the **execution model** (per-invocation, stateless, warm
`ready()` reuse, timeout→504 — reused from the edge fetch engine) from the **provider event
format**, which is a generic `EventMapper<Event, Result, Ctx>` supplied as an **immutable
per-adapter list** (no global mutable registry). A new platform is a new mapper — the adapter
never grows a provider `switch`. Selection is explicit-first: a named `provider` wins; `detect()`
runs only when omitted.

### 4. Public DX is tiered; internals stay internal

*Internal complexity must never become user complexity.* The serverless public surface is:

- **Tier 1 (95%)** — per-provider one-liners `createLambdaHandler` / `createGoogleHandler` /
  `createAzureHandler` (+ `createLambdaStreamingHandler` for Function URL `RESPONSE_STREAM`), zero
  config. Cloudflare's `createCloudflareHandler` ships in `@nextrush/adapter-edge`.
- **Tier 2 (4%)** — the same handlers take `{ timeout }`.
- **Tier 3 (1%, runtime authors)** — `createServerlessAdapter` + `EventMapper`, marked
  `@advanced`.

### 5. Packaging & tier classification

Serverless ships as **one package** with named exports, not a package-per-provider (a
one-function package doesn't justify its own versioning/release/maintenance cost). Consistent with
ADR-0005, `@nextrush/adapter-serverless` is a **public opt-in adapter** — like `adapter-edge`/
`-bun`/`-deno`, it is **not** re-exported from the meta `nextrush` package, preserving
"install only what you use" and the edge bundle budget. It is not added as a `nextrush/*` subpath.

## Consequences

- **Positive:** adapter drift is a compile error; edge/serverless parity is proven by a shared
  conformance suite (serverless is the 5th target) and a conformance-derived certification matrix;
  a third-party runtime is certifiable from day one via the Adapter Development Kit
  (`nextrush generate adapter`) and the testing-tier conformance entrypoint.
- **Breaking (adapter authors only):** the exported contract types must be satisfied. Batched into
  the next major with `docs/migrations/adapter-contract.md`. Application developers are unaffected —
  the change is additive at the app level.
- **Deferred / out of scope:** the runtime hook bus, `AsyncLocalStorage` ambient context, validated
  config, DI-container ownership, splitting `adapter-edge` into per-platform packages, and framework
  integrations (`@nextrush/next`/`remix`/`astro`/`sveltekit`) — each a separate future change.

## Notes

The repo-wide public-surface snapshot harness (T005) is a separate change; when it lands, the
`@nextrush/types` adapter contracts and the serverless surface are added to it (follow-ups 1a.2 /
12.1). Today only `@nextrush/class` has a surface snapshot.
