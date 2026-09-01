# @nextrush/logger

## 2.0.0

### Major Changes

- [`0eaed1b`](https://github.com/0xTanzim/nextRush/commit/0eaed1b109b7a9850318a4e9eed72e458a26edeb) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Aligns `@nextrush/logger` with the `@nextrush/log` v0.3 public surface.

  **BREAKING** — removed ~40 stale re-exports that `@nextrush/log` v0.3.0 no longer
  exposes (audit-removed internal helpers): `serializeError`, `safeSerialize`,
  `shouldLog`, `compareLevels`, `isValidLogLevel`, `parseLogLevel`, `LOG_LEVELS`,
  `LOG_LEVEL_PRIORITY`, `formatJSON`, `formatPrettyJSON`, `formatPrettyTerminal`,
  `formatPrettyTimestamp`, `formatTimestamp`, `detectRuntime`, `getRuntime`,
  `getEnvVar`, `getProcessId`, `isProductionBuild`, `scopedLogger`,
  `createConsoleTransport`, `createPredicateTransport`,
  `createNamespaceRateLimitedTransport`, `clearGlobalTransports`,
  `configureFromEnv`, `setGlobalLevel`, `resetGlobalConfig`, `enableNamespaces`,
  `disableNamespaces`, `DEFAULT_SENSITIVE_KEYS`, `mergeSensitiveKeys`,
  `redactSensitiveValues`, `containsSensitivePattern`, `sanitizeContext`,
  `shouldRedact`, `isError`, and `defaultLogger` (use `log`). Also removed the old
  `Logger` **value** export — `Logger` is now type-only in v0.3 (use
  `createLogger(name)`).

  **Migrate:** import these directly from `@nextrush/log` where they survive, or
  use the surviving API (`log`, `createLogger`, `configure`, `addGlobalTransport`,
  transports, async-context helpers). See the README migration notes and RFC-036.

  **Behavior:** the `logRequestStart` default no longer calls the removed
  `isProductionBuild()`. It is now derived from a new explicit
  `environment?: 'development' | 'production'` option (default `'development'`),
  which is edge-portable and never reads `process.env`. An explicit
  `logRequestStart` still overrides the default.

### Patch Changes

- [`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Prepare the NextRush v4 ecosystem patch release with updates across core, routing, adapters, middleware, utilities, OpenAPI, testing, development tooling, and the create-nextrush scaffolder.

- Updated dependencies [[`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8)]:
  - @nextrush/types@4.0.2
  - @nextrush/core@4.0.2

## 1.0.0

### Patch Changes

- [`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Consolidated patch release across all NextRush public packages.

- Updated dependencies [[`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9)]:
  - @nextrush/core@4.0.0
  - @nextrush/types@4.0.0

## 1.0.0-beta.1

### Patch Changes

- Consolidated patch release across all NextRush public packages.

- Updated dependencies []:
  - @nextrush/core@4.0.0-beta.2
  - @nextrush/types@4.0.0-beta.2

## 1.0.0-beta.0

### Patch Changes

- Updated dependencies [2820a4c]
- Updated dependencies [eee4462]
- Updated dependencies [793d596]
- Updated dependencies [838367f]
  - @nextrush/types@4.0.0-beta.0
  - @nextrush/core@4.0.0-beta.0

## 3.1.0

### Patch Changes

- Updated dependencies [d7eb075]
- Updated dependencies [32a0db6]
  - @nextrush/types@3.1.0
  - @nextrush/core@3.1.0

## 3.0.5

### Patch Changes

- [#21](https://github.com/0xTanzim/nextRush/pull/21) [`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

- Updated dependencies [[`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5)]:
  - @nextrush/types@3.0.5
  - @nextrush/core@3.0.5

## 3.0.4

### Patch Changes

- Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

- Updated dependencies []:
  - @nextrush/types@3.0.4
  - @nextrush/core@3.0.4

## 3.0.3

### Patch Changes

- Patch **3.0.3**: **`nextrush`** ships the **`nextrush`** CLI via **`@nextrush/dev`**; **`@nextrush/dev`** skips false-positive decorator `tsconfig` warnings on functional scaffolds; **`create-nextrush`** / docs / plugin metadata aligned to **3.0.3**.

- Updated dependencies []:
  - @nextrush/types@3.0.3
  - @nextrush/core@3.0.3

## 3.0.1

### Patch Changes

- [#15](https://github.com/0xTanzim/nextRush/pull/15) [`6c37c2f`](https://github.com/0xTanzim/nextRush/commit/6c37c2f1a60c24eda5fba50c7543627104fb776c) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Sync package metadata and documentation URLs, and ensure package-level homepage/readme publishing metadata is consistent across released packages.

- Updated dependencies []:
  - @nextrush/types@3.0.1
  - @nextrush/core@3.0.1
