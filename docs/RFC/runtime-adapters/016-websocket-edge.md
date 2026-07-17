# RFC — `@nextrush/websocket-edge` (edge-native WebSocket via `WebSocketPair` / `Deno.upgradeWebSocket`)

> Status: **Proposed** — design-only, not built. P3, post-v1. No code ships with this RFC; it is
> the specified contract future work must satisfy, per `tdd-workflow.md`'s "RFC before
> implementation" rule for new packages.
> Task: **T024** (`docs/audits/03-gap-checklist.md`, Phase 2 — Edge Runtime) · Audit ref: 01/R-13.
> Depends on: **T019** (edge adapter proven on real `workerd`/Deno in CI — ☑).
> Models: `013-adapter-contract.md`, `014-adapter-serverless.md`, `015-router-radix.md`, and the
> `packages/adapters/conformance` capability-flagged parity precedent.

## 1. Summary & motivation

This RFC specifies a **new, separate** package — `@nextrush/websocket-edge` — that brings real-time
WebSocket handling to the edge/WinterCG runtimes (**Cloudflare Workers** and **Deno / Deno
Deploy**) using each platform's native upgrade primitive (`WebSocketPair`, `Deno.upgradeWebSocket`)
instead of the Node `ws` library.

The motivation is concrete and already-documented, not hypothetical: `@nextrush/websocket` is
`node:*`-coupled and **cannot run on edge at all** (audit 01/R-13; the T022 edge-safe-middleware
doc already flags it as Node-only). "Real-time on the edge" is therefore currently *impossible*
with NextRush — a hard capability gap, not a performance nuance. Unlike RFC-015 (whose driver is
deliberately unconfirmed), this RFC's "why" is settled: the feature does not exist and cannot be
retrofitted into the existing package without dragging `node:net`/`node:http`/the `ws` dependency
into an edge bundle.

What this RFC commits to is the **design and its boundaries** — the portable connection contract,
the per-platform transport, the honest platform-support limits, and a conformance harness — so that
if/when the package is built (a P3, post-v1 decision), it is born into a specified contract and a
parity suite rather than a vacuum. It commits NextRush to **nothing at runtime today.**

## 2. Current state — `@nextrush/websocket` is Node-only by construction

The shipped extension (`packages/extensions/websocket`) exposes a deliberately clean surface:

```ts
const wss = createWebSocket(options?);          // → WebSocketServer
wss.on('/chat', (conn) => {                      // route-based handler registration
  conn.join('general');
  conn.on('message', (msg) => conn.broadcast('general', msg));
});
app.use(wss.upgrade());                          // app middleware handles the HTTP upgrade
const { server } = await listen(app, 8080);
wss.attach(server);                              // hooks the raw node:http Server 'upgrade' event
```

Its `Connection` (`WSConnection`) is the surface application code actually touches:
`id` · `url` · `request` · `isOpen` · `send` · `json` · `close` · `ping` / `pong` ·
rooms (`join` / `leave` / `leaveAll` / `getRooms` / `broadcast` / `broadcastJson`) ·
`on('message'|'close'|'error'|'ping'|'pong')` / `off`.

**Five concrete couplings make this un-portable to edge** — worth naming precisely so the design
below can address each, rather than hand-waving "it uses Node APIs":

| # | Coupling (in `@nextrush/websocket`) | Why it breaks on edge |
| --- | --- | --- |
| C1 | `loadWsLibrary()` dynamically imports the `ws` npm package | `ws` pulls in `node:net`/`node:http`/streams — absent on WinterCG isolates; also blows the T012 edge bundle budget |
| C2 | `Connection.request: IncomingMessage` (`node:http`) | Edge has no `IncomingMessage`; the handshake is a Fetch `Request` |
| C3 | `wss.attach(server)` hooks a raw `node:http.Server` `'upgrade'` event | Edge has no persistent `http.Server`; the upgrade is a `fetch` handler returning a `101` response |
| C4 | `send(data: string \| Buffer)` | `Buffer` is a Node global; edge binary is `ArrayBuffer` / `Uint8Array` |
| C5 | `RoomManager` holds every live socket in single-process memory | Edge isolates are ephemeral and per-request; there is no shared process heap to broadcast across (see §6) |

