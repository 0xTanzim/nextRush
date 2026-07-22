# @nextrush/adapter-bun

> Bun HTTP adapter for NextRush -- connects an Application to Bun.serve() with graceful shutdown and NextRush's shared Web-standard Context.

[![npm version](https://img.shields.io/npm/v/@nextrush/adapter-bun.svg)](https://www.npmjs.com/package/@nextrush/adapter-bun)
[![downloads](https://img.shields.io/npm/dm/@nextrush/adapter-bun.svg)](https://www.npmjs.com/package/@nextrush/adapter-bun)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/adapter-bun.svg)](https://bundlephobia.com/package/@nextrush/adapter-bun)
[![types](https://img.shields.io/npm/types/@nextrush/adapter-bun.svg)](https://www.npmjs.com/package/@nextrush/adapter-bun)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/adapter-bun.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Run a NextRush `Application` on Bun via `Bun.serve()` |
| **Package type** | Adapter |
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install, chosen per deployment target |
| **Support tier** | Public -- stable (sealed public API) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Bun only (this adapter) -- part of the universal Node / Bun / Deno / Edge family |
| **Requires** | Bun `>=1.0.0` -- ESM-only -- TypeScript `>=5.x` |
| **Introduced** | `v1.0.0` |

## Highlights

- Zero extra runtime dependencies beyond NextRush's own `core`/`errors`/`runtime`/`stream`/`types` packages
- ESM-only, tree-shakable, side-effect-free
- Fully typed -- strict TypeScript, zero `any`
- Server-level request body cap set to 1 MB by default -- overrides Bun's native 128 MB default, matching `@nextrush/body-parser`'s own JSON default

## Installation

```bash
bun add @nextrush/adapter-bun @nextrush/core
# npm i @nextrush/adapter-bun @nextrush/core (if managing the project with npm/pnpm, still run with bun)
```

> [!NOTE]
> This adapter is not included in the `nextrush` meta package. Install it directly when your
> deployment target is Bun; pick a different `@nextrush/adapter-*` package for another runtime.

## Quick start

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-bun';

const app = createApp();

app.use(async (ctx) => {
  ctx.json({ message: 'Hello from Bun!' });
});

await serve(app, {
  port: 8080,
  onListen: ({ port }) => console.log(`Server running on port ${port}`),
});
```

`serve()` boots the app's extensions (`app.ready()`), starts `Bun.serve()`, and returns a
`ServerInstance` with `close()`/`reload()`/`address()`.

## Capabilities

**Capabilities**
- **`serve(app, options)`** -- starts a Bun HTTP server bound to the app
- **`createHandler(app, options)`** -- a bare `(request, server) => Promise<Response>` fetch
  handler for a hand-rolled `Bun.serve()` call
- **`listen(app, port)`** -- `serve()` shorthand with a console-logged startup message
- **Graceful shutdown** -- opt-in `SIGTERM`/`SIGINT` wiring to the same connection-drain `close()`
- **TLS** -- `cert`/`key`/`ca` passed straight through to `Bun.serve()`

**Performance**
- Bun's own request/response path avoids Node's `http` module overhead; the adapter adds a
  thin context-creation and timeout-race layer on top, not a second HTTP implementation

**Developer experience**
- Same `serve(app, options)` / `listen(app, port)` shape as `@nextrush/adapter-node`,
  `@nextrush/adapter-deno`, and `@nextrush/adapter-edge` -- only the import changes

## Mental model

```text
Bun.serve() ---> trackedHandler ---> BunContext ---> your middleware/routes
                      |
                      +-- in-flight request count (for graceful drain)
```

**Rule:** the adapter never re-implements HTTP -- it wraps one `fetch(request, server)` handler
around `Bun.serve()` and hands your app a `BunContext` built on the shared Web-standard base used
by every non-Node adapter.

> [!TIP]
> The full request lifecycle and shutdown sequence (Mermaid) are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Common tasks

### Start a server

```typescript
import { serve } from '@nextrush/adapter-bun';

const server = await serve(app, { port: 8080 });
console.log(`Listening on ${server.host}:${server.port}`);
```

### Wire graceful shutdown to OS signals

```typescript
const server = await serve(app, {
  port: 8080,
  gracefulShutdown: true, // installs SIGTERM + SIGINT handlers
});

// Or override the signal set / drain timeout:
const server2 = await serve(app, {
  port: 8080,
  gracefulShutdown: { signals: ['SIGTERM'], timeout: 5_000 },
});
```

Omitting `gracefulShutdown` installs no signal handler -- process behavior is unchanged.
`close()` (called manually or via a signal) always stops accepting new connections, drains
in-flight requests up to `shutdownTimeout`, then tears down the app's extensions.

### Use a custom `Bun.serve()` setup

```typescript
import { createHandler } from '@nextrush/adapter-bun';

const handler = createHandler(app, { timeout: 10_000 });

Bun.serve({
  port: 8080,
  fetch: handler,
});
```

### Enable TLS

```typescript
await serve(app, {
  port: 443,
  tls: {
    cert: Bun.file('./cert.pem'),
    key: Bun.file('./key.pem'),
  },
});
```

## API overview

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `serve` | `(app: Application, options?: ServeOptions) => Promise<ServerInstance>` | `1.0.0` | Stable | Starts `Bun.serve()` bound to the app |
| `createHandler` | `(app: Application, options?: HandlerOptions) => BunFetchHandler` | `1.0.0` | Stable | Bare fetch handler for a custom `Bun.serve()` call |
| `listen` | `(app: Application, port?: number) => Promise<ServerInstance>` | `1.0.0` | Stable | `serve()` shorthand with a startup log line |
| `BunContext` | `class` | `1.0.0` | Stable | Bun-specific `Context` implementation |
| `createBunContext` | `(request: Request, clientIp?: string, trustProxy?: boolean) => BunContext` | `1.0.0` | Stable | Constructs a `BunContext` |
| `EmptyBodySource` / `createEmptyBodySource` | -- | `1.0.0` | Stable | Body source for bodyless requests, re-exported from `@nextrush/runtime` |
| `BodyConsumedError` / `BodyTooLargeError` | -- | `1.0.0` | Stable | Shared body-reading errors, re-exported from `@nextrush/runtime` |
| `getContentType` / `getContentLength` | `(headers: Headers) => string \| undefined` / `(headers: Headers) => number \| undefined` | `1.0.0` | Deprecated | Unused internally since body-parser owns content-type/length handling; kept for backward compatibility |
| `type ServeOptions` | -- | `1.0.0` | Stable | `serve()` options |
| `type ServerInstance` | -- | `1.0.0` | Stable | Return value of `serve()`/`listen()` |
| `type GracefulShutdownOptions` | -- | `1.0.0` | Stable | Shape of `ServeOptions.gracefulShutdown` when not a plain boolean |

## Options

`ServeOptions` (passed to `serve()`):

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------ | ----------- |
| `port` | `number` | No | `8080` | -- | Port to listen on |
| `host` | `string` | No | `'0.0.0.0'` | Warning | Host to bind to -- canonical option; use with care in shared/multi-tenant environments |
| `onListen` | `(info: { port; host; hostname }) => void` | No | -- | -- | Called once the server is listening |
| `onError` | `(error: Error) => void` | No | logs via `app.logger` | -- | Called on an uncaught request error |
| `tls` | `{ cert; key; ca? }` | No | -- | Warning | Enables HTTPS |
| `maxRequestBodySize` | `number` | No | `1048576` (1 MB) | Warning | Server-level request body cap in bytes -- overrides Bun's native 128 MB default; matches `@nextrush/adapter-node`'s effective 1 MB default |
| `timeout` | `number` | No | `30000` (30 s) | -- | Per-request timeout; returns `504` on expiry |
| `development` | `boolean` | No | `false` | -- | Enables Bun's development-mode features |
| `shutdownTimeout` | `number` | No | `30000` (30 s) | -- | Drain grace period before force-closing connections |
| `logger` | `Logger` | No | `app.logger` | -- | Logger for adapter diagnostics |
| `gracefulShutdown` | `boolean \| GracefulShutdownOptions` | No | `undefined` (no signal handler) | -- | Wires `SIGTERM`/`SIGINT` to `close()` |

## Performance

Bun's own HTTP implementation avoids the syscall overhead of Node's `http` module; this adapter
adds one context-creation call and a `Promise.race`-based timeout per request on top. See
`apps/benchmark` for cross-runtime comparisons run on your own hardware.

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | `3.x` |
| Bun | `>=1.0.0` |
| TypeScript | `>=5.x` |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Bun `>=1.0.0` | Yes | This package |
| Node.js / Deno / Edge | Yes | Via `@nextrush/adapter-node` / `@nextrush/adapter-deno` / `@nextrush/adapter-edge` -- pinned by the internal conformance suite |

**Integration**
- **Peer dependencies:** none (depends directly on `@nextrush/core`, `@nextrush/errors`, `@nextrush/runtime`, `@nextrush/stream`, `@nextrush/types`)
- **Works with:** `@nextrush/body-parser` for body parsing beyond the raw `bodySource`/`WebBodySource` access `BunContext` exposes
- **Incompatible with:** other `@nextrush/adapter-*` packages in the same process (only one adapter binds a server per app)

> [!IMPORTANT]
> NextRush is ESM-only, permanently -- no CommonJS build. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

## Troubleshooting

<details>
<summary><strong>Request body silently truncated or rejected as too large</strong></summary>

**Cause:** `maxRequestBodySize` defaults to 1 MB, well below Bun's own 128 MB default -- this is
deliberate, matching `@nextrush/body-parser`'s JSON default so both layers agree on the limit.
**Fix:** raise `maxRequestBodySize` for the routes that need larger payloads.

```typescript
await serve(app, { maxRequestBodySize: 50 * 1024 * 1024 }); // 50 MB
```

</details>

<details>
<summary><strong>`EADDRINUSE` or another bind failure on startup</strong></summary>

**Cause:** another process already holds `port`/`host`, or the host/port combination is invalid.
**Fix:** `serve()` normalizes the underlying `Bun.serve()` error into the same typed startup
error every NextRush adapter throws -- catch it and inspect `error.code`.

</details>

## FAQ

**Can I use this without `nextrush`?**
Yes -- install `@nextrush/adapter-bun` alongside `@nextrush/core` directly; the meta package is
not required.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun's hot reload?**
Yes -- `bun --hot run server.ts` reloads the module graph as usual; `server.reload(options)`
also updates non-structural `Bun.serve()` options (like `development`) on an existing server.

**Is `ctx.bodySource` the same shape as the Node adapter's?**
`BunContext` is built on the shared `WebContextBase`/`WebBodySource` from `@nextrush/runtime`,
the same base every non-Node adapter (Bun, Deno, Edge) uses -- body-reading behavior is
identical across those three by construction, not by convention.

## Package relationships

```text
                 depends on            @nextrush/core, @nextrush/errors,
@nextrush/adapter-bun ----------->     @nextrush/runtime, @nextrush/stream,
                                        @nextrush/types
                 often used with       @nextrush/body-parser
                 usually used next     @nextrush/router
```

- **Depends on:** [`@nextrush/core`](../../../core), [`@nextrush/runtime`](../../../runtime) -- application lifecycle and the shared Web-adapter context base
- **Often used with:** [`@nextrush/body-parser`](../../../middleware/body-parser) -- parses `ctx.body` beyond the raw body source
- **Usually used next:** [`@nextrush/router`](../../../router) -- most apps mount routes before calling `serve()`
- **Alternative:** [`@nextrush/adapter-node`](../node), [`@nextrush/adapter-deno`](../deno), [`@nextrush/adapter-edge`](../edge) -- same DX for a different runtime

## Architecture

Maintaining or contributing to this package? The internal design -- module layout, request
lifecycle, shutdown sequence, invariants, and trade-offs (with diagrams) -- is in
**[`ARCHITECTURE.md`](./ARCHITECTURE.md)**.

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) -- [Architecture](./ARCHITECTURE.md) -- [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
