# Implementation Tasks — close-runtime-compatibility-gaps

> TDD per repo iron law: write the RED test first, watch it fail for the right reason, then GREEN.
> Cross-adapter behavior stays identical. Order: cheapest/highest-symbolism first (R1), then proof
> (Bun, WinterCG, deploy), then honesty (matrix), then enforcement (lint), then wrap-up.

## 1. R1 — Fix `request-id` `node:crypto` coupling (edge-portable-middleware)

- [x] 1.1 RED: add a test in `@nextrush/request-id` asserting the default generator produces a valid RFC-4122 v4 UUID using only the global `crypto.randomUUID()` (no `node:crypto`), exercised under a Web/edge-style context; confirm it fails against the current `node:crypto` import
- [x] 1.2 Replace `import { randomUUID } from 'node:crypto'` in `packages/middleware/request-id/src/constants.ts` with a guarded call to the global `crypto.randomUUID()` (throw a clear typed error if `typeof crypto?.randomUUID !== 'function'`)
- [x] 1.3 Add a portability regression guard test asserting `@nextrush/request-id/src` contains zero `node:` imports
- [x] 1.4 Add a "Runtime support: edge-safe" section to `packages/middleware/request-id/README.md`
- [x] 1.5 Add a `@nextrush/request-id` patch changeset (behavior-preserving edge-portability fix)
- [x] 1.6 Verify: full `@nextrush/request-id` suite green; the package loads/runs under the edge (workerd) conformance path with no `node:` resolution error

## 2. R7 — Declare per-package / per-strategy runtime support (edge-portable-middleware)

- [x] 2.1 Add a "Runtime support" section to `packages/middleware/multipart/README.md` stating memory storage is edge-portable and disk storage (`node:fs`) is Node-only
- [x] 2.2 Add a "Runtime support" line (edge-safe | Node-only | mixed) to every middleware/extension README, matching each package's actual `node:` coupling (Node-only for `static`/`template`/`websocket`; edge-safe for the Web-standard set)
- [x] 2.3 Verify: each declaration matches source — no package declared `edge-safe` while importing `node:` without a per-strategy Node-only carve-out

## 3. R2 — Real Bun conformance runner (runtime-proof-harness)

- [x] 3.1 Add `packages/adapters/conformance/bun-runner/` that runs the shared conformance suite against the real Bun `ServerAdapter` under `bun test`, mirroring `deno-runner/`
- [x] 3.2 Add a `bun-conformance` job to `.github/workflows/runtime-conformance.yml` using `oven-sh/setup-bun` with a pinned Bun version, `fail-fast: false`, parallel to the Deno/workerd jobs
- [x] 3.3 Document the local reproduction command (`bun test` / `act -j bun-conformance`) in `packages/adapters/conformance/README.md`
- [x] 3.4 Verify: introduce a deliberate Bun-only regression → the Bun job fails while Node/Deno/Workers stay green; revert

## 4. R3 — WinterCG allowed-globals assertion (runtime-proof-harness)

- [x] 4.1 RED: add a conformance test enumerating the WinterCG blessed-global surface (`Request`/`Response`/`URL`/`URLSearchParams`/`fetch`/`Headers`/`AbortSignal`/`crypto.subtle`/Web Streams/`TextEncoder`/`TextDecoder`) and scanning the core request path for forbidden Node globals (`process`/`Buffer`/`__dirname`/`node:*`); confirm it fails when a temporary `process.hrtime()` is added to the request path
- [x] 4.2 Confirm the assertion passes against the current (clean) core request path
- [x] 4.3 Wire the assertion into the conformance suite so it runs in CI
- [x] 4.4 Verify: temporary forbidden global in the request path fails the assertion; revert

## 5. R4 — Deploy verification for Vercel Edge + GCF (runtime-proof-harness)

- [x] 5.1 Add `packages/adapters/conformance/deploy-verification/vercel-app/` with `deploy → smoke → destroy` scripts, mirroring `cloudflare-app/`
- [x] 5.2 Add `packages/adapters/conformance/deploy-verification/gcf-app/` with `deploy → smoke → destroy` scripts, mirroring `lambda-app/`
- [x] 5.3 Extend `.github/workflows/deploy-verification.yml` with Vercel + GCF jobs, secret-gated and skip-not-fail per platform independently, scheduled (not per-PR)
- [x] 5.4 Verify: with credentials present each deploys/smokes/destroys; without credentials each skips (does not fail) independently of the others

## 6. R5 — Certification matrix proof-level + honest public matrix (runtime-proof-harness)

- [x] 6.1 Extend `packages/adapters/conformance/src/certification.ts` so each runtime row carries a proof level (`real-runtime` vs `simulated`) derived from which driver/runner produced the result
- [x] 6.2 RED then GREEN: test asserting the generated matrix exposes proof level and that "proven"/green status is reserved for `real-runtime` rows
- [x] 6.3 Update the `README.md` runtime matrix and `apps/docs` runtime matrix so the proven/🟢 marker appears only for `real-runtime` runtimes; label simulated-only runtimes (Bun until 3.4 lands, Vercel/Netlify/GCF/Azure) distinctly
- [x] 6.4 Reconcile the matrix in `docs/audits/08-runtime-compatibility-gap-analysis.md` as each real-runtime/deploy gate lands

## 7. R6 — Broaden the capability-branching lint rule (runtime-capability-negotiation)

- [x] 7.1 RED: extend `tools/eslint-rules/no-runtime-identity-capability.test.mjs` with cases for `switch (runtime)`, `runtime.startsWith('<name>')`, and `[...].includes(runtime)` capability branches (expected to fail against the current narrow rule)
- [x] 7.2 Broaden `tools/eslint-rules/no-runtime-identity-capability.mjs` to flag `SwitchStatement` discriminants and `.startsWith`/`.includes` member-calls against runtime-name literals in branch conditions; keep the `capability-exempt` escape hatch and exempt the `capabilitiesFor()` producer switch
- [x] 7.3 Run the broadened rule repo-wide; fix or `capability-exempt`-annotate any newly-flagged legitimate sites in this same change so CI lands green
- [x] 7.4 Verify: a `switch`/`startsWith`/`includes` runtime-identity capability branch fails lint; the `capabilitiesFor()` producer switch and annotated optimizations do not

## 8. Validation & wrap-up

- [x] 8.1 `openspec validate close-runtime-compatibility-gaps --strict` passes
- [x] 8.2 `pnpm verify` (build + test + typecheck + lint) green, including the new Bun/WinterCG conformance assertions
- [x] 8.3 Confirm changeset(s) present (request-id patch) and every touched public doc/matrix reconciled; no doc claim contradicted by source
