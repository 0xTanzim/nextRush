## Context

Both tasks are Phase 0 leftovers with no dependency on unfinished work, but they differ in shape:
T004 is close to pure CI configuration (low judgment, mechanical). T008 initially looked like it
needed new decorator-usage detection, but inspecting `packages/dev/src/utils/config.ts` shows
`validateDecoratorConfig()` already has the right detection heuristic — it's a wiring and
severity gap, not a missing-feature gap.

Current state, verified directly against source:
- `.github/workflows/ci.yml` has exactly one job, `runs-on: ubuntu-latest`. No OS matrix.
- `validateDecoratorConfig()` (`packages/dev/src/utils/config.ts:134-182`) reads `tsconfig.json`,
  extracts `experimentalDecorators`/`emitDecoratorMetadata`, and returns **no warnings** when
  both flags are absent (correctly treating that as a decorator-free functional project opting
  out on purpose — this is the existing, working detection signal). It returns warnings only on
  a *mismatch*: one flag true, the other false/absent.
- `dev.ts` calls this function inside its `needsSwc` branch and logs each warning via `error(w)`
  — no `exitProcess`, so `nextrush dev` continues running after warning.
- `build.ts` never calls `validateDecoratorConfig()` at all. It reports
  `decoratorMetadata: 'enabled'/'disabled'` as an info line (reflecting `resolved.decoratorMetadata`,
  a build-options flag, not the tsconfig's actual state) and proceeds regardless of whether the
  underlying tsconfig can actually support metadata emission.

## Goals / Non-Goals

**Goals:**
- Windows and macOS CI coverage for `nextrush dev` and `nextrush build`, catching platform-
  specific regressions the existing Linux-only job cannot.
- `nextrush build` calls the same tsconfig-mismatch detection `dev` already has.
- The mismatch case fails the build fast with the same remediation text already used in `dev`'s
  warning, when detected during `build` specifically — closing the "silently ships a
  metadata-broken artifact" gap the checklist's acceptance criteria calls out.

**Non-Goals:**
- Not building new decorator-usage detection (AST scanning for `@Controller`/`@Service` etc.) —
  the existing tsconfig-flag heuristic already distinguishes "opted out on purpose" from
  "misconfigured," and building a second, more invasive detection mechanism when the existing one
  already covers the actual failure mode (a *mismatched* flag pair) would be unjustified
  complexity per this repo's own YAGNI/no-hidden-coupling steering.
- Not changing `nextrush dev`'s existing warn-and-continue behavior — a dev server that hard-
  exits on a config warning mid-session is a worse DX than a warning a developer can act on
  before their next restart; `dev` is an iterative loop, `build` is a one-shot gate. This
  asymmetry is deliberate, not an inconsistency to "fix" toward uniformity.
- Not adding a Windows/macOS job for every existing CI check (lint, typecheck, full test suite) —
  scoped to the dev/build CLI fixture the checklist's own T004 acceptance criteria names
  ("dev unit + a build-integration fixture run green on all three OSes"), not a full CI-matrix
  duplication, which would multiply CI cost for coverage this task doesn't ask for.

## Decisions

**D1 — Reuse `validateDecoratorConfig()` as-is; add a caller-controlled severity, not a new function.**
The function's tsconfig-flag heuristic is already correct for both callers' needs — `dev` and
`build` both care about the same mismatch condition. Alternative considered: write a separate
`validateDecoratorConfigStrict()` for build. Rejected — duplicating the same tsconfig-reading and
flag-comparison logic across two functions is exactly the copy-paste-past-the-rule-of-three
pattern `code-structure.md` forbids, for a difference that's purely "what does the caller do with
the result," not "what does detection look like." Add a `{ throwOnMismatch?: boolean }` option
(default `false`, preserving `dev`'s current behavior unchanged) instead.

**D2 — `build.ts` calls the function with `{ throwOnMismatch: true }`; `dev.ts`'s call is unchanged.**
This is the one-line wiring fix that closes the actual gap: `build` gets the fail-fast path,
`dev` keeps its existing warn-and-continue UX (per the Non-Goals above). Alternative considered:
make fail-fast the default and have `dev` opt out. Rejected — `dev`'s calling code and tests
already assume warn-only behavior; defaulting to strict and retrofitting `dev` to opt out risks
an unintended behavior change to the already-shipped, already-tested `dev` path for zero benefit,
since `build` is the only caller that needs the new behavior.

**D3 — The build failure exits with the same remediation text `dev` already prints, not new copy.**
`packages/di/README.md`'s troubleshooting section and `dev.ts`'s existing warning strings are
already the source of truth for how this is explained to users. Alternative considered: write
fresh, build-specific remediation text. Rejected — two different wordings for the same
underlying tsconfig mismatch is a documentation-consistency defect waiting to happen; reuse the
exact strings `validateDecoratorConfig()` already returns.

**D4 — CI OS-matrix job runs a minimal fixture, not the full monorepo test suite.**
Per the checklist's own T004 acceptance criteria ("dev unit + a build-integration fixture run
green on all three OSes") and T013 (end-to-end build integration test, currently blocked on T004
— out of scope for this change, but the fixture this change adds should be reusable by T013 when
it's picked up next). Alternative considered: run the entire `pnpm verify` pipeline on
Windows/macOS. Rejected as disproportionate CI cost for what this task asks — the checklist
explicitly scopes T004 to the `dev` package's CLI commands, not the full monorepo.

## Risks / Trade-offs

- **[Risk]** Flipping `build` to fail-fast on a tsconfig mismatch could break an existing CI
  pipeline for a real (if misconfigured) project that previously built "successfully" (with
  silently-broken DI) and is depended on by downstream consumers who haven't hit the runtime
  error yet.
  → **Mitigation**: This is a deliberate, disclosed behavior change (see proposal.md's Impact
  section) — the build was already producing a broken artifact; moving the failure earlier (build
  time vs. DI-resolution time) is strictly better for anyone actually affected, and anyone NOT
  using decorators is unaffected by design (D1's existing heuristic). Document the change in the
  package's CHANGELOG and `packages/di/README.md`'s troubleshooting section per the proposal's
  Impact note.
- **[Risk]** Windows/macOS CI runners are slower and flakier than Linux runners in practice
  (path-separator bugs, line-ending differences, process-spawning differences already flagged as
  the historical source of the dev-audit's Windows-only criticals).
  → **Mitigation**: Scope the new jobs to the `dev` package's CLI fixture only (D4), not the full
  suite, to bound the blast radius of platform flakiness on unrelated PRs. If a specific
  Windows/macOS flake emerges post-merge, it's a new, separate bug — not a reason to revert this
  change's CI coverage.
- **[Risk]** The `{ throwOnMismatch }` option changes `validateDecoratorConfig()`'s public
  signature — if this function is exported from `@nextrush/dev`'s public surface (not just
  internal), this could be a breaking change subject to T005's surface-snapshot lock.
  → **Mitigation**: Check the package's public-surface snapshot test before implementing; if
  exported, add the parameter as an optional trailing argument (backward-compatible, default
  preserves existing behavior) rather than changing the return type or required parameters.

## Migration Plan

No runtime/data migration. Deploy as two independently-mergeable pieces within one PR:
1. Land the CI OS-matrix jobs first (T004) — zero risk to any package's runtime behavior, pure
   CI config addition.
2. Land the `build.ts` wiring + `{ throwOnMismatch }` option (T008) — verify the new CI jobs from
   step 1 catch it if this introduces a Windows/macOS-specific regression, closing the loop
   between the two tasks in the same change.

Rollback: revert either piece independently via `git revert` if either causes an unexpected
regression; they don't share any code path that would make a partial revert inconsistent.

## Open Questions

- Is `validateDecoratorConfig()` currently part of `@nextrush/dev`'s public surface snapshot, or
  purely internal? Determines whether D1's new option needs backward-compatibility care or can
  be added freely. Resolve during implementation by checking the package's
  `public-surface.test.ts` before editing the function signature.
