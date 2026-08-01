# @nextrush/compression

> Response compression for NextRush -- negotiates Gzip, Deflate, or Brotli against the client's `Accept-Encoding`, then compresses the buffered response body via the Web Compression Streams API (with a Node zlib fallback for Brotli).

[![npm version](https://img.shields.io/npm/v/@nextrush/compression.svg)](https://www.npmjs.com/package/@nextrush/compression)
[![downloads](https://img.shields.io/npm/dm/@nextrush/compression.svg)](https://www.npmjs.com/package/@nextrush/compression)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/compression.svg)](https://bundlephobia.com/package/@nextrush/compression)
[![types](https://img.shields.io/npm/types/@nextrush/compression.svg)](https://www.npmjs.com/package/@nextrush/compression)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/compression.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Compress compressible response bodies based on client capability and content type |
| **Package type** | Middleware |
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install. Not re-exported from `nextrush` or `nextrush/class`. |
| **Support tier** | Public -- middleware/registrar (stable) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal -- Node, Bun, Deno, Edge, browser (Web Compression Streams API; Brotli requires Node's `zlib`) |
| **Requires** | Node >=22, ESM-only, TypeScript >=5.x |
| **Introduced** | v3.0.0 |

## Highlights

- Zero runtime dependencies (a types-only dependency on `@nextrush/types`, erased at build)
- ESM-only, tree-shakable, side-effect-free (`sideEffects: false`)
- Fully typed, strict TypeScript, zero `any`
- Whole-body compression after the response is fully buffered -- not a streaming transform of an in-flight response body; see [Mental model](#mental-model)

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) . [When to use](#when-to-use) . [Installation](#installation) . [Quick start](#quick-start) . [Capabilities](#capabilities) . [Mental model](#mental-model) . [Common tasks](#common-tasks) . [API overview](#api-overview) . [Options](#options) . [Performance](#performance) . [Compatibility](#compatibility) . [Troubleshooting](#troubleshooting) . [FAQ](#faq) . [Package relationships](#package-relationships) . [Architecture](#architecture) . [Resources](#resources)

</details>

---

## The problem

Sending an uncompressed JSON or HTML response costs bandwidth and time proportional to its raw size, but compressing every response unconditionally is its own mistake: compressing an already-compressed image wastes CPU for no size gain, compressing a tiny response can make it larger once headers are counted, and picking one encoding regardless of what the client's `Accept-Encoding` actually lists means some clients receive an encoding they cannot decode.

```ts
// TODAY, without this package -- picks one encoding for everyone, every response:
import { gzipSync } from 'node:zlib';
app.use((ctx, next) => {
  next();
  const compressed = gzipSync(Buffer.from(JSON.stringify(ctx.body)));
  ctx.set('Content-Encoding', 'gzip');
  ctx.body = compressed;
  // Ignores Accept-Encoding entirely, compresses PNGs the same as JSON,
  // and compresses a 40-byte response just as eagerly as a 400KB one.
});
```

## When to use

**Use `@nextrush/compression` if:**

- Your responses are text-heavy (JSON APIs, HTML, CSS, JavaScript) and bandwidth savings matter
- You want content negotiation (`Accept-Encoding`) and content-type filtering handled automatically instead of a fixed, unconditional encoding
- Your response bodies are small enough to buffer safely in memory (see [Options](#options)'s `threshold` and the 10MB in-memory cap)

**Reach for something else if:**

- You are streaming a genuinely large or long-lived response body (SSE, file downloads, video) -- this middleware buffers the entire body before compressing, and explicitly skips anything over its in-memory size cap; use a reverse proxy/CDN's streaming compression for those responses instead
- Your responses are already compressed (images, video, PDFs, archives) -- the default `exclude` list already skips these, so adding this middleware changes nothing for them, but it also adds nothing
- You need CSP/security headers rather than compression -- see [`@nextrush/helmet`](../helmet)

---

## Installation

```bash
pnpm add @nextrush/compression
# npm i @nextrush/compression . yarn add @nextrush/compression . bun add @nextrush/compression
```

> [!NOTE]
> `@nextrush/compression` is not re-exported by the `nextrush` meta package -- install and import
> it directly, as shown above.

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { compression } from '@nextrush/compression';

const app = createApp();

app.use(compression());

app.get('/api/data', (ctx) => {
  ctx.json({ message: 'Hello from API', items: Array(100).fill('data') });
});

listen(app, 8080);
```

`compression()` with no options negotiates the best of Brotli, Gzip, or Deflate against the request's `Accept-Encoding`, compresses response bodies at or above 1024 bytes whose content type is in the default compressible list, and leaves everything else untouched.

## Capabilities

**Content negotiation**
- Parses `Accept-Encoding` including quality values (`q=`) and the `*` wildcard
- Tie-break priority when qualities are equal: Brotli, then Gzip, then Deflate (server-enabled encodings only)
- An `Accept-Encoding: identity` or a header with no compression option accepted skips compression entirely

**Content-type filtering**
- A default compressible list (text formats, JSON/XML/JS variants, fonts, SVG) and a default excluded list (already-compressed images, video, audio, archives, `woff2`, PDF) drawn directly from `constants.ts`
- Wildcard patterns (`text/*`, `*/json`) supported in both `contentTypes` and `exclude`
- Skips compression if the response already carries a `Content-Encoding` other than `identity`

**Runtime-aware algorithm selection**
- Gzip and Deflate use the Web Compression Streams API (`CompressionStream`) when available -- Node, Bun, and any runtime implementing the standard
- Brotli requires Node.js's `zlib` module (dynamically imported only when Brotli is actually selected) -- it is not available via Web Compression Streams on any runtime today, so Brotli silently falls out of the negotiated set on Deno, Edge, and browsers even if `brotli: true` is configured
- `detectCapabilities()` caches its runtime detection result for the life of the process; `resetCapabilities()` clears it (primarily for tests)

**Safety guards**
- A configurable `threshold` (default 1024 bytes) skips compressing bodies too small to benefit
- A hard 10MB in-memory size cap skips compression for bodies larger than that, rather than risking an out-of-memory buffer
- A compression-ratio ceiling (1000x) throws if exceeded, as a decompression-bomb sanity check on the *compression* side
- A response carrying `Cache-Control: no-transform` is never compressed -- that directive is an explicit instruction that no intermediary may transform the entity body, and compression is exactly such a transform
- An optional `skip` predicate lets a specific response opt out per-request, independent of `filter`
- Optional `breachMitigation` adds a random-length `X-Pad` header, mitigating BREACH-style compression-oracle attacks on responses that reflect user input alongside secrets

> [!WARNING]
> **BREACH and CSRF tokens.** BREACH is a compression-oracle attack: if a response body contains
> both a secret (a CSRF token, a session identifier) *and* attacker-influenced input (a reflected
> query parameter, a search term echoed into the page) in the same compressed stream, an attacker
> who can trigger many requests and observe the compressed response *size* can recover the secret
> byte-by-byte, regardless of TLS. Enabling compression on any endpoint that reflects both a
> CSRF token and user-controlled input reintroduces this risk even though the connection is
> encrypted. Use the `skip` predicate to exclude such responses from compression entirely, or
> enable `breachMitigation` to add randomized padding as a mitigation -- padding raises the cost
> of the attack but does not make it theoretically impossible; excluding the response from
> compression is the stronger guarantee.

**Developer experience**
- Zero runtime dependencies beyond `@nextrush/types`
- `gzip()`/`deflate()`/`brotli()` convenience wrappers that force one algorithm
- `getCompressionInfo(ctx)` / `wasCompressed(ctx)` for observability
- Fully typed, zero `any`

## Mental model

This middleware runs `await next()` first, then inspects and compresses the response the downstream handler produced -- it is a post-processing step, not a pass-through stream transform. The entire response body is read into memory as a `Uint8Array` before compression starts, compressed as one complete operation, and the compressed bytes replace the body entirely before the adapter sends the response.

```text
request --> compression() --> await next() (handler runs, sets ctx.body) --> shouldCompress? --> negotiate encoding
                                                                                    |                    |
                                                                                    no                compress(wholeBody)
                                                                                    |                    |
                                                                              leave untouched     replace ctx.body, set headers
```

**Rule:** this is whole-response compression, not streaming compression -- a response has to be fully generated and held in memory before this middleware compresses it, which is exactly why very large or genuinely streamed responses (SSE, file downloads) are explicitly excluded by size, not just discouraged.

> [!TIP]
> The full decision sequence and the runtime-capability negotiation path (with diagrams) are in
> [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Enable compression with default settings

```ts
import { compression } from '@nextrush/compression';

app.use(compression());
```

### Increase compression level for static-ish responses

```ts
app.use(compression({ level: 9, threshold: 512 }));
```

### Force a single algorithm

```ts
import { gzip } from '@nextrush/compression';

app.use(gzip({ level: 6 }));
```

### Skip compression for a streaming route

```ts
app.use(compression({
  filter: (ctx) => !ctx.path.startsWith('/api/stream'),
}));
```

### Add BREACH mitigation for responses that reflect user input alongside secrets

```ts
import { compression, secureCompressionOptions } from '@nextrush/compression';

app.use(compression(secureCompressionOptions({ threshold: 256 })));
```

### Check whether a response was compressed

```ts
import { wasCompressed, getCompressionInfo } from '@nextrush/compression';

app.use(async (ctx, next) => {
  await next();
  if (wasCompressed(ctx)) {
    const info = getCompressionInfo(ctx);
    console.log(`Compressed with ${info?.encoding}: ${info?.ratio.toFixed(2)} ratio`);
  }
});
```

## API overview

The sealed public surface (ADR-0005).

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `compression` | `(options?: CompressionOptions) => Middleware` | 3.0.0 | Stable | The core middleware factory. Also the default export. |
| `gzip` / `deflate` / `brotli` | `(options?) => Middleware` | 3.0.0 | Stable | Single-algorithm convenience wrappers. |
| `getCompressionInfo` / `wasCompressed` | `(ctx) => CompressionInfo \| undefined` / `(ctx) => boolean` | 3.0.0 | Stable | Read the outcome from `ctx.state.compression` after the middleware ran. |
| `secureCompressionOptions` | `(options?) => CompressionOptions` | 3.0.0 | Stable | Enables `breachMitigation`, defaults `level` to 4. |
| `compress` / `compressData` / `compressToBuffer` | `functions` | 3.0.0 | Stable | Low-level compression, for advanced use. |
| `detectCapabilities` / `resetCapabilities` / `isEncodingSupported` / `getBestAvailableEncoding` | `functions` | 3.0.0 | Stable | Runtime-capability detection primitives. |
| `estimateCompressedSize` / `isCompressionBeneficial` | `functions` | 3.0.0 | Stable | Estimation helpers -- rough, not measured. |
| `parseAcceptEncoding` / `isEncodingAccepted` / `getEncodingQuality` / `negotiateEncoding` / `selectEncoding` / `acceptsCompression` / `getAcceptedEncodings` | `functions` | 3.0.0 | Stable | Content-negotiation primitives. |
| `matchesPattern` / `matchesAnyPattern` / `extractMimeType` / `isCompressible` / `isAlreadyCompressed` / `isTextContent` / `isBinaryContent` / `getCompressionRecommendation` | `functions` | 3.0.0 | Stable | Content-type filtering primitives. |
| `COMPRESSION_ENCODINGS` / `DEFAULT_COMPRESSIBLE_TYPES` / `DEFAULT_EXCLUDED_TYPES` / `DEFAULT_OPTIONS` / `ENCODING_PRIORITY` / `MAX_*` / `NO_BODY_METHODS` / `NO_COMPRESS_STATUS_CODES` / `VARY_HEADER` | `const` | 3.0.0 | Stable | Constants for custom implementations. |
| `type CompressionOptions` / `ResolvedCompressionOptions` / `CompressionEncoding` / `CompressionInfo` / `CompressionResult` / `RuntimeCapabilities` / `NegotiationResult` / `AcceptEncodingEntry` | -- | 3.0.0 | Stable | Public option and data contracts. |
| `CompressionError` / `CompressionErrorCode` | `class` / `const` | 3.0.0 | Stable | The thrown error type and its error codes. |
| default export | `compression` | 3.0.0 | Stable | Same function as the named `compression` export. |

## Options

Every default below is read directly from `src/constants.ts`'s `DEFAULT_OPTIONS` and `resolveOptions()` in `middleware.ts`.

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------ | ----------- |
| `gzip` | `boolean` | No | `true` | No | Disabling removes gzip from the negotiated set entirely. |
| `deflate` | `boolean` | No | `true` | No | Disabling removes deflate from the negotiated set entirely. |
| `brotli` | `boolean` | No | `true` | No | Also gated on `detectCapabilities().hasBrotli` -- `false` on Deno/Edge/browser, but `true` on Bun even though `compress()` has no working Brotli path there (see [Compatibility](#compatibility)). |
| `level` | `number` | No | `6` | No | Clamped per-algorithm at compress time (`MAX_ZLIB_LEVEL` 9, `MAX_BROTLI_LEVEL` 11) -- not validated up front, so an out-of-range value is silently clamped rather than rejected. |
| `threshold` | `number` | No | `1024` (1KB) | No | Bodies smaller than this are never compressed. |
| `contentTypes` | `readonly string[]` | No | `DEFAULT_COMPRESSIBLE_TYPES` | No | Supports exact matches and `text/*`/`*/json`-style wildcards. |
| `exclude` | `readonly string[]` | No | `DEFAULT_EXCLUDED_TYPES` | No | Checked before `contentTypes` -- an exclusion always wins over an inclusion. |
| `filter` | `(ctx: Context) => boolean` | No | `undefined` (no extra filter) | No | Runs after every other check; returning `false` skips compression for that response. Typically encodes a route/type-shaped policy decided once at construction. |
| `skip` | `(ctx: Context) => boolean` | No | `undefined` (no skip predicate) | Yes | Checked independently of `filter` -- returning `true` skips compression for that response. Intended for opting out a specific response carrying a secret (e.g. a CSRF token) whose body also reflects attacker-influenced input; see the BREACH note below. Either `filter` returning `false` or `skip` returning `true` is sufficient to skip. |
| `breachMitigation` | `boolean` | No | `false` | Yes | Adds a random-length `X-Pad` header (1-256 `x` characters) as defense-in-depth against BREACH-style compression-oracle attacks. |

## Performance

Measured characteristics come from `apps/benchmark`; run the suite yourself for numbers on your own hardware (see the repository root README's Performance section). Structurally:

- Gzip/deflate go through the Web Compression Streams API when available; Brotli requires a dynamic `import('node:zlib')`, only triggered when Brotli is the negotiated encoding.
- The entire response body is held in memory as a `Uint8Array` during compression -- cost scales with body size, capped at 10MB (`MAX_IN_MEMORY_SIZE`) before compression is skipped outright.
- `level` trades CPU time for compression ratio; the default (6) is the same "good balance" default zlib itself recommends.

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
| Node.js >=22 | Yes | Gzip/deflate via Web Compression Streams or `node:zlib`; Brotli via `node:zlib` |
| Bun | Yes (gzip/deflate) / Reports yes, fails closed (Brotli) | `detectCapabilities()` hardcodes `hasBrotli: true` for Bun rather than probing actual `CompressionStream` Brotli support; since Bun has no `node:zlib` fallback either, a negotiated `br` on Bun throws inside `compress()` and is caught by the middleware's degrade-to-uncompressed path -- see [Troubleshooting](#troubleshooting) |
| Deno / Edge / browser | Yes (gzip/deflate) / No (Brotli) | Brotli is gated off automatically (`hasBrotli: false`) since none of these expose Node's `zlib` |

**Integration**
- **Peer dependencies:** none -- depends only on `@nextrush/types` (types, erased at build).
- **Works with:** any NextRush middleware chain; register early so it can inspect and transform whatever body downstream handlers produce.
- **Incompatible with:** streaming responses (SSE, chunked file downloads) -- this middleware buffers the whole body; use [`@nextrush/stream`](../../stream) for those without this middleware in the chain.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node >=22, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong>Responses are never compressed, even for large JSON bodies</strong></summary>

**Cause:** the most common reasons, in order: the client's `Accept-Encoding` doesn't list a server-enabled encoding, the response's `Content-Type` isn't in the compressible list (or is in the excluded list), or the body is under the `threshold` (1024 bytes by default). **Fix:** confirm the request sends `Accept-Encoding: gzip` (or similar), check the actual `Content-Type` your handler sets, and lower `threshold` if your typical responses are smaller than 1KB.

</details>

<details>
<summary><strong>Brotli never gets selected, even with `brotli: true` and a client that accepts `br`</strong></summary>

**Cause:** `resolveOptions()` ANDs your `brotli` setting with `detectCapabilities().hasBrotli` -- outside Node.js and Bun (Deno, Edge, most browsers), Brotli is unavailable in the Web Compression Streams API today, so it is disabled regardless of your configuration. **Fix:** none outside Node/Bun -- negotiation falls through to gzip/deflate automatically; this is expected, not a bug to configure around.

</details>

<details>
<summary><strong>On Bun, a client that accepts `br` gets an uncompressed response and `ctx.state.compressionError` is set</strong></summary>

**Cause:** `detectCapabilities()` hardcodes `hasBrotli: true` whenever `process.versions.bun` is present -- it does not verify that Bun's `CompressionStream` actually supports the `br` format. When `br` is negotiated on Bun, `compress()` has no working path for it (Bun isn't routed through the Web Compression Streams gzip/deflate branch for `br`, and `hasNodeZlib` is never `true` on Bun), so it throws `CompressionError('No compression implementation available')`, caught by the middleware's degrade-to-uncompressed path. **Fix:** disable Brotli explicitly on Bun (`compression({ brotli: false })`) if you serve from Bun and want to avoid the wasted negotiation/compression attempt -- gzip/deflate work normally there.

</details>

<details>
<summary><strong>A large response silently isn't compressed and there's no error</strong></summary>

**Cause:** bodies over `MAX_IN_MEMORY_SIZE` (10MB) are skipped intentionally to avoid buffering an unbounded amount of memory per request. **Fix:** if the response is genuinely large, don't rely on this middleware -- compress at a CDN/reverse-proxy layer that streams, or reduce response size (pagination, field selection).

</details>

<details>
<summary><strong>Compression silently doesn't happen and `ctx.state.compressionError` is set</strong></summary>

**Cause:** the middleware catches every compression failure and degrades gracefully to sending the original uncompressed body, recording the error message on `ctx.state.compressionError` rather than throwing into the response. **Fix:** check `ctx.state.compressionError` in logging middleware registered after this one to surface the actual cause (e.g. an unsupported encoding in the current runtime).

</details>

## FAQ

**Does this stream-compress large or long-lived responses?**
No. It buffers the entire response body into memory, compresses it as one operation, then replaces `ctx.body` with the compressed bytes -- see [Mental model](#mental-model). It explicitly skips anything over the 10MB in-memory cap rather than attempting to stream it.

**What happens if compression fails?**
The middleware catches the error, records it on `ctx.state.compressionError`, and sends the original uncompressed response -- a compression failure never turns into a request failure.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Yes for gzip/deflate everywhere (Web Compression Streams is a Web-standard API). Brotli only actually works on Node.js -- Bun is detected as Brotli-capable but has no working compression path for it in this package (see [Compatibility](#compatibility)), and Deno/Edge/browsers are correctly gated off.

---

## Package relationships

```text
                          depends on           @nextrush/types  (Context / Middleware contracts, types only)
@nextrush/compression ---------------->
                          often used with      @nextrush/helmet  (security headers alongside compression)
                          usually used next    @nextrush/stream  (for responses this middleware explicitly excludes)
```

- **Depends on:** [`@nextrush/types`](../../types) -- shared `Context`/`Middleware` contracts, types only, erased at build.
- **Often used with:** [`@nextrush/helmet`](../helmet) -- both are general-purpose response-shaping middleware commonly registered together.
- **Usually used next:** [`@nextrush/stream`](../../stream) -- for the streaming/SSE responses this package's buffering model does not fit.
- **Alternative:** compression at a reverse proxy or CDN layer, if your responses are large enough that whole-body buffering is a genuine cost concern.

## Architecture

Maintaining or contributing to this package? The internal design -- the runtime-capability
detection, the negotiation and content-type filtering pipeline, the security invariants that
require an RFC to change, and the decisions and trade-offs behind them (with diagrams) -- is in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) . [Architecture](./ARCHITECTURE.md) . [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
