## Why

Three small, unrelated-in-code-but-related-in-theme P2 items are open in the class/router
surface, each independently confirmed against current source:

1. **T014** — `packages/router/src/router.ts` is 918 lines, well over this repo's 300-line hard
   ceiling (`code-structure.md`). A quick check this session found `di` and `dev` package files
   all under 300 lines already — narrower in scope than the checklist's original framing, which
   named `di`/`dev` as also affected; this proposal scopes T014 to what's actually still over cap.
2. **T015** — `packages/class/src/binding/param-resolver.ts` throws a generic
   `MissingParameterError` with no body-parser hint when `@Body()` resolves to nothing because no
   body-parser middleware ran — confirmed directly in source (line 38).
3. **T016** — `packages/class/src/decorators/routes.ts`'s `All()` decorator still loops over 7
   explicit HTTP methods and calls `createRouteDecorator()` once per method — confirmed directly
   at the file's method array — rather than registering one ANY-method route entry.

Grouped together because all three are small (XS-S effort), touch the same package pair
(`@nextrush/class` + `@nextrush/router`), and are the kind of paper-cut fixes that don't
individually justify their own change lifecycle, but batch cleanly.

## What Changes

- Split `packages/router/src/router.ts` (918 lines) into focused modules along its existing
  internal seams (e.g. trie-node construction, route matching, param extraction — actual split
  boundaries determined during design by reading the file's structure, not guessed here).
  Behavior-preserving refactor: characterize existing behavior with tests first, then split.
- Add an actionable error hint when `@Body()` resolves to nothing because no body-parser
  middleware ran, instead of the current generic `MissingParameterError`.
- Change `@All()`/`app.all()` to register a single ANY-method route entry instead of 7 explicit
  per-method registrations.
- **BREAKING**: None functionally for T014 (internal file reorganization, same public exports —
  verified via the router package's existing public-surface snapshot test) or T015 (an error
  message improvement, not a contract change). T016 changes route *introspection* output (
  `getRoutes()` returns 1 row instead of 7 for an `@All()` route) — this is observable behavior,
  not just internals, so it's flagged here for visibility even though it's very unlikely any
  consumer depends on the current 7-row shape; confirm via a search for consumers of
  `getRoutes()`/route-table introspection before treating this as fully non-breaking.

## Capabilities

### New Capabilities

- `router-module-size-compliance`: The requirement that router package source files stay within
  this repo's 300-line ceiling, with behavior-preserving characterization tests guarding the
  split.
- `actionable-body-parser-error`: The requirement that `@Body()` resolving to nothing because no
  body-parser ran produces an error naming the likely fix, not a generic parameter-injection
  error.
- `single-entry-any-method-routes`: The requirement that `@All()`/`app.all()` registers one route
  entry matching all HTTP methods, rather than one entry per explicitly-enumerated method.

### Modified Capabilities

- None. No existing `openspec/specs/*` capability governs router file structure, the `@Body`
  error message, or `@All`'s registration count.

## Impact

- **Affected code:** `packages/router/src/router.ts` (split into multiple files — exact names
  determined in design.md), `packages/router/src/__tests__/public-surface.test.ts` (verify
  unchanged), `packages/class/src/binding/param-resolver.ts` (T015),
  `packages/class/src/decorators/routes.ts` (T016), any router-level code that currently assumes
  one route registration per HTTP method for `@All` (search before changing).
- **Affected docs:** None expected for T014/T015. T016 may need a note if any existing docs show
  or describe the 7-row introspection behavior as current/expected.
- **Dependencies:** None of the three depend on any other open checklist item or on each other.
- **Systems:** All three are internal-package changes with no new network-exposed surface, no
  new dependency, and no production-runtime behavior change beyond T016's introspection-output
  change and T015's error-message change.
