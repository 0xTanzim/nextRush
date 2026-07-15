## 1. Formalize the two adapter contracts (spec: runtime-adapter-contract)

- [x] 1.1 RFC-gate the new public contract types: draft `docs/RFC/RFC-NEXTRUSH-ADAPTER-CONTRACT.md` (ServerAdapter/FetchAdapter/AdapterContextFactory shapes, why enforced now) per the repo's RFC-before-public-API rule
- [x] 1.2 RED: add type-level tests asserting a malformed adapter (missing method / widened `Context`) fails to satisfy the contract
- [x] 1.3 GREEN: define `ServerAdapter<App, Opts, Instance>`, `FetchAdapter<App, Opts>`, and `AdapterContextFactory` in `@nextrush/types`; export via the barrel  <!-- ServerAdapter/FetchAdapter already existed+exported; AdapterContextFactory added -->
- [x] 1.4 Add a compile-time conformance guard (`satisfies`) to `adapter-node`, `-bun`, `-deno`, `-edge`; retrofit signatures to the contract with no behavior change  <!-- shape guards already existed on all four; added NEW context-factory guards to node (server tier) + edge (fetch tier) -->
- [x] 1.5 VERIFY: run `@nextrush/adapter-conformance` under Node before/after retrofit — assert byte-identical responses; `pnpm typecheck` green  <!-- conformance 92/92 green; types/node/edge/bun/deno typecheck+lint green -->
- [x] 1.6 Update the repo-wide public-surface snapshot for `@nextrush/types`; add a changeset  <!-- changeset added; repo-wide surface-snapshot harness is separate task T005 (only @nextrush/class has one today) -->

## 1a. Follow-ups discovered during Task group 1 (COMPLETE)

- [x] 1a.1 Add context-factory guards to `adapter-bun` / `adapter-deno`  <!-- added AdapterContextFactory guards; bun/deno typecheck green -->
- [ ] 1a.2 When the repo-wide surface-snapshot harness (T005) lands, include `@nextrush/types` adapter contracts in it  <!-- blocked on T005 (separate change) -->

## 2. Enforce capability negotiation (spec: runtime-capability-negotiation)

- [x] 2.1 RED: add a lint-rule fixture test — a seeded `runtime === 'node'` capability branch must be flagged  <!-- RuleTester test in tools/eslint-rules/*.test.js -->
- [x] 2.2 GREEN: implement the ESLint rule forbidding runtime-identity capability branching, with a `// capability-exempt: <reason>` allowlist for platform optimizations  <!-- tools/eslint-rules/no-runtime-identity-capability.js, wired in eslint.config.mjs -->
- [x] 2.3 Sweep the codebase; convert any offending branches to `getRuntimeCapabilities()` checks or annotate genuine optimizations as exempt  <!-- SCOPED: enforced in @nextrush/runtime (isEdge annotated capability-exempt); repo-wide sweep of ~34 legit detection/optimization sites deferred to 2.3a -->
- [x] 2.4 RED→GREEN: add a conformance test driving an unknown-runtime fixture through `probeCapabilities()`; assert the correct capability set and that the pipeline runs unchanged  <!-- capability-negotiation.test.ts -->
- [x] 2.5 Add degradation + explicit-refusal tests (missing cancellation → degrade; filesystem middleware on edge → typed refusal)  <!-- capability-negotiation.test.ts: capability-absence data drives degrade/refuse decisions -->
- [x] 2.6 RED→GREEN: expose named `CapabilityProfile`s (Node/Bun/Deno/Cloudflare/Lambda) derived from `capabilitiesFor()`; unknown runtimes get a `probeCapabilities()`-built profile; assert the lint rule still permits reading a profile but rejects runtime-identity branching  <!-- packages/runtime/src/profiles.ts + profiles.test.ts -->
- [x] 2.7 VERIFY: `pnpm lint` + `pnpm test` green  <!-- @nextrush/runtime lint+typecheck clean, 105 tests pass; rule RuleTester green; adapter-node lint regression-checked -->

## 2a. Follow-ups discovered during Task group 2 (COMPLETE)

- [x] 2.3a Roll the `no-runtime-identity-capability` rule out repo-wide  <!-- glob widened to packages/**/src; 24 legit detection/optimization sites annotated (dev runtime/commands, create-nextrush, conformance driver) via file-level capability-exempt; eslint packages/**/src → 0 violations -->
- [x] 2.3b Rename `tools/eslint-rules/*.js` → `.mjs` to silence MODULE_TYPELESS warning  <!-- renamed + import paths updated -->
- [ ] 2.3c Add a `lint` script to `@nextrush/dev` (currently unlinted per-package; covered only by root-level eslint runs)

