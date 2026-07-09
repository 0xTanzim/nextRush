# RUNTIME_ARCHITECTURE_AUDIT.md

**Package:** `@nextrush/runtime` @ `3.1.0`
**Audit type:** Deep architectural / production-readiness review (source-verified, not doc-based)
**Files reviewed:** `index.ts`, `detection.ts`, `constants.ts`, `headers.ts`, `body-source.ts`, `query.ts`, `response-builder.ts`, `request-signal.ts`, `server-error.ts`, `types.ts`, `package.json`, `tsup.config.ts`, and the canonical contracts in `@nextrush/types/src/runtime.ts`.
**Verification limit:** Findings are derived from reading source. The packages were not executed; findings R-6 (1xx `Response`) and R-10 (Set-Cookie collapse) are reasoned from the Fetch/HTTP specs, not reproduced at runtime. Everything else is a direct reading of the code.

---

## Executive Summary

The single most important finding is a **naming-vs-reality mismatch**: this package is not a "runtime." It contains no bootstrap, no application lifecycle, no startup/shutdown orchestration, no inversion of control, no plugin host, and no middleware pipeline. Those concerns live in `@nextrush/core` (the `Application` class). `@nextrush/runtime` is a **stateless cross-runtime HTTP-primitives utility library**: runtime *detection*, `BodySource` body reading, header/IP helpers, a hardened query parser, a shared Web `Response` builder, an abort-signal combiner, and a startup-error normalizer.

Judged for what it actually *is*, the code quality is respectable — the primitives are genuinely portable, security-conscious (prototype-pollution guards, CRLF guards, DoS limits), and free of hard Node-only imports. Judged against the audit's stated scope (lifecycle, orchestration, IoC, plugin readiness), most of that scope is **Not Applicable here** and should be redirected to `@nextrush/core`.

The real defects are: **duplicated and divergent runtime detection**, a **static capability matrix that lies for unknown/future runtimes**, **two competing error models inside one package**, and a package that the project's own architecture hierarchy **never declares**. None are catastrophic; several are breaking-change-shaped and must be resolved before an API freeze.

---

## Architecture Score

**68 / 100 (C+)**

Clean primitives and good security hygiene, dragged down by: an undeclared position in the package hierarchy (see I-1 in `CORE_PACKAGE_REVIEW.md`), duplicated detection logic with divergent results, a misleading package name, and an inconsistent internal error philosophy.

## Runtime-Agnostic Score

**85 / 100 (A-)**

This is the package's genuine strength. Every platform probe is `typeof`-guarded (`globalThis`, `process`, `navigator`, `Deno`, `Bun`). Body/response logic uses only Web APIs (`ReadableStream`, `TransformStream`, `TextDecoder`, `Headers`, `AbortSignal.any`). No `node:` imports in source; `Buffer` appears only inside a JSDoc example. Points deducted for the static capability matrix (R-3) and detection drift (R-2), which are *logic* weaknesses in agnosticism, not hard coupling.

## Production-Readiness Score

**70 / 100** — usable, not yet freezable.

---

## Lifecycle Review

**Not applicable to this package — and that is itself a finding.**

The audit brief asks for review of bootstrap, application lifecycle, startup, shutdown, initialization, orchestration, ownership, IoC, lifecycle management, plugin readiness, and middleware readiness. **None of these exist in `@nextrush/runtime`.** The only lifecycle-adjacent artifacts are:

- `constants.ts` — `DEFAULT_TIMEOUT_MS`, `DEFAULT_SHUTDOWN_TIMEOUT_MS`, `DEFAULT_KEEP_ALIVE_TIMEOUT_MS` (defaults *consumed* by adapters; the package does not own any timeout/shutdown behavior).
- `server-error.ts` — `normalizeStartupError()` / `ServerStartError` (a shape for bind failures; not a lifecycle manager).
- `request-signal.ts` — `combineAbortSignal()` (per-request cancellation plumbing).

**Conclusion:** lifecycle correctness must be audited in `@nextrush/core`, not here. If lifecycle ownership was *expected* here, that expectation is stale architecture drift.

---

## Adapter Integration Review

This package is effectively an **adapter support library** — its whole reason to exist is to stop `adapter-node/bun/deno/edge` from copy-pasting the same logic. That intent is sound and the extraction is real (`WebResponseBuilder`, `resolveClientIp`, `normalizeStartupError`, `AbstractBodySource`). Concerns:

1. **`AbstractBodySource` extension contract is uncompilable as documented.** `_stream` is declared `protected abstract _stream(): NodeStreamLike | WebStreamLike` (a method), but the JSDoc example for `NodeBodySource` does `this._stream = req;` (a property assignment). An adapter author following the doc cannot compile. Contract vs. example drift. — `body-source.ts`
2. **Half-portable capability signalling.** Adapters relying on `getRuntimeCapabilities()` to gate features will get wrong answers on unknown runtimes (R-3).
3. **Two error models handed to adapters.** Body errors are NextRush-hierarchy errors; `ServerStartError` is a native `Error`. Adapters must know which catch strategy applies to which failure (R-4, I-2).

