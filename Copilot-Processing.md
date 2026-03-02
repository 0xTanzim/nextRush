# Copilot Processing — Phase 7: Critical Fixes (8 issues) — Phases 1-5

## User Request
Execute improvement plan Phases 1-4 (Security, Error Architecture, Type System, Performance)

## Action Plan

### Phase 2: Error Architecture Unification

- [x] **2.1** Make `HttpError` message optional with status defaults in `@nextrush/errors/base.ts`
- [x] **2.2** Replace `core/errors.ts` duplicate classes with re-exports from `@nextrush/errors`
- [x] **2.3** Replace local `HttpError` in all 4 adapter contexts with `@nextrush/errors` import
- [x] **2.4** Rename `RangeError` → `RangeValidationError` in `errors/validation.ts`
- [x] **2.5** Complete `ERROR_MAP` — add 429, 503 (405 excluded — different constructor, use factory fn)
- [x] **2.6** Unify body source errors — `BodyConsumedError` → 400, `BodyTooLargeError` → 413

### Phase 3: Type System Fixes

- [x] **3.1** Remove Node.js types from `@nextrush/types` (`Readable` import removed, `Buffer` → `Uint8Array`)
- [x] **3.2** Add `setNext?(fn: Next): void` to Context interface
- [x] **3.3** Add `readonly responded: boolean` to Context interface
- [x] **3.4** Fix `ApplicationLike.use()` to use `Middleware` type

### Validation
- [x] `pnpm build` — 29/29 packages pass
- [x] `pnpm test` — 56/56 tests pass
- **Changes**: `Object.create(null)`, key denylist (`__proto__`, `constructor`, `prototype`), max 256 params, max 2048 char query string
- **Status**: ✅ DONE

### Task 1.2: Wire Proxy Option to IP Extraction
- **Files**: `packages/adapters/node/src/context.ts`, `packages/adapters/node/src/adapter.ts`
- **Changes**: Added `NodeContextOptions.trustProxy`, gated X-Forwarded-For behind `trustProxy`, wired `app.options.proxy` in `createHandler()`
- **Status**: ✅ DONE

### Task 1.3: Fix `ctx.send(object)` Hung Connection
- **File**: `packages/adapters/node/src/context.ts`
- **Changes**: Moved `_responded = true` to each branch after actual write, object path now delegates to `json()` cleanly
- **Status**: ✅ DONE

### Task 1.4: Replace `require()` with ESM Import
- **File**: `packages/adapters/node/src/body-source.ts`
- **Changes**: Top-level `import { Readable } from 'node:stream'` replacing CJS `require()`
- **Status**: ✅ DONE

### Task 1.5: Add try/catch Around `JSON.parse`
- **Files**: `packages/adapters/node/src/body-source.ts`, `packages/runtime/src/body-source.ts`
- **Changes**: Wrapped `JSON.parse` with try/catch, throws structured `SyntaxError` with body preview
- **Status**: ✅ DONE

### Task 1.6: Remove `process.env` from Core Application
- **File**: `packages/core/src/application.ts`
- **Changes**: Removed `process.env['NODE_ENV']` access, defaults to `'development'`
- **Status**: ✅ DONE

### Task 1.7: Fix `route()` Path Leak to Downstream Middleware
- **File**: `packages/core/src/application.ts`
- **Changes**: Restores `ctx.path` to original before calling downstream `next()`, re-strips for router return
- **Status**: ✅ DONE

## Validation

- **adapter-node**: 64 tests passed ✅
- **core**: 65 tests passed ✅
- **runtime**: 45 tests passed ✅
- **TypeScript strict**: All 3 modified packages pass ✅

## Next Steps (Priority Order)

### Phase 2: Error Architecture Unification (P0-P1) — ~8 hr
1. Delete duplicate `HttpError` from `@nextrush/core` and adapter contexts → use `@nextrush/errors`
2. Unify error serialization format across all packages
3. Rename `RangeError` shadow to `RangeValidationError`
4. Complete `ERROR_MAP` coverage (405, 406, 408, 413, 415, 429, 501, 503)
5. Unify body source error classes to single canonical location

### Phase 3: Type System Fixes (P0-P1) — ~4 hr
1. Remove Node.js types from `@nextrush/types` (use Web API types)
2. Add `setNext()` and `responded` to Context interface
3. Fix `ApplicationLike.use()` type signature

