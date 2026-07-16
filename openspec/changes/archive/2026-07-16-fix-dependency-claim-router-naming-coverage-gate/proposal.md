## Why

Three Phase 0 (Foundation) gaps from `docs/audits/03-gap-checklist.md` are unblocked, independent,
and low-effort, but remain open and sit on the critical path to the v1.0 freeze gate (T060, which
requires all P0 tasks ☑):

1. **T001** — The README's "Zero Dependencies" claim is false for the class/DI path (`tsyringe` +
   `reflect-metadata`). This is a P0 accuracy defect that misleads supply-chain/security review.
2. **T002** — The router's source header already states "segment trie, not a compressed radix
   tree," but the code contradicts itself: `radix-tree.ts`, `RadixNode`, and 23 `radix` references
   across 4 files (`router.ts`, `radix-tree.ts`, `index.ts`, `public-surface.test.ts`) remain.
3. **T006** — CI runs `pnpm verify` (build/test/typecheck/lint) but enforces no coverage
   threshold, despite the project's own steering (`engineering-standards.md`,
   `project-rules.instructions.md` §7) stating a 90%+ line coverage bar per package.

All three are P0/P1, XS–S effort, Easy difficulty, touch disjoint files, and have no dependency on
any unfinished Phase 0–5 task. Fixing them now removes accuracy debt before any Phase 3 (Enterprise)
work lands on top of it, per the checklist's own precedence: "accuracy debt... not core rework."

## What Changes

- Reword the root `README.md` "Zero Dependencies" claim to state the true per-path footprint
  (zero-dependency functional core; class/DI path depends on `tsyringe` + `reflect-metadata`), and
  add a dependency footprint table. Mirror the correction in `@nextrush/di`'s README.
- Rename `packages/router/src/radix-tree.ts` → `segment-trie.ts`, rename the `RadixNode` type to
  `TrieNode`, and update all internal references, JSDoc, and npm package keywords/description
  that still say "radix" — including the 3 references inside `router.ts`'s public-surface test
  fixtures — so the router package is internally self-consistent with its own documented
  algorithm (segment trie).
- Wire `test:coverage` into `.github/workflows/ci.yml` (or the `pnpm verify` script it calls) with
  per-package thresholds (≥90% lines / ≥85% branches), enforced as a CI failure on regression.
- **BREAKING**: None. `RadixNode` is an internal, non-exported type (confirmed via the package's
  own public-surface snapshot test in T005); the rename has no public API impact. If any router
  package export other than the file path changes, a `@deprecated` alias is kept for one minor
  cycle per the checklist's Breaking Change Tracker convention — expected not to apply here since
  `RadixNode` is internal.

## Capabilities

### New Capabilities

- `dependency-footprint-disclosure`: The requirement that all documentation stating NextRush's
  dependency posture (README, per-package READMEs) accurately reflects the true dependency tree
  per usage path (functional vs. class/DI), never a single blanket claim that is false for any
  supported path.
- `router-internal-naming-consistency`: The requirement that router package source (file names,
  type names, JSDoc, npm metadata) uses terminology consistent with the segment-trie algorithm it
  actually implements, with no contradicting "radix tree" legacy naming remaining.
- `coverage-enforcement-gate`: The requirement that CI enforces a minimum per-package test coverage
  threshold and fails a PR that drops a touched package below it, per the steering-mandated 90%
  lines / 85% branches bar.

### Modified Capabilities

- None. No existing `openspec/specs/*` capability governs router internal naming, README
  dependency claims, or CI coverage enforcement — these are net-new capabilities, not changes to
  an existing spec's requirements. (Router *behavior* specs — `runtime-adapter-contract`,
  `adapter-development-kit`, etc. — are unaffected: this change is an internal rename with no
  behavioral or public-API change.)

## Impact

- **Affected code:** `README.md`, `packages/di/README.md`, `packages/router/src/radix-tree.ts`
  (renamed), `packages/router/src/router.ts`, `packages/router/src/index.ts`,
  `packages/router/src/__tests__/public-surface.test.ts`, `packages/router/package.json`
  (keywords/description), `.github/workflows/ci.yml` (or `vitest.config.ts` / `package.json`
  `verify` script it invokes).
- **Affected docs:** Root README dependency claims; `@nextrush/di` README.
- **Dependencies:** None — T001, T002, T006 have no upstream blockers per the gap checklist's
  dependency graph, and this change has no dependency on any other open change.
- **Systems:** CI pipeline gains a new failure mode (coverage regression) — PRs that drop coverage
  on a touched package will start failing where they previously passed. This is an intentional,
  disclosed tightening of the existing `pnpm verify` gate, not a behavior change to shipped code.