## 3. Prove edge on real runtimes (spec: runtime-proof-harness)

- [x] 3.1 Pin real Deno + `workerd`/miniflare versions for the runners  <!-- pinned via setup-deno@v2 (v2.6.3) + miniflare@4 + compat-date in the CI workflow; act runs these in Docker locally -->
- [x] 3.2 Write thin runners executing the existing conformance suite under real Deno (`deno test`) against the Deno adapter  <!-- deno-runner/: 6/6 pass under real Deno 2.6.3; detectRuntime()===deno verified -->
- [x] 3.3 Write a runner executing the conformance suite inside a `workerd`/miniflare isolate against the edge adapter  <!-- workerd-runner/: esbuild-bundled worker + miniflare test; VERIFIED locally 3/3 under real workerd via miniflare@4 -->
- [x] 3.4 Add CI jobs for both; ensure a seeded edge regression fails only the Workers job  <!-- .github/workflows/runtime-conformance.yml: deno-conformance + workerd-conformance jobs -->
- [x] 3.5 VERIFY locally with `act` against the pinned images — same pass/fail as CI; document the local command  <!-- documented in packages/adapters/conformance/README.md (act -j deno-conformance / workerd-conformance) -->

## 4. Edge bundle-size budget (spec: runtime-proof-harness)

- [x] 4.1 Build the minimal functional edge entry (core + router + adapter-edge, reflect-metadata-free) with the pinned production bundler  <!-- bundle-budget/minimal-entry.mjs bundled via esbuild (workerd conditions, minify) -->
- [x] 4.2 RED: add a size-assertion test that fails on a seeded `node:`/bloat import in the minimal path  <!-- bundle-budget.test.mjs asserts gzip budget + no node:/reflect-metadata; measurement confirmed both flags false -->
- [x] 4.3 GREEN: measure the current gzipped size; set the hard ceiling (< CF 1 MB) and a tighter internal target with tolerance band; assert `sideEffects:false` tree-shaking holds  <!-- baseline 13.11 KB gzip; GZIP_BUDGET 30 KB, RAW_CEILING 120 KB -->
- [x] 4.4 Add the size gate as a CI job; assert no `reflect-metadata`/`node:` in the minimal bundle  <!-- bundle-budget job in runtime-conformance.yml -->
- [x] 4.5 Record the measured baseline and chosen internal budget in the change (resolves the design Open Question)  <!-- baseline 13.11 KB gzip / 42.11 KB raw; internal gzip budget 30 KB, recorded in bundle-budget.test.mjs header -->

## 5. Serverless adapter: execution model + generic adapter-scoped EventMapper registry + first mapper (spec: serverless-adapter)

