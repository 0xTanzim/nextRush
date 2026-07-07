# @nextrush/errors

## 3.1.0

### Patch Changes

- 0e2b399: Fix `errorHandler()` silently dropping subclass-specific fields (e.g.
  `ValidationError.issues`) from the serialized response body.

  `errorHandler()` previously built its own response body by hand
  (`{ error, message, code, status, details }`) instead of calling the thrown
  error's own `toJSON()`. Any `NextRushError` subclass that overrides `toJSON()`
  to add fields — most notably `ValidationError`, which adds `issues` — had
  those fields silently dropped when rendered through `errorHandler()`, even
  though `error.toJSON()` produced them correctly on its own.

  `errorHandler()` now delegates to `err.toJSON()` for any `NextRushError` (which
  includes `HttpError` and all its subclasses), and falls back to the previous
  hand-rolled shape only for plain `Error`/unknown thrown values. The response
  shape for existing `HttpError` usage is unchanged; `ValidationError` responses
  now correctly include `issues`.

  Found via live end-to-end testing of `@nextrush/validation` against a real
  Node HTTP server — no application code needs to change.

- Updated dependencies [d7eb075]
- Updated dependencies [32a0db6]
  - @nextrush/types@3.1.0

## 3.0.7

### Patch Changes

- Updated dependencies []:
  - @nextrush/types@3.0.7

## 3.0.6

### Patch Changes

- Updated dependencies []:
  - @nextrush/types@3.0.6

## 3.0.5

### Patch Changes

- [#21](https://github.com/0xTanzim/nextRush/pull/21) [`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

- Updated dependencies [[`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5)]:
  - @nextrush/types@3.0.5

## 3.0.4

### Patch Changes

- Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

- Updated dependencies []:
  - @nextrush/types@3.0.4

## 3.0.3

### Patch Changes

- Patch **3.0.3**: **`nextrush`** ships the **`nextrush`** CLI via **`@nextrush/dev`**; **`@nextrush/dev`** skips false-positive decorator `tsconfig` warnings on functional scaffolds; **`create-nextrush`** / docs / plugin metadata aligned to **3.0.3**.

- Updated dependencies []:
  - @nextrush/types@3.0.3

## 3.0.1

### Patch Changes

- Updated dependencies []:
  - @nextrush/types@3.0.1
