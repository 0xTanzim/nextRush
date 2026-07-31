# @nextrush/static

> Node-only static file serving middleware for NextRush -- streams files from a directory with path-traversal protection, ETag/Last-Modified conditional requests, single-range byte serving, and dotfile/symlink policies.

[![npm version](https://img.shields.io/npm/v/@nextrush/static.svg)](https://www.npmjs.com/package/@nextrush/static)
[![downloads](https://img.shields.io/npm/dm/@nextrush/static.svg)](https://www.npmjs.com/package/@nextrush/static)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/static.svg)](https://bundlephobia.com/package/@nextrush/static)
[![types](https://img.shields.io/npm/types/@nextrush/static.svg)](https://www.npmjs.com/package/@nextrush/static)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/static.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Serve static files from a directory with caching headers, range support, and path-traversal protection |
| **Package type** | Middleware |
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install; not re-exported from `nextrush` or `nextrush/class` |
| **Support tier** | Public -- middleware/registrar (stable) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Node.js only -- imports `node:fs`, `node:path`, `node:http` directly; no Bun/Deno/Edge claim is made by this package |
| **Requires** | Node >=22, ESM-only, TypeScript >=5.x |
| **Introduced** | v1.0.0 |

## Highlights

- Zero required runtime dependencies (a types-only dependency on `@nextrush/types`; `@nextrush/core` is an *optional* peer dependency, not installed automatically)
- ESM-only, tree-shakable, side-effect-free (`sideEffects: false`)
- Fully typed, strict TypeScript, zero `any`
- Path-traversal protection enforced at two independent layers (URL decode + filesystem path resolution) -- see [Trust boundaries](./ARCHITECTURE.md#trust-boundaries)
- Symlinks are not followed by default; range requests, conditional caching, and directory-index serving are all built in

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) . [When to use](#when-to-use) . [Installation](#installation) . [Quick start](#quick-start) . [Capabilities](#capabilities) . [Mental model](#mental-model) . [Common tasks](#common-tasks) . [API overview](#api-overview) . [Options](#options) . [Performance](#performance) . [Compatibility](#compatibility) . [Troubleshooting](#troubleshooting) . [FAQ](#faq) . [Package relationships](#package-relationships) . [Architecture](#architecture) . [Resources](#resources)

</details>

---

## The problem

Serving a directory of files sounds like a single `fs.readFile` call, until a client sends a
crafted path:

```ts
// TODAY, without a traversal-aware static server -- quick to write, dangerous to ship:
import { readFile } from 'node:fs';
import { join } from 'node:path';

app.get('/files/:name', (ctx) => {
  const filePath = join('./public', ctx.params.name); // ctx.params.name = '../../.env'
  readFile(filePath, (err, data) => {
    // join() happily walks out of './public' -- there is no check that filePath
    // is still inside the intended root directory before the read happens
  });
});
```

Beyond the missing containment check, a by-hand file server usually also skips conditional
requests (`If-None-Match`/`If-Modified-Since`), so every asset is re-sent in full on every load,
and skips `Range` support entirely, breaking video/audio seeking and resumable downloads.

## When to use

**Use `@nextrush/static` if:**

- You're serving a directory of built assets (a compiled frontend, uploaded files served back, a
  documentation build) directly from Node.js
- You need conditional caching (`ETag`/`Last-Modified`) and byte-range support (`Range`/`Accept-Ranges`) without hand-rolling them
- You want path traversal, dotfile, and symlink handling with secure-by-default settings

**Reach for something else if:**

- You're deploying behind a CDN or reverse proxy that already serves static assets (nginx, a CDN edge) -- terminating static serving in Node adds latency a dedicated static-file server or CDN avoids
- You're on Bun/Deno/Edge and need static serving there -- this package imports `node:fs`/`node:path`/`node:http` directly and has no Edge-safe fallback
- You need the uploaded-file storage side of a `multipart/form-data` request -- see [`@nextrush/form-data`](../multipart)

---

## Installation

```bash
pnpm add @nextrush/static
# npm i @nextrush/static . yarn add @nextrush/static . bun add @nextrush/static
```

> [!NOTE]
> `@nextrush/static` is not re-exported by the `nextrush` meta package -- install and import it
> directly, as shown above. `@nextrush/core` is listed as an optional peer dependency (for the
> `NodeContext`/`Middleware` type contracts) -- installing `nextrush` or `@nextrush/core`
> separately satisfies it.

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { serveStatic } from '@nextrush/static';

const app = createApp();

app.use(serveStatic({ root: './public' }));

listen(app, 8080);
```

`serveStatic()` only handles `GET`/`HEAD` requests, resolves the request path against `root`
with traversal protection on every request, and calls `next()` (or returns a 404 JSON body,
depending on `fallthrough`) for anything it doesn't find.

## Capabilities

**Serving**
- `serveStatic()` / `staticFiles` (an alias, Express-style naming) -- middleware factory that serves an entire directory
- `createSendFile()` -- a factory for a single-file `send()` helper, for serving one specific file from inside a route handler
- `sendFile()` -- the lower-level function that streams a resolved, already-stat'd file, exported for advanced use
- Directory requests serve an `index` file (default `'index.html'`, or `false` to disable) and redirect to add a trailing slash by default
- Extension fallbacks (`extensions: ['.html']`) let `/page` resolve to `/page.html` when the exact path isn't found

**Security**
- Path traversal is rejected both by an early URL-decode check (`..`, null bytes, `//`) in `serveStatic()`'s middleware, and independently by `safeJoin()`'s filesystem-level containment check (`resolved path === root` or starts with `root + path.sep`)
- Symlinks are not followed by default (`followSymlinks: false`); when enabled, the resolved real path is independently checked against `root` before the file is served
- Dotfiles (files/directories starting with `.`) default to `'ignore'` (404); can be set to `'deny'` (403) or `'allow'`
- `X-Content-Type-Options: nosniff` is set by default, disabling MIME-type sniffing in browsers
- `untrusted: true` neutralizes script-capable content (`.svg`, `.html`, `.htm`, `.xhtml`): downgrades `Content-Type` to `application/octet-stream`, forces `Content-Disposition: attachment`, and adds a sandboxing `Content-Security-Policy` -- applied uniformly across a direct match, directory-index, and extension-fallback resolution, since a root that also accepts untrusted uploads must not let one execute on the app's own origin

**Caching & range support**
- Weak `ETag` (FNV-1a hash of file size + mtime) and `Last-Modified`, both on by default; `If-None-Match`/`If-Modified-Since` requests get a `304` with content headers stripped
- Single-range `Range: bytes=start-end` / `bytes=start-` / `bytes=-suffix` requests return `206 Partial Content`; an unsatisfiable range returns `416`
- `Cache-Control` with `max-age`/`immutable` directives when `maxAge > 0`

**Performance**
- Files at or under `highWaterMark` (default 1MB) are read with a single `fs.readFile()` call; larger files are streamed via `fs.createReadStream()`
- Every read opens exactly one file descriptor for the request and reads, `fstat`s, and streams from that same descriptor -- a symlink or file swapped in after the initial safety check cannot be followed, because nothing re-resolves the path by name after `open()`
- Streaming responses honor a configurable `streamTimeout` (default 30s) and clean up the read stream on client disconnect

## Mental model

Every request is resolved against one `root` directory and validated for containment before
anything is read from disk -- the containment check happens whether or not the request looks
suspicious.

```text
GET /path --> strip prefix --> decode + reject '..'/'\0'/'//' --> safeJoin(root, path)
                                                                         |
                                                        null (outside root) --> 403/next()
                                                                         |
                                                                     stat file
                                                                         |
                                                        304 / 206 / 200 response via sendFile()
```

**Rule:** `safeJoin()` never returns a path outside `root` -- if the resolved path isn't `root`
itself or doesn't start with `root + path.sep`, it returns `null` and the request is rejected,
regardless of how the traversal was attempted.

> [!TIP]
> The full request-resolution sequence and the path-traversal/symlink containment checks (with
> diagrams) are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Serve a directory under a URL prefix

```ts
import { serveStatic } from '@nextrush/static';

app.use(
  serveStatic({
    root: './public',
    prefix: '/static',
    maxAge: 86400, // 1 day
  })
);
```

### Serve fingerprinted assets with long-lived caching

```ts
app.use(
  serveStatic({
    root: './dist/assets',
    maxAge: 31536000, // 1 year
    immutable: true, // tells the browser this exact URL will never change
  })
);
```

### SPA fallback -- let unmatched paths reach app routes

```ts
app.use(
  serveStatic({
    root: './dist',
    fallthrough: true, // 404s call next() instead of responding, so an app route can handle them
  })
);
```

### Serve one specific file from a route handler

```ts
import { createSendFile } from '@nextrush/static';

const sendPublicFile = createSendFile({ root: './public' });

app.get('/download/:file', async (ctx) => {
  const sent = await sendPublicFile(ctx, ctx.params.file);
  if (!sent) {
    ctx.status = 404;
    ctx.json({ error: 'Not Found' });
  }
});
```

### Allow symlinks (only if you trust everything under `root`)

```ts
app.use(
  serveStatic({
    root: './public',
    followSymlinks: true, // resolved target is still validated against root
  })
);
```

## API overview

The sealed public surface (`src/index.ts`, guarded by a public-surface test -- ADR-0005).

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `serveStatic` | `(options: StaticOptions) => Middleware` | 1.0.0 | Stable | Middleware factory; serves an entire directory. |
| `staticFiles` | same as `serveStatic` | 1.0.0 | Stable | Alias (Express-style naming) for `serveStatic`. |
| `createSendFile` | `(options: Omit<StaticOptions, 'prefix'>) => (ctx, relativePath) => Promise<boolean>` | 1.0.0 | Stable | Factory for serving one file at a time from inside a route handler. |
| `sendFile` | `(ctx, absolutePath, stat, options) => Promise<void>` | 1.0.0 | Stable | Lower-level function that streams an already-resolved, already-stat'd file. |
| `safeJoin` | `(root: string, urlPath: string) => string \| null` | 1.0.0 | Stable | Path-traversal-safe join; returns `null` if the result would escape `root`. |
| `statSafe` | `(path, followSymlinks?, root?) => Promise<StatsLike \| null>` | 1.0.0 | Stable | Symlink-aware stat; returns `null` for a disallowed or missing path. |
| `stripPrefix` | `(pathname: string, prefix: string) => string` | 1.0.0 | Stable | Removes a configured URL prefix from a request path. |
| `normalizePrefix` | `(prefix: string \| undefined) => string` | 1.0.0 | Stable | Normalizes a `prefix` option to a consistent form. |
| `isDotfile` | `(filePath: string) => boolean` | 1.0.0 | Stable | Whether any path segment starts with `.` (excluding `.`/`..`). |
| `generateETag` | `(stat: StatsLike) => string` | 1.0.0 | Stable | Weak ETag from file size + mtime (FNV-1a hash). |
| `isFresh` | `(ctx, stat, etag) => boolean` | 1.0.0 | Stable | Whether a request is `304`-eligible per `If-None-Match`/`If-Modified-Since`. |
| `parseRange` | `(rangeHeader: string, size: number) => RangeResult \| null` | 1.0.0 | Stable | Parses a single-range `Range` header value. |
| `getMimeType` | `(filePath: string) => string` | 1.0.0 | Stable | Extension-to-MIME-type lookup from a static table. |
| `type StaticOptions` / `NormalizedStaticOptions` / `NodeContext` / `NodeMiddleware` / `StaticContext` / `DotfilesPolicy` / `StatsLike` / `RangeResult` | -- | 1.0.0 | Stable | Public option and data contracts. |

## Options

Every default below is read directly from `DEFAULT_OPTIONS` in `src/index.ts`.

**`serveStatic(options)` / `staticFiles(options)` (`StaticOptions`)**

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ----------- |
| `root` | `string` | Yes | -- | Yes | Root directory to serve from; resolved to an absolute path. |
| `prefix` | `` `/${string}` \| '' `` | No | `''` | No | URL prefix to mount under. |
| `index` | `string \| false` | No | `'index.html'` | No | Index file served for a directory request; `false` disables index serving. |
| `fallthrough` | `boolean` | No | `false` | No | `true`: call `next()` on a 404 instead of responding. |
| `redirect` | `boolean` | No | `true` | No | Redirect a directory request without a trailing slash to add one. |
| `maxAge` | `number` | No | `0` | No | `Cache-Control` `max-age` in seconds; `0` disables `Cache-Control`. |
| `immutable` | `boolean` | No | `false` | No | Adds the `immutable` directive; only applied when `maxAge > 0`. |
| `dotfiles` | `'ignore' \| 'deny' \| 'allow'` | No | `'ignore'` | Yes | Policy for files/directories starting with `.`. |
| `extensions` | `string[]` | No | `[]` | No | Extensions tried, in order, when the exact path isn't found. |
| `setHeaders` | `(ctx, absolutePath, stat) => void` | No | `undefined` | No | Hook to add/override headers before the file is sent. |
| `etag` | `boolean` | No | `true` | No | Enables `ETag` generation and `If-None-Match` handling. |
| `lastModified` | `boolean` | No | `true` | No | Enables `Last-Modified` and `If-Modified-Since` handling. |
| `acceptRanges` | `boolean` | No | `true` | No | Enables `Accept-Ranges`/`Range` request support. |
| `highWaterMark` | `number` | No | `1048576` (1 MB) | No | Files at or under this size use a single `readFile()`; larger files stream. |
| `followSymlinks` | `boolean` | No | `false` | Yes | `false`: symlinks are treated as not found. `true`: resolved, but the target must still be inside `root`. |
| `xContentTypeOptions` | `boolean` | No | `true` | Yes | Sets `X-Content-Type-Options: nosniff`. |
| `untrusted` | `boolean` | No | `false` | Yes | Neutralizes script-capable content types (`.svg`/`.html`/`.htm`/`.xhtml`): forces `application/octet-stream`, `Content-Disposition: attachment`, and a sandboxing `Content-Security-Policy`. Applies to directory-index and extension-fallback resolutions too. Use for a root that also accepts untrusted uploads. |
| `streamTimeout` | `number` | No | `30000` (30s) | No | Timeout for a streamed (non-small-file) response; `0` disables it. |

### Path traversal handling

`root` is resolved to an absolute path once, at middleware creation time. Every request path is
then run through two independent checks before any filesystem read (see
[Trust boundaries](./ARCHITECTURE.md#trust-boundaries) for the full sequence):

1. **`serveStatic()`'s early rejection** -- the decoded URL path is checked for `..`, a null byte
   (`\0`), or a double slash (`//`) and rejected with `403` before any path join happens.
2. **`safeJoin()`'s containment check** -- `path.normalize()` strips `.`/`..` segments, and the
   *result* is independently verified to equal `root` or start with `root + path.sep` before it is
   ever returned; a path that resolves outside `root` returns `null` regardless of how it was
   constructed.

## Performance

Static file serving sits on the request hot path for asset-heavy applications, so file size
decides which of two paths a request takes:

- **Small files (`stat.size <= highWaterMark`, default 1MB) are read in one call.** `sendFile()` calls `fsp.readFile()` once and writes the full buffer to the response -- no stream setup cost for the common small-asset case (CSS, JS, small images).
- **Small-file reads carry a TOCTOU re-check.** If the actual bytes read differ in length from the earlier `stat()` call (the file changed between the two), `Content-Length` is corrected to the real byte count read, rather than trusting a now-stale `stat()` result.
- **Large files stream via `fs.createReadStream()`**, piped directly to the response, bounded by a configurable `streamTimeout` (default 30s) that destroys the stream and rejects if it fires.
- **A client disconnect during a streamed response destroys the read stream immediately** (`ctx.raw.res` `'close'` handler in `streamToResponse()`), rather than continuing to read a file no one will receive.
- **ETag generation uses FNV-1a over `size-mtime`, not a content hash** -- O(1) relative to file size, since it never reads the file's actual bytes to compute the tag.

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
| ------- | :---: | ----- |
| Node.js >=22 | Yes | ESM-only; imports `node:fs`, `node:path`, `node:http` directly |
| Bun / Deno / Edge | Not claimed | This package makes no Edge/Bun/Deno-specific guarantee -- it is written against Node's `node:fs`/`node:http` APIs, with no adapter abstraction or conformance-suite coverage |

**Integration**
- **Peer dependencies:** `@nextrush/core` (optional -- for the `Context`/`Middleware` type contracts; satisfied by installing `nextrush` or `@nextrush/core` separately).
- **Works with:** any NextRush middleware chain; register before route handlers that might otherwise shadow a static path.
- **Incompatible with:** none directly, but a route registered at the same path as a static file will only be reached if `fallthrough: true` and the file isn't found (or the request method isn't `GET`/`HEAD`).

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node >=22, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong>A request that clearly targets a real file inside `root` gets a 403</strong></summary>

**Cause:** the decoded URL path contained `..`, a null byte, or `//`, and `serveStatic()`'s early
check rejects those unconditionally -- even if the resulting path would have stayed inside `root`
after normalization. **Fix:** this is by design (fail-secure over permissive); construct request
paths without `..` segments or double slashes.

</details>

<details>
<summary><strong>A file exists on disk but the middleware returns 404</strong></summary>

**Cause:** most commonly the file is a symlink and `followSymlinks` is `false` (the default) --
`statSafe()` treats an un-followed symlink as not found. Less commonly: the filename starts with
`.` and `dotfiles` is `'ignore'` (the default). **Fix:** set `followSymlinks: true` only if every
symlink under `root` is trusted, or set `dotfiles: 'allow'` if dotfiles should be served.

```ts
app.use(serveStatic({ root: './public', followSymlinks: true }));
```

</details>

<details>
<summary><strong>Every asset re-downloads in full on every page load</strong></summary>

**Cause:** `maxAge` defaults to `0`, so no `Cache-Control` header is sent -- `ETag`/`Last-Modified`
still enable conditional `304` responses, but the browser still round-trips a request each time.
**Fix:** set `maxAge` (and `immutable: true` for content-hashed filenames) for assets that don't
change without their URL changing.

```ts
app.use(serveStatic({ root: './dist/assets', maxAge: 31536000, immutable: true }));
```

</details>

<details>
<summary><strong>A `Range` request returns the full file instead of a partial response</strong></summary>

**Cause:** `parseRange()` only supports a single range (`bytes=start-end`); a multi-range header
(`bytes=0-99,200-299`) is rejected as unparseable and the request falls through to a full `200`
response, not a `416`. **Fix:** this package intentionally supports only single-range requests --
issue separate requests for multiple ranges if the client needs them.

</details>

## FAQ

**Does `@nextrush/static` protect against path traversal?**
Yes, at two independent points: `serveStatic()` rejects `..`/null-byte/`//` in the decoded URL
before any filesystem path is built, and `safeJoin()` independently verifies the resolved
absolute path is `root` itself or starts with `root + path.sep` before returning it -- a request
can't reach a file outside `root` through either path.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Not claimed. This package imports `node:fs`, `node:path`, and `node:http` directly and has no
adapter abstraction -- it targets Node.js specifically, unlike packages such as
`@nextrush/form-data` that are built on Web Streams for cross-runtime parsing.

**Can I use it without a NextRush `Context`?**
No -- `sendFile()`, `serveStatic()`, and `createSendFile()`'s returned function all operate on a
`NodeContext` (`ctx.raw.req`/`ctx.raw.res`, `ctx.set()`, `ctx.status`). The pure utility functions
(`safeJoin`, `statSafe`, `parseRange`, `generateETag`, `getMimeType`, `isDotfile`) have no
`Context` dependency and can be used standalone.

---

## Package relationships

```text
                       depends on           @nextrush/types  (Middleware/Context contract, types only)
@nextrush/static ------------------->
                       optional peer        @nextrush/core  (NodeContext/Middleware types)
                       often used with      @nextrush/compression  (compress served assets)
```

- **Depends on:** [`@nextrush/types`](../../types) -- the `Middleware`/`Next` type contracts (types only, erased at build).
- **Optional peer:** [`@nextrush/core`](../../core) -- satisfies the `Context`/`Middleware` shapes this package's types extend; not installed automatically.
- **Often used with:** [`@nextrush/compression`](../compression) -- compress served assets before they leave the response pipeline.
- **Alternative:** a reverse proxy or CDN (nginx, a CDN edge) for high-traffic static serving, where terminating file I/O in the Node process adds avoidable latency.

## Architecture

Maintaining or contributing to this package? The internal design -- the request-resolution
pipeline, the two-layer path-traversal containment check, the symlink-validation sequence, the
module layout, and the decisions and trade-offs behind them (with diagrams) -- is in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) . [Architecture](./ARCHITECTURE.md) . [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