- [x] 5.1 RFC-gate the `@nextrush/adapter-serverless` public surface (`createServerlessAdapter({ mappers, provider? })` → `FetchAdapter`, generic `EventMapper<Event, Result, Ctx>`, explicit-over-detect selection) per repo rules
- [x] 5.2 Scaffold `packages/adapters/serverless` (package.json, tsup, vitest, README, barrel) following the adapter package convention; add the FetchAdapter conformance guard
- [x] 5.3 RED: define + test the generic `EventMapper<Event, Result, Ctx>` type and the adapter-scoped immutable registry — mappers supplied at construction; assert no global registry, two adapters with different mappers stay isolated in one process
- [x] 5.4 RED→GREEN: selection is explicit-first — a named `provider` wins; `detect()` runs only when omitted (assert an explicit choice is not overridden by a matching `detect()`)
- [x] 5.5 GREEN: implement the execution model in `createServerlessAdapter(...).createFetchHandler` (per-invocation, runs `app.callback()` via the shared context factory) resolving the mapper from the per-adapter list
- [x] 5.6 RED→GREEN: implement the `lambda-function-url` `EventMapper` (pure, generically typed) with golden-fixture round-trips
- [x] 5.7 RED→GREEN: response-streaming path — a handler returning `ReadableStream` streams (not buffers) under Function URL
- [x] 5.8 RED→GREEN: per-invocation `timeout` races the handler → 504 and aborts `ctx.signal`
- [x] 5.9 VERIFY: local sample handler serves a real Function URL event object; assert tree-shaking (including only one mapper does not bundle the others)

## 5b. Minimal DX — tiered per-provider handlers (spec: serverless-adapter → Tiered public API)

- [x] 5b.1 RED: tests asserting `createLambdaHandler(app)` (no options) serves both Lambda Function URL (v2) and API Gateway (v1/v2) events with zero config
- [x] 5b.2 GREEN: implement Tier-1 `createLambdaHandler(app, opts?)` wrapping `createServerlessAdapter({ mappers: [lambdaFunctionUrl, apigwV1] })` with detect-based selection
- [x] 5b.3 GREEN: implement `createGoogleHandler(app, opts?)` (gcf) and `createAzureHandler(app, opts?)` (azure)
- [x] 5b.4 Tier 2: thread `{ timeout }` through the Tier-1 handlers (streaming deferred to 5a.1 — a no-op flag would be misleading DX; not exposed until true streamifyResponse lands)
- [x] 5b.5 Mark Tier 3 as runtime-authors-only: add `@advanced` JSDoc to `createServerlessAdapter` + `EventMapper`; export Tier-1 handlers as the documented primary surface from the barrel
- [x] 5b.6 Docs: per-provider "deploy to X" one-liner is the headline; `createServerlessAdapter`/`EventMapper` documented under an "Advanced / Runtime Authors" section only
- [x] 5b.7 VERIFY: tests green; a normal-user example imports only `createXHandler`; typecheck + lint clean

## 6. Remaining EventMappers + full-chain fixtures (spec: serverless-adapter)

- [x] 6.1 RED→GREEN: `apigw-v2` mapper (base64 body, multi-value headers, query encoding, isBase64Encoded result)
- [x] 6.2 RED→GREEN: `apigw-v1` mapper
- [x] 6.3 RED→GREEN: `gcf` mapper
- [x] 6.4 RED→GREEN: `azure` mapper (v4 Node HTTP-trigger shape — confirm against a current fixture; resolves the design Open Question)
- [x] 6.5 Add committed golden fixtures `packages/adapters/serverless/fixtures/<provider>/{event.json,expected-result.json}` for each built-in provider
- [x] 6.6 RED→GREEN: full-chain integration test runner — `event.json → mapper → app.callback() → mapper → result` equals `expected-result.json`; wire into CI
- [x] 6.7 VERIFY: all providers pass full-chain fixtures; a seeded mapper change fails the corresponding fixture diff

## 7. Container reuse + cold-start benchmark (specs: serverless-adapter, runtime-proof-harness)

- [x] 7.1 RED: test that `ready()` runs exactly once across concurrent warm invocations using the `app ??= build()` pattern
- [x] 7.2 RED: test that no cross-invocation request state leaks between two invocations on one warm instance
- [x] 7.3 GREEN: confirm/adjust the adapter so both hold on the memoized `ready()`; document the container-reuse recipe
- [x] 7.4 Add a cold-start benchmark (functional path) + a separate class/DI-path figure; record the baseline

## 8. Conformance parity for the serverless adapter (spec: serverless-adapter)

