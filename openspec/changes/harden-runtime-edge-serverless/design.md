## Context

The runtime audit (`docs/audits/07-runtime-architecture.md`) is authoritative: *the Web Platform is the base runtime; Node is an adapter.* The core packages (`types/errors/core/router/runtime/di/stream`) already contain **zero** `node:` imports, and two adapter shapes already exist in practice:

- **`ServerAdapter`** — long-lived listener (Node/Bun/Deno): `serve(app, opts)` + `createHandler(app)`.
- **`FetchAdapter`** — per-invocation `(Request) => Response` (Edge): `createFetchHandler(app, opts)`.

Both build a shared `Context` via a `createXContext()` factory and run `app.callback()` (the composed pipeline). The `@nextrush/adapter-conformance` suite already encodes "all adapters behave identically" — but only executes under Node/vitest.

**Current-state constraints this design must respect (verified against source + audits):**
- The contracts are `[FORMALIZED]` (documented, not type-enforced). Retrofitting must not change *observable* adapter behavior — the conformance suite is the invariant.
- The functional path must stay `reflect-metadata`-free and `node:`-free (edge budget + portability).
- Repo rules: ESM-only, zero new *runtime* dependencies in core/adapters, 300-line file cap, RFC-before-public-API, test-first (RED→GREEN→REFACTOR), changeset per release-impacting change.
- Local infra available: Node, Bun, Deno, and Docker with `act` for local GitHub Actions execution — so real-runtime proof and provider-event fixtures run in containers, reproducibly, before CI.

**Stakeholders:** adapter authors (contract consumers), edge/serverless deployers (the proof + serverless adapter), and the v1 freeze (new public surface must be sealed intentionally).

**Framing:** taken together — typed adapter contracts, capability-based execution, execution-model/event-format separation, conformance-driven certification, and real-runtime verification — this change is less "add a serverless feature" and more "make NextRush a *runtime platform*": the same application executes consistently across any runtime, and new runtimes/platforms attach through contracts rather than core edits. Every decision below is judged against that coherence, not feature count.

## Goals / Non-Goals

**Goals:**
- Turn the two-tier adapter model from convention into a **type-enforced + CI-verified** contract, with zero observable behavior change to existing adapters.
- Make **capability negotiation** (`RuntimeCapabilities`) the only sanctioned way to branch on runtime-varying behavior; guarantee unknown Web-standard runtimes work with no code change.
- **Prove** edge parity on real `workerd`/miniflare and real Deno in CI (Docker + `act`), not simulation.
- Enforce an **edge bundle-size budget** in CI (< Cloudflare Workers 1 MB, tighter internal target).
- Ship `@nextrush/adapter-serverless`: a `FetchAdapter` with per-provider `event → Request` mappers (APIGW v1/v2, Lambda Function URL streaming, GCF, Azure), a container-reuse pattern, and a published cold-start benchmark — verified by the conformance suite.

**Non-Goals:**
- The runtime **hook bus** (ADR-R7 / D-11), **ALS ambient context** (T026), **validated config** (T035), and **owning the DI container** (T050/T033). Separate concerns, separate changes.
- New middleware, auth/identity, observability packages (OTel/metrics/health).
- Changing the `Context` contract, `Middleware` signature, `compose()`, router, or lifecycle. This change is *around* the adapter boundary, never below it.
- Node-coupled middleware behavior (`static`/`multipart`-disk/`template`/`websocket`) — only their edge-safety *declaration* is in scope where it intersects the edge subset doc.
- **Splitting `@nextrush/adapter-edge` into per-platform packages** (`adapter-cloudflare`/`adapter-vercel`/`adapter-netlify`). This is a sound future direction (surfacing Durable Objects, Edge Config, Blobs cleanly) but folding it in now is the scope creep this change is disciplined against. The `EventMapper`/capability seams here are designed so that split is additive later — it is a follow-up change, not part of this one.
- **Framework integrations** (`@nextrush/next`, `@nextrush/remix`, `@nextrush/astro`, `@nextrush/sveltekit`). A genuinely different architectural concern — this change answers *"where can NextRush run?"*, integrations answer *"where can NextRush be embedded?"*. It deserves its own OpenSpec and is the recommended next major change.

