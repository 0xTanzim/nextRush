## Context

The runtime-compatibility audit (`docs/audits/08-runtime-compatibility-gap-analysis.md`) verified
the current state against source at HEAD `22ef327`:

- **Core is genuinely decoupled** — zero `node:` imports across core/router/runtime/di/errors/
  types/stream; the only `process`/`Buffer` textual hits are comments documenting the avoidance;
  the `no-runtime-identity-capability` ESLint rule is real and wired into `eslint.config.mjs`.
- **Proof is uneven** — `packages/adapters/conformance/` has real-runtime runners for Deno
  (`deno-runner/`) and Cloudflare (`workerd-runner/`) only; `runtime-conformance.yml` runs
  `deno-conformance` + `workerd-conformance` jobs; `deploy-verification/` has `cloudflare-app` +
  `lambda-app` only. There is **no `bun-runner`**, so Bun is exercised only via in-process drivers.
- **One coupling leak** — `packages/middleware/request-id/src/constants.ts` imports
  `randomUUID` from `node:crypto`.
- **The lint rule is narrow** — its own docstring states it flags only `===`/`!==` against a
  runtime-name literal, not `switch`/`.startsWith`/`.includes`.

This change is a portability-proof and coupling-fix pass. It touches four surfaces (one middleware,
the conformance package, CI workflows, and one ESLint rule) plus docs, and adds Bun as a CI
toolchain dependency — enough cross-cutting surface to warrant recording the decisions here.

## Goals / Non-Goals

**Goals:**
- Remove the `request-id` → `node:crypto` coupling and prevent its regression.
- Execute the real conformance suite on **real Bun** in CI, closing the largest "say vs. prove" gap.
- Assert the WinterCG blessed-global surface directly, rather than relying on the workerd job
  failing incidentally.
- Extend real-cloud deploy verification to Vercel Edge and GCF using the existing skip-not-fail
  pattern.
- Make the certification matrix and public README/docs matrix reserve "proven" status for runtimes
  with a real gate, and label simulated-only runtimes distinctly.
