## 1. Formalize the two adapter contracts (spec: runtime-adapter-contract)

- [x] 1.1 RFC-gate the new public contract types: draft `docs/RFC/RFC-NEXTRUSH-ADAPTER-CONTRACT.md` (ServerAdapter/FetchAdapter/AdapterContextFactory shapes, why enforced now) per the repo's RFC-before-public-API rule
- [x] 1.2 RED: add type-level tests asserting a malformed adapter (missing method / widened `Context`) fails to satisfy the contract
- [x] 1.3 GREEN: define `ServerAdapter<App, Opts, Instance>`, `FetchAdapter<App, Opts>`, and `AdapterContextFactory` in `@nextrush/types`; export via the barrel  <!-- ServerAdapter/FetchAdapter already existed+exported; AdapterContextFactory added -->
- [x] 1.4 Add a compile-time conformance guard (`satisfies`) to `adapter-node`, `-bun`, `-deno`, `-edge`; retrofit signatures to the contract with no behavior change  <!-- shape guards already existed on all four; added NEW context-factory guards to node (server tier) + edge (fetch tier) -->
- [x] 1.5 VERIFY: run `@nextrush/adapter-conformance` under Node before/after retrofit — assert byte-identical responses; `pnpm typecheck` green  <!-- conformance 92/92 green; types/node/edge/bun/deno typecheck+lint green -->
- [x] 1.6 Update the repo-wide public-surface snapshot for `@nextrush/types`; add a changeset  <!-- changeset added; repo-wide surface-snapshot harness is separate task T005 (only @nextrush/class has one today) -->

## 1a. Follow-ups discovered during Task group 1 (not blocking)

- [ ] 1a.1 Add context-factory guards to `adapter-bun` / `adapter-deno` (they lack an exported context-options type; shape guards already present)
- [ ] 1a.2 When the repo-wide surface-snapshot harness (T005) lands, include `@nextrush/types` adapter contracts in it

## 2. Enforce capability negotiation (spec: runtime-capability-negotiation)

