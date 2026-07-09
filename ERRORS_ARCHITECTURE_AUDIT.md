# ERRORS_ARCHITECTURE_AUDIT.md

**Package:** `@nextrush/errors` @ `3.1.0`
**Audit type:** Deep architectural / production-readiness review (source-verified, not doc-based)
**Files reviewed:** `index.ts`, `base.ts`, `http-errors.ts`, `factory.ts`, `validation.ts`, `middleware.ts`, `package.json`, `tsup.config.ts`.
**Verification limit:** Findings are derived from reading source; the package was not executed. All claims cite the specific construct.

---

## Executive Summary

`@nextrush/errors` provides a two-tier hierarchy (`NextRushError` → `HttpError` → per-status classes, plus `ValidationError` and subclasses), a factory, and error-handling middleware. The RFC coverage is thorough (4xx/5xx classes with correct default messages) and the security defaults are thoughtful: `expose` defaults to `status < 500`, `toJSON()` hides 5xx messages, and `ValidationError.toJSON()` strips `received` to avoid leaking secrets.

But the package has a **structural identity problem and a set of contract inconsistencies that are breaking-change-shaped**:

1. It is not a pure error *model* — it also ships **HTTP middleware coupled to `@nextrush/types.Context`**, mixing a transport-agnostic concern with a transport-specific one (SRP violation, hurts "distributed systems / transport compatibility").
2. The **`cause` chain is dropped from serialization** and bypasses native `Error` cause chaining — the one thing diagnostics need most is invisible on the wire.
3. The **factory and the classes disagree on `code`** for the same status, because `ERROR_MAP` covers only ~13 of ~40 classes.
4. There is **no central error-code registry**, **no correlation/trace identity**, **no deserialization**, and **no real immutability**.

For a framework "used by thousands of developers," these are exactly the contracts you cannot change after 1.0. The code is clean; the *contracts* are not yet stable.

---

## Architecture Score

**65 / 100 (C)**

Good hierarchy and security defaults; undermined by the model/middleware SRP violation, the missing code registry, and the factory/class drift.

## API Design Score

**62 / 100 (C-)**

Ergonomic for the common path (`throw new NotFoundError()`), but the public contract has real inconsistencies: `createError` code drift (E-3), `MethodNotAllowedError`'s odd parameter order (E-9), three different "500" codes (E-4), and deprecated no-ops shipped in the public surface (E-8).

## Error-Model Review

The model is:

```
Error
└── NextRushError            (status, code, expose, details, cause; toJSON/toResponse)
    ├── HttpError            (status-first constructor, code = HTTP_${status})
    │   ├── BadRequestError ... 27 4xx/5xx classes (semantic code per class)
    └── ValidationError      (issues[]; toJSON strips `received`)
        └── RequiredFieldError / TypeMismatchError / RangeValidationError /
            LengthError / PatternError / InvalidEmailError / InvalidUrlError
```