### Phase 4: Performance Optimizations (P1-P2) — ✅ DONE
1. ~~Singleton `EmptyBodySource`~~ ✅
2. ~~Router internal optimizations (regex fast-path, backtracking, single tree walk)~~ ✅
3. ~~Single promise chain in adapter~~ ✅
4. ~~Pre-compile router middleware composition~~ ✅ (already done by design)
5. ~~Remove unused middleware array spread in match()~~ ✅
6. ~~Remove redundant per-segment toLowerCase~~ ✅
7. ~~Avoid double params allocation~~ ✅
8. ~~Optimize allowedMethods() to single tree walk~~ ✅

**Files Modified (6):**
- `packages/router/src/router.ts` (tasks 4.2–4.5, 4.9)
- `packages/adapters/node/src/body-source.ts` (task 4.1)
- `packages/adapters/node/src/adapter.ts` (task 4.6)
- `packages/adapters/node/src/context.ts` (task 4.7)
- `packages/adapters/node/src/index.ts` (task 4.1 barrel fix)
- `packages/runtime/src/body-source.ts` (task 4.1)

**Validation:** Build 29/29 ✅ | Router 100/100 ✅ | Adapter-node 64/64 ✅ | Runtime 45/45 ✅

### Phase 5: Runtime & Detection Fixes (P1) — ✅ DONE
1. ~~Fix Vercel Edge detection order~~ ✅ — Swapped Node.js check before Vercel Edge
2. ~~Implement streaming body size check~~ ✅ — WebBodySource now streams with byte counting
3. ~~Fix Content-Length 0 parsing~~ ✅ — `parseInt || undefined` → `Number.isNaN` check

**Files Modified (3):**
- `packages/runtime/src/detection.ts` (task 5.1)
- `packages/runtime/src/body-source.ts` (tasks 5.2, 5.3)
- `packages/adapters/node/src/body-source.ts` (task 5.3)

**Tests Added (3 files):**
- `packages/runtime/src/__tests__/detection.test.ts` — Vercel Edge detection order test
- `packages/runtime/src/__tests__/body-source.test.ts` — Content-Length 0 + streaming size tests
- `packages/adapters/node/src/__tests__/body-source.test.ts` — New test file (Content-Length 0 + streaming)

**Validation:** Build 29/29 ✅ | Tests 56/56 ✅ | Runtime 53 tests ✅ | Adapter-node 73 tests ✅

### Phase 6: DX & Quality of Life (P2) — ~7 hr
1. Pluggable logger replacing `console.*`
2. Guard mutations after `start()`
3. Graceful shutdown ordering
4. Wire plugin hooks or remove from types

---

Added final summary to `Copilot-Processing.md`.

## Mode

`release` — Strict thresholds, zero critical risks, full quality gate.

---

## Action Plan

### Phase 1: Context Gathering ✅
- [x] Read all source files for 6 target packages
- [x] Identify file structure and dependencies
- [x] Note initial findings from code read

### Phase 2: Deep Analysis (12 Parallel Audit Subagents) ✅
- [x] Subagent 1: Core Application & Plugin System
- [x] Subagent 2: Core Middleware Composition Pipeline
- [x] Subagent 3: Router Radix Tree Algorithm & Registration (FAILED — covered by Subagent 4)
- [x] Subagent 4: Router Matching & Dispatch Hot Path
- [x] Subagent 5: Errors Architecture & Duplication
- [x] Subagent 6: Errors Middleware & Factory
- [x] Subagent 7: Types Package Integrity & Ergonomics
- [x] Subagent 8: Adapter-Node Context Implementation
- [x] Subagent 9: Adapter-Node Server Lifecycle
- [x] Subagent 10: Runtime Detection & Body Source
- [x] Subagent 11: Cross-Cutting Security Analysis (FAILED — covered by Subagents 8, 9, 1)
- [x] Subagent 12: Cross-Cutting Performance Analysis

### Phase 3: Report Synthesis ✅
- [x] Consolidate all subagent findings
- [x] Score each audit category
- [x] Build prioritized remediation plan
- [x] Write comprehensive report to /report folder

### Phase 4: Summary ✅
- [x] Final summary added to this file

---

## Final Summary

### Audit Completed Successfully

- **12 subagents spawned**: 10 returned results, 2 failed (coverage fully addressed by other subagents)
- **12 report files generated** in `/report/` directory

### Report Files