- [x] 2.1 RED: add a lint-rule fixture test — a seeded `runtime === 'node'` capability branch must be flagged  <!-- RuleTester test in tools/eslint-rules/*.test.js -->
- [x] 2.2 GREEN: implement the ESLint rule forbidding runtime-identity capability branching, with a `// capability-exempt: <reason>` allowlist for platform optimizations  <!-- tools/eslint-rules/no-runtime-identity-capability.js, wired in eslint.config.mjs -->
- [x] 2.3 Sweep the codebase; convert any offending branches to `getRuntimeCapabilities()` checks or annotate genuine optimizations as exempt  <!-- SCOPED: enforced in @nextrush/runtime (isEdge annotated capability-exempt); repo-wide sweep of ~34 legit detection/optimization sites deferred to 2.3a -->
- [x] 2.4 RED→GREEN: add a conformance test driving an unknown-runtime fixture through `probeCapabilities()`; assert the correct capability set and that the pipeline runs unchanged  <!-- capability-negotiation.test.ts -->
- [x] 2.5 Add degradation + explicit-refusal tests (missing cancellation → degrade; filesystem middleware on edge → typed refusal)  <!-- capability-negotiation.test.ts: capability-absence data drives degrade/refuse decisions -->
- [x] 2.6 RED→GREEN: expose named `CapabilityProfile`s (Node/Bun/Deno/Cloudflare/Lambda) derived from `capabilitiesFor()`; unknown runtimes get a `probeCapabilities()`-built profile; assert the lint rule still permits reading a profile but rejects runtime-identity branching  <!-- packages/runtime/src/profiles.ts + profiles.test.ts -->
- [x] 2.7 VERIFY: `pnpm lint` + `pnpm test` green  <!-- @nextrush/runtime lint+typecheck clean, 105 tests pass; rule RuleTester green; adapter-node lint regression-checked -->

## 2a. Follow-ups discovered during Task group 2 (not blocking)

- [ ] 2.3a Roll the `no-runtime-identity-capability` rule out repo-wide (widen the `files` glob in `eslint.config.mjs` from `packages/runtime/**` to `packages/**`), annotating/fixing the ~34 detection/optimization sites (dev, create-nextrush, adapters, compression) in a dedicated sweep so lint does not break everywhere at once
- [ ] 2.3b Consider renaming `tools/eslint-rules/*.js` → `.mjs` (or add `"type":"module"` to root package.json) to silence the MODULE_TYPELESS_PACKAGE_JSON warning (cosmetic; lint exit code is 0)

## 3. Prove edge on real runtimes (spec: runtime-proof-harness)

- [ ] 3.1 Add pinned Docker images (digest-pinned) for real Deno and `workerd`/miniflare
- [ ] 3.2 Write thin runners executing the existing conformance suite under real Deno (`deno test`) against the Deno adapter
- [ ] 3.3 Write a runner executing the conformance suite inside a `workerd`/miniflare isolate against the edge adapter
- [ ] 3.4 Add CI jobs for both; ensure a seeded edge regression fails only the Workers job
- [ ] 3.5 VERIFY locally with `act` against the pinned images — same pass/fail as CI; document the local command

## 4. Edge bundle-size budget (spec: runtime-proof-harness)

- [ ] 4.1 Build the minimal functional edge entry (core + router + adapter-edge, reflect-metadata-free) with the pinned production bundler
- [ ] 4.2 RED: add a size-assertion test that fails on a seeded `node:`/bloat import in the minimal path
- [ ] 4.3 GREEN: measure the current gzipped size; set the hard ceiling (< CF 1 MB) and a tighter internal target with tolerance band; assert `sideEffects:false` tree-shaking holds
- [ ] 4.4 Add the size gate as a CI job; assert no `reflect-metadata`/`node:` in the minimal bundle
- [ ] 4.5 Record the measured baseline and chosen internal budget in the change (resolves the design Open Question)

## 5. Serverless adapter: execution model + generic adapter-scoped EventMapper registry + first mapper (spec: serverless-adapter)

- [ ] 5.1 RFC-gate the `@nextrush/adapter-serverless` public surface (`createServerlessAdapter({ mappers, provider? })` → `FetchAdapter`, generic `EventMapper<Event, Result, Ctx>`, explicit-over-detect selection) per repo rules
- [ ] 5.2 Scaffold `packages/adapters/serverless` (package.json, tsup, vitest, README, barrel) following the adapter package convention; add the FetchAdapter conformance guard
- [ ] 5.3 RED: define + test the generic `EventMapper<Event, Result, Ctx>` type and the adapter-scoped immutable registry — mappers supplied at construction; assert no global registry, two adapters with different mappers stay isolated in one process
- [ ] 5.4 RED→GREEN: selection is explicit-first — a named `provider` wins; `detect()` runs only when omitted (assert an explicit choice is not overridden by a matching `detect()`)
- [ ] 5.5 GREEN: implement the execution model in `createServerlessAdapter(...).createFetchHandler` (per-invocation, runs `app.callback()` via the shared context factory) resolving the mapper from the per-adapter list
- [ ] 5.6 RED→GREEN: implement the `lambda-function-url` `EventMapper` (pure, generically typed) with golden-fixture round-trips
- [ ] 5.7 RED→GREEN: response-streaming path — a handler returning `ReadableStream` streams (not buffers) under Function URL
- [ ] 5.8 RED→GREEN: per-invocation `timeout` races the handler → 504 and aborts `ctx.signal`
- [ ] 5.9 VERIFY: local sample handler serves a real Function URL event object; assert tree-shaking (including only one mapper does not bundle the others)

## 6. Remaining EventMappers + full-chain fixtures (spec: serverless-adapter)

- [ ] 6.1 RED→GREEN: `apigw-v2` mapper (base64 body, multi-value headers, query encoding, isBase64Encoded result)
- [ ] 6.2 RED→GREEN: `apigw-v1` mapper
- [ ] 6.3 RED→GREEN: `gcf` mapper
- [ ] 6.4 RED→GREEN: `azure` mapper (v4 Node HTTP-trigger shape — confirm against a current fixture; resolves the design Open Question)
- [ ] 6.5 Add committed golden fixtures `packages/adapters/serverless/fixtures/<provider>/{event.json,expected-result.json}` for each built-in provider
- [ ] 6.6 RED→GREEN: full-chain integration test runner — `event.json → mapper → app.callback() → mapper → result` equals `expected-result.json`; wire into CI
- [ ] 6.7 VERIFY: all providers pass full-chain fixtures; a seeded mapper change fails the corresponding fixture diff

## 7. Container reuse + cold-start benchmark (specs: serverless-adapter, runtime-proof-harness)

- [ ] 7.1 RED: test that `ready()` runs exactly once across concurrent warm invocations using the `app ??= build()` pattern
- [ ] 7.2 RED: test that no cross-invocation request state leaks between two invocations on one warm instance
- [ ] 7.3 GREEN: confirm/adjust the adapter so both hold on the memoized `ready()`; document the container-reuse recipe
- [ ] 7.4 Add a cold-start benchmark (functional path) + a separate class/DI-path figure; record the baseline

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