## Decisions

### D1 — Adapter contracts live in `@nextrush/types`, enforced by a compile-time `satisfies` guard
Define `ServerAdapter<App, Opts, Instance>`, `FetchAdapter<App, Opts>`, and a shared `AdapterContextFactory` in `@nextrush/types`. Each adapter module adds an unused typed const (`export const __conformance = adapterModule satisfies FetchAdapter<...>`) so a shape divergence fails `tsc`.
- **Why:** `@nextrush/types` is the foundation layer everything can import without violating the hierarchy; `satisfies` gives enforcement at zero runtime cost.
- **Alternatives:** (a) a runtime `assertAdapter()` check — rejected: cost + only fails at boot, not authoring time. (b) an abstract base class — rejected: forces inheritance, conflicts with the two distinct shapes and the functional style. (c) leave in each adapter package — rejected: no single source of truth, drift returns.
- **Trade-off:** adapter authors now depend on a typed contract (**BREAKING** for out-of-tree adapters) — accepted, batched into the major with a codemod-able migration.

### D2 — Capability negotiation is enforced by lint + test, not by convention
A custom ESLint rule (in the repo's existing lint tooling) flags `runtime === '<name>'` used for a *capability* decision, with an explicit allowlist for genuine platform-specific *optimizations* (annotated `// capability-exempt: <reason>`). A conformance test drives an unknown-runtime fixture through `probeCapabilities()`.
- **Why:** `07` ADR-R6 makes this the ten-year guarantee; a rule turns the principle into an enforced gate.
- **Alternatives:** (a) doc-only guidance — rejected: unenforceable, already the status quo. (b) forbid `detectRuntime()` entirely — rejected: it's legitimately needed for adapter *selection* and platform optimizations, just not capability decisions.
- **Trade-off:** maintaining an allowlist; small and self-documenting.

### D3 — Prove real runtimes with Docker images + `act`, layered on the existing conformance suite
Reuse `@nextrush/adapter-conformance` unchanged as the behavior oracle; add thin runners that execute it under real runtimes in pinned Docker images:
- **Deno:** `denoland/deno` image → `deno test` running the suite against the Deno adapter.
- **Cloudflare Workers:** `workerd`/miniflare (Node-hosted) → suite against the edge adapter in a Workers-shaped isolate.
- Local reproduction: `act` runs the same workflow jobs locally against these images before pushing.
- **Why:** the suite is already the parity truth; the only missing piece is *where* it runs. Docker pins versions; `act` gives a local RED→GREEN loop without waiting on CI.
- **Alternatives:** (a) hosted runners only — rejected: slow feedback, not locally reproducible, the user explicitly has Docker/`act`. (b) rewrite the suite per runtime — rejected: duplicates the oracle, invites drift.
- **Trade-off:** Docker/toolchain setup cost in CI; contained to dedicated jobs.

### D4 — Edge bundle budget via a built minimal entry + size assertion
Build the minimal functional edge entry (`core + router + adapter-edge`, no `reflect-metadata`) with the production bundler, assert `sideEffects:false` tree-shaking holds, and gate gzipped size against a stated budget (hard: < 1 MB CF; internal target far tighter with headroom).
- **Why:** `07` T012 / `02` P1-7; the number is only meaningful measured on the real minimal entry.
- **Alternatives:** per-package raw size sum — rejected: doesn't reflect tree-shaken reality.
- **Trade-off:** a seeded `node:`/bloat import trips the gate (that's the point).

### D5 — Separate execution model from event format: a generic, adapter-scoped `EventMapper` registry
`@nextrush/adapter-serverless` exposes `createServerlessAdapter({ mappers, provider? })` which returns a `FetchAdapter` (`createFetchHandler(app, opts)`). The adapter owns the **execution model** (per-invocation, stateless, warm-instance reuse, timeout→504). The **event format** is a separate, pluggable, *generically typed* layer:

```ts
interface EventMapper<Event, Result, Ctx = unknown> {
  readonly name: string;
  toRequest(event: Event, platformCtx: Ctx): Request;
  fromResponse(response: Response, event: Event): Result | Promise<Result>;
  detect?(event: Event): boolean;
}
```

The registry is **the immutable `mappers` array captured at construction** — not a global mutable table. Built-in mappers (`apigw-v1`, `apigw-v2`, `lambda-function-url`, `gcf`, `azure`) are just `EventMapper`s a user includes; a third party adds Oracle/Fly.io by passing their own mapper into `mappers`, with **zero adapter modification**.

The layering is explicit:
```
Runtime Core  →  Adapter (execution model: serverless)  →  EventMapper (provider event format)  →  Platform
```

- **Why generic:** without `<Event, Result, Ctx>`, every mapper degrades to `unknown`/`any` at the exact boundary where type safety matters most, contradicting the repo's TypeScript steering (`unknown` at boundaries, generics over assertions). Generics give adapter authors real compile-time safety on the platform event and result shapes.
- **Why adapter-scoped (not global) — this is a correctness fix, not a preference:** a global `registerEventMapper(name, mapper)` is **global mutable state**, which `global-rules.instructions.md` §2 lists as an auto-block and `engineering-standards.md` forbids. Two libraries registering `"aws"` is a real last-writer-wins hazard with no deterministic answer. An immutable per-adapter `mappers` list eliminates the hazard by construction: no hidden state, trivially testable (construct N independent adapters in one process), and consistent with freeze-after-config.
- **Selection is explicit-first, detection is fallback:** if `opts.provider`/construction names a mapper, it wins. `detect(event)` runs **only** when no provider is specified. Silent auto-detection never overrides an explicit choice — configuration beats detection.
- **Alternatives:** (a) global registry (prior draft) — rejected: violates the framework's own global-state rule; non-deterministic under duplicate registration. (b) `switch (provider)` inside the adapter — rejected: every new platform edits the adapter. (c) a package per provider — rejected: inflates package count, and third-party mappers still couldn't plug in.
- **Trade-off:** the user assembles the `mappers` list explicitly (a few lines) instead of relying on ambient registration — worth it for determinism and testability; built-in mappers stay individually importable so tree-shaking drops unused ones.

### D6 — Container reuse is a documented pattern + a memoized-`ready()` guarantee, not new API
Warm-instance reuse uses the existing memoized `ready()`; the recipe is `let app; const handler = () => (app ??= build())`. The adapter guarantees `ready()` runs once across concurrent warm invocations (already true — memoized).
- **Why:** no new surface for a pattern the lifecycle already supports; `07` serverless section.
- **Alternatives:** a stateful adapter singleton — rejected: hidden global state, harder to test, contradicts stateless-execution requirement.
- **Trade-off:** relies on users following the recipe; mitigated by the verified per-platform examples.

### D7 — End-to-end platform integration fixtures, not just Request→Response
Beyond unit-testing `Request`→`Response`, each provider ships committed golden fixtures exercising the **full chain**: `Platform Event → EventMapper.toRequest → app.callback() → Response → EventMapper.fromResponse → Platform Result`. Layout: `fixtures/<provider>/event.json` + `fixtures/<provider>/expected-result.json`, run in CI.
- **Why:** the reviewer's point — production failures happen in the mapping seams (base64 bodies, multi-value headers, query encoding, isBase64Encoded), not in the app. A `Request`→`Response` test alone never touches the event-format edges. Committed fixtures also double as executable provider documentation.
- **Alternatives:** hand-written mapper assertions only — rejected: misses real event shapes; fixtures pin the actual platform contract.
- **Trade-off:** fixtures must be refreshed if a platform changes its event shape — acceptable, and a fixture diff is exactly the signal you want.

### D8 — A runtime certification matrix, derived from the conformance suite
Publish a feature×runtime coverage matrix (Request, Streaming, AbortSignal, Cookies, Multipart, SSE, Compression, WebSockets, Shutdown, Timeouts) with a per-runtime score, generated from conformance-suite results — not hand-maintained.
- **Why:** the reviewer's point — it turns "supports Workers" into a precise, honest capability statement per runtime (e.g. Node 100%, Cloudflare 97%, Lambda 95%), and becomes user-facing documentation. It also makes a capability regression visible as a score drop.
- **Alternatives:** a manually-written support table — rejected: drifts from reality, the exact accuracy debt `06`/`02` already flag ("prove, don't assert").
- **Trade-off:** requires tagging conformance cases by feature; small, one-time.

### D9 — Scheduled real-cloud deployment verification (off the PR path)
A scheduled (nightly / pre-release) workflow that deploys a minimal app to real Lambda and real Cloudflare, runs a smoke test, and tears it down (`deploy → smoke → destroy`). Gated behind repository secrets; skipped (not failed) when credentials are absent.
- **Why:** the reviewer's ladder — Docker good, emulators better, real cloud best. Emulators can't catch platform-specific packaging, cold-start, or IAM/route wiring failures. Keeping it scheduled (not per-PR) avoids cost/latency on every change while still gating releases.
- **Alternatives:** (a) per-PR real deploys — rejected: cost, secret exposure on forks, latency. (b) never deploy for real — rejected: leaves the highest-signal failure mode unproven.
- **Trade-off:** depends on cloud credentials outside the repo's control (an external side effect — see Risks); therefore best-effort and secret-gated, never a hard PR gate.

### D10 — Named capability profiles, derived from the existing capability matrix
Expose a named `CapabilityProfile` per known runtime (e.g. `NodeProfile`, `CloudflareProfile`, `LambdaProfile`, `DenoProfile`) — a documented, exported view of `capabilitiesFor(runtime)` (streaming, filesystem, websocket, nodeStreams, cryptoSubtle, …). Unknown runtimes get a profile from `probeCapabilities()`.
- **Why:** the reviewer's point, and it mostly *names and exports* what already exists. `capabilitiesFor()` already computes per-runtime capabilities; surfacing them as named profiles improves debuggability ("why is streaming off here?"), gives adapters a declarative default, and is the natural data source for the D8 certification matrix.
- **Boundary with D2:** a profile is capability *data* keyed by runtime, for display/debug/defaults — it is **not** a licence to branch logic on runtime identity. Capability *decisions* still go through `getRuntimeCapabilities()` (D2). This keeps ADR-R6 intact.
- **Alternatives:** hand-written per-runtime constants — rejected: drifts from `capabilitiesFor()`; profiles must derive from the single source.
- **Trade-off:** a thin exported surface to keep in sync; mitigated by deriving it, not duplicating it.

### D11 — Adapter Development Kit via the existing `@nextrush/dev` generator, certifiable from day one
Add `nextrush generate adapter <name>` to the existing `@nextrush/dev` generator suite. It scaffolds a contract-conformant adapter: `adapter.ts` (with the `satisfies ServerAdapter|FetchAdapter` guard and a context factory stub), a `conformance.test.ts` that runs the **shared** conformance suite against the new adapter, a `fixtures/` folder (for fetch adapters), a `README.md`, and a CI job snippet. To support this, the conformance suite is made consumable by external adapter authors via a testing-tier entrypoint.
- **Why:** the reviewer's ADK, refined. NextRush's CLI already has `generate controller|service|middleware|guard|route` — a new `generate adapter` reuses that infrastructure (lower blast radius than a standalone `@nextrush/create-adapter` package) and matches the established pattern. Wiring the conformance suite into the scaffold means a third-party runtime starts *certifiable*, not just structured — closing the "build + prove" loop for the runtime-platform vision.
- **Alternatives:** (a) standalone `@nextrush/create-adapter` (`pnpm create adapter`) — deferred: heavier (new scaffolder package) and duplicative of the existing generator infra; viable later for out-of-repo authors and noted as optional packaging. (b) no ADK — rejected: the reviewer makes it an approval condition, and it is the lowest-friction way to grow trusted third-party adapters.
- **Trade-off:** exporting a conformance testing-tier entrypoint slightly widens surface; contained to a `testing`/dev tier (not the frozen public runtime API), consistent with `06`'s "mark conformance internal/dev tier."

## Risks / Trade-offs

- **Retrofitting contracts silently changes adapter behavior** → Mitigation: the conformance suite is the invariant gate; run it (Node + real runtimes) before and after each adapter retrofit — behavior must be byte-identical.
- **New public surface (adapter types + serverless package) frozen accidentally at v1** → Mitigation: update the repo-wide public-surface snapshot intentionally with a changeset; RFC-gate the serverless package surface per repo rules.
- **`workerd`/miniflare version drift breaks CI unpredictably** → Mitigation: pin Docker image digests; `act`-reproduce locally before bumping.
- **Lambda Function URL response streaming semantics differ from buffered APIGW** → Mitigation: model streaming vs buffered as distinct mapper paths, each with golden fixtures (base64 bodies, multi-value headers, binary vs text) and a timeout→504 test.
- **Bundle-size gate becomes flaky across bundler versions** → Mitigation: pin the bundler; assert gzipped size with a small tolerance band, not an exact byte count.
- **Scope creep toward the deferred hook-bus / config / DI items** → Mitigation: the Non-Goals are normative; those get their own changes.
- **Scheduled real-cloud deploy verification depends on external credentials + incurs cost** (external side effect) → Mitigation: secret-gated and skipped-not-failed when absent; scheduled/pre-release only, never a per-PR hard gate; `deploy → smoke → destroy` tears down resources every run to bound cost.
- **BREAKING adapter-contract change churns existing users** → Mitigation: batch into the single planned major; ship a migration guide under `docs/migrations/`; provide a codemod for the mechanical `satisfies`-guard addition; keep a deprecation note where an out-of-tree adapter is detectable.

## Migration Plan

1. **Additive-first within the major.** Land D1 contract types + guards, D2 lint rule, D3 CI jobs, D4 budget gate as internal/CI changes that don't alter runtime behavior (conformance stays green).
2. **Serverless package** ships new — purely additive to consumers.
3. **Version:** the adapter-contract type export is the only consumer-visible BREAKING item; batch it into the planned major alongside the other `07` Stage-5 breaking changes rather than a standalone major. Ship changeset + `docs/migrations/adapter-contract.md` (before/after + codemod invocation).
4. **Rollback:** each stage is independently revertible (git); CI jobs and the serverless package can be disabled/unpublished without touching runtime code. The contract types can revert to non-exported internal shapes if the major is deferred.
5. **RC gate:** validate on real runtimes (via the new CI) during the existing `v1.0.0-rc.x` channel before GA.

## Open Questions

- **Bundle budget number:** hard ceiling is CF 1 MB — what tighter internal target (e.g., 150 KB gzipped) do we commit to publicly? Resolve by measuring the current minimal entry first (Task 4).
- **Auto-detect vs explicit `opts.provider`:** RESOLVED (D5) — explicit selection wins; `detect()` runs only when no provider is specified. Configuration beats detection; silent auto-detection never overrides an explicit choice.
- **ADK packaging:** shipped as `nextrush generate adapter` in `@nextrush/dev` (D11). A standalone `@nextrush/create-adapter` (`pnpm create adapter`) for out-of-repo authors is deferred; revisit if external-author demand appears.
- **Cold-start target:** `07`/`02` say "set after first measurement." The benchmark (Task 7) produces the baseline; the published target is a follow-up decision, not a blocker for this change.
- **Azure Functions programming model:** target the v4 Node model's HTTP trigger shape — confirm against a current fixture during Task 6.
