## Why

The runtime-compatibility audit (`docs/audits/08-runtime-compatibility-gap-analysis.md`) verified
against source that NextRush's core is genuinely runtime-decoupled (zero `node:` imports in
core/router/runtime/di/errors/types/stream, lint-enforced), but found the multi-runtime story is
**proven unevenly** and has **one needless coupling leak**:

- **Bun is advertised as a native adapter but never executed on real Bun in CI** — there is no
  `bun-runner` and no Bun conformance job (only `deno-conformance` + `workerd-conformance` exist),
  so Bun parity is asserted by in-process simulation only.
- **`@nextrush/request-id` imports `node:crypto`** for `randomUUID()` when the Web-standard
  `crypto.randomUUID()` global works on every target — making a tiny, day-one middleware Node-only
  for no reason, and breaking it on any edge deploy.
- **The WinterCG portability guarantee is indirect** — no conformance test asserts the request path
  uses only WinterCG-blessed globals and no forbidden Node globals (it relies on the workerd job
  failing incidentally).
- **Edge/serverless proof is concentrated on Cloudflare + Lambda** — Vercel Edge, Netlify Edge,
  GCF, and Azure have no real-platform execution or deploy smoke, yet the public matrix presents
  them at parity.
- **The capability-branching lint rule is narrow** — it only catches `===`/`!==` against a runtime
  name, missing `switch`/`startsWith`/`includes` forms, so runtime-identity coupling can still slip
  in.

This change closes the gap between "supported" and "proven", removes the coupling leak, and makes
the public runtime matrix honest.

## What Changes

- **Fix the `request-id` coupling leak** — replace `import { randomUUID } from 'node:crypto'` with
  the Web-standard `crypto.randomUUID()` global (guarded), making `@nextrush/request-id`
  edge-portable. Add a regression guard so no `node:` import returns to its `src`.
- **Add a real Bun conformance runner + CI job** — a `bun-runner` mirroring `deno-runner`, running
  the shared conformance suite against the real Bun adapter under `bun test`, wired into
  `runtime-conformance.yml` alongside the Deno/workerd jobs.
- **Add a WinterCG allowed-globals assertion** to the conformance suite that enumerates the blessed
  global surface and fails on any forbidden Node global in the request path.
- **Extend scheduled deploy verification** to Vercel Edge and Google Cloud Functions (mirroring the
  existing secret-gated, skip-not-fail `cloudflare-app`/`lambda-app` pattern).
- **Make the runtime certification matrix distinguish proof level** — real-runtime-proven vs
  simulated-only — and correct the public README/docs matrix to reserve "proven" status for
  runtimes with a real gate.
- **Declare per-package (and per-strategy) runtime support** for middleware/extensions, including
  `@nextrush/multipart`'s disk-only-on-Node vs memory-portable distinction.
- **Broaden the `no-runtime-identity-capability` lint rule** to also flag `switch`-discriminant and
  `.startsWith`/`.includes` runtime-identity branching used for capability decisions, keeping the
  `capability-exempt` escape hatch.

No breaking changes: `request-id` emits identical RFC-4122 v4 UUIDs either way, and no public API,
export surface, or runtime dependency changes.

## Capabilities

### New Capabilities
- `edge-portable-middleware`: Middleware and extensions MUST NOT couple to `node:*` for
  functionality available via a Web-standard global, and MUST declare their runtime support
  (edge-safe vs Node-only, and per-strategy where it varies). Covers the `request-id` fix (R1) and
  the `multipart` disk-vs-memory portability declaration (R7).

### Modified Capabilities
- `runtime-proof-harness`: real-runtime conformance execution extended to require **Bun** (R2); a
  new **WinterCG allowed-globals assertion** requirement (R3); scheduled deploy verification
  extended to **Vercel Edge + GCF** (R4); the certification matrix must distinguish
  **real-runtime-proven vs simulated-only** proof level (R5).
- `runtime-capability-negotiation`: the runtime-identity lint requirement broadened to also reject
  `switch`/`.startsWith`/`.includes` runtime-identity capability branching, not only `===`/`!==`
  (R6).

## Impact

- **Code:** `packages/middleware/request-id/src/constants.ts` (import swap);
  `packages/adapters/conformance/` (new `bun-runner/`, WinterCG assertion test, certification
  proof-level); `tools/eslint-rules/no-runtime-identity-capability.mjs` (broaden matcher).
- **CI:** `.github/workflows/runtime-conformance.yml` (new `bun-conformance` job);
  `.github/workflows/deploy-verification.yml` + `packages/adapters/conformance/deploy-verification/`
  (new `vercel-app`, `gcf-app`).
- **Docs:** `README.md` runtime/middleware tables; `apps/docs` runtime matrix;
  `packages/middleware/multipart/README.md` + `packages/middleware/request-id/README.md` runtime
  support; `docs/audits/08-runtime-compatibility-gap-analysis.md` matrix reconciled as gaps close.
- **Dependencies:** none added or removed. Bun becomes a CI toolchain dependency only.
- **Out of scope (separately tracked):** the `AsyncLocalStorage` context-propagation seam (T026,
  audit R8 — observability domain) and the edge-native WebSocket path (T024). These are noted as
  non-goals here to keep this change scoped to portability proof + coupling fixes.
