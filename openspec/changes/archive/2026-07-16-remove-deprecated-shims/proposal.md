## Why

`@nextrush/controllers` and `@nextrush/decorators` are `@deprecated` compatibility shims that
re-export 100% of their surface from `@nextrush/class` (confirmed by reading both `src/index.ts`
files directly — neither contains any logic of its own). A repo-wide grep sweep confirms zero
internal consumers anywhere in this codebase (`packages/`, `apps/`, tests, docs code samples).
The migration guide (`apps/docs/content/docs/migrate/deprecations.mdx`) and an automated codemod
(`nextrush codemod consolidate-imports`) already exist and are already tested — the prep work
T053 would normally require is already done, inherited from the earlier class-consolidation
effort. Carrying two dead re-export packages past v1.0 only makes their eventual removal harder
(post-1.0 compatibility expectations are stricter than pre-1.0), and their `package.json` `test`
scripts are currently no-op placeholders that silently skip the surface-lock tests just added for
them — a live CI blind spot. Given the already-complete migration path and zero internal risk,
removing them now — as a deliberate, documented breaking change with a version bump, per
`AGENTS.md` §15 — is lower-cost than deferring past v1.0.

## What Changes

- **BREAKING**: Delete `packages/controllers/` and `packages/decorators/` entirely (source,
  tests, README, CHANGELOG, build config) — both packages stop existing and stop publishing.
- **BREAKING**: Remove both packages from the pnpm workspace, turbo pipeline, and any other
  workspace-level registration.
- Update `apps/docs` content that references either package: `deprecations.mdx` becomes a
  removal notice (not a migration table for a package that no longer exists to migrate *from*
  in a future release — it documents what was removed and points at the codemod), plus
  `package-hierarchy.mdx`, `reference/index.mdx`, `compatibility-matrix.mdx`,
  `resources/compatibility-matrix.mdx`, and `migrate/upgrade-guide.mdx`.
- Update root `README.md`'s package table to drop the two deprecated rows.
- Add a changeset documenting the breaking removal, with the already-existing codemod
  (`nextrush codemod consolidate-imports`) as the primary migration path for any external
  consumer still on the old import paths.
- No behavior change to `@nextrush/class` or `@nextrush/di` — every symbol the shims re-exported
  remains available at its current location; only the two old import paths disappear.

## Capabilities

### New Capabilities

(none — this is a removal, not a new capability)

### Modified Capabilities

(none — no existing `openspec/specs/*` capability describes these shim packages; their removal
is a workspace/package-graph change, not a behavioral requirement change to a tracked capability)

## Impact

- **Affected packages**: `packages/controllers` (deleted), `packages/decorators` (deleted).
  `@nextrush/class` and `@nextrush/di` are unaffected — they already own every re-exported symbol.
- **Affected docs**: `apps/docs/content/docs/migrate/deprecations.mdx`,
  `apps/docs/content/docs/migrate/upgrade-guide.mdx`,
  `apps/docs/content/docs/internals/package-hierarchy.mdx`,
  `apps/docs/content/docs/reference/index.mdx`,
  `apps/docs/content/docs/resources/compatibility-matrix.mdx`, root `README.md`.
- **Affected tooling**: pnpm workspace config, turbo pipeline config, any `apps/docs` scripts
  that enumerate packages (`apps/docs/src/lib/package-registry-data-1.ts`,
  `apps/docs/src/lib/package-links.ts`, `apps/docs/scripts/verify/reference-match.ts`) if they
  hardcode either package name.
- **External consumers**: cannot be verified from inside this repository. The `3.1.0` versions of
  both packages remain on npm as their last-published state; the changeset's migration
  instructions (codemod + doc) are the mitigation for any consumer who has not yet migrated.
- **No dependency, no runtime behavior, no public API surface of `@nextrush/class`/`@nextrush/di`
  changes** — this is purely the removal of two redundant re-export packages.
