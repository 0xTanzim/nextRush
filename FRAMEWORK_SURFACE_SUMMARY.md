# FRAMEWORK_SURFACE_SUMMARY.md

**Packages:** `@nextrush/core`, `@nextrush/router`, `nextrush` (public SDK) @ `3.1.0`
**Companion reports:** `CORE_ARCHITECTURE_AUDIT.md`, `ROUTER_ARCHITECTURE_AUDIT.md`, `NEXTRUSH_PUBLIC_API_AUDIT.md`, `DOCUMENTATION_AUDIT.md`.
**Verification limit:** Source-read audit; no re-execution for this report (repo test suite was green in the prior session). Behavioral claims are tied to cited code paths.

---

## Overall Core Architecture Score

**76 / 100 (C+)**

Three competent packages with a **clean, acyclic dependency graph** and a **strong extension model**, held back from a freeze by a handful of contract/correctness/naming issues that are individually small but collectively "you can't fix this after 1.0."

| Package | Arch | API | Maint | Prod-Ready | Approve |
|---------|------|-----|-------|------------|---------|
| `@nextrush/core` | 73 | 78 | 76 | 72 | **NO** |
| `@nextrush/router` | 79 | 76 | 68 | 76 | **NO** |
| `nextrush` (SDK) | 82 | 74 | 85 | 80 | **NO** |

---

## Cross-Package Dependency Analysis

**Verified from manifests + imports:**

```
@nextrush/types ──► @nextrush/errors ──► @nextrush/core ──► nextrush (SDK)
      ▲                                        ▲   ▲
      └──────────── @nextrush/router ──────────┘   │
                    (types only; core is an        │
                     OPTIONAL peer dep)            all of core/router/errors/
                                                   di/class/adapter-node
```

- **No circular dependencies.** `router` depends only on `@nextrush/types`; it references `core` solely as an *optional peer* (devDep for tests). Core references the router only through the `Router` type and the `Routable` interface — so **core→router is type-only**, no runtime cycle. This is the right call and is the framework's best structural decision.
- `nextrush` composes everything; `nextrush/class` is a separate entry that alone loads `reflect-metadata` (correctly `sideEffects`-flagged). Good tree-shaking posture.

## Architectural Cohesion & Boundaries

Boundaries are **correctly defined** at the dependency level. The cohesion problems are at the *contract* level:

- **Error handling is split-brained.** Core's default handler duck-types errors and emits `{ error }`; `@nextrush/errors` middleware emits `{ error, message, code, status, … }`; core *depends on* errors but doesn't use its serialization. One framework, two error shapes. (Core C-1.)
- **Naming leaks across boundaries.** `createError` (SDK) vs `createHttpError` (core) for one function; `RouteMetadata` means two different types across `nextrush` vs `nextrush/class`. (SDK N-2, N-3.)
- **The router advertises a data structure it isn't** ("radix tree" everywhere, segment trie in reality). (Router RT-2, Docs.)

## Consistency Issues (framework-wide)

| Theme | Where |
|-------|-------|
| Radix tree vs segment trie | package.json, all READMEs, `index.ts`, `radix-tree.ts`, wiki, skill — vs the code + `overview.mdx` |
| Two error response shapes | `core` default handler vs `@nextrush/errors` middleware |
| Deprecated `catchAsync` in the public surface | `nextrush` index + README (plain), MDX (deprecated) |
| Dual function name | `createError` / `createHttpError` |
| `RouteMetadata` type-name collision | `nextrush` vs `nextrush/class` |
| `process`/`console` in core | `core` `compose()` — violates global-rules §2 |
| File-size ceiling breaches | `router.ts` 1,125 lines, `application.ts` 671 lines (ceiling 300) |
| Version 3.1.0 vs "v1.0" target | all package.json |

## Production Readiness Assessment

**Functionally strong, contract-unstable.** The hot paths (router dispatch, middleware compose) are well engineered and fast; the extension lifecycle is robust. But a 1.0 that thousands depend on should not freeze with: two correctness bugs (`router.reset()` leaking `routeDefinitions` — RT-1; core re-boot double-mount — C-2), a portability violation (`process` in core — C-4), a pervasive public misnomer (radix/trie), a deprecated symbol in the surface (N-1), and a colliding public type name (N-2). None require a redesign; all are contained.

**Observability is the notable capability gap** across all three: no built-in request logging/timing/trace-id propagation, and the default logger is a silent no-op — a production 5xx is silent unless the user wires both a logger and the errors middleware.

## Top 10 Highest-Priority Improvements (framework-wide)

1. **[core] Unify error handling** — default handler delegates to `@nextrush/errors` (one JSON shape). *(C-1)*
2. **[router] Fix `reset()`** to clear `routeDefinitions` + regression test. *(RT-1)*
3. **[core] Fix re-boot** — clear `middlewareStack` in `close()` (or make router-mount idempotent). *(C-2)*
4. **[all] Resolve radix-tree vs segment-trie** — rename to segment trie consistently across code, types, filenames, and every doc. *(RT-2, Docs P1)*
5. **[core] Remove `process`/`console` from core** — inject the dev-warning flag via options. *(C-4)*
6. **[SDK] Remove deprecated `catchAsync`** from the public surface + README. *(N-1)*
7. **[SDK] Disambiguate `RouteMetadata`** across entry points; standardize on `createError` (deprecate `createHttpError`). *(N-2, N-3)*
8. **[router] Split `router.ts` (1,125→≤300/file)** and unify the two `redirect()` implementations. *(RT-3, RT-4)*
9. **[SDK] Export/document the new error-model APIs** (`ERROR_CODES`, `codeForStatus`, `fromJSON`, `ValidationError`). *(N-4, N-5)*
10. **[all] Add baseline observability** (request logging/timing hook, non-silent production 5xx) and reconcile the SemVer story before tagging 1.0. *(C-7, N-7)*

---

## Release Recommendation

### ⚠️ Needs Minor-to-Major Improvements — NOT ready for a frozen v1.0

Closer to shippable than the errors/runtime pair was, because the engineering is sound and the dependency graph is clean. But a *frozen* 1.0 public surface must not lock in: a deprecated export, a colliding public type name, a dual function name, a data-structure misnomer stamped across the package name and docs, and two divergent error shapes — every one of these becomes a breaking change to fix afterward. Add two real correctness bugs (`reset()`, re-boot) and one portability violation (`process` in core), and the honest verdict is:

- **Blockers for v1.0 (must fix first):** Top-10 items 1–7 (contract + correctness + portability + naming).
- **Strongly recommended:** items 8–10 (maintainability, capability parity, observability).
- **Determining factor:** timing, not severity — the engine is good, but the *surface and naming* aren't frozen-quality yet.

**Path to YES:** land Top-10 items 1–7 with regression tests, then re-audit the surface. At that point core/router/SDK are all approvable. The remaining deferred items from earlier audits (runtime package rename, error middleware/model split, deprecated-export removal at a major) should be sequenced into the same pre-1.0 hardening milestone so the whole public surface freezes once, cleanly, with one migration guide.