---

## Findings

| ID | Severity | Finding | Evidence |
|----|----------|---------|----------|
| **R-1** | High | Package named `runtime` contains zero runtime/lifecycle logic; it is cross-runtime HTTP primitives. Misleading name creates false architectural expectations. | Entire `src/` file listing; `index.ts` `@packageDocumentation` |
| **R-2** | High | **Duplicated + divergent detection.** `detectRuntime()` and `detectEdgeRuntime()` re-implement Cloudflare/Vercel/Netlify detection independently and **disagree on Netlify**: `detectRuntime()` checks `'Deno' in globalThis` *before* any edge branch, so Netlify Edge returns `'deno'`; `detectEdgeRuntime()` returns `{runtime:'edge', isNetlify:true}`. Two sources of truth. | `detection.ts` — `detectRuntime` Deno branch precedes edge; `detectEdgeRuntime` Netlify branch |
| **R-3** | High | **Static capability matrix lies.** `getRuntimeCapabilities()` returns **all-`false`** for `'unknown'` and hardcodes Node/Bun/Deno feature sets from assumed versions. A future runtime with full `fetch`/`webStreams` support is reported as having none — the framework would disable working features. Capabilities are asserted, never probed (`typeof fetch`, `typeof ReadableStream`). | `detection.ts` — `getRuntimeCapabilities` `default:` returns `baseCapabilities` |
| **R-4** | Medium | **Two error models in one package.** `ServerStartError extends Error` (no `status`/`code`/`toJSON`/`expose`, not in the hierarchy) while `BodyConsumedError`/`BodyTooLargeError` extend `@nextrush/errors` classes. Inconsistent failure contract. | `server-error.ts` vs `body-source.ts` |
| **R-5** | Medium | `resetRuntimeCache()` mutates `cachedEdgeInfo` **before** its `let` declaration (forward reference; TDZ-safe only because never called during module init). Also exported publicly while marked `@internal` — a test hook leaking into the public API. | `detection.ts` — `resetRuntimeCache` / `let cachedEdgeInfo` |
| **R-6** | Medium | **1xx responses crash.** `WebResponseBuilder.getResponse()` forwards `status` to `new Response(body, {status})`. `isBodylessResponse` treats 1xx as bodyless but still passes the status; `new Response` throws `RangeError` for `status < 200`. Informational responses are unrepresentable. No validation. | `response-builder.ts` — `getResponse`, `isBodylessResponse` |
| **R-7** | Medium | **Weak IP validation sold as a security control.** `isValidClientIp` regex `/^[\da-fA-F.:]+$/` is a charset filter, not IP validation — `999.999.999.999`, `....`, `::::` all pass. Doc claims it guards spoofed `X-Forwarded-For`; it only blocks non-hex/punct injection. | `headers.ts` — `isValidClientIp` |
| **R-8** | Low | `BodySource` contract drift: (a) interface doc says `text()` returns UTF-8 but impl honors configurable `encoding`; (b) `EmptyBodySource.consumed` is permanently `false` and never enforces single-consumption, unlike `AbstractBodySource`; (c) `_stream` method-vs-property doc bug (see Adapter Integration §1). | `types/runtime.ts`, `body-source.ts` |
| **R-9** | Low | `tsup` builds with `target: 'node20'` and `@types/node` is a dependency of a "runtime-agnostic" package. Nothing enforces the bundle stays platform-neutral (no `platform:'neutral'`, no lint gate). Currently clean by luck, not by contract. | `tsup.config.ts`, `package.json` |
| **R-10** | Low | `headersToRecord` collapses multiple inbound `Set-Cookie` headers into a single joined string. Spec-compliant `Headers.forEach` pre-combines values and treats `set-cookie` specially (`getSetCookie()`), which this code does not use — so the multi-value array branch is largely dead and Set-Cookie is mishandled on inbound conversion. | `headers.ts` — `headersToRecord` |
| **R-11** | Info | No diagnostics/metrics/tracing/logging surface anywhere in the package (detection has no debug hook). Acceptable for a primitives lib, but the audit's observability scope is simply absent by design. | Whole package |

---

## Missing Capabilities

- **Runtime-neutral build guarantee.** No `platform: 'neutral'` and no CI check that the bundle contains no node-only builtins (R-9).
- **Capability *probing*** instead of a static lookup table (R-3) — e.g. `typeof globalThis.ReadableStream === 'function'`.
- **A single detection source of truth** shared by `detectRuntime` and `detectEdgeRuntime` (R-2).
- **A declared package boundary** in the project hierarchy (`v3-architecture.instructions.md` / `global-rules.instructions.md` omit `runtime` entirely).
- **Unified error contract** so `ServerStartError` participates in the same hierarchy as the body errors (R-4).
- Real IP parsing/validation if `ctx.ip` is to be trusted for security decisions (R-7).

