# @nextrush/logger

> Request logging middleware for NextRush -- attaches a correlation-ID-aware logger to every request context and re-exports the `@nextrush/log` v0.3 public surface.

[![npm version](https://img.shields.io/npm/v/@nextrush/logger.svg)](https://www.npmjs.com/package/@nextrush/logger)
[![downloads](https://img.shields.io/npm/dm/@nextrush/logger.svg)](https://www.npmjs.com/package/@nextrush/logger)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/logger.svg)](https://bundlephobia.com/package/@nextrush/logger)
[![types](https://img.shields.io/npm/types/@nextrush/logger.svg)](https://www.npmjs.com/package/@nextrush/logger)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/logger.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Attach a request-scoped, correlation-ID-aware logger to `ctx.log` and log every request's method/path/status/duration |
| **Package type** | Middleware |
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install. Not re-exported from `nextrush` or `nextrush/class`. |
| **Support tier** | Public -- middleware/registrar (stable) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal -- Node, Bun, Deno, Edge for the middleware itself (see [Compatibility](#compatibility) for the underlying logger's per-runtime notes) |
| **Requires** | Node >=22, ESM-only, TypeScript >=5.x |
| **Introduced** | v1.0.0 |

## Highlights

- The middleware itself has zero third-party runtime dependencies beyond its two `@nextrush/*` deps; it depends on the standalone [`@nextrush/log`](https://www.npmjs.com/package/@nextrush/log) package for the actual logging engine (see [Package relationships](#package-relationships))
- ESM-only, tree-shakable, side-effect-free (`sideEffects: false`)
- Fully typed, strict TypeScript, zero `any`
- Structured JSON output by default in production; colorized pretty-terminal output by default in development -- both formats come from `@nextrush/log`, not reimplemented here

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) . [When to use](#when-to-use) . [Installation](#installation) . [Quick start](#quick-start) . [Capabilities](#capabilities) . [Mental model](#mental-model) . [Common tasks](#common-tasks) . [API overview](#api-overview) . [Options](#options) . [Compatibility](#compatibility) . [Troubleshooting](#troubleshooting) . [FAQ](#faq) . [Package relationships](#package-relationships) . [Architecture](#architecture) . [Resources](#resources)

</details>

---

## The problem

Logging a request by hand means remembering to capture the same fields every time -- method, path, status, duration -- and getting them wrong is easy: a duration measured before the handler runs instead of after, a status read before the handler sets it, or a stray `console.log(userObject)` that puts a password or session token straight into a log aggregator with no code review catching it.

```ts
// TODAY, without this package -- looks fine, has real gaps:
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  console.log(`${ctx.method} ${ctx.path} ${ctx.status}`, Date.now() - start);
  // No correlation ID -- can't tie this line to the request that produced it
  // downstream. No structured fields -- a log aggregator has to regex this.
  // No redaction -- ctx.query or a logged object can carry a token straight
  // into the log stream with nothing stopping it here.
});
```

## When to use

**Use `@nextrush/logger` if:**

- You want every request logged with a correlation ID, method, path, status, and duration without writing that boilerplate per route
- You want `ctx.log` available in handlers, pre-scoped to the request's correlation ID
- You want production logs as structured JSON (for a log aggregator) and development logs as readable colored text, without hand-switching the format

**Reach for something else if:**

- You only need application-level logging with no request middleware or correlation-ID wiring -- install [`@nextrush/log`](https://www.npmjs.com/package/@nextrush/log) directly; this package re-exports its stable v0.3 surface but adds a request layer on top
- You need response-time headers on the wire (`X-Response-Time`) rather than log lines -- see [`@nextrush/timer`](../timer)
- You need the correlation ID itself generated/propagated as a header for services that don't log -- see [`@nextrush/request-id`](../request-id); the two packages solve overlapping but distinct problems and can be used together

---

## Installation

```bash
pnpm add @nextrush/logger
# npm i @nextrush/logger . yarn add @nextrush/logger . bun add @nextrush/logger
```

> [!NOTE]
> `@nextrush/logger` is not re-exported by the `nextrush` meta package -- install and import it
> directly, as shown above. It depends on `@nextrush/log` (installed automatically).

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { logger } from '@nextrush/logger';

const app = createApp();

app.use(logger());

app.get('/users', (ctx) => {
  ctx.log.info('Fetching users');
  ctx.json({ users: [] });
});

listen(app, 8080);
```

Every request now gets a correlation ID (generated, or read from `x-request-id` if the client sent one), a request-scoped logger at `ctx.log`, and a completion log line carrying method/path/status/duration -- all three without any code in the handler.

## Capabilities

**Request logging**
- Logs request completion (method, path, status, duration in ms) for every request, unless `skip()` excludes it
- Logs request start too, but only by default in non-production (`logRequestStart` default follows `isProductionBuild()`)
- Picks the log level per response automatically: `successLevel` for 2xx/3xx, `clientErrorLevel` for 4xx, `serverErrorLevel` for 5xx (`info`/`warn`/`error` by default) -- an uncaught error is always logged via `.error()` regardless of status, then rethrown

**Correlation ID**
- Reads the correlation ID from a request header (`x-request-id` by default, configurable via `correlationIdHeader`)
- Generates one with `crypto.randomUUID()` when missing and not disabled, falling back to a timestamp+random string on runtimes without `crypto.randomUUID`
- Echoes the correlation ID back on the same response header name it was read from/generated for

**Context integration**
- Attaches a correlation-ID-scoped logger to `ctx.log` (via `logger()` or the lighter `attachLogger()`, which skips request-completion logging)
- `hasLogger()` / `getLogger()` give a safe way to read `ctx.log` when a handler can't be sure the middleware ran first

**Re-exported logging engine (`@nextrush/log`)**
- Every stable export of `@nextrush/log` v0.3 -- `createLogger`, `log`, `configure`, transports, async-context helpers, and the surviving types -- is re-exported from this package's entry point, so application code depends on one package instead of two. Internal/removed v0.2 helpers are intentionally **not** re-exported (see [Migration notes](#migration-notes-@nextrushlog-v0.3)).

## Mental model

`logger()` does three things around your handler: read-or-generate a correlation ID before `next()`, attach `ctx.log` before `next()`, and log one completion line after `next()` resolves (or throws).

```text
request --> logger() --> read/generate correlation ID --> ctx.log = scoped logger
                                                                |
                                                        await next() (your handlers run)
                                                                |
                                                request completes or throws
                                                                |
                                        one log line: method, path, status, duration
```

**Rule:** the completion log line is written in a `finally` block, so it fires whether the handler succeeds, sends an error response, or throws -- there is no code path through `logger()` that skips it once `next()` has been called.

> [!TIP]
> The full request-to-log-line sequence, and exactly where redaction happens in that
> sequence, are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Log every request with defaults

```ts
import { logger } from '@nextrush/logger';

app.use(logger());
```

### Skip noisy paths

```ts
app.use(logger({
  skip: (ctx) => ctx.path === '/health' || ctx.path === '/metrics',
}));
```

### Attach `ctx.log` without per-request completion logging

```ts
import { attachLogger } from '@nextrush/logger';

app.use(attachLogger({ context: 'api' }));

app.use(async (ctx) => {
  ctx.log.info('Handler called');
  ctx.json({ ok: true });
});
```

### Read `ctx.log` defensively when middleware order is uncertain

```ts
import { getLogger, hasLogger } from '@nextrush/logger';

app.use(async (ctx) => {
  if (hasLogger(ctx)) {
    ctx.log.info('Logger was already attached');
  }
  const log = getLogger(ctx, 'fallback');
  log.info('Always works, even without the middleware');
});
```

### Redact custom sensitive keys on top of the defaults

```ts
import { logger } from '@nextrush/logger';

app.use(logger({
  redact: true,
  sensitiveKeys: ['internalUserId', 'billingRef'],
}));
```

`sensitiveKeys` is merged with `@nextrush/log`'s built-in default list (`DEFAULT_SENSITIVE_KEYS`) via `mergeSensitiveKeys` -- you are extending the list, not replacing it.

## API overview

The sealed public surface (ADR-0005). The stable `@nextrush/log` v0.3 exports are re-exported;
only this package's own additions are listed here -- see [Re-exports from @nextrush/log](#re-exports-from-nextrushlog).

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `logger` | `(options?: LoggerMiddlewareOptions) => Middleware` | 1.0.0 | Stable | Request logging middleware. Attaches `ctx.log` and logs one completion line per request. |
| `attachLogger` | `(options?: LoggerMiddlewareOptions) => Middleware` | 1.0.0 | Stable | Attaches `ctx.log` only -- no completion logging. |
| `hasLogger` | `(ctx: Context) => ctx is LoggerContext` | 1.0.0 | Stable | Type guard for whether `ctx.log` is present and looks like a logger. |
| `getLogger` | `(ctx: Context, fallbackContext?: string) => ILogger` | 1.0.0 | Stable | Returns `ctx.log` if present, else a fresh logger for `fallbackContext` (default `'nextrush'`). |
| `type LoggerContext` | `Context & { log: ILogger }` | 1.0.0 | Stable | `Context` narrowed to include `log`. |
| `type LoggerMiddlewareOptions` | `LoggerOptions & { skip?, formatMessage?, successLevel?, clientErrorLevel?, serverErrorLevel?, logRequestStart?, environment?, correlationIdHeader?, generateCorrelationId?, context? }` | 1.0.0 | Stable | Options for `logger()`/`attachLogger()`. Extends `@nextrush/log`'s `LoggerOptions`. |

### Re-exports from @nextrush/log

`log`, `createLogger`, `configure`, `addGlobalTransport`, `disableLogging`, `createBatchTransport`, `createFilteredTransport`, `createRateLimitedTransport`, `createContextMiddleware`, `getAsyncContext`, `runWithContext`, plus the surviving types (`LogLevel`, `LogEntry`, `LogContext`, `LoggerOptions`, `ILogger`, `Logger`, `LogTransport`, `RuntimeEnvironment`, `RuntimeInfo`, `SerializedError`, `PerformanceMetrics`, `Timer`, `BatchTransport`, `BatchTransportOptions`, `AsyncLogContext`, `GlobalLoggerConfig`, `RateLimitOptions`, `RateLimitStats`, `NamespaceRateLimits`). See [`@nextrush/log`](https://www.npmjs.com/package/@nextrush/log) for full documentation of these.

### Migration notes (`@nextrush/log` v0.3)

`@nextrush/log` v0.3.0 (2026-07-06) removed ~40 previously-exported internal helpers --
`serializeError`, `safeSerialize`, `shouldLog`, `compareLevels`, `isValidLogLevel`,
`parseLogLevel`, `LOG_LEVELS`, `LOG_LEVEL_PRIORITY`, `formatJSON`, `formatPrettyJSON`,
`detectRuntime`, `getRuntime`, `getEnvVar`, `getProcessId`, `isProductionBuild`,
`scopedLogger`, `createConsoleTransport`, `createPredicateTransport`,
`createNamespaceRateLimitedTransport`, `clearGlobalTransports`, and others (see that
package's CHANGELOG for the full list and migration guidance). This package no longer
re-exports any of them, and its `logRequestStart` default no longer calls
`isProductionBuild()`.

- **If you imported removed helpers from `@nextrush/logger`:** switch to the surviving
  API. `createLogger(name)` + `log` cover logger acquisition; transports/serializers
  that remain are exported. Anything audit-removed is internal plumbing `@nextrush/log`
  no longer exposes.
- **`isProductionBuild()` → `environment` option:** the middleware's production default
  is now derived from an explicit `environment?: 'development' | 'production'` option
  (default `'development'`), which is edge-portable and never reads `process.env`. Set
  `environment: 'production'` when deploying; an explicit `logRequestStart` still wins.

## Options

Every default below is read directly from `src/index.ts` (this package) or `@nextrush/log`'s `LoggerOptions` resolution for the rows marked "via @nextrush/log".

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------ | ----------- |
| `skip` | `(ctx: Context) => boolean` | No | `undefined` | No | When it returns `true`, `logger()` calls `next()` and returns immediately -- no correlation ID, no `ctx.log`, no completion line for that request. |
| `formatMessage` | `(ctx: Context, duration: number) => string` | No | `` `${method} ${path}` `` | No | Overrides the completion log line's message text only -- the structured fields (`method`, `path`, `status`, `duration`) are still attached separately. |
| `successLevel` | `LogLevel` | No | `'info'` | No | Level used for 2xx/3xx completion logs. |
| `clientErrorLevel` | `LogLevel` | No | `'warn'` | No | Level used for 4xx completion logs. |
| `serverErrorLevel` | `LogLevel` | No | `'error'` | No | Level used for 5xx completion logs. |
| `logRequestStart` | `boolean` | No | `environment !== 'production'` | No | Whether a `debug`-level "Request started" line is logged before `next()`. |
| `environment` | `'development' \| 'production'` | No | `'development'` | No | Derives the `logRequestStart` default (development → on, production → off); explicit `logRequestStart` wins. Edge-portable -- never reads `process.env`. |
| `correlationIdHeader` | `string` | No | `'x-request-id'` | No | Header name read for an incoming correlation ID, and written back on the response. |
| `generateCorrelationId` | `boolean` | No | `true` | No | Whether to generate a correlation ID (via `crypto.randomUUID()`, falling back to timestamp+random) when the header is absent. |
| `context` | `string` | No | `'nextrush'` | No | The logger context/name prefix passed to `createLogger()`. |
| `redact` (via `@nextrush/log`) | `boolean` | No | `true` in production, `false` in development/test | Yes | Enables key-based and pattern-based redaction inside `@nextrush/log`'s serializer -- see [Architecture](#architecture) for exactly what gets redacted and when. |
| `sensitiveKeys` (via `@nextrush/log`) | `string[]` | No | `[]` (merged with `DEFAULT_SENSITIVE_KEYS`) | Yes | Additional key names to redact, on top of the ~60 built-in defaults (`password`, `token`, `authorization`, `cookie`, `ssn`, credit-card/bank fields, and similar). |
| `pretty` (via `@nextrush/log`) | `boolean` | No | `true` in development/test, `false` in production | No | Colorized multi-line terminal output vs. single-line JSON. See [Mental model](#mental-model) and [Architecture](#architecture). |
| `minLevel` (via `@nextrush/log`) | `LogLevel` | No | `'trace'` in dev/test; `'info'` (or `'debug'` if `ENABLE_DEBUG_LOGS`/`DEBUG` is set) in production | No | The floor below which a log call is dropped before it reaches formatting/redaction at all. |

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | 3.x |
| Node.js | >=22 |
| TypeScript | >=5.x |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Node.js >=22 | Yes | ESM-only |
| Bun / Deno | Yes / Yes | `@nextrush/log` detects these runtimes explicitly (`detectRuntime()`) and uses `AsyncLocalStorage`-based context where available |
| Edge / Cloudflare Workers / browsers | Partial | `@nextrush/log` falls back to a non-`AsyncLocalStorage` context path (per its own runtime detection); correlation-ID propagation through this package's middleware still works, since it does not depend on `AsyncLocalStorage` itself |

**Integration**
- **Peer dependencies:** `@nextrush/core` (optional -- only needed for the `Middleware`/`Context` types it references at compile time; the middleware itself only needs a NextRush-shaped `Context`).
- **Depends on:** `@nextrush/log` (a separate, standalone npm package -- see [Package relationships](#package-relationships)), `@nextrush/types`.
- **Works with:** [`@nextrush/request-id`](../request-id) for header-based correlation-ID propagation to downstream services; [`@nextrush/timer`](../timer) for response-time headers alongside logged duration.
- **Incompatible with:** none directly -- both packages can independently read/write the same `x-request-id`-style header if configured to use the same header name; the last one to run wins on the response header (though `logger()`'s own correlation ID is unaffected either way, since it reads before writing).

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node >=22, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong>Log lines suddenly show up as single-line JSON instead of colored text</strong></summary>

**Cause:** `@nextrush/log`'s `pretty` option defaults to `true` only in `development`/`test`; in a `production` environment (detected via `NODE_ENV` or `isProductionBuild()`) it defaults to `false`, switching the formatter from `formatPrettyTerminal` to `formatJSON`. **Fix:** if you want pretty output in a production-labeled environment anyway, pass `pretty: true` explicitly to `logger()`.

</details>

<details>
<summary><strong>A field I expected to see in logs shows up as `[REDACTED]`</strong></summary>

**Cause:** the key name matched (case-insensitively, by substring) one of `@nextrush/log`'s `DEFAULT_SENSITIVE_KEYS`, or the *value* matched a built-in SSN/credit-card/bank-account pattern -- this happens automatically whenever `redact` is `true` (the production default), independent of what you named the field. **Fix:** this is working as intended for genuinely sensitive fields. If a field is being redacted by mistake (e.g. a key merely containing `"key"` or `"hash"` as a substring), rename the field, or explicitly pass `redact: false` if you have already reviewed the data for sensitivity elsewhere.

</details>

<details>
<summary><strong>Two different correlation IDs show up for what looks like one request</strong></summary>

**Cause:** `@nextrush/request-id` and `@nextrush/logger` each generate/read a correlation ID independently -- if both are mounted and configured with different header names (or one runs before the client's header is set), each will generate its own ID. **Fix:** point both packages at the same `correlationIdHeader`/equivalent option, and make sure whichever middleware runs first is the one whose generated ID you want propagated.

</details>

<details>
<summary><strong>`ctx.log` is `undefined` in a handler</strong></summary>

**Cause:** neither `logger()` nor `attachLogger()` ran before the handler -- `ctx.log` is only attached by those two middleware, not by `Context` itself. **Fix:** register `app.use(logger())` (or `attachLogger()`) before any route that reads `ctx.log`, or use `getLogger(ctx)` in handlers that may run without it, which returns a fallback logger instead of throwing.

</details>

## FAQ

**Can I use `@nextrush/log` without the middleware?**
Yes -- install `@nextrush/log` directly for application-level logging with no request/correlation-ID layer. This package re-exports `@nextrush/log`'s stable v0.3 surface (the surviving values and types), so most applications only need to depend on `@nextrush/logger`; removed v0.2 internal helpers are not re-exported (see [Migration notes](#migration-notes-@nextrushlog-v0.3)).

**Is sensitive data redacted from logs automatically?**
Yes, but only by default in production. `@nextrush/log`'s `redact` option (re-exported and configurable through this package's `logger()`/`attachLogger()` options) defaults to `true` in production and `false` in development/test, and applies both key-based matching (~60 default sensitive key names, extendable via `sensitiveKeys`) and pattern-based matching (SSN, credit-card, and bank-account-shaped strings) to logged data. See [Architecture](#architecture) for exactly where this runs in the request lifecycle.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Yes for the middleware itself. `@nextrush/log`'s context-propagation mechanism varies by runtime (see [Compatibility](#compatibility)) -- correlation-ID handling in this package does not depend on that mechanism, so it behaves identically everywhere.

---

## Package relationships

```text
                  depends on            @nextrush/log  (the logging engine -- a separate published package)
@nextrush/logger ------------------->
                  depends on            @nextrush/types  (Context / Middleware contracts, types only)
                  often used with       @nextrush/request-id, @nextrush/timer
```

- **Depends on:** [`@nextrush/log`](https://www.npmjs.com/package/@nextrush/log) -- the standalone logging engine (levels, transports, formatters, redaction, runtime detection); this package wraps it with a request middleware and re-exports its full API. [`@nextrush/types`](../../types) -- `Context`/`Middleware` contracts, types only.
- **Often used with:** [`@nextrush/request-id`](../request-id) -- a narrower package focused specifically on generating/propagating a correlation ID header, useful when you want that behavior without pulling in the full logging engine. [`@nextrush/timer`](../timer) -- response-time headers on the wire, complementing this package's logged duration field.
- **Usually used next:** [`@nextrush/health`](../health) -- liveness/readiness endpoints, commonly excluded from request logging via `skip`.
- **Alternative:** none within NextRush for structured request logging -- `@nextrush/log` alone covers application logging without the request layer.

## Architecture

Maintaining or contributing to this package? The internal design -- the request-to-log-line
sequence, exactly where redaction and format selection happen, and the decisions and trade-offs
behind them (with diagrams) -- is in **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**.

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) . [Architecture](./ARCHITECTURE.md) . [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
