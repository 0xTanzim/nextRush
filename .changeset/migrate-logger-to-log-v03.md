---
'@nextrush/logger': major
---

Aligns `@nextrush/logger` with the `@nextrush/log` v0.3 public surface.

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
