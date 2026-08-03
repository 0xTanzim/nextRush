# PROJECT HANDOFF

> **Purpose**
>
> This document captures the current engineering state of the project so any engineer or AI assistant can continue work without relying on previous chat history.
>
> Before making any changes, read this document completely.

---

# Metadata

| Field | Value |
|--------|-------|
| Project | NextRush Framework |
| Repository | 0xtanzim/nextrush |
| Branch | dev |
| Commit | 1172a6983a3d765118eecfe3b90fe9c745cf83b1 |
| Version | 1.1.0 |
| Last Updated | 2026-08-02 |
| Author | Tanzim Hossain |
| Related Issue / PR | Deno-first scaffold output, process.uptime() removal, deno.json generation |

---

# 1. Mission

## Product Vision

NextRush exists to eliminate accidental complexity from backend development. It's a multi-runtime (Node.js, Bun, Deno) TypeScript framework that provides routing, DI, middleware, and adapters so developers can focus on business logic instead of framework plumbing.

What are we building? A production-grade backend framework with a CLI scaffolder (`create-nextrush`) that generates working projects in three styles (functional, class-based, full) targeting three runtimes (node, bun, deno).

Why does it exist? To reduce cognitive load and boilerplate for backend developers while maintaining runtime independence and cross-adapter parity.

Who is it for? TypeScript backend developers who want convention over configuration, strong typing, and runtime flexibility.

---

## Current Objective

Finish implementing the remaining Deno-first fixes in `create-nextrush` so that `--runtime deno` produces a genuinely Deno-first project (not a Node clone), and all generated code uses cross-runtime APIs (`performance.now()` instead of `process.uptime()`).

This session completed:
- [x] `package-json.ts` — drop `@types/node` for Deno projects
- [x] `tsconfig.ts` — runtime-aware `types: ['node']` pin + generate `deno.json`
- [x] `generator.ts` — wire `deno.json` emission for Deno runtime
- [x] All 3 templates — replace `process.uptime()` with `performance.now()`
- [x] Tests — updated assertions + added Deno-first describe block
- [x] Lint & typecheck pass

Continuation session (this one) completed:
- [x] Full test suite run — create-nextrush: 26 files / 240 tests green; @nextrush/dev: 33 files / 289 tests green; both lint + typecheck pass
- [x] Added missing `--unstable-sloppy-imports` assertion to `packages/dev/src/__tests__/runtime-spawn.test.ts` (the Deno dev fix had no coverage)
- [x] Verified changesets match the code (dev-deno-sloppy-imports, full-template-module-standard, functional-template-clean-architecture)
- [x] Restored accidentally deleted `.changeset/pre.json` (repo is in beta prerelease mode — file is required for the release flow)
- [x] Confirmed `controller-discovery-scope.test.ts` deletion is intentional (it asserted the removed `registerControllers` auto-discovery API; `generator.test.ts` now asserts that API is absent)

Deno hardening session (this one, follow-up) completed:
- [x] Generated `deno.json` now carries `unstable: ['sloppy-imports']` + `nodeModulesDir: 'auto'` — native Deno tooling (deno check/test/LSP) resolves `.js`-specifier imports and bare `@nextrush/*` specifiers; previously only the npm scripts passed the flag
- [x] `src/env.d.ts` omitted for Deno projects (unresolvable `@nextrush/types` triple-slash ref under deno check)
- [x] `engines.node` omitted from Deno project package.json (app is not Node-dependent)
- [x] `@nextrush/dev` deno-builder: native-fallback run hint now includes `--unstable-sloppy-imports` + scoped perms (was `-A`); declaration tsc spawn scoped to `--allow-read --allow-write` (was `-A`)
- [x] New real-Deno test suite `deno-check-real.test.ts` — generates functional/class-based/full Deno projects, runs real `deno check` (hermetic import-map stubs), plus a boot test that runs the app and hits `/health` (all green on Deno 2.9)
- [x] Conformance deno-runner import map gained missing `@nextrush/adapter-nextjs` entry — full shared suite now runs under Deno (31/31 green)
- [x] Verified adapter-deno `process.once` signal handling works on real Deno 2.9 (no change needed)
- [x] Full suite re-run: create-nextrush 27 files / 250 tests, @nextrush/dev 33 files / 289 tests, lint + typecheck clean

Next session should:
- Commit the changes (if approved)

---

## Success Criteria

The current objective is complete when:

- [x] Deno projects do not install `@types/node`
- [x] Deno projects do not force `types: ['node']` in tsconfig.json
- [x] Deno projects generate a `deno.json` with `lib: ['deno.window', 'deno.ns', 'deno.unstable']`
- [x] All 3 templates use `performance.now()` instead of `process.uptime()`
- [x] Tests pass (functional, class-based, full, Deno-specific)
- [x] Lint passes
- [x] Typecheck passes
- [x] Full test suite run confirmed (create-nextrush 27 files / 250 tests, @nextrush/dev 33 files / 289 tests, Deno conformance 31/31)

---

# 1b. Deno Hardening (follow-up objective)

## Current Objective

Make every Deno surface genuinely Deno-first and verified under real Deno: the scaffold's
deno.json config, the generated source, `@nextrush/dev`'s Deno build path, and the
adapter conformance runner.

## Success Criteria

- [x] Generated deno.json resolves `.js`-specifier imports via `unstable: ['sloppy-imports']`
- [x] Generated deno.json resolves bare `@nextrush/*` specifiers via `nodeModulesDir: 'auto'`
- [x] No `@nextrush/types` triple-slash reference in Deno projects (env.d.ts omitted)
- [x] No misleading `engines.node` in Deno project package.json
- [x] @nextrush/dev Deno build paths use scoped permissions + sloppy-imports (no `-A`)
- [x] Generated functional/class-based/full Deno projects pass real `deno check`
- [x] Generated functional Deno app boots under real Deno and answers `/health`
- [x] Deno conformance suite runs and passes on real Deno (31/31)
- [x] Full create-nextrush + @nextrush/dev suites, lint, typecheck all green

---

# 2. Current State

## Overall Progress

| Area | Status |
|------|--------|
| Architecture | Done |
| Core Engine | Done |
| API | Done |
| CLI | In progress |
| Documentation | In progress |
| Testing | In progress |

## Completed

- Functional template redesign (clean architecture: routes to services to repositories)
- Full template migration to class-based module standard
- Deno sloppy-imports fix in `@nextrush/dev` (passes `--unstable-sloppy-imports` flag)
- Deno config generation (`deno.json` with `lib` entries)
- Cross-runtime uptime API (`performance.now()`)
- Runtime-aware `@types/node` and `types: ['node']` handling
- Linter compliance (`// capability-exempt` comments for scaffold-time runtime decisions)
- Deno-first scaffold hardening (deno.json sloppy-imports/nodeModulesDir, env.d.ts, engines)
- Real-Deno verification suite (deno check + boot on generated projects)
- Deno conformance runner import-map fix + 31/31 green on real Deno

## Currently Working On

- Ready to commit — all Deno hardening verified green under real Deno 2.9

## Remaining

- Commit changes (if approved)

## Blockers

- None

---
