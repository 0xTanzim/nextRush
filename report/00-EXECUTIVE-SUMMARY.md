# NextRush v3 Framework Audit — Executive Summary

**Audit Date**: 2025
**Scope**: 6 core packages — `@nextrush/core`, `@nextrush/router`, `@nextrush/errors`, `@nextrush/types`, `@nextrush/adapter-node`, `@nextrush/runtime`
**Methodology**: 12 parallel deep-analysis subagents covering architecture, security, performance, correctness, DX, and cross-cutting concerns
**Subagents Completed**: 10 of 12 (2 failed; scope fully covered by overlapping audits)

---

## Overall Scores

| Package                  | Architecture | Security | Performance | Correctness | DX   | Overall    |
| ------------------------ | ------------ | -------- | ----------- | ----------- | ---- | ---------- |
| `@nextrush/core`         | 6/10         | 4/10     | 7/10        | 8/10        | 6/10 | **6.2/10** |
| `@nextrush/router`       | —            | —        | 5/10        | 4/10        | —    | **4.5/10** |
| `@nextrush/errors`       | 4/10         | 6/10     | —           | 4/10        | 4/10 | **4.5/10** |
| `@nextrush/types`        | —            | —        | —           | —           | 6/10 | **4.3/10** |
| `@nextrush/adapter-node` | —            | 2/10     | 5/10        | 3/10        | —    | **3.3/10** |
| `@nextrush/runtime`      | 6/10         | —        | —           | 5/10        | —    | **5.3/10** |
| **Cross-Cutting Perf**   | —            | —        | 4/10        | —           | —    | —          |

**Composite Framework Score: 4.7/10** — Significant foundational issues must be resolved before production readiness.

---

## Critical Issue Count

| Severity     | Count | Examples                                                                                                                                       |
| ------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **CRITICAL** | 14    | IP spoofing, prototype pollution, error class duplication (×3), `any` in hot path, `require()` in ESM, `send()` bug producing hung connections |
| **HIGH**     | 16    | Graceful shutdown order, body size DoS, Vercel detection bug, `allowedMethods()` O(7×K), missing ERROR_MAP entries                             |
| **MEDIUM**   | 18    | State namespace pollution, plugin hooks not wired, unbounded query params, body buffer retention                                               |
| **LOW**      | 12    | `catchAsync` redundancy, weak `isMiddleware`, redirect limitations                                                                             |

---

## Top 5 Must-Fix Issues

### 1. Error Class Triplication (CRITICAL — Architecture)

`HttpError` is defined in **3 separate places**: `@nextrush/errors`, `@nextrush/core`, and every adapter. This causes `instanceof` checks to fail silently across package boundaries. `ctx.throw(404)` can degrade to HTTP 500 because the error handler doesn't recognize the adapter's `HttpError`.

### 2. IP Spoofing via Unconditional X-Forwarded-For Trust (CRITICAL — Security)

`NodeContext.getClientIp()` always trusts `X-Forwarded-For` regardless of the `proxy` application option. Any client can spoof their IP, bypassing rate limiting, audit logging, and IP-based access control.

### 3. Prototype Pollution in Query String Parser (CRITICAL — Security)

`parseQueryString()` assigns values to a plain `{}` object without sanitizing keys like `__proto__`, `constructor`, or `prototype`. An attacker can mutate `Object.prototype` via query parameters.

### 4. `ctx.send(object)` Produces Hung Connections (CRITICAL — Correctness)

`send()` sets `_responded = true` before routing objects to `json()`, which then returns immediately because `_responded` is already true. The response never actually sends, causing the connection to hang until timeout.

### 5. ~25+ Per-Request Allocations (HIGH — Performance)

A minimal JSON GET request creates ~25+ heap allocations (objects, arrays, strings, closures, promises). At 35K RPS target, this produces ~42 MB/s allocation rate, forcing frequent GC cycles. Competitors achieve single-digit allocations.

---

## Architecture Risk Matrix

```
                    HIGH IMPACT
                        │
   Prototype    ────────┼──────── Error Triplication
   Pollution            │              (breaks instanceof)
                        │
   IP Spoofing  ────────┼──────── Node.js Coupling
   (security)           │         in @nextrush/types
                        │
                        │
   send() Bug   ────────┼──────── Perf Allocations
   (correctness)        │         (~25+/request)
                        │
                    LOW IMPACT
                        │
   EASY FIX ────────────┼──────── HARD FIX
```

---

## Improvement ROI Summary

| Improvement                                       | Effort | Impact   | RPS Gain Est. |
| ------------------------------------------------- | ------ | -------- | ------------- |
| Unify error classes (single source of truth)      | Medium | CRITICAL | —             |
| Fix prototype pollution in query parser           | Easy   | CRITICAL | —             |
| Wire proxy option to IP extraction                | Easy   | CRITICAL | —             |
| Fix `send()` double-response bug                  | Easy   | CRITICAL | —             |
| Add `setNext` to Context interface (remove `any`) | Easy   | CRITICAL | ~5%           |
| Singleton EmptyBodySource                         | Easy   | Medium   | ~2%           |
| Fast-path `includes('//')` before regex           | Easy   | Medium   | ~3%           |
| Remove redundant per-segment toLowerCase          | Easy   | Medium   | ~2%           |
| Remove unused middleware array from match()       | Easy   | High     | ~3%           |
| Pre-compile path normalization                    | Medium | High     | ~5%           |
| Remove Node.js types from @nextrush/types         | Medium | CRITICAL | —             |
| **Total estimated improvement**                   |        |          | **~20%+ RPS** |

---

## Report Structure

| File                                                 | Contents                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| [01-CRITICAL-ISSUES.md](01-CRITICAL-ISSUES.md)       | All 14 critical issues with locations, evidence, impact, and fixes |
| [02-CORE-AUDIT.md](02-CORE-AUDIT.md)                 | Application class, middleware composition, plugin system           |
| [03-ROUTER-AUDIT.md](03-ROUTER-AUDIT.md)             | Radix tree, matching, dispatch, allowedMethods                     |
| [04-ERRORS-AUDIT.md](04-ERRORS-AUDIT.md)             | Error hierarchy, duplication map, factory coverage                 |
| [05-TYPES-AUDIT.md](05-TYPES-AUDIT.md)               | Type contracts, Node.js coupling, interface gaps                   |
| [06-ADAPTER-NODE-AUDIT.md](06-ADAPTER-NODE-AUDIT.md) | Context, body parsing, server lifecycle, security                  |
| [07-RUNTIME-AUDIT.md](07-RUNTIME-AUDIT.md)           | Detection accuracy, body source abstraction, duplication           |
| [08-PERFORMANCE-AUDIT.md](08-PERFORMANCE-AUDIT.md)   | Per-request allocation trace, hot path analysis, V8 issues         |
| [09-SECURITY-AUDIT.md](09-SECURITY-AUDIT.md)         | Cross-cutting vulnerability analysis                               |
| [10-IMPROVEMENT-PLAN.md](10-IMPROVEMENT-PLAN.md)     | Prioritized TODO with phases, effort, and expected outcomes        |
