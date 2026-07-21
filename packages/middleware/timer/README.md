# @nextrush/timer

> Measures request duration and reports it as a response header (`X-Response-Time`) or a `Server-Timing` entry, with the raw value stored in `ctx.state` for handlers and downstream logging.

[![npm version](https://img.shields.io/npm/v/@nextrush/timer.svg)](https://www.npmjs.com/package/@nextrush/timer)
[![downloads](https://img.shields.io/npm/dm/@nextrush/timer.svg)](https://www.npmjs.com/package/@nextrush/timer)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/timer.svg)](https://bundlephobia.com/package/@nextrush/timer)
[![types](https://img.shields.io/npm/types/@nextrush/timer.svg)](https://www.npmjs.com/package/@nextrush/timer)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/timer.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Measure how long a request took to process, store the duration in `ctx.state`, and optionally write it to a response header |
| **Package type** | Middleware |
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install. Not re-exported from `nextrush` or `nextrush/class`. |
| **Support tier** | Public -- middleware/registrar (stable) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal -- Node, Bun, Deno, Cloudflare Workers, Vercel Edge (uses the global `performance.now()` when available, `Date.now()` otherwise) |
| **Requires** | Node >=22, ESM-only, TypeScript >=5.x |
| **Introduced** | v1.0.0 |

## Highlights

- Zero runtime dependencies beyond `@nextrush/types` (types only, erased at build)
- High-resolution timing via the Web-standard global `performance.now()`, with an automatic fallback to `Date.now()` on a runtime that doesn't expose it -- no adapter needed
- ESM-only, tree-shakable, side-effect-free (`sideEffects: false`)
- Fully typed, strict TypeScript, zero `any`
- Four exports built on the same measurement core -- `timer()`, `responseTime()` (an alias), `detailedTimer()` (adds start/end timestamps), and `serverTiming()` (the standard `Server-Timing` header for browser DevTools)

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) . [When to use](#when-to-use) . [Installation](#installation) . [Quick start](#quick-start) . [Capabilities](#capabilities) . [Mental model](#mental-model) . [Common tasks](#common-tasks) . [API overview](#api-overview) . [Options](#options) . [Compatibility](#compatibility) . [Troubleshooting](#troubleshooting) . [FAQ](#faq) . [Package relationships](#package-relationships) . [Architecture](#architecture) . [Resources](#resources)

</details>

---

## The problem

Knowing how long a request took requires a timestamp before the handler runs and another after it finishes, in a unit and precision that's actually usable in a header or a log line. Rolling this by hand tends to skip the parts that make the header safe to expose:

```ts
// TODAY, without this package -- looks fine, has real gaps:
app.use(async (ctx, next) => {
  const start = Date.now();
  // Date.now() has millisecond resolution only -- fine for slow requests,
  // too coarse to distinguish a 0.3ms handler from a 0.8ms one.
  await next();
  const duration = Date.now() - start;
  // No clamp on decimal places, no validation that a custom header name
  // is a legal HTTP token -- a typo'd header value can produce a malformed
  // response later instead of failing loudly when the middleware is built.
  ctx.set('X-Response-Time', `${duration}ms`);
});
```

## When to use

**Use `@nextrush/timer` if:**

- You want a response-time header or `ctx.state` value with zero configuration, measured with the highest resolution the runtime provides
- You want the standard `Server-Timing` header for Chrome/Firefox DevTools' Network panel performance breakdown
- You want start/end timestamps alongside the duration (for correlating with external timing data), not just the elapsed time

**Reach for something else if:**

- You want a unique per-request identifier, not a duration -- see [`@nextrush/request-id`](../request-id)
- You want the timing value formatted into structured log lines with redaction -- see [`@nextrush/logger`](../logger); mount `timer()` first and read `ctx.state.responseTime` from the logger

---

## Installation

```bash
pnpm add @nextrush/timer
# npm i @nextrush/timer . yarn add @nextrush/timer . bun add @nextrush/timer
```

> [!NOTE]
> `@nextrush/timer` is not re-exported by the `nextrush` meta package -- install and import it
> directly, as shown above.

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { timer } from '@nextrush/timer';

const app = createApp();

app.use(timer({ exposeHeader: true }));

app.get('/users', (ctx) => {
  ctx.json({ tookMs: ctx.state.responseTime });
});

listen(app, 8080);
```

Every request now measures its own duration with `performance.now()` (falling back to `Date.now()` if unavailable), stores the number of milliseconds at `ctx.state.responseTime`, and -- because `exposeHeader: true` was passed -- writes it to the `X-Response-Time` response header. `exposeHeader` defaults to `false`: without it, the value is still in `ctx.state`, just not on the response.

## Capabilities

**Measurement**
- Measures elapsed time from just before `ctx.next()` is awaited to just after it resolves (in a `finally` block, so the measurement still runs if the handler throws)
- Uses the global `performance.now()` when `globalThis.performance` exposes a `.now` function, and falls back to `Date.now()` otherwise -- both return milliseconds, so the unit is consistent either way; only the sub-millisecond resolution differs
- Accepts a custom `now` time-getter function for deterministic testing or an alternative clock source

**Header and formatting**
- `exposeHeader` defaults to `false` -- the duration is always stored in `ctx.state`, but the response header is only written when explicitly enabled
- The header value is rounded and formatted to a fixed number of decimal places (`precision`, default `2`, clamped to the range `[0, 6]`) before being written -- `Math.round` first, then `toFixed`, so `X-Response-Time: 12.34ms` never shows more digits than the configured precision
- The custom `header` name and `suffix` string are both validated once, at middleware-creation time -- an invalid header name (fails the RFC 7230 HTTP token pattern) or an unsafe suffix throws immediately rather than producing a malformed header later

**Detailed timing (`detailedTimer`)**
- With `detailed: false` (the default), stores the same rounded number in `ctx.state` as `timer()`
- With `detailed: true`, stores a `TimingResult` object instead -- `{ duration, formatted, start, end }` -- giving handlers the raw start/end timestamps alongside the formatted string

**Server-Timing (`serverTiming`)**
- Writes the standard `Server-Timing` response header (e.g. `Server-Timing: total;dur=12.34`), appending to any existing value on that header rather than overwriting it -- so multiple `Server-Timing` entries from different middleware compose correctly
- The `metric` name is sanitized (stripped to RFC 7230 token characters) and the optional `description` has control characters removed and quotes escaped before being written -- both close the same header-injection risk class as `timer()`'s header-name validation, but by sanitizing rather than throwing, because `metric`/`description` are per-call values, not one-time configuration

## Mental model

Every timer variant follows the same shape: capture a start time, await the rest of the middleware chain, capture an end time in a `finally` block, then store and optionally expose the difference.

```text
request --> start = now() --> await ctx.next() --> end = now()  (in finally)
                                                          |
                                                          v
                                      ctx.state[stateKey] = round(end - start)
                                                          |
                                                          v
                                  exposeHeader? --> ctx.set(header, formatted)
```

**Rule:** the `finally` block means the duration is captured and stored even if a downstream handler throws -- but the response header is only ever written if `exposeHeader` is explicitly `true`; the default is to measure silently.

> [!TIP]
> The exact start-timer -> handler -> stop-timer -> header sequence, and where `serverTiming()`
> differs (appending instead of overwriting), is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Add a response-time header (default disabled)

```ts
import { timer } from '@nextrush/timer';

app.use(timer({ exposeHeader: true }));
// Sets: X-Response-Time: 12.34ms
```

### Read the duration in a handler without exposing a header

```ts
app.use(timer());

app.use(async (ctx) => {
  await ctx.next();
  console.log(`Request took ${ctx.state.responseTime}ms`);
});
```

### Use a custom header name, unit suffix, and precision

```ts
app.use(timer({
  header: 'X-Duration',
  precision: 0,
  suffix: ' milliseconds',
  exposeHeader: true,
}));
// Sets: X-Duration: 12 milliseconds
```

### Get start/end timestamps, not just the duration

```ts
import { detailedTimer } from '@nextrush/timer';
import type { TimingResult } from '@nextrush/timer';

app.use(detailedTimer({ detailed: true }));

app.use(async (ctx) => {
  await ctx.next();
  const timing = ctx.state.responseTime as TimingResult;
  console.log(`Duration: ${timing.duration}ms (from ${timing.start} to ${timing.end})`);
});
```

### Report timing to the browser's DevTools Network panel

```ts
import { serverTiming } from '@nextrush/timer';

app.use(serverTiming({ metric: 'total', exposeHeader: true }));
// Sets: Server-Timing: total;dur=12.34
```

### Use a fixed clock in a test

```ts
import { timer } from '@nextrush/timer';

let time = 0;
app.use(timer({
  now: () => { time += 50; return time; }, // deterministic, no real elapsed time
}));
```

## API overview

The sealed public surface (ADR-0005).

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `timer` | `(options?: TimerOptions) => Middleware` | 1.0.0 | Stable | Core middleware -- measures duration, stores it in `ctx.state`, optionally sets a response header. |
| `responseTime` | `(options?: TimerOptions) => Middleware` | 1.0.0 | Stable | Alias for `timer()` -- identical behavior, more descriptive name. |
| `detailedTimer` | `(options?: DetailedTimerOptions) => Middleware` | 1.0.0 | Stable | Like `timer()`, with an optional `detailed` flag that stores a `TimingResult` object instead of a plain number. |
| `serverTiming` | `(options?: ServerTimingOptions) => Middleware` | 1.0.0 | Stable | Writes the standard `Server-Timing` header, appending to any existing value. |
| `defaultTimeGetter` | `() => number` | 1.0.0 | Stable | `performance.now()` if available, else `Date.now()` -- the default `now` option. |
| `DEFAULT_HEADER` | `'X-Response-Time'` | 1.0.0 | Stable | Default header name for `timer()` / `detailedTimer()`. |
| `SERVER_TIMING_HEADER` | `'Server-Timing'` | 1.0.0 | Stable | The standard header name used by `serverTiming()`. |
| `DEFAULT_SUFFIX` | `'ms'` | 1.0.0 | Stable | Default unit suffix appended to the formatted header value. |
| `DEFAULT_PRECISION` | `2` | 1.0.0 | Stable | Default number of decimal places in the formatted output. |
| `MAX_PRECISION` | `6` | 1.0.0 | Stable | Upper clamp for `precision` (microsecond-level). |
| `DEFAULT_STATE_KEY` | `'responseTime'` | 1.0.0 | Stable | Default `ctx.state` key the duration is stored under. |
| `DEFAULT_METRIC` | `'total'` | 1.0.0 | Stable | Default metric name for `serverTiming()`. |
| `type TimerOptions` | -- | 1.0.0 | Stable | Options for `timer()` / `responseTime()`. |
| `type DetailedTimerOptions` | `TimerOptions & { detailed?: boolean }` | 1.0.0 | Stable | Options for `detailedTimer()`. |
| `type ServerTimingOptions` | `Omit<TimerOptions, 'header' \| 'suffix'> & { metric?: string; description?: string }` | 1.0.0 | Stable | Options for `serverTiming()`. |
| `type TimeGetter` | `() => number` | 1.0.0 | Stable | Custom time-source function shape. |
| `type TimerContext` | -- | 1.0.0 | Stable | Minimal context shape this package depends on. |
| `type TimingResult` | `{ duration, formatted, start, end }` | 1.0.0 | Stable | The detailed-timing object stored when `detailed: true`. |
| `type Middleware` | -- | 1.0.0 | Deprecated | Local middleware type; use `Middleware` from `@nextrush/types` instead. |

## Options

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------ | ----------- |
| `header` | `string` | No | `'X-Response-Time'` | Yes | Response header name for `timer()` / `detailedTimer()`. Validated at creation time against the RFC 7230 HTTP token grammar; an invalid name throws immediately. Not available on `serverTiming()`, which always uses `Server-Timing`. |
| `suffix` | `string` | No | `'ms'` | Yes | Unit string appended after the formatted number in the header value. Validated at creation time against a safe-character pattern (alphanumeric, `.`, `-`, `_`, `%`, space); an unsafe suffix throws immediately. Not available on `serverTiming()`. |
| `precision` | `number` | No | `2` | No | Number of decimal places in the formatted duration. Clamped to `[0, 6]` (`MAX_PRECISION`) -- values outside that range are silently clamped, not rejected. |
| `stateKey` | `string` | No | `'responseTime'` | No | The `ctx.state` key the duration (or `TimingResult`, for `detailedTimer` with `detailed: true`) is stored under. |
| `exposeHeader` | `boolean` | No | `false` | No | Whether to write the measured value onto the response header. When `false` (the default), the value is still stored in `ctx.state` but never appears on the response. |
| `now` | `() => number` | No | `defaultTimeGetter` (`performance.now()`, falling back to `Date.now()`) | No | Custom time-source function. Useful for deterministic tests or an alternative clock. |
| `detailed` | `boolean` | No | `false` | No | `detailedTimer()` only. When `true`, stores a `TimingResult` object (`{ duration, formatted, start, end }`) instead of a plain number. |
| `metric` | `string` | No | `'total'` | Yes | `serverTiming()` only. The metric name written into the `Server-Timing` header. Sanitized (stripped to RFC 7230 token characters) rather than validated-and-thrown, since it's a per-call value. |
| `description` | `string` | No | `undefined` (omitted from the header) | Yes | `serverTiming()` only. Optional human-readable description. Control characters are removed and `"` is escaped before being written into the `desc="..."` header segment. |

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
| Node.js >=22 | Yes | Global `performance.now()` is available; `defaultTimeGetter` uses it |
| Bun / Deno | Yes / Yes | Same global `performance.now()` API |
| Cloudflare Workers / Vercel Edge | Yes | Falls back to `Date.now()` only if `globalThis.performance.now` is genuinely absent -- both of these runtimes expose `performance.now()` |

**Integration**
- **Peer dependencies:** none beyond `@nextrush/types` (types only, erased at build).
- **Depends on:** `@nextrush/types` (the `Middleware` type re-exported for compatibility).
- **Works with:** [`@nextrush/logger`](../logger), which can read `ctx.state.responseTime` and include it in structured log lines -- mount `timer()` before the logger so the value is populated by the time the logger runs.
- **Incompatible with:** none directly -- `serverTiming()` appends to any existing `Server-Timing` header value rather than overwriting it, so multiple `serverTiming()` middleware (or another package writing the same header) compose without clobbering each other.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node >=22, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong>The <code>X-Response-Time</code> header never appears on the response</strong></summary>

**Cause:** `exposeHeader` defaults to `false` -- the duration is always measured and stored in `ctx.state`, but the header is only written when explicitly enabled. **Fix:** pass `exposeHeader: true`.

```ts
app.use(timer({ exposeHeader: true }));
```

</details>

<details>
<summary><strong>Creating the middleware throws <code>Invalid header name</code> or <code>Invalid suffix</code></strong></summary>

**Cause:** a custom `header` value doesn't match the RFC 7230 HTTP token grammar, or a custom `suffix` contains a character outside the safe set (alphanumeric, `.`, `-`, `_`, `%`, space). Both checks run once, at middleware-creation time -- before any request is handled. **Fix:** use a valid HTTP header token for `header`, and stick to the safe character set for `suffix`.

</details>

<details>
<summary><strong>The header shows fewer decimal places than expected</strong></summary>

**Cause:** `precision` is clamped to `[0, 6]` -- a value above `6` (`MAX_PRECISION`) is silently clamped down, not rejected. A negative value is clamped up to `0`. **Fix:** if you need more than microsecond-level precision, that's the hard ceiling this package enforces; there is no way to request more.

</details>

<details>
<summary><strong>Multiple <code>Server-Timing</code> entries aren't showing up as expected</strong></summary>

**Cause:** if another middleware in the chain also writes `Server-Timing` and runs *after* `serverTiming()`'s `ctx.next()` resolves using `ctx.set()` (which overwrites) instead of appending, it can replace this package's entry. **Fix:** ensure every `Server-Timing` writer in your stack reads the existing header value and appends with a comma, the way `serverTiming()` itself does.

</details>

## FAQ

**Does `timer()` measure only the time inside my own route handler, or the whole middleware chain below it?**
Whichever middleware chain runs between the point `timer()` calls `await ctx.next()` and that call resolving -- so mounting it early in the chain measures everything downstream; mounting it just before a specific route measures only that route's remaining chain.

**Is the duration always in milliseconds?**
Yes. Both `performance.now()` and `Date.now()` (the fallback) return a millisecond-based number; the `suffix` option only changes the label text on the header, not the underlying unit or the number stored in `ctx.state`.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Yes, identically -- the package uses only the global `performance.now()` (falling back to `Date.now()` if that global is absent), and has no Node-specific import.

---

## Package relationships

```text
                 depends on            @nextrush/types  (Middleware type, re-exported)
@nextrush/timer -------------->
                 often used with       @nextrush/logger
```

- **Depends on:** [`@nextrush/types`](../../types) -- the `Middleware` type, re-exported for compatibility.
- **Often used with:** [`@nextrush/logger`](../logger) -- can read `ctx.state.responseTime` and include it in a structured log line.
- **Usually used next:** [`@nextrush/request-id`](../request-id) -- a per-request identifier, commonly mounted alongside response timing for the same observability pipeline.
- **Alternative:** none within NextRush for response-time measurement -- `serverTiming()` and `timer()`/`detailedTimer()` in this package cover the header-based and `ctx.state`-based cases respectively.

## Architecture

Maintaining or contributing to this package? The internal design -- the start-timer -> handler ->
stop-timer -> header sequence, the precision-clamping and sanitization logic, and the decisions and
trade-offs behind them (with diagrams) -- is in **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**.

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) . [Architecture](./ARCHITECTURE.md) . [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