Strengths: single serialization source of truth (`errorHandler` delegates to `err.toJSON()`, so subclass overrides like `ValidationError` don't drift); correct `expose` gating; stack-capture skipped for exposed 4xx (perf).

Weaknesses are catalogued below (E-2, E-4, E-5, E-6, E-7, E-10).

## Extensibility Score

**70 / 100 (B-)**

Subclassing is trivial and works well (the runtime package's `BodyConsumedError`/`BodyTooLargeError` extend it cleanly). But there is **no code registry / enum**, so custom errors invent free-form `code` strings with no collision protection or enumeration; and `ERROR_MAP` in the factory is a closed set custom statuses cannot extend.

## Production-Readiness Score

**66 / 100** — solid model, unstable contract.

---

## Findings

| ID | Severity | Finding | Evidence |
|----|----------|---------|----------|
| **E-1** | High | **SRP violation / transport coupling.** The package ships `errorHandler`/`notFoundHandler`/`catchAsync` which import `Context, Middleware, Next` from `@nextrush/types`. The pure error *model* is bundled with HTTP middleware coupled to the web Context. A non-HTTP consumer (queue/gRPC/CLI) that wants only the classes drags in Context-coupled code. Hurts "transport compatibility." | `middleware.ts` — `import type { Context, Middleware, Next }` |
| **E-2** | High | **`cause` is lost and bypasses native chaining.** `NextRushError` calls `super(message)` (not `super(message, { cause })`) then sets `this.cause` as an own property; and **`toJSON()`/`toResponse()` never include `cause`**. Wrapped errors vanish from serialized output — the causal chain is invisible in logs/tracing. (Contrast: `ServerStartError` in `@nextrush/runtime` *does* use native `super(message,{cause})` — inconsistent across core packages.) | `base.ts` — `NextRushError` ctor + `toJSON` |
| **E-3** | High | **Factory ↔ class code drift.** `ERROR_MAP` maps ~13 statuses. `createError(413)` returns a generic `HttpError` with code `HTTP_413`; `new PayloadTooLargeError()` yields `PAYLOAD_TOO_LARGE`. Same status → different `code` depending on construction path. 27 typed classes are unreachable via `createError`. Consumers switching on `code` break. | `factory.ts` — `ERROR_MAP`, `createError`; `http-errors.ts` |
| **E-4** | Medium | **Three "500" codes, no registry.** `NextRushError` default `INTERNAL_ERROR`; `InternalServerError` → `INTERNAL_SERVER_ERROR`; `HttpError` base → `HTTP_${status}`; `errorHandler` fallback hardcodes `'INTERNAL_ERROR'`. Codes are scattered string literals across ~45 constructors — no enum, un-enumerable, drift-prone. | `base.ts`, `http-errors.ts`, `middleware.ts` |
| **E-5** | Medium | **No trace/correlation identity.** `NextRushError` has no `requestId`/`traceId`/`timestamp`, despite the org standard requiring correlation IDs across service boundaries. Consumers must stuff it into `details` ad hoc, unstandardized. | `base.ts` — `NextRushError` fields |
| **E-6** | Medium | **Not immutable despite `readonly`.** `details` and `ValidationError.issues` are `readonly` *references* to mutable objects/arrays; no `Object.freeze`. `error.details.x = …` and `error.issues.push(…)` both succeed. The audit's "immutability" requirement is unmet. | `base.ts`, `validation.ts` |
| **E-7** | Medium | **Serialize-only; no wire contract.** `toJSON` exists but there is no `fromJSON`/reviver, no versioned schema, no cross-boundary `instanceof` recovery. A downstream service receives a plain object; `isHttpError`/`instanceof` fail. "Distributed systems readiness" is one-directional. | `base.ts` — only `toJSON`/`toResponse` |
| **E-8** | Low | **Deprecated no-ops in the public surface.** `catchAsync` is an exported identity function marked `@deprecated`; `ErrorContext`/`ErrorMiddleware` are exported deprecated aliases "removed in v4." Shipping dead surface bloats the API and the `v4` note conflicts with a package at `3.1.0` targeting a "stable v1.0." | `middleware.ts` — `catchAsync`, `ErrorContext`, `ErrorMiddleware` |
| **E-9** | Low | **`MethodNotAllowedError` inconsistency.** Constructor is `(allowedMethods, message, options)` — parameter order differs from every other error `(message, options)`. `createError(405)` hardcodes `[]` allowed methods. `allowedMethods` is duplicated in both `details.allowedMethods` and a top-level field (can diverge). | `http-errors.ts` — `MethodNotAllowedError`; `factory.ts` |
| **E-10** | Low | **Stack capture coupled to exposure policy.** `captureStackTrace` is skipped when `expose && status < 500`. A 4xx that is actually a latent bug has no stack. Reasonable perf trade-off, but conflates "safe to expose" with "not worth a stack" — different axes. | `base.ts` — `NextRushError` ctor |
| **E-11** | Info | `getErrorStatus` duck-types any `{status:number}` in 400–599, else 500 — silently coerces a valid 1xx/3xx status object to 500. | `factory.ts` — `getErrorStatus` |

---

## Missing Capabilities

- **Central `ErrorCode` registry/enum** — required to make `code` a stable, enumerable contract (fixes E-3/E-4 root cause).
- **`cause` (recursive) in serialization** and native `super(message, { cause })` (E-2).
- **Correlation/trace identity** on the base error (E-5).
- **`fromJSON`/deserialization** and a versioned wire schema for cross-service transport (E-7).
- **True immutability** via `Object.freeze` on `details`/`issues` (E-6).
- **Model/middleware separation** — extract `errorHandler`/`notFoundHandler` out of the model package (E-1).

---

## Risks

- **E-2 + E-7** together mean NextRush errors are effectively **un-debuggable across a service boundary**: no cause, no trace id, no reconstruction. For a distributed deployment this is the highest-impact gap.
- **E-3/E-4** make `error.code` — the field consumers *should* branch on — unreliable. This is the classic "looks fine until a client depends on it, then you can't change it" trap. Must be fixed pre-freeze.
- **E-1** blocks reuse of the error model in non-HTTP contexts and couples the whole package's release cadence to the `Context` type.

---

## Technical Debt

- Deprecated exports (`catchAsync`, `ErrorContext`, `ErrorMiddleware`) shipped live (E-8).
- Free-form code strings across ~45 constructors with no single source (E-4).
- `MethodNotAllowedError` signature asymmetry + duplicated `allowedMethods` state (E-9).
- Version-scheme confusion: package at `3.1.0`, `@deprecated … v4` notes, audit asking about "v1.0."

---

## Refactoring Roadmap

1. **Split the package.** Keep `@nextrush/errors` as the pure, transport-agnostic model; move `errorHandler`/`notFoundHandler` into `@nextrush/core` or a `@nextrush/middleware-errors` package. *(Fixes E-1. Breaking — do before freeze.)*
2. **Introduce a central `ErrorCode` registry** (const object / enum) and make every class and the factory reference it; back `createError` with the *same* class map so status→code is single-valued. *(Fixes E-3, E-4.)*
3. **Fix `cause`**: use native `super(message, { cause })`; add recursive `cause` (name/message/code, guarded against cycles and depth) to `toJSON`. *(Fixes E-2.)*
4. **Add correlation identity**: optional `requestId`/`traceId`/`timestamp` on `NextRushError`, populated by the error middleware. *(Fixes E-5.)*
5. **Add `static fromJSON`** + a versioned wire schema and reconstitution helper. *(Fixes E-7.)*
6. **Freeze `details`/`issues`** (`Object.freeze`) at construction. *(Fixes E-6.)*
7. **Normalize `MethodNotAllowedError`** to `(message, options)` with `allowedMethods` in options; remove duplicated top-level state. Remove deprecated no-ops before freeze. *(Fixes E-8, E-9.)*

---

## Final Approval

**NO — not approvable for a frozen v1.0.**

The hierarchy and security defaults are good enough to ship, but the **public contract is not stable**: `code` is inconsistent (E-3/E-4), the model is coupled to HTTP transport (E-1), and errors are not diagnosable across a boundary (E-2/E-5/E-7). Every one of these is a breaking change if deferred past 1.0. Approvable after roadmap steps 1–4.

---

## Remediation Status (2026-07-09)

Fixed in this pass (test-first, full monorepo suite green):

- **E-2** — `cause` is passed to the native `Error` constructor and serialized (recursive, depth-5 cap, cycle-guarded) into `toJSON`, gated on `expose` so 5xx internals never reach clients.
- **E-3 / E-4** — new `codes.ts` (`ERROR_CODES`, `codeForStatus`) is the single source of truth; the factory `ERROR_MAP` now covers all typed statuses and `HttpError` defaults its code from the registry. `createError(413)` → `PayloadTooLargeError`/`PAYLOAD_TOO_LARGE`. A parametrized test locks class↔registry↔factory agreement.
- **E-5** — optional `requestId`/`traceId`/`timestamp` on `NextRushError`, surfaced in `toJSON` only when set (default shape unchanged).
- **E-6** — `details` and `ValidationError.issues` are frozen snapshots.
- **E-7** — `HttpError.fromJSON` / `NextRushError.fromJSON` reconstruct a typed error (with working `instanceof`) from a serialized payload.

Deferred / intentionally not changed:

- **E-1** — splitting the HTTP middleware out of the error model (moves published exports between packages → major bump + migration guide).
- **E-8** — `catchAsync`/`ErrorContext`/`ErrorMiddleware` remain: they are already `@deprecated` for v4, and removing published exports without a major bump violates the API-contract rules.
- **E-9 / E-10 / E-11** — Low/Info; changing `MethodNotAllowedError`'s signature is breaking, and the stack/expose coupling is an accepted performance trade-off.
