## ADDED Requirements

### Requirement: Deprecated shim packages are removed from the workspace
The workspace SHALL NOT publish or build `@nextrush/controllers` or `@nextrush/decorators`.
Both packages' functionality remains fully available through `@nextrush/class` (and, for the six
DI symbols `@nextrush/controllers` re-exported, through `@nextrush/di`), so this removal SHALL
NOT reduce the framework's functional public API — only the two redundant import paths disappear.

#### Scenario: The packages no longer exist in the workspace
- **WHEN** the workspace is built or the package list is enumerated
- **THEN** neither `packages/controllers` nor `packages/decorators` exists, and neither package
  is registered in the pnpm workspace or turbo pipeline

#### Scenario: Every symbol the shims re-exported remains importable from its real owner
- **WHEN** a consumer needs any symbol previously available from `@nextrush/controllers` or
  `@nextrush/decorators` (e.g. `Controller`, `registerControllers`, `Service`)
- **THEN** that symbol remains importable from `nextrush/class` (or `@nextrush/di` for the DI
  primitives it owns directly), with no change to its type, signature, or runtime behavior

### Requirement: A migration path is documented for consumers still on the removed packages
The project's migration documentation SHALL describe how to move from either removed package to
`nextrush/class`, and SHALL point to the existing automated codemod
(`nextrush codemod consolidate-imports`) as the primary migration mechanism.

#### Scenario: A consumer on an old install seeks migration guidance
- **WHEN** a developer who installed `@nextrush/controllers` or `@nextrush/decorators` at a
  version prior to this change looks up migration guidance
- **THEN** the documentation explains that the packages were removed, why, and how to migrate
  (codemod command plus a manual before/after example) rather than presenting stale
  "still supported, migrate at your convenience" language

## REMOVED Requirements

### Requirement: `@nextrush/controllers` and `@nextrush/decorators` ship as compatibility shims
**Reason**: Both packages contained zero logic of their own (100% re-exports from
`@nextrush/class`/`@nextrush/di`), had zero confirmed internal consumers repo-wide, and their
migration tooling (documentation + automated codemod) was already complete and tested. Carrying
two dead re-export packages past the v1.0 freeze would make their eventual removal strictly
harder under post-1.0 compatibility expectations, for no retained benefit — removing them now,
as a deliberate, documented, version-bumped breaking change, is lower total cost than deferring.
**Migration**: Run `nextrush codemod consolidate-imports "src/**/*.ts"` to automatically rewrite
imports from either removed package to `nextrush/class`; see the updated
`apps/docs/content/docs/migrate/deprecations.mdx` for the manual before/after diff and the full
symbol-by-symbol mapping (unchanged from the mapping documented before removal, since every
symbol kept its name and moved to the same `nextrush/class` location it already re-exported from).