---

## Risks

- **Detection drift (R-2)** will silently misroute Netlify/edge traffic to Node/Deno code paths as new platforms appear — a correctness bug that hides until a specific deploy target is used.
- **Capability lie (R-3)** actively fights the "future JavaScript runtimes" goal: the safest-looking default (`unknown → all false`) is the most damaging one.
- **1xx crash (R-6)** is a latent `RangeError` in the shared response path used by three adapters.
- **Class-level coupling to `@nextrush/errors` (I-4)** means an errors-package constructor change is a silent breaking change here.

---

## Technical Debt

- Duplicated edge detection (R-2) — ~40 lines that must be kept in sync by hand.
- Method/property `_stream` doc bug (R-8c) — extension contract cannot be followed as written.
- Public `@internal` test hook `resetRuntimeCache` (R-5) baked into the published surface.
- `@types/node` + `target:'node20'` in an agnostic package (R-9).

---

## Refactoring Roadmap

1. **Rename or re-document the package.** Either rename to reflect reality (e.g. `@nextrush/platform` / `@nextrush/http-primitives`) or add a top-level doc stating explicitly that lifecycle lives in core. Register it in the canonical hierarchy. *(Breaking if renamed — do before v1.0.)*
2. **Collapse detection to one function.** `detectEdgeRuntime()` should call `detectRuntime()` and only *refine* platform flags; reorder so Netlify/edge is decided before the generic `'deno'` fallback. Add a Netlify branch to `detectRuntime()`. *(Fixes R-2.)*
3. **Probe capabilities.** Replace the static matrix with feature detection; for `'unknown'`, probe rather than return all-false. *(Fixes R-3.)*
4. **Unify the error model.** Make `ServerStartError` extend the `@nextrush/errors` hierarchy (or move all three runtime errors to a single philosophy) and document the failure contract. *(Fixes R-4, I-2.)*
5. **Guard 1xx** in `getResponse()` (clamp/throw a typed error before `new Response`). *(Fixes R-6.)*
6. **Fix the `AbstractBodySource` doc/contract** (`_stream` method vs property) and make `EmptyBodySource` honor `consumed`. *(Fixes R-8.)*
7. **Add `platform: 'neutral'`** to tsup and a lint rule banning `node:` imports in `src`. *(Fixes R-9.)*
8. **Handle Set-Cookie explicitly** in `headersToRecord` via `getSetCookie()`. *(Fixes R-10.)*

---

## Final Approval

**NO — not yet approvable for a frozen v1.0.**

The primitives are solid and genuinely portable, but three items are **breaking-change-shaped** (package name/hierarchy R-1, detection contract R-2, capability contract R-3) and one is a latent crash in a shared path (R-6). These must land before an API freeze, because fixing them afterward breaks consumers. Approvable after roadmap steps 1–5.

---

## Remediation Status (2026-07-09)

Fixed in this pass (test-first, full monorepo suite green):

- **R-3** — `getRuntimeCapabilities` now delegates to a pure, exported `capabilitiesFor(runtime)`; unknown/future runtimes are answered by `probeCapabilities()` (feature-detects `fetch`/`ReadableStream`/`crypto.subtle`/…) instead of an all-`false` matrix.
- **R-4** — `ServerStartError` now extends `NextRushError` (status 500, typed code, native `cause`), sharing one failure contract with the framework.
- **R-5** — `cachedEdgeInfo` hoisted next to `cachedRuntime`; the forward reference in `resetRuntimeCache()` is gone.
- **R-6** — `WebResponseBuilder.getResponse()` throws a descriptive error for 1xx statuses instead of an opaque `RangeError`.
- **R-7** — `isValidClientIp` now performs structural IPv4/IPv6 validation (rejects `999.999.999.999`, `...`, `::::`), not a charset filter.
- **R-8** — `AbstractBodySource` extension example corrected (`_stream` implemented as a method).
- **R-9** — `tsup` now builds `platform: 'neutral'`.
- **R-10** — `headersToRecord` preserves multiple `Set-Cookie` values via `getSetCookie()`.

**R-2 — revised, not "fixed".** On implementation it became clear `detectEdgeRuntime()` and `detectRuntime()` answer *different questions* — "which edge platform" (defaulting to generic `'edge'`) vs. "which JS engine" — and are allowed to differ by design (Netlify Edge: `detectRuntime()='deno'`, `detectEdgeRuntime()` → `edge`+`isNetlify`). An initial attempt to force them equal broke the edge adapter's platform contract and was reverted. The residual issue is only minor duplication of the platform-flag probes, downgraded to **Low**; it is documented in the source and left as-is to preserve the consumer contract.

Deferred (require a major version bump + migration guide — intentionally not bundled into this fix):

- **R-1** — renaming the package / declaring it in the canonical hierarchy (touches every `@nextrush/runtime` import across the monorepo).
