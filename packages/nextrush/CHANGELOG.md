# nextrush

## 3.0.6

### Patch Changes

- [#23](https://github.com/0xTanzim/nextRush/pull/23) [`9f1d44e`](https://github.com/0xTanzim/nextRush/commit/9f1d44ebc7807955a5d218c2b52a228911a06236) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Fix CLI install reliability:
  - Ensure the `nextrush` meta-package never declares a `bin` entry (prevents pnpm bin-link conflicts).
  - Ensure `@nextrush/dev` always builds before publish so `nextrush`/`nextrush-dev` binaries work.
  - Add a repo-wide bin validator to catch missing `bin` targets during verification.
  - Scaffold projects with `nextrush dev` / `nextrush build` scripts (no `npx`).
  - Include `@nextrush/dev` in scaffolded dev dependencies so fresh installs expose the local CLI.

- Updated dependencies []:
  - @nextrush/types@3.0.6
  - @nextrush/errors@3.0.6
  - @nextrush/core@3.0.6
  - @nextrush/router@3.0.6
  - @nextrush/di@3.0.6
  - @nextrush/decorators@3.0.6
  - @nextrush/controllers@3.0.6
  - @nextrush/adapter-node@3.0.6

## 3.0.5

### Patch Changes

- [#21](https://github.com/0xTanzim/nextRush/pull/21) [`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

- Updated dependencies [[`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5)]:
  - @nextrush/adapter-node@3.0.5
  - @nextrush/controllers@3.0.5
  - @nextrush/decorators@3.0.5
  - @nextrush/dev@3.0.5
  - @nextrush/di@3.0.5
  - @nextrush/errors@3.0.5
  - @nextrush/router@3.0.5
  - @nextrush/types@3.0.5
  - @nextrush/core@3.0.5

## 3.0.4

### Patch Changes

- Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

- Updated dependencies []:
  - @nextrush/adapter-node@3.0.4
  - @nextrush/controllers@3.0.4
  - @nextrush/decorators@3.0.4
  - @nextrush/dev@3.0.4
  - @nextrush/di@3.0.4
  - @nextrush/errors@3.0.4
  - @nextrush/router@3.0.4
  - @nextrush/types@3.0.4
  - @nextrush/core@3.0.4

## 3.0.3

### Patch Changes

- Patch **3.0.3**: **`nextrush`** ships the **`nextrush`** CLI via **`@nextrush/dev`**; **`@nextrush/dev`** skips false-positive decorator `tsconfig` warnings on functional scaffolds; **`create-nextrush`** / docs / plugin metadata aligned to **3.0.3**.

- Updated dependencies []:
  - @nextrush/adapter-node@3.0.3
  - @nextrush/controllers@3.0.3
  - @nextrush/decorators@3.0.3
  - @nextrush/dev@3.0.3
  - @nextrush/di@3.0.3
  - @nextrush/errors@3.0.3
  - @nextrush/router@3.0.3
  - @nextrush/types@3.0.3
  - @nextrush/core@3.0.3

## 3.0.1

### Patch Changes

- [#15](https://github.com/0xTanzim/nextRush/pull/15) [`6c37c2f`](https://github.com/0xTanzim/nextRush/commit/6c37c2f1a60c24eda5fba50c7543627104fb776c) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Sync package metadata and documentation URLs, and ensure package-level homepage/readme publishing metadata is consistent across released packages.

- Updated dependencies []:
  - @nextrush/types@3.0.1
  - @nextrush/errors@3.0.1
  - @nextrush/core@3.0.1
  - @nextrush/router@3.0.1
  - @nextrush/di@3.0.1
  - @nextrush/decorators@3.0.1
  - @nextrush/controllers@3.0.1
  - @nextrush/adapter-node@3.0.1
