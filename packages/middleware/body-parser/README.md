# @nextrush/body-parser

> Secure, cross-runtime JSON/URL-encoded/text/raw request body parsing for NextRush -- enforces size limits before and during the read, and blocks prototype pollution in form data.

[![npm version](https://img.shields.io/npm/v/@nextrush/body-parser.svg)](https://www.npmjs.com/package/@nextrush/body-parser)
[![downloads](https://img.shields.io/npm/dm/@nextrush/body-parser.svg)](https://www.npmjs.com/package/@nextrush/body-parser)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/body-parser.svg)](https://bundlephobia.com/package/@nextrush/body-parser)
[![types](https://img.shields.io/npm/types/@nextrush/body-parser.svg)](https://www.npmjs.com/package/@nextrush/body-parser)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/body-parser.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Parse JSON, URL-encoded, text, and raw request bodies with enforced size limits |
| **Package type** | Middleware |
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install. It appears only as a `workspace:*` dependency and test import inside the `nextrush` meta package itself; it is not re-exported from `nextrush` or `nextrush/class`. |
| **Support tier** | Public -- middleware/registrar (stable) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal -- Node, Bun, Deno, Edge (zero `node:` imports) |
| **Requires** | Node >=22, ESM-only, TypeScript >=5.x |
| **Introduced** | v3.0.0 |

## Highlights

- Zero runtime dependencies (a types-only dependency on `@nextrush/types`, erased at build)
- ESM-only, tree-shakable, side-effect-free (`sideEffects: false`)
- Fully typed, strict TypeScript, zero `any`
- Security-first defaults: size limits enforced incrementally during the read, prototype-pollution keys (`__proto__`, `constructor`, `prototype`) blocked in URL-encoded data, unrecognized charsets fall back to UTF-8 instead of crashing

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) . [When to use](#when-to-use) . [Installation](#installation) . [Quick start](#quick-start) . [Capabilities](#capabilities) . [Mental model](#mental-model) . [Common tasks](#common-tasks) . [API overview](#api-overview) . [Options](#options) . [Performance](#performance) . [Compatibility](#compatibility) . [Troubleshooting](#troubleshooting) . [FAQ](#faq) . [Package relationships](#package-relationships) . [Architecture](#architecture) . [Resources](#resources)

</details>

---

## The problem

Reading a request body sounds trivial until the request is hostile. A body parser written by hand tends to get exactly one thing right -- decoding the happy-path payload -- and to miss the failure modes that only show up under attack or at scale:

```ts
// TODAY, without a security-aware body parser -- quick to write, dangerous to ship:
let raw = '';
req.on('data', (chunk) => {
  raw += chunk; // no size check -- a multi-GB body is buffered in full before anyone notices
});
req.on('end', () => {
  const body = JSON.parse(raw); // a crafted `__proto__` key or 10,000-level-deep array
  // pollutes Object.prototype or blows the stack, and a malformed payload throws an
  // unhandled, unstructured SyntaxError with no HTTP status attached
});
```

Beyond the obvious missing size check, the by-hand approach usually also forgets to remove its `data`/`end`/`error` listeners when the client disconnects mid-upload -- a slow trickle of aborted requests then leaks listeners until the process runs out of memory.

## When to use

**Use `@nextrush/body-parser` if:**

- You need to parse `application/json`, `application/x-www-form-urlencoded`, `text/*`, or raw binary request bodies with enforced size limits
- You want prototype-pollution protection on form data without writing your own key blocklist
- You need raw-body access for webhook signature verification (`ctx.rawBody`) alongside parsed JSON

**Reach for something else if:**

- You're handling file uploads (`multipart/form-data`) -- this package throws `UNSUPPORTED_CONTENT_TYPE` for multipart and points you to a dedicated multipart parser
- You need to validate the *shape* of the parsed body (required fields, types) -- see [`@nextrush/validation`](../validation) for schema validation after parsing
- You're streaming a large file straight through without buffering it in memory -- read the body stream directly instead of using a parser that materializes the full buffer

---

## Installation

```bash
pnpm add @nextrush/body-parser
# npm i @nextrush/body-parser . yarn add @nextrush/body-parser . bun add @nextrush/body-parser
```

> [!NOTE]
> `@nextrush/body-parser` is not re-exported by the `nextrush` meta package -- install and import
> it directly, as shown above.

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { json } from '@nextrush/body-parser';

const app = createApp();

app.use(json({ limit: '1mb' }));

app.post('/api/users', async (ctx) => {
  const { name, email } = ctx.body as { name: string; email: string };
  ctx.status = 201;
  ctx.json({ id: Date.now(), name, email });
});

listen(app, 8080);
```

`json()` skips bodyless methods (GET/HEAD/OPTIONS/TRACE), leaves `ctx.body` untouched if a prior middleware already parsed it, and rejects anything over `1mb` with a `413` before your handler ever runs.

## Capabilities

**Parsing**
- `json()` -- `application/json`, with `strict` mode (object/array only), a configurable `reviver`, and a nesting-depth guard (`maxDepth`, default `64`)
- `urlencoded()` -- `application/x-www-form-urlencoded`, with `extended` bracket-notation parsing (`user[name]=x` -> `{ user: { name: 'x' } }`), a parameter-count limit, and a nesting-depth limit
- `text()` -- `text/*`, decoding via the charset in `Content-Type` (falls back to UTF-8 for anything unrecognized)
- `raw()` -- any content type, returns the untouched bytes
- `bodyParser()` -- routes to the right parser above based on `Content-Type`; JSON and URL-encoded are on by default, text and raw are opt-in

**Security**
- Every parser's `limit` is enforced **incrementally during the read** (RFC 017) via the adapter's `BodySource.buffer(limit)`, not only after the full body is buffered
- URL-encoded keys are checked against a `__proto__` / `constructor` / `prototype` blocklist at every nesting level
- Stream listeners (`data`/`end`/`error`/`close`/`aborted`) are always cleaned up, including on client abort

**Performance**
- Content-Length is checked synchronously before a single body byte is read
- Small JSON bodies skip the recursive depth-check traversal entirely when they're too short to possibly exceed `maxDepth`
- The combined `bodyParser()` detects content-type once and passes a `prechecked` flag to the delegated parser, instead of detecting twice

**Developer experience**
- Fully typed, zero `any`; edge-safe (no `node:` imports anywhere in the package)
- Typed `BodyParserError` with an HTTP `status` and a machine-readable `code` for every failure mode

## Mental model

Every parser is a middleware that either produces `ctx.body` or calls `next()` untouched -- it never does both, and it never partially parses.

```text
request --> json()/urlencoded()/text()/raw() --> ctx.body
                    |
                    +-- over limit, malformed, or wrong content-type --> BodyParserError / next()
```

**Rule:** a parser that doesn't match the request's method, existing `ctx.body`, or `Content-Type` calls `next()` and leaves `ctx.body` exactly as it found it -- stacking multiple parsers is always safe.

> [!TIP]
> The full read-parse-populate sequence and the size-limit state machine (with diagrams) are in
> [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Parse JSON with a size limit

```ts
import { json } from '@nextrush/body-parser';

app.use(json({ limit: '1mb', strict: true }));
```

### Parse form submissions with nested fields

```ts
import { urlencoded } from '@nextrush/body-parser';

app.use(urlencoded({ extended: true, depth: 5 }));

app.post('/contact', async (ctx) => {
  // Form data: user[name]=Alice&user[email]=alice@example.com
  const { user } = ctx.body as { user: { name: string; email: string } };
});
```

### Verify a webhook signature against the raw body

```ts
import { json } from '@nextrush/body-parser';
import { createHmac } from 'node:crypto';

app.use(json({ rawBody: true }));

app.post('/webhook', async (ctx) => {
  const signature = ctx.get('x-signature');
  const expected = createHmac('sha256', process.env.WEBHOOK_SECRET!)
    .update(ctx.rawBody as Buffer)
    .digest('hex');

  if (signature !== expected) {
    ctx.status = 401;
    ctx.json({ error: 'Invalid signature' });
    return;
  }
});
```

### Accept multiple content types with one middleware

```ts
import { bodyParser } from '@nextrush/body-parser';

app.use(
  bodyParser({
    json: { limit: '10mb', strict: true },
    urlencoded: { extended: true, depth: 5 },
    text: { limit: '5mb' }, // opt-in -- omit the key to leave text parsing disabled
  })
);
```

### Handle a `BodyParserError` with the right status code

```ts
import { BodyParserError } from '@nextrush/body-parser';

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof BodyParserError) {
      ctx.status = error.status;
      ctx.json({ error: error.message, code: error.code });
      return;
    }
    throw error;
  }
});
```

## API overview

The sealed public surface (ADR-0005).

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `json` | `(options?: JsonOptions) => Middleware` | 3.0.0 | Stable | Parses `application/json` bodies. |
| `urlencoded` | `(options?: UrlEncodedOptions) => Middleware` | 3.0.0 | Stable | Parses `application/x-www-form-urlencoded` bodies. |
| `text` | `(options?: TextOptions) => Middleware` | 3.0.0 | Stable | Parses `text/*` bodies into a string. |
| `raw` | `(options?: RawOptions) => Middleware` | 3.0.0 | Stable | Returns the untouched body bytes. |
| `bodyParser` | `(options?: BodyParserOptions) => Middleware` | 3.0.0 | Stable | Routes to json/urlencoded/text/raw by `Content-Type`. |
| `readBody` | `(ctx, limit: number) => Promise<Uint8Array>` | 3.0.0 | Stable | The shared body-reading primitive each parser calls. |
| `BodyParserError` | `class` | 3.0.0 | Stable | Thrown on any parse/limit/security failure; carries `status` and `code`. |
| `Errors` | `const` | 3.0.0 | Stable | Factory functions that construct each `BodyParserError` variant. |
| `bufferToString` / `concatBuffers` | `functions` | 3.0.0 | Stable | Byte-to-string decoding and chunk concatenation helpers. |
| `getContentType` / `getContentLength` / `isJsonContentType` / `matchContentType` / `extractCharset` / `normalizeCharset` | `functions` | 3.0.0 | Stable | Content-Type / charset parsing utilities used internally and exposed for custom middleware. |
| `parseLimit` / `formatBytes` | `functions` | 3.0.0 | Stable | Size-limit string parsing (`'1mb'` -> bytes) and formatting. |
| `parseUrlEncoded` / `safeDecodeURIComponent` / `setNestedValue` | `functions` | 3.0.0 | Stable | Lower-level URL-encoded parsing primitives, exported for advanced use. |
| `BODYLESS_METHODS` / `DEFAULT_CONTENT_TYPES` / `DEFAULT_LIMITS` / `DEFAULT_PARAMETER_LIMITS` / `PATTERNS` / `SIZE_UNITS` / `SUPPORTED_CHARSETS` | `const` | 3.0.0 | Stable | Constants for custom implementations. |
| `type JsonOptions` / `UrlEncodedOptions` / `TextOptions` / `RawOptions` / `BodyParserOptions` / `BodyParserContext` / `BodyParserErrorCode` / `VerifyCallback` | -- | 3.0.0 | Stable | Public option and data contracts. |
| default export | `bodyParser` | 3.0.0 | Stable | Same function as the named `bodyParser` export. |

## Options

Every default below is read directly from each parser's destructuring defaults in `src/parsers/*.ts` and `src/constants.ts`.

**`json(options?)`**

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ----------- |
| `limit` | `string \| number` | No | `'1mb'` (1,048,576 bytes) | Yes | Maximum body size. |
| `strict` | `boolean` | No | `true` | No | Reject primitives -- only accept `{}` and `[]`. |
| `type` | `string \| string[]` | No | `['application/json']` | No | Content-Types to parse. |
| `rawBody` | `boolean` | No | `false` | No | Store the raw bytes on `ctx.rawBody`. |
| `reviver` | `JsonReviver` | No | `undefined` | No | Passed through to `JSON.parse`. |
| `maxDepth` | `number` | No | `64` | Yes | Maximum JSON nesting depth (set `Infinity` to disable). |
| `verify` | `VerifyCallback` | No | `undefined` | Yes | Called with the raw buffer before parsing; throw to reject. |

**`urlencoded(options?)`**

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ----------- |
| `limit` | `string \| number` | No | `'100kb'` (102,400 bytes) | Yes | Maximum body size. |
| `extended` | `boolean` | No | `true` | No | Enable bracket-notation nested object/array parsing. |
| `parameterLimit` | `number` | No | `1000` | Yes | Maximum number of `&`-separated parameters. |
| `depth` | `number` | No | `20` | Yes | Maximum nesting depth for extended parsing. |
| `type` | `string \| string[]` | No | `['application/x-www-form-urlencoded']` | No | Content-Types to match. |
| `rawBody` | `boolean` | No | `false` | No | Store the raw bytes on `ctx.rawBody`. |
| `verify` | `VerifyCallback` | No | `undefined` | Yes | Called with the raw buffer before parsing; throw to reject. |

**`text(options?)`**

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ----------- |
| `limit` | `string \| number` | No | `'100kb'` (102,400 bytes) | Yes | Maximum body size. |
| `defaultCharset` | `SupportedCharset` | No | `'utf-8'` | No | Charset used when `Content-Type` doesn't specify one. |
| `type` | `string \| string[]` | No | `['text/plain']` | No | Content-Types to match. |
| `rawBody` | `boolean` | No | `false` | No | Store the raw bytes on `ctx.rawBody`. |
| `verify` | `VerifyCallback` | No | `undefined` | Yes | Called with the raw buffer before parsing; throw to reject. |

**`raw(options?)`**

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ----------- |
| `limit` | `string \| number` | No | `'100kb'` (102,400 bytes) | Yes | Maximum body size. |
| `type` | `string \| string[]` | No | `['application/octet-stream']` | No | Content-Types to match. |
| `verify` | `VerifyCallback` | No | `undefined` | Yes | Called with the raw buffer before setting `ctx.body`; throw to reject. |

**`bodyParser(options?)`**

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ----------- |
| `json` | `JsonOptions \| false` | No | `{}` (enabled) | No | JSON parser options, or `false` to disable. |
| `urlencoded` | `UrlEncodedOptions \| false` | No | `{}` (enabled) | No | URL-encoded options, or `false` to disable. |
| `text` | `TextOptions \| false` | No | `undefined` (disabled) | No | Pass any object (even `{}`) to enable. |
| `raw` | `RawOptions \| false` | No | `undefined` (disabled) | No | Pass any object (even `{}`) to enable. |

### Size limits

`limit` accepts a byte count or a human-readable string (`parseLimit()` in `src/utils/limit.ts`):

```ts
app.use(json({ limit: 1048576 }));  // equivalent
app.use(json({ limit: '1mb' }));    // equivalent
app.use(json({ limit: '1024kb' })); // equivalent
```

**What happens when the limit is exceeded:** the request is rejected with a `BodyParserError` (`status: 413`, `code: 'ENTITY_TOO_LARGE'`) -- either synchronously, before any body byte is read, when `Content-Length` alone already exceeds the limit; or during the read, once the running total of received bytes crosses it. See [Performance](#performance) and `ARCHITECTURE.md`'s size-limit state diagram for exactly which check fires when.

## Performance

Body parsing sits on the request hot path, so every parser does the minimum work per request:

- **Size limiting is enforced during the read, not only after.** `readBody()` (`src/parsers/reader.ts`) passes the parser's configured `limit` to the adapter's `BodySource.buffer(limit)`, which tracks the running total as bytes arrive and stops the stream once it crosses the limit -- a request is never allowed to buffer more than roughly `limit` bytes, even without a `Content-Length` header. An honest `Content-Length` over the limit is rejected synchronously, before a single body byte is read.
- **Small JSON bodies skip the depth-check traversal.** `checkJsonDepth()` (`src/parsers/json.ts`) is only invoked when the body is at least `2 * (maxDepth + 1)` bytes -- representing nesting depth `d` requires at least `2d` structural bytes (`d` opening + `d` closing brackets), so a shorter body provably cannot exceed `maxDepth` and the recursive walk is skipped entirely.
- **A body-method request that never reads the body allocates nothing.** `ctx.bodySource` is read lazily; GET/HEAD/OPTIONS/TRACE requests never touch it.
- **Node bodies decode via `Buffer.toString('utf8')`**, not `TextDecoder`, when the bytes are already a `Buffer` and the charset is UTF-8 (`src/utils/buffer.ts`) -- byte-identical output, measurably faster for small/mid payloads. `TextDecoder` instances are cached per charset for the edge/non-UTF-8 fallback.
- **The combined `bodyParser()` detects content-type once.** It routes to the matching sub-parser with a `prechecked` flag, so the delegated parser skips re-checking the method/existing-body/content-type it already checked.

> Numbers move with hardware and load -- run `pnpm bench:compare --profile standard` (pinned) in `apps/benchmark` on your own machine.

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
| Bun / Deno / Edge | Yes / Yes / Yes | Reads the body via the `BodySource` abstraction and the Web-standard `TextDecoder`/`Uint8Array` -- zero `node:` imports |

**Integration**
- **Peer dependencies:** none -- depends only on `@nextrush/types` (types, erased at build).
- **Works with:** any NextRush middleware chain; register a parser before route handlers so `ctx.body` is populated when they run.
- **Incompatible with:** `multipart/form-data` -- `bodyParser()` throws `UNSUPPORTED_CONTENT_TYPE` for it; use a dedicated multipart parser instead.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node >=22, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

> [!NOTE]
> `ctx.rawBody` and the `raw()` parser's `ctx.body` are a Node `Buffer` when the runtime provides
> one (so `.toString('hex')`, `.readUInt32BE`, and HMAC `.update(body)` all work), and a plain
> `Uint8Array` on true edge runtimes. Type it as `Buffer | Uint8Array` and use `Buffer.from(body)`
> if you need Buffer-only methods on edge.

---

## Troubleshooting

<details>
<summary><strong>Every request returns 413 "Request body too large"</strong></summary>

**Cause:** the request's `Content-Length` (or the running total read from the stream) exceeded the parser's `limit` -- `'1mb'` for `json()`, `'100kb'` for `urlencoded()`/`text()`/`raw()` by default. **Fix:** raise `limit` for the parser that needs it, or confirm the client isn't sending an unexpectedly large payload.

```ts
app.use(json({ limit: '10mb' }));
```

</details>

<details>
<summary><strong>`ctx.body` is `undefined` even though the client sent a body</strong></summary>

**Cause:** the parser's `Content-Type` allowlist (`type` option) didn't match the request's actual header, or the request method is in `BODYLESS_METHODS` (`GET`, `HEAD`, `OPTIONS`, `TRACE` -- note `DELETE` is intentionally *not* bodyless per RFC 7231 section 4.3.5). **Fix:** confirm the client sets a matching `Content-Type`, or add it to the parser's `type` array.

```ts
app.use(json({ type: ['application/json', 'application/vnd.api+json'] }));
```

</details>

<details>
<summary><strong>Form data with `__proto__` or `constructor` keys throws `INVALID_PARAMETER`</strong></summary>

**Cause:** this is the enforced prototype-pollution guard in `src/utils/url-decode.ts` -- any key part equal to `__proto__`, `constructor`, or `prototype` is rejected at every nesting level, by design. **Fix:** rename the field; there is no opt-out, because disabling this check would reopen a prototype-pollution vector.

</details>

<details>
<summary><strong>`multipart/form-data` requests throw `UNSUPPORTED_CONTENT_TYPE`</strong></summary>

**Cause:** `bodyParser()` deliberately does not parse multipart bodies -- file uploads have different streaming and memory characteristics than JSON/form/text. **Fix:** use a dedicated multipart parser package for file-upload routes.

</details>

## FAQ

**Can I use `@nextrush/body-parser` without the rest of NextRush?**
Yes. It depends only on `@nextrush/types` for the `Middleware` type contract (erased at build) and the adapter-provided `ctx.bodySource` -- there's no other runtime dependency to install.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Yes. The package reads the body through the `BodySource` abstraction and decodes with the Web-standard `TextDecoder`/`Uint8Array` -- there is no `node:` import anywhere in the package.

**Why are `text` and `raw` disabled by default in `bodyParser()`, but `json`/`urlencoded` are on?**
JSON and URL-encoded cover the overwhelming majority of API/form traffic, so they're the zero-config default. Text and raw are opt-in because treating an unexpected `Content-Type` as raw bytes or plain text by default risks silently accepting content the application didn't intend to parse -- pass `text: {}` or `raw: {}` explicitly to enable them.

---

## Package relationships

```text
                       depends on           @nextrush/types  (Middleware contract, types only)
@nextrush/body-parser --------------->
                       often used with      @nextrush/validation  (schema-validate the parsed body)
                       usually used next    @nextrush/form-data  (file uploads this package deliberately doesn't handle)
```

- **Depends on:** [`@nextrush/types`](../../types) -- the `Middleware` type contract, used only by the middleware signatures (types, erased at build).
- **Often used with:** [`@nextrush/validation`](../validation) -- validate the shape of `ctx.body` once it's parsed.
- **Usually used next:** [`@nextrush/form-data`](../multipart) -- for the file-upload traffic this package's `bodyParser()` explicitly rejects.
- **Alternative:** none for standard body parsing -- streaming the body directly is the alternative only when buffering the full body in memory isn't acceptable.

## Architecture

Maintaining or contributing to this package? The internal design -- the read/parse/populate
pipeline, the size-limit enforcement sequence, the module layout, and the decisions and
trade-offs behind them (with diagrams) -- is in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) . [Architecture](./ARCHITECTURE.md) . [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
