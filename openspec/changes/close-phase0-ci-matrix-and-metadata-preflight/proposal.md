## Why

Phase 0 (Foundation) of `docs/audits/03-gap-checklist.md` is at 6/8. The two remaining tasks —
T004 (Windows + macOS CI) and T008 (deterministic metadata-emitting build) — are both self-
contained, have no dependency on unfinished work, and are the last blockers before Phase 0 counts
as fully closed (a prerequisite the checklist's own T060 v1.0 gate requires: "all Phase 0-2 P1
tasks ☑"). Per explicit direction, Phase 3 (Enterprise, P3-adjacent new-package work) is
deliberately out of scope for this and the next several changes — Phase 0 closes first, then P1,
then P2, in that order.

Verified against source, not carried forward from the checklist's original description:

1. **T004** — `.github/workflows/ci.yml` runs a single `ubuntu-latest` job; no
   `windows-latest`/`macos-latest` job exists anywhere in `.github/workflows/`.
2. **T008** — the checklist's original framing ("guarantee a decorator-metadata-emitting build
   path... loud preflight for tsx/esbuild users") is partially stale: `nextrush build` already
   forces SWC specifically for decorator metadata emission (confirmed in `build.ts`'s own
   docstring), and `validateDecoratorConfig()` already exists and produces tsconfig-mismatch
   warnings. But two real gaps remain: (a) `nextrush build` — the production path — **never
   calls** `validateDecoratorConfig()` at all (only `nextrush dev` does), so a build with a
   broken tsconfig silently emits a metadata-free bundle; and (b) where `dev.ts` does call it,
   the result is a logged warning (`error(w)` with no `exitProcess`), not a fail-fast preflight —
   contradicting the checklist's own acceptance criterion ("preflight fails fast with remediation
   text on a bad toolchain").

## What Changes

- Add `windows-latest` and `macos-latest` jobs to the CI workflow exercising `nextrush dev` and
  `nextrush build` against a fixture project, alongside the existing `ubuntu-latest` job.
- Wire `validateDecoratorConfig()` into `nextrush build`, not just `nextrush dev`.
- Change the decorator-config preflight's failure mode from "warn and continue" to "fail fast
  with remediation text" specifically for the case where metadata emission is broken and the
  project's own source uses decorators requiring it (detecting decorator usage, not just tsconfig
  flags, to avoid false-positive hard failures on decorator-free functional projects — see
  design.md for the detection approach).
- **BREAKING**: None functionally. A project that previously built successfully with a silently
  broken decorator-metadata config (and doesn't use decorators) is unaffected; a project that
  uses decorators with broken metadata config will now fail at build time instead of failing
  later at DI-resolution runtime — this is a behavior change (build now fails where it previously
  succeeded), but only for a case that was already broken and previously failed downstream. No
  new required config for correctly-configured projects.

## Capabilities

### New Capabilities

- `multi-os-toolchain-ci`: The requirement that `@nextrush/dev`'s CLI commands (`dev`, `build`)
  are exercised in CI on Windows and macOS, not only Linux, so platform-specific regressions are
  caught before release.
- `build-time-metadata-preflight`: The requirement that `nextrush build` validates decorator-
  metadata emission configuration before or during build, and fails fast with actionable
  remediation text when a project uses decorators but its toolchain won't emit the metadata they
  require — rather than silently shipping a broken build that fails later at DI-resolution time.

### Modified Capabilities

- None. No existing `openspec/specs/*` capability governs CI platform coverage or the dev/build
  CLI's metadata validation.

## Impact

- **Affected code:** `.github/workflows/ci.yml` (new OS matrix jobs); `packages/dev/src/commands/build.ts`
  (call `validateDecoratorConfig`, add fail-fast path); `packages/dev/src/utils/config.ts`
  (`validateDecoratorConfig` may need a decorator-usage-detection addition to avoid false
  positives, and/or a severity parameter to distinguish warn-vs-fail callers); `packages/dev/src/commands/dev.ts`
  (no behavior change required, but may share the updated detection logic).
- **Affected docs:** `packages/dev/README.md` and/or `packages/di/README.md`'s existing
  "TypeInfo not known" troubleshooting section may need a line noting `nextrush build` now fails
  fast on this instead of shipping a broken artifact.
- **Dependencies:** T004 depends on T003 (multi-runtime CI matrix), already ☑. T008 has no
  dependency. Neither blocks nor is blocked by any other open task in this checklist.
- **Systems:** CI gains two new job types (Windows, macOS runners) — longer total CI wall-clock
  time per PR, an intentional, disclosed tradeoff for platform-parity confidence. `nextrush build`
  gains a new failure mode for a specific, previously-silent misconfiguration.