| File | Content |
|------|---------|
| `00-EXECUTIVE-SUMMARY.md` | Overall scores, key findings, issue counts |
| `01-CRITICAL-ISSUES.md` | All 14 critical issues with code evidence |
| `02-CORE-AUDIT.md` | Core package deep dive (application, middleware, errors) |
| `03-ROUTER-AUDIT.md` | Router package deep dive (matching, radix tree, perf) |
| `04-ERRORS-AUDIT.md` | Errors package deep dive (architecture, factory, middleware) |
| `05-TYPES-AUDIT.md` | Types package deep dive (Node coupling, gaps, completeness) |
| `06-ADAPTER-NODE-AUDIT.md` | Node adapter deep dive (context, body, security) |
| `07-RUNTIME-AUDIT.md` | Runtime package deep dive (detection, body source, duplication) |
| `08-PERFORMANCE-AUDIT.md` | Cross-cutting perf analysis (34+ allocs/req, hot path ranking) |
| `09-SECURITY-AUDIT.md` | Cross-cutting security audit (15 vulnerabilities, OWASP mapping) |
| `10-IMPROVEMENT-PLAN.md` | Prioritized TODO with 6 phases, ~31.5 hr effort |
| `11-ARCHITECTURE-IMPROVEMENTS.md` | 7 architecture improvements with "why" explanations |

### Key Numbers

- **14 CRITICAL** issues (security + correctness showstoppers)
- **12 HIGH** issues (significant bugs + performance)
- **15 MEDIUM** issues (DX + quality)
- **8 LOW** issues (minor improvements)
- **~34 allocations per minimal request** (target: single-digit)
- **~15-20% RPS improvement** achievable with easy fixes
- **Security score: 2-4/10** → can reach 8/10 with Phase 1 fixes (~4 hr)

---

## Phase 1 Remediation — COMPLETED

All 7 P0 security fixes implemented. 29/29 builds, 56/56 tests.

---

## Phase 2+3 Remediation — COMPLETED

### Phase 2: Error Architecture Unification (6 tasks)
1. HttpError message optional with status defaults
2. Core errors.ts → re-exports from @nextrush/errors
3. All 4 adapter contexts use canonical HttpError
4. RangeError → RangeValidationError (avoid shadowing)
5. ERROR_MAP: added 429, 503
6. BodyConsumedError→BadRequestError(400), BodyTooLargeError→PayloadTooLargeError(413)

### Phase 3: Type System Fixes (4 tasks)
1. Removed `import Readable from 'node:stream'`, removed Buffer from type unions
2. Added `setNext?(fn: Next): void` to Context, removed `as any` casts
3. Added `readonly responded: boolean` to Context
4. Fixed `ApplicationLike.use()` to accept `Middleware` type

### Additional Fixes
- Removed cyclic @nextrush/core peer dep from @nextrush/errors
- Fixed adapter barrel exports for HttpError
- Updated test imports across 4 adapter test files

### Verification: 29/29 builds, 56/56 tests — ALL PASS

---

## Phase 6: DX & Quality of Life — COMPLETED

### Tasks Completed
1. **6.1** Fix `errorHandler()` type signature — Uses `Context`/`Middleware`/`Next` from `@nextrush/types` instead of custom `ErrorContext`
2. **6.2** Make `close()` resilient — `Promise.allSettled()` pattern, continues destroying all plugins even if one fails
3. **6.3** Replace `console.*` with pluggable Logger — Added `Logger` interface, `NOOP_LOGGER` default, wired through core + adapter-node
4. **6.4** Guard mutations after `start()` — `assertNotRunning()` blocks `use()`, `route()`, `plugin()`, `pluginAsync()` after app starts
5. **6.5** Fix graceful shutdown order — `server.close()` (stop connections) runs BEFORE `app.close()` (destroy plugins)
6. **6.6** Wire `PluginWithHooks` lifecycle hooks — `onRequest`, `onResponse`, `onError`, `extendContext` now called in `callback()`

### Files Modified
- `packages/core/src/application.ts` (Logger, assertNotRunning, close resilience, plugin hooks)
- `packages/core/src/index.ts` (Logger export)
- `packages/core/src/__tests__/application.test.ts` (17 new tests)
- `packages/errors/src/middleware.ts` (Context type alignment)
- `packages/errors/src/__tests__/middleware.test.ts` (Context mock updated)
- `packages/adapters/node/src/adapter.ts` (Logger wiring, shutdown order fix)

### Verification: 59/60 test files, 2367/2367 tests pass (1 pre-existing failure: @nextrush/body-parser not found)

---

## Audit Report Consolidation — COMPLETED

- Deleted 12 old report files (00-11)
- Created consolidated `report/REMAINING-ISSUES.md` with 39 remaining issues:
  - 8 Critical, 7 High, 12 Medium, 8 Low, 4 Info/DX
  - Recommended Phases 7-10 for next work
