## Context

`@nextrush/controllers` and `@nextrush/decorators` are pure re-export shims over
`@nextrush/class` — confirmed by reading both `src/index.ts` files directly. Every export in
both packages is `export { X } from '@nextrush/class'` (six DI symbols in `@nextrush/controllers`
route through `@nextrush/di` instead, with an identical end result). A repo-wide grep sweep
(`report/t053-deprecated-shims-review.md`) found zero internal consumers anywhere in this
codebase. A migration guide (`apps/docs/content/docs/migrate/deprecations.mdx`) and an automated
codemod (`nextrush codemod consolidate-imports`, tested with 20 cases) already exist from the
earlier class-consolidation effort, so the migration path this removal depends on is already
built and already verified — this design is about executing the removal cleanly, not inventing
the migration tooling.

## Goals / Non-Goals

**Goals:**
- Delete both packages entirely: source, tests, build config, README, CHANGELOG.
- Remove every workspace/tooling reference to either package (pnpm workspace, turbo, any
  `apps/docs` scripts that enumerate packages by name).
- Update all documentation that currently describes migrating *to* `nextrush/class` from these
  shims, so it instead documents that the shims were removed and how to migrate if you're still
  on an old install.
- Ship this as one deliberate breaking change, with a changeset, per `AGENTS.md` §15.
- Leave `@nextrush/class` and `@nextrush/di`'s own public API completely untouched — every
  symbol the shims re-exported keeps existing, just under one import path instead of three.

**Non-Goals:**
- No change to `@nextrush/class` or `@nextrush/di` internals or exports.
- No new migration tooling — the codemod and doc already exist and are reused as-is (only the
  doc's framing changes, from "migrate before it's removed" to "it's removed, here's how").
- No attempt to detect or notify external (non-workspace) consumers — this repo has no mechanism
  to reach npm users directly; the changeset and published migration doc are the outward-facing
  signal.
- No version-bump automation beyond adding the changeset — actual publish/release is a separate,
  later step outside this change's scope.

## Decisions

**Full deletion vs. keep-but-empty-warn.** Chose full deletion over leaving an empty package that
only throws/warns on import. An empty warning package still requires maintaining a
`package.json`, publishing a version, and running it through CI forever for zero functional
value — it's a worse version of what already exists today (a working re-export shim), not an
improvement. Full deletion is the honest end-state; the changeset + migration doc carry the
message instead of a runtime warning.

**No new capability spec.** This isn't a new behavioral requirement on an existing tracked
capability (nothing in `openspec/specs/` currently describes these shim packages) — it's a
workspace/package-graph change. The accompanying spec file uses `REMOVED Requirements` against a
new `deprecated-shim-removal` capability purely to give this change an auditable, OpenSpec-tracked
record of the removal decision and its migration path, not because future work will build on a
"shim removal" capability.

**Docs get rewritten, not deleted.** `deprecations.mdx` keeps existing at the same URL (external
links to it shouldn't 404) but its content changes from a migration table to a removal notice —
someone who searches "how do I migrate off @nextrush/decorators" six months from now should still
land on guidance, not a dead page.

## Risks / Trade-offs

- **Unknown external consumers** → Mitigation: changeset + updated migration doc with the
  already-tested codemod as the documented path; this is the best available mitigation from
  inside a repository with no visibility into npm consumer telemetry.
- **A workspace config reference gets missed** (turbo.json, pnpm-workspace.yaml, a docs script
  that hardcodes the package name) → Mitigation: task 3 does a dedicated pass over exactly these
  files, and task 7's forced typecheck/test run would surface a broken reference either way (a
  turbo pipeline referencing a deleted package fails loudly, not silently).
- **A stray doc or README still shows the old import path as current guidance after this change**
  → Mitigation: task 8's grep sweep explicitly checks for this, distinguishing "historical
  mention it existed" (fine to keep, e.g. in CHANGELOG.md/RFC docs) from "current instruction to
  import from it" (must be fixed).

## Migration Plan

1. Delete the two package directories (task 2).
2. Remove workspace/tooling references (task 3) — done immediately after deletion so the repo
   never sits in a half-removed state longer than one commit.
3. Update docs (task 4) and README (task 5) in a following commit.
4. Add the changeset (task 6).
5. Verify (tasks 7-8) before any commit is considered final — cache-bypassed typecheck/test,
   plus the grep sweep.

Rollback: `git revert` the removal commit(s) — nothing here touches published npm state directly;
reverting the commits fully restores the shims as they exist today. The actual npm-side
deprecation (marking `3.1.0` as the final version, `npm deprecate`) is a separate, later, harder-
to-reverse action outside this change's scope — flagged for whoever handles the actual release.

## Open Questions

- Whether to also run `npm deprecate @nextrush/controllers@3.1.0` / `@nextrush/decorators@3.1.0`
  on the actual npm registry once this ships is a release-process decision outside this change's
  scope (this change only prepares the repo-side removal); noting it here so it isn't lost.
