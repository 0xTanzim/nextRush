# public-surface-lock

## Purpose

The requirement that every publishable NextRush package has a test locking its exported symbol
set (runtime exports via `Object.keys()`, type-only exports via a compile-time surface check), so
an unintended export addition, removal, or rename fails CI rather than shipping silently.

## Requirements

### Requirement: Every publishable package has a surface-lock test
Every publishable NextRush package (all packages with `private` unset or `false` in their
`package.json`) SHALL have a test that locks its exported symbol set from `src/index.ts`, so an
unintended addition, removal, or rename of a public export fails that package's test suite rather
than shipping undetected.

#### Scenario: A throwaway export addition fails the surface test
- **WHEN** a new, unintended value is exported from a package's barrel (`src/index.ts`)
- **THEN** that package's surface-lock test fails until either the export is removed or the
  test's expected list is intentionally updated

#### Scenario: A private/non-published package is exempt
- **WHEN** a package's `package.json` sets `"private": true` (e.g. `@nextrush/adapter-conformance`)
- **THEN** it is not required to carry a surface-lock test, since it has no public consumers

### Requirement: Runtime exports are locked via Object.keys()
For a package whose barrel exports functions, classes, or constants (values visible at runtime),
the surface-lock test SHALL assert the sorted `Object.keys()` of the imported barrel module
equals an explicit, intentional list.

#### Scenario: A runtime export is removed
- **WHEN** a previously-exported function or constant is removed from the barrel
- **THEN** the `Object.keys()` assertion fails, naming the missing export

### Requirement: Type-only exports are locked via a compile-time surface check
For a package whose barrel exports `export type` declarations (invisible to `Object.keys()`), the
surface-lock test SHALL assert their continued importability via a compile-time construct (e.g. a
type tuple referencing every type-only export) that fails to compile if any listed type is
removed or renamed from the barrel.

#### Scenario: A type-only export is renamed without updating the lock
- **WHEN** a type exported via `export type` is renamed in the package's source without a
  corresponding update to the surface-lock test's type-tuple import list
- **THEN** the surface-lock test file fails to type-check, surfacing the discrepancy

### Requirement: A package with both export kinds locks both
A package whose barrel exports a mix of runtime values and type-only declarations SHALL apply
both the `Object.keys()` check and the compile-time type-tuple check in the same surface-lock
test file, rather than choosing only one and leaving the other kind unlocked.

#### Scenario: A hybrid package's runtime and type surfaces are both covered
- **WHEN** a package (e.g. one exporting both a runtime constant and several `export type`
  interfaces) is given a surface-lock test
- **THEN** the test asserts both the runtime `Object.keys()` list and the type-only surface, not
  just one of the two

### Requirement: A CLI-only package with no library barrel locks the absence of exports
A publishable package whose `src/index.ts` is a side-effecting CLI entry point (a `main()`
invocation) rather than a barrel of named exports SHALL lock that fact structurally — asserting
that no `export` statement exists in the entry source — rather than importing the module directly
(which would trigger the entry point's runtime side effects, e.g. `process.exit()`, under a test
harness) or being exempted from surface-lock coverage entirely.

#### Scenario: A CLI entry point gains an accidental named export
- **WHEN** a future refactor of a CLI-only package's `src/index.ts` adds an `export` statement
  (e.g. extracting `main()` into an exported function for testability)
- **THEN** the structural "no export statement" assertion fails, forcing an intentional decision
  about whether that export should become public API rather than letting it leak in silently

#### Scenario: The CLI entry point is not imported to check its runtime exports
- **WHEN** locking a CLI-only package's surface
- **THEN** the test reads the entry source file's text rather than importing and executing the
  module, avoiding the module's side effects under the test harness

### Requirement: Public type names are coherent across a package's subpaths
A package that exposes more than one entry point (e.g. `nextrush`'s `.` and `./class`) SHALL NOT
export two structurally-divergent public types under the same name across those subpaths. A single
public type name maps to a single meaning; a renderer/contract type and an implementation-detail
type MUST NOT collide on one identifier. The surface-lock tooling MUST detect such a collision.

#### Scenario: A cross-subpath type-name collision fails the coherence check
- **WHEN** a type named `RouteMetadata` is exported from `nextrush` (the renderer-facing contract
  from `@nextrush/types`) and a structurally-different `RouteMetadata` is exported from
  `nextrush/class` (the decorator-storage shape from `@nextrush/class`)
- **THEN** the cross-subpath coherence check fails until one is renamed (e.g. the class type to
  `ControllerRouteMetadata`), reserving `RouteMetadata` for the single renderer-facing contract

#### Scenario: A deprecated alias does not reintroduce the collision
- **WHEN** the renamed type ships a temporary deprecated alias for one minor release
- **THEN** the alias is marked `@deprecated` and the coherence check treats the canonical name — not the alias — as the locked identity, so the deprecation window does not itself count as a live collision

### Requirement: A published README documents only symbols in the locked surface
A publishable package's README SHALL NOT present, in an import example or an exports table, a
runtime export that is absent from that package's locked surface. A check MUST fail the build when
the README references an identifier as an export of the package that the surface-lock list does
not contain (a removed or never-existing export).

#### Scenario: A README documenting a non-existent export fails the check
- **WHEN** the `nextrush` README shows `import { VERSION } from 'nextrush'` while `VERSION` is not
  in the package's locked runtime surface
- **THEN** the README↔surface check fails until either the export is added intentionally or the
  README stops documenting it

#### Scenario: A README documenting a removed export fails the check
- **WHEN** the README lists a removed export (e.g. `catchAsync`) in its "what's included" table
- **THEN** the README↔surface check fails until the entry is removed, keeping the published
  landing page consistent with the sealed surface
