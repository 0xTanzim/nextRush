# CORE_PACKAGE_REVIEW.md

**Scope:** Cross-package review of `@nextrush/runtime` @ `3.1.0` and `@nextrush/errors` @ `3.1.0`, and their interaction.
**Companion reports:** `RUNTIME_ARCHITECTURE_AUDIT.md`, `ERRORS_ARCHITECTURE_AUDIT.md`.
**Verification limit:** Dependency direction and all integration claims are verified from `package.json` manifests and `import` statements in source. Packages were not executed.

---

## Overall Core Architecture Score

**66 / 100 (C)**

Two individually-decent packages with a **clean, acyclic dependency graph** but **undeclared boundaries, class-level (not interface-level) coupling, and two competing error philosophies straddling the seam between them**. The engineering is competent; the *architecture-as-contract* is not yet frozen-quality.

---

## Runtime ↔ Errors Integration Review

**Actual dependency direction (verified from manifests + imports):**

```
@nextrush/types   (root, no deps)
      ▲
      │  imported by both
      │
@nextrush/errors  (dependencies: @nextrush/types)
      ▲
      │  runtime imports concrete error CLASSES from errors
      │
@nextrush/runtime (dependencies: @nextrush/errors, @nextrush/types)
```

- `packages/errors/package.json` → `dependencies: { "@nextrush/types": "workspace:*" }` only.
- `packages/runtime/package.json` → `dependencies: { "@nextrush/errors": "workspace:*", "@nextrush/types": "workspace:*" }`.
- `packages/runtime/src/body-source.ts` → `import { BadRequestError, PayloadTooLargeError } from '@nextrush/errors'`.

**Verdict: no circular dependency.** `types → errors → runtime` is a clean DAG. However, three integration problems exist:

- **I-2 — Split error surface.** `runtime` re-exports `BodyConsumedError`/`BodyTooLargeError` (which *are* `@nextrush/errors` subclasses) **and** `ServerStartError` (a native `Error`, not in the hierarchy). A consumer catching `NextRushError` catches body errors but silently misses startup errors — an inconsistent failure boundary across one package.
- **I-3 — `errorHandler` cannot normalize `ServerStartError`.** Because it isn't a `NextRushError`/`HttpError`, it falls into `errorHandler`'s generic 500 branch (name/message only). Impact is low (startup errors don't traverse HTTP handlers), but the two packages do not share one failure contract.
- **I-4 — Class-level coupling, not interface-level.** `runtime` depends on concrete `@nextrush/errors` *constructors*, so any change to `BadRequestError`/`PayloadTooLargeError` constructor options is a **silent breaking change** to `runtime`'s body-source. Nothing (interface, test contract, or doc) pins this cross-boundary invariant.

---

## Cross-Package Dependency Analysis

| Aspect | Status | Note |
|--------|--------|------|
| Circular dependency | ✅ None | `types → errors → runtime` is acyclic |
| Direction correctness | ⚠️ Undeclared | `runtime` is **absent** from the canonical hierarchy in `v3-architecture.instructions.md` and `global-rules.instructions.md` (`types → errors → core → router → …`). The real `runtime → errors` edge is undocumented. |
| Coupling type | ❌ Concrete classes | `runtime` imports error *classes*, not an interface (I-4) |
| Boundary via `@nextrush/types` | ✅ Good | `Runtime`/`BodySource`/`RuntimeCapabilities` are canonically defined in `@nextrush/types` and re-exported — correct inversion |
| Shared constants | ✅ Good | `constants.ts` centralizes timeout defaults (per prior audit F-16) |
| Latent cycle risk | ⚠️ Real | If a future refactor moves a body-error *down* into `runtime` and `errors` ever needs it, a cycle appears — and no documented invariant prevents it |

---

## Architectural Gaps

1. **No declared home for `runtime` in the hierarchy.** The project's own steering enumerates the package order and omits `runtime`. An undeclared package is an ungoverned package.
2. **No shared failure contract.** Two error base philosophies (`NextRushError` hierarchy vs native `Error` in `ServerStartError`) span the seam (I-2, I-3, R-4).
3. **No interface between `runtime` and `errors`.** Coupling is to concretes (I-4).
4. **Error model is HTTP-coupled** (`errors/middleware.ts` imports `Context`), so neither the error model nor `runtime` (which depends on it) is cleanly usable in a non-HTTP transport — despite `runtime` explicitly targeting edge/serverless.
5. **No diagnosability across a boundary** — no `cause` serialization (E-2), no trace id (E-5), no `fromJSON` (E-7). For an edge/distributed framework this is the biggest gap.

---

## Consistency Issues

| Theme | `@nextrush/errors` | `@nextrush/runtime` | Verdict |
|-------|--------------------|---------------------|---------|
| `cause` handling | own property, `super(message)` only, not serialized (E-2) | native `super(message,{cause})` (`ServerStartError`) | **Inconsistent across core packages** |
| Error base | `NextRushError` hierarchy | mixed: hierarchy (body) **+** native `Error` (startup) | **Inconsistent** |
| Error `code` | free-form strings, factory drift (E-3/E-4) | more free-form strings (`BODY_CONSUMED`, `BODY_TOO_LARGE`, `INVALID_JSON`, …) with no registry | **Inconsistent, no single registry** |
| Immutability | `readonly` refs, not frozen (E-6) | plain `readonly` fields | Consistent (both un-frozen) |
| Version | `3.1.0`, `@deprecated … v4` | `3.1.0` | Both contradict the audit's "v1.0" framing |

---

## Production Readiness Assessment

Both packages are **functionally usable today** and are already consumed by the adapter layer. Neither is **contract-stable enough to freeze at v1.0**. The blockers are almost entirely *contract* issues (naming, `code` stability, `cause`/trace serialization, model/transport separation) rather than functional bugs — which is the correct time to fix them, since each becomes a breaking change once frozen. The lone functional latent crash is R-6 (1xx `Response`).

The audit's framing ("stable v1.0") also collides with the packages' own `3.1.0` version and `v4` deprecation notes; the SemVer story must be reconciled before any release decision.

---

## Top 10 Highest-Priority Improvements

1. **[errors] Central `ErrorCode` registry + factory/class unification.** Kills the `createError` code drift (E-3) and the three-`500`-codes problem (E-4). *Breaking — do first.*
2. **[errors] Serialize `cause` (recursive, cycle-guarded) and use native `super(message,{cause})`.** Restores cross-boundary diagnosability (E-2).
3. **[errors] Split HTTP middleware out of the error model.** Decouple from `@nextrush/types.Context` (E-1); lets `runtime` and non-HTTP consumers use errors cleanly.
4. **[runtime] Rename/re-scope + register in the hierarchy.** The package is HTTP primitives, not a runtime; declare its `→ errors` edge (R-1, I-1).
5. **[runtime] Collapse duplicated detection and fix the Netlify divergence** between `detectRuntime`/`detectEdgeRuntime` (R-2).
6. **[runtime] Probe capabilities instead of a static matrix** so unknown/future runtimes aren't reported as feature-less (R-3).
7. **[both] Unify the error philosophy across the seam.** Make `ServerStartError` part of the `NextRushError` hierarchy (R-4, I-2, I-3).
8. **[errors] Add correlation/trace identity** (`requestId`/`traceId`/`timestamp`) to the base error (E-5), populated by the (relocated) error middleware.
9. **[runtime] Guard 1xx in `WebResponseBuilder.getResponse()`** to remove the latent `RangeError` (R-6); handle inbound `Set-Cookie` via `getSetCookie()` (R-10).
10. **[both] Reconcile versioning and remove deprecated no-ops** (`catchAsync`, `ErrorContext`, `ErrorMiddleware`) before any freeze (E-8); decouple `runtime→errors` via an interface or a shared test contract to stop silent breakage (I-4).

---

## Release Recommendation

### ⛔ Needs Major Refactoring (before v1.0)

Not "Not Production Ready" — the code runs, is consumed, and is reasonably safe. Not "Needs Minor Improvements" — the outstanding items are **public-contract changes** (error `code` semantics, `cause`/trace serialization, error-model/transport separation, `runtime` package identity) that are **breaking if deferred past a 1.0 freeze**.

**Gate for v1.0:** Top-10 items 1–4 and 7 are mandatory (all contract-shaped). Items 5, 6, 9 are strongly recommended (correctness). Items 8, 10 can follow in a 1.x minor.

The determining factor is timing, not severity: freezing these APIs now locks in the inconsistencies permanently. Refactor the contracts first, then freeze.

---

## Remediation Status (2026-07-09)

Contained, non-breaking fixes landed across both packages, test-first, gated on the **full monorepo test suite (all green)** and repo-wide type-check:

- errors: E-2 (cause serialization), E-3/E-4 (central code registry + factory consistency), E-5 (correlation identity), E-6 (immutability), E-7 (`fromJSON`). New tests: `packages/errors/src/__tests__/audit-fixes.test.ts`.
- runtime: R-3 (capability probing), R-4 (`ServerStartError` joins the hierarchy), R-5 (forward-ref), R-6 (1xx guard), R-7 (structural IP validation), R-8 (doc), R-9 (`platform: 'neutral'`), R-10 (Set-Cookie). New tests: `packages/runtime/src/__tests__/audit-fixes.test.ts`.
- R-2 revised to Low (by-design difference, not drift — see runtime report); an incorrect first attempt was caught by the edge adapter suite and reverted.

Still gating a frozen v1.0 (each is a **major-version breaking change** and was deliberately not bundled into this fix):

- **R-1** — `runtime` package rename + hierarchy declaration.
- **E-1** — split HTTP middleware out of the error model.
- **E-8** — remove deprecated exports (`catchAsync`, `ErrorContext`, `ErrorMiddleware`) at v4.

**Updated posture:** the contract-shaped consistency/diagnosability gaps (error codes, cause/trace serialization, deserialization) are now resolved. The remaining v1.0 blockers are the three structural/naming breaking changes above, which need a coordinated major release with a migration guide — not a cleanup commit.
