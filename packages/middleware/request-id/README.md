# @nextrush/request-id

> Generates and propagates a request identifier (UUID v4 by default) as an HTTP header, for tying one request's logs, traces, and downstream calls together.

[![npm version](https://img.shields.io/npm/v/@nextrush/request-id.svg)](https://www.npmjs.com/package/@nextrush/request-id)
[![downloads](https://img.shields.io/npm/dm/@nextrush/request-id.svg)](https://www.npmjs.com/package/@nextrush/request-id)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/request-id.svg)](https://bundlephobia.com/package/@nextrush/request-id)
[![types](https://img.shields.io/npm/types/@nextrush/request-id.svg)](https://www.npmjs.com/package/@nextrush/request-id)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/request-id.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Attach a unique ID to every request (`X-Request-Id` by default), store it in `ctx.state`, and echo it back on the response header |
| **Package type** | Middleware |
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install. Not re-exported from `nextrush` or `nextrush/class`. |
| **Support tier** | Public -- middleware/registrar (stable) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal -- Node, Bun, Deno, Cloudflare Workers, Vercel Edge, Netlify Edge (any runtime exposing the global `crypto.randomUUID`) |
| **Requires** | Node >=22, ESM-only, TypeScript >=5.x |
| **Introduced** | v1.0.0 |

## Highlights

- Zero runtime dependencies beyond `@nextrush/types` (types only, erased at build)
- Uses the Web-standard global `crypto.randomUUID()` -- deliberately not `node:crypto` -- so the package stays edge-safe with no adapter needed
- ESM-only, tree-shakable, side-effect-free (`sideEffects: false`)
- Fully typed, strict TypeScript, zero `any`
- Three ready-made variants -- `requestId()`, `correlationId()`, `traceId()` -- built from the same middleware with different header/state-key defaults

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) . [When to use](#when-to-use) . [Installation](#installation) . [Quick start](#quick-start) . [Capabilities](#capabilities) . [Mental model](#mental-model) . [Common tasks](#common-tasks) . [API overview](#api-overview) . [Options](#options) . [Compatibility](#compatibility) . [Troubleshooting](#troubleshooting) . [FAQ](#faq) . [Package relationships](#package-relationships) . [Architecture](#architecture) . [Resources](#resources)

</details>

---

## The problem

Correlating one request's log lines, error reports, and downstream calls requires a stable identifier that exists before any handler runs and survives everywhere the request goes. Rolling this by hand tends to skip the security details:

```ts
// TODAY, without this package -- looks fine, has real gaps:
app.use(async (ctx, next) => {
  const id = ctx.get('x-request-id') || crypto.randomUUID();
  // Trusts ANY client-supplied header value unconditionally -- a caller can
  // inject "id\r\nX-Evil: 1" and split the response into two headers, or
  // send a 10KB string and bloat every downstream log line with it. No
  // length check, no character check, no fallback if crypto is unavailable.
  ctx.state.requestId = id;
  ctx.set('x-request-id', id);
  await next();
});
```

## When to use

**Use `@nextrush/request-id` if:**

- You want a unique ID generated per request and echoed back on a response header, with zero configuration
- You want to accept an upstream-supplied ID (from a gateway or load balancer) but only after it's validated against header-injection and length-overflow
- You want separate, independently-configured correlation-ID or trace-ID headers for distributed tracing, without writing three near-identical middleware

**Reach for something else if:**

- You want the ID request-scoped inside a structured logger with redaction and formatting built in -- see [`@nextrush/logger`](../logger); it reads/writes the same `x-request-id` header by default and can be used together with this package or on its own
- You want response-time headers, not an identifier -- see [`@nextrush/timer`](../timer)

---

## Installation

```bash
pnpm add @nextrush/request-id
# npm i @nextrush/request-id . yarn add @nextrush/request-id . bun add @nextrush/request-id
```

> [!NOTE]
> `@nextrush/request-id` is not re-exported by the `nextrush` meta package -- install and import
> it directly, as shown above.

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { requestId } from '@nextrush/request-id';

const app = createApp();

app.use(requestId());

app.get('/users', (ctx) => {
  ctx.json({ requestId: ctx.state.requestId });
});

listen(app, 8080);
```

Every request now gets a `crypto.randomUUID()`-generated ID stored at `ctx.state.requestId` and echoed back on the `X-Request-Id` response header -- no incoming header is trusted unless you explicitly opt in.

## Capabilities

**ID generation**
- Generates a UUID v4 via the global `crypto.randomUUID()` by default -- not `node:crypto`, so the same code runs unmodified on Node, Bun, Deno, and edge runtimes
- Throws a clear, actionable error at middleware-creation time (not a bare `ReferenceError` mid-request) if `crypto.randomUUID` is unavailable and no custom `generator` was supplied
- Accepts a custom `generator` function for non-UUID ID schemes (e.g. ULIDs, sequential IDs)

**Incoming ID handling (secure by default)**
- `trustIncoming` defaults to `false` -- an incoming `X-Request-Id` header is ignored and a fresh ID is always generated unless you opt in
- When `trustIncoming: true`, an incoming ID is only accepted if it passes both a length check (1-128 characters by default) and a safe-character check (`^[a-zA-Z0-9_-]+$`, rejecting spaces, control characters, and CRLF sequences) -- an invalid incoming ID silently falls through to generating a new one, it is never rejected with an error response
- A custom `generator`'s output is validated with the same safe-character/length check before use; if it fails, the middleware falls back to `defaultGenerator()` rather than propagating an unsafe value

**Header and state key safety**
- The configured header name is validated once, at middleware-creation time, against the HTTP token grammar (`^[!#$%&'*+.^_\`|~\w-]+$`) -- an invalid header name throws immediately rather than producing a malformed response later
- The configured `stateKey` is checked against `__proto__`, `prototype`, and `constructor` at creation time, throwing if one is used, to prevent prototype-pollution via a caller-supplied state key

**Three ready-made variants**
- `requestId()` -- `X-Request-Id` header, `ctx.state.requestId`
- `correlationId()` -- `X-Correlation-Id` header, `ctx.state.correlationId`
- `traceId()` -- `X-Trace-Id` header, `ctx.state.traceId`
- All three are the same underlying `requestId()` middleware called with a fixed `header`/`stateKey` pair -- every other option (`trustIncoming`, `generator`, `validator`, `maxLength`, `exposeHeader`) still applies to `correlationId()`/`traceId()`

## Mental model

`requestId()` resolves one ID per request -- either an incoming ID that passed validation, or a freshly generated one -- stores it in `ctx.state`, and echoes it on the response header, all before calling `ctx.next()`.

```text
request --> requestId() --> trustIncoming && valid header? --> use incoming ID
                                        |                            |
                                        no / invalid                 |
                                        v                            v
                                  generate new ID <------------------+
                                        |
                                        v
                      ctx.state[stateKey] = id ; ctx.set(header, id)
                                        |
                                        v
                                  await ctx.next()
```

**Rule:** an incoming ID is only ever used if `trustIncoming` is explicitly `true` AND it passes both the length and safe-character checks -- there is no code path where an unvalidated client-supplied string reaches the response header or `ctx.state`.

> [!TIP]
> The full generate-attach-propagate sequence, and exactly where each validation check runs, is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Generate a fresh ID on every request (default)

```ts
import { requestId } from '@nextrush/request-id';

app.use(requestId());
```

### Trust an ID from an upstream gateway or load balancer

```ts
app.use(requestId({ trustIncoming: true }));
// A well-formed incoming X-Request-Id is passed through unchanged.
// A missing, oversized, or unsafe incoming value is replaced with a fresh ID.
```

### Add correlation and trace IDs alongside the request ID

```ts
import { correlationId, requestId, traceId } from '@nextrush/request-id';

app.use(requestId());
app.use(correlationId({ trustIncoming: true }));
app.use(traceId());
```

### Use a custom ID format

```ts
app.use(requestId({
  generator: () => `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
}));
// The generated string is still validated against the safe-character/length
// check before use; a generator producing unsafe output falls back to a UUID.
```

### Read the ID in a handler and forward it downstream

```ts
app.use(requestId());

app.get('/api/data', async (ctx) => {
  const id = ctx.state.requestId;
  await fetch('https://downstream.example.com/data', {
    headers: { 'X-Request-Id': String(id) },
  });
  ctx.json({ requestId: id });
});
```

## API overview

The sealed public surface (ADR-0005).

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `requestId` | `(options?: RequestIdOptions) => Middleware` | 1.0.0 | Stable | Core middleware -- `X-Request-Id` header, `ctx.state.requestId`. |
| `correlationId` | `(options?: CorrelationIdOptions) => Middleware` | 1.0.0 | Stable | `requestId()` fixed to `X-Correlation-Id` / `ctx.state.correlationId`. |
| `traceId` | `(options?: TraceIdOptions) => Middleware` | 1.0.0 | Stable | `requestId()` fixed to `X-Trace-Id` / `ctx.state.traceId`. |
| `defaultGenerator` | `() => string` | 1.0.0 | Stable | `crypto.randomUUID()` -- the default ID generator. |
| `isValidUuid` | `(id: string) => boolean` | 1.0.0 | Stable | Tests a string against the UUID v4 pattern. |
| `isSafeId` | `(id: string) => boolean` | 1.0.0 | Stable | Tests a string against the safe-character pattern (`^[a-zA-Z0-9_-]+$`). |
| `isValidLength` | `(id: string, maxLength?: number) => boolean` | 1.0.0 | Stable | Tests a string's length against `[1, maxLength]` (default max `128`). |
| `validateId` | `(id: string, maxLength?: number) => boolean` | 1.0.0 | Stable | `isValidLength(...) && isSafeId(...)` combined. |
| `createValidator` | `(maxLength?: number) => IdValidator` | 1.0.0 | Stable | Builds a validator bound to a custom max length. |
| `defaultValidator` | `IdValidator` | 1.0.0 | Stable | `isValidUuid` -- the default `validator` for `trustIncoming`. |
| `permissiveValidator` | `IdValidator` | 1.0.0 | Stable | `isSafeId` -- accepts any safe ID, not only UUIDs. |
| `DEFAULT_HEADER` | `'X-Request-Id'` | 1.0.0 | Stable | Default header for `requestId()`. |
| `CORRELATION_HEADER` | `'X-Correlation-Id'` | 1.0.0 | Stable | Header used by `correlationId()`. |
| `TRACE_HEADER` | `'X-Trace-Id'` | 1.0.0 | Stable | Header used by `traceId()`. |
| `DEFAULT_STATE_KEY` | `'requestId'` | 1.0.0 | Stable | Default `ctx.state` key for `requestId()`. |
| `CORRELATION_STATE_KEY` | `'correlationId'` | 1.0.0 | Stable | State key used by `correlationId()`. |
| `TRACE_STATE_KEY` | `'traceId'` | 1.0.0 | Stable | State key used by `traceId()`. |
| `DEFAULT_MAX_LENGTH` | `128` | 1.0.0 | Stable | Default `maxLength` for incoming-ID validation. |
| `type RequestIdOptions` | -- | 1.0.0 | Stable | Options for `requestId()`. |
| `type CorrelationIdOptions` | `Omit<RequestIdOptions, 'header' \| 'stateKey'>` | 1.0.0 | Stable | Options for `correlationId()`. |
| `type TraceIdOptions` | `Omit<RequestIdOptions, 'header' \| 'stateKey'>` | 1.0.0 | Stable | Options for `traceId()`. |
| `type IdGenerator` | `() => string` | 1.0.0 | Stable | Custom generator function shape. |
| `type IdValidator` | `(id: string) => boolean` | 1.0.0 | Stable | Custom validator function shape. |
| `type RequestIdContext` | -- | 1.0.0 | Stable | Minimal context shape this package depends on. |
| `type Middleware` | -- | 1.0.0 | Deprecated | Local middleware type; use `Middleware` from `@nextrush/types` instead. |

## Options

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------ | ----------- |
| `header` | `string` | No | `'X-Request-Id'` (`'X-Correlation-Id'` / `'X-Trace-Id'` fixed for the two variants) | Yes | The request/response header name. Validated at creation time against the HTTP token grammar; an invalid name throws immediately. |
| `generator` | `IdGenerator` | No | `defaultGenerator` (`crypto.randomUUID()`) | No | Custom ID-generation function. Its output is still validated before use; unsafe output falls back to `defaultGenerator()`. |
| `trustIncoming` | `boolean` | No | `false` | Yes | Whether to accept and use a client-supplied incoming ID (after validation) instead of always generating a fresh one. |
| `validator` | `IdValidator` | No | `defaultValidator` (`isValidUuid`) | Yes | Additional validator applied to an incoming ID only when `trustIncoming` is `true`; runs after the built-in length/safe-character check. |
| `maxLength` | `number` | No | `128` | Yes | Maximum accepted length for an incoming ID. Prevents header-overflow from an oversized client-supplied value. |
| `stateKey` | `string` | No | `'requestId'` (`'correlationId'` / `'traceId'` fixed for the two variants) | Yes | The `ctx.state` key the ID is stored under. Checked at creation time against `__proto__`/`prototype`/`constructor`; an unsafe key throws immediately. |
| `exposeHeader` | `boolean` | No | `true` | No | Whether to write the ID back onto the response header. When `false`, the ID is still stored in `ctx.state` but never appears on the response. |

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
| Node.js >=22 | Yes | Uses the global `crypto.randomUUID()`, available on Node >=19 |
| Bun / Deno | Yes / Yes | Same global `crypto.randomUUID()` API |
| Cloudflare Workers / Vercel Edge / Netlify Edge | Yes | The global is available on these runtimes; no adapter or Node-specific module is used |

**Integration**
- **Peer dependencies:** none beyond `@nextrush/types` (types only, erased at build).
- **Depends on:** `@nextrush/types` (the `Middleware` type re-exported for compatibility).
- **Works with:** [`@nextrush/logger`](../logger), which reads/writes the same `x-request-id` header name by default -- mount this package first if you want its generated ID to be the one the logger picks up and echoes.
- **Incompatible with:** none directly -- if both this package and `@nextrush/logger`'s built-in correlation-ID handling are mounted with the same header name, whichever runs first determines the ID that survives; both packages read before they write, so neither silently overwrites an ID the other already set for that request.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node >=22, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong>An incoming <code>X-Request-Id</code> header is being ignored and replaced</strong></summary>

**Cause:** `trustIncoming` defaults to `false` -- every request gets a freshly generated ID regardless of what the client sent, unless you opt in. **Fix:** pass `trustIncoming: true` to accept a validated incoming ID.

```ts
app.use(requestId({ trustIncoming: true }));
```

</details>

<details>
<summary><strong>`trustIncoming: true` is set, but a specific incoming ID still gets replaced</strong></summary>

**Cause:** the incoming value failed the built-in length check (must be 1-128 characters), the safe-character check (`^[a-zA-Z0-9_-]+$` -- no spaces, no CRLF, no control characters), or the configured `validator` (UUID v4 format by default). Failing any of these silently falls through to generating a new ID -- it is not an error response. **Fix:** if the upstream system sends non-UUID IDs (e.g. `req_abc123`), pass `validator: permissiveValidator` to accept any safe-character ID instead of requiring UUID v4 format.

```ts
import { permissiveValidator, requestId } from '@nextrush/request-id';

app.use(requestId({ trustIncoming: true, validator: permissiveValidator }));
```

</details>

<details>
<summary><strong>Creating the middleware throws <code>crypto.randomUUID is not available in this runtime</code></strong></summary>

**Cause:** the runtime's global `crypto.randomUUID` is missing (an old Node version, or a runtime that doesn't expose the Web Crypto global), and no custom `generator` was supplied. **Fix:** upgrade to a runtime with the global available, or supply a custom `generator`.

```ts
app.use(requestId({ generator: () => myUlidGenerator() }));
```

</details>

<details>
<summary><strong>Creating the middleware throws <code>Invalid header name</code> or <code>Unsafe stateKey</code></strong></summary>

**Cause:** a custom `header` value doesn't match the HTTP token grammar, or a custom `stateKey` is one of `__proto__`, `prototype`, or `constructor` (rejected to prevent prototype pollution). Both checks run once, at middleware-creation time. **Fix:** use a valid HTTP header token for `header`, and any state key other than the three reserved names.

</details>

## FAQ

**Does the generated ID propagate to downstream services automatically?**
No -- this package stores the ID in `ctx.state` and echoes it on the response header; forwarding it to a downstream `fetch()` call in your own handler code, as shown in [Common tasks](#common-tasks), is the caller's responsibility. The package does not intercept outgoing requests.

**Is the ID format always a UUID?**
By default, yes -- `defaultGenerator` calls `crypto.randomUUID()`, which produces an RFC 4122 version 4 UUID. Pass a custom `generator` for a different format; its output is still validated for length and safe characters before use.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Yes, identically -- the package uses only the global `crypto.randomUUID()`, available on all of those runtimes, and has no Node-specific import.

---

## Package relationships

```text
                       depends on            @nextrush/types  (Middleware type, re-exported)
@nextrush/request-id ----------------->
                       often used with       @nextrush/logger
```

- **Depends on:** [`@nextrush/types`](../../types) -- the `Middleware` type, re-exported for compatibility.
- **Often used with:** [`@nextrush/logger`](../logger) -- reads/writes the same `x-request-id` header by default, for correlating log lines to the ID this package generates.
- **Usually used next:** [`@nextrush/timer`](../timer) -- response-time headers, commonly mounted alongside a request ID for the same observability pipeline.
- **Alternative:** none within NextRush for standalone ID generation/propagation -- `@nextrush/logger`'s built-in correlation-ID handling covers the same header if you only need it inside a structured logger, without installing this package separately.

## Architecture

Maintaining or contributing to this package? The internal design -- the generate-attach-propagate
sequence, the validation checks and where each one runs, and the decisions and trade-offs behind
them (with diagrams) -- is in **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**.

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) . [Architecture](./ARCHITECTURE.md) . [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
