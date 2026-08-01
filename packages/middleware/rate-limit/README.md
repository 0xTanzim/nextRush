# @nextrush/rate-limit

> Rate limiting middleware for NextRush -- token bucket, sliding window, and fixed window algorithms, tiered limits, and CIDR-aware allow/deny lists, with an in-memory store out of the box.

[![npm version](https://img.shields.io/npm/v/@nextrush/rate-limit.svg)](https://www.npmjs.com/package/@nextrush/rate-limit)
[![downloads](https://img.shields.io/npm/dm/@nextrush/rate-limit.svg)](https://www.npmjs.com/package/@nextrush/rate-limit)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/rate-limit.svg)](https://bundlephobia.com/package/@nextrush/rate-limit)
[![types](https://img.shields.io/npm/types/@nextrush/rate-limit.svg)](https://www.npmjs.com/package/@nextrush/rate-limit)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/rate-limit.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Limit request rate per client, with a choice of algorithm and storage backend |
| **Package type** | Middleware |
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install. Not re-exported from `nextrush` or `nextrush/class`. |
| **Support tier** | Public -- middleware/registrar (stable) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal -- Node, Bun, Deno, Edge (zero `node:` imports; the built-in store uses `setInterval`/`Map` only) |
| **Requires** | Node >=22, ESM-only, TypeScript >=5.x |
| **Introduced** | v1.0.0 |

## Highlights

- Zero runtime dependencies (a types-only dependency on `@nextrush/types`, erased at build)
- ESM-only, tree-shakable, side-effect-free (`sideEffects: false`)
- Fully typed, strict TypeScript, zero `any`
- Three algorithms (token bucket, sliding window, fixed window) and a pluggable `RateLimitStore` interface -- ships an in-memory store; a distributed store (Redis or similar) is a documented extension point, not a bundled implementation

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) . [When to use](#when-to-use) . [Installation](#installation) . [Quick start](#quick-start) . [Capabilities](#capabilities) . [Mental model](#mental-model) . [Common tasks](#common-tasks) . [API overview](#api-overview) . [Options](#options) . [Compatibility](#compatibility) . [Troubleshooting](#troubleshooting) . [FAQ](#faq) . [Package relationships](#package-relationships) . [Architecture](#architecture) . [Resources](#resources)

</details>

---

## The problem

A public endpoint with no request cap is one slow client, one misbehaving script, or one deliberate abuser away from starving every other client of capacity. Hand-rolling a counter fails in ways that are not obvious until traffic reveals them: a naive fixed-window counter lets a client send double its limit across a single window boundary (100 requests at `0:59`, 100 more at `1:00`), and a counter keyed only on `req.socket.remoteAddress` is trivially spoofable or, worse, uselessly shared across every client behind the same corporate NAT or reverse proxy if `X-Forwarded-For` is trusted unconditionally.

```ts
// TODAY, without this package -- looks correct, has a boundary-burst gap:
const counts = new Map<string, number>();
app.use((ctx, next) => {
  const count = (counts.get(ctx.ip) ?? 0) + 1;
  counts.set(ctx.ip, count);
  if (count > 100) { ctx.status = 429; return ctx.json({ error: 'too many requests' }); }
  return next();
  // counts never expires or resets on a real window boundary --
  // and there's no defense against X-Forwarded-For spoofing.
});
```

## When to use

**Use `@nextrush/rate-limit` if:**

- You need to cap request rate per IP, API key, or any other request-derived identity
- You want a choice between burst-tolerant (token bucket), boundary-safe (sliding window), or minimal-overhead (fixed window) limiting without implementing the algorithm yourself
- You need different limits for different user tiers (anonymous vs. authenticated vs. premium) from one middleware

**Reach for something else if:**

- You need limiting shared across multiple server instances out of the box -- this package's only bundled store is in-memory (single-process); a distributed backend requires implementing the `RateLimitStore` interface yourself (see [Options](#options))
- You need request-body-aware quota accounting (e.g. bytes transferred, not request count) -- this package counts requests, not payload size
- You need edge/CDN-level rate limiting before requests reach your server at all -- that is infrastructure, not application middleware

---

## Installation

```bash
pnpm add @nextrush/rate-limit
# npm i @nextrush/rate-limit . yarn add @nextrush/rate-limit . bun add @nextrush/rate-limit
```

> [!NOTE]
> `@nextrush/rate-limit` is not re-exported by the `nextrush` meta package -- install and import
> it directly, as shown above.

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { rateLimit } from '@nextrush/rate-limit';

const app = createApp();

// Zero-config: 100 requests per minute per IP, token-bucket algorithm.
app.use(rateLimit());

app.get('/api/data', (ctx) => {
  ctx.json({ message: 'Hello from API' });
});

listen(app, 8080);
```

`rateLimit()` with no options limits each client IP to 100 requests per minute using the token-bucket algorithm, and sets both the IETF-draft `RateLimit-*` and legacy `X-RateLimit-*` response headers by default.

## Capabilities

**Algorithms**
- **Token bucket** (default) -- allows short controlled bursts up to `burstLimit` (default equals `max`) while sustaining the configured average rate; refills continuously rather than resetting all at once
- **Sliding window** -- weights the previous window's count by how far into the current window the request falls, avoiding the boundary-burst gap a fixed window allows
- **Fixed window** -- simplest and lowest-overhead; explicitly documented (in the algorithm's own source comments) to allow up to 2x the limit across a window boundary -- choose sliding window if that matters for your use case

**Client identification**
- Default key generator uses the client IP, with optional `trustProxy` support for `CF-Connecting-IP`, `X-Real-IP`, `X-Forwarded-For`, `X-Client-IP`, `True-Client-IP`, `X-Cluster-Client-IP`, `Forwarded-For`, and RFC 7239 `Forwarded` (checked in that order -- the full list is `PROXY_HEADERS` in `constants.ts`)
- IPv4 and IPv6 normalization, including IPv4-mapped IPv6 addresses and zone-ID stripping
- Fully custom `keyGenerator` support (e.g. API key instead of IP)

**Access lists**
- `whitelist` / `blacklist` support exact IPs and CIDR notation (`192.168.0.0/16`), precompiled once at middleware construction for O(1)-per-entry matching per request
- Blacklisted clients get a reduced limit (`blacklistMultiplier`, default `0.5`) rather than an outright block

**Tiered limits**
- `tieredRateLimit()` applies a different `{ max, window, burstLimit }` per resolved tier (e.g. anonymous/authenticated/premium), each tier getting its own store/algorithm/window instance

**Developer experience**
- Zero runtime dependencies beyond `@nextrush/types`
- `RateLimitStore` is a documented interface -- the shipped `MemoryStore` is DoS-guarded (`maxEntries` cap with FIFO eviction) and self-cleaning (periodic expired-entry sweep)
- Fully typed, zero `any`; edge-safe (no `node:` imports anywhere in the package)

## Mental model

Every algorithm answers the same question through the same shape: given a key (the client identity) and the current state stored for that key, is this request allowed, and what state should be stored for next time? The middleware's job is everything around that decision -- resolving the key, checking allow/deny lists, setting response headers, and calling the configured handler on rejection. The algorithm's job is purely the accept/reject arithmetic.

```text
request --> rateLimit() --> keyGenerator(ctx) --> algorithm.consume(key, ...) --> allowed?
                                    |                        |
                                    |                        +-- store.get/set (state for this key)
                                    +-- whitelist/blacklist check (before consuming)
```

**Rule:** the algorithm only ever sees a key string and a store -- it has no knowledge of IPs, headers, or HTTP at all. Swapping `MemoryStore` for a custom distributed store changes nothing about which algorithm runs or how it decides.

> [!TIP]
> The full request-decision sequence and each algorithm's internal state machine (with diagrams)
> are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Choose an algorithm explicitly

```ts
import { rateLimit } from '@nextrush/rate-limit';

app.use(rateLimit({ algorithm: 'sliding-window', max: 100, window: '1m' }));
```

### Allow controlled bursts above the average rate

```ts
app.use(rateLimit({
  algorithm: 'token-bucket',
  max: 100,        // sustained average: 100/min
  window: '1m',
  burstLimit: 20,  // but allow an instant burst of up to 20
}));
```

### Rate-limit by API key instead of IP

```ts
app.use(rateLimit({
  keyGenerator: (ctx) => ctx.get('X-API-Key') ?? ctx.ip,
  max: 1000,
  window: '15m',
}));
```

### Different limits per user tier

```ts
import { tieredRateLimit } from '@nextrush/rate-limit';

app.use(tieredRateLimit({
  tiers: {
    anonymous: { max: 60, window: '1m' },
    authenticated: { max: 1000, window: '1m' },
    premium: { max: 10000, window: '1m', burstLimit: 12000 },
  },
  tierResolver: (ctx) => ctx.state.user?.tier ?? 'anonymous',
}));
```

### Trust a reverse proxy's forwarded-IP header

```ts
// Only enable behind a trusted proxy -- untrusted clients can spoof these headers otherwise.
app.use(rateLimit({ trustProxy: true }));
```

### Allowlist internal networks with CIDR notation

```ts
app.use(rateLimit({
  whitelist: ['192.168.0.0/16', '10.0.0.0/8', '127.0.0.1'],
}));
```

## API overview

The sealed public surface (ADR-0005).

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `rateLimit` | `(options?: RateLimitOptions) => RateLimitMiddleware` | 1.0.0 | Stable | The core middleware factory. Also the default export. |
| `tieredRateLimit` | `(options: TieredRateLimitOptions) => RateLimitMiddleware` | 1.0.0 | Stable | Per-tier limits with a tier-resolver function. |
| `createMemoryStore` / `MemoryStore` | `(options?) => MemoryStore` / `class` | 1.0.0 | Stable | The built-in, single-process `RateLimitStore` implementation. |
| `getAlgorithm` / `algorithms` / `tokenBucket` / `slidingWindow` / `fixedWindow` | `functions` / `object` / `Algorithm` instances | 1.0.0 | Stable | Direct access to the algorithm implementations, for advanced use. |
| `extractClientIp` / `normalizeIp` / `parseCidr` / `isIpInList` / `isValidIpv4` / `isValidIpv6` / `defaultKeyGenerator` | `functions` | 1.0.0 | Stable | IP extraction/normalization/CIDR utilities used internally and exposed for custom key generators. |
| `setRateLimitHeaders` | `(ctx, info, options) => void` | 1.0.0 | Stable | The header-writing function used internally, exposed for custom handlers. |
| `parseWindow` / `formatDuration` | `functions` | 1.0.0 | Stable | Window-string parsing and human-readable formatting. |
| `validateOptions` / `validateTieredOptions` / `isValidIpFormat` / `RateLimitValidationError` / `SAFE_DEFAULTS` | `functions` / `class` / `const` | 1.0.0 | Stable | Validation utilities and the thrown error type. |
| `DEFAULT_ALGORITHM` / `DEFAULT_MAX` / `DEFAULT_WINDOW` / `DEFAULT_WINDOW_MS` / `DEFAULT_STATUS_CODE` / `DEFAULT_MESSAGE` / `DEFAULT_BLACKLIST_MULTIPLIER` / `DEFAULT_CLEANUP_INTERVAL` / `DEFAULT_MAX_ENTRIES` / `INFO_CACHE_MAX` / `DEFAULT_KEY_PREFIX` / `PROXY_HEADERS` / `STANDARD_HEADERS` / `LEGACY_HEADERS` / `RETRY_AFTER_HEADER` / `TIME_UNITS` / `WINDOW_PATTERN` / `CIDR_*` / `IPV4_*` / `IPV6_PATTERN` | `const` | 1.0.0 | Stable | Constants for custom implementations. |
| `type RateLimitOptions` / `TieredRateLimitOptions` / `RateLimitStore` / `RateLimitInfo` / `RateLimitMiddleware` / `Algorithm` / `RateLimitAlgorithm` / `StoreEntry` / `KeyGenerator` / `SkipFunction` / `RateLimitHandler` / `OnRateLimited` / `TierConfig` / `TierResolver` | -- | 1.0.0 | Stable | Public option and data contracts. |
| default export | `rateLimit` | 1.0.0 | Stable | Same function as the named `rateLimit` export. |

## Options

Every default below is read directly from `src/index.ts`'s `DEFAULT_OPTIONS` and `src/constants.ts`.

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------ | ----------- |
| `algorithm` | `'token-bucket' \| 'sliding-window' \| 'fixed-window'` | No | `'token-bucket'` | No | See [Capabilities](#capabilities) for the trade-offs of each. |
| `max` | `number` | No | `100` | Yes | Must be a positive integer, or `rateLimit()` throws at construction. |
| `window` | `string \| number` | No | `'1m'` (60000ms) | No | Accepts `'1s'`, `'30s'`, `'1m'`, `'5m'`, `'15m'`, `'1h'`, `'1d'`, or a raw millisecond number. |
| `burstLimit` | `number` | No | equals `max` (no extra burst) | No | Token-bucket only; ignored by the other two algorithms. |
| `keyGenerator` | `(ctx: Context) => string \| Promise<string>` | No | client IP (with `trustProxy` support) prefixed by `rl:` | Yes | The identity a limit is tracked against. |
| `skip` | `(ctx: Context) => boolean \| Promise<boolean>` | No | `undefined` (nothing skipped) | No | Runs before any IP/key resolution. |
| `store` | `RateLimitStore` | No | a per-middleware `MemoryStore` instance | Yes | Single-process only unless you supply a distributed implementation. |
| `handler` | `(ctx, info) => void \| Promise<void>` | No | sends `429` with `{ error: message, retryAfter }` | No | Called only when a request is rejected. |
| `onRateLimited` | `(ctx, info) => void \| Promise<void>` | No | `undefined` | No | Fires before `handler`, for logging/metrics -- does not affect the response. |
| `trustProxy` | `boolean` | No | `false` | Yes | When `true`, every header in `PROXY_HEADERS` is trusted -- only enable behind a trusted reverse proxy. |
| `standardHeaders` | `boolean` | No | `true` | No | IETF-draft `RateLimit-*` headers. `RateLimit-Reset` carries **seconds until reset** (a delta), per the IETF draft. |
| `legacyHeaders` | `boolean` | No | `true` | No | `X-RateLimit-*` headers. `X-RateLimit-Reset` carries a **Unix timestamp in seconds** (an absolute time) -- not the same value or unit as `RateLimit-Reset`. |
| `includeRetryAfter` | `boolean` | No | `true` | No | Adds `Retry-After` on a rejected (429) response only. |
| `message` | `string` | No | `'Too many requests, please try again later.'` | No | The default handler's error body text. |
| `statusCode` | `number` | No | `429` | No | Must be between 100 and 599, or `rateLimit()` throws at construction. |
| `whitelist` | `string[]` | No | `undefined` | Yes | Exact IPs or CIDR notation; skips rate limiting entirely. |
| `blacklist` | `string[]` | No | `undefined` | Yes | Exact IPs or CIDR notation; gets `blacklistMultiplier` applied to `max`, not blocked outright. |
| `blacklistMultiplier` | `number` | No | `0.5` | Yes | Must be between 0 and 1, or `rateLimit()` throws at construction. |
| `draftIetfHeaders` | `boolean` | No | `false` | No | Adds a `RateLimit-Policy` header describing the limit/window as one value. |
| `cleanupInterval` | `number` | No | `60000` (1 minute) | No | Only affects the default `MemoryStore`; ignored if `store` is supplied. |
| `disableCleanup` | `boolean` | No | `false` | No | Disables the `MemoryStore`'s periodic sweep; entries still expire lazily on `get()`. |

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
| Bun / Deno / Edge | Yes / Yes / Yes | Zero `node:` imports; the built-in `MemoryStore` uses only `Map` and `setInterval` |

**Integration**
- **Peer dependencies:** none -- depends only on `@nextrush/types` (types, erased at build).
- **Works with:** any NextRush middleware chain; register early so rejected requests never reach downstream handlers or body parsing.
- **Incompatible with:** none directly, but the built-in `MemoryStore` does not share state across server instances -- supply a custom `RateLimitStore` for multi-instance deployments.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node >=22, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong>Every client behind the same corporate NAT or proxy shares one rate limit</strong></summary>

**Cause:** without `trustProxy: true`, the default key generator falls back to the connection's raw IP (`ctx.ip`), which is the proxy's address for every client behind it. **Fix:** enable `trustProxy: true` only if you actually run behind a trusted reverse proxy that sets a real forwarded-IP header, or supply a `keyGenerator` that reads a more specific identity (a session ID, an API key).

</details>

<details>
<summary><strong>"algorithm must be one of: token-bucket, sliding-window, fixed-window" thrown on startup</strong></summary>

**Cause:** `validateOptions()` checks `algorithm` against the exact three supported values at construction time. **Fix:** use one of the three literal strings -- there is no fourth built-in algorithm.

</details>

<details>
<summary><strong>Clients occasionally get double the configured limit right at a window boundary</strong></summary>

**Cause:** this is the fixed-window algorithm's documented behavior (see its own source comments) -- a client can send up to `max` requests just before a window boundary and another `max` just after. **Fix:** switch `algorithm: 'sliding-window'`, which weights the previous window's count instead of resetting it abruptly.

</details>

<details>
<summary><strong>Rate limit state resets on every deploy or restart</strong></summary>

**Cause:** the default `MemoryStore` is single-process, in-memory state -- it is lost on restart and not shared across horizontally scaled instances. **Fix:** implement the `RateLimitStore` interface (see the JSDoc example on the type) against a shared backend such as Redis, and pass it via the `store` option.

</details>

<details>
<summary><strong>`RateLimit-Reset` and `X-RateLimit-Reset` show different numbers for the same request</strong></summary>

**Cause:** the two header families do not carry the same value. `RateLimit-Reset` (the IETF-draft header) is **seconds until the window resets** (a delta from now). `X-RateLimit-Reset` (the legacy header) is an **absolute Unix timestamp in seconds** (`resetTime`). Comparing them directly, or assuming one is a formatted version of the other, produces confusing results. **Fix:** read `RateLimit-Reset` if you want a countdown, `X-RateLimit-Reset` if you want an absolute time to schedule against -- or disable whichever family you don't need via `standardHeaders: false` / `legacyHeaders: false`.

</details>

## FAQ

**Does this package ship a Redis store?**
No. `RateLimitStore` is a documented interface with a worked example in its own type comment, but the only bundled implementation is the in-memory, single-process `MemoryStore`. A distributed store is an integration you supply.

**Why is `token-bucket` the default instead of `sliding-window`?**
Token bucket tolerates short legitimate bursts (a page loading several resources at once) while still enforcing a sustained average rate -- a common API rate-limiting posture (also used by AWS and Google APIs, per the algorithm's own source comments). Choose `sliding-window` explicitly if boundary-accuracy matters more than burst tolerance for your endpoint.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Yes. The package has zero `node:` imports -- IP parsing, CIDR matching, and the built-in store use only standard JavaScript (`Map`, `setInterval`, string/array methods).

---

## Package relationships

```text
                     depends on           @nextrush/types  (Context / Middleware contracts, types only)
@nextrush/rate-limit ---------------->
                     often used with      @nextrush/csrf  (both protect state-changing endpoints)
                     usually used next    @nextrush/logger  (log rejected requests for monitoring)
```

- **Depends on:** [`@nextrush/types`](../../types) -- shared `Context`/`Middleware` contracts, types only, erased at build.
- **Often used with:** [`@nextrush/csrf`](../csrf) -- both defend the same class of state-changing public endpoints.
- **Usually used next:** [`@nextrush/logger`](../logger) -- observing rejected requests alongside the rate limiter's own `onRateLimited` hook.
- **Alternative:** an edge/CDN-level rate limiter, if you need to reject traffic before it reaches your server at all -- this package only runs after a request has already reached the application.

## Architecture

Maintaining or contributing to this package? The internal design -- the algorithm state machines,
the per-request decision sequence, the security invariants that require an RFC to change, and the
decisions and trade-offs behind them (with diagrams) -- is in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) . [Architecture](./ARCHITECTURE.md) . [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
