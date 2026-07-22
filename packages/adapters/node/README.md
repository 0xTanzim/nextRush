# @nextrush/adapter-node

> Node.js HTTP adapter for NextRush -- connects an Application to Node's built-in http.createServer.

[![npm version](https://img.shields.io/npm/v/@nextrush/adapter-node.svg)](https://www.npmjs.com/package/@nextrush/adapter-node)
[![downloads](https://img.shields.io/npm/dm/@nextrush/adapter-node.svg)](https://www.npmjs.com/package/@nextrush/adapter-node)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/adapter-node.svg)](https://bundlephobia.com/package/@nextrush/adapter-node)
[![types](https://img.shields.io/npm/types/@nextrush/adapter-node.svg)](https://www.npmjs.com/package/@nextrush/adapter-node)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/adapter-node.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Run a NextRush `Application` on Node's built-in `http` module |
| **Package type** | Adapter |
| **Status** | Stable |
| **Included in `nextrush`?** | Yes -- `nextrush`'s `createApp`/`listen` use this adapter on Node |
| **Support tier** | Public -- core (stable, semver-guarded) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Node.js only (see `@nextrush/adapter-bun`/`-deno`/`-edge`/`-serverless` for other runtimes) |
| **Requires** | Node `>=22` -- ESM-only -- TypeScript `>=5.x` |
| **Introduced** | `v3.1.0` (Extension Model rewrite) |

## Highlights

- Zero extra runtime dependencies beyond the NextRush core packages it wraps (`@nextrush/core`, `@nextrush/errors`, `@nextrush/runtime`, `@nextrush/stream`, `@nextrush/types`)
- ESM-only, tree-shakable, side-effect-free
- Fully typed -- strict TypeScript, zero `any`
- Opt-in graceful shutdown wired to `SIGTERM`/`SIGINT`, and a handler-level request timeout that returns a clean `504` instead of hanging a socket

## When to use

**Use `@nextrush/adapter-node` if:**

- You are running a NextRush app on Node.js (the common case -- this is what `nextrush`'s `createApp`/`listen` use by default)
- You need `serve()`'s full option surface: custom timeouts, graceful shutdown, a logger override, or a raw `(req, res)` handler for HTTPS/HTTP2/test harnesses

**Reach for something else if:**

- You are deploying to Bun -- use [`@nextrush/adapter-bun`](../bun)
- You are deploying to Deno -- use [`@nextrush/adapter-deno`](../deno)
- You are deploying to Cloudflare Workers or Vercel Edge -- use [`@nextrush/adapter-edge`](../edge)
- You are deploying to AWS Lambda or another FaaS runtime -- use [`@nextrush/adapter-serverless`](../serverless)

## Installation

```bash
pnpm add @nextrush/adapter-node @nextrush/core
# npm i @nextrush/adapter-node @nextrush/core
# yarn add @nextrush/adapter-node @nextrush/core
# bun add @nextrush/adapter-node @nextrush/core
```

> [!NOTE]
> Already using `nextrush`? The meta package's `createApp`/`listen` already wire this adapter
> on Node -- install `@nextrush/adapter-node` directly only if you need `serve()`'s full option
> surface or `createHandler()` for a custom server.

## Quick start

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';

const app = createApp();

app.use(async (ctx) => {
  ctx.json({ message: 'Hello from Node.js!' });
});

const server = await serve(app, {
  port: 8080,
  onListen: ({ port }) => console.log(`Listening on port ${port}`),
});
```

`serve()` awaits `app.ready()` (booting any registered extensions) before it starts accepting
connections, then returns a `ServerInstance` you can later `close()` for a graceful shutdown.

## Capabilities

**Capabilities**
- **`serve(app, options?)`** -- full-control server start: port/host binding, timeouts, graceful shutdown, error/listen callbacks
- **`listen(app, port?)`** -- one-line shorthand over `serve()` that logs a startup message
- **`createHandler(app, options?)`** -- a raw `(req, res)` handler for HTTPS, HTTP/2, or test harnesses that bring their own `http.Server`

**Developer experience**
- Fully typed `ServeOptions`/`ServerInstance`/`GracefulShutdownOptions`
- Every response is guaranteed a `Content-Type` and an explicit status, even on an unhandled resolve or a timeout

## Mental model

```text
request ---> http.Server ---> wrapped (req, res) handler ---> app.callback()(ctx) ---> response
                                     |
                                     +-- races against ServeOptions.timeout; on expiry, cancels
                                         the handler via ctx.signal and replies 504
```

**Rule:** `serve()` owns the Node `http.Server` lifecycle (listen, timeouts, shutdown);
`createHandler()` owns only the per-request `(req, res) -> response` translation and can be
reused with any Node-compatible server.

> [!TIP]
> The full request-handling sequence and the graceful-shutdown state machine are in
> [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Common tasks

### Start a server with defaults

```typescript
import { listen } from '@nextrush/adapter-node';

await listen(app, 8080);
// Output: NextRush listening on http://localhost:8080
```

### Enable signal-wired graceful shutdown

```typescript
const server = await serve(app, {
  port: 8080,
  gracefulShutdown: true, // installs SIGTERM + SIGINT handlers
});
```

### Serve over HTTPS with a custom handler

```typescript
import { createHandler } from '@nextrush/adapter-node';
import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';

const handler = createHandler(app);

const server = createServer(
  {
    key: readFileSync('private-key.pem'),
    cert: readFileSync('certificate.pem'),
  },
  handler
);

server.listen(443);
```

### Read the real client IP behind a reverse proxy

```typescript
const app = createApp({ proxy: true });

app.use(async (ctx) => {
  // ctx.ip reads X-Forwarded-For only when proxy is trusted
  ctx.json({ ip: ctx.ip });
});

await serve(app, { port: 8080 });
```

## API overview

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `serve` | `(app: Application, options?: ServeOptions) => Promise<ServerInstance>` | `3.1.0` | Stable | Start an HTTP server with full configuration |
| `listen` | `(app: Application, port?: number) => Promise<ServerInstance>` | `3.1.0` | Stable | Shorthand: `serve()` plus a startup log line (default port `8080`) |
| `createHandler` | `(app: Application, options?: HandlerOptions) => (req: IncomingMessage, res: ServerResponse) => void` | `3.1.0` | Stable | Build a raw request handler for a custom `http`/`https` server |
| `createNodeContext` | `(req: IncomingMessage, res: ServerResponse, options?: NodeContextOptions) => NodeContext` | `3.1.0` | Stable | Build the Node `Context` implementation directly |
| `NodeContext` | class implementing `AdapterContext` | `3.1.0` | Stable | Node-specific `Context` -- wraps `IncomingMessage`/`ServerResponse` |
| `createNodeBodySource` / `NodeBodySource` | `BodySource` over an `IncomingMessage` stream | `3.1.0` | Stable | Body reading used by `@nextrush/body-parser` and friends |
| `createEmptyBodySource` | `() => BodySource` | `3.1.0` | Stable | A `BodySource` for methods that never carry a body (e.g. `GET`) |
| `type ServeOptions` | -- | `3.1.0` | Stable | Options accepted by `serve()` |
| `type ServerInstance` | -- | `3.1.0` | Stable | Return value of `serve()`/`listen()` |
| `type GracefulShutdownOptions` | -- | `3.1.0` | Stable | Override shape for `ServeOptions.gracefulShutdown` |
| `getContentLength` / `getContentType` | `(headers) => string \| number \| undefined` | `3.1.0` | Deprecated | Superseded by `@nextrush/body-parser`'s own header handling; kept for compatibility |

## Options

**`ServeOptions`**

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ----------- |
| `port` | `number` | No | `8080` | -- | Port to listen on |
| `host` | `string` | No | `'0.0.0.0'` | Yes | Host to bind to |
| `timeout` | `number` | No | `30000` | -- | Handler-level request timeout (ms). Races the handler and returns a clean `504`, cancelling via `ctx.signal`. Also sets the socket-level `server.timeout` as an independent slow-client guard. `0` disables the handler-level race only |
| `keepAliveTimeout` | `number` | No | `5000` | -- | Node `server.keepAliveTimeout` (ms) |
| `shutdownTimeout` | `number` | No | `30000` | -- | Graceful shutdown drain timeout (ms); force-closes remaining connections after this |
| `gracefulShutdown` | `boolean \| GracefulShutdownOptions` | No | `undefined` (no signal handler installed) | Yes | Opt-in: wire `SIGTERM`/`SIGINT` to the same connection-drain `close()` logic |
| `onListen` | `(info: { port: number; host: string; hostname: string }) => void` | No | -- | -- | Called once the server is listening |
| `onError` | `(error: Error) => void` | No | -- | -- | Called on uncaught server errors after startup; without it, errors go to `logger.error` |
| `logger` | `Logger` | No | `app.logger` | -- | Logger used for adapter diagnostics |

**`GracefulShutdownOptions`**

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ----------- |
| `signals` | `readonly NodeJS.Signals[]` | No | `['SIGTERM', 'SIGINT']` | -- | Signals that trigger the drain-and-exit sequence. `SIGKILL` is not supported -- it cannot be caught |
| `timeout` | `number` | No | falls back to `ServeOptions.shutdownTimeout` | -- | Drain timeout for the signal-triggered path specifically |

## Performance

`createHandler()`'s hot path hoists the per-server-lifetime `NodeContextOptions` object (built
once, frozen, reused across every request) rather than allocating it per request. `serve()`'s
TCP accept-queue depth (`server.listen()` backlog) is a fixed `1024`, comfortably above Node's
own default of `511`, chosen to absorb connection bursts without depending on the host's live
`net.core.somaxconn` (which varies per deployment environment). See `apps/benchmark` for
reproducible throughput numbers on your own hardware -- this package does not publish absolute
numbers here (see the root README's Performance section for why).

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | `3.x` |
| Node.js | `>=22` |
| TypeScript | `>=5.x` |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Node.js `>=22` | Yes | ESM-only; this package IS the Node runtime binding |
| Bun / Deno / Edge / Serverless | No (by design) | Use `@nextrush/adapter-bun` / `-deno` / `-edge` / `-serverless` |

**Integration**
- **Peer dependencies:** none (`@nextrush/core`, `@nextrush/errors`, `@nextrush/runtime`, `@nextrush/stream`, `@nextrush/types` are regular dependencies)
- **Works with:** `@nextrush/health` (its liveness/readiness probes rely on this package's `GracefulShutdownOptions` shape during drain)
- **Incompatible with:** none

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node `>=22`, CJS consumers can
> `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

## Troubleshooting

<details>
<summary><strong>Server never responds; request eventually returns 504 Gateway Timeout</strong></summary>

**Cause:** the handler took longer than `ServeOptions.timeout` (default 30s) to settle.
**Fix:** raise `timeout`, or fix the slow handler; check `ctx.signal.aborted` in long-running
handlers to stop work early once the timeout fires.

```typescript
await serve(app, { port: 8080, timeout: 60_000 });
```

</details>

<details>
<summary><strong>Enabling gracefulShutdown appears to change signal behavior for the whole process</strong></summary>

**Cause:** registering a signal handler changes Node's default behavior for that signal
(default: immediate process exit). If your own code also listens for `SIGTERM`/`SIGINT`, both
listeners run.
**Fix:** coordinate directly -- either let `gracefulShutdown` own the signal, or call `close()`
manually from your own handler and skip `gracefulShutdown`.

</details>

## FAQ

**Can I use this without `nextrush`?**
Yes -- install it alongside `@nextrush/core` directly, as shown in Installation.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
No -- this package is Node-only by design. Use `@nextrush/adapter-bun`, `@nextrush/adapter-deno`,
or `@nextrush/adapter-edge` for those runtimes; all adapters are conformance-tested for identical
observable behavior.

**What happens if I never call `close()`?**
The process keeps the server open until the process exits; `gracefulShutdown` is the recommended
way to have `SIGTERM`/`SIGINT` trigger a drain-and-close automatically instead of an abrupt exit.

## Package relationships

```text
                 depends on            @nextrush/core, @nextrush/errors, @nextrush/runtime,
@nextrush/adapter-node ---------------> @nextrush/stream, @nextrush/types
                 often used with       @nextrush/health (reads GracefulShutdownOptions)
                 usually used next     @nextrush/body-parser, @nextrush/cors, @nextrush/helmet
```

- **Depends on:** [`@nextrush/core`](../../core), [`@nextrush/errors`](../../errors), [`@nextrush/runtime`](../../runtime), [`@nextrush/stream`](../../stream), [`@nextrush/types`](../../types)
- **Often used with:** [`@nextrush/health`](../../middleware/health) -- its readiness/liveness probes are documented against this package's `GracefulShutdownOptions`
- **Usually used next:** [`@nextrush/body-parser`](../../middleware/body-parser), [`@nextrush/cors`](../../middleware/cors)
- **Alternative:** `@nextrush/adapter-bun` / `-deno` / `-edge` / `-serverless` -- when targeting a different runtime

## Architecture

Maintaining or contributing to this package? The internal design -- request-handling sequence,
graceful-shutdown state machine, invariants, and trade-offs -- is in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) - [Architecture](./ARCHITECTURE.md) - [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
