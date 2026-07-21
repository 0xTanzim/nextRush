# @nextrush/multipart

> Zero-dependency multipart/form-data parsing and file-upload middleware for NextRush -- buffers the request body once, then streams each file's already-buffered bytes into a pluggable storage strategy (in-memory or disk).

[![npm version](https://img.shields.io/npm/v/@nextrush/multipart.svg)](https://www.npmjs.com/package/@nextrush/multipart)
[![downloads](https://img.shields.io/npm/dm/@nextrush/multipart.svg)](https://www.npmjs.com/package/@nextrush/multipart)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/multipart.svg)](https://bundlephobia.com/package/@nextrush/multipart)
[![types](https://img.shields.io/npm/types/@nextrush/multipart.svg)](https://www.npmjs.com/package/@nextrush/multipart)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/multipart.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Parse `multipart/form-data` request bodies into uploaded files and form fields |
| **Package type** | Middleware |
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install; not re-exported from `nextrush` or `nextrush/class` |
| **Support tier** | Public -- middleware/registrar (stable) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Node, Bun, Deno, Edge for parsing/`MemoryStorage`; `DiskStorage` is Node/Bun/Deno only -- see [Compatibility](#compatibility) |
| **Requires** | Node >=22, ESM-only, TypeScript >=5.x |
| **Introduced** | v1.0.0 |

## Highlights

- Zero runtime dependencies (a types-only dependency on `@nextrush/types`, erased at build)
- ESM-only, tree-shakable, side-effect-free (`sideEffects: false`)
- Fully typed, strict TypeScript, zero `any`
- Boyer-Moore-Horspool boundary scanning, not a naive byte-by-byte search
- Pluggable storage: `MemoryStorage` (buffer) or `DiskStorage` (filesystem) via one `StorageStrategy` interface

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) . [When to use](#when-to-use) . [Installation](#installation) . [Quick start](#quick-start) . [Capabilities](#capabilities) . [Mental model](#mental-model) . [Common tasks](#common-tasks) . [API overview](#api-overview) . [Options](#options) . [Performance](#performance) . [Compatibility](#compatibility) . [Troubleshooting](#troubleshooting) . [FAQ](#faq) . [Package relationships](#package-relationships) . [Architecture](#architecture) . [Resources](#resources)

</details>

---

## The problem

File uploads sound like a simple body read, but `multipart/form-data` interleaves binary file
content with form fields inside a single stream, delimited by a boundary string the client
chooses. A body parser written by hand tends to get the happy-path decode right and miss the rest:

```ts
// TODAY, without a multipart-aware parser -- quick to write, dangerous to ship:
let raw = Buffer.alloc(0);
req.on('data', (chunk) => {
  raw = Buffer.concat([raw, chunk]); // no size ceiling -- a multi-GB upload is buffered in full
});
req.on('end', () => {
  // now what? Splitting on a boundary string by hand means re-deriving RFC 7578 part parsing,
  // Content-Disposition filename extraction, RFC 5987 encoded filenames, and a filename like
  // `../../etc/passwd` reaching your filesystem write untouched
});
```

Beyond the missing size ceiling, a by-hand splitter usually also forgets that a boundary can be
split across two network chunks, that `__proto__` is a legal (and dangerous) form field name, and
that a client-supplied filename is attacker-controlled input, not a trusted path segment.

## When to use

**Use `@nextrush/multipart` if:**

- You need to accept file uploads (`multipart/form-data`) with enforced size/count limits
- You want filename sanitization (path traversal, null bytes, Windows-reserved names) without writing your own
- You need a choice between buffering uploads in memory or streaming them to disk

**Reach for something else if:**

- You're parsing `application/json`, `application/x-www-form-urlencoded`, `text/*`, or raw bodies -- see [`@nextrush/body-parser`](../body-parser), which explicitly rejects multipart
- You need object storage (S3, GCS, etc.) out of the box -- implement `StorageStrategy` yourself; only `MemoryStorage` and `DiskStorage` ship in this package
- You're running on an Edge runtime and need on-disk uploads -- `DiskStorage` requires `node:fs`/`node:path`/`node:stream` and is not available there

---

## Installation

```bash
pnpm add @nextrush/multipart
# npm i @nextrush/multipart . yarn add @nextrush/multipart . bun add @nextrush/multipart
```

> [!NOTE]
> `@nextrush/multipart` is not re-exported by the `nextrush` meta package -- install and import
> it directly, as shown above.

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { multipart } from '@nextrush/multipart';

const app = createApp();

app.use(multipart({ limits: { maxFileSize: '5mb', maxFiles: 3 } }));

app.post('/upload', async (ctx) => {
  const { files, fields } = ctx.state as { files: unknown[]; fields: Record<string, string> };
  ctx.status = 201;
  ctx.json({ uploaded: files.length, fields });
});

listen(app, 8080);
```

`multipart()` skips requests with a bodyless method or a non-multipart `Content-Type`, buffers
the body (up to `maxBodySize`, default `10mb`), and populates `ctx.state.files` /
`ctx.state.fields` before your handler runs.

## Capabilities

**Parsing**
- `multipart()` -- middleware factory; parses `multipart/form-data` bodies into `ctx.state.files` and `ctx.state.fields`
- `parseMultipart()` -- the underlying parser, exported for advanced/direct use without the middleware wrapper
- `BoundaryScanner` -- the Boyer-Moore-Horspool byte scanner, exported for custom parsing built on the same primitive
- Handles boundaries split across the header/body regions, quoted and unquoted `Content-Disposition` values, and RFC 5987 (`filename*=UTF-8''...`) encoded filenames

**Storage**
- `MemoryStorage` -- buffers each file's bytes into a `Uint8Array` (`ctx` files carry `.buffer`); works on every runtime
- `DiskStorage` -- streams each file to the filesystem via `Readable.fromWeb()` + `pipeline()` (`ctx` files carry `.path`); Node/Bun/Deno only, not Edge
- Any custom storage strategy that implements `StorageStrategy.handle()` (and optionally `.remove()` for cleanup)

**Security**
- Filenames run through a multi-step sanitizer (`sanitizeFilename()`): strips path components, null bytes and control characters, leading dots, Windows-reserved device names (`CON`, `NUL`, `COM1`-`9`, `LPT1`-`9`), and truncates to 255 bytes
- Form-field and file-field names are rejected outright when they equal `__proto__`, `constructor`, or `prototype` (`FORBIDDEN_KEYS`)
- `DiskStorage` resolves the generated filename against its destination directory and rejects a resolved path that doesn't start with that directory, before writing
- The total request body is bounded by `maxBodySize` (default `10mb`) while it is being collected from the stream -- independent of any per-file limit

**Performance**
- Boundary search inside the body uses Boyer-Moore-Horspool (`BoundaryScanner`), not a linear byte-by-byte comparison, for every part after the first
- `abortOnError: false` lets a request continue past a single bad part (oversized file, disallowed type, limit overrun) instead of failing the whole upload

## Mental model

`multipart()` collects the whole (size-bounded) request body into memory first, then walks it
part by part -- it does not stream individual parts live off the network into storage.

```text
request body (stream) --> collected into one Uint8Array (bounded by maxBodySize)
                                    |
                                    v
                     boundary-scanned, part by part
                          |                  |
                     file part          field part
                          |                  |
              storage.handle(bytes)     fields[name] = value
                          |
                 ctx.state.files / ctx.state.fields
```

**Rule:** by the time `storage.handle()` runs, the file's bytes are already fully in memory --
`DiskStorage` writing to disk reduces long-term memory retention (the bytes aren't kept in the
result object), but it does not reduce the peak memory used while the request body itself is
being collected.

> [!TIP]
> The full collect-scan-parse-store sequence and the per-part limit checks (with diagrams) are in
> [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Accept uploads with size and count limits

```ts
import { multipart } from '@nextrush/multipart';

app.use(
  multipart({
    limits: {
      maxFileSize: '10mb',
      maxFiles: 5,
      maxFields: 20,
      maxBodySize: '50mb',
    },
  })
);
```

### Restrict accepted file types

```ts
app.use(
  multipart({
    allowedTypes: ['image/*', 'application/pdf'],
  })
);

app.post('/avatar', async (ctx) => {
  const { files } = ctx.state as { files: Array<{ mimeType: string; size: number }> };
  // any file whose Content-Type didn't match 'image/*' or 'application/pdf'
  // already caused the request to be rejected before this handler ran
});
```

### Stream large uploads to disk instead of buffering in memory

```ts
import { multipart, DiskStorage } from '@nextrush/multipart';

app.use(
  multipart({
    storage: new DiskStorage({ dest: './uploads' }),
    limits: { maxFileSize: '200mb' },
  })
);

app.post('/upload', async (ctx) => {
  const { files } = ctx.state as { files: Array<{ path?: string; sanitizedName: string }> };
  // files[i].path holds the on-disk location; files[i].buffer is undefined for DiskStorage
});
```

### Continue an upload past a single bad part

```ts
app.use(
  multipart({
    abortOnError: false, // don't throw on the first oversized/disallowed part
    limits: { maxFileSize: '2mb' },
  })
);

app.post('/bulk-upload', async (ctx) => {
  const { files } = ctx.state as { files: Array<{ truncated: boolean }> };
  const rejected = files.filter((f) => f.truncated);
  // an oversized file is included with truncated: true and its bytes cut off at maxFileSize;
  // a file/field/parts-count overrun, forbidden field name, or disallowed type is skipped entirely
});
```

### Use the parser directly, without the middleware

```ts
import { parseMultipart } from '@nextrush/multipart';

const boundary = '----WebKitFormBoundaryABC123';
const { files, fields } = await parseMultipart(requestBodyStream, boundary, {
  limits: { maxFileSize: '5mb' },
});
```

## API overview

The sealed public surface (ADR-0005).

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `multipart` | `(options?: MultipartOptions) => Middleware` | 1.0.0 | Stable | Middleware factory; parses the request into `ctx.state.files`/`ctx.state.fields`. |
| `parseMultipart` | `(body: ReadableStream<Uint8Array> \| Uint8Array, boundary: string, options?: MultipartOptions) => Promise<ParsedResult>` | 1.0.0 | Stable | The underlying parser, usable without the middleware wrapper. |
| `type ParsedResult` | -- | 1.0.0 | Stable | `{ files: UploadedFile[]; fields: Record<string, string> }`. |
| `BoundaryScanner` | `class` | 1.0.0 | Stable | Boyer-Moore-Horspool boundary scanner, for custom parsing. |
| `type ScanResult` | -- | 1.0.0 | Stable | `{ index: number; isFinal: boolean }`. |
| `MemoryStorage` | `class implements StorageStrategy` | 1.0.0 | Stable | Buffers file bytes into a `Uint8Array`. |
| `DiskStorage` | `class implements StorageStrategy` | 1.0.0 | Stable | Streams file bytes to the filesystem (Node/Bun/Deno only). |
| `type DiskStorageOptions` | -- | 1.0.0 | Stable | `{ dest: string; filename?: (info: FileInfo) => string }`. |
| `MultipartError` | `class` | 1.0.0 | Stable | Thrown on any parse/limit/security failure; carries `status` and `code`. |
| `type FileInfo` / `MultipartErrorCode` / `MultipartField` / `MultipartLimits` / `MultipartOptions` / `MultipartState` / `StorageResult` / `StorageStrategy` / `UploadedFile` | -- | 1.0.0 | Stable | Public option and data contracts. |

## Options

Every default below is read directly from `src/constants.ts` and each module's destructuring defaults.

**`multipart(options?)` / `parseMultipart(body, boundary, options?)`**

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ----------- |
| `storage` | `StorageStrategy` | No | `new MemoryStorage()` | No | Where uploaded file bytes end up. |
| `limits` | `MultipartLimits` | No | see below | Yes | Size/count ceilings for the whole request. |
| `allowedTypes` | `string[]` | No | `undefined` (all types accepted) | Yes | MIME allowlist; supports `type/*` wildcards. |
| `filename` | `(info: FileInfo) => string` | No | `undefined` | No | Custom filename generator (used by `DiskStorage` if not overridden there). |
| `abortOnError` | `boolean` | No | `true` | Yes | `true`: throw on the first limit/type/name violation. `false`: skip the offending part (or mark a file `truncated: true`) and continue. |

**`limits` (`MultipartLimits`)**

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ----------- |
| `maxFileSize` | `number \| string` | No | `'5mb'` (5,242,880 bytes) | Yes | Per-file size ceiling; a part over this is either rejected or truncated (see `abortOnError`). |
| `maxFiles` | `number` | No | `10` | Yes | Maximum file parts per request. |
| `maxFields` | `number` | No | `50` | Yes | Maximum non-file field parts per request. |
| `maxParts` | `number` | No | `100` | Yes | Maximum total parts (files + fields) per request. |
| `maxFieldNameSize` | `number` | No | `200` (bytes) | Yes | Maximum field-name length. |
| `maxFieldSize` | `number \| string` | No | `'1mb'` (1,048,576 bytes) | Yes | Maximum non-file field value size; always rejects (not truncated) when exceeded. |
| `maxHeaderPairs` | `number` | No | `2000` | Yes | Maximum header lines parsed per part; excess lines are silently ignored, not rejected. |
| `maxBodySize` | `number \| string` | No | `'10mb'` (10,485,760 bytes) | Yes | Ceiling on the *entire* request body, enforced while it is being read off the stream. |

**`DiskStorage` constructor options (`DiskStorageOptions`)**

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ----------- |
| `dest` | `string` | Yes | -- | Yes | Destination directory; created (recursively) on first write if missing. |
| `filename` | `(info: FileInfo) => string` | No | UUID + sanitized name (`${crypto.randomUUID()}-${info.sanitizedName}`) | No | Overrides the on-disk filename. |

### Size limits

`maxFileSize`, `maxFieldSize`, and `maxBodySize` accept a byte count or a human-readable string
(`parseLimit()` in `src/utils/limit.ts`, the same pattern as `@nextrush/body-parser`):

```ts
app.use(multipart({ limits: { maxFileSize: 5242880 } }));  // equivalent
app.use(multipart({ limits: { maxFileSize: '5mb' } }));    // equivalent
```

**What happens when a limit is exceeded** depends on which limit and `abortOnError`:
- **`maxBodySize`** -- always throws `MultipartError` (`BODY_SIZE_EXCEEDED`, 413) the moment the running total crosses the ceiling while the stream is still being read; `abortOnError` has no effect on this check.
- **`maxFileSize`** -- with `abortOnError: true` (default), throws `FILE_TOO_LARGE` (413) and cleans up any files already stored for this request; with `abortOnError: false`, the file is kept with its bytes cut off at the limit and `truncated: true`.
- **`maxFiles` / `maxFields` / `maxParts`** -- with `abortOnError: true`, throws the matching `*_LIMIT_EXCEEDED` error (413); with `abortOnError: false`, the offending part is skipped and parsing continues.
- **`maxFieldSize`** -- always throws `PARSE_ERROR`-coded via `Errors.parseError` (400), regardless of `abortOnError` -- there is no truncation path for over-limit field values.

## Performance

Multipart parsing sits on the request hot path for upload endpoints, so the parser is built
around one primitive: bounded, single-pass, in-memory boundary scanning.

- **The whole body is collected before parsing starts.** `streamToUint8Array()` (`src/parser.ts`) reads the `ReadableStream` into one contiguous `Uint8Array`, checking the running total against `maxBodySize` on every chunk and throwing `BODY_SIZE_EXCEEDED` the moment it's crossed -- an oversized upload never reaches the boundary scanner.
- **Boundary search is Boyer-Moore-Horspool, not linear, for the repeated case.** `BoundaryScanner` (`src/scanner.ts`) precomputes a 256-entry skip table once per parse call and reuses it for every part boundary in the body; only the very first boundary and each part's header terminator (`\r\n\r\n`) use the simpler linear `findBytes()`, since those each run once (or a bounded few times) per part rather than being the repeated hot loop.
- **A file's bytes are wrapped, not re-read, before storage.** `uint8ArrayToReadableStream()` creates a single-chunk `ReadableStream` over the already-in-memory `Uint8Array` slice for that part -- `storage.handle()` sees a stream interface for API consistency with a true network stream, but reads no additional bytes off any socket.
- **`DiskStorage` streams to the filesystem, not through a second in-memory copy.** `Readable.fromWeb()` + `pipeline()` pipe the wrapped stream directly into `createWriteStream()`; the file's bytes are held once (in the `Uint8Array` from the initial body collection) plus whatever Node's own stream buffering does internally.

> [!IMPORTANT]
> "Streaming" here describes how a file's bytes move from the already-collected body buffer into
> storage -- it does not mean the parser processes the request body without fully buffering it
> first. `maxBodySize` (default `10mb`) is the real ceiling on peak memory use per request, not
> `maxFileSize` alone.

> Numbers move with hardware and load -- run `pnpm bench:compare --profile standard` (pinned) in `apps/benchmark` on your own machine.

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | 3.x |
| Node.js | >=22 |
| TypeScript | >=5.x |

**Runtimes**

| Runtime | Parsing + `MemoryStorage` | `DiskStorage` | Notes |
| ------- | :---: | :---: | ----- |
| Node.js >=22 | Yes | Yes | ESM-only |
| Bun | Yes | Yes | `DiskStorage` uses `node:fs`/`node:path`/`node:stream`, available under Bun's Node compatibility layer |
| Deno | Yes | Yes | Same Node-compatibility caveat as Bun |
| Edge | Yes | No | `DiskStorage` imports `node:fs`, `node:path`, and `node:stream` directly -- there is no Edge-safe fallback; use `MemoryStorage` or a custom `StorageStrategy` |

**Integration**
- **Peer dependencies:** none -- depends only on `@nextrush/types` (types, erased at build).
- **Works with:** any NextRush middleware chain; register before route handlers so `ctx.state.files`/`ctx.state.fields` are populated when they run.
- **Incompatible with:** none directly, but registering `multipart()` after a body parser that has already consumed the body (`ctx.bodySource.consumed`) leaves multipart with nothing to read.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node >=22, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong>Uploads over a certain size all fail with 413, even below `maxFileSize`</strong></summary>

**Cause:** the *total* request body -- all files and fields combined -- crossed `maxBodySize`
(default `10mb`), which is checked independently of any per-file limit while the body is being
read. **Fix:** raise `maxBodySize` to accommodate the combined size of everything the client may
send in one request.

```ts
app.use(multipart({ limits: { maxBodySize: '100mb', maxFileSize: '20mb' } }));
```

</details>

<details>
<summary><strong>`ctx.state.files` is empty even though the client sent files</strong></summary>

**Cause:** the request method was in `BODYLESS_METHODS` (`GET`, `HEAD`, `DELETE`, `OPTIONS`), or
the `Content-Type` header didn't start with `multipart/form-data`, or a prior middleware already
consumed `ctx.bodySource`. **Fix:** confirm the client sends a `POST`/`PUT`/`PATCH` with the
correct `Content-Type` including a `boundary=` parameter, and that no earlier middleware read the
body first.

</details>

<details>
<summary><strong>An upload throws `INVALID_FIELD_NAME` for a field that looks harmless</strong></summary>

**Cause:** this is the enforced prototype-pollution guard -- any field or file name equal to
`__proto__`, `constructor`, or `prototype` is rejected outright, by design. **Fix:** rename the
form field; there is no opt-out, because disabling this check would reopen a prototype-pollution
vector.

</details>

<details>
<summary><strong>`DiskStorage` throws `Path traversal detected in generated filename`</strong></summary>

**Cause:** the filename returned by your custom `filename` callback (or `DiskStorage`'s default
generator) resolved to a path outside the configured `dest` directory. **Fix:** don't build the
returned filename from unsanitized input containing `../` segments -- use the sanitized name
NextRush already computed (`info.sanitizedName`) as your callback's base, or omit `filename`
entirely to use the built-in UUID-prefixed default.

</details>

## FAQ

**Does `@nextrush/multipart` stream file uploads without buffering them?**
No. The full request body is collected into one in-memory `Uint8Array` (bounded by
`maxBodySize`) before any part is parsed. "Streaming" in this package's API refers to how a
file's already-buffered bytes move into a `StorageStrategy` (e.g. piped to disk), not to
processing the incoming network stream without buffering it first.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
Parsing and `MemoryStorage` work on every runtime -- the parser, scanner, and middleware import
no Node built-ins. `DiskStorage` requires `node:fs`/`node:path`/`node:stream` and does not run on
Edge; use `MemoryStorage` or a custom `StorageStrategy` there.

**Can I write my own storage backend (e.g. S3)?**
Yes -- implement `StorageStrategy`: an async `handle(stream, info)` that returns a `StorageResult`,
and optionally `remove(result)` for cleanup on error. `multipart({ storage: new MyStorage() })`
accepts anything satisfying the interface.

---

## Package relationships

```text
                       depends on           @nextrush/types  (Middleware contract, types only)
@nextrush/multipart -------------->
                       often used with      @nextrush/validation  (validate ctx.state.fields after parsing)
                       usually used after   @nextrush/body-parser  (JSON/form/text bodies this package doesn't handle)
```

- **Depends on:** [`@nextrush/types`](../../types) -- the `Middleware`/`Context` type contracts (types only, erased at build).
- **Often used with:** [`@nextrush/validation`](../validation) -- validate the shape of `ctx.state.fields` once parsed.
- **Usually used alongside:** [`@nextrush/body-parser`](../body-parser) -- for the JSON/URL-encoded/text/raw traffic this package's `multipart()` doesn't parse (it only matches `multipart/form-data`).
- **Alternative:** a custom `StorageStrategy` when you need object storage (S3, GCS, etc.) instead of memory or disk.

## Architecture

Maintaining or contributing to this package? The internal design -- the boundary-scan/parse
pipeline, the collect-then-store sequence, the module layout, and the decisions and trade-offs
behind them (with diagrams) -- is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) . [Architecture](./ARCHITECTURE.md) . [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