- Give middleware/extensions a declared, checkable runtime-support contract (including
  `multipart`'s disk-vs-memory split).
- Broaden the capability lint rule to close the `switch`/`startsWith`/`includes` bypass.

**Non-Goals:**
- The `AsyncLocalStorage` context-propagation seam (T026 / audit R8) — observability domain,
  separately tracked; it blocks OTel/metrics/hooks and deserves its own change.
- The edge-native WebSocket path (T024) — a new Expert-level capability package, out of scope.
- Azure Functions and Netlify Edge deploy verification — deferred; Vercel + GCF are the
  highest-value next markets after Cloudflare/Lambda, and bounding this round keeps CI cost and
  credential surface contained.
- Replacing tsyringe (T050) or any DI/module-isolation work — unrelated to portability proof.

## Decisions

### D1 — `request-id`: use the guarded `crypto.randomUUID()` global, keep the default generator
Replace `import { randomUUID } from 'node:crypto'` with a call to the global
`crypto.randomUUID()`, guarded by a `typeof crypto?.randomUUID === 'function'` check that throws a
clear, typed error naming the missing capability if absent.
- **Why:** behaviorally identical output (RFC-4122 v4), available on every stated target
  (Node ≥22, Bun, Deno, Cloudflare, Vercel, Netlify), and removes the only `node:` import in the
  package — making `request-id` edge-portable with zero API change.
- **Alternatives considered:** (a) make the generator injection-only with no default — rejected,
  breaks the zero-config DX for the most common case; (b) leave `node:crypto` and document
  Node-only — rejected, the audit's core finding is that the coupling is *needless*.

### D2 — Bun: a real `bun-runner/` mirroring `deno-runner/`, not another simulated driver
Add `packages/adapters/conformance/bun-runner/` that runs the shared conformance suite against the
real Bun `ServerAdapter` under `bun test`, plus a `bun-conformance` job in
`runtime-conformance.yml` using a pinned Bun version.
- **Why:** the existing `deno-runner`/`workerd-runner` pattern is the proven shape; Bun parity
  asserted under Node (today) cannot catch `Bun.serve`/Web-API divergences.
- **Alternatives considered:** exercising Bun through the in-process `node-driver`/`web-driver` —
  rejected, that *is* the current simulated gap; a Docker-based Bun image like the workerd job —
  acceptable but heavier than `oven-sh/setup-bun`, which is sufficient for a `ServerAdapter`.

### D3 — WinterCG assertion lives in the conformance harness as a dedicated test
Add a conformance test that (a) enumerates the WinterCG Minimum Common allowed-global surface the
request path may use (`Request`/`Response`/`URL`/`URLSearchParams`/`fetch`/`Headers`/`AbortSignal`/
`crypto.subtle`/Web Streams/`TextEncoder`/`TextDecoder`) and (b) asserts the core request path
references no forbidden Node global (`process`/`Buffer`/`__dirname`/`node:*`).
- **Why:** turns the "WinterCG-aligned" claim into a direct, failing-on-violation gate. It belongs
  in `runtime-proof-harness` (the CI-proof capability) alongside the bundle-budget and real-runtime
  requirements, not in capability-negotiation (which governs *how code decides*, not *what CI proves*).
- **Alternatives considered:** a new standalone `wintercg-conformance` capability — rejected as
  micro-capability sprawl; the proof-harness is the cohesive home. Relying on the workerd job's
  incidental failure — rejected, indirect and gives no enumerated contract.

### D4 — Deploy verification: extend the existing secret-gated pattern to Vercel + GCF
Add `deploy-verification/vercel-app/` and `deploy-verification/gcf-app/` with the same
`deploy → smoke → destroy` scripts, gated on repo secrets, scheduled (not per-PR), skipped-not-
failed when credentials are absent.
- **Why:** mirrors the already-shipped `cloudflare-app`/`lambda-app` contract; no new mechanism.
- **Alternatives considered:** all four remaining platforms (Vercel/Netlify/GCF/Azure) at once —
  rejected, unbounded credential/CI surface; Vercel + GCF are the two highest-value.

### D5 — Certification matrix gains a proof-level dimension
Extend the conformance-generated certification matrix so each runtime carries a **proof level**
(`real-runtime` vs `simulated`) alongside its feature-coverage %, and correct the public
README/docs matrix to reserve the "proven"/🟢 marker for `real-runtime` rows.
- **Why:** the audit's core "honesty" finding — the matrix presently implies parity where the
  evidence tier differs. Proof level is derived from which driver/runner produced the result, so
  it stays generated, not hand-maintained.
- **Alternatives considered:** a docs-only README edit with no matrix change — rejected, it would
  drift again; encoding proof level in the generated matrix keeps it honest by construction.

### D6 — Broaden the lint rule to branch conditions, keep it literal-anchored
Extend `no-runtime-identity-capability` to also flag `SwitchStatement` discriminants and
`.startsWith(...)`/`.includes(...)` member calls **when compared against or applied to a known
runtime-name literal in a branch condition**, keeping the `capability-exempt` escape hatch and the
`capabilitiesFor()` producer-switch exemption.
- **Why:** closes the documented bypass without abandoning the low-false-positive anchor
  (runtime-name literal) that lets the rule stay CI-enforced.
- **Alternatives considered:** flag any `switch(runtime)` regardless of literals — rejected, would
  flag the legitimate `capabilitiesFor` producer switch and invite disabling the rule.

### D7 — Runtime-support declaration is docs-first (README convention), not a new machine field
Each middleware/extension README gains a "Runtime support" line (edge-safe | Node-only | mixed),
with per-strategy detail where it varies (`multipart`: memory = portable, disk = Node-only;
`request-id`: edge-safe after D1). No `package.json` custom field is introduced yet.
- **Why:** YAGNI — nothing consumes a machine-readable field today; a documented convention closes
  the user-facing gap (T022 lineage) at far lower cost, and can be promoted to a field later if a
  tool needs it.
- **Alternatives considered:** a `package.json` `nextrush.runtime` field now — rejected as
  speculative infrastructure with no consumer.

## Risks / Trade-offs

- **Bun CI flakiness / added job time** → pin the Bun version via `setup-bun`, use
  `fail-fast: false` in the matrix so a Bun-only failure doesn't mask other runtimes, and keep the
  Bun job parallel to (not blocking) the existing jobs.
- **Broadened lint rule false-positives** → anchor every new pattern to a known runtime-name
  literal, keep the `capability-exempt` annotation, and run the broadened rule against the whole
  repo once — annotating the legitimate detection/optimization sites in the same change so CI stays
  green on landing.
- **Deploy verification needs cloud credentials** → reuse the proven secret-gated, skip-not-fail,
  scheduled-only contract; forks and credential-less runs skip rather than fail. No per-PR gate.
- **`request-id` on an exotic host without global `crypto`** → the `typeof` guard throws a clear
  typed error rather than a cryptic `ReferenceError`; all stated targets provide the global, so
  this is a safety net, not an expected path.
- **WinterCG assertion completeness** → the enumerated allow-list is a curated snapshot of the
  Minimum Common API; it can lag the spec. Mitigation: treat the list as the contract, review it
  when the WinterCG surface changes, and keep the forbidden-global scan (the higher-signal half)
  broad.

## Migration Plan

Fully additive; no rollback complexity and no coordinated release needed:

1. **D1 (`request-id`)** ships as a `@nextrush/request-id` **patch** changeset (behavior-preserving
   edge-portability fix). RED test first (import scan + edge-context generation), then the swap.
2. **D2–D5 (conformance/CI)** are test/CI/docs only — no shipped-package behavior change, no
   changeset needed beyond the matrix/doc updates.
3. **D6 (lint)** is a dev-tooling change; if it flags existing code, that code is fixed or
   `capability-exempt`-annotated in the same change so CI lands green.
4. **D7 (docs)** is README/matrix edits reconciled against the audit as each gap closes.

Rollback: revert the changeset (D1) and/or the CI/lint commits independently; each is isolated.

## Open Questions

- **Azure + Netlify deploy verification** — deferred to a follow-up once Vercel/GCF prove the
  extended pattern. Confirm this ordering is acceptable, or pull Netlify forward (it runs on Deno,
  so it partially overlaps the Deno runner).
- **Promoting the runtime-support convention to a `package.json` field** — leave as docs-only now;
  revisit if a generator/matrix tool needs to consume it programmatically.
- **Bun runner execution surface** — start with the `ServerAdapter` conformance suite; whether to
  also assert Bun-specific `Bun.serve` options (e.g. `reusePort`) is left for a follow-up once the
  baseline Bun job is green.