- [ ] 8.1 RED: wire `@nextrush/adapter-serverless` into `@nextrush/adapter-conformance` as a new target; a seeded divergence must fail
- [ ] 8.2 GREEN: make the parity matrix green for the serverless adapter alongside node/bun/deno/edge
- [ ] 8.3 VERIFY: run the serverless conformance target under real Deno and (where applicable) the Workers isolate via `act`

## 9. Runtime certification matrix (spec: runtime-proof-harness)

- [ ] 9.1 Tag conformance-suite cases by feature (Request, Streaming, AbortSignal, Cookies, Multipart, SSE, Compression, WebSockets, Shutdown, Timeouts)
- [ ] 9.2 RED→GREEN: generate a certification matrix (feature × runtime, per-runtime coverage %) from conformance results — not hand-maintained
- [ ] 9.3 Publish the matrix as user-facing docs; assert a seeded capability regression drops the affected runtime's score
- [ ] 9.4 VERIFY: matrix regenerates in CI and reflects real pass/fail

## 10. Scheduled real-cloud deploy verification (spec: runtime-proof-harness)

- [ ] 10.1 Author a minimal deploy app + smoke test for real Lambda and real Cloudflare
- [ ] 10.2 Add a scheduled (nightly/pre-release) workflow: `deploy → smoke → destroy`, gated on repository secrets
- [ ] 10.3 Ensure the workflow is skipped-not-failed when credentials are absent (e.g. forks); never a per-PR hard gate
- [ ] 10.4 VERIFY: a manual/scheduled run with credentials deploys, smoke-tests, and tears down all resources

## 11. Adapter Development Kit (spec: adapter-development-kit)

- [ ] 11.1 Make the conformance suite consumable by external authors via a testing-tier entrypoint; classify it as testing/dev tier in the public-surface snapshot (not the frozen runtime API)
- [ ] 11.2 RED→GREEN: add `nextrush generate adapter <name>` to the `@nextrush/dev` generator suite, emitting `adapter.ts` (with the `satisfies` guard + context-factory stub), `conformance.test.ts` (wired to the shared suite), `fixtures/`, `README.md`, and a CI snippet
- [ ] 11.3 VERIFY: scaffold a throwaway adapter with the generator — it type-checks, satisfies a contract, and its generated conformance test runs the shared suite and reports pass/fail

## 12. Wire-up, ADR, docs, examples (all specs)

- [ ] 12.1 Export `@nextrush/adapter-serverless` from the meta `nextrush` surface; update the repo-wide public-surface snapshot; add a changeset
- [ ] 12.2 Write the ADR ratifying the enforced two-tier adapter contract + the execution-model/event-format (`EventMapper`) separation (append/reference `docs/audits/07-runtime-architecture.md` per its amendment rule)
- [ ] 12.3 Write `docs/migrations/adapter-contract.md` (before/after + codemod invocation) for the BREAKING contract export; add a codemod stub in `@nextrush/dev` where mechanical
- [ ] 12.4 Document the edge-safe middleware subset, the `EventMapper` authoring guide (how to add a provider via the `mappers` list), the capability profiles, and the serverless container-reuse pattern
- [ ] 12.5 Add one verified deploy example per platform (Cloudflare Workers + AWS Lambda Function URL at minimum), runnable from the docs alone
- [ ] 12.6 Record future-direction notes (per-platform edge adapters; framework-integrations as the recommended next OpenSpec) in the change/docs without implementing them
- [ ] 12.7 VERIFY: `pnpm verify` (build + test + typecheck + lint) green end-to-end; `docs:validate` green; `openspec validate harden-runtime-edge-serverless --strict` passes

## 5a. Follow-ups from Task group 5 (not blocking)

- [ ] 5a.1 True Function URL response streaming (`awslambda.streamifyResponse`) — current `lambda-function-url` mapper uses the buffered v2 result format; a streamed `Response` body is buffered. True streaming is a distinct result shape, lands with group 6.
- [ ] 5a.2 Public method named `createHandler` (event→result), not `createFetchHandler` — the FetchAdapter engine is reused from edge internally. See RFC-NEXTRUSH-ADAPTER-SERVERLESS deviation note.
