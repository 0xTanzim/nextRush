# CORE_ARCHITECTURE_AUDIT.md

**Package:** `@nextrush/core` @ `3.1.0`
**Source reviewed:** `application.ts` (671 lines), `middleware.ts` (159), `errors.ts`, `index.ts`, tests.
**Verification limit:** Findings are read from source; packages were not re-executed for this report (the repo test suite is green as of the prior session). Behavioral claims about re-boot and error-shape are reasoned from the code paths cited.

---

## Executive Summary

`@nextrush/core` is a small, focused package: an `Application` (middleware stack, extension lifecycle, router delegation, error handling) plus Koa-style `compose()`. The extension model is genuinely well done — registration-order `setup()`, `needs` dependency pre-flight, `Object.defineProperty` decoration with collision detection, config-freeze after `ready()`, and reverse-order `Promise.allSettled` teardown. Dependency direction is clean (`types → errors → core`; the router is referenced only via the `Router` type and a `Routable` interface, so there is **no** core→router cycle).

But three things block a confident v1.0: (1) **core reimplements a minimal, divergent error response shape** instead of using `@nextrush/errors` — the framework now has two different error JSON shapes; (2) **`route()` mutates the readonly `ctx.path`** through a cast, an abstraction leak with fragile save/restore logic; (3) a **re-boot bug** — `close()` never clears `middlewareStack`, so a `close()`→`ready()` cycle (an explicitly supported "re-boot in tests" scenario) double-mounts the router and all user middleware. Plus a global-rules violation: `compose()` reads `process.env` in a package that rules forbid from touching `process`.

---

## Architecture Score

**73 / 100 (C)** — clean boundaries and a strong extension model, undercut by the error-shape divergence, the `ctx.path` mutation, and `process` usage in core.

## API Design Score

**78 / 100 (C+)** — chainable, predictable, freeze-after-ready is excellent DX; the `app.all()`-not-`app.options()` decision is documented. Minor: `setErrorHandler` isn't guarded by `assertConfigurable` (mutable after ready, unlike everything else).

## Maintainability Score

**76 / 100 (C+)** — `middleware.ts` is tidy; `application.ts` at **671 lines exceeds the 300-line hard ceiling** in `code-structure.md` and mixes middleware registration, router delegation, extension lifecycle, and error handling in one class (SRP pressure).

## Production Readiness Score

**72 / 100** — usable, with the re-boot bug and error-shape inconsistency as the notable gaps.

---

## Findings

| ID | Severity | Finding | Evidence |
|----|----------|---------|----------|
| **C-1** | High | **Two error response shapes in the framework.** `defaultErrorHandler` duck-types `error.status`/`error.expose` and emits `ctx.json({ error: message })` — only an `error` key. The `@nextrush/errors` `errorHandler()` emits `{ error, message, code, status, details?, issues?, cause? }`. Core *depends on* `@nextrush/errors` (package.json) but its `errors.ts` only re-exports classes; the default handler ignores `isHttpError`/`getErrorStatus`/`toJSON`. An app without the errors middleware gets a minimal, code-less shape; adding the middleware silently changes the contract. | `application.ts` — `defaultErrorHandler`; vs `packages/errors/src/middleware.ts` — `errorHandler` |
| **C-2** | High | **Re-boot double-mounts middleware.** `close()` clears `extensions`, `decorations`, and sets `_isReady=false`, but never clears `middlewareStack`. `ready()` pushes `this.router.routes()` onto the stack. A supported `close()`→`ready()` cycle (the `decorate()` comment states re-boot "e.g. in tests" is intended) therefore leaves the router mounted twice and every user middleware runs on the stale stack again. | `application.ts` — `close()` (no `middlewareStack` reset) + `ready()` (`middlewareStack.push(this.router.routes())`) |
| **C-3** | Medium | **`route()` mutates readonly `ctx.path`.** Path rewriting casts away readonly: `(ctx as { path: string }).path = adjustedPath`, with a save/restore dance inside the mounted middleware's `next()` (restore original for downstream, re-adjust after). This is an abstraction leak (Context.path is a public read contract) and the nested restore logic is fragile if a downstream middleware also rewrites `path`. | `application.ts` — `route()` |
| **C-4** | Medium | **`process.env` used in a core package.** `compose()` reads `process.env.NODE_ENV` for `warnDoubleResponse`; the double-next warning uses `console.warn`. `global-rules.instructions.md` §2 explicitly forbids "Runtime-specific APIs in core packages (`process`, `Deno`, `Bun`)" and `console.log` in production code. This couples core to Node and breaks the edge-agnostic story core otherwise supports. | `middleware.ts` — `compose()` `process.env.NODE_ENV`, `console.warn` |
| **C-5** | Medium | **`application.ts` exceeds the 300-line hard ceiling (671 lines)** and the `Application` class carries four responsibilities (middleware, routing delegation, extension lifecycle, error handling). Split candidates: extension lifecycle and error handling into collaborators. | `application.ts` (671 lines) |
| **C-6** | Low | **`setErrorHandler` is not frozen after `ready()`.** Every other mutator calls `assertConfigurable`; `setErrorHandler` does not, so the error handler can be swapped while serving traffic — an inconsistency in the freeze contract. | `application.ts` — `setErrorHandler` |
| **C-7** | Low | **`defaultErrorHandler` sends body without an explicit status guarantee for non-Error throws to observability.** In production it logs nothing for 5xx (`if (!this.isProduction) log`), so a production 500 is silent by default unless a logger + errors-middleware are wired. Combined with the no-op default logger, a first-time user gets zero server-side signal on crashes. | `application.ts` — `defaultErrorHandler` (`if (!this.isProduction)`) + `NOOP_LOGGER` |
| **C-8** | Info | `errors.ts` exists only to re-export a subset of `@nextrush/errors` "for backward compatibility" and renames `createError`→`createHttpError`. This is a second name for one function across packages (see cross-package report). | `errors.ts` |

