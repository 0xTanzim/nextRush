# @nextrush/adapter-deno

> Deno HTTP adapter for NextRush -- connects a NextRush Application to Deno's native `Deno.serve()`.

[![npm version](https://img.shields.io/npm/v/@nextrush/adapter-deno.svg)](https://www.npmjs.com/package/@nextrush/adapter-deno)
[![downloads](https://img.shields.io/npm/dm/@nextrush/adapter-deno.svg)](https://www.npmjs.com/package/@nextrush/adapter-deno)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/adapter-deno.svg)](https://bundlephobia.com/package/@nextrush/adapter-deno)
[![types](https://img.shields.io/npm/types/@nextrush/adapter-deno.svg)](https://www.npmjs.com/package/@nextrush/adapter-deno)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/adapter-deno.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Runs a NextRush `Application` on Deno by calling `Deno.serve()` directly |
| **Package type** | Adapter |
| **Status** | Stable (v1.0.0) |
| **Included in `nextrush`?** | No -- standalone install, imported by its own package name |
| **Support tier** | Public -- stable, semver-guarded. See [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Deno only |
| **Requires** | Deno >= 2.0, NextRush core >= 3.0.0, ESM-only |
| **Introduced** | v1.0.0 |

## Highlights

- Calls `Deno.serve()` directly -- no compatibility shim, no polyfilled HTTP server
- Shares its Context and body-reading logic with the Bun and Edge adapters via `@nextrush/runtime`'s `WebContextBase`, so observable behavior matches across the Web-standard adapters
- Zero-config graceful shutdown: `close()` always drains in-flight requests before tearing down extensions; `gracefulShutdown` opts into wiring `SIGTERM`/`SIGINT` to that same drain
- Fully typed -- strict TypeScript, zero `any`

## Installation

```bash
pnpm add @nextrush/adapter-deno @nextrush/core
# npm i @nextrush/adapter-deno @nextrush/core
```

Or via an import map in `deno.json`:

```json
{
  "imports": {
    "@nextrush/core": "npm:@nextrush/core",
    "@nextrush/adapter-deno": "npm:@nextrush/adapter-deno"
  }
}
```

> [!NOTE]
> This package is standalone -- it is not re-exported by the `nextrush` meta package. Install it
> directly when your target runtime is Deno.

## Quick start

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-deno';

const app = createApp();

app.use(async (ctx) => {
  ctx.json({ message: 'Hello from Deno!' });
});

await serve(app, {
  port: 8080,
  onListen: ({ port }) => console.log(`Server running on port ${port}`),
});
```

```bash
deno run --allow-net server.ts
```

`serve()` awaits `app.ready()` internally (booting any registered extensions) before calling
`Deno.serve()`, so the returned promise only resolves once the app is actually accepting traffic.

## Capabilities

**Capabilities**
- **`serve(app, options)`** -- starts a `Deno.serve()`-backed server and returns a `ServerInstance`
- **`listen(app, port?)`** -- `serve()` shorthand that logs a startup line to `app.logger`
- **`createHandler(app, options?)`** -- returns a raw `(Request, DenoServeHandlerInfo) => Promise<Response>` handler for a hand-rolled `Deno.serve()` call (e.g. on Deno Deploy)
- **Graceful shutdown** -- `close()` aborts new connections, races `server.shutdown()` against `shutdownTimeout`, then calls `app.close()`; `gracefulShutdown: true` (or an options object) wires `SIGTERM`/`SIGINT` to the same path

**Developer experience**
- Same `serve(app, options)` / `listen(app, port)` / `createHandler(app)` shape as `@nextrush/adapter-node` and `@nextrush/adapter-bun` -- switching runtimes is an import change, not a rewrite
- Per-request timeout (`ServeOptions.timeout`, default 30s) returns a `504` via `Promise.race` -- Deno's `Deno.serve()` has no built-in per-request timeout

## Mental model

```text
Deno.serve() --> createHandler(app) --> DenoContext --> app middleware/routes --> ctx.getResponse()
```

**Rule:** this package does not implement its own HTTP parsing, body reading, or response
building -- those live once in `@nextrush/runtime`'s `WebContextBase`/`WebBodySource`/
`WebResponseBuilder`, shared with the Bun and Edge adapters. `DenoContext` supplies only what is
genuinely Deno-specific: resolving the client IP from `Deno.serve()`'s per-request `remoteAddr`.

> [!TIP]
> The full request lifecycle (with diagrams) is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Common tasks

### Start a server

```typescript
import { serve } from '@nextrush/adapter-deno';

const server = await serve(app, {
  port: 8080,
  host: '0.0.0.0',
  onListen: ({ port, host }) => console.log(`Listening on ${host}:${port}`),
  onError: (error) => console.error('Server error:', error),
});

console.log(`Running on port ${server.port}`);
await server.close();
await server.finished;
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

Omitting `gracefulShutdown` installs no signal handler -- process behavior is unchanged. The
handler is removed once shutdown completes, so repeated `serve()`/`close()` cycles never
accumulate duplicate listeners.

### Use a custom `Deno.serve()` call (Deno Deploy)

```typescript
import { createHandler } from '@nextrush/adapter-deno';

const handler = createHandler(app);

Deno.serve({ port: 8080, handler });
```

### Serve over TLS

```typescript
const cert = await Deno.readTextFile('./cert.pem');
const key = await Deno.readTextFile('./key.pem');

await serve(app, { port: 443, cert, key });
```

## API overview

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `serve` | `(app: Application, options?: ServeOptions) => Promise<ServerInstance>` | `1.0.0` | Stable | Starts a `Deno.serve()`-backed server |
| `listen` | `(app: Application, port?: number) => Promise<ServerInstance>` | `1.0.0` | Stable | `serve()` shorthand with a logged startup line |
| `createHandler` | `(app: Application, options?: HandlerOptions) => (req: Request, info: DenoServeHandlerInfo) => Promise<Response>` | `1.0.0` | Stable | Raw fetch-style handler for a custom `Deno.serve()` call |
| `DenoContext` | class | `1.0.0` | Stable | Deno-specific `Context` implementation, extends `WebContextBase` |
| `createDenoContext` | `(request: Request, connInfo?, trustProxy?) => DenoContext` | `1.0.0` | Stable | Factory used internally by `createHandler` |
| `type ServeOptions` | -- | `1.0.0` | Stable | Options accepted by `serve()`/`listen()` |
| `type ServerInstance` | -- | `1.0.0` | Stable | Return type of `serve()`/`listen()` |
| `type GracefulShutdownOptions` | -- | `1.0.0` | Stable | Explicit override shape for `ServeOptions.gracefulShutdown` |

## Options

`ServeOptions` (passed to `serve()`/`listen()`):

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ----------- |
| `port` | `number` | No | `8080` | -- | Port to listen on |
| `host` | `string` | No | `'0.0.0.0'` | Yes | Bind address; canonical name (wins over the deprecated `hostname` alias documented in code comments only) |
| `onListen` | `(info) => void` | No | -- | -- | Called once the server is accepting connections |
| `onError` | `(error: Error) => void` | No | Logs via `app.logger.error` | -- | Called on uncaught request errors |
| `cert` / `key` | `string` | No | -- | Yes | PEM-encoded TLS certificate/key for HTTPS |
| `shutdownTimeout` | `number` (ms) | No | `30000` | -- | Drain timeout guarding `server.shutdown()`, which has no built-in timeout |
| `timeout` | `number` (ms) | No | `30000` | -- | Per-request handler timeout; `0` disables it |
| `logger` | `Logger` | No | `app.logger` | -- | Logger used for adapter diagnostics |
| `gracefulShutdown` | `boolean \| GracefulShutdownOptions` | No | `undefined` (no signal handler installed) | -- | Wires `SIGTERM`/`SIGINT` to the same drain `close()` uses |

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush core | `>=3.0.0` |
| Deno | `>=2.0` |
| TypeScript | `>=5.x` |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Deno `>=2.0` | Yes | Calls `Deno.serve()` directly; verified against Deno 1.46/2.x per the adapter's own ambient type declarations |
| Node.js / Bun / Edge | No | Use `@nextrush/adapter-node` / `@nextrush/adapter-bun` / `@nextrush/adapter-edge` |

**Integration**
- **Peer dependencies:** none -- `@nextrush/core`, `@nextrush/errors`, `@nextrush/runtime`, `@nextrush/stream`, and `@nextrush/types` are regular dependencies
- **Works with:** any NextRush middleware (`@nextrush/body-parser`, `@nextrush/cors`, etc.) -- the adapter only supplies the transport layer
- **Incompatible with:** none

> [!IMPORTANT]
> NextRush is ESM-only, permanently -- no CommonJS build. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

## Troubleshooting

<details>
<summary><strong>Deno process exits with a permission error</strong></summary>

**Cause:** Deno requires explicit permission flags. **Fix:** run with `--allow-net` at minimum;
add `--allow-read` for file access (TLS certs, static assets) and `--allow-env` if reading
environment variables.

```bash
deno run --allow-net --allow-read --allow-env server.ts
```

</details>

<details>
<summary><strong>Requests hang past 30 seconds with no response</strong></summary>

**Cause:** `Deno.serve()` has no built-in per-request timeout; a stalled handler runs
indefinitely by default. **Fix:** this adapter already applies a 30s timeout via
`ServeOptions.timeout`, returning a `504` on expiry -- tune or disable (`timeout: 0`) it
explicitly if your handlers legitimately need longer.

</details>

## FAQ

**Does this use a compatibility shim over Node's `http` module?**
No. `serve()` and `createHandler()` call `Deno.serve()` directly (see `src/adapter.ts`); there
is no Node-compat HTTP layer involved.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Can I use `createHandler` with Deno Deploy?**
Yes -- `createHandler(app)` returns a plain `(Request, info) => Promise<Response>` function that
you pass directly to `Deno.serve({ handler })`, which is exactly Deno Deploy's expected shape.

**Does `ctx.runtime` report `'deno'`?**
Yes -- `DenoContext` calls `@nextrush/runtime`'s `getRuntime()`, which detects the Deno global
and reports `'deno'`.

## Package relationships

```text
                 depends on            @nextrush/core, @nextrush/runtime, @nextrush/errors,
@nextrush/adapter-deno --------------> @nextrush/stream, @nextrush/types
                 often used with       @nextrush/body-parser, @nextrush/cors, @nextrush/router
                 usually used next     @nextrush/static, @nextrush/template (for full apps)
```

- **Depends on:** [`@nextrush/runtime`](../../../packages/runtime) for `WebContextBase`,
  `WebBodySource`, shutdown/timeout constants, and startup-error normalization
- **Often used with:** [`@nextrush/body-parser`](../../../packages/middleware/body-parser),
  [`@nextrush/cors`](../../../packages/middleware/cors)
- **Alternative:** [`@nextrush/adapter-bun`](../bun) or
  [`@nextrush/adapter-node`](../node) if targeting Bun or Node.js instead of Deno

## Architecture

Maintaining or contributing to this package? The internal design -- shared Web-adapter base,
request lifecycle, shutdown sequencing -- is in **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**.

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) --
  [Architecture](./ARCHITECTURE.md) -- [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
