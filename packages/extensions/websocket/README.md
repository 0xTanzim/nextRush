# @nextrush/websocket

> Node-only WebSocket server for NextRush apps -- rooms, broadcasting, heartbeat, and a typed connection API, wired in with two explicit calls: `app.use(wss.upgrade())` and `wss.attach(server)`.

[![npm version](https://img.shields.io/npm/v/@nextrush/websocket.svg)](https://www.npmjs.com/package/@nextrush/websocket)
[![downloads](https://img.shields.io/npm/dm/@nextrush/websocket.svg)](https://www.npmjs.com/package/@nextrush/websocket)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/websocket.svg)](https://bundlephobia.com/package/@nextrush/websocket)
[![types](https://img.shields.io/npm/types/@nextrush/websocket.svg)](https://www.npmjs.com/package/@nextrush/websocket)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/websocket.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | A route-and-room-oriented WebSocket server, built on the `ws` library, for real-time features (chat, notifications, live updates) in a NextRush app |
| **Package type** | Extension (by package location) -- offers both a NextRush `Extension` (`createWebSocketExtension()`, recommended) and a manual factory + Middleware pair (`createWebSocket()`) -- see [Two integration shapes](#two-integration-shapes-extension-recommended-vs-manual-factory) |
| **Status** | Stable |
| **Included in `nextrush`?** | No -- standalone install. Not re-exported from `nextrush` or `nextrush/class`. |
| **Support tier** | Public -- extensions (stable) -- see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Node.js only -- see [Compatibility](#compatibility) for exactly what that means and why |
| **Requires** | Node >=22, ESM-only, TypeScript >=5.x, `ws` (peer, `^8.0.0`) |
| **Introduced** | v1.0.0 |

## Highlights

- Peer-depends on `ws` (`^8.0.0`), loaded dynamically only when you call `attach()`
- ESM-only, tree-shakable, side-effect-free (`sideEffects: false`)
- Fully typed -- strict TypeScript, zero `any` in the public surface
- Rooms, broadcasting, heartbeat/timeout detection, and origin/connection-limit/custom-auth gating built in

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) . [When to use](#when-to-use) . [Installation](#installation) . [Quick start](#quick-start) . [Capabilities](#capabilities) . [Mental model](#mental-model) . [Common tasks](#common-tasks) . [API overview](#api-overview) . [Options](#options) . [Compatibility](#compatibility) . [Troubleshooting](#troubleshooting) . [FAQ](#faq) . [Package relationships](#package-relationships) . [Architecture](#architecture) . [Resources](#resources)

</details>

---

## The problem

Real-time features need a persistent, bidirectional connection that plain request/response
middleware can't provide. Wiring one by hand means reaching for the raw `ws` library directly:
listening for the HTTP server's `'upgrade'` event yourself, writing your own path/origin/auth
checks before accepting a socket, and building your own room bookkeeping for "broadcast this to
everyone in room X" from scratch.

```ts
// TODAY, without this package -- wiring ws directly:
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ noServer: true });
httpServer.on('upgrade', (request, socket, head) => {
  // ... your own path check, your own origin check, your own auth check ...
  wss.handleUpgrade(request, socket, head, (ws) => {
    // ... your own room Map<string, Set<WebSocket>>, your own heartbeat setInterval ...
  });
});
```

`@nextrush/websocket` wraps that upgrade gate, room bookkeeping, and heartbeat loop behind
`createWebSocket()`, `wss.on(path, handler)`, and `conn.join(room)` / `conn.broadcast(room, data)`.

## When to use

**Use `@nextrush/websocket` if:**

- Yes -- You're running a NextRush app on Node.js and need chat, live notifications, or any
  bidirectional real-time feature
- Yes -- You want room-based broadcasting (join/leave/broadcast-to-room) without building your own
  connection-to-room bookkeeping
- Yes -- You want origin validation, connection limits, and heartbeat-based dead-connection
  detection handled for you, with sane secure-by-default behavior

**Reach for something else if:**

- No -- You're targeting Bun, Deno, or an edge runtime -- this package is Node-only (see
  [Compatibility](#compatibility)); use that runtime's native WebSocket API instead
- No -- You need cross-process broadcasting (multiple server replicas fanning out to every
  replica's connections) -- this package only broadcasts within one process's own connections;
  pair it with an external pub/sub (Redis, etc.) if you need that
- No -- You want Server-Sent Events or one-way streaming instead of a full bidirectional socket --
  use [`@nextrush/stream`](../../stream) for SSE/NDJSON

---

## Installation

```bash
pnpm add @nextrush/websocket ws
# npm i @nextrush/websocket ws . yarn add @nextrush/websocket ws . bun add @nextrush/websocket ws
```

> [!NOTE]
> `@nextrush/websocket` is not re-exported by the `nextrush` meta package -- install and import it
> directly, as shown above. `ws` is a peer dependency you install yourself.

## Quick start

**Recommended: the Extension form.** `createWebSocketExtension()` decorates `app.wss` and wires
`wss.close()` into `app.close()`'s teardown automatically (F-04b) — a missed manual disposal can
never leak the heartbeat timer or leave sockets open after shutdown.

```ts
import { createApp, listen } from 'nextrush';
import { createWebSocketExtension } from '@nextrush/websocket';

const app = createApp().extend(createWebSocketExtension());
await app.ready();

app.wss.on('/chat', (conn) => {
  conn.join('general');
  conn.on('message', (msg) => conn.broadcast('general', msg));
  conn.on('close', () => console.log(`${conn.id} disconnected`));
});

app.use(app.wss.upgrade());

const { server } = await listen(app, 8080);
await app.wss.attach(server);

// app.close() now also calls app.wss.close() -- heartbeat cleared, connections
// closed, underlying `ws` server closed. No separate wss.close() call needed.
```

`app.use(app.wss.upgrade())` and `app.wss.attach(server)` still do the same two separate jobs
described below -- the Extension form only changes *disposal*, not the upgrade-wiring contract.

**Manual form** -- for attaching to a server that isn't a NextRush `Application`, or when you
want full manual lifecycle control (including calling `wss.close()` yourself):

```ts
import { createApp, listen } from 'nextrush';
import { createWebSocket } from '@nextrush/websocket';

const app = createApp();
const wss = createWebSocket();

wss.on('/chat', (conn) => {
  conn.join('general');
  conn.on('message', (msg) => conn.broadcast('general', msg));
  conn.on('close', () => console.log(`${conn.id} disconnected`));
});

app.use(wss.upgrade());

const { server } = await listen(app, 8080);
wss.attach(server);
```

Two separate calls do two separate jobs: `app.use(wss.upgrade())` registers a passthrough
Middleware so `app.use()` accepts it; `wss.attach(server)` is what actually wires the real
`'upgrade'` event listener onto the raw `node:http` `Server` returned by `listen()`. Neither call
does the other's job -- both are required, in either form above.

## Capabilities

**Connections & routing**
- `wss.on(path, handler)` -- route-based handlers; supports exact paths, a trailing `*` prefix
  match, or `:param` segments (matched, not auto-parsed -- the handler reads `request.url` itself)
- `wss.use(middleware)` -- runs once per new connection, before its route handler, in registration order

**Rooms & broadcasting**
- `conn.join(room)` / `conn.leave(room)` / `conn.leaveAll()` -- per-connection room membership,
  capped at `maxRoomsPerConnection` (default 100, 0 = unlimited)
- `conn.broadcast(room, data)` / `wss.broadcastToRoom(room, data, exclude?)` -- send to every
  connection in a room, excluding the sender by default on the connection-level call
- `wss.broadcast(data, exclude?)` -- send to every connection on the server, regardless of room

**Connection safety**
- Origin validation (`allowedOrigins`, wildcard-capable) -- once configured, a request with no
  `Origin` header is denied, closing the header-omission bypass
- Connection limits (`maxConnections`) and payload size limits (`maxPayload`)
- Heartbeat + timeout (`heartbeatInterval`, `clientTimeout`) -- a connection that misses one full
  ping/pong round-trip is terminated
- Custom authentication via `verifyClient` -- defaults to allowing every connection if not supplied

**Developer experience**
- Fully typed -- `WSConnection`, `WSHandler`, `WSMiddleware`, `WebSocketOptions` exported
- `RoomManager`, `Connection`, `WebSocketServer` classes exported for advanced/custom usage

## Mental model

`createWebSocket()` returns a plain object with its own API -- it is not attached to the app the
way middleware or an Extension is. `upgrade()` gives `app.use()` something to hold; `attach()` is
the call that actually starts handling real upgrade requests.

```text
createWebSocket(options)  --> WebSocketServer instance (routes/middleware empty, not attached yet)
app.use(wss.upgrade())    --> registers a no-op passthrough Middleware (satisfies app.use()'s type)
wss.attach(httpServer)    --> wires httpServer.on('upgrade', ...) -- THIS is what makes connections work
        |
        +--> path match -> origin check -> connection-limit check -> verifyClient()
        +--> on success: ws.handleUpgrade() -> Connection created -> middleware -> route handler
```

**Rule:** a connection is never accepted without `attach()` having been called with the real
`node:http` `Server` -- `app.use(wss.upgrade())` alone does nothing observable.

> [!TIP]
> The full upgrade-handshake sequence and the per-connection state lifecycle (both as diagrams)
> are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Broadcast to a room

```ts
wss.on('/chat/:room', (conn, request) => {
  const room = new URL(request.url!, 'http://localhost').pathname.split('/').pop()!;
  conn.join(room);
  conn.broadcast(room, JSON.stringify({ type: 'system', message: 'A user joined' }));

  conn.on('message', (msg) => conn.broadcast(room, msg));
});
```

### Authenticate a connection before accepting it

```ts
const wss = createWebSocket({
  verifyClient: async (request) => {
    const token = request.headers.authorization;
    return validateToken(token); // your own check
  },
});
```

### Run middleware before every route handler

```ts
wss.use(async (conn, request, next) => {
  if (!request.headers['x-auth-token']) {
    conn.close(1008, 'Unauthorized');
    return; // do not call next() -- the route handler never runs
  }
  next();
});
```

### Restrict connections to specific origins

```ts
const wss = createWebSocket({
  allowedOrigins: ['https://example.com', 'https://*.example.com'],
});
```

## API overview

The sealed public surface (ADR-0005).

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `createWebSocket` | `(options?: WebSocketOptions) => WebSocketServer` | 1.0.0 | Stable | The manual factory -- for attach targets outside a NextRush `Application`, or full manual lifecycle control. |
| `createWebSocketExtension` | `(options?: WebSocketOptions) => Extension<{ wss: WebSocketServer }>` | 1.0.0 | Stable | **Recommended default.** Wraps a `WebSocketServer` as a NextRush `Extension` -- `app.extend(createWebSocketExtension())` decorates `app.wss` and wires `wss.close()` into `app.close()`'s teardown automatically (F-04b). |
| `WebSocketServer` | `class` | 1.0.0 | Stable | The server class both factories return; exported for advanced/custom usage. |
| `Connection` | `class implements WSConnection` | 1.0.0 | Stable | The per-connection wrapper over a raw `ws` socket. |
| `RoomManager` | `class` | 1.0.0 | Stable | Room join/leave/broadcast bookkeeping; exported for advanced/custom usage or standalone testing. |
| `MaxRoomsExceededError` | `class extends Error` | 1.0.0 | Stable | Thrown by `RoomManager.join()` when a connection is already at `maxRoomsPerConnection`. |
| `MAX_ROOM_NAME_LENGTH` | `256` | 1.0.0 | Stable | The maximum allowed room-name length. |
| `DEFAULT_MAX_ROOMS_PER_CONNECTION` | `100` | 1.0.0 | Stable | The default `maxRoomsPerConnection` value. |
| `WS_READY_STATE_OPEN` | `1` | 1.0.0 | Stable | The `ws` ready-state value `Connection.isOpen` checks against. |
| `DEFAULT_WS_OPTIONS` | `object` | 1.0.0 | Stable | The full set of resolved option defaults. |
| `type WebSocketOptions` / `WSConnection` / `WSHandler` / `WSMiddleware` / `WSRoute` | -- | 1.0.0 | Stable | Supporting types for options, the connection interface, handlers, middleware, and route definitions. |

## Options

Every default below is read directly from `src/types.ts`'s `DEFAULT_WS_OPTIONS`.

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------- | ----------- |
| `path` | `string \| string[]` | No | `['/']` | No | Fallback path pattern(s) checked if no registered route matches. |
| `maxPayload` | `number` | No | `1048576` (1 MB) | Yes | Maximum message size in bytes, enforced by `ws`. |
| `heartbeatInterval` | `number` | No | `30000` | No | Ping interval in ms; `0` disables heartbeat entirely. A connection is terminated the first heartbeat tick where it's found not to have responded to the *previous* ping -- so a dead connection is detected within one `heartbeatInterval` window, not `clientTimeout`. |
| `clientTimeout` | `number` | No | `60000` | No | **Declared but not read.** `types.ts` defines this option and gives it a default, but no code in `server.ts` ever references it -- the actual termination window is governed entirely by `heartbeatInterval` (see above). Setting `clientTimeout` currently has no observable effect; treat this as a known gap, not a configurable value. |
| `maxConnections` | `number` | No | `0` (unlimited) | Yes | Rejects new connections with `503` once this many are open. |
| `maxRoomsPerConnection` | `number` | No | `100` | No | `0` = unlimited. Rejoining a room already joined never counts against the limit. |
| `allowedOrigins` | `string[]` | No | `[]` (allow all) | Yes | Once non-empty, a request with no `Origin` header is denied. Supports `*` wildcards. |
| `verifyClient` | `(request) => boolean \| Promise<boolean>` | No | `undefined` (allow all) | Yes | Custom authentication check; unlike `allowedOrigins`, omitting this does **not** fail closed. |
| `perMessageDeflate` | `boolean` | No | `false` | No | Enables `ws`'s per-message compression extension. |
| `onConnection` / `onClose` / `onError` | functions | No | `undefined` | No | Lifecycle observability callbacks. |

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | 3.x |
| Node.js | >=22 |
| TypeScript | >=5.x |
| `ws` (peer) | `^8.0.0` |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Node.js >=22 | Yes | The only supported runtime. Imports `node:http` and `node:net` types directly and dynamically loads the `ws` library at `attach()` time. |
| Bun | No | No native-WebSocket code path exists in `src/`; use Bun's own `WebSocket` API instead. |
| Deno | No | No native-WebSocket code path exists in `src/`; use `Deno.upgradeWebSocket` instead. |
| Edge (Cloudflare Workers, etc.) | No | No `WebSocketPair`/Durable-Objects code path exists in `src/`; use the platform's native WebSocket support instead. |

> [!IMPORTANT]
> The conformance suite's certification matrix (`packages/adapters/conformance`) has a
> `WebSockets` row, but it measures whether a runtime's global `WebSocket` **client** constructor
> exists (`@nextrush/runtime`'s capability detection) -- an entirely different thing from this
> package's server-side implementation. That row is not evidence for `@nextrush/websocket`'s
> runtime support and should not be cited as such; this table's Node-only claim is derived
> directly from this package's own `src/` imports, independent of that matrix.

**Integration**
- **Peer dependencies:** `ws` (`^8.0.0`) -- install it alongside this package
- **Works with:** `@nextrush/adapter-node`'s `listen()` -- pass its returned `ServerInstance.server` (the raw `node:http` `Server`) to `wss.attach()`
- **Incompatible with:** none

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** -- no CommonJS build. On Node >=22, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Two integration shapes: Extension (recommended) vs. manual factory

`createWebSocket()` returns a plain `WebSocketServer` object with its own `on`/`use`/`attach`/
`upgrade` API -- it is not, by itself, a NextRush `Extension`. That is still true, and still why
this package needs two explicit calls for upgrade wiring (`app.use(wss.upgrade())` for the
Middleware slot, `wss.attach(server)` once you have the real server instance): a NextRush
Middleware or `Extension.setup()` only ever receives the app/context, never the raw `node:http`
`Server` the WebSocket upgrade handshake needs.

What changed (F-04b, D4b): the manual factory left disposal entirely up to the caller -- nothing
called `wss.close()` when the app shut down, so a missed disposal could leak the heartbeat timer
and leave sockets open. `createWebSocketExtension()` closes that gap by wrapping a
`WebSocketServer` in a NextRush `Extension` whose `destroy()` calls `wss.close()` -- registering
it with `app.extend()` means `app.close()` disposes the WebSocket server for you, under the same
bounded/isolated teardown guarantee as every other extension. The upgrade-wiring contract is
unchanged either way; only *who calls `wss.close()`* differs:

| | `createWebSocket()` (manual) | `createWebSocketExtension()` (recommended) |
| --- | --- | --- |
| Returns | A plain `WebSocketServer` | A NextRush `Extension<{ wss: WebSocketServer }>` |
| Access | The local `wss` variable you created | `app.wss`, via `app.extend()`'s decoration |
| Disposal | You must call `wss.close()` yourself | `app.close()` calls it for you automatically |
| Best for | Attaching to a server outside a NextRush `Application`; full manual lifecycle control | Any NextRush app using WebSockets -- the default choice |

## Package relationships

```text
                     peer depends on              ws (npm)
@nextrush/websocket -------------------------------------->
                     runtime depends on            @nextrush/types
                     often used with                @nextrush/adapter-node  (listen()'s raw server)
                     often used with                @nextrush/core          (createWebSocketExtension()'s Extension contract)
```

- **Depends on:** [`@nextrush/types`](../../types) at the runtime level (the `Extension`/`ExtensionContext` types `createWebSocketExtension()` implements); `ws` (`^8.0.0`) as a peer dependency.
- **Often used with:** [`@nextrush/adapter-node`](../../adapters/node) -- `listen()`'s returned `ServerInstance.server` is the object `wss.attach()` needs; [`@nextrush/core`](../../core) -- `app.extend()`/`app.close()` is what makes `createWebSocketExtension()`'s automatic disposal work.
- **Alternative:** [`@nextrush/stream`](../../stream) for one-way SSE/NDJSON streaming instead of a full bidirectional socket.

## Troubleshooting

<details>
<summary><strong>Connections never open -- the client's WebSocket immediately errors or hangs</strong></summary>

**Cause:** `wss.attach(server)` was never called, or was called with the wrong object.
`app.use(wss.upgrade())` alone registers a passthrough Middleware that does nothing observable --
it does not wire the `'upgrade'` event. **Fix:** call `wss.attach(server)` with the raw
`node:http` `Server`, e.g. `const { server } = await listen(app, 8080); wss.attach(server);` --
not `listen()`'s returned `ServerInstance` wrapper itself.

```ts
const { server } = await listen(app, 8080);
wss.attach(server); // required -- app.use(wss.upgrade()) alone is not enough
```

</details>

<details>
<summary><strong>Every connection gets rejected with a 403</strong></summary>

**Cause:** `allowedOrigins` is configured, and either the client sent no `Origin` header or its
value doesn't match any allowed entry -- once `allowedOrigins` is non-empty, a missing `Origin`
header is denied by design, to close the header-omission bypass. **Fix:** confirm the client sends
an `Origin` header matching one of the configured entries, or add a wildcard entry
(`'https://*.example.com'`).

</details>

<details>
<summary><strong><code>RoomManager.join()</code> throws <code>MaxRoomsExceededError</code></strong></summary>

**Cause:** the connection is already in `maxRoomsPerConnection` (default 100) distinct rooms.
Rejoining a room it's already in never counts against the limit. **Fix:** raise
`maxRoomsPerConnection` (or set it to `0` for unlimited) if the limit is genuinely too low for your
use case, or have the connection leave a room before joining a new one.

</details>

<details>
<summary><strong>Setting <code>clientTimeout</code> doesn't change when a dead connection is terminated</strong></summary>

**Cause:** `clientTimeout` is a known gap -- `src/types.ts` declares the option and gives it a
default, but `src/server.ts`'s heartbeat loop never reads it. The actual termination window is
governed entirely by `heartbeatInterval`: a connection is terminated the first heartbeat tick
where it's found not to have responded to the previous ping. **Fix:** adjust
`heartbeatInterval` instead -- it is the value that actually controls dead-connection detection
timing.

</details>

<details>
<summary><strong>Attaching the "ws" package is required" error at <code>attach()</code></strong></summary>

**Cause:** the `ws` peer dependency isn't installed. **Fix:** `pnpm add ws` (or `npm i ws` /
`yarn add ws` / `bun add ws`) alongside `@nextrush/websocket`.

</details>

<details>
<summary><strong>An un-awaited async call inside a message/connection handler crashed the process</strong></summary>

**Cause:** a `conn.on('message', ...)`/`conn.on('close', ...)` handler (or a room broadcast) that
starts async work without awaiting or catching it produces an unhandled rejection if that work
later fails — `@nextrush/websocket`, like the rest of NextRush, installs no global
`unhandledRejection` handler by default (see `@nextrush/core`'s README, "An un-awaited async call
crashed the process"). **Fix:** guard detached work the same way — `void doWork().catch((err) =>
logger.error(err))` — inside every connection/message handler that doesn't already return/await
its promise.

</details>

## FAQ

**Can I use this without `nextrush`?**
The `upgrade()` method returns a function shaped to satisfy NextRush's `app.use()`, but nothing
else in this package depends on a NextRush `Application` -- `createWebSocket()`, `RoomManager`,
and `Connection` work against any raw `node:http` `Server` you attach them to.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
No -- see [Compatibility](#compatibility). This package is Node-only; use each runtime's native
WebSocket API instead.

**Can I broadcast across multiple server processes/replicas?**
No -- `broadcast()`/`broadcastToRoom()` only reach connections held by the single
`WebSocketServer` instance in the current process. Pair this package with an external pub/sub
(Redis, etc.) in your own application code if you need cross-process fan-out.

---

## Architecture

Maintaining or contributing to this package? The internal design -- the upgrade-handshake
sequence, the per-connection state lifecycle, and the decisions and trade-offs behind them (with
diagrams) -- is in **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**.

## Resources

- Learn -- [Documentation](https://0xtanzim.github.io/nextRush/docs) . [Architecture](./ARCHITECTURE.md) . [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- Changelog -- [CHANGELOG.md](./CHANGELOG.md)
- Report an issue -- [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- Contribute -- [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT (c) [Tanzim Hossain](https://github.com/0xTanzim)