---

## Risks

- **C-1** is the highest DX risk: "why does my error response look different in prod?" is a support-ticket generator, and the code-less default shape is worse for client error handling.
- **C-2** will surface as "my routes fire twice / middleware runs twice after restart" in any long-lived process that re-boots the app (test suites, hot reload, serverless warm reuse).
- **C-4** silently breaks core on a runtime without `process` (edge) — the very portability the framework advertises.

---

## Missing Capabilities

- A single, shared error-serialization path (core default handler should delegate to `@nextrush/errors`).
- Config-freeze coverage for `setErrorHandler`.
- A runtime-neutral way to gate the double-next dev warning (inject via `ApplicationOptions`/`ComposeOptions` rather than reading `process.env`).
- Any built-in request-lifecycle observability hook (timing, request id) — currently zero; the audit's observability scope is unmet in core.

---

## Technical Debt

- 671-line `Application` god-class (C-5).
- Duck-typed error handling duplicating logic that already exists in `@nextrush/errors` (C-1, C-8).
- `ctx.path` cast-and-restore (C-3).

---

## Refactoring Roadmap

1. **Unify error handling:** have `defaultErrorHandler` delegate to `@nextrush/errors` (`getErrorStatus` + `toJSON`/`toResponse`), producing one shape framework-wide. *(Fixes C-1, C-8. Behavior change — do before freeze.)*
2. **Fix re-boot:** clear `middlewareStack` (and any router-mounted entries) in `close()`, or make `ready()` idempotent w.r.t. router mounting. Add a `close()`→`ready()` regression test. *(Fixes C-2.)*
3. **Remove `process` from core:** pass the double-next warning flag through `ComposeOptions`/`ApplicationOptions`, defaulted by the adapter (which is allowed to read `process`). *(Fixes C-4.)*
4. **Split `Application`:** extract extension lifecycle and error handling into collaborators to get under the ceiling. *(Fixes C-5.)*
5. **Freeze `setErrorHandler`** after `ready()` (C-6); make production 5xx observable by default via the logger (C-7).
6. Reconsider the `ctx.path` rewrite — a scoped path view or a documented, single-owner mutation contract (C-3).

---

## Final Approval

**NO — not yet approvable for a frozen v1.0.** The extension model and dependency hygiene are strong, but C-1 (dual error shapes) is a public-contract inconsistency, C-2 is a correctness bug in a supported scenario, and C-4 breaks the portability claim. All are contained and fixable; approvable after roadmap steps 1–3.
