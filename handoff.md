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
- [x] Full test suite run confirmed (26 files / 240 tests in create-nextrush, 33 files / 289 tests in @nextrush/dev)

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

## Currently Working On

- Ready to commit — all work verified green, changesets reviewed, working tree clean of accidental deletions

## Remaining

- Commit changes (if approved)

## Blockers

- None

---