C1–C4 are mechanical (different transport, different types). **C5 is the genuinely hard one** and is
the reason this package is rated *Expert* difficulty — it is not a port, it is a different
concurrency model (§6).

## 3. Why a separate package, not an "edge mode" of `@nextrush/websocket`

The gap-checklist task phrases T024 as "**NEW** `@nextrush/websocket-edge` (or edge mode)". This RFC
picks **separate package**, decisively, for a technical reason (not just naming taste — contrast the
serverless RFC's naming decision in `014` §Decisions):

- **Dependency isolation is the whole point.** An "edge mode" flag inside `@nextrush/websocket`
  would keep the `ws` dependency and `node:*` imports in the module graph. Even behind a dynamic
  `import()`, that risks a bundler pulling `node:net` into an edge build and silently breaking the
  T012 bundle budget and the T020 WinterCG allowed-globals assertion. A separate package with **zero
  `node:*` imports and zero `ws` dependency** cannot regress those gates by construction.
- **It matches the adapter split already in the tree.** `@nextrush/adapter-edge` is a distinct
  package from `@nextrush/adapter-node` for the same reason; `@nextrush/websocket-edge` is the
  WebSocket analog of that boundary.
- **`nextrush`'s zero-dependency edge story stays intact.** The functional/edge path stays free of
  the `ws` supply-chain dependency (consistent with T001's corrected footprint claim).

The cost — two packages implementing overlapping concepts — is real and is mitigated by a **shared,
portable connection contract** (§4) plus a **parity conformance suite** (§8), exactly the levers the
adapter suite uses for four adapters.

## 4. The portable connection contract (what stays identical across runtimes)

The design goal that makes this worth doing: **application handler code should read the same on Node
and edge.** A developer's `(conn) => { conn.on('message', m => conn.send(m)) }` echo handler must be
copy-paste portable. The framework absorbs the transport difference (AGENTS.md §4, §7).

To achieve that, the portable **subset** of `WSConnection` is promoted to `@nextrush/types` as the
contract both packages implement — expressed in **Web-standard types only** (this is the key
narrowing from the Node surface):

```ts
// @nextrush/types — the runtime-agnostic connection contract
export interface EdgeWSConnection {
  readonly id: string;
  readonly url: string;
  readonly request: Request;                       // Fetch Request, NOT node:http IncomingMessage (fixes C2)
  readonly isOpen: boolean;

  send(data: string | ArrayBuffer | Uint8Array): void;   // Web binary, NOT Buffer (fixes C4)
  json(data: unknown): void;
  close(code?: number, reason?: string): void;

  on(event: 'message', handler: (data: string | ArrayBuffer) => void): void;
  on(event: 'close', handler: (code: number, reason: string) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;

  // Rooms are contract-optional — see §6. On edge they are backed by a coordinator,
  // not in-process memory, so they are a capability, not a guaranteed method.
}
```

Deliberately **excluded** from the portable contract (honest about what does not port cleanly):

- **`ping` / `pong` as app-level calls.** Cloudflare's runtime auto-responds to protocol pings and,
  under the Hibernation API, manages keepalive itself; exposing manual `ping()` would be a
  lie-shaped method on that platform. Heartbeat is a platform capability flag (§8), not a portable
  method.
- **Rooms/`broadcast`** — see §6; these are backed by a Durable Object / coordinator on edge, so
  they live on a room handle, not on every `conn`, on the edge side.

**Recommended convergence (open question, §12):** the Node `@nextrush/websocket` package currently
leaks `Buffer` and `IncomingMessage` through `WSConnection`. The cleanest end state is for the Node
package to *also* implement `EdgeWSConnection` (accepting `ArrayBuffer`/`Uint8Array` in `send`, and
exposing a Web `Request` view of the handshake) so the two are genuinely interchangeable. That is a
**minor, additive-then-breaking** change to the Node package, out of scope here, flagged for its own
RFC — this RFC only defines the target contract and does not touch the shipped Node surface.

## 5. Transport per platform

The upgrade handshake is the per-platform seam. Each transport implements the same
`EdgeWSConnection` over a different native primitive (fixes C1/C3):

### Cloudflare Workers — `WebSocketPair`

```ts
import { createCloudflareWebSocket } from '@nextrush/websocket-edge';

const ws = createCloudflareWebSocket();
ws.on('/echo', (conn) => conn.on('message', (m) => conn.send(m)));

export default {
  fetch(request) {
    if (request.headers.get('Upgrade') === 'websocket') return ws.handleUpgrade(request);
    return new Response('expected websocket', { status: 426 });
  },
};
// internally: const { 0: client, 1: server } = new WebSocketPair();
//             server.accept(); ... ; return new Response(null, { status: 101, webSocket: client });
```

### Deno / Deno Deploy — `Deno.upgradeWebSocket`

```ts
import { createDenoWebSocket } from '@nextrush/websocket-edge';

const ws = createDenoWebSocket();
ws.on('/echo', (conn) => conn.on('message', (m) => conn.send(m)));

Deno.serve((request) => ws.handleUpgrade(request));
// internally: const { socket, response } = Deno.upgradeWebSocket(request); ... ; return response;
```

### Vercel Edge / Netlify Edge — **explicitly unsupported (honest limitation)**

The edge-function runtimes on Vercel and Netlify are **request/response only** — they do not expose
a WebSocket upgrade primitive and do not hold persistent connections. This package will **not** claim
to support them; the docs must state so plainly and point users to a dedicated realtime service
(e.g. a Durable Object on CF, or an external WS provider) fronted by the edge function. This is why
T024's own acceptance criterion targets **Workers + Deno Deploy only** — the RFC's scope matches the
task's, rather than over-promising a fifth platform that physically cannot do it.

| Runtime | Upgrade primitive | Persistent connection | Cross-conn state | Supported |
| --- | --- | --- | --- | --- |
| Cloudflare Workers | `WebSocketPair` | via Durable Object | Durable Object (§6) | 🟢 |
| Cloudflare (Hibernatable) | `WebSocketPair` + `state.acceptWebSocket` | DO w/ hibernation | Durable Object | 🟢 (opt-in) |
| Deno Deploy | `Deno.upgradeWebSocket` | yes (per isolate) | single-isolate / external pub-sub | 🟢 (single-isolate) |
| Vercel Edge | — | no | — | 🔴 (documented) |
| Netlify Edge | — | no | — | 🔴 (documented) |

## 6. Rooms & broadcasting — the hard problem (Durable Objects)

The Node `RoomManager` (C5) assumes one long-lived process owns every socket, so `broadcast(room,
data)` is a memory walk. **That assumption is false on edge.** A Cloudflare Worker isolate is
spun up per request and may not share memory with the isolate holding another connection; a naive
in-memory room would silently deliver to only the connections that happen to share an isolate.

The correct edge primitive is a **coordinator that owns the connections for a topic**:

- **Cloudflare → Durable Objects.** A `WebSocketRoom` Durable Object is the single, addressable
  owner of a room. All sockets for `room="general"` are `accept()`-ed by the *same* DO instance
  (addressed by room name), which fans out messages. This is the only correct cross-connection
  primitive on Workers, and it also unlocks the **Hibernatable WebSockets API**
  (`state.acceptWebSocket(ws)` + `webSocketMessage`/`webSocketClose`/`webSocketError` handlers) so
  idle rooms stop billing wall-clock while staying connected.

  ```ts
  import { WebSocketRoom } from '@nextrush/websocket-edge/cloudflare';
  // A DO base class users extend; the framework owns accept/hibernation/fan-out.
  export class ChatRoom extends WebSocketRoom {
    onMessage(conn, data) { this.broadcast(data); }   // fan-out handled by the base class
  }
  ```

- **Deno Deploy → single-isolate rooms, external pub/sub for scale.** Within one isolate an
  in-memory room works; across isolates it needs an external coordinator (`BroadcastChannel` within
  a deployment where available, or an external pub/sub). **v1 scope ships single-isolate rooms** and
  documents the multi-isolate boundary rather than pretending it is solved.

**v1 delivery scope (matches the T024 acceptance criterion — "echo runs on Workers + Deno
Deploy"):** connection + echo + a single-DO-backed room on Cloudflare, and single-isolate rooms on
Deno. Global multi-region fan-out is a **documented follow-up**, not a v1 promise — consistent with
"measure/prove before claiming" (AGENTS.md §14).

## 7. Public DX — tiers (minimal by default)

Mirroring `014`'s tiering rule (*internal complexity must never become user complexity*):

- **Tier 1 (most users):** `createCloudflareWebSocket()` / `createDenoWebSocket()` returning an
  object with `on(path, handler)` + `handleUpgrade(request)`. One import, one upgrade call. The
  handler body is the portable §4 contract, identical to the Node package.
- **Tier 2 (tuning):** options — `maxPayload`, `verifyClient(request)` (a Web `Request`, run
  *before* `accept()`), subprotocol negotiation, hibernation on/off (CF).
- **Tier 3 (rooms / stateful):** the `WebSocketRoom` Durable Object base class (CF) under a
  `@nextrush/websocket-edge/cloudflare` subpath, marked `@advanced`. Most echo/fan-in apps never
  touch it.

## 8. Conformance & parity — reuse the adapter precedent

The strongest structural argument (identical to `015` §5) is that this repo **already** runs
many-implementations-of-one-contract parity via `packages/adapters/conformance` with capability
flags. WebSocket-edge earns its place only if held to the same bar.

A shared `defineWebSocketConformanceSuite(driver)` exercises **observable behavior** of the §4
contract — connect, echo (string **and** binary), `json()` round-trip, close-code propagation,
`verifyClient` rejection, single-room broadcast — against every driver:

```ts
export interface WSConformanceDriver {
  readonly name: string;                       // 'node-ws' | 'cloudflare' | 'deno'
  connect(path: string): Promise<TestClient>;
  // capability flags for legitimate, characterized differences (asserted, never skipped):
  readonly binaryType: 'arraybuffer' | 'buffer';
  readonly supportsManualPing: boolean;        // false on CF hibernation
  readonly supportsCrossIsolateBroadcast: boolean;
  readonly supportsHibernation: boolean;
}
```

Run under **T019's existing real-runtime CI** (`workerd`/miniflare + real Deno), so "the edge WS
path behaves like Node" is *proven on the actual isolate*, not asserted. The Node driver
characterizes the baseline first (per `tdd-workflow.md`: the suite is the spec the edge drivers must
match).

## 9. Security posture (network-exposed package — mandatory per steering)

A WebSocket endpoint is a public network surface; `project-rules.instructions.md` §4 and the global
security standard require this be explicit, not implied:

- **Origin verification (CSWSH).** Cross-Site WebSocket Hijacking is the signature WS vuln. The
  package must offer `verifyOrigin`/`verifyClient(request)` run **before** `accept()`/`101`, reading
  the Web `Request` headers; docs must show an allow-listed origin check as the default-secure
  pattern (never a wildcard default — mirrors the CORS rule in §4 of project rules).
- **Auth before accept.** Token/session checks happen in `verifyClient` prior to the upgrade, so an
  unauthenticated client never reaches an accepted socket. Edge-portable JWT (T030, Web Crypto) is
  the intended companion.
- **Payload limits.** `maxPayload` enforced to bound memory/abuse; oversized frames close with a
  policy code.
- **No secret logging**, constant-time token compare where applicable — same standards as the rest
  of the tree.

## 10. Sequencing — foundation first (non-negotiable, per `tdd-workflow.md`)

1. **Contract:** land `EdgeWSConnection` (§4) in `@nextrush/types`. No transport yet.
2. **Conformance harness + Node baseline:** author the suite (§8), implement the `node-ws` driver,
   characterize existing behavior. Standalone value even if edge is never built (hardens the Node
   package we already ship — same hedge as `015` §6).
3. **Cloudflare transport + echo** (`WebSocketPair`), green against the suite on `workerd`.
4. **Cloudflare `WebSocketRoom` Durable Object** (rooms + hibernation).
5. **Deno transport + echo** (`Deno.upgradeWebSocket`), green against the suite on real Deno.
6. **Deploy examples + CI smoke** per T021 (Workers + Deno Deploy), satisfying T024's validation
   step (a WS client round-trips echo against the deployed example).

Steps 1–2 are valuable regardless of the go/no-go on the edge transports.

## 11. Costs & risks

- **Maintenance / bus-factor (dominant cost).** T059 flags a single-maintainer project. This adds a
  second WebSocket surface, a Durable Object model, and a conformance harness. Mitigation: the
  portable contract (§4) and shared suite (§8) keep the *conceptual* surface one thing with two
  transports, not two unrelated products. Still, this is the strongest argument for keeping it P3 /
  post-v1.
- **Cloudflare lock-in for rooms.** Durable Objects are CF-proprietary. Mitigation: rooms live under
  an opt-in `@nextrush/websocket-edge/cloudflare` subpath; the base connection/echo path is
  DO-free and portable. Users who only need echo/fan-in never take the DO dependency.
- **Contract drift** between Node and edge connections. Mitigation: exactly what §8's suite prevents.
- **Partial portability is honest, not hidden.** `ping`/`pong` and cross-isolate broadcast do not
  port cleanly; the RFC surfaces these as capability flags rather than papering over them.
- **Over-commitment risk.** An RFC can read as a build order. Mitigation: status is
  **Proposed — design-only**; it can stay accepted-as-design and never-built with no inconsistency
  (same stance as `015`).

## 12. Non-goals & open questions

**Non-goals:**

- **Not building `@nextrush/websocket-edge` in this change** — RFC only; no package, no code.
- **Not modifying the shipped `@nextrush/websocket` surface** — the §4 convergence (narrowing
  `Buffer`/`IncomingMessage`) is a separate, future, RFC-gated change.
- **Not supporting Vercel/Netlify edge WebSockets** — physically unavailable there (§5); documented
  as unsupported rather than faked.
- **Not shipping global multi-region fan-out in v1** — single-DO / single-isolate rooms first (§6).
- **Not replacing `@nextrush/websocket`** — Node stays Node; this is additive.

**Open questions:**

- **Contract home & Node convergence:** does `EdgeWSConnection` live in `@nextrush/types` with the
  Node package converging onto it (a minor breaking change there), or does edge define a parallel
  contract? Recommended: shared in `@nextrush/types`, Node converges under its own RFC.
- **Durable Object dependency shape:** is a CF DO base class acceptable as an opt-in subpath, or
  should rooms be a wholly separate `@nextrush/websocket-edge-cloudflare` package? Leaning subpath
  (one package, tree-shakeable, per `014`'s "named exports over package-per-provider").
- **Deno multi-isolate fan-out:** `BroadcastChannel` vs. external pub/sub — deferred to build time.
- **Package/subpath naming** and whether hibernation is default-on for CF rooms.

## Acceptance / verification (of this RFC)

This RFC is satisfied when: the file exists at `docs/RFC/runtime-adapters/016-websocket-edge.md`
following the existing RFC convention and is registered in `docs/RFC/INDEX.md`; it names the five
Node couplings that block edge use (§2) and a portable, Web-standard `EdgeWSConnection` contract that
fixes C2/C4 (§4); it specifies the `WebSocketPair` and `Deno.upgradeWebSocket` transports (§5),
states Vercel/Netlify as explicitly unsupported, and designs the Durable-Object-backed room model
for cross-connection state (§6); it reuses the `packages/adapters/conformance` capability-flag
pattern run under T019's real-runtime CI (§8); it documents the network-security posture (§9); and
its costs section addresses single-maintainer bus-factor and CF lock-in (§11). **No code ships with
this RFC** — T024 remains □ Not Started; only its design now exists.
