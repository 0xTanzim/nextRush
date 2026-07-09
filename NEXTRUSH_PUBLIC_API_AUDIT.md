# NEXTRUSH_PUBLIC_API_AUDIT.md

**Package:** `nextrush` @ `3.1.0` (meta / public SDK)
**Source reviewed:** `src/index.ts` (functional entry), `src/class.ts` (`nextrush/class` entry), `package.json`, tests.
**Verification limit:** Read from source. The `listen(app, 8080)` vs `listen(app, { port })` cross-check is noted as "verify" — I confirmed `ServeOptions.port` exists but did not exhaustively confirm the numeric overload of `listen`.

---

## Executive Summary

The meta package is well-organized: a **DI-free functional entry** (`nextrush`) and a **class entry** (`nextrush/class`) that alone pulls in `reflect-metadata` (correctly flagged via `sideEffects: ["./dist/class.js"]`), with a clear, documented rationale for not loading tsyringe on the functional path. `createApp()` wires a default router so `app.get(...)` works out of the box. Barrel exports are curated (not `export *`), which is good for tree-shaking and API control.

Three issues matter for a frozen public surface: (1) a **`@deprecated` function (`catchAsync`) is exported from the top-level SDK** and listed in the README as a normal utility — a deprecated no-op should not be in the 1.0 public surface; (2) a **`RouteMetadata` name collision across entry points** (`nextrush` re-exports the `@nextrush/types` `RouteMetadata`; `nextrush/class` re-exports a *different* `RouteMetadata` from `@nextrush/class`); (3) **two names for one function** (`createError` in `nextrush`/errors vs `createHttpError` in `@nextrush/core`).

---

## Architecture Score

**82 / 100 (B-)** — clean functional/class split, DI-free functional path, curated barrels, correct `sideEffects`.

## API Design Score

**74 / 100 (C)** — deprecated symbol in the surface, a cross-entry-point type-name collision, and a dual-name function pull this down.

## Maintainability Score

**85 / 100 (B)** — the meta package is thin re-export glue; easy to reason about.

## Production Readiness Score

**80 / 100** — solid; the blockers are surface-stability items to settle before freeze, not runtime bugs.

---

## Findings

| ID | Severity | Finding | Evidence |
|----|----------|---------|----------|
| **N-1** | High | **Deprecated `catchAsync` is in the public SDK surface.** It is `@deprecated` in `@nextrush/errors` (a no-op identity fn) yet re-exported from `nextrush` and listed in the `nextrush` README as a plain "error utility" with no deprecation marker. Freezing a 1.0 that exports a deprecated no-op locks it in; new users will adopt it from the README. | `nextrush/src/index.ts` L148; `nextrush/README.md` L27, L167 |
| **N-2** | High | **`RouteMetadata` collides across entry points.** `nextrush` exports `RouteMetadata` from `@nextrush/types` (the OpenAPI/introspection shape), while `nextrush/class` exports a *different* `RouteMetadata` from `@nextrush/class` (the decorator route metadata). A user importing both entries gets two incompatible types under one name — confusing and a footgun for tooling. | `nextrush/src/index.ts` (types block) vs `nextrush/src/class.ts` (type export block) |
| **N-3** | Medium | **Two names for one function.** `nextrush`/`@nextrush/errors` expose `createError`; `@nextrush/core` re-exports the same function as `createHttpError`. Consumers reading core docs vs SDK docs see different names for identical behavior. | `nextrush/src/index.ts` `createError`; `core/src/errors.ts` `createError as createHttpError` |
| **N-4** | Medium | **New error-model public APIs are not reachable from the SDK.** `ERROR_CODES`, `codeForStatus`, and `HttpError.fromJSON` (added to `@nextrush/errors`) are **not** re-exported by `nextrush`, so SDK users can't use the canonical code registry or cross-boundary reconstruction without a direct `@nextrush/errors` dependency. Either export them or document the `@nextrush/errors` requirement. | `nextrush/src/index.ts` errors block (no `ERROR_CODES`/`codeForStatus`/`fromJSON`) |
| **N-5** | Low | **No `ValidationError` in the SDK error surface.** Validation is a first-class concern (`@nextrush/validation` exists), but the top-level `nextrush` errors barrel omits `ValidationError`/`ValidationIssue`, so functional users must reach into `@nextrush/errors`. | `nextrush/src/index.ts` errors block |
| **N-6** | Low | **Low-level `compose` exported at the top level.** `compose` is a middleware-engine primitive; surfacing it in the SDK invites misuse and enlarges the frozen surface. Fine to keep, but it belongs in `@nextrush/core` for advanced users, not the batteries-included SDK. | `nextrush/src/index.ts` `export { Application, compose }` |
| **N-7** | Low | **Version scheme vs "v1.0".** The package is `3.1.0` while this audit targets a "stable v1.0 release," and `@deprecated … v4` notes exist. The SemVer narrative must be reconciled before any 1.0 claim (same finding as prior audits). | `nextrush/package.json` `"version": "3.1.0"` |
| **N-8** | Info | `listen(app, 8080)` (README/most docs) and `listen(app, { port: 8080 })` (core README) both appear. Confirm `listen` accepts the numeric overload so every doc example runs. | `nextrush/README.md` L53 vs `core/README.md` L70; `adapter-node` `ServeOptions.port` |

---

## Risks

- **N-1/N-2** are the classic "you can't fix this after 1.0 without a breaking change" traps — a deprecated export and a colliding type name both become permanent contracts the moment the surface freezes.
- **N-4** creates a split-brain error API: the model has capabilities the SDK can't reach, so SDK users write ad-hoc code the framework already provides.

---

## Missing Capabilities

- Re-export (or explicitly document) `ERROR_CODES`/`codeForStatus`/`fromJSON`/`ValidationError` from the SDK (N-4, N-5).
- A single canonical function name (`createError`) — deprecate `createHttpError` (N-3).
- Entry-point type-name disambiguation for `RouteMetadata` (N-2).

---

## Technical Debt

- Deprecated `catchAsync` in the surface (N-1); dual `createError`/`createHttpError` name (N-3); `RouteMetadata` collision (N-2).

---

## Refactoring Roadmap

1. **Remove `catchAsync` from the `nextrush` surface** (keep only in `@nextrush/errors` as `@deprecated`) and delete it from the README utility list. *(N-1. Do before freeze.)*
2. **Disambiguate `RouteMetadata`** — rename one (e.g. `RouteDocMetadata` for the types/OpenAPI one, or `ControllerRouteMetadata` for the class one) or don't re-export the class one under the bare name. *(N-2.)*
3. **Pick one function name** — standardize on `createError`; `@deprecated` `createHttpError`. *(N-3.)*
4. **Export the new error-model APIs** (`ERROR_CODES`, `codeForStatus`, `HttpError.fromJSON`, `ValidationError`) from `nextrush`, or document the `@nextrush/errors` dependency. *(N-4, N-5.)*
5. Reconcile the version/SemVer story before any 1.0 tag (N-7); confirm the `listen` numeric overload and make examples consistent (N-8).

---

## Final Approval

**NO — not yet approvable for a frozen v1.0.** The organization is good and there are no runtime bugs here, but a 1.0 surface must not ship a deprecated export (N-1) or a colliding public type name (N-2), and the SDK should expose the error capabilities its own model added (N-4). All are small, surface-level fixes; approvable after roadmap steps 1–4.
